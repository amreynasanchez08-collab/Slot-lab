import { STAR } from '../../plenty/symbols.ts';
import { StarIcon, SymbolIcon } from '../SymbolIcon.tsx';

/** One distinct colour per payline. */
export const LINE_COLORS: readonly string[] = Array.from({ length: 20 }, (_, i) => `hsl(${(i * 137.5) % 360} 85% 60%)`);

export const CELL = 84;

export function PlentySymbol({ id, size }: { id: number; size: number }) {
  return id === STAR ? <StarIcon size={size} /> : <SymbolIcon id={id} size={size} />;
}

export const renderPlentySymbol = (sym: number, cell: number) => <PlentySymbol id={sym} size={cell - 22} />;
