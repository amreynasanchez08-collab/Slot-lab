import type { Rules } from '../engine/evaluate.ts';
import { buildReelSet, type FreeGameConfig } from '../engine/machine.ts';
import { simulate, type SimulationParams, type SimulationResult } from '../engine/simulate.ts';

interface ReelSetData {
  strips: number[][];
  weights: number[][];
}

export interface SimulationRequest {
  base: ReelSetData;
  free: ReelSetData;
  freeGames: FreeGameConfig;
  rules: Rules;
  params: SimulationParams;
}

export type SimulationMessage =
  | { type: 'progress'; done: number }
  | { type: 'done'; result: SimulationResult }
  | { type: 'error'; message: string };

const ctx = self as unknown as {
  postMessage(message: SimulationMessage): void;
  onmessage: ((event: MessageEvent<SimulationRequest>) => void) | null;
};

ctx.onmessage = (event) => {
  try {
    const { base, free, freeGames, rules, params } = event.data;
    const machine = {
      base: buildReelSet(base.strips, base.weights),
      free: buildReelSet(free.strips, free.weights),
      freeGames,
      rules,
    };
    const result = simulate(machine, params, (done) => ctx.postMessage({ type: 'progress', done }));
    ctx.postMessage({ type: 'done', result });
  } catch (err) {
    ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
