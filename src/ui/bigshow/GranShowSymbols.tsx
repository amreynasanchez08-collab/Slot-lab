import {
  BELL,
  BONUS,
  CHERRY,
  DANCER_HEAD,
  LEMON,
  MELON,
  ORANGE,
  PLUM,
  SEVEN,
  SYMBOL_NAMES,
} from '../../engine/symbols.ts';

// Glossy vector symbols in the style of a classic fruit machine: our own drawings, no
// artwork from the original game. Gradients live once in <GranShowDefs />, which the
// cabinet renders a single time, so every reel cell stays a light SVG.

const OUTLINE = '#2a0a06';

/** Shared gradients and patterns. Must be mounted (not display:none) wherever symbols show. */
export function GranShowDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        <radialGradient id="gs-cherry" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffc2c2" />
          <stop offset="0.3" stopColor="#ff2440" />
          <stop offset="0.75" stopColor="#b0001e" />
          <stop offset="1" stopColor="#560010" />
        </radialGradient>
        <linearGradient id="gs-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c6f57a" />
          <stop offset="0.5" stopColor="#3fa52a" />
          <stop offset="1" stopColor="#1b5a12" />
        </linearGradient>
        <radialGradient id="gs-lemon" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#fffde3" />
          <stop offset="0.35" stopColor="#ffe94d" />
          <stop offset="0.8" stopColor="#f2b400" />
          <stop offset="1" stopColor="#a87000" />
        </radialGradient>
        <radialGradient id="gs-orange" cx="36%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffe4b0" />
          <stop offset="0.35" stopColor="#ffa21f" />
          <stop offset="0.8" stopColor="#e86400" />
          <stop offset="1" stopColor="#8a3600" />
        </radialGradient>
        <radialGradient id="gs-plum" cx="36%" cy="30%" r="75%">
          <stop offset="0" stopColor="#f2c2ff" />
          <stop offset="0.35" stopColor="#a63ad8" />
          <stop offset="0.8" stopColor="#5c0f8c" />
          <stop offset="1" stopColor="#2a0042" />
        </radialGradient>
        <linearGradient id="gs-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff7c8" />
          <stop offset="0.3" stopColor="#ffd84a" />
          <stop offset="0.65" stopColor="#d99806" />
          <stop offset="1" stopColor="#7d5000" />
        </linearGradient>
        <linearGradient id="gs-gold-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a5a00" />
          <stop offset="0.3" stopColor="#ffe27a" />
          <stop offset="0.55" stopColor="#fff7d0" />
          <stop offset="1" stopColor="#b77c00" />
        </linearGradient>
        <radialGradient id="gs-melon" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#dcf7a0" />
          <stop offset="0.4" stopColor="#6cbf2c" />
          <stop offset="0.85" stopColor="#2a7810" />
          <stop offset="1" stopColor="#0e3a05" />
        </radialGradient>
        <linearGradient id="gs-flesh" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff8a8a" />
          <stop offset="1" stopColor="#e3112c" />
        </linearGradient>
        <linearGradient id="gs-seven" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd6ce" />
          <stop offset="0.35" stopColor="#ff3a2a" />
          <stop offset="0.7" stopColor="#c20000" />
          <stop offset="1" stopColor="#6a0000" />
        </linearGradient>
        <linearGradient id="gs-skin" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d98e6c" />
          <stop offset="0.45" stopColor="#ffd8bd" />
          <stop offset="1" stopColor="#d18765" />
        </linearGradient>
        <linearGradient id="gs-costume" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5a78" />
          <stop offset="0.5" stopColor="#d10035" />
          <stop offset="1" stopColor="#6e001c" />
        </linearGradient>
        <linearGradient id="gs-feather" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd0dc" />
          <stop offset="0.5" stopColor="#ff2d6f" />
          <stop offset="1" stopColor="#a8003a" />
        </linearGradient>
        <linearGradient id="gs-hair" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7a45" />
          <stop offset="1" stopColor="#a11a08" />
        </linearGradient>
        <linearGradient id="gs-cream" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#efe2cf" />
          <stop offset="0.5" stopColor="#fdf8f0" />
          <stop offset="1" stopColor="#efe2cf" />
        </linearGradient>
        <pattern id="gs-sequin" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="1" fill="#ffe0e8" opacity="0.5" />
        </pattern>
      </defs>
    </svg>
  );
}

/** Four-point glint, the shine marks a classic slot draws on its fruit. */
function Sparkle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -8 L1.5 -1.5 L8 0 L1.5 1.5 L0 8 L-1.5 1.5 L-8 0 L-1.5 -1.5Z"
      fill="#ffffff"
      opacity="0.95"
    />
  );
}

function Leaf({ d, transform }: { d?: string; transform?: string }) {
  return (
    <path
      transform={transform}
      d={d ?? 'M0 0 C8 -10 24 -12 32 -6 C24 4 10 6 0 0Z'}
      fill="url(#gs-leaf)"
      stroke={OUTLINE}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  );
}

function Cherry({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="url(#gs-cherry)" stroke={OUTLINE} strokeWidth="1.6" />
      <ellipse cx={x - r * 0.38} cy={y - r * 0.42} rx={r * 0.32} ry={r * 0.2} fill="#ffffff" opacity="0.75" transform={`rotate(-30 ${x - r * 0.38} ${y - r * 0.42})`} />
    </g>
  );
}

/** Symbol in a 100x100 box; dancer parts show their third of the full figure. */
export function GranShowSymbol({ id, size }: { id: number; size: number }) {
  if (id >= DANCER_HEAD) {
    const part = id - DANCER_HEAD;
    return (
      <svg width={size} height={size} viewBox={`0 ${part * 100} 100 100`} role="img" aria-label={SYMBOL_NAMES[id]} className="block">
        <Dancer />
        <Multiplier y={part * 100 + 90} value={3 - part} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={SYMBOL_NAMES[id]} className="block">
      {fruit(id)}
    </svg>
  );
}

function fruit(id: number) {
  switch (id) {
    case CHERRY:
      return (
        <g>
          <path d="M62 12 C56 26 40 34 36 44 M62 12 C62 26 60 36 60 46 M62 12 C68 28 76 40 78 54 M62 12 C50 30 32 46 28 58 M62 12 C58 34 52 50 52 62" stroke="#3d6b12" strokeWidth="3" fill="none" strokeLinecap="round" />
          <Leaf transform="translate(62 13) rotate(-8)" />
          <Cherry x={38} y={52} r={13} />
          <Cherry x={62} y={52} r={13} />
          <Cherry x={78} y={66} r={13} />
          <Cherry x={28} y={70} r={14} />
          <Cherry x={53} y={76} r={15} />
          <Sparkle x={47} y={68} s={0.9} />
          <Sparkle x={73} y={58} s={0.7} />
        </g>
      );
    case LEMON:
      return (
        <g>
          <path
            d="M8 58 C6 52 10 48 14 46 C22 26 52 18 74 28 C80 26 88 28 90 34 C92 40 88 44 86 46 C84 70 56 84 30 76 C22 78 12 74 10 66Z"
            fill="url(#gs-lemon)"
            stroke={OUTLINE}
            strokeWidth="1.8"
          />
          <ellipse cx="38" cy="40" rx="14" ry="6" fill="#ffffff" opacity="0.7" transform="rotate(-18 38 40)" />
          <Leaf transform="translate(70 26) rotate(-40) scale(0.8)" />
          <Sparkle x={30} y={38} />
        </g>
      );
    case ORANGE:
      return (
        <g>
          <circle cx="36" cy="54" r="25" fill="url(#gs-orange)" stroke={OUTLINE} strokeWidth="1.8" />
          <circle cx="62" cy="62" r="28" fill="url(#gs-orange)" stroke={OUTLINE} strokeWidth="1.8" />
          <Leaf transform="translate(36 30) rotate(-30) scale(0.7)" />
          <Leaf transform="translate(64 35) rotate(-20) scale(0.85)" />
          <circle cx="64" cy="35" r="2.5" fill="#3d6b12" />
          <ellipse cx="52" cy="50" rx="9" ry="5" fill="#ffffff" opacity="0.65" transform="rotate(-30 52 50)" />
          <ellipse cx="25" cy="44" rx="6" ry="3.5" fill="#ffffff" opacity="0.55" transform="rotate(-30 25 44)" />
          <Sparkle x={50} y={50} s={0.8} />
        </g>
      );
    case PLUM:
      return (
        <g>
          <ellipse cx="36" cy="56" rx="22" ry="26" fill="url(#gs-plum)" stroke={OUTLINE} strokeWidth="1.8" />
          <ellipse cx="62" cy="62" rx="24" ry="28" fill="url(#gs-plum)" stroke={OUTLINE} strokeWidth="1.8" />
          <path d="M62 36 C56 50 56 72 62 88" stroke="#3a0560" strokeWidth="2" fill="none" opacity="0.6" />
          <path d="M60 34 C60 28 62 22 66 18" stroke="#5a3a12" strokeWidth="3" fill="none" strokeLinecap="round" />
          <Leaf transform="translate(64 20) rotate(-10) scale(0.85)" />
          <ellipse cx="50" cy="48" rx="7" ry="4" fill="#ffffff" opacity="0.6" transform="rotate(-40 50 48)" />
          <ellipse cx="26" cy="44" rx="5" ry="3" fill="#ffffff" opacity="0.5" transform="rotate(-40 26 44)" />
          <Sparkle x={50} y={48} s={0.8} />
        </g>
      );
    case BELL:
      return (
        <g>
          <rect x="44" y="6" width="12" height="12" rx="4" fill="url(#gs-gold)" stroke={OUTLINE} strokeWidth="1.6" />
          <circle cx="50" cy="82" r="9" fill="url(#gs-gold)" stroke={OUTLINE} strokeWidth="1.6" />
          <path
            d="M50 14 C30 14 24 32 24 50 C24 62 18 68 10 74 C10 80 90 80 90 74 C82 68 76 62 76 50 C76 32 70 14 50 14Z"
            fill="url(#gs-gold-side)"
            stroke={OUTLINE}
            strokeWidth="1.8"
          />
          <path d="M12 74 C30 82 70 82 88 74" stroke="#7d5000" strokeWidth="3" fill="none" />
          <path d="M36 26 C32 36 31 48 31 60" stroke="#ffffff" strokeWidth="5" opacity="0.7" strokeLinecap="round" fill="none" />
          <Sparkle x={36} y={24} />
        </g>
      );
    case MELON:
      return (
        <g>
          <circle cx="40" cy="52" r="32" fill="url(#gs-melon)" stroke={OUTLINE} strokeWidth="1.8" />
          <path d="M40 20 C30 36 30 68 40 84 M24 26 C14 40 16 66 26 78 M56 26 C66 40 64 66 54 78" stroke="#123f07" strokeWidth="4" fill="none" opacity="0.7" />
          <ellipse cx="28" cy="36" rx="9" ry="5" fill="#ffffff" opacity="0.55" transform="rotate(-35 28 36)" />
          {/* slice in front */}
          <path d="M52 66 L94 66 A21 21 0 0 1 52 66Z" fill="#2a7810" stroke={OUTLINE} strokeWidth="1.6" />
          <path d="M56 66 L90 66 A17 17 0 0 1 56 66Z" fill="url(#gs-flesh)" />
          {[62, 70, 78, 84, 73].map((x, i) => (
            <ellipse key={x} cx={x} cy={i === 4 ? 76 : 70} rx="1.6" ry="2.4" fill="#1a0a06" />
          ))}
          <Sparkle x={28} y={36} s={0.9} />
        </g>
      );
    case SEVEN:
      return (
        <g>
          <text
            x="50"
            y="80"
            textAnchor="middle"
            fontSize="74"
            fontWeight="900"
            fontStyle="italic"
            fontFamily="Georgia, 'Times New Roman', serif"
            textLength="88"
            lengthAdjust="spacingAndGlyphs"
            fill="url(#gs-seven)"
            stroke={OUTLINE}
            strokeWidth="3"
            paintOrder="stroke"
          >
            77
          </text>
          <Sparkle x={34} y={30} s={0.9} />
          <Sparkle x={74} y={34} s={0.6} />
        </g>
      );
    case BONUS:
      return (
        <g>
          <path d="M50 4 L62 34 L95 36 L69 56 L78 88 L50 70 L22 88 L31 56 L5 36 L38 34Z" fill="url(#gs-gold)" stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round" />
          <text x="50" y="62" textAnchor="middle" fontSize="34" fontWeight="900" fontFamily="Georgia, serif" fill="#c20000" stroke="#fff3c0" strokeWidth="2" paintOrder="stroke">
            ?
          </text>
          <rect x="16" y="74" width="68" height="20" rx="4" fill="#b00020" stroke={OUTLINE} strokeWidth="1.6" />
          <text x="50" y="89" textAnchor="middle" fontSize="15" fontWeight="900" fontFamily="system-ui, sans-serif" fill="#ffe27a" letterSpacing="1">
            BONUS
          </text>
          <Sparkle x={70} y={22} s={0.8} />
        </g>
      );
    default:
      return null;
  }
}

/** Gold "xN" on the right of each dancer cell, as the original marks the multiplier. */
function Multiplier({ y, value }: { y: number; value: number }) {
  return (
    <text
      x="95"
      y={y}
      textAnchor="end"
      fontSize="26"
      fontWeight="900"
      fontStyle="italic"
      fontFamily="Georgia, serif"
      fill="url(#gs-gold)"
      stroke="#3a1800"
      strokeWidth="2.5"
      paintOrder="stroke"
    >
      x{value}
    </text>
  );
}

/** Corner scroll of the dancer's frame, drawn for the top-left corner. */
const SCROLL = 'M10 46 C10 24 22 10 44 10 M15 38 C17 26 24 19 34 17 C30 23 31 28 36 29 M10 46 C14 44 18 46 18 50 C18 54 14 55 12 53';

/**
 * Cabaret showgirl, 100x300: feather headdress, sequined costume with a gold fringe, high
 * kick pose, on a cream panel with a burgundy frame. Each reel cell shows one third.
 */
function Dancer() {
  const frame = '#8c1d2a';
  return (
    <g>
      <rect x="0" y="0" width="100" height="300" fill="url(#gs-cream)" />
      <rect x="4" y="4" width="92" height="292" rx="14" fill="none" stroke={frame} strokeWidth="2.5" />
      <rect x="9" y="9" width="82" height="282" rx="10" fill="none" stroke={frame} strokeWidth="1" opacity="0.55" />
      <g stroke={frame} strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path d={SCROLL} />
        <path d={SCROLL} transform="translate(100 0) scale(-1 1)" />
        <path d={SCROLL} transform="translate(0 300) scale(1 -1)" />
        <path d={SCROLL} transform="translate(100 300) scale(-1 -1)" />
        {/* side vines */}
        {[70, 130, 190, 240].map((y) => (
          <g key={y} opacity="0.5">
            <path d={`M12 ${y} c6 -6 6 -14 0 -18 c-2 6 0 10 4 12`} />
            <path d={`M88 ${y} c-6 -6 -6 -14 0 -18 c2 6 0 10 -4 12`} />
          </g>
        ))}
      </g>

      <g transform="translate(-4 0)">
        {/* headdress */}
        {[-60, -40, -20, 0, 20, 40, 60].map((a) => (
          <ellipse key={a} cx="50" cy="20" rx="6" ry="21" fill="url(#gs-feather)" stroke="#7a0028" strokeWidth="0.8" transform={`rotate(${a} 50 44)`} />
        ))}
        <path d="M36 48 C42 40 58 40 64 48" stroke="url(#gs-gold)" strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="50" cy="42" r="4" fill="#ff2d6f" stroke="#ffe27a" strokeWidth="1.5" />

        {/* raised arm, behind the head */}
        <path d="M41 93 Q22 76 26 60 Q28 48 36 42" stroke="url(#gs-skin)" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M27 66 l5 3" stroke="url(#gs-gold)" strokeWidth="3" strokeLinecap="round" />

        {/* head and hair */}
        <path d="M36 60 C34 44 46 40 56 42 C66 44 68 56 66 64 C66 74 60 80 54 80 L40 78 C36 74 35 68 36 60Z" fill="url(#gs-hair)" stroke={OUTLINE} strokeWidth="1" />
        <ellipse cx="54" cy="62" rx="10" ry="12" fill="url(#gs-skin)" stroke={OUTLINE} strokeWidth="0.8" />
        <path d="M44 52 C50 46 60 48 64 54 C58 52 50 52 44 56Z" fill="url(#gs-hair)" />
        <path d="M54 60 q4 3 8 0" stroke="#3b1d12" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <ellipse cx="58" cy="69" rx="2.6" ry="1.4" fill="#c4002b" />
        <circle cx="45" cy="70" r="2" fill="#ffe27a" />

        {/* neck and shoulders */}
        <path d="M50 72 L58 72 L59 88 L49 88Z" fill="url(#gs-skin)" />
        <path d="M37 98 Q50 84 66 98 L66 104 L37 104Z" fill="url(#gs-skin)" />

        {/* costume */}
        <path
          d="M38 98 C44 93 58 93 65 98 C67 113 63 127 60 140 C65 152 69 166 68 178 L35 178 C34 166 38 152 43 140 C40 127 36 113 38 98Z"
          fill="url(#gs-costume)"
          stroke="#4a0012"
          strokeWidth="1"
        />
        <path
          d="M38 98 C44 93 58 93 65 98 C67 113 63 127 60 140 C65 152 69 166 68 178 L35 178 C34 166 38 152 43 140 C40 127 36 113 38 98Z"
          fill="url(#gs-sequin)"
        />
        <path d="M38 99 C46 107 57 107 65 99" stroke="url(#gs-gold)" strokeWidth="3" fill="none" />
        <path d="M43 140 C49 143 55 143 60 140" stroke="url(#gs-gold)" strokeWidth="3.5" fill="none" />

        {/* arm on the hip */}
        <path d="M64 100 Q76 120 70 134 Q67 142 62 146" stroke="url(#gs-skin)" strokeWidth="6.5" fill="none" strokeLinecap="round" />

        {/* legs: one standing, one in a kick */}
        <path d="M37 182 C39 220 39 250 40 286 L46 286 C48 250 49 220 51 182Z" fill="url(#gs-skin)" stroke={OUTLINE} strokeWidth="0.8" />
        <path
          d="M49 184 C57 196 65 206 71 218 C73 224 70 228 66 228 C65 244 64 256 65 270 L59 270 C58 254 58 238 61 224 C55 214 49 202 45 194Z"
          fill="url(#gs-skin)"
          stroke={OUTLINE}
          strokeWidth="0.8"
        />
        <path d="M43 200 L43 280 M62 232 L61 266" stroke="#ffffff" strokeWidth="1.2" opacity="0.4" />
        <path d="M36 286 L48 286 L50 292 L34 294Z" fill="#c4002b" stroke={OUTLINE} strokeWidth="0.8" />
        <path d="M57 270 L67 270 L70 276 L55 278Z" fill="#c4002b" stroke={OUTLINE} strokeWidth="0.8" />

        {/* gold fringe, over the hips */}
        {Array.from({ length: 12 }, (_, i) => {
          const x = 35 + i * 3;
          return <path key={x} d={`M${x} 176 q1.5 ${10 + (i % 3) * 3} -0.5 ${18 + (i % 4) * 2}`} stroke="url(#gs-gold)" strokeWidth="1.8" fill="none" strokeLinecap="round" />;
        })}
      </g>
    </g>
  );
}
