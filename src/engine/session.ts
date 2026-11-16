import { evaluateBase, evaluateFree, LINE_COUNT, REELS, ROWS, type Evaluation } from './evaluate.ts';
import { drawMystery, fillGrid, spinStops, type Machine } from './machine.ts';
import type { Rng } from './rng.ts';
import { PAYS } from './symbols.ts';

/** Money is kept in integer cents. The bet must be a multiple of 5 cents (one line bet per line). */
export interface SessionState {
  balance: number;
  bet: number;
  freeGamesLeft: number;
  /** Bet that triggered the running round; free games pay on it even if the bet changes. */
  roundBet: number;
  roundWin: number;
  lastWin: number;
}

export interface SpinOutcome {
  stops: number[];
  grid: number[];
  evaluation: Evaluation;
  /** Symbol revealed by the mystery BONUS this spin, or null if no BONUS win. */
  mysterySymbol: number | null;
  isFreeGame: boolean;
  /** Cents charged for this spin (0 on free games). */
  charged: number;
  /** Cents paid by this spin. */
  win: number;
  /** Free games awarded by this spin (trigger or retrigger), 0 if none. */
  awarded: number;
  retrigger: boolean;
  /** Set on the last free game of a round. */
  roundFinished: boolean;
  roundTotal: number;
  /** Loss disguised as a win: paid something, but less than the bet. Paid spins only. */
  ldw: boolean;
}

export function newSession(balance: number, bet: number): SessionState {
  assertBet(bet);
  return { balance, bet, freeGamesLeft: 0, roundBet: 0, roundWin: 0, lastWin: 0 };
}

export function assertBet(bet: number): void {
  if (!Number.isInteger(bet) || bet <= 0 || bet % LINE_COUNT !== 0) {
    throw new RangeError('La apuesta debe ser un múltiplo de $0.05 mayor que cero');
  }
}

export function canSpin(state: SessionState): boolean {
  return state.freeGamesLeft > 0 || state.balance >= state.bet;
}

/** Line-bet units of an evaluation once the mystery prize is drawn. */
export function settleUnits(evaluation: Evaluation, rng: Rng): { units: number; mysterySymbol: number | null } {
  if (evaluation.mysteryMultiplier === 0) return { units: evaluation.regularUnits, mysterySymbol: null };
  const mysterySymbol = drawMystery(rng);
  return { units: evaluation.regularUnits + evaluation.mysteryMultiplier * PAYS[mysterySymbol], mysterySymbol };
}

/** Plays one spin. Free games are consumed first, are not charged and use their own reels. */
export function playSpin(machine: Machine, state: SessionState, rng: Rng): { state: SessionState; outcome: SpinOutcome } {
  if (!canSpin(state)) throw new Error('Saldo insuficiente para la apuesta');
  assertBet(state.bet);

  const isFreeGame = state.freeGamesLeft > 0;
  const reels = isFreeGame ? machine.free : machine.base;
  const stakeBet = isFreeGame ? state.roundBet : state.bet;
  const stops = [0, 0, 0];
  spinStops(reels, rng, stops);
  const grid = new Array<number>(REELS * ROWS);
  fillGrid(reels.strips, stops, grid);
  const evaluation = isFreeGame ? evaluateFree(grid) : evaluateBase(grid, machine.rules);
  const { units, mysterySymbol } = settleUnits(evaluation, rng);

  const next: SessionState = { ...state };
  const charged = isFreeGame ? 0 : state.bet;
  const win = (units * stakeBet) / LINE_COUNT;
  next.balance += win - charged;
  next.lastWin = win;

  if (isFreeGame) {
    next.freeGamesLeft -= 1;
    next.roundWin += win;
  }
  const awarded = evaluation.trigger ? machine.freeGames.award : 0;
  if (awarded > 0) {
    if (!isFreeGame) {
      next.roundBet = state.bet;
      next.roundWin = 0;
    }
    next.freeGamesLeft += awarded;
  }

  const roundFinished = isFreeGame && next.freeGamesLeft === 0;
  if (roundFinished) next.roundBet = 0;

  return {
    state: next,
    outcome: {
      stops,
      grid,
      evaluation,
      mysterySymbol,
      isFreeGame,
      charged,
      win,
      awarded,
      retrigger: isFreeGame && awarded > 0,
      roundFinished,
      roundTotal: next.roundWin,
      ldw: !isFreeGame && win > 0 && win < state.bet,
    },
  };
}

/** Bet ladder in cents; every level is a multiple of 5 cents (5 lines). */
export const BET_LEVELS: readonly number[] = [5, 10, 15, 20, 25, 50, 75, 100, 150, 200, 250, 500, 1_000, 2_000];

/** Changes the bet between spins. A running round keeps paying on the bet that triggered it. */
export function setBet(state: SessionState, bet: number): SessionState {
  assertBet(bet);
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
