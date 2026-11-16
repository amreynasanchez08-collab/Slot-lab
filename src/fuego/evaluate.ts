import { PAYS, WHEEL, WILD } from './symbols.ts';

export const REELS = 3;
export const ROWS = 3;
/** Every pick of one row per reel is a way: 3 x 3 x 3. */
export const WAYS = 27;

/** Grid layout: grid[reel * ROWS + row]. */
export type Grid = ArrayLike<number>;

export interface WayWin {
  symbol: number;
  /** How many of the 27 ways paid this symbol. */
  ways: number;
  /** Sum of those ways, in multiples of the total bet. */
  pay: number;
  /** Cells that take part in at least one paying way. */
  cells: number[];
}

export interface Evaluation {
  wins: WayWin[];
  /** All ways together, in multiples of the total bet. */
  multiplier: number;
  /** Reels showing a wheel. */
  wheelReels: number;
  wheelCells: number[];
  /** A wheel on every reel spins the mystery wheel. */
  trigger: boolean;
  /** Wheels on two reels: one short of the bonus. Detected, never induced. */
  nearMiss: boolean;
}

const wayScratch = new Int32Array(1);

/**
 * One way, left to right: the wild stands for any symbol except the wheel. Three wilds pay as
 * wilds; otherwise the first non-wild symbol is the target. Returns multiples of the total bet
 * and writes the paying symbol to out[0].
 */
export function evaluateWay(a: number, b: number, c: number, out: Int32Array = wayScratch): number {
  if (a === WHEEL || b === WHEEL || c === WHEEL) return 0;
  const target = a !== WILD ? a : b !== WILD ? b : c;
  if ((b === target || b === WILD) && (c === target || c === WILD) && (a === target || a === WILD)) {
    out[0] = target;
    return PAYS[target];
  }
  return 0;
}

/** Hot path for the simulator: sum of all 27 ways; writes the number of reels with a wheel to out[0]. */
export function evaluateFast(grid: Grid, out: Int32Array): number {
  let total = 0;
  for (let i = 0; i < ROWS; i++) {
    const a = grid[i];
    for (let j = 0; j < ROWS; j++) {
      const b = grid[ROWS + j];
      for (let k = 0; k < ROWS; k++) total += evaluateWay(a, b, grid[2 * ROWS + k]);
    }
  }
  let reels = 0;
  for (let r = 0; r < REELS; r++) {
    if (grid[r * ROWS] === WHEEL || grid[r * ROWS + 1] === WHEEL || grid[r * ROWS + 2] === WHEEL) reels++;
  }
  out[0] = reels;
  return total;
}

/** Detailed evaluation for the playground: wins grouped by symbol with their cells. */
export function evaluate(grid: Grid): Evaluation {
  const bySymbol = new Map<number, { ways: number; pay: number; cells: Set<number> }>();
  const out = new Int32Array(1);
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < ROWS; j++) {
      for (let k = 0; k < ROWS; k++) {
        const pay = evaluateWay(grid[i], grid[ROWS + j], grid[2 * ROWS + k], out);
        if (pay === 0) continue;
        const entry = bySymbol.get(out[0]) ?? { ways: 0, pay: 0, cells: new Set<number>() };
        entry.ways++;
        entry.pay += pay;
        entry.cells.add(i).add(ROWS + j).add(2 * ROWS + k);
        bySymbol.set(out[0], entry);
      }
    }
  }
  const wins: WayWin[] = [...bySymbol.entries()]
    .map(([symbol, e]) => ({ symbol, ways: e.ways, pay: e.pay, cells: [...e.cells].sort((x, y) => x - y) }))
    .sort((x, y) => y.pay - x.pay);

  const wheelCells: number[] = [];
  for (let c = 0; c < REELS * ROWS; c++) if (grid[c] === WHEEL) wheelCells.push(c);
  const wheelReels = new Set(wheelCells.map((c) => Math.floor(c / ROWS))).size;
  return {
    wins,
    multiplier: wins.reduce((s, w) => s + w.pay, 0),
    wheelReels,
    wheelCells,
    trigger: wheelReels === REELS,
    nearMiss: wheelReels === REELS - 1,
  };
}
