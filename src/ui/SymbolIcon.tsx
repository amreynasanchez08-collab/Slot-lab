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
  SYMBOL_NAMES,
} from '../engine/symbols.ts';

/** Flat vector symbols, drawn in a 100x100 box. */
export function SymbolIcon({ id, size = 64 }: { id: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={SYMBOL_NAMES[id]}>
      {renderSymbol(id)}
    </svg>
  );
}

function renderSymbol(id: number) {
  switch (id) {
    case CHERRY:
      return (
        <g>
          <path d="M50 14 C46 34 36 46 30 60 M50 14 C56 34 66 44 70 58" stroke="#2f7d32" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M50 14 C60 8 74 12 78 20 C68 22 58 20 50 14Z" fill="#43a047" />
          <circle cx="30" cy="68" r="17" fill="#d32f2f" />
          <circle cx="70" cy="66" r="17" fill="#e53935" />
          <circle cx="24" cy="62" r="5" fill="#ffffff" opacity="0.55" />
          <circle cx="64" cy="60" r="5" fill="#ffffff" opacity="0.55" />
        </g>
      );
    case LEMON:
      return (
        <g>
          <path d="M12 52 C18 26 46 18 70 26 C82 30 90 40 90 50 C84 76 54 84 30 76 C20 72 12 62 12 52Z" fill="#fdd835" stroke="#f9a825" strokeWidth="3" />
          <ellipse cx="40" cy="40" rx="12" ry="6" fill="#ffffff" opacity="0.5" />
        </g>
      );
    case ORANGE:
      return (
        <g>
          <circle cx="50" cy="56" r="32" fill="#fb8c00" stroke="#ef6c00" strokeWidth="3" />
          <path d="M50 24 C56 12 70 10 76 16 C70 24 60 26 50 24Z" fill="#43a047" />
          <circle cx="40" cy="46" r="7" fill="#ffffff" opacity="0.45" />
        </g>
      );
    case PLUM:
      return (
        <g>
          <ellipse cx="50" cy="56" rx="30" ry="34" fill="#6a1b9a" stroke="#4a148c" strokeWidth="3" />
          <path d="M50 24 C50 34 48 44 46 50" stroke="#4a148c" strokeWidth="3" fill="none" />
          <path d="M52 22 C60 10 74 10 78 16 C72 24 62 26 52 22Z" fill="#43a047" />
          <ellipse cx="38" cy="46" rx="7" ry="10" fill="#ffffff" opacity="0.4" />
        </g>
      );
    case BELL:
      return (
        <g>
          <path d="M50 14 C30 14 26 34 26 52 C26 62 20 68 14 74 L86 74 C80 68 74 62 74 52 C74 34 70 14 50 14Z" fill="#ffc107" stroke="#ff8f00" strokeWidth="3" />
          <circle cx="50" cy="80" r="8" fill="#ff8f00" />
          <rect x="46" y="6" width="8" height="10" rx="3" fill="#ff8f00" />
          <path d="M36 30 C34 40 34 50 34 58" stroke="#ffffff" strokeWidth="4" opacity="0.5" strokeLinecap="round" fill="none" />
        </g>
      );
    case MELON:
      return (
        <g>
          <circle cx="50" cy="52" r="36" fill="#2e7d32" />
          <path d="M50 16 C40 30 40 74 50 88 M32 22 C22 38 24 70 34 84 M68 22 C78 38 76 70 66 84" stroke="#a5d6a7" strokeWidth="5" fill="none" />
          <circle cx="38" cy="38" r="6" fill="#ffffff" opacity="0.35" />
        </g>
      );
    case SEVEN:
      return (
        <g>
          <text x="50" y="80" textAnchor="middle" fontSize="84" fontWeight="900" fontFamily="Georgia, serif" fill="#e53935" stroke="#ffd54f" strokeWidth="4" paintOrder="stroke">
            7
          </text>
        </g>
      );
    case BONUS:
      return (
        <g>
          <path d="M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36Z" fill="#ffd54f" stroke="#ff8f00" strokeWidth="3" strokeLinejoin="round" />
          <text x="50" y="64" textAnchor="middle" fontSize="34" fontWeight="900" fontFamily="system-ui, sans-serif" fill="#7a3e00">
            ?
          </text>
        </g>
      );
    // The dancer spans three cells; each part is drawn edge to edge so a full stack reads as one figure.
    case DANCER_HEAD:
      return (
        <g>
          <rect x="0" y="0" width="100" height="100" fill="#4a0d3a" />
          <path d="M30 40 C26 14 74 14 70 40 C74 52 64 60 50 60 C36 60 26 52 30 40Z" fill="#3b1d12" />
          <ellipse cx="50" cy="44" rx="15" ry="18" fill="#f2c19c" />
          <path d="M34 30 C40 18 60 18 66 30 C58 26 42 26 34 30Z" fill="#3b1d12" />
          <path d="M36 10 L44 24 L50 6 L56 24 L64 10 L62 28 L38 28Z" fill="#ffd54f" stroke="#ff8f00" strokeWidth="1.5" />
          <rect x="45" y="60" width="10" height="12" fill="#f2c19c" />
          <path d="M20 100 C22 80 36 72 50 72 C64 72 78 80 80 100Z" fill="#f2c19c" />
          <MultiplierBadge value={3} />
        </g>
      );
    case DANCER_TORSO:
      return (
        <g>
          <rect x="0" y="0" width="100" height="100" fill="#4a0d3a" />
          <path d="M20 0 C14 30 10 50 6 64" stroke="#f2c19c" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M80 0 C86 30 90 50 94 64" stroke="#f2c19c" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M26 0 L74 0 C72 30 66 56 62 70 L38 70 C34 56 28 30 26 0Z" fill="#e91e63" />
          <path d="M30 6 C40 14 60 14 70 6" stroke="#ffd54f" strokeWidth="4" fill="none" />
          <path d="M14 70 C30 62 70 62 86 70 C96 82 86 100 50 100 C14 100 4 82 14 70Z" fill="#f48fb1" stroke="#e91e63" strokeWidth="2" />
          <MultiplierBadge value={2} />
        </g>
      );
    case DANCER_LEGS:
      return (
        <g>
          <rect x="0" y="0" width="100" height="100" fill="#4a0d3a" />
          <path d="M10 0 C20 14 80 14 90 0Z" fill="#f48fb1" />
          <path d="M42 8 L38 84" stroke="#f2c19c" strokeWidth="9" strokeLinecap="round" />
          <path d="M58 8 L64 84" stroke="#f2c19c" strokeWidth="9" strokeLinecap="round" />
          <path d="M30 84 L42 84 L40 94 L26 94Z" fill="#e91e63" />
          <path d="M60 84 L72 84 L76 94 L62 94Z" fill="#e91e63" />
          <MultiplierBadge value={1} />
        </g>
      );
    default:
      return null;
  }
}

/** Plain scatter star (Plenty on Twenty), without the mystery mark. */
export function StarIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Estrella">
      <path d="M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36Z" fill="#ffd54f" stroke="#ff8f00" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="42" cy="46" r="4" fill="#5d3200" />
      <circle cx="58" cy="46" r="4" fill="#5d3200" />
      <path d="M40 58 C46 64 54 64 60 58" stroke="#5d3200" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function MultiplierBadge({ value }: { value: number }) {
  return (
    <g>
      <rect x="66" y="66" width="30" height="24" rx="6" fill="#ffd54f" stroke="#ff8f00" strokeWidth="2" />
      <text x="81" y="84" textAnchor="middle" fontSize="16" fontWeight="900" fontFamily="system-ui, sans-serif" fill="#7a3e00">
        x{value}
      </text>
    </g>
  );
}
