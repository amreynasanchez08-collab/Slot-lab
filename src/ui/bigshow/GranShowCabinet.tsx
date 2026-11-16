import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PAYLINES } from '../../engine/evaluate.ts';
import { BELL, BONUS, CHERRY, DANCER_HEAD, DANCER_LEGS, DANCER_TORSO, LEMON, MELON, ORANGE, PAYS, PLUM, SEVEN } from '../../engine/symbols.ts';
import { FitToWidth } from '../FitToWidth.tsx';
import { formatMoney } from '../format.ts';
import { Reels, type ReelSpin } from '../Reels.tsx';
import { GranShowSymbol } from './GranShowSymbols.tsx';

export const CELL = 136;
const REELS_WIDTH = 3 * CELL + 2 * 10;
const REELS_HEIGHT = 3 * CELL;

/** Line colours, index = line - 1; drawn over the reels on a win. */
export const LINE_COLORS: readonly string[] = ['#ff3b3b', '#ffd23f', '#3fd0ff', '#7dff5a', '#ff7ae0'];

/**
 * Line numbers down each side, top to bottom, at the row where each line starts (left) or
 * ends (right): 4 and 2 on top, 1 in the middle, 3 and 5 below, mirrored for the diagonals.
 */
const LEFT_NUMBERS = [4, 2, 1, 3, 5];
const RIGHT_NUMBERS = [5, 2, 1, 3, 4];
const NUMBER_Y = [0.13, 0.3, 0.5, 0.7, 0.87];

/** Damask wallpaper behind the machine, as a small repeating tile. */
const DAMASK = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><g fill='none' stroke='#9a1828' stroke-width='1.4' opacity='0.5'><path d='M32 8C26 16 26 24 32 30C38 24 38 16 32 8Z'/><path d='M32 30C24 30 18 36 20 44C26 42 30 36 32 30ZM32 30C40 30 46 36 44 44C38 42 34 36 32 30Z'/><path d='M32 30V52M26 52H38'/><circle cx='0' cy='0' r='6'/><circle cx='64' cy='0' r='6'/><circle cx='0' cy='64' r='6'/><circle cx='64' cy='64' r='6'/></g></svg>",
)}")`;

const FOCUS = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fff2a8]';
const DISABLED = 'disabled:saturate-[.35] disabled:brightness-75';
const GOLD_TEXT = 'bg-gradient-to-b from-[#fff7c8] via-[#ffd84a] to-[#9a6400] bg-clip-text text-transparent';

const money = (cents: number) => formatMoney(cents).replace('$', '');

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Counts a new win up from zero, as a machine's win meter does; instant in turbo. */
function useCountUp(value: number, instant: boolean): number {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current === value || value === 0 ? value : 0;
    prev.current = value;
    if (from === value || instant || prefersReducedMotion()) {
      setShown(value);
      return;
    }
    const duration = Math.min(1400, 400 + value / 20);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, instant]);
  return shown;
}

/** Win amount; a component of its own so counting re-renders only this text. */
function WinMeter({ value, instant }: { value: number; instant: boolean }) {
  return <>{money(useCountUp(value, instant))}</>;
}

/** Marquee sign: gold letters on a red ribbon under an arc of chasing bulbs. */
function Marquee({ freeGames }: { freeGames: boolean }) {
  const bulbs = Array.from({ length: 23 }, (_, i) => {
    const t = i / 22;
    // Quadratic arc from (24,48) through the control point (220,-14) to (416,48).
    const x = (1 - t) ** 2 * 24 + 2 * (1 - t) * t * 220 + t ** 2 * 416;
    const y = (1 - t) ** 2 * 48 + 2 * (1 - t) * t * -14 + t ** 2 * 48;
    return { x, y };
  });
  return (
    <svg viewBox="0 0 440 112" width={440} height={112} className="mx-auto block drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]" role="img" aria-label="Gran Show">
      <path d="M14 66 Q220 98 426 66 L436 92 L414 90 Q220 122 26 90 L4 92Z" fill="#7a0010" stroke="#3a0006" strokeWidth="2" />
      <path d="M24 62 Q220 94 416 62 L416 88 Q220 120 24 88Z" fill={freeGames ? '#a0156e' : '#c4001e'} stroke="url(#gs-gold)" strokeWidth="3" />
      <g>
        {bulbs.map((b) => (
          <circle key={b.x} className="bulb" cx={b.x} cy={b.y} r="4.2" fill="#fff4c0" stroke="#b07a00" strokeWidth="1.2" />
        ))}
      </g>
      <text
        x="220"
        y="80"
        textAnchor="middle"
        fontSize="62"
        fontWeight="900"
        fontStyle="italic"
        fontFamily="Georgia, 'Times New Roman', serif"
        fill="url(#gs-gold)"
        stroke="#3a1800"
        strokeWidth="4"
        paintOrder="stroke"
        letterSpacing="1"
      >
        Gran Show
      </text>
      <path transform="translate(372 30) scale(1.1)" d="M0 -8 L1.5 -1.5 L8 0 L1.5 1.5 L0 8 L-1.5 1.5 L-8 0 L-1.5 -1.5Z" fill="#fff" />
      <path transform="translate(74 40) scale(0.8)" d="M0 -8 L1.5 -1.5 L8 0 L1.5 1.5 L0 8 L-1.5 1.5 L-8 0 L-1.5 -1.5Z" fill="#fff" />
    </svg>
  );
}

function LineNumbers({ order, winning }: { order: number[]; winning: Set<number> }) {
  return (
    <div className="relative hidden w-11 sm:block" style={{ height: REELS_HEIGHT }} aria-hidden>
      {order.map((n, i) => {
        const on = winning.has(n);
        return (
          <span
            key={n}
            className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 font-serif text-[38px] font-black leading-none transition ${GOLD_TEXT} ${
              on ? 'scale-125 drop-shadow-[0_0_10px_rgba(255,220,90,0.95)]' : 'drop-shadow-[0_2px_0_#2a0a00]'
            }`}
            style={{ top: `${NUMBER_Y[i] * 100}%`, opacity: winning.size > 0 && !on ? 0.45 : 1 }}
          >
            {n}
          </span>
        );
      })}
    </div>
  );
}

function GoldButton({ label, onClick, disabled, active, children, className = '' }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`${FOCUS} ${DISABLED} flex h-11 items-center justify-center rounded-lg border-2 font-black uppercase leading-none text-[#4a0610] shadow-[inset_0_2px_0_rgba(255,255,255,0.6),0_3px_0_#6b3f00] transition active:translate-y-0.5 ${
        active ? 'border-white bg-gradient-to-b from-[#fffbe0] to-[#ffc21a]' : 'border-[#ffe9a0]/70 bg-gradient-to-b from-[#ffe58a] via-[#f2b81c] to-[#b47800]'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export interface Banner {
  id: number;
  title: string;
  amount?: number;
}

interface CabinetProps {
  grid: number[];
  spin: ReelSpin | null;
  winLines: number[];
  /** Free-game wins: cells to ring (anywhere wins have no line). */
  winCells: number[];
  pulse: number[];
  balance: number;
  bet: number;
  lastWin: number;
  freeGamesLeft: number;
  freeGamesPlayed: number;
  inRound: boolean;
  spinning: boolean;
  auto: boolean;
  turbo: boolean;
  canBetDown: boolean;
  canBetUp: boolean;
  onBet: (direction: 1 | -1) => void;
  onMaxBet: () => void;
  onTurbo: () => void;
  onAuto: () => void;
  onSpin: () => void;
  onStopped: () => void;
  banner: Banner | null;
}

export function GranShowCabinet(p: CabinetProps) {
  const [info, setInfo] = useState(false);
  const winning = new Set(p.winLines.map((l) => l + 1));

  return (
    <>
      <FitToWidth>
        <div className="w-fit overflow-hidden rounded-2xl bg-black shadow-2xl ring-2 ring-[#c99a2e]/60">
          {/* status strip */}
          <div className="flex items-center justify-center gap-6 bg-gradient-to-b from-[#1c0205] to-black px-4 py-1.5 text-sm font-bold text-[#f6e3b0]">
            <span>
              SALDO <span className="text-[#ffd84a]">{money(p.balance)}</span>
            </span>
            <span>
              APUESTA <span className="text-[#ffd84a]">{money(p.bet)}</span>
            </span>
            <span>
              GANANCIA <span className="text-[#ffd84a]"><WinMeter value={p.lastWin} instant={p.turbo} /></span>
            </span>
          </div>

          <div
            className="relative px-3 pb-4 pt-2 sm:px-6 sm:pb-5"
            style={{
              backgroundColor: p.inRound ? '#3a0638' : '#4a0710',
              backgroundImage: `radial-gradient(ellipse at 50% 35%, rgba(255,90,90,0.18), transparent 60%), radial-gradient(ellipse at 50% 120%, rgba(0,0,0,0.6), transparent 60%), ${DAMASK}`,
              transition: 'background-color 600ms',
            }}
          >
            <Marquee freeGames={p.inRound} />
            <p className={`-mt-1 mb-2 h-5 text-center text-xs font-bold uppercase tracking-[0.2em] ${p.inRound ? 'text-pink-200' : 'text-[#f6d98a]/80'}`}>
              {p.inRound
                ? `Juego gratis ${p.freeGamesPlayed + 1} de ${p.freeGamesPlayed + p.freeGamesLeft} · cualquier trío paga`
                : '3 bailarinas completas = 15 juegos gratis'}
            </p>

            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <LineNumbers order={LEFT_NUMBERS} winning={winning} />
              <div className="relative rounded-xl bg-gradient-to-b from-[#f7d36a] via-[#b47800] to-[#f7d36a] p-[5px] shadow-[0_0_24px_rgba(255,200,80,0.25)]">
                <div className="relative rounded-lg bg-[#1a0306] p-2">
                  <Reels
                    grid={p.grid}
                    spin={p.spin}
                    paylines={PAYLINES}
                    lineColors={LINE_COLORS}
                    renderSymbol={(sym, cell) => <GranShowSymbol id={sym} size={sym >= DANCER_HEAD ? cell : cell - 14} />}
                    cell={CELL}
                    variant="drum"
                    lines={p.winLines}
                    cells={p.winCells}
                    pulse={p.pulse}
                    instant={p.turbo}
                    onStopped={p.onStopped}
                  />
                  {p.banner && (
                    <div key={p.banner.id} className="banner-pop pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                      <div className="rounded-2xl border-4 border-[#ffe27a] bg-[radial-gradient(circle_at_50%_30%,#e0002a,#7a0010)] px-6 py-4 text-center shadow-[0_0_40px_rgba(255,210,80,0.7)]">
                        <p className={`font-serif text-3xl font-black italic ${GOLD_TEXT} drop-shadow-[0_2px_0_#2a0a00]`}>{p.banner.title}</p>
                        {p.banner.amount !== undefined && <p className="mt-1 font-mono text-2xl font-bold text-white">{formatMoney(p.banner.amount)}</p>}
                      </div>
                    </div>
                  )}
                  {info && (
                    <div className="absolute inset-0 z-20 p-2">
                      <Paytable bet={p.bet} onClose={() => setInfo(false)} />
                    </div>
                  )}
                </div>
              </div>
              <LineNumbers order={RIGHT_NUMBERS} winning={winning} />
            </div>

            {/* control bar, desktop */}
            <div className="mx-auto mt-4 hidden items-center justify-between gap-1.5 sm:flex" style={{ width: REELS_WIDTH + 2 * 52 + 26 }}>
              <GoldButton label="Tabla de pagos" onClick={() => setInfo((v) => !v)} active={info} className="w-12">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-[#4a0610] font-serif text-base">i</span>
              </GoldButton>
              <div className="flex h-11 items-stretch rounded-lg border border-[#c99a2e] bg-gradient-to-b from-[#2a0408] to-black p-1">
                <button type="button" aria-label="Bajar apuesta" onClick={() => p.onBet(-1)} disabled={!p.canBetDown} className={`${FOCUS} ${DISABLED} w-8 rounded bg-gradient-to-b from-[#ffe58a] to-[#b47800] text-xl font-black text-[#4a0610]`}>
                  −
                </button>
                <div className="flex w-20 flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-[#f6e3b0]">APUESTA</span>
                  <span className="font-mono text-base font-bold leading-none text-[#ffd84a]">{money(p.bet)}</span>
                </div>
                <button type="button" aria-label="Subir apuesta" onClick={() => p.onBet(1)} disabled={!p.canBetUp} className={`${FOCUS} ${DISABLED} w-8 rounded bg-gradient-to-b from-[#ffe58a] to-[#b47800] text-xl font-black text-[#4a0610]`}>
                  +
                </button>
              </div>
              <GoldButton label="Apuesta máxima" onClick={p.onMaxBet} disabled={!p.canBetUp} className="w-12 text-[11px]">
                <span className="text-center">
                  MAX
                  <br />
                  BET
                </span>
              </GoldButton>
              <GoldButton label="Turbo" onClick={p.onTurbo} active={p.turbo} className="w-12 text-[10px]">
                TURBO
              </GoldButton>
              <GoldButton label="Juego automático" onClick={p.onAuto} active={p.auto} className="w-12 text-[10px]">
                {p.auto ? 'PARAR' : 'AUTO'}
              </GoldButton>
              <SpinButton {...p} />
            </div>
          </div>
        </div>
      </FitToWidth>
      <MobileControls {...p} info={info} onInfo={() => setInfo((v) => !v)} />
    </>
  );
}

function SpinButton(p: CabinetProps) {
  return (
    <button
      type="button"
      aria-label={p.freeGamesLeft > 0 ? 'Juego gratis' : 'Girar'}
      onClick={p.onSpin}
      disabled={p.spinning || p.auto}
      className={`${FOCUS} ${DISABLED} flex h-[76px] w-[76px] shrink-0 flex-col items-center justify-center rounded-full border-4 border-[#ffe27a] bg-[radial-gradient(circle_at_40%_30%,#ff8a8a,#e0001e_50%,#6e0010)] font-black leading-none text-white shadow-[0_4px_0_#4a0008,0_0_20px_rgba(255,80,80,0.45)] transition active:translate-y-0.5`}
    >
      {p.freeGamesLeft > 0 ? (
        <>
          <span className="text-[10px]">GRATIS</span>
          <span className="text-2xl">{p.freeGamesLeft}</span>
        </>
      ) : (
        <span className="text-sm tracking-wide">GIRAR</span>
      )}
    </button>
  );
}

/** In-game paytable, in money at the current bet. */
function Paytable({ bet, onClose }: { bet: number; onClose: () => void }) {
  const lineBet = bet / 5;
  const rows = [SEVEN, MELON, BELL, PLUM, ORANGE, LEMON, CHERRY];
  return (
    <div className="flex h-full flex-col overflow-y-auto rounded-lg border-2 border-[#c99a2e] bg-[#3a0610] p-3 text-[#f6e3b0]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className={`font-serif text-lg font-black ${GOLD_TEXT}`}>Tabla · apuesta {formatMoney(bet)}</h3>
        <button type="button" onClick={onClose} className="rounded bg-gradient-to-b from-[#ffe58a] to-[#b47800] px-3 py-1 text-sm font-bold text-[#4a0610]">
          Volver
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {rows.map((id) => (
          <div key={id} className="flex items-center gap-1 rounded-md bg-black/40 px-2 py-1">
            <GranShowSymbol id={id} size={34} />
            <span className="text-xs text-[#f6d98a]/70">x3</span>
            <span className="ml-auto font-mono text-sm font-bold text-[#ffd84a]">{formatMoney(PAYS[id] * lineBet)}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 rounded-md bg-black/40 px-2 py-1">
          <GranShowSymbol id={BONUS} size={34} />
          <span className="ml-auto text-right text-[11px] leading-tight">Premio misterioso de la tabla</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-md bg-black/40 p-2 text-[11px] leading-snug">
        <div className="flex shrink-0">
          {[DANCER_HEAD, DANCER_TORSO, DANCER_LEGS].map((id) => (
            <GranShowSymbol key={id} id={id} size={26} />
          ))}
        </div>
        <p>
          La bailarina completa en los 3 rodillos da 15 juegos gratis. En los juegos gratis paga cualquier trío en pantalla y la bailarina sustituye y
          multiplica: cabeza x3, torso x2, piernas x1.
        </p>
      </div>
      <p className="mt-2 text-[11px] text-[#f6e3b0]/70">Premios por línea con 3 iguales en las 5 líneas: 3 horizontales y 2 diagonales.</p>
    </div>
  );
}

/** Thumb-sized controls under the machine on phones. */
function MobileControls(p: CabinetProps & { info: boolean; onInfo: () => void }) {
  const pill = `${FOCUS} ${DISABLED} flex h-12 items-center justify-center rounded-xl border-2 border-[#ffe9a0]/70 bg-gradient-to-b from-[#ffe58a] via-[#f2b81c] to-[#b47800] font-black text-[#4a0610] shadow-[0_3px_0_#6b3f00] active:translate-y-0.5`;
  const on = 'from-[#fffbe0] via-[#ffd84a] to-[#ffc21a] border-white';
  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-[#2a0408] p-3 sm:hidden">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Readout label="Saldo" value={money(p.balance)} />
        <Readout label="Apuesta" value={money(p.bet)} />
        <Readout label="Ganancia" value={<WinMeter value={p.lastWin} instant={p.turbo} />} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" aria-label="Bajar apuesta" onClick={() => p.onBet(-1)} disabled={!p.canBetDown} className={`${pill} text-2xl`}>
          −
        </button>
        <button type="button" aria-label="Subir apuesta" onClick={() => p.onBet(1)} disabled={!p.canBetUp} className={`${pill} text-2xl`}>
          +
        </button>
        <button type="button" onClick={p.onMaxBet} disabled={!p.canBetUp} className={`${pill} text-sm`}>
          MÁX
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" aria-label="Tabla de pagos" onClick={p.onInfo} className={`${pill} font-serif text-xl ${p.info ? on : ''}`}>
          i
        </button>
        <button type="button" aria-pressed={p.turbo} onClick={p.onTurbo} className={`${pill} text-xs ${p.turbo ? on : ''}`}>
          TURBO
        </button>
        <button type="button" aria-pressed={p.auto} onClick={p.onAuto} className={`${pill} text-xs ${p.auto ? on : ''}`}>
          {p.auto ? 'PARAR' : 'AUTO'}
        </button>
      </div>
      <button
        type="button"
        onClick={p.onSpin}
        disabled={p.spinning || p.auto}
        className={`${FOCUS} ${DISABLED} h-16 w-full rounded-2xl border-4 border-[#ffe27a] bg-[radial-gradient(circle_at_40%_30%,#ff8a8a,#e0001e_50%,#6e0010)] text-xl font-black text-white shadow-[0_4px_0_#4a0008]`}
      >
        {p.freeGamesLeft > 0 ? `JUEGO GRATIS (${p.freeGamesLeft})` : 'GIRAR'}
      </button>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-black/60 px-2 py-1.5">
      <p className="text-[10px] font-bold uppercase text-[#f6e3b0]/80">{label}</p>
      <p className="font-mono text-base font-bold text-[#ffd84a]">{value}</p>
    </div>
  );
}
