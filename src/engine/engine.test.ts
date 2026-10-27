import { describe, expect, it } from 'vitest';
import { evaluateBase, evaluateBaseFast, evaluateFree, evaluateFreeFast, evaluateLine } from './evaluate.ts';
import { analyzeMachine, buildReelSet, tune, type Machine } from './machine.ts';
import { createRng } from './rng.ts';
import { newSession, playSpin } from './session.ts';
import { simulate } from './simulate.ts';
import {
  BELL,
  BONUS,
  CHERRY,
  DANCER_HEAD,
  DANCER_LEGS,
  DANCER_TORSO,
  LEMON,
  MELON,
  ORANGE,
  PAYS,
  PLUM,
  SEVEN,
} from './symbols.ts';

const [DH, DT, DL] = [DANCER_HEAD, DANCER_TORSO, DANCER_LEGS];
const WILD = { baseWild: true, baseMultiplier: true };
const out = new Int32Array(2);

describe('evaluateLine', () => {
  it('pays three of a kind with multiplier 1', () => {
    expect(evaluateLine(CHERRY, CHERRY, CHERRY, out)).toBe(CHERRY);
    expect(out[0]).toBe(1);
  });
  it('multiplies the dancer parts it uses: head x3, torso x2, legs x1', () => {
    expect(evaluateLine(DH, MELON, DT, out)).toBe(MELON);
    expect(out[0]).toBe(6);
    expect(evaluateLine(SEVEN, DL, SEVEN, out)).toBe(SEVEN);
    expect(out[0]).toBe(1);
  });
  it('lets dancers complete the mystery bonus', () => {
    expect(evaluateLine(BONUS, DH, BONUS, out)).toBe(BONUS);
    expect(out[0]).toBe(3);
  });
  it('pays nothing for dancers alone or mixed symbols', () => {
    expect(evaluateLine(DH, DT, DL, out)).toBe(-1);
    expect(evaluateLine(CHERRY, LEMON, CHERRY, out)).toBe(-1);
  });
  it('treats dancers as blockers when the base rule turns the wild off', () => {
    expect(evaluateLine(CHERRY, DH, CHERRY, out, false, false)).toBe(-1);
  });
});

// grid[reel * 3 + row]
const fullDancers = [DH, DT, DL, DH, DT, DL, DH, DT, DL];

describe('base game', () => {
  it('triggers free games only with the complete dancer on all three reels', () => {
    expect(evaluateBase(fullDancers).trigger).toBe(true);
    const partial = [DH, DT, DL, DH, DT, DL, DT, DL, CHERRY];
    const r = evaluateBase(partial);
    expect(r.trigger).toBe(false);
    expect(r.nearMisses).toContainEqual({ line: null, kind: 'dancers' });
  });
  it('pays only on the five lines', () => {
    // Three cherries in one column is not a line.
    const grid = [CHERRY, CHERRY, CHERRY, LEMON, ORANGE, PLUM, BELL, LEMON, ORANGE];
    expect(evaluateBase(grid).wins).toEqual([]);
    const row = [CHERRY, LEMON, ORANGE, CHERRY, PLUM, BELL, CHERRY, ORANGE, LEMON];
    expect(evaluateBase(row).wins.map((w) => w.line)).toEqual([1]);
  });
  it('sums mystery multipliers separately from regular units', () => {
    const grid = [BONUS, CHERRY, LEMON, DH, CHERRY, ORANGE, BONUS, CHERRY, PLUM];
    const r = evaluateBase(grid, WILD);
    expect(r.mysteryMultiplier).toBe(3); // top line: BONUS, head x3, BONUS
    expect(r.regularUnits).toBe(PAYS[CHERRY]); // middle line
    expect(evaluateBaseFast(grid, out, WILD)).toBe(r.regularUnits);
    expect(out[0]).toBe(r.mysteryMultiplier);
  });
});

describe('free games', () => {
  it('pays three or more of a symbol anywhere, once per symbol', () => {
    const grid = [CHERRY, LEMON, ORANGE, PLUM, CHERRY, BELL, MELON, SEVEN, CHERRY];
    const r = evaluateFree(grid);
    expect(r.wins.map((w) => w.symbol)).toEqual([CHERRY]);
    expect(r.regularUnits).toBe(PAYS[CHERRY]);
  });
  it('completes pairs with the best dancers and multiplies by the ones used', () => {
    // Two sevens + head (x3); one melon needs two dancers: head x3 * torso x2.
    const grid = [SEVEN, SEVEN, MELON, DH, DT, LEMON, ORANGE, PLUM, BELL];
    const r = evaluateFree(grid);
    const seven = r.wins.find((w) => w.symbol === SEVEN);
    const melon = r.wins.find((w) => w.symbol === MELON);
    expect(seven?.multiplier).toBe(3);
    expect(melon?.multiplier).toBe(6);
    expect(r.regularUnits).toBe(PAYS[SEVEN] * 3 + PAYS[MELON] * 6 + 4 * 3 * 2 + 6 * 6 + 8 * 6 + 20 * 6);
    expect(evaluateFreeFast(grid, out)).toBe(r.regularUnits);
  });
  it('retriggers with three complete dancers', () => {
    expect(evaluateFree(fullDancers).trigger).toBe(true);
    expect(evaluateFree(fullDancers).wins).toEqual([]);
  });
});

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(7);
    const b = createRng(7);
    for (let i = 0; i < 100; i++) expect(a.nextU32()).toBe(b.nextU32());
  });
  it('draws integers uniformly', () => {
    const rng = createRng(99);
    const counts = new Array(6).fill(0);
    const n = 600_000;
    for (let i = 0; i < n; i++) counts[rng.int(6)]++;
    for (const c of counts) expect(Math.abs(c - n / 6)).toBeLessThan(5 * Math.sqrt(n / 6));
  });
});

describe('tuning', () => {
  it('hits the RTP and bonus frequency targets', () => {
    for (const target of [{ rtp: 0.92, bonusEvery: 150 }, { rtp: 0.95, bonusEvery: 120 }, { rtp: 0.95, bonusEvery: 180 }]) {
      const r = tune(target);
      expect(r.reachable).toBe(true);
      expect(Math.abs(r.analysis.rtp - target.rtp)).toBeLessThan(0.0005);
      expect(Math.abs(1 / r.analysis.triggerProbability - target.bonusEvery) / target.bonusEvery).toBeLessThan(0.01);
    }
  });
  it('keeps the RTP split and the average round inside the design ranges at 1 in 150', () => {
    const a = tune({ rtp: 0.95, bonusEvery: 150 }).analysis;
    expect(a.freeGameRtp / a.rtp).toBeGreaterThan(0.25);
    expect(a.freeGameRtp / a.rtp).toBeLessThan(0.4);
    expect(a.expectedRoundWin).toBeGreaterThan(30);
    expect(a.expectedRoundWin).toBeLessThan(60);
  });
});

describe('simulation', () => {
  it('converges to the theoretical figures', () => {
    const { machine, analysis } = tune({ rtp: 0.95, bonusEvery: 150 });
    const s = simulate(machine, { spins: 400_000, bet: 100, startBalance: 100_000, seed: 2024 });
    // About four standard errors: stable with a fixed seed, still catches real math errors.
    expect(Math.abs(s.rtp - analysis.rtp)).toBeLessThan(2 * s.rtpCi95);
    expect(Math.abs(s.hitFrequency - analysis.hitFrequency)).toBeLessThan(0.004);
    const triggerRate = s.triggers / s.spins;
    expect(Math.abs(triggerRate - analysis.triggerProbability) / analysis.triggerProbability).toBeLessThan(0.08);
  });
  it('balances the money exactly', () => {
    const { machine } = tune({ rtp: 0.95, bonusEvery: 150 });
    const s = simulate(machine, { spins: 50_000, bet: 25, startBalance: 5_000, seed: 1 });
    expect(s.finalBalance).toBe(5_000 + s.totalWin - s.totalBet);
    expect(Number.isInteger(s.finalBalance)).toBe(true);
  });
});

/** A machine whose every spin shows the given 3x3 windows (one-stop strips). */
function fixedMachine(baseGrid: number[], freeGrid: number[], award = 15): Machine {
  const strips = (g: number[]) => [0, 1, 2].map((r) => [g[r * 3 + 1], g[r * 3 + 2], g[r * 3]]);
  // With strip [mid, bottom, top] and stop 0, fillGrid shows top=strip[-1], mid, bottom.
  const one = [[1, 0, 0], [1, 0, 0], [1, 0, 0]];
  return {
    base: buildReelSet(strips(baseGrid), one),
    free: buildReelSet(strips(freeGrid), one),
    freeGames: { award },
    rules: { baseWild: false, baseMultiplier: false },
  };
}

describe('session', () => {
  it('charges paid spins, not free games, and accumulates retriggers', () => {
    const m = fixedMachine(fullDancers, fullDancers);
    const rng = createRng(3);
    let step = playSpin(m, newSession(1_000, 100), rng);
    expect(step.outcome.charged).toBe(100);
    expect(step.outcome.awarded).toBe(15);
    expect(step.state.freeGamesLeft).toBe(15);

    step = playSpin(m, step.state, rng);
    expect(step.outcome.isFreeGame).toBe(true);
    expect(step.outcome.charged).toBe(0);
    expect(step.outcome.retrigger).toBe(true);
    expect(step.state.freeGamesLeft).toBe(15 - 1 + 15);
    expect(step.state.balance).toBe(900);
  });

  it('plays free games on the free reels with anywhere wins', () => {
    const freeGrid = [CHERRY, LEMON, ORANGE, PLUM, CHERRY, BELL, MELON, SEVEN, CHERRY];
    const m = fixedMachine(fullDancers, freeGrid);
    const rng = createRng(4);
    let step = playSpin(m, newSession(1_000, 100), rng);
    step = playSpin(m, step.state, rng);
    // Three cherries anywhere = 2 line-bet units = $0.40 on a $1 bet.
    expect(step.outcome.win).toBe(40);
    expect(step.state.roundWin).toBe(40);
  });

  it('flags losses disguised as wins on paid spins', () => {
    const row = [CHERRY, CHERRY, LEMON, ORANGE, CHERRY, PLUM, BELL, CHERRY, LEMON];
    const m = fixedMachine(row, row);
    const step = playSpin(m, newSession(1_000, 100), createRng(1));
    expect(step.outcome.win).toBe(40);
    expect(step.outcome.ldw).toBe(true);
  });

  it('rejects bets that are not a multiple of 5 cents', () => {
    expect(() => newSession(1_000, 12)).toThrow();
  });

  it('reports the same analysis as the tuner', () => {
    const r = tune({ rtp: 0.95, bonusEvery: 150 });
    expect(analyzeMachine(r.machine).rtp).toBe(r.analysis.rtp);
  });
});
