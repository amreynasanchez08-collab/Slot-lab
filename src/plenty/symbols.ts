// Plenty on Twenty hot (Novomatic). Ids 0-6 match the Big Show fruit ids so the same icons serve both games.
export const CHERRY = 0;
export const LEMON = 1;
export const ORANGE = 2;
export const PLUM = 3;
export const BELL = 4;
export const MELON = 5;
/** Wild: substitutes every symbol except the star, and pays on its own. */
export const SEVEN = 6;
/** Scatter: pays anywhere on the screen, as a multiple of the total bet. */
export const STAR = 7;

export const SYMBOL_COUNT = 8;
export const WILD = SEVEN;

export const SYMBOL_NAMES: readonly string[] = ['Cereza', 'Limón', 'Naranja', 'Ciruela', 'Campana', 'Melón', 'Siete (comodín)', 'Estrella (scatter)'];

/**
 * Line pays for 0..5 of a kind from the left, in multiples of the line bet (total bet / 20).
 * Read from the game's paytable screen at 5 credits per line (credits / 5).
 */
export const LINE_PAYS: readonly (readonly number[])[] = [
  [0, 0, 0, 10, 20, 100], // cherry
  [0, 0, 0, 10, 20, 100], // lemon
  [0, 0, 0, 10, 20, 100], // orange
  [0, 0, 0, 20, 40, 200], // plum
  [0, 0, 0, 20, 80, 400], // bell
  [0, 0, 0, 20, 40, 200], // melon
  [0, 0, 0, 40, 400, 1000], // seven
  [0, 0, 0, 0, 0, 0], // star: scatter only
];

/** Star pays for 0..5 anywhere, in multiples of the total bet (500 / 2,000 / 50,000 credits on a 100 bet). */
export const SCATTER_PAYS: readonly number[] = [0, 0, 0, 5, 20, 500];
