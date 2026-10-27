import type { Rng } from '../engine/rng.ts';
import { evaluate, LINE_COUNT, REELS, ROWS, type Evaluation } from './evaluate.ts';
import { fillGrid, spinStops, type Machine } from './machine.ts';

/** Total bets step in 20 cents: one cent per line minimum, and line pays are multiples of 10. */
export const BET_STEP = 20;
/** Consecutive doubles allowed in the gamble before the win is collected automatically. */
export const MAX_GAMBLES = 5;

export interface SessionState {
  balance: number;
  bet: number;
  /** Win waiting to be collected or gambled (cents); 0 when none. */
  pendingWin: number;
  gamblesUsed: number;
}

export interface SpinOutcome {
  stops: number[];
  grid: number[];
  evaluation: Evaluation;
  charged: number;
  /** Cents won by lines plus stars. */
  win: number;
  /** Loss disguised as a win: paid something, but less than the bet. */
  ldw: boolean;
}

export function assertBet(bet: number): void {
  if (!Number.isInteger(bet) || bet <= 0 || bet % BET_STEP !== 0) {
    throw new RangeError('La apuesta debe ser un múltiplo de $0.20 mayor que cero');
  }
}

export function newSession(balance: number, bet: number): SessionState {
  assertBet(bet);
  return { balance, bet, pendingWin: 0, gamblesUsed: 0 };
}

export function canSpin(state: SessionState): boolean {
  return state.pendingWin === 0 && state.balance >= state.bet;
}

/** Win in cents for an evaluation: line units at bet / 20 each, plus stars times the bet. */
export function winCents(evaluation: Evaluation, bet: number): number {
  return (evaluation.lineUnits * bet) / LINE_COUNT + evaluation.scatterMultiplier * bet;
}

/** Plays one spin. A win is held as pendingWin until it is collected or gambled. */
export function playSpin(machine: Machine, state: SessionState, rng: Rng): { state: SessionState; outcome: SpinOutcome } {
  if (!canSpin(state)) throw new Error('Saldo insuficiente o premio pendiente');
  assertBet(state.bet);
  const stops = [0, 0, 0, 0, 0];
  spinStops(machine, rng, stops);
  const grid = new Array<number>(REELS * ROWS);
  fillGrid(machine.strips, stops, grid);
  const evaluation = evaluate(grid);
  const win = winCents(evaluation, state.bet);
  return {
    state: { ...state, balance: state.balance - state.bet, pendingWin: win, gamblesUsed: 0 },
    outcome: { stops, grid, evaluation, charged: state.bet, win, ldw: win > 0 && win < state.bet },
  };
}

export function collect(state: SessionState): SessionState {
  return { ...state, balance: state.balance + state.pendingWin, pendingWin: 0, gamblesUsed: 0 };
}

export type CardColor = 'red' | 'black';

/**
 * Red or black, 50/50: a right guess doubles the pending win, a wrong one loses it. Fair, so
 * it does not change the RTP; it only adds variance. After MAX_GAMBLES the win is collected.
 */
export function gamble(state: SessionState, guess: CardColor, rng: Rng): { state: SessionState; card: CardColor; won: boolean } {
  if (state.pendingWin === 0) throw new Error('No hay premio para jugar');
  const card: CardColor = rng.int(2) === 0 ? 'red' : 'black';
  const won = card === guess;
  if (!won) return { state: { ...state, pendingWin: 0, gamblesUsed: 0 }, card, won };
  const next = { ...state, pendingWin: state.pendingWin * 2, gamblesUsed: state.gamblesUsed + 1 };
  return { state: next.gamblesUsed >= MAX_GAMBLES ? collect(next) : next, card, won };
}

/** Bet ladder of the game: 16 steps from $0.20 to $40.00 (cents). */
export const BET_LEVELS: readonly number[] = [20, 40, 60, 80, 100, 120, 160, 200, 300, 400, 500, 600, 800, 1_000, 2_000, 4_000];

/** Changes the bet between spins; a waiting win is kept and still paid at its own amount. */
export function setBet(state: SessionState, bet: number): SessionState {
  assertBet(bet);
  return { ...state, bet };
}

/** Next level up (+1) or down (-1) from the current bet, clamped to the ladder. */
export function stepBet(bet: number, direction: 1 | -1): number {
  const i = BET_LEVELS.findIndex((level) => level >= bet);
  const at = i === -1 ? BET_LEVELS.length - 1 : BET_LEVELS[i] === bet ? i : direction === 1 ? i - 1 : i;
  return BET_LEVELS[Math.min(BET_LEVELS.length - 1, Math.max(0, at + direction))];
}
