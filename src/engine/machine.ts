import { DEFAULT_RULES, evaluateBaseFast, evaluateFreeFast, LINE_COUNT, REELS, ROWS, type Grid, type Rules } from './evaluate.ts';
import type { Rng } from './rng.ts';
import {
  BASE_FRUIT_WEIGHTS,
  BASE_STRIPS,
  FREE_DANCER_SHARE,
  FREE_FRUIT_WEIGHTS,
  FREE_STRIPS,
  WEIGHT_SCALE,
} from './reels.ts';
import { BONUS, DANCER_TORSO, isDancer, MYSTERY_MEAN_PAY, MYSTERY_SYMBOLS } from './symbols.ts';

export interface FreeGameConfig {
  /** Free games awarded per trigger and per retrigger. */
  award: number;
}

export const DEFAULT_FREE_GAMES: FreeGameConfig = { award: 15 };

type Strips = readonly (readonly number[])[];
type Weights = readonly (readonly number[])[];

export interface ReelSet {
  strips: Strips;
  /** Integer weight per stop, per reel. */
  weights: Weights;
  /** stopLookup[reel][k] = stop for virtual position k in [0, totalWeight). */
  stopLookup: readonly Uint8Array[];
  totalWeight: readonly number[];
}

export interface Machine {
  base: ReelSet;
  /** Separate reel set for the free games. */
  free: ReelSet;
  freeGames: FreeGameConfig;
  rules: Rules;
}

export interface Analysis {
  /** Expected base-game win per paid spin, as a fraction of the total bet. */
  baseRtp: number;
  /** Expected free-game round contribution per paid spin, as a fraction of the total bet. */
  freeGameRtp: number;
  rtp: number;
  /** P(any line wins or free games trigger) on one paid spin. */
  hitFrequency: number;
  /** P(complete dancer on all three reels) on one paid spin. */
  triggerProbability: number;
  /** Expected win of one free game, in multiples of the total bet. */
  freeGameValue: number;
  /** P(any anywhere win) on one free game. */
  freeGameHitFrequency: number;
  /** P(retrigger) on one free game. */
  retriggerProbability: number;
  /** Expected free games per round, retriggers included. */
  expectedRoundSpins: number;
  /** Expected round win in multiples of the total bet. */
  expectedRoundWin: number;
}

export function buildReelSet(strips: Strips, weights: Weights): ReelSet {
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

/** Writes the 3x3 window for the given stops into grid (grid[reel * ROWS + row]). */
export function fillGrid(strips: Strips, stops: ArrayLike<number>, grid: Int8Array | number[]): void {
  for (let r = 0; r < REELS; r++) {
    const strip = strips[r];
    const n = strip.length;
    const s = stops[r];
    grid[r * ROWS] = strip[(s - 1 + n) % n];
    grid[r * ROWS + 1] = strip[s];
    grid[r * ROWS + 2] = strip[(s + 1) % n];
  }
}

export function spinStops(reels: ReelSet, rng: Rng, out: Int32Array | number[]): void {
  for (let r = 0; r < REELS; r++) {
    out[r] = reels.stopLookup[r][rng.int(reels.totalWeight[r])];
  }
}

/** Symbol whose prize the mystery BONUS wins pay this spin. */
export function drawMystery(rng: Rng): number {
  return MYSTERY_SYMBOLS[rng.int(MYSTERY_SYMBOLS.length)];
}

interface SetStats {
  /** Expected line-bet units per spin, mystery at its mean prize. */
  units: number;
  /** P(complete dancer on all three reels). */
  trigger: number;
  /** P(any win or trigger). */
  hit: number;
}

/**
 * Exact expectation over one reel set: enumerates every weighted stop combination.
 * Accepts fractional weights so the tuner can search continuously.
 */
function enumerate(strips: Strips, weights: Weights, evaluate: (grid: Grid, out: Int32Array) => number): SetStats {
  const totals = weights.map((w) => w.reduce((s, x) => s + x, 0));
  const grid = new Int8Array(REELS * ROWS);
  const stops = [0, 0, 0];
  const out = new Int32Array(2);
  let units = 0;
  let trigger = 0;
  let hit = 0;
  const [w0, w1, w2] = weights;
  for (let i = 0; i < w0.length; i++) {
    if (w0[i] === 0) continue;
    stops[0] = i;
    for (let j = 0; j < w1.length; j++) {
      if (w1[j] === 0) continue;
      stops[1] = j;
      const wij = w0[i] * w1[j];
      for (let k = 0; k < w2.length; k++) {
        if (w2[k] === 0) continue;
        stops[2] = k;
        fillGrid(strips, stops, grid);
        const p = wij * w2[k];
        const u = evaluate(grid, out) + out[0] * MYSTERY_MEAN_PAY;
        units += p * u;
        if (out[1] === 1) trigger += p;
        if (u > 0 || out[1] === 1) hit += p;
      }
    }
  }
  const norm = totals[0] * totals[1] * totals[2];
  return { units: units / norm, trigger: trigger / norm, hit: hit / norm };
}

const analyzeBaseSet = (strips: Strips, weights: Weights, rules: Rules): SetStats =>
  enumerate(strips, weights, (g, o) => evaluateBaseFast(g, o, rules));

const analyzeFreeSet = (strips: Strips, weights: Weights): SetStats => enumerate(strips, weights, evaluateFreeFast);

/**
 * RTP = base + p * E[games per round] * E[free-game win], with
 * E[games per round] = award / (1 - r * award) (Wald's identity; r = retrigger chance).
 */
function combine(base: SetStats, free: SetStats, freeGames: FreeGameConfig): Analysis {
  const baseRtp = base.units / LINE_COUNT;
  const freeGameValue = free.units / LINE_COUNT;
  const growth = free.trigger * freeGames.award;
  const expectedRoundSpins = growth < 1 ? freeGames.award / (1 - growth) : Number.POSITIVE_INFINITY;
  const expectedRoundWin = expectedRoundSpins * freeGameValue;
  const freeGameRtp = base.trigger * expectedRoundWin;
  return {
    baseRtp,
    freeGameRtp,
    rtp: baseRtp + freeGameRtp,
    hitFrequency: base.hit,
    triggerProbability: base.trigger,
    freeGameValue,
    freeGameHitFrequency: free.hit,
    retriggerProbability: free.trigger,
    expectedRoundSpins,
    expectedRoundWin,
  };
}

export function analyzeMachine(machine: Machine): Analysis {
  return combine(
    analyzeBaseSet(machine.base.strips, machine.base.weights, machine.rules),
    analyzeFreeSet(machine.free.strips, machine.free.weights),
    machine.freeGames,
  );
}

/**
 * Base weights: fruits fixed, BONUS (mystery) as given, head and legs stops at 0, and the
 * torso stop sized so the complete dancer shows on each reel with probability `dancerShare`.
 */
function baseWeights(bonusWeight: number, dancerShare: number, strips: Strips = BASE_STRIPS): number[][] {
  return strips.map((strip) => {
    const fruit = strip.map((sym) => (isDancer(sym) ? 0 : sym === BONUS ? bonusWeight : BASE_FRUIT_WEIGHTS[sym]));
    const total = fruit.reduce((s, x) => s + x, 0);
    const torso = (dancerShare * total) / (1 - dancerShare);
    return strip.map((sym, i) => (sym === DANCER_TORSO ? torso : fruit[i]));
  });
}

/** Free weights: fixed fruits; every dancer stop sized to FREE_DANCER_SHARE of the reel. */
function freeWeights(strips: Strips = FREE_STRIPS): number[][] {
  return strips.map((strip) => {
    const fruit = strip.map((sym) => (isDancer(sym) ? 0 : FREE_FRUIT_WEIGHTS[sym]));
    const total = fruit.reduce((s, x) => s + x, 0);
    const dancer = (FREE_DANCER_SHARE * total) / (1 - 3 * FREE_DANCER_SHARE);
    return strip.map((sym, i) => (isDancer(sym) ? dancer : fruit[i]));
  });
}

const toIntegers = (w: number[][], scale: number): number[][] => w.map((reel) => reel.map((x) => Math.round(x * scale)));

/** Bisection for an increasing function on [lo, hi]; returns the clamped argument. */
function solve(f: (x: number) => number, target: number, lo: number, hi: number): { x: number; reachable: boolean } {
  const flo = f(lo);
  const fhi = f(hi);
  if (target <= flo) return { x: lo, reachable: Math.abs(target - flo) < 1e-9 };
  if (target >= fhi) return { x: hi, reachable: Math.abs(target - fhi) < 1e-9 };
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid;
    else hi = mid;
  }
  return { x: (lo + hi) / 2, reachable: true };
}

export interface TuneTargets {
  /** Total RTP, e.g. 0.95. */
  rtp: number;
  /** Free games trigger once every N paid spins on average. */
  bonusEvery: number;
}

export interface TuneResult {
  machine: Machine;
  analysis: Analysis;
  targets: TuneTargets;
  /** False when the RTP target could not be met; the closest value is used. */
  reachable: boolean;
}

/**
 * Two levers, each solved with an exact analysis:
 * 1. Dancer torso weight per reel sets the trigger rate (1 / bonusEvery).
 * 2. Mystery BONUS weight in the base game fills the rest of the RTP.
 * The free-game reels are fixed, so the free games pay about bonusEvery-independent ~50x per
 * round and their RTP share follows from the trigger rate (~36% at 1 in 150).
 * Weights are rounded to integers and the machine is re-analysed, so the reported figures
 * are the ones the machine really has.
 */
export function tune(
  targets: TuneTargets,
  freeGames: FreeGameConfig = DEFAULT_FREE_GAMES,
  rules: Rules = DEFAULT_RULES,
): TuneResult {
  const dancerShare = Math.cbrt(1 / targets.bonusEvery);
  // Free reels need the larger scale: their dancer stops weigh a fraction of a fruit stop.
  const free = buildReelSet(FREE_STRIPS, toIntegers(freeWeights(), 100 * WEIGHT_SCALE));
  const freeStats = analyzeFreeSet(free.strips, free.weights);

  const totalAt = (bw: number) => combine(analyzeBaseSet(BASE_STRIPS, baseWeights(bw, dancerShare), rules), freeStats, freeGames).rtp;
  const solution = solve(totalAt, targets.rtp, 0, 2000);
  const base = buildReelSet(BASE_STRIPS, toIntegers(baseWeights(solution.x, dancerShare), WEIGHT_SCALE));

  const machine: Machine = { base, free, freeGames, rules };
  return { machine, analysis: analyzeMachine(machine), targets, reachable: solution.reachable };
}
