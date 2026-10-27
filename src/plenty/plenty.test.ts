import { describe, expect, it } from 'vitest';
import { createRng } from '../engine/rng.ts';
import { evaluate, evaluateLineSymbols, REELS, ROWS } from './evaluate.ts';
import { analyze, buildMachine, fillGrid, tune } from './machine.ts';
import { gamble, newSession, playSpin } from './session.ts';
import { simulatePlenty } from './simulate.ts';
import { BELL, CHERRY, LEMON, MELON, ORANGE, PLUM, SEVEN, STAR } from './symbols.ts';

const line = (...s: number[]) => evaluateLineSymbols(s);

describe('line evaluation', () => {
  it('pays left-to-right runs of 3, 4 and 5', () => {
    expect(line(CHERRY, CHERRY, CHERRY, LEMON, LEMON)).toBe(10);
    expect(line(BELL, BELL, BELL, BELL, LEMON)).toBe(80);
    expect(line(MELON, MELON, MELON, MELON, MELON)).toBe(200);
    expect(line(LEMON, CHERRY, CHERRY, CHERRY, CHERRY)).toBe(0);
  });
  it('lets the seven substitute and pays only the highest win on a line', () => {
    expect(line(SEVEN, SEVEN, CHERRY, CHERRY, CHERRY)).toBe(100); // cherry x5 beats seven x2 (nothing)
    expect(line(SEVEN, SEVEN, SEVEN, CHERRY, LEMON)).toBe(40); // seven x3 (40) beats cherry x4 (20)
    expect(line(SEVEN, SEVEN, SEVEN, SEVEN, SEVEN)).toBe(1000);
    expect(line(PLUM, SEVEN, PLUM, SEVEN, PLUM)).toBe(200);
  });
  it('never lets the seven complete a star; a star breaks the line', () => {
    expect(line(CHERRY, CHERRY, STAR, CHERRY, CHERRY)).toBe(0);
    expect(line(ORANGE, ORANGE, ORANGE, STAR, ORANGE)).toBe(10);
    expect(line(STAR, STAR, STAR, SEVEN, SEVEN)).toBe(0);
  });
});

describe('scatter', () => {
  it('pays stars anywhere as multiples of the total bet', () => {
    const grid = new Array(REELS * ROWS).fill(LEMON);
    grid[0] = STAR;
    grid[4] = STAR;
    grid[8] = STAR;
    const ev = evaluate(grid);
    expect(ev.stars).toBe(3);
    expect(ev.scatterMultiplier).toBe(5);
  });
});

describe('exact analysis', () => {
  it('matches brute force over every stop combination on small strips', () => {
    const strips = [
      [CHERRY, SEVEN, STAR, LEMON],
      [CHERRY, CHERRY, SEVEN, STAR],
      [STAR, CHERRY, LEMON, SEVEN],
      [SEVEN, CHERRY, STAR, CHERRY],
      [CHERRY, LEMON, SEVEN, STAR],
    ];
    const weights = [[1, 2, 1, 3], [2, 1, 1, 1], [1, 1, 2, 2], [3, 1, 1, 1], [1, 2, 2, 1]];
    const totals = weights.map((w) => w.reduce((a, b) => a + b, 0));
    let expected = 0;
    const grid = new Array<number>(15);
    const stops = [0, 0, 0, 0, 0];
    const visit = (r: number, p: number): void => {
      if (r === REELS) {
        fillGrid(strips, stops, grid);
        const ev = evaluate(grid);
        expected += p * (ev.lineUnits / 20 + ev.scatterMultiplier);
        return;
      }
      for (let s = 0; s < 4; s++) {
        stops[r] = s;
        visit(r + 1, (p * weights[r][s]) / totals[r]);
      }
    };
    visit(0, 1);
    expect(analyze(weights, strips).rtp).toBeCloseTo(expected, 12);
  });

  it('tunes to the published 95.61%', () => {
    const r = tune(0.9561);
    expect(r.reachable).toBe(true);
    expect(Math.abs(r.analysis.rtp - 0.9561)).toBeLessThan(0.0002);
  });

  it('never shows two stars on one reel', () => {
    const { machine } = tune(0.9561);
    for (const strip of machine.strips) {
      const n = strip.length;
      strip.forEach((s, i) => {
        if (s !== STAR) return;
        expect(strip[(i + 1) % n]).not.toBe(STAR);
        expect(strip[(i + 2) % n]).not.toBe(STAR);
      });
    }
  });
});

describe('simulation', () => {
  it('converges to the theoretical RTP', () => {
    const { machine, analysis } = tune(0.9561);
    const s = simulatePlenty(machine, { spins: 300_000, bet: 100, startBalance: 100_000, seed: 31 });
    // About four standard errors: stable with a fixed seed, still catches real math errors.
    expect(Math.abs(s.rtp - analysis.rtp)).toBeLessThan(2 * s.rtpCi95);
    expect(s.finalBalance).toBe(100_000 + s.totalWin - s.totalBet);
    expect(Number.isInteger(s.finalBalance)).toBe(true);
  });
});

describe('session and gamble', () => {
  it('holds a win until it is collected or gambled', () => {
    const allCherries = buildMachine([[1, 1], [1, 1], [1, 1], [1, 1], [1, 1]], [[CHERRY, CHERRY], [CHERRY, CHERRY], [CHERRY, CHERRY], [CHERRY, CHERRY], [CHERRY, CHERRY]]);
    const step = playSpin(allCherries, newSession(1_000, 100), createRng(2));
    // 20 lines x cherry x5 (100) = 2,000 line units = 100x the bet.
    expect(step.outcome.win).toBe(10_000);
    expect(step.state.pendingWin).toBe(10_000);
    expect(step.state.balance).toBe(900);
  });

  it('doubles or loses the pending win at 50/50', () => {
    let wins = 0;
    const rng = createRng(5);
    for (let i = 0; i < 20_000; i++) {
      const r = gamble({ balance: 0, bet: 100, pendingWin: 40, gamblesUsed: 0 }, 'red', rng);
      if (r.won) {
        wins++;
        expect(r.state.pendingWin).toBe(80);
      } else expect(r.state.pendingWin).toBe(0);
    }
    expect(Math.abs(wins / 20_000 - 0.5)).toBeLessThan(0.02);
  });

  it('rejects bets that are not a multiple of 20 cents', () => {
    expect(() => newSession(1_000, 50)).toThrow();
  });
});
