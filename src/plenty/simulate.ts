import type { BalancePoint } from '../engine/simulate.ts';
import { createRng } from '../engine/rng.ts';
import { evaluateFast, LINE_COUNT, REELS, ROWS } from './evaluate.ts';
import { fillGrid, spinStops, type Machine } from './machine.ts';
import { BET_STEP } from './session.ts';
import { SCATTER_PAYS } from './symbols.ts';

export interface PlentySimulationParams {
  spins: number;
  /** Cents, multiple of 20. */
  bet: number;
  /** Cents. */
  startBalance: number;
  seed: number;
  chartPoints?: number;
}

export interface PlentySimulationResult {
  spins: number;
  seed: number;
  totalBet: number;
  totalWin: number;
  rtp: number;
  rtpCi95: number;
  lineRtp: number;
  scatterRtp: number;
  hitFrequency: number;
  ldwCount: number;
  /** Spins with 3, 4 and 5 stars. */
  starHits: [number, number, number];
  maxWinX: number;
  maxWinSpin: number;
  finalBalance: number;
  peakBalance: number;
  lowBalance: number;
  maxDrawdown: number;
  bustSpin: number | null;
  curve: BalancePoint[];
  elapsedMs: number;
}

/**
 * Monte Carlo over spins, gamble never taken (it is fair, so it only adds variance).
 * Accounting in units of bet / 20; with the bet a multiple of 20 cents money stays integer.
 */
export function simulatePlenty(
  machine: Machine,
  params: PlentySimulationParams,
  onProgress?: (done: number) => void,
): PlentySimulationResult {
  const { spins, bet, startBalance, seed } = params;
  if (!Number.isInteger(spins) || spins <= 0) throw new RangeError('spins must be a positive integer');
  if (!Number.isInteger(bet) || bet <= 0 || bet % BET_STEP !== 0) throw new RangeError('bet must be a multiple of 20 cents');

  const started = Date.now();
  const rng = createRng(seed);
  const unit = bet / LINE_COUNT;
  const stops = new Int32Array(REELS);
  const grid = new Int8Array(REELS * ROWS);
  const out = new Int32Array(1);

  let lineUnits = 0;
  let scatterUnits = 0;
  let sumSq = 0;
  let hits = 0;
  let ldw = 0;
  const starHits: [number, number, number] = [0, 0, 0];
  let maxUnits = 0;
  let maxSpin = 0;

  let balance = startBalance;
  let peak = startBalance;
  let low = startBalance;
  let maxDrawdown = 0;
  let bustSpin: number | null = null;

  const chartPoints = Math.max(10, params.chartPoints ?? 600);
  const bucket = Math.max(1, Math.ceil(spins / chartPoints));
  const curve: BalancePoint[] = [{ spin: 0, min: startBalance, max: startBalance, close: startBalance }];
  let bMin = Infinity;
  let bMax = -Infinity;
  const progressEvery = Math.max(1, Math.floor(spins / 50));

  for (let i = 1; i <= spins; i++) {
    spinStops(machine, rng, stops);
    fillGrid(machine.strips, stops, grid);
    const lines = evaluateFast(grid, out);
    const stars = Math.min(out[0], 5);
    const scatter = SCATTER_PAYS[stars] * LINE_COUNT;
    if (stars >= 3) starHits[stars - 3]++;
    const units = lines + scatter;
    lineUnits += lines;
    scatterUnits += scatter;
    if (units > 0) hits++;
    if (units > 0 && units < LINE_COUNT) ldw++;

    const x = units / LINE_COUNT;
    sumSq += x * x;
    if (units > maxUnits) {
      maxUnits = units;
      maxSpin = i;
    }

    balance += units * unit - bet;
    if (balance > peak) peak = balance;
    if (balance < low) low = balance;
    if (peak - balance > maxDrawdown) maxDrawdown = peak - balance;
    if (bustSpin === null && balance < bet) bustSpin = i;

    if (balance < bMin) bMin = balance;
    if (balance > bMax) bMax = balance;
    if (i % bucket === 0 || i === spins) {
      curve.push({ spin: i, min: bMin, max: bMax, close: balance });
      bMin = Infinity;
      bMax = -Infinity;
    }
    if (onProgress && i % progressEvery === 0) onProgress(i);
  }

  const totalUnits = lineUnits + scatterUnits;
  const rtp = totalUnits / LINE_COUNT / spins;
  const variance = Math.max(0, sumSq / spins - rtp * rtp);
  return {
    spins,
    seed,
    totalBet: bet * spins,
    totalWin: totalUnits * unit,
    rtp,
    rtpCi95: 1.96 * Math.sqrt(variance / spins),
    lineRtp: lineUnits / LINE_COUNT / spins,
    scatterRtp: scatterUnits / LINE_COUNT / spins,
    hitFrequency: hits / spins,
    ldwCount: ldw,
    starHits,
    maxWinX: maxUnits / LINE_COUNT,
    maxWinSpin: maxSpin,
    finalBalance: balance,
    peakBalance: peak,
    lowBalance: low,
    maxDrawdown,
    bustSpin,
    curve,
    elapsedMs: Date.now() - started,
  };
}
