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
  PLUM,
  SEVEN,
} from './symbols.ts';

const [CH, LE, OR, PL, BE, ME, SE, BO] = [CHERRY, LEMON, ORANGE, PLUM, BELL, MELON, SEVEN, BONUS];
const DANCER = [DANCER_HEAD, DANCER_TORSO, DANCER_LEGS];

const stacked = (order: number[]): number[] => [...order.flatMap((s) => [s, s, s]), ...DANCER];

/**
 * Base game: every symbol comes in stacks of three, plus one dancer (head, torso, legs).
 * The symbol at a stop sits in the middle row and its neighbours fill the top and bottom
 * rows, so the stop on the torso shows the complete dancer. Stacks make the weight of a
 * symbol count in all three rows, which is what lets the fruits carry the base RTP.
 */
export const BASE_STRIPS: readonly (readonly number[])[] = [
  stacked([CH, BO, LE, SE, OR, BE, PL, ME]),
  stacked([LE, ME, CH, BO, PL, SE, OR, BE]),
  stacked([OR, BE, SE, CH, ME, LE, BO, PL]),
];

/**
 * Free games: a separate reel set, as real games use. No stacks, so "three anywhere" has to
 * come from different reels, and one dancer per reel for wilds and retriggers.
 */
export const FREE_STRIPS: readonly (readonly number[])[] = [
  [CH, LE, OR, PL, CH, BE, LE, ME, OR, CH, SE, LE, PL, OR, BO, CH, LE, ...DANCER, OR, PL, CH, BE, LE, ME, OR, PL],
  [LE, CH, PL, OR, LE, ME, CH, BE, PL, LE, OR, SE, CH, PL, LE, BO, OR, CH, ...DANCER, LE, OR, BE, CH, PL, ME, OR],
  [OR, PL, CH, LE, OR, BE, PL, CH, ME, LE, OR, CH, SE, PL, LE, OR, BO, CH, PL, ...DANCER, LE, CH, OR, ME, BE, LE],
];

/**
 * Base-game fruit weights (index = symbol id). BONUS is left at 0: the tuner sets it, since
 * the mystery prize is the lever that moves the base RTP. Cherries lead so small wins come
 * often; every other fruit keeps a visible share.
 */
export const BASE_FRUIT_WEIGHTS: readonly number[] = [120, 40, 25, 15, 12, 8, 6, 0];

/** Free-game fruit weights: all symbols equally likely. */
export const FREE_FRUIT_WEIGHTS: readonly number[] = [10, 10, 10, 10, 10, 10, 10, 10];

/**
 * Free-game dancer: weight share of each dancer stop. Kept rare on purpose: with wins
 * anywhere, one dancer completes every pair on the screen and multiplies it, so each 0.001
 * of share adds roughly 0.6x the bet to the average free game. At 0.001 a round averages
 * ~50x the bet; retriggers (three complete dancers) stay possible but very rare.
 */
export const FREE_DANCER_SHARE = 0.001;

/** Integer resolution of the weights. */
export const WEIGHT_SCALE = 100;
