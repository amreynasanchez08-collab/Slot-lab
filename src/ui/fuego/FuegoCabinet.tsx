import { useEffect, useState, type ReactNode } from 'react';
import { GAMBLE_LIMIT_X, MAX_GAMBLES } from '../../fuego/session.ts';
import { BELL, CHERRY, GRAPES, LEMON, MELON, ORANGE, PAYS, PEAR, PLUM, SEVEN, WHEEL, WILD } from '../../fuego/symbols.ts';
import { WHEEL_SECTORS } from '../../fuego/wheel.ts';
import { FitToWidth } from '../FitToWidth.tsx';
import { formatMoney } from '../format.ts';
import { Reels, type ReelSpin } from '../Reels.tsx';
import { FuegoCell, FuegoIcon } from './FuegoSymbols.tsx';

export const CELL_W = 196;
export const CELL_H = 124;
const GAP = 10;
const REELS_W = 3 * CELL_W + 2 * GAP;
const REELS_H = 3 * CELL_H;

const FOCUS = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
const BACKDROP = 'radial-gradient(ellipse 75% 80% at 50% 42%, #ffcf6a 0%, #f59a24 35%, #c9560c 70%, #6e2205 100%)';
/** During free spins the room turns a deeper red. */
const BACKDROP_FREE = 'radial-gradient(ellipse 75% 80% at 50% 42%, #ff9a3a 0%, #ff7a1a 20%, #b8140c 62%, #4a0505 100%)';
const CAPTION = 'text-[11px] font-bold tracking-[0.15em] text-[#fff3d6] [text-shadow:0_1px_0_#5a1406]';

export interface Banner {
  id: number;
  title: string;
  /** Cents, counted up when shown. */
  amount?: number;
}

export interface CabinetProps {
  grid: number[];
  spin: ReelSpin | null;
  /** Cells of the shown win: flames and gold frames once the reels stop. */
  hotCells: number[];
  balance: number;
  bet: number;
  /** Figure in the win box and its label. */
  winValue: number;
  winLabel: string;
  /** Line under the reels. */
  message: string;
  freeMode: boolean;
  /** "3/10" while a free-spin round runs, else null. */
  freeCounter: string | null;
  spinning: boolean;
  auto: boolean;
  turbo: boolean;
  /** Bet ladder; the bar shows five chips at a time. */
  levels: readonly number[];
  betLocked: boolean;
  canBetDown: boolean;
  canBetUp: boolean;
  onBetPick: (bet: number) => void;
  onBet: (direction: 1 | -1) => void;
  canGamble: boolean;
  onGamble: () => void;
  onTurbo: () => void;
  onAuto: () => void;
  onSpin: () => void;
  spinDisabled: boolean;
  onStopped: () => void;
  /** Screen over the reels (gamble), or null. */
  overlay: ReactNode;
  /** Wheel shown over the whole cabinet, or null. */
  wheel: ReactNode;
  /** Seconds before the wheel turns by itself, or null. */
  countdown: number | null;
  countdownTotal: number;
  banner: Banner | null;
}

function Title({ freeCounter }: { freeCounter: string | null }) {
  if (freeCounter) {
    return (
      <div className="flex h-[44px] items-center gap-3 rounded-full border-2 border-[#f5c542] bg-[#4a0508]/85 px-6 shadow-[0_0_18px_rgba(255,180,60,0.6)]">
        <span className="gold-text text-[22px] font-black italic tracking-wide">GIROS GRATIS</span>
        <span className="casino-num text-[26px] text-white">{freeCounter}</span>
      </div>
    );
  }
  return (
    <svg viewBox="0 0 300 50" width={260} height={44} aria-label="Fuego 27" role="img">
      <text x="150" y="40" textAnchor="middle" fontFamily="Arial Black, Impact, sans-serif" fontSize="38" fontStyle="italic">
        <tspan fill="url(#fg-title)" stroke="#5a1406" strokeWidth={5} paintOrder="stroke">
          FUEGO
        </tspan>
        <tspan dx="12" fill="url(#fg-lin-red)" stroke="#ffd56b" strokeWidth={5} paintOrder="stroke">
          27
        </tspan>
      </text>
    </svg>
  );
}

function WaysBadge() {
  return (
    <div className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full border-4 border-[#f5c542] bg-[radial-gradient(circle_at_40%_30%,#a8192c,#5a0812)] shadow-[0_6px_16px_rgba(0,0,0,0.35),inset_0_2px_0_rgba(255,255,255,0.25)]" title="27 formas de ganar">
      <span className="gold-text font-['Arial_Black',Impact,sans-serif] text-[42px] font-black leading-none">27</span>
      <span className="mt-1 text-[11px] font-extrabold tracking-[0.18em] text-[#ffe27a]">FORMAS</span>
    </div>
  );
}

/** Embers rising through the room: fixed positions so every render is the same. */
const EMBERS = [
  [6, 2, 7.5, 0], [14, 3, 9, -2.4], [22, 2, 6.5, -4.1], [31, 4, 8.2, -1.2], [44, 2, 10, -6.3], [53, 3, 7, -3.3],
  [61, 2, 9.4, -0.6], [70, 4, 6.8, -5.2], [78, 2, 8.6, -2.9], [86, 3, 7.4, -4.6], [93, 2, 9.8, -1.7], [38, 3, 8.8, -7.1],
];
function Embers() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {EMBERS.map(([left, size, dur, delay], i) => (
        <span
          key={i}
          className="ember absolute rounded-full bg-[#ffd36b] shadow-[0_0_6px_2px_rgba(255,140,30,0.8)]"
          style={{ left: `${left}%`, bottom: -8, width: size, height: size, animationDuration: `${dur}s`, animationDelay: `${delay}s` }}
        />
      ))}
      {/* heat glow under the reel window */}
      <div className="absolute inset-x-[15%] bottom-[60px] h-24 rounded-[50%] bg-[#ff7a00]/30 blur-2xl" />
    </div>
  );
}

function RoundButton({ label, caption, onClick, disabled, active, glow, children }: { label: string; caption: string; onClick: () => void; disabled?: boolean; active?: boolean; glow?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        title={label}
        onClick={onClick}
        disabled={disabled}
        className={`${FOCUS} flex h-12 w-12 items-center justify-center rounded-full border-[3px] text-[#ffe7a3] shadow-[0_3px_0_rgba(0,0,0,0.35)] transition active:translate-y-0.5 disabled:opacity-35 ${
          active ? 'border-white bg-[#a8410a]' : 'border-[#f5c542] bg-[#2a0d05]'
        } ${glow ? 'x2-ready' : ''}`}
      >
        {children}
      </button>
      <span className={CAPTION}>{caption}</span>
    </div>
  );
}

function SpinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="-32 -32 64 64" className={className} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={7} strokeLinecap="round">
        <path d="M-24 4 A24 24 0 0 1 14 -19" />
        <path d="M24 -4 A24 24 0 0 1 -14 19" />
      </g>
      <path d="M8 -30 L26 -18 L6 -10 Z M-8 30 L-26 18 L-6 10 Z" fill="currentColor" />
    </svg>
  );
}

/** The big spin button: spins, stops auto play, or counts the free spins that play by themselves. */
function SpinButton({ p, size }: { p: CabinetProps; size: number }) {
  const base = `${FOCUS} flex shrink-0 flex-col items-center justify-center rounded-full border-[5px] border-[#f5c542] bg-[radial-gradient(circle_at_40%_30%,#3a1206,#160502)] text-[#ffd56b] shadow-[0_0_26px_8px_rgba(255,154,26,0.45),0_5px_0_rgba(0,0,0,0.35)] transition active:translate-y-0.5`;
  const style = { width: size, height: size };
  if (p.freeCounter) {
    return (
      <div className={`${base} animate-pulse`} style={style} role="status" aria-label={`Giros gratis: ${p.freeCounter}, juegan solos`}>
        <span className="casino-num text-[26px] leading-none text-white">{p.freeCounter}</span>
        <span className="text-[10px] font-extrabold tracking-[0.15em]">GRATIS</span>
      </div>
    );
  }
  if (p.auto) {
    return (
      <button type="button" aria-label="Detener el juego automático" title="Detener el automático" onClick={p.onAuto} className={base} style={style}>
        <span className="block rounded-sm bg-current" style={{ width: size * 0.28, height: size * 0.28 }} aria-hidden />
      </button>
    );
  }
  return (
    <button type="button" aria-label="Girar" title="Girar (barra espaciadora)" onClick={p.onSpin} disabled={p.spinDisabled} className={`${base} disabled:opacity-45`} style={style}>
      <SpinIcon className="h-1/2 w-1/2" />
    </button>
  );
}

const money = (cents: number) => formatMoney(cents);

/** Counts a prize up from zero in about 1.2 s (instant with reduced motion). */
function useCountUp(target: number, key: number): number {
  const [value, setValue] = useState(target);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || target === 0) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1_200);
      setValue(Math.round((target * (1 - Math.pow(1 - t, 3))) / 10) * 10);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, key]);
  return value;
}

function BannerView({ banner }: { banner: Banner }) {
  const amount = useCountUp(banner.amount ?? 0, banner.id);
  return (
    <div key={banner.id} className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      <div className="banner-pop relative">
        <div className="rays absolute left-1/2 top-1/2 -ml-[260px] -mt-[260px] h-[520px] w-[520px] rounded-full bg-[repeating-conic-gradient(rgba(255,255,255,0.09)_0deg_8deg,transparent_8deg_22deg)] [mask-image:radial-gradient(circle,black_30%,transparent_70%)]" />
        <div className="relative rounded-2xl border-4 border-[#f5c542] bg-gradient-to-b from-[#8a1020] to-[#3a0508] px-10 py-5 text-center shadow-[0_0_44px_rgba(255,150,30,0.75),inset_0_2px_0_rgba(255,255,255,0.3)]">
          <p className="gold-text font-['Arial_Black',Impact,sans-serif] text-[44px] font-black italic leading-tight">{banner.title}</p>
          {banner.amount !== undefined && <p className="gold-text casino-num mt-1 text-[48px] leading-none">{money(amount)}</p>}
        </div>
      </div>
    </div>
  );
}

/** Five chips at a time; the arrows page through the ladder without touching the bet. */
function BetChips({ p }: { p: CabinetProps }) {
  const n = p.levels.length;
  const pageOf = (bet: number) => {
    const i = Math.max(0, p.levels.findIndex((l) => l >= bet));
    return Math.min(Math.floor(i / 5) * 5, Math.max(0, n - 5));
  };
  const [start, setStart] = useState(() => pageOf(p.bet));
  // A bet changed elsewhere (settings, phone buttons) brings its page into view.
  useEffect(() => {
    if (!p.levels.slice(start, start + 5).includes(p.bet)) setStart(pageOf(p.bet));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.bet]);
  const arrow = `${FOCUS} flex h-10 w-8 items-center justify-center rounded-md text-2xl font-black text-[#ffd99a] hover:bg-black/20 disabled:opacity-30`;
  return (
    <div className="mx-auto flex items-center gap-2">
      <button type="button" aria-label="Apuestas más bajas" onClick={() => setStart((s) => Math.max(0, s - 5))} disabled={start === 0} className={arrow}>
        ‹
      </button>
      {p.levels.slice(start, start + 5).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => p.onBetPick(c)}
          disabled={p.betLocked}
          aria-pressed={c === p.bet}
          aria-label={`Apostar ${money(c)}`}
          className={`${FOCUS} casino-num h-10 w-[70px] rounded-lg border text-[17px] transition disabled:opacity-60 ${
            c === p.bet ? 'border-[#f5c542] bg-[linear-gradient(180deg,#fff2b0,#f5c542_45%,#c98a12)] text-[#3a0a00]' : 'border-[#a36a1a] bg-[#2a0d05] text-[#ffe7a3] hover:border-[#f5c542]'
          }`}
        >
          {money(c)}
        </button>
      ))}
      <button type="button" aria-label="Apuestas más altas" onClick={() => setStart((s) => Math.min(Math.max(0, n - 5), s + 5))} disabled={start >= n - 5} className={arrow}>
        ›
      </button>
    </div>
  );
}

export function FuegoCabinet(p: CabinetProps) {
  const [info, setInfo] = useState(false);
  const hot = new Set(p.hotCells);
  const pct = p.countdown === null ? 0 : (p.countdown / p.countdownTotal) * 100;

  return (
    <div>
      <FitToWidth>
        <div className="relative w-fit overflow-hidden rounded-t-2xl shadow-2xl transition-[background] duration-700 sm:rounded-2xl" style={{ background: p.freeMode ? BACKDROP_FREE : BACKDROP }}>
          <Embers />

          <div className="relative flex justify-center pt-3">
            <Title freeCounter={p.freeCounter} />
          </div>

          <div className="relative flex items-center gap-6 px-4 pt-2 sm:px-6">
            <div className="hidden w-[110px] justify-center sm:flex">
              <WaysBadge />
            </div>

            {/* gold frame with a bevel, around the sunken burgundy window */}
            <div
              className={`relative rounded-[18px] p-3 transition-shadow ${
                p.freeMode
                  ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.75),inset_0_-2px_0_rgba(90,50,6,0.85),0_0_0_2px_#5a3206,0_0_0_6px_#ffcc33,0_0_30px_10px_rgba(255,204,51,0.75)]'
                  : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.75),inset_0_-2px_0_rgba(90,50,6,0.85),0_0_0_2px_#5a3206,0_8px_20px_rgba(60,10,0,0.45)]'
              }`}
              style={{ background: 'linear-gradient(180deg, #fff2b0, #e2a53a 35%, #8a5a12 70%, #f6d47a)' }}
            >
              <div
                className="relative overflow-hidden rounded-[10px] bg-gradient-to-b from-[#6e1426] to-[#4a0817] shadow-[inset_0_10px_18px_rgba(0,0,0,0.45),inset_0_0_0_3px_rgba(0,0,0,0.3)]"
                style={{ width: REELS_W, height: REELS_H }}
              >
                {/* thin gold separators behind the transparent reel columns */}
                <div className="pointer-events-none absolute inset-y-1 w-[2px] bg-[#f5c542]/45" style={{ left: CELL_W + 4 }} />
                <div className="pointer-events-none absolute inset-y-1 w-[2px] bg-[#f5c542]/45" style={{ left: 2 * CELL_W + GAP + 4 }} />
                <Reels
                  grid={p.grid}
                  spin={p.spin}
                  paylines={[]}
                  lineColors={[]}
                  renderSymbol={(sym, cell, index) => <FuegoCell id={sym} width={CELL_W} height={cell} hot={index !== undefined && hot.has(index)} />}
                  cell={CELL_H}
                  cellWidth={CELL_W}
                  variant="tiles"
                  lines={[]}
                  cells={[]}
                  pulse={p.hotCells}
                  instant={p.turbo}
                  onStopped={p.onStopped}
                />
                {/* drum shading: each reel curves away at the top and bottom */}
                {[0, 1, 2].map((r) => (
                  <div
                    key={r}
                    className="pointer-events-none absolute top-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.38)_0%,transparent_16%,transparent_84%,rgba(0,0,0,0.38)_100%)]"
                    style={{ left: r * (CELL_W + GAP), width: CELL_W, height: REELS_H }}
                  />
                ))}
                {p.overlay && <div className="absolute inset-0 z-10">{p.overlay}</div>}
                {info && (
                  <div className="absolute inset-0 z-20">
                    <Paytable bet={p.bet} onClose={() => setInfo(false)} />
                  </div>
                )}
              </div>
            </div>

            {/* right rail: desktop only; phones use the panel under the machine */}
            <div className="hidden w-[110px] flex-col items-center gap-4 sm:flex">
              <RoundButton label="Doble o nada" caption="DOBLE" onClick={p.onGamble} disabled={!p.canGamble} glow={p.canGamble}>
                <span className="font-['Arial_Black',sans-serif] text-lg font-black">x2</span>
              </RoundButton>
              <SpinButton p={p} size={104} />
              <RoundButton label="Turbo" caption="TURBO" onClick={p.onTurbo} active={p.turbo}>
                <svg viewBox="-16 -16 32 32" className="h-6 w-6" aria-hidden>
                  <path d="M4 -14 L-8 2 L0 2 L-4 14 L8 -2 L0 -2 Z" fill="currentColor" />
                </svg>
              </RoundButton>
              <RoundButton label="Juego automático" caption={p.auto ? 'PARAR' : 'AUTO'} onClick={p.onAuto} active={p.auto}>
                {p.auto ? (
                  <span className="block h-4 w-4 rounded-sm bg-current" aria-hidden />
                ) : (
                  <svg viewBox="-12 -12 24 24" className="h-5 w-5" aria-hidden>
                    <path d="M-6 -9 L9 0 L-6 9 Z" fill="currentColor" />
                  </svg>
                )}
              </RoundButton>
            </div>
          </div>

          {/* message strip, in a dark pill so it reads on the orange (desktop; phones show it in the panel) */}
          <div className="relative mt-2 hidden justify-center sm:flex">
            <p
              className={`rounded-full border border-[#f5c542]/50 bg-[rgba(42,8,2,0.72)] px-5 py-1 text-center text-[15px] font-extrabold tracking-[0.12em] ${p.freeMode ? 'text-[#ffe066]' : 'text-[#fff3d6]'}`}
              aria-live="polite"
            >
              {p.message}
            </p>
          </div>

          {/* bottom bar: desktop */}
          <div className="relative mt-2 hidden h-[66px] items-center gap-4 border-t border-[#f5c542]/60 bg-[rgba(60,15,0,0.78)] px-5 sm:flex">
            <button
              type="button"
              aria-label="Tabla de pagos"
              aria-pressed={info}
              onClick={() => setInfo((v) => !v)}
              className={`${FOCUS} flex h-9 w-9 items-center justify-center rounded-full border-2 font-serif text-lg font-bold ${info ? 'border-white text-white' : 'border-[#ffd99a] text-[#ffd99a]'}`}
            >
              i
            </button>
            <div className="w-[150px]">
              <p className="text-[11px] font-bold tracking-[0.15em] text-[#ffd99a]">SALDO</p>
              <p className="casino-num text-[24px] leading-tight text-[#fff3d6]">{money(p.balance)}</p>
            </div>
            <BetChips p={p} />
            <div className="w-[170px] text-right">
              <p className="text-[11px] font-bold tracking-[0.15em] text-[#ffd99a]">{p.winLabel}</p>
              <p key={p.winValue} className={`casino-num text-[30px] leading-tight ${p.winValue > 0 ? 'gold-text' : 'text-[#fff3d6]'}`}>
                {money(p.winValue)}
              </p>
            </div>
          </div>

          {p.wheel && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/35">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(255,190,80,0.35),transparent_60%)]" />
              <div className="relative">{p.wheel}</div>
              {p.countdown !== null && (
                <div className="absolute left-1/2 top-3 w-[280px] -translate-x-1/2 overflow-hidden rounded-full border-2 border-[#f5c542] bg-[#2a0d05] text-center">
                  <p className="relative z-10 py-1 text-[13px] font-extrabold tracking-[0.12em] text-[#ffe7a3]">LA RUEDA GIRA SOLA EN {p.countdown} s</p>
                  <div className="absolute inset-y-0 left-0 bg-[#a8410a]/70 transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          )}
          {p.banner && <BannerView key={p.banner.id} banner={p.banner} />}
        </div>
      </FitToWidth>
      <MobilePanel {...p} info={info} onInfo={() => setInfo((v) => !v)} />
    </div>
  );
}

const PAY_GROUPS: number[][] = [[WILD], [SEVEN, BELL], [PEAR, GRAPES], [MELON, PLUM], [CHERRY, LEMON, ORANGE]];

/** In-game paytable, in money at the current bet. */
function Paytable({ bet, onClose }: { bet: number; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gradient-to-b from-[#5a0d1a] to-[#2a0508] p-4 text-[#fff3d6]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-black tracking-wide text-[#ffd56b]">TABLA DE PAGOS · apuesta {formatMoney(bet)}</h3>
        <button type="button" onClick={onClose} className={`${FOCUS} rounded-lg bg-[#f5c542] px-3 py-1 text-sm font-bold text-[#3a0a00]`}>
          Volver
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {PAY_GROUPS.map((g) => (
          <div key={g.join()} className={`flex items-center gap-2 rounded-lg bg-black/30 p-2 ring-1 ring-[#f5c542]/40 ${g.length > 2 ? 'col-span-2' : ''}`}>
            <div className="flex items-center gap-1">
              {g.map((id) => (
                <FuegoIcon key={id} id={id} size={34} />
              ))}
            </div>
            <p className="ml-auto whitespace-nowrap text-sm font-bold">
              3 iguales <span className="casino-num text-[17px] text-[#ffd56b]">{formatMoney(PAYS[g[0]] * bet)}</span>
            </p>
          </div>
        ))}
        <div className="col-span-2 flex items-center gap-2 rounded-lg bg-black/30 p-2 ring-1 ring-[#f5c542]/40">
          <FuegoIcon id={WHEEL} size={34} />
          <p className="text-xs leading-snug">
            Una rueda en cada rodillo, en cualquier posición, gira la rueda misteriosa:{' '}
            {WHEEL_SECTORS.filter((s, i, all) => all.findIndex((x) => x.kind === s.kind && x.value === s.value) === i)
              .map((s) => (s.kind === 'multiplier' ? `x${s.value} (${formatMoney(s.value * bet)})` : `${s.value} giros gratis`))
              .join(' · ')}
            .
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[#ffd99a]">
        27 formas: un símbolo por rodillo, de izquierda a derecha, en cualquier fila. Si un símbolo sale dos veces en un rodillo, paga dos formas.
        El comodín sustituye a todo menos a la rueda. Los giros gratis usan otros rodillos, con muchos más comodines, y pagan a la apuesta que
        activó la rueda. Doble o nada hasta {MAX_GAMBLES} veces, solo con premios de hasta {GAMBLE_LIMIT_X} veces la apuesta.
      </p>
    </div>
  );
}

/** Phone controls, attached under the machine: message, balance and bet, then a big round spin in the middle. */
function MobilePanel(p: CabinetProps & { info: boolean; onInfo: () => void }) {
  const small = `${FOCUS} flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#f5c542] bg-[#1d0703] text-[#ffe7a3] font-black active:translate-y-0.5 disabled:opacity-35`;
  return (
    <div className="space-y-3 rounded-b-2xl border-t-2 border-[#f5c542] bg-[#2a0d05] px-3 pb-4 pt-2 sm:hidden">
      <p className={`min-h-[20px] text-center text-[13px] font-extrabold tracking-[0.08em] ${p.freeMode ? 'text-[#ffe066]' : 'text-[#fff3d6]'}`} aria-live="polite">
        {p.countdown !== null ? `LA RUEDA GIRA SOLA EN ${p.countdown} s` : p.message}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div>
          <p className="text-[10px] font-bold tracking-[0.12em] text-[#ffd99a]">SALDO</p>
          <p className="casino-num text-[18px] leading-tight text-[#fff3d6]">{money(p.balance)}</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-[#a36a1a] bg-black/30 p-1">
          <button type="button" aria-label="Bajar apuesta" onClick={() => p.onBet(-1)} disabled={!p.canBetDown} className={`${FOCUS} h-9 w-9 rounded-full text-2xl font-black text-[#ffd99a] disabled:opacity-30`}>
            −
          </button>
          <div className="w-[68px] text-center">
            <p className="text-[9px] font-bold tracking-[0.12em] text-[#ffd99a]">APUESTA</p>
            <p className="casino-num text-[16px] leading-none text-[#ffd56b]">{money(p.bet)}</p>
          </div>
          <button type="button" aria-label="Subir apuesta" onClick={() => p.onBet(1)} disabled={!p.canBetUp} className={`${FOCUS} h-9 w-9 rounded-full text-2xl font-black text-[#ffd99a] disabled:opacity-30`}>
            +
          </button>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-[0.12em] text-[#ffd99a]">{p.winLabel}</p>
          <p className={`casino-num text-[20px] leading-tight ${p.winValue > 0 ? 'gold-text' : 'text-[#fff3d6]'}`}>{money(p.winValue)}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Tabla de pagos" aria-pressed={p.info} onClick={p.onInfo} className={`${small} font-serif text-xl ${p.info ? 'bg-[#a8410a]' : ''}`}>
          i
        </button>
        <button type="button" aria-label="Turbo" aria-pressed={p.turbo} onClick={p.onTurbo} className={`${small} text-[10px] ${p.turbo ? 'bg-[#a8410a]' : ''}`}>
          TURBO
        </button>
        <SpinButton p={p} size={76} />
        <button type="button" aria-label="Juego automático" aria-pressed={p.auto} onClick={p.onAuto} className={`${small} text-[10px] ${p.auto ? 'bg-[#a8410a]' : ''}`}>
          {p.auto ? 'PARAR' : 'AUTO'}
        </button>
        <button type="button" aria-label="Doble o nada" onClick={p.onGamble} disabled={!p.canGamble} className={`${small} text-sm ${p.canGamble ? 'x2-ready' : ''}`}>
          x2
        </button>
      </div>
    </div>
  );
}
