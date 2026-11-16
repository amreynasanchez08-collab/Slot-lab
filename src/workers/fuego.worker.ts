import { buildReelSet } from '../fuego/machine.ts';
import { simulateFuego, type FuegoSimulationParams, type FuegoSimulationResult } from '../fuego/simulate.ts';

export interface FuegoSimulationRequest {
  base: { strips: number[][]; weights: number[][] };
  free: { strips: number[][]; weights: number[][] };
  params: FuegoSimulationParams;
}

export type FuegoSimulationMessage =
  | { type: 'progress'; done: number }
  | { type: 'done'; result: FuegoSimulationResult }
  | { type: 'error'; message: string };

const ctx = self as unknown as {
  postMessage(message: FuegoSimulationMessage): void;
  onmessage: ((event: MessageEvent<FuegoSimulationRequest>) => void) | null;
};

ctx.onmessage = (event) => {
  try {
    const { base, free, params } = event.data;
    const machine = { base: buildReelSet(base.strips, base.weights), free: buildReelSet(free.strips, free.weights) };
    const result = simulateFuego(machine, params, (done) => ctx.postMessage({ type: 'progress', done }));
    ctx.postMessage({ type: 'done', result });
  } catch (err) {
    ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
