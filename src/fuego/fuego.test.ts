import { describe, expect, it } from 'vitest';
import { createRng } from '../engine/rng.ts';
import { evaluate, evaluateFast, evaluateWay } from './evaluate.ts';
import { analyzeMachine, BASE_STRIPS, buildReelSet, FREE_STRIPS, tune, type Machine } from './machine.ts';
import { BET_LEVELS, canGamble, gamble, GAMBLE_LIMIT_X, MAX_GAMBLES, newSession, playSpin, setBet, spinWheel, stepBet } from './session.ts';
import { simulateFuego } from './simulate.ts';
import { BELL, CHERRY, GRAPES, LEMON, MELON, ORANGE, PAYS, PEAR, PLUM, SEVEN, WHEEL, WILD } from './symbols.ts';
import { WHEEL_SECTORS, wheelValue } from './wheel.ts';

const [CH, LE, OR, PL, ME, PE, GR, BE, SE, WI, WH] = [CHERRY, LEMON, ORANGE, PLUM, MELON, PEAR, GRAPES, BELL, SEVEN, WILD, WHEEL];

describe('evaluateWay', () => {
  it('pays three of a kind in multiples of the total bet', () => {
    expect(evaluateWay(CH, CH, CH)).toBe(2);
    expect(evaluateWay(SE, SE, SE)).toBe(30);
    expect(evaluateWay(CH, LE, CH)).toBe(0);
  });
  it('lets the wild stand for any symbol, and three wilds pay 50', () => {
    expect(evaluateWay(WI, SE, SE)).toBe(30);
    expect(evaluateWay(GR, WI, WI)).toBe(10);
    expect(evaluateWay(WI, WI, WI)).toBe(50);
  });
  it('never pays a way through a wheel', () => {
    expect(evaluateWay(WH, WH, WH)).toBe(0);
    expect(evaluateWay(WI, WH, WI)).toBe(0);
  });
});

describe('ways', () => {
  it('pays every way: three full reels of one fruit pay 27 ways', () => {
    const grid = new Array(9).fill(CH);
    const ev = evaluate(grid);
    expect(ev.multiplier).toBe(27 * PAYS[CH]);
    expect(ev.wins).toEqual([{ symbol: CH, ways: 27, pay: 54, cells: [0, 1, 2, 3, 4, 5, 6, 7, 8] }]);
  });
  it('counts the same symbol twice on a reel as two ways', () => {
    // grid[reel * 3 + row]
    const grid = [PL, PL, LE, PL, OR, ME, OR, PL, BE];
    const ev = evaluate(grid);
    expect(ev.wins).toHaveLength(1);
    expect(ev.wins[0]).toMatchObject({ symbol: PL, ways: 2, pay: 8 });
    expect(evaluateFast(grid, new Int32Array(1))).toBe(8);
  });
  it('triggers the wheel with one on every reel, anywhere', () => {
    const grid = [WH, CH, LE, OR, OR, WH, PE, WH, GR];
    const ev = evaluate(grid);
    expect(ev.trigger).toBe(true);
    expect(ev.wheelCells).toEqual([0, 5, 7]);
    const out = new Int32Array(1);
    evaluateFast(grid, out);
    expect(out[0]).toBe(3);
    expect(evaluate([WH, CH, LE, OR, OR, WH, PE, ME, GR]).nearMiss).toBe(true);
  });
});

describe('reels', () => {
  it('never shows two wheels on one reel', () => {
    for (const s of BASE_STRIPS) {
      s.forEach((sym, i) => {
        if (sym === WH) expect([s[(i + 1) % s.length], s[(i + 2) % s.length]]).not.toContain(WH);
      });
    }
  });
  it('keeps wheels off the free-spin reels', () => {
    for (const s of FREE_STRIPS) expect(s).not.toContain(WH);
  });
});

describe('tuning', () => {
  it('hits the RTP and wheel frequency targets', () => {
    for (const target of [{ rtp: 0.9637, wheelEvery: 150 }, { rtp: 0.94, wheelEvery: 200 }, { rtp: 0.97, wheelEvery: 250 }]) {
      const r = tune(target);
      expect(r.reachable).toBe(true);
      expect(Math.abs(r.analysis.rtp - target.rtp)).toBeLessThan(0.0005);
      expect(Math.abs(1 / r.analysis.triggerProbability - target.wheelEvery) / target.wheelEvery).toBeLessThan(0.01);
    }
  });
  it('reports the wheel value from the sectors and the free-spin value', () => {
    const a = tune({ rtp: 0.9637, wheelEvery: 150 }).analysis;
    expect(a.wheelValue).toBeCloseTo(wheelValue(a.freeSpinValue), 10);
    expect(a.wheelRtp).toBeCloseTo(a.triggerProbability * a.wheelValue, 12);
    expect(a.freeSpinValue).toBeGreaterThan(2);
    expect(a.freeSpinValue).toBeLessThan(10);
  });
});

describe('simulation', () => {
  it('converges to the theoretical figures', () => {
    const { machine, analysis } = tune({ rtp: 0.9637, wheelEvery: 150 });
    const s = simulateFuego(machine, { spins: 400_000, bet: 100, startBalance: 100_000, seed: 27 });
    expect(Math.abs(s.rtp - analysis.rtp)).toBeLessThan(2 * s.rtpCi95);
    expect(Math.abs(s.baseRtp - analysis.baseRtp)).toBeLessThan(0.02);
    expect(Math.abs(s.hitFrequency - analysis.baseHitFrequency)).toBeLessThan(0.004);
    expect(Math.abs(s.wheels / s.spins - analysis.triggerProbability) / analysis.triggerProbability).toBeLessThan(0.08);
  });
  it('balances the money exactly', () => {
    const { machine } = tune({ rtp: 0.9637, wheelEvery: 150 });
    const s = simulateFuego(machine, { spins: 50_000, bet: 30, startBalance: 5_000, seed: 1 });
    expect(s.finalBalance).toBe(5_000 + s.totalWin - s.totalBet);
    expect(Number.isInteger(s.finalBalance)).toBe(true);
  });
});

/** A machine whose every spin shows the given 3x3 windows (one-stop strips). */
function fixedMachine(baseGrid: number[], freeGrid: number[]): Machine {
  const strips = (g: number[]) => [0, 1, 2].map((r) => [g[r * 3 + 1], g[r * 3 + 2], g[r * 3]]);
  const one = [[1, 0, 0], [1, 0, 0], [1, 0, 0]];
  return { base: buildReelSet(strips(baseGrid), one), free: buildReelSet(strips(freeGrid), one) };
}

const triggerGrid = [WH, CH, CH, LE, WH, OR, PE, GR, WH];
const sector = (kind: 'multiplier' | 'free', value: number) => WHEEL_SECTORS.findIndex((s) => s.kind === kind && s.value === value);

describe('session', () => {
  it('charges paid spins, holds the trigger win and waits for the wheel', () => {
    const grid = [CH, CH, WH, CH, WH, LE, CH, OR, WH];
    const m = fixedMachine(grid, grid);
    const step = playSpin(m, newSession(1_000, 100), createRng(1));
    expect(step.outcome.charged).toBe(100);
    expect(step.outcome.trigger).toBe(true);
    // Cherries: 2 x 1 x 1 ways at 2x.
    expect(step.outcome.win).toBe(400);
    expect(step.state.wheelPending).toBe(true);
    expect(() => playSpin(m, step.state, createRng(1))).toThrow();
    expect(canGamble(step.state)).toBe(false);
  });

  it('pays a multiplier sector at the triggering bet, after collecting the trigger win', () => {
    const m = fixedMachine(triggerGrid, triggerGrid);
    const step = playSpin(m, newSession(1_000, 100), createRng(2));
    const wheel = spinWheel(step.state, createRng(3), sector('multiplier', 30));
    expect(wheel.outcome.win).toBe(3_000);
    expect(wheel.state.pendingWin).toBe(3_000);
    expect(wheel.state.balance).toBe(900 + step.outcome.win);
  });

  it('plays free spins on the free reels at the triggering bet, then holds the round total', () => {
    const freeGrid = [CH, LE, OR, CH, PL, ME, CH, PE, GR];
    const m = fixedMachine(triggerGrid, freeGrid);
    let state = playSpin(m, newSession(1_000, 100), createRng(4)).state;
    state = spinWheel(state, createRng(5), sector('free', 10)).state;
    expect(state.freeSpinsLeft).toBe(10);
    // The bet cannot change during the round.
    expect(() => setBet(state, 500)).toThrow();
    let last = null;
    for (let i = 0; i < 10; i++) {
      const step = playSpin(m, state, createRng(6 + i));
      expect(step.outcome.isFreeSpin).toBe(true);
      expect(step.outcome.charged).toBe(0);
      expect(step.outcome.win).toBe(200);
      state = step.state;
      last = step.outcome;
    }
    expect(last?.roundOver).toBe(true);
    expect(state.freeSpinsLeft).toBe(0);
    expect(state.pendingWin).toBe(2_000);
    expect(state.balance).toBe(900);
  });

  it('gambles only wins up to the limit and at most MAX_GAMBLES times', () => {
    const state = { ...newSession(10_000, 100), pendingWin: 400, winBet: 100 };
    expect(canGamble(state)).toBe(true);
    expect(canGamble({ ...state, pendingWin: GAMBLE_LIMIT_X * 100 + 100 })).toBe(false);
    expect(canGamble({ ...state, gamblesUsed: MAX_GAMBLES })).toBe(false);
    // Find seeds for a win and a loss without assuming the rng's output.
    let won: ReturnType<typeof gamble> | null = null;
    let lost: ReturnType<typeof gamble> | null = null;
    for (let seed = 0; seed < 50 && (!won || !lost); seed++) {
      const r = gamble(state, 'red', createRng(seed));
      if (r.won) won = r;
      else lost = r;
    }
    expect(won).not.toBeNull();
    expect(lost).not.toBeNull();
    expect(won?.state.pendingWin).toBe(800);
    expect(lost?.state.pendingWin).toBe(0);
    // A double that goes over the limit is collected.
    const near = { ...state, pendingWin: 3_000 };
    let doubled = false;
    for (let seed = 0; seed < 50 && !doubled; seed++) {
      const r = gamble(near, 'red', createRng(seed));
      if (r.won) {
        doubled = true;
        expect(r.collected).toBe(6_000);
        expect(r.state.balance).toBe(16_000);
      }
    }
    expect(doubled).toBe(true);
  });

  it('rejects bets that are not a multiple of 10 cents', () => {
    expect(() => newSession(1_000, 15)).toThrow();
  });

  it('reports the same analysis as the tuner', () => {
    const r = tune({ rtp: 0.9637, wheelEvery: 150 });
    expect(analyzeMachine(r.machine).rtp).toBe(r.analysis.rtp);
  });
});

describe('bet ladder', () => {
  it('holds only valid bets, in rising order', () => {
    for (const bet of BET_LEVELS) expect(bet % 10).toBe(0);
    expect([...BET_LEVELS].sort((x, y) => x - y)).toEqual(BET_LEVELS);
  });
  it('steps up and down and stops at the ends', () => {
    expect(stepBet(100, 1)).toBe(200);
    expect(stepBet(100, -1)).toBe(50);
    expect(stepBet(10, -1)).toBe(10);
    expect(stepBet(5_000, 1)).toBe(5_000);
    expect(stepBet(9_000, -1)).toBe(5_000);
  });
});

describe('exact analysis against brute force', () => {
  /** Independent evaluator: pay of one way, written from the rules without the engine's code. */
  const wayPay = (x: number, y: number, z: number): number => {
    const syms = [x, y, z];
    if (syms.includes(WH)) return 0;
    if (syms.every((s) => s === WI)) return PAYS[WI];
    const target = syms.find((s) => s !== WI) as number;
    return syms.every((s) => s === target || s === WI) ? PAYS[target] : 0;
  };
  /** Walks every weighted stop combination of a reel set. */
  const enumerate = (strips: readonly (readonly number[])[], weights: readonly (readonly number[])[]) => {
    const totals = weights.map((w) => w.reduce((a, b) => a + b, 0));
    const win = (s: readonly number[], stop: number) => [s[(stop - 1 + s.length) % s.length], s[stop], s[(stop + 1) % s.length]];
    let ways = 0;
    let hit = 0;
    let trigger = 0;
    for (let a = 0; a < strips[0].length; a++) {
      const wa = win(strips[0], a);
      const pa = weights[0][a] / totals[0];
      for (let b = 0; b < strips[1].length; b++) {
        const wb = win(strips[1], b);
        const pb = pa * (weights[1][b] / totals[1]);
        for (let c = 0; c < strips[2].length; c++) {
          const wc = win(strips[2], c);
          const p = pb * (weights[2][c] / totals[2]);
          if (p === 0) continue;
          let pay = 0;
          for (const x of wa) for (const y of wb) for (const z of wc) pay += wayPay(x, y, z);
          ways += p * pay;
          if (pay > 0) hit += p;
          if (wa.includes(WH) && wb.includes(WH) && wc.includes(WH)) trigger += p;
        }
      }
    }
    return { ways, hit, trigger };
  };

  it('matches every stop combination of the base and free-spin reels', () => {
    const { machine, analysis } = tune({ rtp: 0.9637, wheelEvery: 150 });
    const base = enumerate(machine.base.strips, machine.base.weights);
    const free = enumerate(machine.free.strips, machine.free.weights);
    expect(Math.abs(base.ways - analysis.baseRtp)).toBeLessThan(1e-9);
    expect(Math.abs(base.hit - analysis.baseHitFrequency)).toBeLessThan(1e-9);
    expect(Math.abs(base.trigger - analysis.triggerProbability)).toBeLessThan(1e-12);
    expect(Math.abs(free.ways - analysis.freeSpinValue)).toBeLessThan(1e-9);
  });
});
