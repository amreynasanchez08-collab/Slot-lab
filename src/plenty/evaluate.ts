import { LINE_PAYS, SCATTER_PAYS, SEVEN, STAR, WILD } from './symbols.ts';

export const REELS = 5;
export const ROWS = 3;

/**
 * Row index per reel for each of the 20 lines. PROVISIONAL: the common 5x3 20-line layout;
 * the game's own line chart has not been seen yet. Rows: 0 top, 1 middle, 2 bottom.
 */
export const PAYLINES: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 2, 2, 2, 1],
  [1, 0, 0, 0, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [1, 1, 0, 1, 1],
  [1, 1, 2, 1, 1],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1],
  [0, 0, 2, 0, 0],
  [2, 2, 0, 2, 2],
  [0, 2, 0, 2, 0],
];
export const LINE_COUNT = PAYLINES.length;

/** Grid layout: grid[reel * ROWS + row]. */
export type Grid = ArrayLike<number>;

export interface LineWin {
  line: number;
  symbol: number;
  count: number;
  /** Line-bet units. */
  pay: number;
}

export type NearMissKind = 'stars' | 'sevens';

export interface Evaluation {
  wins: LineWin[];
  /** Sum of line pays, line-bet units. */
  lineUnits: number;
  stars: number;
  /** Scatter pay in multiples of the total bet. */
  scatterMultiplier: number;
  starCells: number[];
  nearMisses: { line: number | null; kind: NearMissKind }[];
}

const lineScratch = new Int32Array(2);

/**
 * Left-to-right line evaluation. The seven substitutes everything except the star; a star
 * breaks the line. Only the highest win is paid per line, so a run of sevens that pays more
 * on its own beats the symbol it completes. Writes the winning symbol and count to out.
 * Returns line-bet units.
 */
export function evaluateLineSymbols(symbols: ArrayLike<number>, out: Int32Array = lineScratch): number {
  let wilds = 0;
  while (wilds < REELS && symbols[wilds] === WILD) wilds++;
  const wildPay = LINE_PAYS[SEVEN][wilds];

  let target = -1;
  let count = wilds;
  if (wilds < REELS && symbols[wilds] !== STAR) {
    target = symbols[wilds];
    count = wilds + 1;
    while (count < REELS && (symbols[count] === target || symbols[count] === WILD)) count++;
  }
  const symbolPay = target === -1 ? 0 : LINE_PAYS[target][count];

  if (wildPay === 0 && symbolPay === 0) return 0;
  if (wildPay >= symbolPay) {
    out[0] = SEVEN;
    out[1] = wilds;
    return wildPay;
  }
  out[0] = target;
  out[1] = count;
  return symbolPay;
}

const lineSymbols = new Int32Array(REELS);

export function countStars(grid: Grid): number {
  let stars = 0;
  for (let i = 0; i < REELS * ROWS; i++) if (grid[i] === STAR) stars++;
  return stars;
}

/** Hot path: returns line-bet units of all lines; writes the star count to out[0]. */
export function evaluateFast(grid: Grid, out: Int32Array): number {
  let units = 0;
  for (let l = 0; l < LINE_COUNT; l++) {
    const rows = PAYLINES[l];
    for (let r = 0; r < REELS; r++) lineSymbols[r] = grid[r * ROWS + rows[r]];
    units += evaluateLineSymbols(lineSymbols);
  }
  out[0] = countStars(grid);
  return units;
}

/** Detailed evaluation for the playground. Near misses are only detected, never induced. */
export function evaluate(grid: Grid): Evaluation {
  const wins: LineWin[] = [];
  const nearMisses: Evaluation['nearMisses'] = [];
  const out = new Int32Array(2);
  const symbols = new Int32Array(REELS);
  let lineUnits = 0;

  for (let l = 0; l < LINE_COUNT; l++) {
    const rows = PAYLINES[l];
    for (let r = 0; r < REELS; r++) symbols[r] = grid[r * ROWS + rows[r]];
    const pay = evaluateLineSymbols(symbols, out);
    if (pay > 0) {
      lineUnits += pay;
      wins.push({ line: l, symbol: out[0], count: out[1], pay });
    }
    let sevens = 0;
    while (sevens < REELS && symbols[sevens] === SEVEN) sevens++;
    if (sevens === 4) nearMisses.push({ line: l, kind: 'sevens' });
  }

  const starCells: number[] = [];
  for (let i = 0; i < REELS * ROWS; i++) if (grid[i] === STAR) starCells.push(i);
  const stars = starCells.length;
  if (stars === 2) nearMisses.unshift({ line: null, kind: 'stars' });

  return { wins, lineUnits, stars, scatterMultiplier: SCATTER_PAYS[Math.min(stars, 5)], starCells, nearMisses };
}
