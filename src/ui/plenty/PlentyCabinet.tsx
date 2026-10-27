import { useEffect, useState, type ReactNode } from 'react';
import { PAYLINES } from '../../plenty/evaluate.ts';
import { LINE_PAYS, SCATTER_PAYS, STAR } from '../../plenty/symbols.ts';
import { formatMoney } from '../format.ts';
import { FitToWidth } from '../FitToWidth.tsx';
import { Reels, type ReelSpin } from '../Reels.tsx';
import { Character, Tile } from './characters.tsx';

/** Line-number tabs down each side, in the original game's order (top to bottom). */
const LEFT_TABS = [18, 9, 2, 14, 11, 4, 16, 13, 7, 1, 6, 12, 17, 5, 10, 15, 3, 8, 19, 20];
const RIGHT_TABS = [18, 8, 2, 14, 10, 4, 16, 12, 7, 1, 6, 13, 17, 5, 11, 15, 3, 9, 19, 20];

/** Tab colour per line number (index = line - 1), taken from the original; also used to draw the line. */
export const LINE_COLORS: readonly string[] = [
  '#e8202a', '#f2d21b', '#3aa335', '#29b6e8', '#2a6fd6', '#f28c1b', '#c9c9c9', '#d24bc4', '#1a9a8e', '#f0a12a',
  '#2f8a3a', '#d6732a', '#b0273a', '#ef7fae', '#f6ef6a', '#1f6f6a', '#c7b16b', '#2fb57e', '#e44f9b', '#a8742c',
];

export const CABINET_CELL = 112;

const money = (cents: number) => formatMoney(cents).replace('$', '');

/** Reels width: 5 cells plus 4 separators of 10 px. The control bar matches it. */
const REELS_WIDTH = 5 * CABINET_CELL + 4 * 10;
const FOCUS = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fff2a8]';
/** Dimmed green, as the original greys a button out (opacity would turn it brown on the red cabinet). */
const DISABLED = 'disabled:saturate-[.4] disabled:brightness-90';

/** Gold side pillars: thin gold line, red band, thin inner line, on both sides. */
const PILLARS = [
  'inset 2px 0 0 #e2b07a',
  'inset 24px 0 0 #a00f0b',
  'inset 26px 0 0 #c08a5c',
  'inset -2px 0 0 #e2b07a',
  'inset -24px 0 0 #a00f0b',
  'inset -26px 0 0 #c08a5c',
].join(', ');

function Corner({ side }: { side: 'left' | 'right' }) {
  const left = side === 'left';
  return (
    <div className={`pointer-events-none absolute top-0 h-[70px] w-[120px] ${left ? 'left-0' : 'right-0'}`} aria-hidden>
      <div
        className={`absolute inset-0 bg-[#a00f0b] ${left ? 'rounded-br-[64px]' : 'rounded-bl-[64px]'}`}
        style={{ boxShadow: `inset ${left ? '-8px' : '8px'} -8px 0 0 #c8862e, inset ${left ? '-5px' : '5px'} -5px 0 0 #ffe1aa` }}
      />
      <div className={`absolute top-2 h-3 w-3 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff2c0,#c8862e)] ${left ? 'left-2' : 'right-2'}`} />
    </div>
  );
}

function GreenButton({ label, onClick, disabled, active, wide, children }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`${FOCUS} flex h-11 items-center justify-center rounded-lg border-2 font-black uppercase leading-none text-[#0f3d05] shadow-[inset_0_2px_0_rgba(255,255,255,0.45),0_3px_0_#1f5d0a] transition active:translate-y-0.5 ${DISABLED} ${
        active ? 'border-yellow-200 bg-gradient-to-b from-yellow-300 to-lime-500' : 'border-lime-200/70 bg-gradient-to-b from-lime-300 to-lime-600'
      } ${wide ? 'w-[54px] h-[46px]' : 'w-10'}`}
    >
      {children}
    </button>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return <span>{now.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>;
}

interface CabinetProps {
  grid: number[];
  spin: ReelSpin | null;
  winLines: number[];
  starCells: number[];
  balance: number;
  bet: number;
  lastWin: number;
  pendingWin: number;
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
  onGamble: () => void;
  onStopped: () => void;
  /** Screen drawn over the reels (gamble), or null. */
  overlay: ReactNode;
}

export function PlentyCabinet(p: CabinetProps) {
  const [info, setInfo] = useState(false);
  const winning = new Set(p.winLines.map((l) => l + 1));

  const tabs = (order: number[]) => (
    <div className="hidden flex-col justify-between py-0.5 sm:flex" style={{ height: 3 * CABINET_CELL }}>
      {order.map((n) => (
        <span
          key={n}
          className={`block w-8 rounded-[3px] text-center font-mono text-[11px] font-bold leading-[14px] text-black/80 ${winning.has(n) ? 'ring-2 ring-white' : ''}`}
          style={{ background: LINE_COLORS[n - 1], opacity: winning.size > 0 && !winning.has(n) ? 0.55 : 1 }}
        >
          {n}
        </span>
      ))}
    </div>
  );

  return (
    <>
    <FitToWidth>
    <div className="w-fit rounded-xl bg-black shadow-2xl">
      {/* status strip */}
      <div className="flex items-center justify-center gap-6 px-4 py-1.5 text-sm font-bold text-white">
        <span>
          BALANCE <span className="font-normal text-neutral-300">USD</span> <span className="text-lime-400">{money(p.balance)}</span>
        </span>
        <span>
          BET <span className="font-normal text-neutral-300">USD</span> <span className="text-lime-400">{money(p.bet)}</span>
        </span>
        <span>
          LAST WIN <span className="font-normal text-neutral-300">USD</span> <span className="text-lime-400">{money(p.lastWin)}</span>
        </span>
        <span className="ml-auto font-normal text-neutral-300">
          <Clock />
        </span>
      </div>

      <div
        className="relative rounded-b-xl px-4 pb-4 sm:px-[82px] sm:pb-[22px]"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, #6a0d05 0%, #520801 60%, #4a0601 100%)' }}
      >
        {/* side pillars: desktop only, on a phone they would cover the reels */}
        <div className="pointer-events-none absolute inset-0 hidden rounded-b-xl sm:block" style={{ boxShadow: PILLARS }} />
        <div className="hidden sm:block">
          <Corner side="left" />
          <Corner side="right" />
        </div>

        <h2 className="relative flex h-[37px] items-center justify-center font-serif text-[26px] font-black tracking-wide" style={{ textShadow: '0 2px 0 #4a2a00, 0 0 10px rgba(255,200,80,0.5)' }}>
          <span className="bg-gradient-to-b from-[#fffbe6] via-[#ffd36b] to-[#d08f1c] bg-clip-text text-transparent">Frutas 20</span>
          <span className="relative -left-1.5 top-2.5 font-sans text-base font-black italic text-[#ffc61a]" style={{ textShadow: '0 0 6px #ff5a00' }}>
            hot
          </span>
        </h2>

        <div className="relative mt-[25px] flex items-center justify-center gap-3">
          {tabs(LEFT_TABS)}
          <div className="relative bg-[#7a0c02] shadow-[0_-2px_0_#e0a84a,0_2px_0_#e0a84a]">
            <Reels
              grid={p.grid}
              spin={p.spin}
              paylines={PAYLINES}
              lineColors={LINE_COLORS}
              renderSymbol={(sym, cell) => <Tile id={sym} cell={cell} />}
              cell={CABINET_CELL}
              variant="tiles"
              lines={p.winLines}
              cells={p.starCells}
              instant={p.turbo}
              onStopped={p.onStopped}
            />
            {p.overlay && <div className="absolute inset-0 z-10">{p.overlay}</div>}
            {info && (
              <div className="absolute inset-0 z-20">
                <Paytable bet={p.bet} onClose={() => setInfo(false)} />
              </div>
            )}
          </div>
          {tabs(RIGHT_TABS)}
        </div>

        {/* control bar: as wide as the reels, info on the left edge, spin on the right edge */}
        <div className="mx-auto mt-[22px] hidden items-center gap-1.5 sm:flex" style={{ width: REELS_WIDTH }}>
          <GreenButton label="Tabla de pagos" onClick={() => setInfo((v) => !v)} wide active={info}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-[#0f3d05] font-serif text-lg">i</span>
          </GreenButton>
          {/* The original has a sound button here; the lab has no audio, so the space stays empty. */}
          <span className="w-[38px]" aria-hidden />

          <div className="mx-auto flex items-center gap-1.5">
            <div className="flex h-[42px] w-[124px] flex-col items-center justify-center rounded-md border border-neutral-500 bg-gradient-to-b from-neutral-800 to-black">
              <span className="text-xs font-bold text-white">BALANCE</span>
              <span className="text-lg font-bold leading-none text-lime-400">{money(p.balance)}</span>
            </div>
            <div className="flex h-[42px] items-stretch rounded-md border border-neutral-500 bg-gradient-to-b from-neutral-800 to-black p-1">
              <button
                type="button"
                aria-label="Bajar apuesta"
                onClick={() => p.onBet(-1)}
                disabled={!p.canBetDown}
                className={`${FOCUS} ${DISABLED} w-7 rounded bg-gradient-to-b from-lime-300 to-lime-600 text-xl font-black text-[#0f3d05]`}
              >
                −
              </button>
              <div className="flex w-20 flex-col items-center justify-center">
                <span className="text-xs font-bold text-white">BET</span>
                <span className="text-lg font-bold leading-none text-lime-400">{money(p.bet)}</span>
              </div>
              <button
                type="button"
                aria-label="Subir apuesta"
                onClick={() => p.onBet(1)}
                disabled={!p.canBetUp}
                className={`${FOCUS} ${DISABLED} w-7 rounded bg-gradient-to-b from-lime-300 to-lime-600 text-xl font-black text-[#0f3d05]`}
              >
                +
              </button>
            </div>
            {p.pendingWin > 0 && !p.spinning && !p.auto ? (
              <GreenButton label="Doble o nada" onClick={p.onGamble} wide>
                <span className="text-center text-[10px]">
                  DOBLE
                  <br />O NADA
                </span>
              </GreenButton>
            ) : (
              <GreenButton label="Apuesta máxima" onClick={p.onMaxBet} disabled={!p.canBetUp || p.spinning}>
                <span className="text-center text-[11px]">
                  MAX
                  <br />
                  BET
                </span>
              </GreenButton>
            )}
            <GreenButton label="Turbo" onClick={p.onTurbo} active={p.turbo}>
              {/* rabbit: two long ears, round head, crouched body */}
              <svg viewBox="0 0 32 32" className="h-7 w-7" fill="#0f3d05" aria-hidden>
                <ellipse cx="11" cy="7" rx="2" ry="6" transform="rotate(-18 11 7)" />
                <ellipse cx="15.5" cy="6.5" rx="2" ry="6" transform="rotate(8 15.5 6.5)" />
                <circle cx="13.5" cy="14" r="4.5" />
                <ellipse cx="19" cy="22" rx="9" ry="6" />
                <circle cx="27.5" cy="21" r="2" />
                <ellipse cx="13" cy="27.5" rx="4" ry="1.6" />
              </svg>
            </GreenButton>
            <GreenButton label="Juego automático" onClick={p.onAuto} active={p.auto}>
              <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" stroke="#0f3d05" strokeWidth={3.5} strokeLinecap="round" aria-hidden>
                <path d="M7 14a9 9 0 0 1 16-5l2 2M25 18a9 9 0 0 1-16 5l-2-2" />
                <path d="M25 5v6h-6M7 27v-6h6" />
              </svg>
            </GreenButton>
          </div>

          <button
            type="button"
            aria-label={p.pendingWin > 0 ? 'Cobrar y girar' : 'Girar'}
            onClick={p.onSpin}
            disabled={p.spinning || p.auto}
            className={`${FOCUS} ${DISABLED} flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border-4 border-lime-200/80 bg-[radial-gradient(circle_at_40%_30%,#d9ff7a,#7bc61c_55%,#3f7f08)] shadow-[0_4px_0_#245c06,0_0_18px_rgba(160,255,60,0.35)] transition active:translate-y-0.5`}
          >
            <svg viewBox="0 0 32 32" className="h-8 w-8" fill="#0f3d05" aria-hidden>
              <path d="M6 5l16 11-16 11z" />
              <rect x="23" y="5" width="4" height="22" rx="1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
    </FitToWidth>
    <MobileControls {...p} info={info} onInfo={() => setInfo((v) => !v)} />
    </>
  );
}

/** In-game paytable, in money at the current bet, as the original shows it. */
function Paytable({ bet, onClose }: { bet: number; onClose: () => void }) {
  const rows: { ids: number[]; pays: readonly number[]; scatter?: boolean }[] = [
    { ids: [6], pays: LINE_PAYS[6] },
    { ids: [4], pays: LINE_PAYS[4] },
    { ids: [5, 3], pays: LINE_PAYS[5] },
    { ids: [0, 1, 2], pays: LINE_PAYS[0] },
    { ids: [STAR], pays: SCATTER_PAYS, scatter: true },
  ];
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0f5c4c] to-[#06352c] p-4 text-white">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-black tracking-wide text-[#f6e27a]">TABLA DE PAGOS · apuesta {formatMoney(bet)}</h3>
        <button type="button" onClick={onClose} className="rounded bg-lime-500 px-3 py-1 text-sm font-bold text-[#0f3d05]">
          Volver
        </button>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.ids.join()} className={`flex items-center gap-2 rounded-lg bg-[#c9e7a5]/90 p-2 text-[#123] ${r.ids.length > 2 ? "lg:col-span-2" : ""}`}>
            <div className="flex">
              {r.ids.map((id) => (
                <Character key={id} id={id} size={42} />
              ))}
            </div>
            <dl className="ml-auto shrink-0 whitespace-nowrap font-mono text-sm font-bold leading-tight">
              {[5, 4, 3].map((k) => (
                <div key={k} className="flex justify-end gap-2">
                  <dt className="text-sky-700">{k}</dt>
                  <dd>{formatMoney(r.scatter ? r.pays[k] * bet : (r.pays[k] * bet) / 20)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <p className="col-span-full text-xs text-[#d6f5e8]">
          El 7 sustituye a todos los símbolos menos a la estrella. La estrella paga en cualquier posición. Premios de izquierda a derecha en
          las 20 líneas; por línea se paga solo el más alto.
        </p>
      </div>
    </div>
  );
}

/** Thumb-sized controls under the machine on phones, where the in-cabinet bar is too small to tap. */
function MobileControls(p: CabinetProps & { info: boolean; onInfo: () => void }) {
  const pill = `${FOCUS} ${DISABLED} flex h-12 items-center justify-center rounded-xl border-2 border-lime-200/70 bg-gradient-to-b from-lime-300 to-lime-600 font-black text-[#0f3d05] shadow-[0_3px_0_#1f5d0a] active:translate-y-0.5`;
  const gambleReady = p.pendingWin > 0 && !p.spinning && !p.auto;
  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-[#3c0505] p-3 sm:hidden">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Readout label="Saldo" value={money(p.balance)} />
        <Readout label="Apuesta" value={money(p.bet)} />
        <Readout label={p.pendingWin > 0 ? 'Por cobrar' : 'Último premio'} value={money(p.pendingWin > 0 ? p.pendingWin : p.lastWin)} />
      </div>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2">
        <button type="button" aria-label="Bajar apuesta" onClick={() => p.onBet(-1)} disabled={!p.canBetDown} className={`${pill} text-2xl`}>
          −
        </button>
        <button type="button" aria-label="Subir apuesta" onClick={() => p.onBet(1)} disabled={!p.canBetUp} className={`${pill} text-2xl`}>
          +
        </button>
        <button type="button" onClick={p.onMaxBet} disabled={!p.canBetUp || p.spinning} className={`${pill} text-sm`}>
          MÁX
        </button>
      </div>
      <div className="grid grid-cols-[1fr_1fr_1fr_1.6fr] gap-2">
        <button type="button" aria-label="Tabla de pagos" onClick={p.onInfo} className={`${pill} font-serif text-xl ${p.info ? 'from-yellow-300 to-lime-500' : ''}`}>
          i
        </button>
        <button type="button" aria-label="Turbo" onClick={p.onTurbo} className={`${pill} text-xs ${p.turbo ? 'from-yellow-300 to-lime-500' : ''}`}>
          TURBO
        </button>
        <button type="button" aria-label="Juego automático" onClick={p.onAuto} className={`${pill} text-xs ${p.auto ? 'from-yellow-300 to-lime-500' : ''}`}>
          {p.auto ? 'PARAR' : 'AUTO'}
        </button>
        {gambleReady ? (
          <button type="button" onClick={p.onGamble} className={`${pill} text-xs`}>
            DOBLE O NADA
          </button>
        ) : (
          <span />
        )}
      </div>
      <button
        type="button"
        onClick={p.onSpin}
        disabled={p.spinning || p.auto}
        className={`${FOCUS} ${DISABLED} h-16 w-full rounded-2xl border-4 border-lime-200/80 bg-[radial-gradient(circle_at_40%_30%,#d9ff7a,#7bc61c_55%,#3f7f08)] text-xl font-black text-[#0f3d05] shadow-[0_4px_0_#245c06]`}
      >
        {p.pendingWin > 0 ? 'COBRAR Y GIRAR' : 'GIRAR'}
      </button>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/60 px-2 py-1.5">
      <p className="text-[10px] font-bold uppercase text-neutral-300">{label}</p>
      <p className="font-mono text-base font-bold text-lime-400">{value}</p>
    </div>
  );
}
