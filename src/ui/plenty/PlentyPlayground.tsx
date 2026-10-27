import { useCallback, useEffect, useRef, useState } from 'react';
import { createRng, randomSeed } from '../../engine/rng.ts';
import type { LineWin } from '../../plenty/evaluate.ts';
import { fillGrid, type Machine } from '../../plenty/machine.ts';
import {
  BET_LEVELS,
  canSpin,
  collect,
  gamble,
  MAX_GAMBLES,
  newSession,
  playSpin,
  setBet,
  stepBet,
  type CardColor,
  type SessionState,
  type SpinOutcome,
} from '../../plenty/session.ts';
import { SYMBOL_NAMES } from '../../plenty/symbols.ts';
import { MiniStat } from '../Cards.tsx';
import { formatMoney, formatPct } from '../format.ts';
import type { ReelSpin } from '../Reels.tsx';
import { downloadCsv, loadJson, saveJson } from '../storage.ts';
import { useSpaceToSpin } from '../useSpaceToSpin.ts';
import { PlentyCabinet } from './PlentyCabinet.tsx';
import { PrizeHistory, type PrizeRecord } from './PrizeHistory.tsx';
import { StreakPanel, type SpinRecord } from './StreakPanel.tsx';

type LogKind = 'win' | 'ldw' | 'stars' | 'near' | 'gamble' | 'bet' | 'loss' | 'info';

interface LogEntry {
  id: number;
  spin: number;
  kind: LogKind;
  text: string;
}

const LOG_STYLE: Record<LogKind, string> = {
  win: 'border-emerald-500 text-emerald-200',
  ldw: 'border-orange-500 text-orange-200',
  stars: 'border-yellow-300 text-yellow-100',
  near: 'border-sky-500 text-sky-200',
  gamble: 'border-fuchsia-500 text-fuchsia-200',
  bet: 'border-cyan-400 text-cyan-100',
  loss: 'border-neutral-700 text-neutral-400',
  info: 'border-neutral-500 text-neutral-300',
};

const LOG_LABEL: Record<LogKind, string> = {
  win: 'Premio',
  ldw: 'LDW',
  stars: 'Estrellas',
  near: 'Near miss',
  gamble: 'Doble o nada',
  bet: 'Apuesta',
  loss: 'Sin premio',
  info: 'Aviso',
};

const MAX_LOG = 250;
const START_STOPS = [10, 12, 16, 20, 24];

type Totals = { spins: number; wagered: number; paid: number; ldw: number; nearSpins: number; starWins: number; lastWin: number };
const EMPTY_TOTALS: Totals = { spins: 0, wagered: 0, paid: 0, ldw: 0, nearSpins: 0, starWins: 0, lastWin: 0 };

const describe = (w: LineWin) => `${SYMBOL_NAMES[w.symbol].split(' (')[0]} x${w.count} en línea ${w.line + 1} (${w.pay}x)`;

const STORAGE_KEY = 'slotlab.plenty.v1';
/** Spins kept on the device for the streak panel and the Excel export (~100 bytes each). */
const MAX_SAVED_SPINS = 10_000;
const MAX_SAVED_PRIZES = 5_000;

interface Saved {
  /** Settings version the session belongs to; a new "Aplicar" starts a fresh session. */
  version: number;
  session: SessionState;
  totals: Totals;
  history: SpinRecord[];
  prizes: PrizeRecord[];
}

interface Props {
  machine: Machine;
  startBalance: number;
  bet: number;
  /** Settings version from the lab; the saved session is resumed only if it matches. */
  configVersion: number;
  /** False while another tab or game is showing: the space bar must not spin a hidden machine. */
  active: boolean;
}

export function PlentyPlayground({ machine, startBalance, bet, configVersion, active }: Props) {
  const rngRef = useRef(createRng(randomSeed()));
  // Statistics and prizes survive reloads and new settings; the balance resumes only under the same settings.
  const savedRef = useRef<Saved | null | undefined>(undefined);
  if (savedRef.current === undefined) savedRef.current = loadJson<Saved>(STORAGE_KEY);
  const saved = savedRef.current;
  // Refs hold the authoritative state so a key press between renders never plays from a stale session.
  const sessionRef = useRef<SessionState>(saved && saved.version === configVersion ? saved.session : newSession(startBalance, bet));
  const gridRef = useRef<number[]>([]);
  if (gridRef.current.length === 0) {
    const g = new Array<number>(15);
    fillGrid(machine.strips, START_STOPS, g);
    gridRef.current = g;
  }
  const totalsRef = useRef<Totals>(saved?.totals ?? EMPTY_TOTALS);
  const historyRef = useRef<SpinRecord[]>(saved?.history ?? []);
  const prizesRef = useRef<PrizeRecord[]>(saved?.prizes ?? []);
  const pendingRef = useRef<{ state: SessionState; outcome: SpinOutcome } | null>(null);
  const spinIdRef = useRef(0);
  const logId = useRef(0);

  const [session, setSession] = useState<SessionState>(sessionRef.current);
  const [grid, setGrid] = useState<number[]>(gridRef.current);
  const [spin, setSpin] = useState<ReelSpin | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [shown, setShown] = useState<SpinOutcome | null>(null);
  const [gambling, setGambling] = useState(false);
  const [cards, setCards] = useState<CardColor[]>([]);
  const [turbo, setTurbo] = useState(false);
  const [auto, setAuto] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [totals, setTotals] = useState<Totals>(totalsRef.current);
  const [history, setHistory] = useState<SpinRecord[]>(historyRef.current);
  const [prizes, setPrizes] = useState<PrizeRecord[]>(prizesRef.current);

  useEffect(() => {
    saveJson(STORAGE_KEY, { version: configVersion, session, totals, history, prizes } satisfies Saved);
  }, [configVersion, session, totals, history, prizes]);
  const autoRef = useRef(auto);
  autoRef.current = auto;

  const push = useCallback((entries: Omit<LogEntry, 'id'>[]) => {
    setLog((prev) => [...entries.map((e) => ({ ...e, id: ++logId.current })).reverse(), ...prev].slice(0, MAX_LOG));
  }, []);

  const commit = useCallback((state: SessionState, totals: Totals) => {
    sessionRef.current = state;
    totalsRef.current = totals;
    setSession(state);
    setTotals(totals);
  }, []);

  /** Pays the pending win into the balance and counts it as paid. */
  const doCollect = useCallback(() => {
    const s = sessionRef.current;
    if (s.pendingWin === 0) return;
    const t = totalsRef.current;
    commit(collect(s), { ...t, paid: t.paid + s.pendingWin });
    setGambling(false);
  }, [commit]);

  const doSpin = useCallback(() => {
    if (pendingRef.current) return;
    // Start collects a waiting win first, as on the real machine.
    if (sessionRef.current.pendingWin > 0) doCollect();
    const current = sessionRef.current;
    if (!canSpin(current)) {
      setAuto(false);
      push([{ spin: totalsRef.current.spins, kind: 'info', text: 'Saldo insuficiente para la apuesta. Baja la apuesta o reinicia.' }]);
      return;
    }
    const step = playSpin(machine, current, rngRef.current);
    pendingRef.current = step;
    setSpinning(true);
    setShown(null);
    setGambling(false);
    setSpin({ id: ++spinIdRef.current, stops: step.outcome.stops, strips: machine.strips, previous: gridRef.current });
    gridRef.current = step.outcome.grid;
    setGrid(step.outcome.grid);
  }, [machine, push, doCollect]);

  const onStopped = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    const { state, outcome } = p;
    const prev = totalsRef.current;
    const n = prev.spins + 1;
    const ev = outcome.evaluation;
    const entries: Omit<LogEntry, 'id'>[] = [];

    if (ev.scatterMultiplier > 0) {
      entries.push({ spin: n, kind: 'stars', text: `${ev.stars} estrellas en pantalla: ${ev.scatterMultiplier}x la apuesta (${formatMoney(ev.scatterMultiplier * outcome.charged)}).` });
    }
    if (outcome.ldw) {
      entries.push({
        spin: n,
        kind: 'ldw',
        text: `Apostó ${formatMoney(outcome.charged)} y ganó ${formatMoney(outcome.win)}: celebra un premio pero pierde ${formatMoney(outcome.charged - outcome.win)}.`,
      });
    } else if (outcome.win > 0) {
      const lines = ev.wins.map(describe).join(', ');
      entries.push({ spin: n, kind: 'win', text: `Ganó ${formatMoney(outcome.win)}${lines ? ` (${lines})` : ''}.` });
    } else {
      entries.push({ spin: n, kind: 'loss', text: `Apostó ${formatMoney(outcome.charged)}, nada pagó.` });
    }
    for (const nm of ev.nearMisses) {
      entries.push({
        spin: n,
        kind: 'near',
        text: nm.kind === 'stars' ? '2 estrellas, faltó la tercera.' : `Línea ${(nm.line ?? 0) + 1}: 4 sietes, faltó el quinto (1,000x).`,
      });
    }
    push(entries);

    const next: Totals = {
      ...prev,
      spins: n,
      wagered: prev.wagered + outcome.charged,
      ldw: prev.ldw + (outcome.ldw ? 1 : 0),
      nearSpins: prev.nearSpins + (ev.nearMisses.length > 0 ? 1 : 0),
      starWins: prev.starWins + (ev.scatterMultiplier > 0 ? 1 : 0),
      lastWin: outcome.win,
    };
    commit(state, next);
    const at = Date.now();
    historyRef.current = [...historyRef.current, { spin: n, at, bet: outcome.charged, win: outcome.win, balance: state.balance + state.pendingWin }].slice(-MAX_SAVED_SPINS);
    setHistory(historyRef.current);
    if (outcome.win > 0) {
      const parts = ev.wins.map(describe);
      if (ev.scatterMultiplier > 0) parts.push(`${ev.stars} estrellas (${ev.scatterMultiplier}x la apuesta)`);
      prizesRef.current = [...prizesRef.current, { spin: n, at, bet: outcome.charged, win: outcome.win, detail: parts.join(' · '), stars: ev.stars }].slice(-MAX_SAVED_PRIZES);
      setPrizes(prizesRef.current);
    }
    setShown(outcome);
    setSpinning(false);
    // Auto play never gambles.
    if (state.pendingWin > 0 && autoRef.current) {
      const t = totalsRef.current;
      commit(collect(state), { ...t, paid: t.paid + state.pendingWin });
    }
  }, [push, commit]);

  const exportCsv = () => {
    const detail = new Map(prizesRef.current.map((p) => [p.spin, p.detail]));
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `frutas20-historial-${stamp}.csv`,
      ['Giro', 'Fecha', 'Apuesta', 'Premio', 'Veces la apuesta', 'Saldo', 'Detalle'],
      historyRef.current.map((r) => [
        r.spin,
        new Date(r.at).toLocaleString('es-PA'),
        (r.bet / 100).toFixed(2),
        (r.win / 100).toFixed(2),
        (r.win / r.bet).toFixed(2),
        (r.balance / 100).toFixed(2),
        detail.get(r.spin) ?? '',
      ]),
    );
  };

  /** Clears statistics and prizes on this device; the current balance stays. */
  const clearHistory = () => {
    historyRef.current = [];
    prizesRef.current = [];
    setHistory([]);
    setPrizes([]);
    setLog([]);
    commit(sessionRef.current, EMPTY_TOTALS);
  };

  const changeBet = useCallback(
    (bet: number) => {
      const s = sessionRef.current;
      if (pendingRef.current || bet === s.bet) return;
      commit(setBet(s, bet), totalsRef.current);
      push([{ spin: totalsRef.current.spins, kind: 'bet', text: `Apuesta de ${formatMoney(s.bet)} a ${formatMoney(bet)}.` }]);
    },
    [commit, push],
  );

  const doGamble = (guess: CardColor) => {
    const s = sessionRef.current;
    if (s.pendingWin === 0 || pendingRef.current) return;
    const stake = s.pendingWin;
    const r = gamble(s, guess, rngRef.current);
    setCards((c) => [r.card, ...c].slice(0, 5));
    const t = totalsRef.current;
    const color = r.card === 'red' ? 'roja' : 'negra';
    // A collected-after-max double lands in the balance: count it as paid.
    const autoCollected = r.won && r.state.pendingWin === 0;
    commit(r.state, autoCollected ? { ...t, paid: t.paid + stake * 2 } : t);
    if (r.state.pendingWin === 0) setGambling(false);
    push([
      {
        spin: t.spins,
        kind: 'gamble',
        text: r.won
          ? `Carta ${color}: ${formatMoney(stake)} se volvió ${formatMoney(stake * 2)}${autoCollected ? ` (máximo de ${MAX_GAMBLES} dobles, cobrado)` : ''}.`
          : `Carta ${color}: perdió ${formatMoney(stake)}.`,
      },
    ]);
  };

  useEffect(() => {
    if (!auto || spinning) return;
    const timer = window.setTimeout(doSpin, turbo ? 20 : 350);
    return () => window.clearTimeout(timer);
  }, [auto, spinning, doSpin, turbo]);

  // Auto play stops when this machine is hidden; it never plays unseen.
  useEffect(() => {
    if (!active) setAuto(false);
  }, [active]);

  useSpaceToSpin(active && !gambling, doSpin);

  const sessionRtp = totals.wagered > 0 ? totals.paid / totals.wagered : 0;
  const displayBalance = spinning && pendingRef.current ? session.balance - pendingRef.current.outcome.charged : session.balance;
  const winLines = shown ? shown.evaluation.wins.map((w) => w.line) : [];
  const starCells = shown && shown.evaluation.scatterMultiplier > 0 ? shown.evaluation.starCells : [];
  const betIndex = BET_LEVELS.indexOf(session.bet);
  const locked = spinning || auto;

  const gambleScreen = gambling && session.pendingWin > 0 && (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#0f5c4c] to-[#063a2f] p-4 text-white">
      <div className="flex w-full max-w-lg justify-between text-center">
        <div>
          <p className="text-sm font-bold text-neutral-200">Monto en juego</p>
          <p className="font-mono text-2xl font-black text-yellow-300">{formatMoney(session.pendingWin)}</p>
        </div>
        <div>
          <p className="text-sm font-bold text-neutral-200">Para ganar</p>
          <p className="font-mono text-2xl font-black text-yellow-300">{formatMoney(session.pendingWin * 2)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="mr-1 text-sm text-neutral-300">Cartas anteriores</span>
        {cards.map((c, i) => (
          <span key={i} className={`flex h-12 w-9 items-center justify-center rounded border border-neutral-300 bg-white text-xl ${c === 'red' ? 'text-red-600' : 'text-black'}`}>
            {c === 'red' ? '♥' : '♠'}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-6">
        <button type="button" onClick={() => doGamble('red')} className="h-16 w-36 rounded-full border-4 border-neutral-300 bg-gradient-to-b from-red-400 to-red-700 text-xl font-black text-white shadow-lg">
          Roja
        </button>
        <div className="h-24 w-16 rounded-md border-2 border-white bg-[repeating-linear-gradient(45deg,#b91c1c_0_6px,#7f1d1d_6px_12px)] shadow-lg" aria-hidden />
        <button type="button" onClick={() => doGamble('black')} className="h-16 w-36 rounded-full border-4 border-neutral-300 bg-gradient-to-b from-neutral-600 to-black text-xl font-black text-white shadow-lg">
          Negra
        </button>
      </div>
      <button type="button" onClick={doCollect} className="rounded-full bg-gradient-to-b from-lime-300 to-lime-600 px-8 py-2 font-black text-[#0f3d05]">
        Cobrar
      </button>
      <p className="text-xs text-neutral-300">
        Dobles usados {session.gamblesUsed}/{MAX_GAMBLES}. Es 50/50: no cambia lo que devuelve la máquina, solo hace los resultados más extremos.
      </p>
    </div>
  );

  return (
    <div className="space-y-5">
      <PlentyCabinet
        grid={grid}
        spin={spin}
        winLines={winLines}
        starCells={starCells}
        balance={displayBalance}
        bet={session.bet}
        lastWin={totals.lastWin}
        pendingWin={session.pendingWin}
        spinning={spinning}
        auto={auto}
        turbo={turbo}
        canBetDown={!locked && betIndex !== 0}
        canBetUp={!locked && betIndex !== BET_LEVELS.length - 1}
        onBet={(dir) => changeBet(stepBet(sessionRef.current.bet, dir))}
        onMaxBet={() => changeBet(BET_LEVELS[BET_LEVELS.length - 1])}
        onTurbo={() => setTurbo((t) => !t)}
        onAuto={() => setAuto((a) => !a)}
        onSpin={doSpin}
        onGamble={() => setGambling(true)}
        onStopped={onStopped}
        overlay={gambleScreen || null}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <StreakPanel history={history} startBalance={startBalance} bet={session.bet} onBet={changeBet} locked={locked} />
          <PrizeHistory prizes={prizes} totalSpins={totals.spins} onExport={exportCsv} onClear={clearHistory} />
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <MiniStat label="Giros" value={String(totals.spins)} />
            <MiniStat label="RTP de la sesión" value={formatPct(sessionRtp)} />
            <MiniStat label="LDW / near miss" value={`${totals.ldw} / ${totals.nearSpins}`} />
            <MiniStat label="Premios de estrellas" value={String(totals.starWins)} />
          </div>
          <p className="text-xs text-neutral-500">Barra espaciadora = girar · el modo auto cobra sin jugar el doble o nada · el conejo es el modo turbo.</p>
        </div>

        <aside className="flex max-h-[520px] min-w-0 flex-col rounded-2xl bg-neutral-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-100">Registro en vivo</h2>
            <button type="button" onClick={() => setLog([])} className="text-xs text-neutral-400 hover:text-neutral-200">
              Limpiar
            </button>
          </div>
          <ol className="flex-1 space-y-1.5 overflow-y-auto pr-1 text-sm" aria-live="polite">
            {log.length === 0 && <li className="text-neutral-500">Gira para empezar.</li>}
            {log.map((e) => (
              <li key={e.id} className={`border-l-4 bg-neutral-950/60 px-3 py-1.5 ${LOG_STYLE[e.kind]}`}>
                <span className="mr-2 font-mono text-xs text-neutral-500">#{e.spin}</span>
                <span className="mr-1 font-semibold">{LOG_LABEL[e.kind]}:</span>
                {e.text}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
