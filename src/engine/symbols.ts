// Symbol ids are small integers so the evaluator and the simulator can stay allocation-free.
export const CHERRY = 0;
export const LEMON = 1;
export const ORANGE = 2;
export const PLUM = 3;
export const BELL = 4;
export const MELON = 5;
export const SEVEN = 6;
/** Mystery symbol: three on a win pay a random prize from the paytable. */
export const BONUS = 7;
/**
 * The dancer is a wild three cells tall, stored on the strip as three consecutive parts.
 * Each part carries its own multiplier: head x3, torso x2, legs x1.
 */
export const DANCER_HEAD = 8;
export const DANCER_TORSO = 9;
export const DANCER_LEGS = 10;

export const SYMBOL_COUNT = 11;
/** Symbols that can form a prize (everything except the dancer parts). */
export const PAYING_SYMBOLS = 8;

export function isDancer(sym: number): boolean {
  return sym >= DANCER_HEAD;
}

/** Multiplier carried by each symbol: dancer parts 3/2/1, everything else 1. */
export const MULTIPLIER: readonly number[] = [1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 1];

export const SYMBOL_NAMES: readonly string[] = [
  'Cereza',
  'Limón',
  'Naranja',
  'Ciruela',
  'Campana',
  'Melón',
  'Siete',
  'Bonus misterioso',
  'Bailarina (cabeza x3)',
  'Bailarina (torso x2)',
  'Bailarina (piernas x1)',
];

/** Three-of-a-kind pays, in multiples of the line bet (total bet / 5). BONUS pays a mystery prize. */
export const PAYS: readonly number[] = [2, 4, 6, 8, 20, 60, 100, 0, 0, 0, 0];

/** Prizes a mystery BONUS can reveal: any regular paytable symbol, equally likely. */
export const MYSTERY_SYMBOLS: readonly number[] = [CHERRY, LEMON, ORANGE, PLUM, BELL, MELON, SEVEN];

export const MYSTERY_MEAN_PAY = MYSTERY_SYMBOLS.reduce((s, sym) => s + PAYS[sym], 0) / MYSTERY_SYMBOLS.length;
