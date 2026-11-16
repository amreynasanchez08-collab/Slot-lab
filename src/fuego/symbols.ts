// Fuego 27: our own 3x3, 27-ways fruit game with a mystery wheel, in the style of
// 27 Eternal Hot (Amusnet). Rules and pays follow the original's info screen; art and name are ours.
export const CHERRY = 0;
export const LEMON = 1;
export const ORANGE = 2;
export const PLUM = 3;
export const MELON = 4;
export const PEAR = 5;
export const GRAPES = 6;
export const BELL = 7;
export const SEVEN = 8;
/** Substitutes every symbol except the wheel, and pays on its own. */
export const WILD = 9;
/** Wheel scatter: one on each reel, anywhere, spins the mystery wheel. */
export const WHEEL = 10;

export const SYMBOL_COUNT = 11;

export const SYMBOL_NAMES: readonly string[] = [
  'Cereza',
  'Limón',
  'Naranja',
  'Ciruela',
  'Sandía',
  'Pera',
  'Uvas',
  'Campana',
  'Siete',
  'Comodín',
  'Rueda',
];

/** Three of a kind on one way, in multiples of the total bet (the wheel pays nothing itself). */
export const PAYS: readonly number[] = [2, 2, 2, 4, 4, 10, 10, 30, 30, 50, 0];
