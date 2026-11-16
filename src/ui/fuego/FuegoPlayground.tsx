import { useCallback, useEffect, useRef, useState } from 'react';
import { createRng, randomSeed } from '../../engine/rng.ts';
import type { WayWin } from '../../fuego/evaluate.ts';
import { fillGrid, type Machine } from '../../fuego/machine.ts';
import {
  BET_LEVELS,
  canGamble,
  canSpin,
  collect,
  gamble,
  GAMBLE_LIMIT_X,
  MAX_GAMBLES,
  newSession,
  playSpin,
  setBet,
  spinWheel,
  stepBet,
  type CardColor,
  type SessionState,
  type SpinOutcome,
  type WheelOutcome,
} from '../../fuego/session.ts';
import { SYMBOL_NAMES } from '../../fuego/symbols.ts';
import { MiniStat } from '../Cards.tsx';
import { formatMoney, formatPct } from '../format.ts';
import type { ReelSpin } from '../Reels.tsx';
import { downloadCsv, loadJson, saveJson } from '../storage.ts';
import { useSpaceToSpin } from '../useSpaceToSpin.ts';
import { PrizeHistory, type PrizeRecord } from '../plenty/PrizeHistory.tsx';
import { StreakPanel, type SpinRecord } from '../plenty/StreakPanel.tsx';
import { FuegoCabinet, type Banner } from './FuegoCabinet.tsx';
import { FuegoWheel } from './FuegoWheel.tsx';

type LogKind = 'win' | 'wheel' | 'free' | 'near' | 'gamble' | 'bet' | 'loss' | 'info';

interface LogEntry {
  id: number;
  spin: number;
  kind: LogKind;
  text: string;
}

const LOG_STYLE: Record<LogKind, string> = {
  win: 'border-emerald-500 text-emerald-200',
  wheel: 'border-yellow-300 text-yellow-100',
  free: 'border-orange-400 text-orange-100',
  near: 'border-sky-500 text-sky-200',
  gamble: 'border-fuchsia-500 text-fuchsia-200',
  bet: 'border-cyan-400 text-cyan-100',
  loss: 'border-neutral-700 text-neutral-400',
  info: 'border-neutral-500 text-neutral-300',
};

const LOG_LABEL: Record<LogKind, string> = {
  win: 'Premio',
  wheel: 'Rueda',
  free: 'Giros gratis',
  near: 'Faltó una rueda',
  gamble: 'Doble o nada',
  bet: 'Apuesta',
  loss: 'Sin premio',
  info: 'Aviso',
};

const MAX_LOG = 250;
/** Opening window: a full reel of cherries, lemons and oranges, as the genre's attract screen. */
const START_STOPS = [1, 1, 1];
/** A win of this many times the stake gets the big-win banner. */
const BIG_WIN = 10;
/** Seconds before the wheel turns by itself, as in the original. */
const WHEEL_WAIT = 15;
const BANNER_MS = 2_300;

type Totals = { spins: number; wagered: number; paid: number; wheels: number; freeRounds: number; nearSpins: number; lastWin: number };
const EMPTY_TOTALS: Totals = { spins: 0, wagered: 0, paid: 0, wheels: 0, freeRounds: 0, nearSpins: 0, lastWin: 0 };

const describe = (w: WayWin) => `${SYMBOL_NAMES[w.symbol]} x3 en ${w.ways} ${w.ways === 1 ? 'forma' : 'formas'} (${w.pay}x)`;
const shortWin = (w: WayWin) => `3 × ${SYMBOL_NAMES[w.symbol].toUpperCase()} EN ${w.ways} ${w.ways === 1 ? 'FORMA' : 'FORMAS'}`;

const STORAGE_KEY = 'slotlab.fuego.v1';
const MAX_SAVED_SPINS = 10_000;
const MAX_SAVED_PRIZES = 5_000;

interface Saved {
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
  configVersion: number;
  /** False while another tab or game is showing: nothing plays unseen. */
  active: boolean;
}

export function FuegoPlayground({ machine, startBalance, bet, configVersion, active }: Props) {
  const rngRef = useRef(createRng(randomSeed()));
  const savedRef = useRef<Saved | null | undefined>(undefined);
  if (savedRef.current === undefined) savedRef.current = loadJson<Saved>(STORAGE_KEY);
  const saved = savedRef.current;
  // Refs hold the authoritative state so a key press between renders never plays from a stale session.
  const sessionRef = useRef<SessionState>(saved && saved.version === configVersion ? saved.session : newSession(startBalance, bet));
  const gridRef = useRef<number[]>([]);
  if (gridRef.current.length === 0) {
    const g = new Array<number>(9);
    fillGrid(machine.base.strips, START_STOPS, g);
    gridRef.current = g;
  }
  const totalsRef = useRef<Totals>(saved?.totals ?? EMPTY_TOTALS);
  const historyRef = useRef<SpinRecord[]>(saved?.history ?? []);
  const prizesRef = useRef<PrizeRecord[]>(saved?.prizes ?? []);
  const pendingRef = useRef<{ state: SessionState; outcome: SpinOutcome } | null>(null);
  const wheelRef = useRef<WheelOutcome | null>(null);
  const spinIdRef = useRef(0);
  const logId = useRef(0);
  const bannerId = useRef(0);

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
  const [wheelOpen, setWheelOpen] = useState(sessionRef.current.wheelPending);
  const [wheelTarget, setWheelTarget] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(WHEEL_WAIT);
  const [banner, setBanner] = useState<Banner | null>(null);
  /** Session as it was before the wheel turned; shown until the wheel stops so nothing gives the result away. */
  const [wheelView, setWheelView] = useState<SessionState | null>(null);
  /** Alternates the message strip with what to do next while a win waits. */
  const [hintOn, setHintOn] = useState(false);

  const autoRef = useRef(auto);
  autoRef.current = auto;
  const turboRef = useRef(turbo);
  turboRef.current = turbo;

  useEffect(() => {
    saveJson(STORAGE_KEY, { version: configVersion, session, totals, history, prizes } satisfies Saved);
  }, [configVersion, session, totals, history, prizes]);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), BANNER_MS);
    return () => window.clearTimeout(t);
  }, [banner]);

  const showBanner = useCallback((title: string, amount?: number) => {
    if (turboRef.current) return;
    setBanner({ id: ++bannerId.current, title, amount });
  }, []);

  const push = useCallback((entries: Omit<LogEntry, 'id'>[]) => {
    setLog((prev) => [...entries.map((e) => ({ ...e, id: ++logId.current })).reverse(), ...prev].slice(0, MAX_LOG));
  }, []);

  const commit = useCallback((state: SessionState, t: Totals) => {
    sessionRef.current = state;
    totalsRef.current = t;
    setSession(state);
    setTotals(t);
  }, []);

  /** Adds a bonus win to the paid spin that triggered it, so the streak panel sees it. */
  const addToLastSpin = useCallback((cents: number) => {
    const h = historyRef.current;
    if (h.length === 0 || cents === 0) return;
    const last = h[h.length - 1];
    historyRef.current = [...h.slice(0, -1), { ...last, win: last.win + cents, balance: last.balance + cents }];
    setHistory(historyRef.current);
  }, []);

  const addPrize = useCallback((record: PrizeRecord) => {
    prizesRef.current = [...prizesRef.current, record].slice(-MAX_SAVED_PRIZES);
    setPrizes(prizesRef.current);
  }, []);

  const doCollect = useCallback(() => {
    const s = sessionRef.current;
    if (s.pendingWin === 0) return;
    const t = totalsRef.current;
    commit(collect(s), { ...t, paid: t.paid + s.pendingWin });
    setGambling(false);
  }, [commit]);

  const doSpin = useCallback(() => {
    if (pendingRef.current || wheelRef.current || sessionRef.current.wheelPending) return;
    if (sessionRef.current.pendingWin > 0 && sessionRef.current.freeSpinsLeft === 0) doCollect();
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
    const strips = step.outcome.isFreeSpin ? machine.free.strips : machine.base.strips;
    setSpin({ id: ++spinIdRef.current, stops: step.outcome.stops, strips, previous: gridRef.current });
    gridRef.current = step.outcome.grid;
    setGrid(step.outcome.grid);
  }, [machine, push, doCollect]);

  const onStopped = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    const { state, outcome } = p;
    const prev = totalsRef.current;
    const ev = outcome.evaluation;
    const at = Date.now();
    const entries: Omit<LogEntry, 'id'>[] = [];

    if (outcome.isFreeSpin) {
      const played = state.freeSpinsTotal - state.freeSpinsLeft;
      entries.push({
        spin: prev.spins,
        kind: 'free',
        text: `Giro gratis ${played} de ${state.freeSpinsTotal}: ${outcome.win > 0 ? `ganó ${formatMoney(outcome.win)} (${ev.wins.map(describe).join(', ')})` : 'sin premio'}.`,
      });
      let next: Totals = { ...prev, lastWin: outcome.win };
      if (outcome.roundOver) {
        entries.push({ spin: prev.spins, kind: 'free', text: `Ronda de ${state.freeSpinsTotal} giros gratis terminada: ${formatMoney(state.roundWin)}.` });
        next = { ...next, freeRounds: prev.freeRounds + 1, lastWin: state.roundWin };
        addToLastSpin(state.roundWin);
        if (state.roundWin > 0) {
          addPrize({ spin: prev.spins, at, bet: state.roundBet, win: state.roundWin, detail: `${state.freeSpinsTotal} giros gratis`, stars: 3 });
        }
        showBanner('TOTAL DE LA RONDA', state.roundWin);
      } else if (outcome.win >= BIG_WIN * state.roundBet) {
        showBanner('¡GRAN PREMIO!', outcome.win);
      }
      push(entries);
      commit(state, next);
      setShown(outcome);
      setSpinning(false);
      return;
    }

    const n = prev.spins + 1;
    if (outcome.win > 0) {
      entries.push({ spin: n, kind: 'win', text: `Ganó ${formatMoney(outcome.win)} (${ev.wins.map(describe).join(', ')}).` });
    } else if (!outcome.trigger) {
      entries.push({ spin: n, kind: 'loss', text: `Apostó ${formatMoney(outcome.charged)}, nada pagó.` });
    }
    if (outcome.trigger) entries.push({ spin: n, kind: 'wheel', text: 'Tres ruedas: se activa la rueda misteriosa.' });
    else if (ev.nearMiss) entries.push({ spin: n, kind: 'near', text: 'Ruedas en 2 rodillos, faltó la tercera.' });
    push(entries);

    const next: Totals = {
      ...prev,
      spins: n,
      wagered: prev.wagered + outcome.charged,
      wheels: prev.wheels + (outcome.trigger ? 1 : 0),
      nearSpins: prev.nearSpins + (ev.nearMiss && !outcome.trigger ? 1 : 0),
      lastWin: outcome.win,
    };
    commit(state, next);
    historyRef.current = [...historyRef.current, { spin: n, at, bet: outcome.charged, win: outcome.win, balance: state.balance + state.pendingWin }].slice(-MAX_SAVED_SPINS);
    setHistory(historyRef.current);
    if (outcome.win > 0) addPrize({ spin: n, at, bet: outcome.charged, win: outcome.win, detail: ev.wins.map(describe).join(' · '), stars: 0 });
    setShown(outcome);
    setSpinning(false);

    if (outcome.trigger) {
      showBanner('¡RUEDA MISTERIOSA!');
      window.setTimeout(() => {
        setCountdown(WHEEL_WAIT);
        setWheelOpen(true);
      }, turboRef.current ? 150 : 1_400);
      return;
    }
    if (outcome.win >= BIG_WIN * outcome.charged) showBanner('¡GRAN PREMIO!', outcome.win);
    // Auto play never gambles.
    if (state.pendingWin > 0 && autoRef.current) {
      const t = totalsRef.current;
      commit(collect(state), { ...t, paid: t.paid + state.pendingWin });
    }
  }, [push, commit, showBanner, addToLastSpin, addPrize]);

  const doWheel = useCallback(() => {
    if (wheelRef.current || !sessionRef.current.wheelPending) return;
    setWheelView(sessionRef.current);
    const r = spinWheel(sessionRef.current, rngRef.current);
    wheelRef.current = r.outcome;
    const t = totalsRef.current;
    // The triggering spin's own win is paid before the wheel turns.
    commit(r.state, { ...t, paid: t.paid + r.outcome.collected });
    setWheelTarget(r.outcome.sector);
  }, [commit]);

  const onWheelStopped = useCallback(() => {
    const w = wheelRef.current;
    if (!w) return;
    const fast = turboRef.current;
    // The winning sector blinks first; the prize is revealed a moment later.
    window.setTimeout(
      () => {
        const s = sessionRef.current;
        const t = totalsRef.current;
        setWheelView(null);
        if (w.kind === 'multiplier') {
          push([{ spin: t.spins, kind: 'wheel', text: `La rueda cayó en x${w.value}: ${formatMoney(w.win)}.` }]);
          showBanner(`¡x${w.value}!`, w.win);
          addToLastSpin(w.win);
          addPrize({ spin: t.spins, at: Date.now(), bet: s.roundBet, win: w.win, detail: `Rueda x${w.value}`, stars: 3 });
          commit(s, { ...t, lastWin: w.win });
          if (autoRef.current) commit(collect(s), { ...totalsRef.current, paid: totalsRef.current.paid + s.pendingWin });
        } else {
          push([{ spin: t.spins, kind: 'wheel', text: `La rueda cayó en ${w.value} giros gratis.` }]);
          showBanner(`¡${w.value} GIROS GRATIS!`);
        }
        window.setTimeout(
          () => {
            wheelRef.current = null;
            setWheelTarget(null);
            setWheelOpen(false);
            setShown(null);
          },
          fast ? 300 : 1_800,
        );
      },
      fast ? 0 : 600,
    );
  }, [push, showBanner, addToLastSpin, addPrize, commit]);

  // The wheel counts down and turns by itself; auto play and turbo turn it right away.
  useEffect(() => {
    if (!wheelOpen || wheelTarget !== null || !active) return;
    if (auto || turbo) {
      const t = window.setTimeout(doWheel, 700);
      return () => window.clearTimeout(t);
    }
    if (countdown <= 0) {
      doWheel();
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1_000);
    return () => window.clearTimeout(t);
  }, [wheelOpen, wheelTarget, countdown, active, auto, turbo, doWheel]);

  // Free spins play by themselves until the round ends.
  useEffect(() => {
    if (!active || spinning || wheelOpen || session.freeSpinsLeft === 0) return;
    const t = window.setTimeout(doSpin, turbo ? 120 : 750);
    return () => window.clearTimeout(t);
  }, [active, spinning, wheelOpen, session.freeSpinsLeft, doSpin, turbo]);

  useEffect(() => {
    if (!auto || spinning || wheelOpen || session.freeSpinsLeft > 0 || session.wheelPending) return;
    const t = window.setTimeout(doSpin, turbo ? 20 : 350);
    return () => window.clearTimeout(t);
  }, [auto, spinning, wheelOpen, session.freeSpinsLeft, session.wheelPending, doSpin, turbo]);

  useEffect(() => {
    if (!active) setAuto(false);
  }, [active]);

  const spaceAction = useCallback(() => {
    if (wheelOpen) {
      if (wheelTarget === null) doWheel();
      return;
    }
    doSpin();
  }, [wheelOpen, wheelTarget, doWheel, doSpin]);
  useSpaceToSpin(active && !gambling, spaceAction);

  const changeBet = useCallback(
    (next: number) => {
      const s = sessionRef.current;
      if (pendingRef.current || s.wheelPending || s.freeSpinsLeft > 0 || next === s.bet) return;
      commit(setBet(s, next), totalsRef.current);
      push([{ spin: totalsRef.current.spins, kind: 'bet', text: `Apuesta de ${formatMoney(s.bet)} a ${formatMoney(next)}.` }]);
    },
    [commit, push],
  );

  const doGamble = (guess: CardColor) => {
    const s = sessionRef.current;
    if (!canGamble(s) || pendingRef.current) return;
    const stake = s.pendingWin;
    const r = gamble(s, guess, rngRef.current);
    setCards((c) => [r.card, ...c].slice(0, 5));
    const t = totalsRef.current;
    commit(r.state, r.collected > 0 ? { ...t, paid: t.paid + r.collected } : r.won ? t : { ...t, lastWin: 0 });
    if (r.state.pendingWin === 0) setGambling(false);
    if (!r.won) setShown(null);
    const color = r.card === 'red' ? 'roja' : 'negra';
    push([
      {
        spin: t.spins,
        kind: 'gamble',
        text: r.won
          ? `Carta ${color}: ${formatMoney(stake)} se volvió ${formatMoney(stake * 2)}${r.collected > 0 ? ' (ya no se puede doblar más: cobrado)' : ''}.`
          : `Carta ${color}: perdió ${formatMoney(stake)}.`,
      },
    ]);
  };

  const exportCsv = () => {
    const detail = new Map<number, string[]>();
    for (const p of prizesRef.current) detail.set(p.spin, [...(detail.get(p.spin) ?? []), p.detail]);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `fuego27-historial-${stamp}.csv`,
      ['Giro', 'Fecha', 'Apuesta', 'Premio', 'Veces la apuesta', 'Saldo', 'Detalle'],
      historyRef.current.map((r) => [
        r.spin,
        new Date(r.at).toLocaleString('es-PA'),
        (r.bet / 100).toFixed(2),
        (r.win / 100).toFixed(2),
        (r.win / r.bet).toFixed(2),
        (r.balance / 100).toFixed(2),
        (detail.get(r.spin) ?? []).join(' · '),
      ]),
    );
  };

  const clearHistory = () => {
    historyRef.current = [];
    prizesRef.current = [];
    setHistory([]);
    setPrizes([]);
    setLog([]);
    commit(sessionRef.current, EMPTY_TOTALS);
  };

  // ---------- what the cabinet shows ----------
  const view = wheelView ?? session;
  const freeMode = view.freeSpinsLeft > 0 || (shown?.isFreeSpin === true && !shown.roundOver) || (spinning && pendingRef.current?.outcome.isFreeSpin === true);
  const pendingCharge = spinning && pendingRef.current ? pendingRef.current.outcome.charged : 0;
  const displayBalance = view.balance - pendingCharge;
  const hotCells = shown && !spinning ? [...new Set([...shown.evaluation.wins.flatMap((w) => w.cells), ...(shown.trigger ? shown.evaluation.wheelCells : [])])] : [];
  const playing = spinning ? view.freeSpinsTotal - view.freeSpinsLeft + 1 : view.freeSpinsTotal - view.freeSpinsLeft;
  const freeCounter = freeMode ? `${Math.max(1, playing)}/${view.freeSpinsTotal}` : null;
  const gambleReady = canGamble(session) && !spinning && !auto && !wheelOpen;
  const waiting = view.pendingWin > 0 && !spinning && !wheelOpen && !gambling && !auto && view.freeSpinsLeft === 0;

  useEffect(() => {
    if (!waiting) {
      setHintOn(false);
      return;
    }
    const t = window.setInterval(() => setHintOn((h) => !h), 1_500);
    return () => window.clearInterval(t);
  }, [waiting]);
  const nextStep = gambleReady ? 'GIRA PARA COBRAR · x2 PARA DOBLAR' : 'GIRA PARA COBRAR';

  let message = 'HAZ TU APUESTA';
  if (freeMode) {
    message = `GIRO GRATIS ${Math.max(1, playing)} DE ${view.freeSpinsTotal}${shown && !spinning && shown.win > 0 ? ` · ${formatMoney(shown.win)}` : ''}`;
  } else if (wheelOpen || view.wheelPending) message = '¡RUEDA MISTERIOSA!';
  else if (spinning) message = 'BUENA SUERTE';
  else if (shown?.roundOver) message = view.pendingWin > 0 ? nextStep : `TOTAL DE LA RONDA ${formatMoney(view.roundWin)}`;
  else if (waiting && hintOn) message = nextStep;
  else if (shown && shown.win > 0) {
    const top = shown.evaluation.wins.slice(0, 2).map(shortWin).join(' + ');
    message = `${top}${shown.evaluation.wins.length > 2 ? ' + …' : ''} = ${formatMoney(shown.win)}`;
  } else if (view.pendingWin > 0) message = `POR COBRAR ${formatMoney(view.pendingWin)}`;

  const winLabel = freeMode ? 'TOTAL RONDA' : view.pendingWin > 0 ? 'POR COBRAR' : 'GANANCIA';
  const winValue = freeMode ? view.roundWin : view.pendingWin > 0 ? view.pendingWin : totals.lastWin;

  const betLocked = spinning || auto || wheelOpen || session.wheelPending || session.freeSpinsLeft > 0;

  const gambleScreen = gambling && session.pendingWin > 0 && (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-[#fff3d6]" style={{ background: 'radial-gradient(ellipse 45% 60% at 50% 40%, #b8561a 0%, #5a1c08 45%, #1a0703 100%)' }}>
      <div className="flex w-full max-w-md justify-between text-center">
        <div>
          <p className="text-xs font-bold tracking-widest text-[#ffd99a]">EN JUEGO</p>
          <p className="casino-num gold-text text-3xl">{formatMoney(session.pendingWin)}</p>
        </div>
        <div>
          <p className="text-xs font-bold tracking-widest text-[#ffd99a]">PARA GANAR</p>
          <p className="casino-num gold-text text-3xl">{formatMoney(session.pendingWin * 2)}</p>
        </div>
      </div>
      <div className="flex items-center gap-5">
        <button type="button" onClick={() => doGamble('red')} disabled={!canGamble(session)} className="h-14 w-28 rounded-full border-4 border-[#f5c542] bg-gradient-to-b from-red-500 to-red-800 text-lg font-black text-white shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-white disabled:opacity-40">
          ♥ ROJA
        </button>
        <div className="relative flex h-[180px] w-[120px] items-center justify-center rounded-lg border-4 border-white bg-[repeating-linear-gradient(45deg,#b91c1c_0_7px,#7f1d1d_7px_14px)] shadow-[0_0_0_3px_#f5c542,0_14px_34px_rgba(255,170,60,0.55)]" aria-hidden>
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-[#7f1d1d] text-2xl text-white">?</span>
        </div>
        <button type="button" onClick={() => doGamble('black')} disabled={!canGamble(session)} className="h-14 w-28 rounded-full border-4 border-[#f5c542] bg-gradient-to-b from-neutral-600 to-black text-lg font-black text-white shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-white disabled:opacity-40">
          ♠ NEGRA
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#ffd99a]">Cartas anteriores</span>
        {cards.map((c, i) => (
          <span key={i} className={`flex h-9 w-7 items-center justify-center rounded border border-neutral-300 bg-white text-base ${c === 'red' ? 'text-red-600' : 'text-black'}`}>
            {c === 'red' ? '♥' : '♠'}
          </span>
        ))}
      </div>
      <button type="button" onClick={doCollect} className="rounded-full border-2 border-[#f5c542] bg-[#f5c542] px-8 py-2 font-black text-[#3a0a00] outline-none focus-visible:ring-4 focus-visible:ring-white">
        COBRAR
      </button>
      <p className="text-center text-xs text-[#ffd99a]">
        Intentos: {session.gamblesUsed}/{MAX_GAMBLES} · solo premios de hasta {GAMBLE_LIMIT_X} veces la apuesta. Es 50/50: no cambia lo que devuelve la máquina.
      </p>
    </div>
  );

  const sessionRtp = totals.wagered > 0 ? totals.paid / totals.wagered : 0;

  return (
    <div className="space-y-5">
      <FuegoCabinet
        grid={grid}
        spin={spin}
        hotCells={hotCells}
        balance={displayBalance}
        bet={session.bet}
        winValue={winValue}
        winLabel={winLabel}
        message={message}
        freeMode={freeMode}
        spinning={spinning}
        auto={auto}
        turbo={turbo}
        levels={BET_LEVELS}
        freeCounter={freeCounter}
        betLocked={betLocked}
        canBetDown={!betLocked && session.bet > BET_LEVELS[0]}
        canBetUp={!betLocked && session.bet < BET_LEVELS[BET_LEVELS.length - 1]}
        onBetPick={changeBet}
        onBet={(dir) => changeBet(stepBet(sessionRef.current.bet, dir))}
        canGamble={gambleReady}
        onGamble={() => setGambling(true)}
        onTurbo={() => setTurbo((t) => !t)}
        onAuto={() => setAuto((a) => !a)}
        onSpin={doSpin}
        spinDisabled={spinning || wheelOpen || session.wheelPending || session.freeSpinsLeft > 0}
        onStopped={onStopped}
        overlay={gambleScreen || null}
        wheel={wheelOpen ? <FuegoWheel target={wheelTarget} turbo={turbo} onSpin={doWheel} onStopped={onWheelStopped} /> : null}
        countdown={wheelOpen && wheelTarget === null && !auto && !turbo ? countdown : null}
        countdownTotal={WHEEL_WAIT}
        banner={banner}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <StreakPanel history={history} startBalance={startBalance} bet={session.bet} onBet={changeBet} locked={betLocked} />
          <PrizeHistory prizes={prizes} totalSpins={totals.spins} onExport={exportCsv} onClear={clearHistory} featureLabel="De la rueda" />
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <MiniStat label="Giros pagados" value={String(totals.spins)} />
            <MiniStat label="RTP de la sesión" value={formatPct(sessionRtp)} />
            <MiniStat label="Ruedas / rondas gratis" value={`${totals.wheels} / ${totals.freeRounds}`} />
            <MiniStat label="Faltó una rueda" value={String(totals.nearSpins)} />
          </div>
          <p className="text-xs text-neutral-500">
            Barra espaciadora = girar (y girar la rueda) · los giros gratis juegan solos · el modo auto cobra sin jugar el doble o nada.
          </p>
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
