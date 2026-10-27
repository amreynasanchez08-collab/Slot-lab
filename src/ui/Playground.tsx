import { useCallback, useEffect, useRef, useState } from 'react';
import { PAYLINES, type NearMissKind, type Win } from '../engine/evaluate.ts';
import { fillGrid, type Machine } from '../engine/machine.ts';
import { createRng, randomSeed } from '../engine/rng.ts';
import { canSpin, newSession, playSpin, type SessionState, type SpinOutcome } from '../engine/session.ts';
import { isDancer, PAYS, SYMBOL_NAMES } from '../engine/symbols.ts';
import { MiniStat, Stat } from './Cards.tsx';
import { useSpaceToSpin } from './useSpaceToSpin.ts';
import { formatMoney, formatPct } from './format.ts';
import { Reels, type ReelSpin } from './Reels.tsx';
import { SymbolIcon } from './SymbolIcon.tsx';

export const LINE_NAMES = ['Línea 1 (centro)', 'Línea 2 (arriba)', 'Línea 3 (abajo)', 'Línea 4 (diagonal ↘)', 'Línea 5 (diagonal ↗)'];

type LogKind = 'win' | 'ldw' | 'mystery' | 'near' | 'bonus' | 'retrigger' | 'round' | 'loss' | 'info';

interface LogEntry {
  id: number;
  spin: number;
  kind: LogKind;
  text: string;
}

const LOG_STYLE: Record<LogKind, string> = {
  win: 'border-emerald-500 text-emerald-200',
  ldw: 'border-orange-500 text-orange-200',
  mystery: 'border-yellow-300 text-yellow-100',
  near: 'border-sky-500 text-sky-200',
  bonus: 'border-pink-400 text-pink-200',
  retrigger: 'border-fuchsia-500 text-fuchsia-200',
  round: 'border-amber-400 text-amber-100',
  loss: 'border-neutral-700 text-neutral-400',
  info: 'border-neutral-500 text-neutral-300',
};

const LOG_LABEL: Record<LogKind, string> = {
  win: 'Premio',
  ldw: 'LDW',
  mystery: 'Misterioso',
  near: 'Near miss',
  bonus: 'Juegos gratis',
  retrigger: 'Retrigger',
  round: 'Fin de ronda',
  loss: 'Sin premio',
  info: 'Aviso',
};

const NEAR_MISS_TEXT: Record<NearMissKind, string> = {
  dancers: '2 bailarinas completas, faltó la tercera para los juegos gratis',
  bonus: '2 Bonus, faltó el tercero',
  seven: '2 Sietes, faltó el tercero para el premio mayor',
  melon: '2 Melones, faltó el tercero',
};

const MAX_LOG = 250;
const LINE_COLORS = ['#f43f5e', '#38bdf8', '#a3e635', '#f59e0b', '#c084fc'];
// The dancer fills its cell edge to edge so a full stack reads as one figure.
const renderSymbol = (sym: number, cell: number) => <SymbolIcon id={sym} size={isDancer(sym) ? cell - 6 : 72} />;
/** Neutral starting stops on the base reels (no wins on screen). */
const START_STOPS = [4, 4, 4];

type Totals = { spins: number; wagered: number; paid: number; ldw: number; nearSpins: number; rounds: number; retriggers: number; lastRound: number };
const EMPTY_TOTALS: Totals = { spins: 0, wagered: 0, paid: 0, ldw: 0, nearSpins: 0, rounds: 0, retriggers: 0, lastRound: 0 };

function describeWin(w: Win): string {
  const where = w.line === null ? 'en pantalla' : `en ${LINE_NAMES[w.line].split(' (')[0]}`;
  const mult = w.multiplier > 1 ? ` x${w.multiplier}` : '';
  return `${SYMBOL_NAMES[w.symbol]} ${where}${mult}`;
}

interface Props {
  machine: Machine;
  startBalance: number;
  bet: number;
  /** False while another tab is showing: the space bar must not spin a hidden machine. */
  active: boolean;
}

export function Playground({ machine, startBalance, bet, active }: Props) {
  const rngRef = useRef(createRng(randomSeed()));
  // Refs hold the authoritative state so a key press between renders never plays from a stale session.
  const sessionRef = useRef<SessionState>(newSession(startBalance, bet));
  const gridRef = useRef<number[]>([]);
  if (gridRef.current.length === 0) {
    const g = new Array<number>(9);
    fillGrid(machine.base.strips, START_STOPS, g);
    gridRef.current = g;
  }
  const totalsRef = useRef<Totals>(EMPTY_TOTALS);
  const pendingRef = useRef<{ state: SessionState; outcome: SpinOutcome } | null>(null);
  const spinIdRef = useRef(0);
  const logId = useRef(0);

  const [session, setSession] = useState<SessionState>(sessionRef.current);
  const [grid, setGrid] = useState<number[]>(gridRef.current);
  const [spin, setSpin] = useState<ReelSpin | null>(null);
  const [pending, setPending] = useState<{ state: SessionState; outcome: SpinOutcome } | null>(null);
  const [shown, setShown] = useState<SpinOutcome | null>(null);
  const [turbo, setTurbo] = useState(false);
  const [auto, setAuto] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS);

  const spinning = pending !== null;

  const push = useCallback((entries: Omit<LogEntry, 'id'>[]) => {
    setLog((prev) => [...entries.map((e) => ({ ...e, id: ++logId.current })).reverse(), ...prev].slice(0, MAX_LOG));
  }, []);

  const doSpin = useCallback(() => {
    if (pendingRef.current) return;
    const current = sessionRef.current;
    if (!canSpin(current)) {
      setAuto(false);
      push([{ spin: totalsRef.current.spins, kind: 'info', text: 'Saldo insuficiente para la apuesta.' }]);
      return;
    }
    const step = playSpin(machine, current, rngRef.current);
    pendingRef.current = step;
    setPending(step);
    setShown(null);
    setSpin({
      id: ++spinIdRef.current,
      stops: step.outcome.stops,
      strips: step.outcome.isFreeGame ? machine.free.strips : machine.base.strips,
      previous: gridRef.current,
    });
    gridRef.current = step.outcome.grid;
    setGrid(step.outcome.grid);
  }, [machine, push]);

  const onStopped = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    const { state, outcome } = p;
    sessionRef.current = state;
    pendingRef.current = null;

    const prev = totalsRef.current;
    const n = prev.spins + (outcome.isFreeGame ? 0 : 1);
    const ev = outcome.evaluation;
    const entries: Omit<LogEntry, 'id'>[] = [];
    const tag = outcome.isFreeGame ? 'Juego gratis: ' : '';

    if (outcome.awarded > 0) {
      entries.push(
        outcome.retrigger
          ? { spin: n, kind: 'retrigger', text: `3 bailarinas completas otra vez: +${outcome.awarded} juegos gratis (quedan ${state.freeGamesLeft}).` }
          : { spin: n, kind: 'bonus', text: `3 bailarinas completas: ${outcome.awarded} juegos gratis. En los juegos gratis paga cualquier trío en pantalla.` },
      );
    }
    if (outcome.mysterySymbol !== null) {
      entries.push({
        spin: n,
        kind: 'mystery',
        text: `El Bonus misterioso pagó como ${SYMBOL_NAMES[outcome.mysterySymbol]} (${PAYS[outcome.mysterySymbol]}x por línea).`,
      });
    }
    if (outcome.ldw) {
      entries.push({
        spin: n,
        kind: 'ldw',
        text: `Apostó ${formatMoney(outcome.charged)} y cobró ${formatMoney(outcome.win)}: celebra un premio pero pierde ${formatMoney(outcome.charged - outcome.win)}.`,
      });
    } else if (outcome.win > 0) {
      entries.push({ spin: n, kind: 'win', text: `${tag}ganó ${formatMoney(outcome.win)} (${ev.wins.map(describeWin).join(', ')}).` });
    } else if (outcome.awarded === 0) {
      entries.push({ spin: n, kind: 'loss', text: `${tag}nada pagó.` });
    }
    for (const nm of ev.nearMisses) {
      const where = nm.line === null ? 'Pantalla' : LINE_NAMES[nm.line];
      entries.push({ spin: n, kind: 'near', text: `${where}: ${NEAR_MISS_TEXT[nm.kind]}.` });
    }
    if (outcome.roundFinished) {
      entries.push({ spin: n, kind: 'round', text: `Terminaron los juegos gratis: ganó ${formatMoney(outcome.roundTotal)} en total.` });
    }
    push(entries);

    const next: Totals = {
      spins: n,
      wagered: prev.wagered + outcome.charged,
      paid: prev.paid + outcome.win,
      ldw: prev.ldw + (outcome.ldw ? 1 : 0),
      nearSpins: prev.nearSpins + (ev.nearMisses.length > 0 ? 1 : 0),
      rounds: prev.rounds + (outcome.awarded > 0 && !outcome.retrigger ? 1 : 0),
      retriggers: prev.retriggers + (outcome.retrigger ? 1 : 0),
      lastRound: outcome.roundFinished ? outcome.roundTotal : prev.lastRound,
    };
    totalsRef.current = next;
    setTotals(next);
    setSession(state);
    setShown(outcome);
    setPending(null);
  }, [push]);

  // Auto play: next spin once the previous one has settled.
  useEffect(() => {
    if (!auto || spinning) return;
    const timer = window.setTimeout(doSpin, turbo ? 20 : 350);
    return () => window.clearTimeout(timer);
  }, [auto, spinning, doSpin, turbo]);

  // Auto play stops when this machine is hidden; it never plays unseen.
  useEffect(() => {
    if (!active) setAuto(false);
  }, [active]);

  useSpaceToSpin(active, doSpin);

  const inRound = session.freeGamesLeft > 0 || (pending?.outcome.isFreeGame ?? false);
  const displayBalance = pending ? session.balance - pending.outcome.charged : session.balance;
  const sessionRtp = totals.wagered > 0 ? totals.paid / totals.wagered : 0;
  const winLines = shown && !shown.isFreeGame ? shown.evaluation.wins.map((w) => w.line ?? -1).filter((l) => l >= 0) : [];
  const winCells = shown && shown.isFreeGame ? [...new Set(shown.evaluation.wins.flatMap((w) => w.cells))] : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <div className={`rounded-2xl p-5 transition-colors ${inRound ? 'bg-fuchsia-950/60 ring-2 ring-pink-400/60' : 'bg-neutral-900'}`}>
          {inRound && (
            <p className="mb-3 text-center text-sm font-semibold uppercase tracking-widest text-pink-300">
              Juegos gratis · paga cualquier trío en pantalla · bailarina x3 / x2 / x1
            </p>
          )}
          <Reels
            grid={grid}
            spin={spin}
            paylines={PAYLINES}
            lineColors={LINE_COLORS}
            renderSymbol={renderSymbol}
            lines={winLines}
            cells={winCells}
            instant={turbo}
            onStopped={onStopped}
          />
          {!inRound && (
            <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-neutral-400">
              {LINE_NAMES.map((name, i) => (
                <span key={name} className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-4 rounded" style={{ background: LINE_COLORS[i] }} />
                  {name}
                </span>
              ))}
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={doSpin}
              disabled={spinning || auto}
              className="rounded-full bg-gradient-to-b from-rose-500 to-rose-700 px-10 py-3 text-lg font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-40"
            >
              {session.freeGamesLeft > 0 ? `Juego gratis (${session.freeGamesLeft})` : 'Girar'}
            </button>
            <button
              type="button"
              onClick={() => setAuto((a) => !a)}
              disabled={!auto && !canSpin(session)}
              className={`rounded-full px-5 py-3 text-sm font-semibold ${auto ? 'bg-amber-400 text-neutral-950' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
            >
              {auto ? 'Detener auto' : 'Auto'}
            </button>
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input type="checkbox" checked={turbo} onChange={(e) => setTurbo(e.target.checked)} className="h-4 w-4 accent-amber-400" />
              Turbo (sin animación)
            </label>
          </div>
          <p className="mt-2 text-center text-xs text-neutral-500">Barra espaciadora = girar</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Saldo actual" value={formatMoney(displayBalance)} strong />
          <Stat label="Apuesta" value={`${formatMoney(session.bet)} · ${formatMoney(session.bet / 5)} por línea`} />
          <Stat label="Última ganancia" value={formatMoney(shown?.win ?? 0)} />
          <Stat label="Juegos gratis restantes" value={String(session.freeGamesLeft)} />
          <Stat
            label={inRound ? 'Total ganado en la ronda' : 'Total de la última ronda'}
            value={formatMoney(inRound ? session.roundWin : totals.lastRound)}
          />
          <Stat label="Último misterioso" value={shown?.mysterySymbol != null ? SYMBOL_NAMES[shown.mysterySymbol] : '—'} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <MiniStat label="Giros pagados" value={String(totals.spins)} />
          <MiniStat label="RTP de la sesión" value={formatPct(sessionRtp)} />
          <MiniStat label="LDW / giros con near miss" value={`${totals.ldw} / ${totals.nearSpins}`} />
          <MiniStat label="Rondas / Retriggers" value={`${totals.rounds} / ${totals.retriggers}`} />
        </div>
      </div>

      <aside className="flex max-h-[720px] flex-col rounded-2xl bg-neutral-900 p-4">
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
  );
}

