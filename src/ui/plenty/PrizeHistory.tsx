import { useState } from 'react';
import { formatInt, formatMoney } from '../format.ts';

export interface PrizeRecord {
  spin: number;
  /** Epoch ms. */
  at: number;
  bet: number;
  win: number;
  /** How it was won, e.g. "Ciruela x3 en línea 1 · 3 estrellas". */
  detail: string;
  stars: number;
}

type View = 'recent' | 'biggest';

const when = new Intl.DateTimeFormat('es-PA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

interface Props {
  prizes: PrizeRecord[];
  totalSpins: number;
  onExport: () => void;
  onClear: () => void;
}

/** Every past prize, saved on this device, newest or biggest first. */
export function PrizeHistory({ prizes, totalSpins, onExport, onClear }: Props) {
  const [view, setView] = useState<View>('recent');
  const [confirmClear, setConfirmClear] = useState(false);
  const rows = view === 'recent' ? [...prizes].reverse() : [...prizes].sort((a, b) => b.win / b.bet - a.win / a.bet);
  const shown = rows.slice(0, 100);
  const best = prizes.reduce<PrizeRecord | null>((m, p) => (!m || p.win / p.bet > m.win / m.bet ? p : m), null);
  const starPrizes = prizes.filter((p) => p.stars >= 3).length;

  return (
    <section className="rounded-2xl bg-neutral-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-100">Premios pasados</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onExport} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700">
            Exportar a Excel
          </button>
          {confirmClear ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setConfirmClear(false);
                }}
                className="rounded-lg bg-rose-700 px-3 py-1.5 text-sm font-semibold text-white"
              >
                Sí, borrar todo
              </button>
              <button type="button" onClick={() => setConfirmClear(false)} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200">
                Cancelar
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmClear(true)} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm text-rose-300 hover:bg-neutral-700">
              Borrar historial
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-neutral-500">Se guarda en este dispositivo. Otro celular o navegador tiene su propio historial.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Fig label="Premios" value={formatInt(prizes.length)} sub={totalSpins ? `en ${formatInt(totalSpins)} giros` : undefined} />
        <Fig label="Total ganado" value={formatMoney(prizes.reduce((s, p) => s + p.win, 0))} />
        <Fig label="Mayor premio" value={best ? `${(best.win / best.bet).toFixed(1)}x` : '—'} sub={best ? `${formatMoney(best.win)} · giro ${formatInt(best.spin)}` : undefined} />
        <Fig label="Con 3+ estrellas" value={formatInt(starPrizes)} />
      </div>

      <div className="mt-4 flex gap-1 rounded-full bg-neutral-950/60 p-1 text-sm">
        {(['recent', 'biggest'] as View[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`flex-1 rounded-full px-3 py-1.5 ${view === v ? 'bg-amber-400 font-semibold text-neutral-950' : 'text-neutral-300'}`}
          >
            {v === 'recent' ? 'Más recientes' : 'Más grandes'}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">Todavía no hay premios.</p>
      ) : (
        <ol className="mt-3 max-h-96 space-y-1.5 overflow-y-auto pr-1 text-sm">
          {shown.map((p) => (
            <li key={p.spin} className="rounded-lg bg-neutral-950/60 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs text-neutral-500">
                  #{formatInt(p.spin)} · {when.format(p.at)}
                </span>
                <span className={`font-mono font-semibold ${p.win >= p.bet ? 'text-emerald-300' : 'text-orange-300'}`}>
                  {formatMoney(p.win)} <span className="text-xs text-neutral-400">({(p.win / p.bet).toFixed(1)}x)</span>
                </span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-300">
                Apuesta {formatMoney(p.bet)} · {p.detail}
              </p>
            </li>
          ))}
        </ol>
      )}
      {rows.length > shown.length && <p className="mt-2 text-xs text-neutral-500">Se muestran 100 de {formatInt(rows.length)}. El archivo de Excel trae todos.</p>}
    </section>
  );
}

function Fig({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-neutral-950/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 font-mono text-lg text-neutral-100">{value}</p>
      {sub && <p className="text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}
