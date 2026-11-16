import type { BalancePoint } from '../engine/simulate.ts';
import { createRng } from '../engine/rng.ts';
import { evaluateFast, REELS, ROWS } from './evaluate.ts';
import { fillGrid, spinStops, type Machine } from './machine.ts';
import { BET_STEP } from './session.ts';
import { pickSector, WHEEL_SECTORS } from './wheel.ts';

export interface FuegoSimulationParams {
  /** Paid spins. */
  spins: number;
  /** Cents, multiple of 10. */
  bet: number;
  /** Cents. */
  startBalance: number;
  seed: number;
  chartPoints?: number;
}

export interface FuegoSimulationResult {
  spins: number;
  seed: number;
  totalBet: number;
  totalWin: number;
  rtp: number;
  rtpCi95: number;
  baseRtp: number;
  /** Wheel multipliers. */
  multiplierRtp: number;
  /** Free-spin rounds. */
  freeSpinRtp: number;
  hitFrequency: number;
  wheels: number;
  /** Times each wheel sector came up. */
  sectorHits: number[];
  freeSpinsPlayed: number;
  /** Biggest free-spin round, in multiples of the bet. */
  maxRoundX: number;
  /** Biggest single paid spin including its wheel and round, in multiples of the bet. */
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
 * Monte Carlo over paid spins. A trigger spins the wheel and plays any free spins right away, and
 * their wins count toward the paid spin that triggered them. The gamble is never taken (it is fair,
 * so it only adds variance). Money is tracked in multiples of the bet, which keeps it exact. The
 * smallest pay is 2x the bet, so this game has no losses disguised as wins.
 */
export function simulateFuego(machine: Machine, params: FuegoSimulationParams, onProgress?: (done: number) => void): FuegoSimulationResult {
  const { spins, bet, startBalance, seed } = params;
  if (!Number.isInteger(spins) || spins <= 0) throw new RangeError('spins must be a positive integer');
  if (!Number.isInteger(bet) || bet <= 0 || bet % BET_STEP !== 0) throw new RangeError('bet must be a multiple of 10 cents');

  const started = Date.now();
  const rng = createRng(seed);
  const stops = new Int32Array(REELS);
  const grid = new Int8Array(REELS * ROWS);
  const out = new Int32Array(1);

  let baseX = 0;
  let multX = 0;
  let freeX = 0;
  let sumSq = 0;
  let hits = 0;
  let wheels = 0;
  const sectorHits = new Array<number>(WHEEL_SECTORS.length).fill(0);
  let freeSpinsPlayed = 0;
  let maxRoundX = 0;
  let maxX = 0;
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
    spinStops(machine.base, rng, stops);
    fillGrid(machine.base.strips, stops, grid);
    const ways = evaluateFast(grid, out);
    let x = ways;
    baseX += ways;
    if (ways > 0) hits++;

    if (out[0] === REELS) {
      wheels++;
      const sector = pickSector(rng);
      sectorHits[sector]++;
      const s = WHEEL_SECTORS[sector];
      if (s.kind === 'multiplier') {
        multX += s.value;
        x += s.value;
      } else {
        let round = 0;
        for (let f = 0; f < s.value; f++) {
          spinStops(machine.free, rng, stops);
          fillGrid(machine.free.strips, stops, grid);
          round += evaluateFast(grid, out);
        }
        freeSpinsPlayed += s.value;
        freeX += round;
        x += round;
        if (round > maxRoundX) maxRoundX = round;
      }
    }

    sumSq += x * x;
    if (x > maxX) {
      maxX = x;
      maxSpin = i;
    }

    balance += x * bet - bet;
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

  const totalX = baseX + multX + freeX;
  const rtp = totalX / spins;
  const variance = Math.max(0, sumSq / spins - rtp * rtp);
  return {
    spins,
    seed,
    totalBet: bet * spins,
    totalWin: totalX * bet,
    rtp,
    rtpCi95: 1.96 * Math.sqrt(variance / spins),
    baseRtp: baseX / spins,
    multiplierRtp: multX / spins,
    freeSpinRtp: freeX / spins,
    hitFrequency: hits / spins,
    wheels,
    sectorHits,
    freeSpinsPlayed,
    maxRoundX,
    maxWinX: maxX,
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
