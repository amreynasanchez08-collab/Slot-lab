import type { Rng } from '../engine/rng.ts';
import { evaluateLineSymbols, LINE_COUNT, PAYLINES, REELS, ROWS } from './evaluate.ts';
import { BELL, CHERRY, LEMON, MELON, ORANGE, PLUM, SCATTER_PAYS, SEVEN, STAR, SYMBOL_COUNT } from './symbols.ts';

type Strips = readonly (readonly number[])[];
type Weights = readonly (readonly number[])[];

const run = (sym: number, n: number): number[] => new Array<number>(n).fill(sym);
const strip = (...runs: [number, number][]): number[] => runs.flatMap(([sym, n]) => run(sym, n));
const [CH, LE, OR, PL, BE, ME, SE, ST] = [CHERRY, LEMON, ORANGE, PLUM, BELL, MELON, SEVEN, STAR];

/**
 * Stacked strips: fruits come in runs of 3-4 so whole reels of one fruit are common, as in
 * the game. Stars are single and far apart, so a reel never shows more than one.
 */
export const STRIPS: Strips = [
  strip([CH, 4], [ST, 1], [LE, 3], [OR, 4], [PL, 3], [SE, 2], [ME, 3], [BE, 3], [CH, 3], [ST, 1], [LE, 4], [OR, 3], [PL, 4], [ME, 3], [BE, 2]),
  strip([LE, 4], [OR, 3], [ST, 1], [CH, 4], [ME, 3], [PL, 3], [BE, 3], [SE, 3], [OR, 4], [LE, 3], [ST, 1], [CH, 3], [PL, 3], [ME, 4], [BE, 2]),
  strip([OR, 4], [CH, 3], [PL, 4], [ST, 1], [LE, 3], [BE, 3], [ME, 3], [SE, 2], [CH, 4], [OR, 3], [LE, 4], [ST, 1], [PL, 3], [BE, 2], [ME, 3]),
  strip([PL, 3], [LE, 4], [ST, 1], [CH, 3], [OR, 4], [BE, 3], [ME, 4], [SE, 2], [LE, 3], [CH, 4], [ST, 1], [OR, 3], [PL, 4], [BE, 2], [ME, 3]),
  strip([ME, 3], [CH, 4], [OR, 3], [ST, 1], [LE, 4], [PL, 3], [BE, 3], [SE, 3], [CH, 3], [ST, 1], [OR, 4], [LE, 3], [ME, 3], [PL, 3], [BE, 2]),
];

/**
 * Virtual-reel weight per symbol (stop where the symbol lands in the middle row). Only the
 * seven differs between profiles: more wild stops means more substitutions, so RTP rises
 * steadily from TIGHT to LOOSE. The paytable never changes.
 */
export const TIGHT_WEIGHTS: readonly number[] = [10, 10, 10, 10, 10, 10, 1, 10];
export const LOOSE_WEIGHTS: readonly number[] = [10, 10, 10, 10, 10, 10, 4, 10];
const WEIGHT_SCALE = 1000;

export interface Machine {
  strips: Strips;
  weights: Weights;
  stopLookup: readonly Uint8Array[];
  totalWeight: readonly number[];
}

export interface Analysis {
  /** Line wins per spin, as a fraction of the total bet. */
  lineRtp: number;
  /** Star wins per spin, as a fraction of the total bet. */
  scatterRtp: number;
  rtp: number;
  /** P(stars = k) for k = 0..5. */
  starDistribution: number[];
}

export function buildMachine(weights: Weights, strips: Strips = STRIPS): Machine {
  const stopLookup: Uint8Array[] = [];
  const totalWeight: number[] = [];
  for (let r = 0; r < REELS; r++) {
    const w = weights[r];
    if (w.length !== strips[r].length) throw new Error(`Reel ${r}: weights and strip differ in length`);
    const total = w.reduce((s, x) => s + x, 0);
    if (!w.every((x) => Number.isInteger(x) && x >= 0) || total <= 0) {
      throw new Error(`Reel ${r}: weights must be non-negative integers with a positive total`);
    }
    const table = new Uint8Array(total);
    let k = 0;
    for (let s = 0; s < w.length; s++) {
      table.fill(s, k, k + w[s]);
      k += w[s];
    }
    stopLookup.push(table);
    totalWeight.push(total);
  }
  return { strips, weights, stopLookup, totalWeight };
}

/** The star-count shortcut in analyze needs at most one star in any 3-stop window. */
function assertSingleStarWindows(strips: Strips): void {
  strips.forEach((s, r) => {
    const n = s.length;
    s.forEach((sym, i) => {
      if (sym === STAR && (s[(i + 1) % n] === STAR || s[(i + 2) % n] === STAR)) {
        throw new Error(`Reel ${r}: two stars can show at once (stops ${i} and nearby)`);
      }
    });
  });
}

export function fillGrid(strips: Strips, stops: ArrayLike<number>, grid: Int8Array | number[]): void {
  for (let r = 0; r < REELS; r++) {
    const s = strips[r];
    const n = s.length;
    const stop = stops[r];
    grid[r * ROWS] = s[(stop - 1 + n) % n];
    grid[r * ROWS + 1] = s[stop];
    grid[r * ROWS + 2] = s[(stop + 1) % n];
  }
}

export function spinStops(machine: Machine, rng: Rng, out: Int32Array | number[]): void {
  for (let r = 0; r < REELS; r++) out[r] = machine.stopLookup[r][rng.int(machine.totalWeight[r])];
}

/**
 * Exact analysis without enumerating 5-reel stop combinations:
 * - A line only sees one row per reel, and reels are independent, so its expected pay is a sum
 *   over 8^5 symbol tuples of the product of per-reel row probabilities.
 * - Each reel shows at most one star, so the star count is a sum of independent Bernoullis.
 * Accepts fractional weights so the tuner can search continuously.
 */
export function analyze(weights: Weights, strips: Strips = STRIPS): Analysis {
  assertSingleStarWindows(strips);
  // rowProb[r][row][sym]
  const rowProb = strips.map((s, r) => {
    const n = s.length;
    const total = weights[r].reduce((a, b) => a + b, 0);
    const rows = [0, 1, 2].map(() => new Array<number>(SYMBOL_COUNT).fill(0));
    for (let stop = 0; stop < n; stop++) {
      const p = weights[r][stop] / total;
      if (p === 0) continue;
      rows[0][s[(stop - 1 + n) % n]] += p;
      rows[1][s[stop]] += p;
      rows[2][s[(stop + 1) % n]] += p;
    }
    return rows;
  });

  const symbols = new Int32Array(REELS);
  let lineUnits = 0;
  for (const rows of PAYLINES) {
    const probs = rows.map((row, r) => rowProb[r][row]);
    const visit = (reel: number, p: number): void => {
      if (reel === REELS) {
        lineUnits += p * evaluateLineSymbols(symbols);
        return;
      }
      for (let sym = 0; sym < SYMBOL_COUNT; sym++) {
        const q = probs[reel][sym];
        if (q === 0) continue;
        symbols[reel] = sym;
        visit(reel + 1, p * q);
      }
    };
    visit(0, 1);
  }

  // P(star visible on reel r) = sum of its three row probabilities (never two at once).
  let dist = [1];
  for (let r = 0; r < REELS; r++) {
    const p = rowProb[r][0][STAR] + rowProb[r][1][STAR] + rowProb[r][2][STAR];
    const next = new Array<number>(dist.length + 1).fill(0);
    dist.forEach((d, k) => {
      next[k] += d * (1 - p);
      next[k + 1] += d * p;
    });
    dist = next;
  }
  const scatterRtp = dist.reduce((s, d, k) => s + d * SCATTER_PAYS[k], 0);
  const lineRtp = lineUnits / LINE_COUNT;
  return { lineRtp, scatterRtp, rtp: lineRtp + scatterRtp, starDistribution: dist };
}

function weightsAt(t: number, scale: number, strips: Strips = STRIPS): number[][] {
  return strips.map((s) => s.map((sym) => (TIGHT_WEIGHTS[sym] + t * (LOOSE_WEIGHTS[sym] - TIGHT_WEIGHTS[sym])) * scale));
}

export interface TuneResult {
  machine: Machine;
  analysis: Analysis;
  targetRtp: number;
  minRtp: number;
  maxRtp: number;
  reachable: boolean;
}

/** Bisects the wild weight between the tight and loose profiles, then rounds and re-analyses. */
export function tune(targetRtp: number): TuneResult {
  const rtpAt = (t: number) => analyze(weightsAt(t, 1)).rtp;
  const minRtp = rtpAt(0);
  const maxRtp = rtpAt(1);
  let lo = 0;
  let hi = 1;
  if (targetRtp <= minRtp) hi = 0;
  else if (targetRtp >= maxRtp) lo = 1;
  else {
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (rtpAt(mid) < targetRtp) lo = mid;
      else hi = mid;
    }
  }
  const weights = weightsAt((lo + hi) / 2, WEIGHT_SCALE).map((reel) => reel.map((w) => Math.round(w)));
  const machine = buildMachine(weights);
  return {
    machine,
    analysis: analyze(weights),
    targetRtp,
    minRtp,
    maxRtp,
    reachable: targetRtp >= minRtp && targetRtp <= maxRtp,
  };
}


