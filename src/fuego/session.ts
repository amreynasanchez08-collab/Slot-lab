import type { Rng } from '../engine/rng.ts';
import { evaluate, REELS, ROWS, type Evaluation } from './evaluate.ts';
import { fillGrid, spinStops, type Machine } from './machine.ts';
import { pickSector, WHEEL_SECTORS, type SectorKind } from './wheel.ts';

/** Pays are whole multiples of the bet, so any whole number of 10-cent steps keeps money exact. */
export const BET_STEP = 10;
/** Gamble rounds allowed per win, as the original's "gamble attempts left 3". */
export const MAX_GAMBLES = 3;
/** Only wins up to this many times their bet can be gambled (35x in the original's info screen). */
export const GAMBLE_LIMIT_X = 35;

export const BET_LEVELS: readonly number[] = [10, 20, 30, 50, 100, 200, 300, 500, 1_000, 2_000, 5_000];

export interface SessionState {
  balance: number;
  bet: number;
  /** Win waiting to be collected or gambled (cents); 0 when none. */
  pendingWin: number;
  /** Bet the pending win was won at; sets the gamble limit. */
  winBet: number;
  gamblesUsed: number;
  /** Three wheels landed and the wheel has not been spun yet. */
  wheelPending: boolean;
  freeSpinsLeft: number;
  /** Free spins awarded in the current or last round. */
  freeSpinsTotal: number;
  /** Bet that triggered the wheel; free spins play at it. */
  roundBet: number;
  /** Won so far in the current or last free-spin round (cents). */
  roundWin: number;
}

export interface SpinOutcome {
  stops: number[];
  grid: number[];
  evaluation: Evaluation;
  isFreeSpin: boolean;
  charged: number;
  /** Cents won by this spin's ways. */
  win: number;
  /** Three wheels: the mystery wheel is waiting. */
  trigger: boolean;
  /** This was the last free spin; the round total is now the pending win. */
  roundOver: boolean;
}

export interface WheelOutcome {
  sector: number;
  kind: SectorKind;
  value: number;
  /** Cents won by a multiplier sector (0 for free spins). */
  win: number;
  /** Pending win from the triggering spin, paid into the balance before the wheel turns. */
  collected: number;
}

export function assertBet(bet: number): void {
  if (!Number.isInteger(bet) || bet <= 0 || bet % BET_STEP !== 0) {
    throw new RangeError('La apuesta debe ser un múltiplo de $0.10 mayor que cero');
  }
}

export function newSession(balance: number, bet: number): SessionState {
  assertBet(bet);
  return { balance, bet, pendingWin: 0, winBet: bet, gamblesUsed: 0, wheelPending: false, freeSpinsLeft: 0, freeSpinsTotal: 0, roundBet: bet, roundWin: 0 };
}

export function canSpin(state: SessionState): boolean {
  if (state.wheelPending || state.pendingWin > 0) return false;
  return state.freeSpinsLeft > 0 || state.balance >= state.bet;
}

/** Plays a free spin while any are left, otherwise a paid spin. A win waits as pendingWin. */
export function playSpin(machine: Machine, state: SessionState, rng: Rng): { state: SessionState; outcome: SpinOutcome } {
  if (!canSpin(state)) throw new Error('Saldo insuficiente, premio pendiente o rueda por girar');
  const isFreeSpin = state.freeSpinsLeft > 0;
  const set = isFreeSpin ? machine.free : machine.base;
  const stops = [0, 0, 0];
  spinStops(set, rng, stops);
  const grid = new Array<number>(REELS * ROWS);
  fillGrid(set.strips, stops, grid);
  const evaluation = evaluate(grid);

  if (isFreeSpin) {
    const win = evaluation.multiplier * state.roundBet;
    const left = state.freeSpinsLeft - 1;
    const roundWin = state.roundWin + win;
    const roundOver = left === 0;
    return {
      state: { ...state, freeSpinsLeft: left, roundWin, pendingWin: roundOver ? roundWin : 0, winBet: state.roundBet, gamblesUsed: 0 },
      outcome: { stops, grid, evaluation, isFreeSpin, charged: 0, win, trigger: false, roundOver },
    };
  }

  assertBet(state.bet);
  const win = evaluation.multiplier * state.bet;
  // Free spins have no wheels, so a trigger only happens on a paid spin.
  const trigger = evaluation.trigger;
  return {
    state: {
      ...state,
      balance: state.balance - state.bet,
      pendingWin: win,
      winBet: state.bet,
      gamblesUsed: 0,
      wheelPending: trigger,
      roundBet: trigger ? state.bet : state.roundBet,
      roundWin: 0,
      freeSpinsTotal: 0,
    },
    outcome: { stops, grid, evaluation, isFreeSpin, charged: state.bet, win, trigger, roundOver: false },
  };
}

/** Turns the mystery wheel: a multiplier waits as the pending win, free spins start a round. */
export function spinWheel(state: SessionState, rng: Rng, sector = pickSector(rng)): { state: SessionState; outcome: WheelOutcome } {
  if (!state.wheelPending) throw new Error('No hay rueda por girar');
  const s = WHEEL_SECTORS[sector];
  const collected = state.pendingWin;
  const base = { ...state, balance: state.balance + collected, pendingWin: 0, gamblesUsed: 0, wheelPending: false };
  if (s.kind === 'multiplier') {
    const win = s.value * state.roundBet;
    return { state: { ...base, pendingWin: win, winBet: state.roundBet }, outcome: { sector, kind: s.kind, value: s.value, win, collected } };
  }
  return {
    state: { ...base, freeSpinsLeft: s.value, freeSpinsTotal: s.value, roundWin: 0 },
    outcome: { sector, kind: s.kind, value: s.value, win: 0, collected },
  };
}

export function collect(state: SessionState): SessionState {
  return { ...state, balance: state.balance + state.pendingWin, pendingWin: 0, gamblesUsed: 0 };
}

export function canGamble(state: SessionState): boolean {
  return (
    state.pendingWin > 0 &&
    !state.wheelPending &&
    state.freeSpinsLeft === 0 &&
    state.gamblesUsed < MAX_GAMBLES &&
    state.pendingWin <= GAMBLE_LIMIT_X * state.winBet
  );
}

export type CardColor = 'red' | 'black';

/**
 * Red or black, 50/50: a right guess doubles the pending win, a wrong one loses it. Fair, so the
 * RTP does not change. When no further gamble is allowed (attempts used or over the limit), the
 * doubled win is collected.
 */
export function gamble(state: SessionState, guess: CardColor, rng: Rng): { state: SessionState; card: CardColor; won: boolean; collected: number } {
  if (!canGamble(state)) throw new Error('Este premio no se puede jugar');
  const card: CardColor = rng.int(2) === 0 ? 'red' : 'black';
  const won = card === guess;
  if (!won) return { state: { ...state, pendingWin: 0, gamblesUsed: 0 }, card, won, collected: 0 };
  const next = { ...state, pendingWin: state.pendingWin * 2, gamblesUsed: state.gamblesUsed + 1 };
  if (canGamble(next)) return { state: next, card, won, collected: 0 };
  return { state: collect(next), card, won, collected: next.pendingWin };
}

/** Changes the bet between spins; not during a wheel or free-spin round. */
export function setBet(state: SessionState, bet: number): SessionState {
  assertBet(bet);
  if (state.wheelPending || state.freeSpinsLeft > 0) throw new Error('No se cambia la apuesta durante la rueda o los giros gratis');
  return { ...state, bet };
}

/** Next level up (+1) or down (-1) from the current bet, clamped to the ladder. */
export function stepBet(bet: number, direction: 1 | -1): number {
  const top = BET_LEVELS[BET_LEVELS.length - 1];
  // A bet typed in the settings can sit above the ladder: up keeps it, down returns to the top level.
  if (bet > top) return direction === 1 ? bet : top;
  const i = BET_LEVELS.findIndex((level) => level >= bet);
  const at = i === -1 ? BET_LEVELS.length - 1 : BET_LEVELS[i] === bet ? i : direction === 1 ? i - 1 : i;
  return BET_LEVELS[Math.min(BET_LEVELS.length - 1, Math.max(0, at + direction))];
}
