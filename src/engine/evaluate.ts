import {
  BONUS,
  DANCER_HEAD,
  DANCER_LEGS,
  DANCER_TORSO,
  MELON,
  MULTIPLIER,
  PAYING_SYMBOLS,
  PAYS,
  SEVEN,
  isDancer,
} from './symbols.ts';

export const REELS = 3;
export const ROWS = 3;

/** Row index per reel. Rows: 0 top, 1 middle, 2 bottom. Base game only. */
export const PAYLINES: readonly (readonly [number, number, number])[] = [
  [1, 1, 1],
  [0, 0, 0],
  [2, 2, 2],
  [0, 1, 2],
  [2, 1, 0],
];
export const LINE_COUNT = PAYLINES.length;

/** Grid layout: grid[reel * ROWS + row]. */
export type Grid = ArrayLike<number>;

export type NearMissKind = 'dancers' | 'bonus' | 'seven' | 'melon';

export interface NearMiss {
  /** Payline index, or null for a whole-screen near miss (two full dancers). */
  line: number | null;
  kind: NearMissKind;
}

export interface Win {
  /** Payline index in the base game, null for anywhere wins in free games. */
  line: number | null;
  symbol: number;
  /** Product of the dancer multipliers used by this win. */
  multiplier: number;
  /** Line-bet units before the mystery draw; 0 for BONUS wins. */
  pay: number;
  /** Grid cells that form the win (for highlighting). */
  cells: number[];
}

export interface Evaluation {
  wins: Win[];
  /** Line-bet units of every non-mystery win, multipliers applied. */
  regularUnits: number;
  /** Sum of multipliers of BONUS wins; each pays the drawn mystery prize. */
  mysteryMultiplier: number;
  /** The three reels show the complete dancer: free games trigger. */
  trigger: boolean;
  nearMisses: NearMiss[];
}

const scratch = new Int32Array(1);

/** Base-game role of the dancer. Free games always use her as a wild with her multiplier. */
export interface Rules {
  /** Dancers substitute on base-game paylines; otherwise they only count for the trigger. */
  baseWild: boolean;
  /** Dancer multipliers apply on base-game paylines; otherwise a dancer counts x1 there. */
  baseMultiplier: boolean;
}

/**
 * Default: in the base game the dancer only triggers free games. With a trigger near
 * 1 in 150, two complete dancers land together on ~3.5% of spins; as a wild she would make
 * every line pay and push the base RTP past 200%.
 */
export const DEFAULT_RULES: Rules = { baseWild: false, baseMultiplier: false };

/**
 * Winning symbol of a line, or -1. Dancers substitute every symbol (BONUS included), but a
 * line made only of dancers pays nothing. Writes the multiplier product to out[0].
 */
export function evaluateLine(a: number, b: number, c: number, out: Int32Array, wild = true, multiply = true): number {
  if (!wild && (isDancer(a) || isDancer(b) || isDancer(c))) return -1;
  let target = -1;
  if (!isDancer(a)) target = a;
  if (!isDancer(b)) {
    if (target === -1) target = b;
    else if (b !== target) return -1;
  }
  if (!isDancer(c)) {
    if (target === -1) target = c;
    else if (c !== target) return -1;
  }
  if (target === -1) return -1;
  out[0] = multiply ? MULTIPLIER[a] * MULTIPLIER[b] * MULTIPLIER[c] : 1;
  return target;
}

export function isFullDancer(grid: Grid, reel: number): boolean {
  const o = reel * ROWS;
  return grid[o] === DANCER_HEAD && grid[o + 1] === DANCER_TORSO && grid[o + 2] === DANCER_LEGS;
}

export function fullDancerCount(grid: Grid): number {
  let n = 0;
  for (let r = 0; r < REELS; r++) if (isFullDancer(grid, r)) n++;
  return n;
}

/**
 * Base game hot path (no allocations). Returns regular line-bet units; writes the mystery
 * multiplier sum to out[0] and 1/0 for the free-game trigger to out[1].
 */
export function evaluateBaseFast(grid: Grid, out: Int32Array, rules: Rules = DEFAULT_RULES): number {
  let units = 0;
  let mystery = 0;
  for (let l = 0; l < LINE_COUNT; l++) {
    const r = PAYLINES[l];
    const sym = evaluateLine(grid[r[0]], grid[ROWS + r[1]], grid[2 * ROWS + r[2]], scratch, rules.baseWild, rules.baseMultiplier);
    if (sym === -1) continue;
    if (sym === BONUS) mystery += scratch[0];
    else units += PAYS[sym] * scratch[0];
  }
  out[0] = mystery;
  out[1] = fullDancerCount(grid) === REELS ? 1 : 0;
  return units;
}

const counts = new Int32Array(PAYING_SYMBOLS);

/** Product of the `need` largest dancer multipliers, given how many of each are on screen. */
function bestProduct(need: number, n3: number, n2: number): number {
  let m = 1;
  for (let i = 0; i < need; i++) {
    if (n3 > 0) {
      m *= 3;
      n3--;
    } else if (n2 > 0) {
      m *= 2;
      n2--;
    }
  }
  return m;
}

/**
 * Free games hot path: three or more of a symbol anywhere on the screen win that symbol's
 * prize once. Missing cells are completed with dancers, highest multipliers first, and the
 * win takes the product of the dancers it used. Dancers alone pay nothing.
 * Same outputs as evaluateBaseFast.
 */
export function evaluateFreeFast(grid: Grid, out: Int32Array): number {
  counts.fill(0);
  let dancers = 0;
  let n3 = 0;
  let n2 = 0;
  for (let i = 0; i < REELS * ROWS; i++) {
    const s = grid[i];
    if (isDancer(s)) {
      dancers++;
      if (MULTIPLIER[s] === 3) n3++;
      else if (MULTIPLIER[s] === 2) n2++;
    } else {
      counts[s]++;
    }
  }
  let units = 0;
  let mystery = 0;
  for (let s = 0; s < PAYING_SYMBOLS; s++) {
    const own = counts[s];
    if (own === 0) continue;
    const need = own >= 3 ? 0 : 3 - own;
    if (need > dancers) continue;
    const m = bestProduct(need, n3, n2);
    if (s === BONUS) mystery += m;
    else units += PAYS[s] * m;
  }
  out[0] = mystery;
  out[1] = fullDancerCount(grid) === REELS ? 1 : 0;
  return units;
}

function countOf(sym: number, a: number, b: number, c: number): number {
  return (a === sym ? 1 : 0) + (b === sym ? 1 : 0) + (c === sym ? 1 : 0);
}

/** Two of a symbol and a third cell that did not complete it (a dancer completes it only when wild). */
function lineNearMiss(sym: number, a: number, b: number, c: number, dancerWild: boolean): boolean {
  if (countOf(sym, a, b, c) !== 2) return false;
  const third = a !== sym ? a : b !== sym ? b : c;
  return !(dancerWild && isDancer(third));
}

/** Detailed base-game evaluation for the playground. Near misses are only detected, never induced. */
export function evaluateBase(grid: Grid, rules: Rules = DEFAULT_RULES): Evaluation {
  const wins: Win[] = [];
  const nearMisses: NearMiss[] = [];
  const out = new Int32Array(1);
  let regularUnits = 0;
  let mysteryMultiplier = 0;

  for (let l = 0; l < LINE_COUNT; l++) {
    const r = PAYLINES[l];
    const cells = [r[0], ROWS + r[1], 2 * ROWS + r[2]];
    const [a, b, c] = cells.map((i) => grid[i]);
    const sym = evaluateLine(a, b, c, out, rules.baseWild, rules.baseMultiplier);
    if (sym !== -1) {
      const pay = sym === BONUS ? 0 : PAYS[sym] * out[0];
      if (sym === BONUS) mysteryMultiplier += out[0];
      regularUnits += pay;
      wins.push({ line: l, symbol: sym, multiplier: out[0], pay, cells });
    }
    if (lineNearMiss(BONUS, a, b, c, rules.baseWild)) nearMisses.push({ line: l, kind: 'bonus' });
    else if (lineNearMiss(SEVEN, a, b, c, rules.baseWild)) nearMisses.push({ line: l, kind: 'seven' });
    else if (lineNearMiss(MELON, a, b, c, rules.baseWild)) nearMisses.push({ line: l, kind: 'melon' });
  }

  const full = fullDancerCount(grid);
  if (full === REELS - 1) nearMisses.unshift({ line: null, kind: 'dancers' });

  return { wins, regularUnits, mysteryMultiplier, trigger: full === REELS, nearMisses };
}

/** Detailed free-game evaluation for the playground (anywhere wins). */
export function evaluateFree(grid: Grid): Evaluation {
  const wins: Win[] = [];
  const dancerCells: number[] = [];
  for (let i = 0; i < REELS * ROWS; i++) if (isDancer(grid[i])) dancerCells.push(i);
  dancerCells.sort((x, y) => MULTIPLIER[grid[y]] - MULTIPLIER[grid[x]]);

  let regularUnits = 0;
  let mysteryMultiplier = 0;
  for (let s = 0; s < PAYING_SYMBOLS; s++) {
    const own: number[] = [];
    for (let i = 0; i < REELS * ROWS; i++) if (grid[i] === s) own.push(i);
    if (own.length === 0) continue;
    const need = Math.max(0, 3 - own.length);
    if (need > dancerCells.length) continue;
    const used = dancerCells.slice(0, need);
    const multiplier = used.reduce((m, i) => m * MULTIPLIER[grid[i]], 1);
    const pay = s === BONUS ? 0 : PAYS[s] * multiplier;
    if (s === BONUS) mysteryMultiplier += multiplier;
    regularUnits += pay;
    wins.push({ line: null, symbol: s, multiplier, pay, cells: [...own, ...used] });
  }

  const full = fullDancerCount(grid);
  const nearMisses: NearMiss[] = full === REELS - 1 ? [{ line: null, kind: 'dancers' }] : [];
  return { wins, regularUnits, mysteryMultiplier, trigger: full === REELS, nearMisses };
}
