import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const ROWS = 3;
const FILLER = 14;

export interface ReelSpin {
  id: number;
  stops: number[];
  strips: readonly (readonly number[])[];
  /** Window shown before this spin, grid[reel * ROWS + row]. */
  previous: number[];
}

interface ReelsProps {
  /** Window at rest, grid[reel * 3 + row]; its length sets the number of reels. */
  grid: number[];
  spin: ReelSpin | null;
  /** Row per reel for every payline of the game. */
  paylines: readonly (readonly number[])[];
  lineColors: readonly string[];
  /** index is the cell (reel * 3 + row) for the three symbols of the final window, undefined for filler. */
  renderSymbol: (sym: number, cell: number, index?: number) => ReactNode;
  /** Cell size in px (height, and width unless cellWidth is set). */
  cell?: number;
  /** Cell width in px for wide cells (Fuego 27); defaults to cell. */
  cellWidth?: number;
  /**
   * drum: white reel drums shaded like cylinders, symbols on a shared background (Gran Show).
   * tiles: each symbol paints its own full tile (Frutas 20 Hot).
   * Neither draws a frame: the cabinet does.
   */
  variant?: 'drum' | 'tiles';
  /** Paylines to draw once the reels stop. */
  lines: number[];
  /** Cells to ring once the reels stop (anywhere wins, scatters). */
  cells: number[];
  /** Cells that form a win; they pulse once the reels stop. */
  pulse?: number[];
  instant: boolean;
  onStopped: () => void;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Reels({ grid, spin, paylines, lineColors, renderSymbol, cell = 96, cellWidth, variant = 'drum', lines, cells, pulse = [], instant, onStopped }: ReelsProps) {
  const reels = grid.length / ROWS;
  const drum = variant === 'drum';
  const colWidth = cellWidth ?? cell;
  const gap = 10;
  const stride = colWidth + gap;

  const [settled, setSettled] = useState(true);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const onStoppedRef = useRef(onStopped);
  onStoppedRef.current = onStopped;
  // Read through a ref so toggling turbo never replays the last spin.
  const instantRef = useRef(instant);
  instantRef.current = instant;
  const [animatedId, setAnimatedId] = useState<number | null>(null);

  // Column content per reel: final window at the top, strip continuation, previous window at the bottom.
  const columns = Array.from({ length: reels }, (_, r) => {
    if (!spin || animatedId !== spin.id) return [grid[r * ROWS], grid[r * ROWS + 1], grid[r * ROWS + 2]];
    const strip = spin.strips[r];
    const n = strip.length;
    const s = spin.stops[r];
    const seq: number[] = [];
    for (let i = 0; i < FILLER + 3 + r * 4; i++) seq.push(strip[(s - 1 + i + n) % n]);
    seq.push(spin.previous[r * ROWS], spin.previous[r * ROWS + 1], spin.previous[r * ROWS + 2]);
    return seq;
  });

  // Decide once per spin whether it animates; turbo changes later do not affect it.
  useLayoutEffect(() => {
    if (!spin) return;
    if (instantRef.current || prefersReducedMotion()) {
      setAnimatedId(null);
      setSettled(true);
      onStoppedRef.current();
    } else {
      setAnimatedId(spin.id);
      setSettled(false);
    }
  }, [spin]);

  // Layout effect: the animation must start before paint, or the final window flashes first.
  useLayoutEffect(() => {
    if (!spin || animatedId !== spin.id) return;
    let finished = 0;
    const count = columnRefs.current.filter(Boolean).length;
    const animations = columnRefs.current.map((el, r) => {
      if (!el) return null;
      const from = -(el.childElementCount - ROWS) * cell;
      const anim = el.animate([{ transform: `translateY(${from}px)` }, { transform: 'translateY(0px)' }], {
        duration: 650 + r * (reels > 3 ? 200 : 280),
        easing: 'cubic-bezier(0.15, 0.6, 0.25, 1.08)',
        fill: 'forwards',
      });
      anim.onfinish = () => {
        finished++;
        if (finished === count) {
          setSettled(true);
          onStoppedRef.current();
        }
      };
      return anim;
    });
    return () => animations.forEach((a) => a?.cancel());
  }, [spin, animatedId, cell, reels]);

  const width = reels * colWidth + (reels - 1) * gap;
  const height = ROWS * cell;
  const pulseSet = new Set(pulse);

  return (
    <div className="relative flex" style={{ gap }}>
      {columns.map((seq, r) => (
        <div
          key={r}
          className={`relative overflow-hidden ${drum ? 'rounded-md bg-gradient-to-b from-[#d9d4cc] via-white to-[#d9d4cc]' : ''}`}
          style={{ width: colWidth, height }}
        >
          <div ref={(el) => { columnRefs.current[r] = el; }} className="will-change-transform">
            {seq.map((sym, i) => (
              <div key={i} className={`flex items-center justify-center ${settled && i < ROWS && pulseSet.has(r * ROWS + i) ? 'slot-win' : ''}`} style={{ height: cell }}>
                {renderSymbol(sym, cell, i < ROWS ? r * ROWS + i : undefined)}
              </div>
            ))}
          </div>
          {/* Cylinder shading over the symbols: the drum curves away at the top and bottom. */}
          {drum && <div className="pointer-events-none absolute inset-0 rounded-md bg-[linear-gradient(to_bottom,rgba(40,20,10,0.45),transparent_22%,transparent_78%,rgba(40,20,10,0.45))] shadow-[inset_0_0_6px_rgba(0,0,0,0.5)]" />}
        </div>
      ))}
      {settled && (lines.length > 0 || cells.length > 0) && (
        <svg className="pointer-events-none absolute" style={{ left: 0, top: 0, width, height }} viewBox={`0 0 ${width} ${height}`}>
          {lines.map((l) => {
            const pts = paylines[l].map((row, reel) => `${reel * stride + colWidth / 2},${row * cell + cell / 2}`).join(' ');
            return <polyline key={l} points={pts} fill="none" stroke={lineColors[l % lineColors.length]} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />;
          })}
          {cells.map((c) => {
            const reel = Math.floor(c / ROWS);
            const row = c % ROWS;
            return <rect key={c} x={reel * stride + 4} y={row * cell + 4} width={colWidth - 8} height={cell - 8} rx={10} fill="none" stroke="#fde047" strokeWidth={5} />;
          })}
        </svg>
      )}
    </div>
  );

}
