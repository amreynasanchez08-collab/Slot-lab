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
  renderSymbol: (sym: number, cell: number) => ReactNode;
  /** Cell size in px. */
  cell?: number;
  /**
   * classic: gold frame, white reels, symbols on a shared background (Big Show).
   * tiles: no frame (the cabinet draws it), each symbol paints its own full tile (Plenty).
   */
  variant?: 'classic' | 'tiles';
  /** Paylines to draw once the reels stop. */
  lines: number[];
  /** Cells to ring once the reels stop (anywhere wins, scatters). */
  cells: number[];
  instant: boolean;
  onStopped: () => void;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Reels({ grid, spin, paylines, lineColors, renderSymbol, cell = 96, variant = 'classic', lines, cells, instant, onStopped }: ReelsProps) {
  const reels = grid.length / ROWS;
  const classic = variant === 'classic';
  const colWidth = classic ? cell - 6 : cell;
  const gap = classic ? 8 : 10;
  const pad = classic ? 8 : 0;
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

  const reelWindow = (
    <div className={`relative flex ${classic ? 'rounded-xl bg-neutral-950' : ''}`} style={{ gap, padding: pad }}>
      {columns.map((seq, r) => (
        <div
          key={r}
          className={`relative overflow-hidden ${classic ? 'rounded-lg bg-gradient-to-b from-neutral-100 via-white to-neutral-200' : ''}`}
          style={{ width: colWidth, height }}
        >
          <div ref={(el) => { columnRefs.current[r] = el; }} className="will-change-transform">
            {seq.map((sym, i) => (
              <div key={i} className="flex items-center justify-center" style={{ height: cell }}>
                {renderSymbol(sym, cell)}
              </div>
            ))}
          </div>
        </div>
      ))}
      {settled && (lines.length > 0 || cells.length > 0) && (
        <svg className="pointer-events-none absolute" style={{ left: pad, top: pad, width, height }} viewBox={`0 0 ${width} ${height}`}>
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

  if (!classic) return reelWindow;
  return (
    <div className="relative mx-auto max-w-full overflow-x-auto rounded-2xl bg-gradient-to-b from-amber-400 to-amber-700 p-2 shadow-2xl" style={{ width: width + 2 * pad + 16 }}>
      {reelWindow}
    </div>
  );
}
