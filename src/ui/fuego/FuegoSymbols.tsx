import { createElement, type ReactNode } from 'react';
import { BELL, CHERRY, GRAPES, LEMON, MELON, ORANGE, PEAR, PLUM, SEVEN, WHEEL, WILD } from '../../fuego/symbols.ts';
import { WHEEL_SECTORS } from '../../fuego/wheel.ts';

// "Brasa" direction: glossy fruit drawn in code, shown in pairs as in the genre. Our own art.

const COLORS = {
  red: '#e3222f',
  yellow: '#ffd43b',
  orange: '#ff8c1a',
  purple: '#8b2fd0',
  purpleDark: '#4b1477',
  blue: '#4c55e6',
  blueDark: '#2e2f9a',
  green: '#86c93c',
  flesh: '#ff3d55',
  rind: '#2f9d3c',
  cream: '#f6f0d8',
  stem: '#6e3c16',
  leaf: '#38a63c',
  gold: '#f2b72a',
  goldDark: '#b07a12',
  dark: '#2a120a',
} as const;
type Role = keyof typeof COLORS;

function mix(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => (t > 0 ? Math.round(c + (255 - c) * t) : Math.round(c * (1 + t)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('');
}

/** Gradients shared by every Fuego 27 symbol. Mount once, outside any hidden tab (display:none breaks SVG paint servers). */
export function FuegoDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        {(Object.keys(COLORS) as Role[]).map((role) => (
          <radialGradient key={`r-${role}`} id={`fg-rad-${role}`} cx=".35" cy=".3" r=".8">
            <stop offset="0" stopColor={mix(COLORS[role], 0.55)} />
            <stop offset=".5" stopColor={COLORS[role]} />
            <stop offset="1" stopColor={mix(COLORS[role], -0.5)} />
          </radialGradient>
        ))}
        <linearGradient id="fg-lin-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(COLORS.red, 0.35)} />
          <stop offset=".5" stopColor={COLORS.red} />
          <stop offset="1" stopColor={mix(COLORS.red, -0.45)} />
        </linearGradient>
        <linearGradient id="fg-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ffd23a" />
          <stop offset=".45" stopColor="#ff7a00" />
          <stop offset=".85" stopColor="#e8260a" />
          <stop offset="1" stopColor="#a80d00" />
        </linearGradient>
        <linearGradient id="fg-flame-front" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff4c0" />
          <stop offset=".6" stopColor="#ffb020" />
          <stop offset="1" stopColor="#ff5a00" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="fg-wheel-tile" cx=".5" cy=".45" r=".7">
          <stop offset="0" stopColor="#ffd56b" />
          <stop offset=".55" stopColor="#c8121f" />
          <stop offset="1" stopColor="#5a0a12" />
        </radialGradient>
        <radialGradient id="fg-sun" cx=".4" cy=".35" r=".7">
          <stop offset="0" stopColor="#fff6c8" />
          <stop offset=".5" stopColor="#ffc62e" />
          <stop offset="1" stopColor="#ff6a00" />
        </radialGradient>
        <linearGradient id="fg-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset=".5" stopColor="#e2a53a" />
          <stop offset="1" stopColor="#8a5a12" />
        </linearGradient>
        <linearGradient id="fg-title" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6c4" />
          <stop offset=".5" stopColor="#ffc433" />
          <stop offset="1" stopColor="#d27a0c" />
        </linearGradient>
        <radialGradient id="fg-wheel-m" cx=".5" cy=".5" r=".55">
          <stop offset="0" stopColor="#ff5560" />
          <stop offset="1" stopColor="#8a0713" />
        </radialGradient>
        <radialGradient id="fg-wheel-f" cx=".5" cy=".5" r=".55">
          <stop offset="0" stopColor="#fff1c4" />
          <stop offset="1" stopColor="#f6a62c" />
        </radialGradient>
        <filter id="fg-drop" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity=".45" />
        </filter>
        <filter id="fg-blur10" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <filter id="fg-blur3" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="fg-flame-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#ff7a00" floodOpacity=".9" />
        </filter>
      </defs>
    </svg>
  );
}

interface Shape {
  kind: 'fill' | 'stroke' | 'hl' | 'text';
  role?: Role;
  el: 'path' | 'circle' | 'ellipse' | 'rect' | 'text';
  a: Record<string, string | number>;
  w?: number;
  text?: string;
}

/** Berries back to front: [cx, cy, r, back row]. Mixed sizes that overlap, so the bunch reads as fruit. */
const GRAPE_DOTS: [number, number, number, boolean][] = [
  [30, 30, 10, true], [47, 28, 11, true], [64, 29, 10.5, true], [79, 33, 9.5, true],
  [37, 45, 11.5, false], [54, 44, 12, false], [70, 47, 11, false],
  [44, 61, 11, false], [61, 61, 11.5, false], [52, 77, 10.5, false],
];

/** Each symbol in a 100 x 100 box. */
const SHAPES: Record<number, Shape[]> = {
  [CHERRY]: [
    { kind: 'stroke', role: 'stem', el: 'path', a: { d: 'M36 60 C40 40 50 24 62 14' }, w: 4 },
    { kind: 'stroke', role: 'stem', el: 'path', a: { d: 'M68 64 C68 44 66 28 62 14' }, w: 4 },
    { kind: 'fill', role: 'leaf', el: 'path', a: { d: 'M62 15 C70 5 86 6 93 14 C84 22 70 23 62 15 Z' } },
    { kind: 'fill', role: 'red', el: 'circle', a: { cx: 34, cy: 68, r: 19 } },
    { kind: 'fill', role: 'red', el: 'circle', a: { cx: 68, cy: 72, r: 19 } },
    { kind: 'hl', el: 'ellipse', a: { cx: 27, cy: 60, rx: 6, ry: 4 } },
    { kind: 'hl', el: 'ellipse', a: { cx: 61, cy: 64, rx: 6, ry: 4 } },
  ],
  [LEMON]: [
    { kind: 'fill', role: 'yellow', el: 'path', a: { d: 'M12 54 C14 34 32 22 52 22 C72 22 86 34 89 50 C93 52 93 57 89 58 C85 74 69 84 50 84 C31 84 15 74 11 58 C7 57 7 52 12 54 Z' } },
    { kind: 'fill', role: 'leaf', el: 'path', a: { d: 'M54 23 C58 12 70 8 78 12 C74 20 64 24 54 23 Z' } },
    { kind: 'hl', el: 'ellipse', a: { cx: 36, cy: 38, rx: 12, ry: 6 } },
  ],
  [ORANGE]: [
    { kind: 'fill', role: 'orange', el: 'circle', a: { cx: 50, cy: 56, r: 33 } },
    { kind: 'stroke', role: 'stem', el: 'path', a: { d: 'M50 24 L52 16' }, w: 4 },
    { kind: 'fill', role: 'leaf', el: 'path', a: { d: 'M52 18 C60 6 76 6 84 12 C76 22 62 24 52 18 Z' } },
    { kind: 'hl', el: 'ellipse', a: { cx: 38, cy: 42, rx: 10, ry: 6 } },
  ],
  [PLUM]: [
    { kind: 'fill', role: 'purple', el: 'path', a: { d: 'M50 22 C74 22 86 42 84 60 C82 78 66 89 50 89 C32 89 16 77 16 58 C16 38 30 22 50 22 Z' } },
    { kind: 'stroke', role: 'purpleDark', el: 'path', a: { d: 'M50 26 C43 46 43 68 50 86' }, w: 2.5 },
    { kind: 'fill', role: 'leaf', el: 'path', a: { d: 'M50 23 C54 10 68 6 76 10 C70 19 60 23 50 23 Z' } },
    { kind: 'hl', el: 'ellipse', a: { cx: 34, cy: 42, rx: 8, ry: 12 } },
  ],
  [MELON]: [
    { kind: 'fill', role: 'rind', el: 'path', a: { d: 'M8 38 A42 42 0 0 0 92 38 Z' } },
    { kind: 'fill', role: 'cream', el: 'path', a: { d: 'M13 38 A37 37 0 0 0 87 38 Z' } },
    { kind: 'fill', role: 'flesh', el: 'path', a: { d: 'M17 38 A33 33 0 0 0 83 38 Z' } },
    ...[[34, 48], [50, 54], [66, 48], [42, 61], [58, 61]].map(([cx, cy]): Shape => ({ kind: 'fill', role: 'dark', el: 'ellipse', a: { cx, cy, rx: 2.4, ry: 4 } })),
  ],
  [PEAR]: [
    { kind: 'fill', role: 'green', el: 'path', a: { d: 'M50 16 C57 16 59 26 61 34 C64 46 82 52 82 70 C82 86 67 94 50 94 C33 94 18 86 18 70 C18 52 36 46 39 34 C41 26 43 16 50 16 Z' } },
    { kind: 'stroke', role: 'stem', el: 'path', a: { d: 'M50 18 L54 6' }, w: 4 },
    { kind: 'fill', role: 'leaf', el: 'path', a: { d: 'M53 12 C60 2 74 2 80 8 C72 16 61 16 53 12 Z' } },
    { kind: 'hl', el: 'ellipse', a: { cx: 34, cy: 66, rx: 7, ry: 12 } },
  ],
  [GRAPES]: [
    { kind: 'stroke', role: 'stem', el: 'path', a: { d: 'M53 22 L56 8' }, w: 4 },
    { kind: 'fill', role: 'leaf', el: 'path', a: { d: 'M56 12 C66 2 82 4 88 12 C78 18 66 18 56 12 Z' } },
    ...GRAPE_DOTS.map(([cx, cy, r, back]): Shape => ({ kind: 'fill', role: back ? 'blueDark' : 'blue', el: 'circle', a: { cx, cy, r } })),
    ...GRAPE_DOTS.filter((d) => !d[3]).map(([cx, cy, r]): Shape => ({ kind: 'hl', el: 'ellipse', a: { cx: cx - r * 0.32, cy: cy - r * 0.35, rx: r * 0.3, ry: r * 0.2 } })),
  ],
  [BELL]: [
    { kind: 'fill', role: 'gold', el: 'circle', a: { cx: 50, cy: 13, r: 5 } },
    { kind: 'fill', role: 'gold', el: 'path', a: { d: 'M50 16 C65 16 72 28 72 44 C72 58 76 66 86 74 L14 74 C24 66 28 58 28 44 C28 28 35 16 50 16 Z' } },
    { kind: 'fill', role: 'goldDark', el: 'rect', a: { x: 12, y: 72, width: 76, height: 9, rx: 4.5 } },
    { kind: 'fill', role: 'gold', el: 'circle', a: { cx: 50, cy: 87, r: 7 } },
    { kind: 'hl', el: 'ellipse', a: { cx: 40, cy: 38, rx: 6, ry: 13 } },
  ],
  [SEVEN]: [
    { kind: 'text', role: 'red', el: 'text', a: { x: 52, y: 90, fontSize: 100, textAnchor: 'middle', fontFamily: 'Arial Black, Impact, sans-serif', fontStyle: 'italic' }, text: '7' },
  ],
};

function paint(s: Shape, key: number): ReactNode {
  if (s.kind === 'hl') return createElement(s.el, { key, ...s.a, fill: '#fff', opacity: 0.55 });
  const col = COLORS[s.role ?? 'red'];
  if (s.kind === 'stroke') return createElement(s.el, { key, ...s.a, fill: 'none', stroke: col, strokeWidth: s.w, strokeLinecap: 'round' });
  if (s.kind === 'text') {
    return createElement(s.el, { key, ...s.a, fill: 'url(#fg-lin-red)', stroke: '#ffd56b', strokeWidth: 5, paintOrder: 'stroke', strokeLinejoin: 'round' }, s.text);
  }
  return createElement(s.el, { key, ...s.a, fill: `url(#fg-rad-${s.role})`, stroke: mix(col, -0.55), strokeWidth: 1.2, strokeOpacity: 0.6 });
}

/** One symbol drawn at (x, y) center with scale s (100 box -> 100 s px), inside a parent SVG. */
function Fruit({ id, x, y, s }: { id: number; x: number; y: number; s: number }) {
  const rot = id === MELON ? ' rotate(-14 50 50)' : '';
  return (
    <g transform={`translate(${x - 50 * s} ${y - 50 * s}) scale(${s})${rot}`} filter="url(#fg-drop)">
      {SHAPES[id].map(paint)}
    </g>
  );
}

const FLAME = 'M50 100 C22 92 16 64 32 42 C33 58 42 62 45 52 C42 36 50 20 60 6 C62 26 80 36 82 58 C84 80 72 95 50 100 Z';

/** One flame standing on (x, base), scaled sx by sy from the 100 x 100 flame. */
function Flame({ x, base, sx, sy, cls, fill = 'url(#fg-flame)', opacity = 0.95 }: { x: number; base: number; sx: number; sy: number; cls: string; fill?: string; opacity?: number }) {
  return (
    <g transform={`translate(${x - 50 * sx} ${base - 100 * sy}) scale(${sx} ${sy})`}>
      <path className={`flame${cls}`} d={FLAME} fill={fill} opacity={opacity} />
    </g>
  );
}

/** Behind the symbol: a warm glow and flames climbing the sides and the middle of a 200 x 124 cell. */
function FlamesBack() {
  return (
    <g>
      <ellipse cx={100} cy={70} rx={78} ry={42} fill="#ff6a00" opacity={0.45} filter="url(#fg-blur10)" />
      <g filter="url(#fg-flame-glow)">
        <Flame x={20} base={122} sx={0.7} sy={1.15} cls="" />
        <Flame x={180} base={122} sx={0.7} sy={1.15} cls=" d3" />
        <Flame x={62} base={122} sx={0.6} sy={0.95} cls=" d2" />
        <Flame x={138} base={122} sx={0.6} sy={0.95} cls="" />
        <Flame x={100} base={122} sx={0.66} sy={1.05} cls=" d3" />
      </g>
    </g>
  );
}

/** In front of the symbol: small bright tongues licking its base. */
function FlamesFront() {
  return (
    <g style={{ mixBlendMode: 'screen' }}>
      <Flame x={60} base={122} sx={0.35} sy={0.42} cls=" d2" fill="url(#fg-flame-front)" opacity={0.85} />
      <Flame x={100} base={122} sx={0.38} sy={0.48} cls="" fill="url(#fg-flame-front)" opacity={0.85} />
      <Flame x={140} base={122} sx={0.35} sy={0.42} cls=" d3" fill="url(#fg-flame-front)" opacity={0.85} />
    </g>
  );
}

function WildTile() {
  const R = 33;
  return (
    <g>
      <rect x={7} y={7} width={186} height={110} rx={12} fill="#7a0d1c" stroke="#f5c542" strokeWidth={3} />
      <g transform="translate(100 52)">
        {Array.from({ length: 10 }, (_, i) => (
          <path
            key={i}
            d={`M0 ${-R * 1.6} C${R * 0.38} ${-R * 1.1} ${R * 0.45} ${-R * 0.7} 0 ${-R * 0.55} C${-R * 0.45} ${-R * 0.7} ${-R * 0.38} ${-R * 1.1} 0 ${-R * 1.6} Z`}
            transform={`rotate(${i * 36})`}
            fill="url(#fg-flame)"
          />
        ))}
        <circle r={R * 0.78} fill="url(#fg-sun)" stroke="#f5c542" strokeWidth={2} />
      </g>
      <text x={100} y={108} textAnchor="middle" fontFamily="Arial Black, Impact, sans-serif" fontWeight={900} fontSize={27} letterSpacing={2} fill="#ffe27a" stroke="#4a0508" strokeWidth={4} paintOrder="stroke">
        WILD
      </text>
    </g>
  );
}

const sectorPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (deg: number) => [cx + r * Math.sin((deg * Math.PI) / 180), cy - r * Math.cos((deg * Math.PI) / 180)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
};

function WheelTile() {
  const r = 36;
  return (
    <g>
      <rect x={7} y={7} width={186} height={110} rx={12} fill="url(#fg-wheel-tile)" stroke="#f5c542" strokeWidth={3} />
      {WHEEL_SECTORS.map((s, i) => (
        <path key={i} d={sectorPath(100, 48, r, i * 45 - 22.5, i * 45 + 22.5)} fill={s.kind === 'multiplier' ? '#c8121f' : '#ffe2a0'} />
      ))}
      <circle cx={100} cy={48} r={r + 3} fill="none" stroke="url(#fg-gold)" strokeWidth={6} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = ((i * 45 + 22.5) * Math.PI) / 180;
        return <circle key={i} cx={100 + (r + 3) * Math.sin(a)} cy={48 - (r + 3) * Math.cos(a)} r={2.4} fill="#fff4c0" />;
      })}
      <circle cx={100} cy={48} r={7} fill="url(#fg-gold)" />
      <path d="M46 88 H154 L160 98 L154 108 H46 L40 98 Z" fill="#5a0a12" stroke="#f5c542" strokeWidth={1.5} />
      <text x={100} y={104} textAnchor="middle" fontFamily="Arial Black, Impact, sans-serif" fontWeight={900} fontSize={15} letterSpacing={3} fill="#ffd56b" stroke="#2a0505" strokeWidth={3} paintOrder="stroke">
        RUEDA
      </text>
    </g>
  );
}

/**
 * A reel cell, 200 x 124 units scaled to width x height: fruit in pairs, or the wild and wheel
 * tiles. hot = part of a win: flames behind and a gold frame.
 */
export function FuegoCell({ id, width, height, hot = false }: { id: number; width: number; height: number; hot?: boolean }) {
  return (
    <svg viewBox="0 0 200 124" width={width} height={height} aria-hidden overflow="visible">
      {hot && <FlamesBack />}
      {id !== WILD && id !== WHEEL && <ellipse cx={100} cy={111} rx={70} ry={6} fill="#000" opacity={0.25} filter="url(#fg-blur3)" />}
      {id === WILD ? (
        <WildTile />
      ) : id === WHEEL ? (
        <WheelTile />
      ) : (
        <>
          <Fruit id={id} x={70} y={58} s={0.89} />
          <Fruit id={id} x={126} y={68} s={0.97} />
        </>
      )}
      {hot && (
        <>
          <FlamesFront />
          <rect x={5} y={5} width={190} height={114} rx={10} fill="none" stroke="#ff8a00" strokeOpacity={0.35} strokeWidth={10} />
          <rect x={5} y={5} width={190} height={114} rx={10} fill="none" stroke="#ffe066" strokeWidth={4} />
        </>
      )}
    </svg>
  );
}

/** A single symbol for tables and lists (no pair). */
export function FuegoIcon({ id, size }: { id: number; size: number }) {
  if (id === WILD || id === WHEEL) {
    return (
      <svg viewBox="0 0 200 124" width={size * 1.6} height={size} aria-hidden>
        {id === WILD ? <WildTile /> : <WheelTile />}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <Fruit id={id} x={50} y={50} s={1} />
    </svg>
  );
}
