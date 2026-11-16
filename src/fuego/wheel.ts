import type { Rng } from '../engine/rng.ts';

export type SectorKind = 'multiplier' | 'free';

export interface Sector {
  kind: SectorKind;
  /** Multiplier of the total bet, or number of free spins. */
  value: number;
  /** Chance weight. The drawn sectors are all the same size; the real odds are these weights. */
  weight: number;
}

/**
 * The 8 sectors clockwise from the top, as in the original: prizes and free spins alternate,
 * and "10 free spins" appears twice. The values are the original's; the weights are ours (the
 * original does not publish them; three of four wheels seen in its demo landed on x30).
 */
export const WHEEL_SECTORS: readonly Sector[] = [
  { kind: 'multiplier', value: 100, weight: 3 },
  { kind: 'free', value: 10, weight: 10 },
  { kind: 'multiplier', value: 50, weight: 14 },
  { kind: 'free', value: 15, weight: 7 },
  { kind: 'multiplier', value: 80, weight: 5 },
  { kind: 'free', value: 10, weight: 10 },
  { kind: 'multiplier', value: 30, weight: 48 },
  { kind: 'free', value: 20, weight: 3 },
];

export const WHEEL_TOTAL_WEIGHT = WHEEL_SECTORS.reduce((s, x) => s + x.weight, 0);

/** Index of the sector the wheel stops on. */
export function pickSector(rng: Rng): number {
  let roll = rng.int(WHEEL_TOTAL_WEIGHT);
  for (let i = 0; i < WHEEL_SECTORS.length; i++) {
    roll -= WHEEL_SECTORS[i].weight;
    if (roll < 0) return i;
  }
  return WHEEL_SECTORS.length - 1;
}

export function sectorProbability(index: number): number {
  return WHEEL_SECTORS[index].weight / WHEEL_TOTAL_WEIGHT;
}

/** Expected wheel prize in multiples of the bet, given the expected win of one free spin. */
export function wheelValue(freeSpinValue: number): number {
  return WHEEL_SECTORS.reduce((s, x) => s + sectorProbability(WHEEL_SECTORS.indexOf(x)) * (x.kind === 'multiplier' ? x.value : x.value * freeSpinValue), 0);
}

export function sectorLabel(s: Sector): string {
  return s.kind === 'multiplier' ? `x${s.value}` : `${s.value} giros gratis`;
}
