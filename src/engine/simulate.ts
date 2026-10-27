import { evaluateBaseFast, evaluateFreeFast, LINE_COUNT, REELS, ROWS } from './evaluate.ts';
import { drawMystery, fillGrid, spinStops, type Machine } from './machine.ts';
import { createRng, type Rng } from './rng.ts';
import { PAYS } from './symbols.ts';

export interface SimulationParams {
  /** Paid spins. Each one includes its whole free-game round, if triggered. */
  spins: number;
  /** Cents, multiple of 5. */
  bet: number;
  /** Cents. */
  startBalance: number;
  seed: number;
  /** Points kept for the balance chart. */
  chartPoints?: number;
}

export interface BalancePoint {
  spin: number;
  min: number;
  max: number;
  close: number;
}

export interface SimulationResult {
  spins: number;
  seed: number;
  totalBet: number;
  totalWin: number;
  rtp: number;
  /** Half-width of the 95% confidence interval of the RTP. */
  rtpCi95: number;
  baseRtp: number;
  freeGameRtp: number;
  /** Paid spins with a line win or a trigger. */
  hitFrequency: number;
  ldwCount: number;
  mysteryWins: number;
  triggers: number;
  retriggers: number;
  freeGamesPlayed: number;
  /** Largest single result (spin plus its round) in multiples of the bet. */
  maxWinX: number;
  maxWinSpin: number;
  /** Largest single free-game round in multiples of the bet. */
  maxRoundX: number;
  finalBalance: number;
  peakBalance: number;
  lowBalance: number;
  /** Largest fall from a running peak, in cents. */
  maxDrawdown: number;
  /** First spin after which the balance could no longer cover the bet, or null. */
  bustSpin: number | null;
  curve: BalancePoint[];
  elapsedMs: number;
}

/** Adds the drawn mystery prize to a fast evaluation (out[0] = mystery multiplier sum). */
function settle(regular: number, out: Int32Array, rng: Rng): number {
  return out[0] > 0 ? regular + out[0] * PAYS[drawMystery(rng)] : regular;
}

/**
 * Monte Carlo over paid spins. Accounting is done in line-bet units and converted to cents
 * at the end, so there is no floating-point drift on money.
 */
export function simulate(
  machine: Machine,
  params: SimulationParams,
  onProgress?: (done: number) => void,
): SimulationResult {
  const { spins, bet, startBalance, seed } = params;
  if (!Number.isInteger(spins) || spins <= 0) throw new RangeError('spins must be a positive integer');
  if (!Number.isInteger(bet) || bet <= 0 || bet % LINE_COUNT !== 0) throw new RangeError('bet must be a multiple of 5 cents');

  const started = Date.now();
  const rng = createRng(seed);
  const lineBet = bet / LINE_COUNT;
  const stops = new Int32Array(REELS);
  const grid = new Int8Array(REELS * ROWS);
  const out = new Int32Array(2);
  const award = machine.freeGames.award;

  let baseUnits = 0;
  let freeUnits = 0;
  let sumSq = 0;
  let hits = 0;
  let ldw = 0;
  let mysteryWins = 0;
  let triggers = 0;
  let retriggers = 0;
  let freeGamesPlayed = 0;
  let maxUnits = 0;
  let maxSpin = 0;
  let maxRoundUnits = 0;

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
    const regular = evaluateBaseFast(grid, out, machine.rules);
    if (out[0] > 0) mysteryWins++;
    const triggered = out[1] === 1;
    const units = settle(regular, out, rng);
    let spinUnits = units;
    baseUnits += units;
    if (units > 0 || triggered) hits++;
    if (units > 0 && units < LINE_COUNT) ldw++;

    if (triggered) {
      triggers++;
      let left = award;
      let roundUnits = 0;
      while (left > 0) {
        left--;
        freeGamesPlayed++;
        spinStops(machine.free, rng, stops);
        fillGrid(machine.free.strips, stops, grid);
        const freeRegular = evaluateFreeFast(grid, out);
        const retriggered = out[1] === 1;
        roundUnits += settle(freeRegular, out, rng);
        if (retriggered) {
          retriggers++;
          left += award;
        }
      }
      freeUnits += roundUnits;
      spinUnits += roundUnits;
      if (roundUnits > maxRoundUnits) maxRoundUnits = roundUnits;
    }

    // Per-spin return in bet multiples, for the confidence interval.
    const x = spinUnits / LINE_COUNT;
    sumSq += x * x;
    if (spinUnits > maxUnits) {
      maxUnits = spinUnits;
      maxSpin = i;
    }

    balance += spinUnits * lineBet - bet;
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

  const totalUnits = baseUnits + freeUnits;
  const rtp = totalUnits / LINE_COUNT / spins;
  const variance = Math.max(0, sumSq / spins - rtp * rtp);

  return {
    spins,
    seed,
    totalBet: bet * spins,
    totalWin: totalUnits * lineBet,
    rtp,
    rtpCi95: 1.96 * Math.sqrt(variance / spins),
    baseRtp: baseUnits / LINE_COUNT / spins,
    freeGameRtp: freeUnits / LINE_COUNT / spins,
    hitFrequency: hits / spins,
    ldwCount: ldw,
    mysteryWins,
    triggers,
    retriggers,
    freeGamesPlayed,
    maxWinX: maxUnits / LINE_COUNT,
    maxWinSpin: maxSpin,
    maxRoundX: maxRoundUnits / LINE_COUNT,
    finalBalance: balance,
    peakBalance: peak,
    lowBalance: low,
    maxDrawdown,
    bustSpin,
    curve,
    elapsedMs: Date.now() - started,
  };
}
