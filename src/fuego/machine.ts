import type { Rng } from '../engine/rng.ts';
import { evaluateWay, REELS, ROWS } from './evaluate.ts';
import { BELL, CHERRY, GRAPES, LEMON, MELON, ORANGE, PEAR, PLUM, SEVEN, SYMBOL_COUNT, WHEEL, WILD } from './symbols.ts';
import { wheelValue } from './wheel.ts';

type Strips = readonly (readonly number[])[];
type Weights = readonly (readonly number[])[];

const [CH, LE, OR, PL, ME, PE, GR, BE, SE, WI, WH] = [CHERRY, LEMON, ORANGE, PLUM, MELON, PEAR, GRAPES, BELL, SEVEN, WILD, WHEEL];
/** Placeholders in the gap templates for the two light fruits of a reel. */
const LA = -1;
const LB = -2;

/**
 * Builds a reel: runs of 3 of its heavy fruit, each followed by one gap of other symbols.
 * The template is rotated per reel so the reels do not line up.
 */
function buildStrip(heavy: number, lightA: number, lightB: number, gaps: readonly (readonly number[])[], rotate: number): number[] {
  const out: number[] = [];
  for (let g = 0; g < gaps.length; g++) {
    out.push(heavy, heavy, heavy);
    for (const sym of gaps[(g + rotate) % gaps.length]) out.push(sym === LA ? lightA : sym === LB ? lightB : sym);
  }
  return out;
}

const BASE_GAPS: readonly (readonly number[])[] = [
  [WH, PL, LA, ME],
  [SE, LB, PE, PL],
  [GR, ME, WI, LA],
  [WH, LB, PL, BE],
  [ME, PE, LA, GR],
  [LB, PL, SE],
  [WH, ME, LA],
  [GR, LB, BE],
  [PE, PL, ME],
];

const FREE_GAPS: readonly (readonly number[])[] = [
  [WI, PL, LA, ME, PE],
  [SE, LB, GR, PL, ME],
  [WI, BE, LA, PE],
  [ME, GR, LB, PL],
];

/**
 * Base reels, 59 stops. Each reel leans on one fruit, stacked in threes (cherries on the first,
 * lemons on the second, oranges on the third), so a whole reel of one fruit is common, as in the
 * original. Leaning on different fruits keeps the same fruit on all three reels rare, which pays
 * in multiples of the total bet need. Wheels are single and far apart: a reel never shows two.
 */
export const BASE_STRIPS: Strips = [
  buildStrip(CH, LE, OR, BASE_GAPS, 0),
  buildStrip(LE, CH, OR, BASE_GAPS, 3),
  buildStrip(OR, CH, LE, BASE_GAPS, 6),
];

/**
 * Free-spin reels, 30 stops: no wheels and two full-weight wilds per reel (the "alternate set of
 * reels"). The tuner keeps base wilds rare, so a wild shows far more often in free spins.
 */
export const FREE_STRIPS: Strips = [
  buildStrip(CH, LE, OR, FREE_GAPS, 0),
  buildStrip(LE, CH, OR, FREE_GAPS, 1),
  buildStrip(OR, CH, LE, FREE_GAPS, 2),
];

/** Stop weights: every fruit stop weighs NORMAL; the tuner sets the wild and wheel weights of the base reels. */
const NORMAL = 1000;
const FREE_WILD_WEIGHT = NORMAL;

export interface Machine {
  base: ReelSet;
  free: ReelSet;
}

export interface ReelSet {
  strips: Strips;
  weights: Weights;
  stopLookup: readonly Uint16Array[];
  totalWeight: readonly number[];
}

export interface Analysis {
  /** Base-game ways, per spin, as a fraction of the bet. */
  baseRtp: number;
  /** Wheel (multipliers and free spins), per spin, as a fraction of the bet. */
  wheelRtp: number;
  rtp: number;
  /** Chance a base spin shows a wheel on every reel. */
  triggerProbability: number;
  /** Expected win of one free spin, in multiples of the bet. */
  freeSpinValue: number;
  /** Expected wheel prize, in multiples of the bet. */
  wheelValue: number;
  /** Chance a base spin pays at least one way. */
  baseHitFrequency: number;
}

export function buildReelSet(strips: Strips, weights: Weights): ReelSet {
  const stopLookup: Uint16Array[] = [];
  const totalWeight: number[] = [];
  for (let r = 0; r < REELS; r++) {
    const w = weights[r];
    if (w.length !== strips[r].length) throw new Error(`Reel ${r}: weights and strip differ in length`);
    const total = w.reduce((s, x) => s + x, 0);
    if (!w.every((x) => Number.isInteger(x) && x >= 0) || total <= 0) {
      throw new Error(`Reel ${r}: weights must be non-negative integers with a positive total`);
    }
    const table = new Uint16Array(total);
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

export function spinStops(set: ReelSet, rng: Rng, out: Int32Array | number[]): void {
  for (let r = 0; r < REELS; r++) out[r] = set.stopLookup[r][rng.int(set.totalWeight[r])];
}

/** The trigger shortcut needs at most one wheel in any 3-stop window. */
function assertSingleWheelWindows(strips: Strips): void {
  strips.forEach((s, r) => {
    const n = s.length;
    s.forEach((sym, i) => {
      if (sym === WHEEL && (s[(i + 1) % n] === WHEEL || s[(i + 2) % n] === WHEEL)) {
        throw new Error(`Reel ${r}: two wheels can show at once (stop ${i})`);
      }
    });
  });
}

/** rowProb[reel][row][symbol] for weighted stops. Accepts fractional weights for the tuner. */
function rowProbabilities(strips: Strips, weights: Weights): number[][][] {
  return strips.map((s, r) => {
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
}

/**
 * Expected sum of the 27 ways, exact: each way sees one row per reel and the reels are
 * independent, so its expectation is a sum over symbol triples of the product of row chances.
 */
function waysRtp(rowProb: number[][][]): number {
  let total = 0;
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < ROWS; j++) {
      for (let k = 0; k < ROWS; k++) {
        const [p, q, u] = [rowProb[0][i], rowProb[1][j], rowProb[2][k]];
        for (let x = 0; x < SYMBOL_COUNT; x++) {
          if (p[x] === 0) continue;
          for (let y = 0; y < SYMBOL_COUNT; y++) {
            if (q[y] === 0) continue;
            for (let z = 0; z < SYMBOL_COUNT; z++) {
              if (u[z] === 0) continue;
              const pay = evaluateWay(x, y, z);
              if (pay > 0) total += p[x] * q[y] * u[z] * pay;
            }
          }
        }
      }
    }
  }
  return total;
}

/** Chance that at least one way pays, exact, by walking every stop combination (weights as probabilities). */
function hitFrequency(strips: Strips, weights: Weights): number {
  const lens = strips.map((s) => s.length);
  const totals = weights.map((w) => w.reduce((a, b) => a + b, 0));
  const windows = strips.map((s) => s.map((_, stop) => [s[(stop - 1 + s.length) % s.length], s[stop], s[(stop + 1) % s.length]]));
  let hit = 0;
  for (let a = 0; a < lens[0]; a++) {
    const pa = weights[0][a] / totals[0];
    if (pa === 0) continue;
    const wa = windows[0][a];
    for (let b = 0; b < lens[1]; b++) {
      const pb = weights[1][b] / totals[1];
      if (pb === 0) continue;
      const wb = windows[1][b];
      for (let c = 0; c < lens[2]; c++) {
        const pc = weights[2][c] / totals[2];
        if (pc === 0) continue;
        const wc = windows[2][c];
        let pays = false;
        for (let i = 0; i < ROWS && !pays; i++) for (let j = 0; j < ROWS && !pays; j++) for (let k = 0; k < ROWS && !pays; k++) pays = evaluateWay(wa[i], wb[j], wc[k]) > 0;
        if (pays) hit += pa * pb * pc;
      }
    }
  }
  return hit;
}

export function analyzeSets(baseStrips: Strips, baseWeights: Weights, freeStrips: Strips, freeWeights: Weights, withHitFrequency = false): Analysis {
  assertSingleWheelWindows(baseStrips);
  if (freeStrips.some((s) => s.includes(WHEEL))) throw new Error('Free-spin reels must not hold wheels');
  const baseRows = rowProbabilities(baseStrips, baseWeights);
  const baseRtp = waysRtp(baseRows);
  const triggerProbability = baseRows.reduce((p, rows) => p * (rows[0][WHEEL] + rows[1][WHEEL] + rows[2][WHEEL]), 1);
  const freeSpinValue = waysRtp(rowProbabilities(freeStrips, freeWeights));
  const wv = wheelValue(freeSpinValue);
  const wheelRtp = triggerProbability * wv;
  return {
    baseRtp,
    wheelRtp,
    rtp: baseRtp + wheelRtp,
    triggerProbability,
    freeSpinValue,
    wheelValue: wv,
    baseHitFrequency: withHitFrequency ? hitFrequency(baseStrips, baseWeights) : Number.NaN,
  };
}

export function analyzeMachine(m: Machine, withHitFrequency = false): Analysis {
  return analyzeSets(m.base.strips, m.base.weights, m.free.strips, m.free.weights, withHitFrequency);
}

/**
 * The wild knob weighs the wild stop and its two neighbours alike: those are exactly the stops
 * that put the wild in the window, so at 0 the wild never shows and the RTP moves smoothly with it.
 */
function weightsFor(strips: Strips, wild: number, wheel: number): number[][] {
  return strips.map((s) => {
    const n = s.length;
    const nearWild = (i: number) => s[i] === WILD || s[(i + 1) % n] === WILD || s[(i - 1 + n) % n] === WILD;
    return s.map((sym, i) => (nearWild(i) ? wild : sym === WHEEL ? wheel : NORMAL));
  });
}

export const FREE_WEIGHTS: Weights = weightsFor(FREE_STRIPS, FREE_WILD_WEIGHT, 0);

export interface TuneTarget {
  /** Fraction, e.g. 0.9637. */
  rtp: number;
  /** Average base spins between wheels. */
  wheelEvery: number;
}

export interface TuneResult {
  machine: Machine;
  analysis: Analysis;
  target: TuneTarget;
  minRtp: number;
  maxRtp: number;
  reachable: boolean;
}

const WILD_MIN = 0;
const WILD_MAX = 2_000;

/**
 * Two knobs on the base reels: the wheel weight sets how often the wheel comes, the wild weight
 * sets the RTP. For each wild weight the wheel weight is bisected to the target frequency, and the
 * wild weight is bisected to the target RTP. Weights are then rounded and the machine re-analysed,
 * so the reported figures are exact for the reels actually used.
 */
export function tune(target: TuneTarget): TuneResult {
  const freeSpinValue = waysRtp(rowProbabilities(FREE_STRIPS, FREE_WEIGHTS));
  const wv = wheelValue(freeSpinValue);
  const baseRows = (wild: number, wheel: number) => rowProbabilities(BASE_STRIPS, weightsFor(BASE_STRIPS, wild, wheel));
  const trigger = (rows: number[][][]) => rows.reduce((p, r) => p * (r[0][WHEEL] + r[1][WHEEL] + r[2][WHEEL]), 1);

  const wheelWeightFor = (wild: number): number => {
    let lo = 1;
    let hi = 200_000;
    for (let k = 0; k < 50; k++) {
      const mid = (lo + hi) / 2;
      if (trigger(baseRows(wild, mid)) < 1 / target.wheelEvery) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const rtpAt = (wild: number): number => {
    const rows = baseRows(wild, wheelWeightFor(wild));
    return waysRtp(rows) + trigger(rows) * wv;
  };

  const minRtp = rtpAt(WILD_MIN);
  const maxRtp = rtpAt(WILD_MAX);
  let lo = WILD_MIN;
  let hi = WILD_MAX;
  if (target.rtp <= minRtp) hi = WILD_MIN;
  else if (target.rtp >= maxRtp) lo = WILD_MAX;
  else {
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (rtpAt(mid) < target.rtp) lo = mid;
      else hi = mid;
    }
  }
  const wild = Math.round((lo + hi) / 2);
  const wheel = Math.round(wheelWeightFor(wild));
  const baseWeights = weightsFor(BASE_STRIPS, wild, wheel);
  const machine: Machine = { base: buildReelSet(BASE_STRIPS, baseWeights), free: buildReelSet(FREE_STRIPS, FREE_WEIGHTS) };
  const analysis = analyzeMachine(machine, true);
  const wheelReached = Math.abs(1 / analysis.triggerProbability - target.wheelEvery) / target.wheelEvery < 0.01;
  return {
    machine,
    analysis,
    target,
    minRtp,
    maxRtp,
    reachable: target.rtp >= minRtp && target.rtp <= maxRtp && wheelReached,
  };
}

/** Chance that a reel's window shows a wild, per reel, for a set of weighted reels. */
export function wildVisibility(set: ReelSet): number[] {
  return set.strips.map((s, r) => {
    const n = s.length;
    let p = 0;
    for (let stop = 0; stop < n; stop++) {
      if (s[(stop - 1 + n) % n] === WILD || s[stop] === WILD || s[(stop + 1) % n] === WILD) p += set.weights[r][stop];
    }
    return p / set.totalWeight[r];
  });
}
