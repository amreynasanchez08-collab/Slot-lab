import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { WHEEL_SECTORS } from '../../fuego/wheel.ts';

const SIZE = 460;
const CX = 230;
const CY = 250;
const R = 200;
/** Rim bulbs, spread evenly between the dividers. */
const BULBS = 16;

const pt = (r: number, deg: number) => [CX + r * Math.sin((deg * Math.PI) / 180), CY - r * Math.cos((deg * Math.PI) / 180)];
function sector(a0: number, a1: number): string {
  const [x0, y0] = pt(R, a0);
  const [x1, y1] = pt(R, a1);
  return `M${CX} ${CY} L${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Props {
  /** Sector to land on; null while waiting for the spin. */
  target: number | null;
  turbo: boolean;
  onSpin: () => void;
  /** Called once the wheel has stopped on the target (the winning sector starts blinking). */
  onStopped: () => void;
}

/** The wheel: 8 equal sectors, rim bulbs, a flame pointer at the top and a spin button in the hub. */
export function FuegoWheel({ target, turbo, onSpin, onStopped }: Props) {
  const [angle, setAngle] = useState(0);
  const [duration, setDuration] = useState(0);
  const [landed, setLanded] = useState(false);
  const angleRef = useRef(0);
  const onStoppedRef = useRef(onStopped);
  onStoppedRef.current = onStopped;

  useLayoutEffect(() => {
    if (target === null) {
      setLanded(false);
      return;
    }
    // Sector i is centred at i * 45 degrees; turning the wheel by -i * 45 brings it under the pointer.
    const jitter = (Math.random() - 0.5) * 28;
    const desired = (((360 - target * 45 + jitter) % 360) + 360) % 360;
    const current = ((angleRef.current % 360) + 360) % 360;
    let delta = desired - current;
    if (delta <= 0) delta += 360;
    const instant = prefersReducedMotion();
    const turns = instant ? 0 : turbo ? 1 : 5;
    const ms = instant ? 0 : turbo ? 900 : 4_600;
    const next = angleRef.current + turns * 360 + delta;
    angleRef.current = next;
    setDuration(ms);
    setAngle(next);
    const timer = window.setTimeout(() => {
      setLanded(true);
      onStoppedRef.current();
    }, ms + 150);
    return () => window.clearTimeout(timer);
    // turbo is read once per spin on purpose.
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (target !== null) return;
    const t = window.setInterval(() => setPulse((p) => !p), 600);
    return () => window.clearInterval(t);
  }, [target]);

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE + 20 }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE + 20}`} width={SIZE} height={SIZE + 20} aria-hidden>
        <g
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transformBox: 'view-box',
            transition: duration ? `transform ${duration}ms cubic-bezier(0.12, 0.62, 0.12, 1)` : 'none',
          }}
        >
          {WHEEL_SECTORS.map((s, i) => (
            <path key={`s${i}`} d={sector(i * 45 - 22.5, i * 45 + 22.5)} fill={s.kind === 'multiplier' ? 'url(#fg-wheel-m)' : 'url(#fg-wheel-f)'} />
          ))}
          {landed && target !== null && <path key={`flash-${angle}`} className="sector-flash" d={sector(target * 45 - 22.5, target * 45 + 22.5)} fill="#fff" />}
          {WHEEL_SECTORS.map((_, i) => {
            const [x, y] = pt(R, i * 45 - 22.5);
            return <line key={`d${i}`} x1={CX} y1={CY} x2={x} y2={y} stroke="#ffd56b" strokeWidth={3} />;
          })}
          {WHEEL_SECTORS.map((s, i) => (
            <g key={`t${i}`} transform={`rotate(${i * 45} ${CX} ${CY})`}>
              {s.kind === 'multiplier' ? (
                <text x={CX} y={CY - R * 0.6} textAnchor="middle" fontFamily="Arial Black, Impact, sans-serif" fontWeight={900} fontSize={R * 0.2} fill="#ffd56b" stroke="#4a0508" strokeWidth={5} paintOrder="stroke">
                  x{s.value}
                </text>
              ) : (
                <>
                  <text x={CX} y={CY - R * 0.62} textAnchor="middle" fontFamily="Arial Black, Impact, sans-serif" fontWeight={900} fontSize={R * 0.24} fill="#b3121f" stroke="#fff3c8" strokeWidth={5} paintOrder="stroke">
                    {s.value}
                  </text>
                  <text x={CX} y={CY - R * 0.46} textAnchor="middle" fontFamily="Arial Black, Impact, sans-serif" fontWeight={700} fontSize={R * 0.085} letterSpacing={2} fill="#b3121f">
                    GIROS
                  </text>
                </>
              )}
            </g>
          ))}
        </g>
        {/* rim, bulbs and pointer stay still */}
        <circle cx={CX} cy={CY} r={R + 7} fill="none" stroke="url(#fg-gold)" strokeWidth={16} />
        <circle cx={CX} cy={CY} r={R - 2} fill="none" stroke="#000" strokeOpacity={0.3} strokeWidth={3} />
        <g>
          {Array.from({ length: BULBS }, (_, i) => {
            const [x, y] = pt(R + 7, (i * 360) / BULBS + 360 / BULBS / 2);
            return <circle key={i} className="bulb" cx={x} cy={y} r={5} fill="#fff4c0" stroke="#c98a12" strokeWidth={1.5} />;
          })}
        </g>
        {/* flame pointer: gold with a red heart, tip into the wheel */}
        <g transform={`translate(${CX} ${CY - R - 4})`}>
          <path d="M0 22 C-16 12 -22 -6 -12 -22 C-12 -10 -6 -8 -4 -14 C-6 -24 0 -34 6 -42 C8 -28 20 -20 20 -4 C20 10 12 18 0 22 Z" fill="url(#fg-gold)" stroke="#7a4a06" strokeWidth={2} />
          <path d="M0 14 C-8 8 -10 -2 -5 -10 C-4 -4 0 -4 1 -8 C1 -14 4 -18 7 -22 C8 -14 12 -8 12 0 C12 8 6 12 0 14 Z" fill="#e3222f" />
        </g>
      </svg>
      <button
        type="button"
        onClick={onSpin}
        disabled={target !== null}
        aria-label="Girar la rueda"
        className="absolute flex items-center justify-center rounded-full border-[5px] border-[#f5c542] bg-[#7a0d1c] font-black text-[#ffd56b] shadow-[0_0_18px_rgba(255,170,40,0.6)] outline-none transition focus-visible:ring-4 focus-visible:ring-white disabled:cursor-default"
        style={{ left: CX - 46, top: CY - 46, width: 92, height: 92, transform: target === null && pulse ? 'scale(1.06)' : undefined }}
      >
        GIRAR
      </button>
    </div>
  );
}
