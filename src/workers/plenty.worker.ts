import { buildMachine } from '../plenty/machine.ts';
import { simulatePlenty, type PlentySimulationParams, type PlentySimulationResult } from '../plenty/simulate.ts';

export interface PlentySimulationRequest {
  strips: number[][];
  weights: number[][];
  params: PlentySimulationParams;
}

export type PlentySimulationMessage =
  | { type: 'progress'; done: number }
  | { type: 'done'; result: PlentySimulationResult }
  | { type: 'error'; message: string };

const ctx = self as unknown as {
  postMessage(message: PlentySimulationMessage): void;
  onmessage: ((event: MessageEvent<PlentySimulationRequest>) => void) | null;
};

ctx.onmessage = (event) => {
  try {
    const { strips, weights, params } = event.data;
    const result = simulatePlenty(buildMachine(weights, strips), params, (done) => ctx.postMessage({ type: 'progress', done }));
    ctx.postMessage({ type: 'done', result });
  } catch (err) {
    ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
