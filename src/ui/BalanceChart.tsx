import type { BalancePoint } from '../engine/simulate.ts';
import { formatInt, formatMoney } from './format.ts';

const W = 900;
const H = 300;
const PAD = { top: 16, right: 16, bottom: 32, left: 84 };

interface Props {
  curve: BalancePoint[];
  startBalance: number;
  bet: number;
  bustSpin: number | null;
}

/** Balance over the run: min-max band per bucket plus the closing line. */
export function BalanceChart({ curve, startBalance, bet, bustSpin }: Props) {
  const last = curve[curve.length - 1]?.spin ?? 1;
  const lo = Math.min(0, ...curve.map((p) => p.min));
  const hi = Math.max(startBalance, ...curve.map((p) => p.max));
  const span = hi - lo || 1;
  const x = (spin: number) => PAD.left + (spin / last) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / span) * (H - PAD.top - PAD.bottom);

  const band =
    curve.map((p) => `${x(p.spin)},${y(p.max)}`).join(' ') +
    ' ' +
    [...curve].reverse().map((p) => `${x(p.spin)},${y(p.min)}`).join(' ');
  const line = curve.map((p) => `${x(p.spin)},${y(p.close)}`).join(' ');
  const ticks = [lo, lo + span / 2, hi];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Curva de saldo de la simulación">
      <defs>
        <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#262626" />
          <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="#a3a3a3">
            {formatMoney(t)}
          </text>
        </g>
      ))}
      <line x1={PAD.left} x2={W - PAD.right} y1={y(startBalance)} y2={y(startBalance)} stroke="#a3a3a3" strokeDasharray="6 4" />
      <text x={W - PAD.right} y={y(startBalance) - 6} textAnchor="end" fontSize="11" fill="#d4d4d4">
        Saldo inicial
      </text>
      {lo < bet && (
        <line x1={PAD.left} x2={W - PAD.right} y1={y(bet)} y2={y(bet)} stroke="#ef4444" strokeOpacity="0.6" strokeDasharray="2 4" />
      )}
      <polygon points={band} fill="url(#band)" />
      <polyline points={line} fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinejoin="round" />
      {bustSpin !== null && (
        <g>
          <line x1={x(bustSpin)} x2={x(bustSpin)} y1={PAD.top} y2={H - PAD.bottom} stroke="#ef4444" strokeDasharray="4 3" />
          <text x={x(bustSpin) + 6} y={H - PAD.bottom - 8} fontSize="12" fill="#fca5a5">
            Saldo agotado (giro {formatInt(bustSpin)})
          </text>
        </g>
      )}
      <text x={PAD.left} y={H - 8} fontSize="12" fill="#a3a3a3">
        0
      </text>
      <text x={W - PAD.right} y={H - 8} textAnchor="end" fontSize="12" fill="#a3a3a3">
        {formatInt(last)} giros
      </text>
    </svg>
  );
}
