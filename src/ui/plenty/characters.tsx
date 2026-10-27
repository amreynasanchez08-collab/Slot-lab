import { BELL, CHERRY, LEMON, MELON, ORANGE, PLUM, SEVEN, STAR, SYMBOL_NAMES } from '../../plenty/symbols.ts';

// 3D cartoon characters generated in Google Flow (Nano Banana 2.1) and approved by Ángel on
// 2026-10-27. Our own designs in the original game's style; each image carries its tile colour.

/** Image per symbol, served from public/plenty (1024x1024 JPEG). */
const IMAGE: Record<number, string> = {
  [CHERRY]: '/plenty/cherry.jpg',
  [LEMON]: '/plenty/lemon.jpg',
  [ORANGE]: '/plenty/orange.jpg',
  [PLUM]: '/plenty/plum.jpg',
  [BELL]: '/plenty/bell.jpg',
  [MELON]: '/plenty/melon.jpg',
  [SEVEN]: '/plenty/seven.jpg',
  [STAR]: '/plenty/star.jpg',
};

/** Tile colour per symbol, matching each image's background; shown while the image loads. */
export const TILE_BACKGROUND: Record<number, string> = {
  [CHERRY]: '#f86a57',
  [LEMON]: '#f7ae00',
  [ORANGE]: '#d04c08',
  [PLUM]: '#5a1f8c',
  [BELL]: '#f0a000',
  [MELON]: '#5e8e16',
  [SEVEN]: '#a50f01',
  [STAR]: '#2458c0',
};

/** Symbol image on its own colour, square; used in the paytable. */
export function Character({ id, size }: { id: number; size: number }) {
  return (
    <img
      src={IMAGE[id]}
      alt={SYMBOL_NAMES[id]}
      width={size}
      height={size}
      draggable={false}
      className="rounded-md object-cover"
      style={{ background: TILE_BACKGROUND[id] }}
    />
  );
}

/** A full reel tile: the image fills the cell, as the original's tiles do. */
export function Tile({ id }: { id: number; cell: number }) {
  return (
    <div className="h-full w-full" style={{ background: TILE_BACKGROUND[id] }}>
      <img src={IMAGE[id]} alt={SYMBOL_NAMES[id]} draggable={false} decoding="async" className="h-full w-full select-none object-cover" />
    </div>
  );
}
