import { formatInt, formatMoney, formatPct } from '../format.ts';

export interface SpinRecord {
  /** Spin number in the saved history (1-based, never reused). */
  spin: number;
  /** Epoch ms when the spin settled. */
  at: number;
  /** Cents bet on the spin. */
  bet: number;
  /** Cents won by the spin (before any gamble). */
  win: number;
  /** Balance after the spin, its win included. */
  balance: number;
}

const WINDOW = 50;
const QUICK_BETS = [20, 40, 100, 200, 400];

type Mood = 'fría' | 'normal' | 'caliente' | 'sin datos';

/** Reads the last spins only; it describes the past and does not predict the next spin. */
function moodOf(rtp: number, spins: number): Mood {
  if (spins < 20) return 'sin datos';
  if (rtp < 0.6) return 'fría';
  if (rtp > 1.3) return 'caliente';
  return 'normal';
}

const MOOD_STYLE: Record<Mood, string> = {
  fría: 'bg-sky-500/20 text-sky-200 ring-sky-400/60',
  normal: 'bg-neutral-700/40 text-neutral-200 ring-neutral-500/60',
  caliente: 'bg-orange-500/20 text-orange-200 ring-orange-400/60',
  'sin datos': 'bg-neutral-800 text-neutral-400 ring-neutral-700',
};

interface Props {
  history: SpinRecord[];
  startBalance: number;
  bet: number;
  onBet: (bet: number) => void;
  locked: boolean;
}

export function StreakPanel({ history, startBalance, bet, onBet, locked }: Props) {
  const recent = history.slice(-WINDOW);
  const wagered = recent.reduce((s, r) => s + r.bet, 0);
  const paid = recent.reduce((s, r) => s + r.win, 0);
  const rtp = wagered > 0 ? paid / wagered : 0;
  const mood = moodOf(rtp, recent.length);

  let dry = 0;
  for (let i = history.length - 1; i >= 0 && history[i].win === 0; i--) dry++;

  const balances = [startBalance, ...history.map((r) => r.balance)];
  const peak = Math.max(...balances);
  const current = balances[balances.length - 1];
  const drawdown = peak - current;

  // Per bet level: the share returned stays near the game's RTP at every level; only the money at stake changes.
  const byBet = new Map<number, { spins: number; wagered: number; paid: number }>();
  for (const r of history) {
    const row = byBet.get(r.bet) ?? { spins: 0, wagered: 0, paid: 0 };
    row.spins++;
    row.wagered += r.bet;
    row.paid += r.win;
    byBet.set(r.bet, row);
  }

  const spark = balances.slice(-100);
  const lo = Math.min(...spark);
  const hi = Math.max(...spark);
  const pts = spark.map((b, i) => `${(i / Math.max(1, spark.length - 1)) * 300},${48 - ((b - lo) / Math.max(1, hi - lo)) * 44 - 2}`).join(' ');

  return (
    <section className="rounded-2xl bg-neutral-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-100">Racha</h2>
        <span className={`rounded-full px-3 py-1 text-sm font-bold uppercase tracking-wide ring-1 ${MOOD_STYLE[mood]}`}>{mood}</span>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Mide los últimos {WINDOW} giros. Describe lo que ya pasó: cada giro es independiente, así que una racha fría no hace más probable
        que el próximo pierda ni que gane. Bajar la apuesta reduce lo que pierdes porque arriesgas menos dinero, no porque la máquina pague más.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label={`Devuelto últimos ${recent.length}`} value={recent.length ? formatPct(rtp, 0) : '—'} sub={`${formatMoney(paid)} de ${formatMoney(wagered)}`} />
        <Metric label="Neto últimos giros" value={formatMoney(paid - wagered)} sub={`${((paid - wagered) / bet).toFixed(0)} apuestas actuales`} tone={paid - wagered < 0 ? 'down' : 'up'} />
        <Metric label="Giros sin premio" value={formatInt(dry)} />
        <Metric label="Caída desde el máximo" value={formatMoney(drawdown)} sub={`${(drawdown / bet).toFixed(0)} apuestas · máximo ${formatMoney(peak)}`} tone={drawdown > 0 ? 'down' : undefined} />
      </div>

      <svg viewBox="0 0 300 50" className="mt-4 h-14 w-full" preserveAspectRatio="none" aria-label="Saldo de los últimos 100 giros">
        <polyline points={pts} fill="none" stroke="#fbbf24" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-400">Apuesta rápida:</span>
        {QUICK_BETS.map((b) => (
          <button
            key={b}
            type="button"
            disabled={locked}
            onClick={() => onBet(b)}
            className={`rounded-lg px-3 py-1.5 font-mono text-sm font-semibold disabled:opacity-40 ${b === bet ? 'bg-lime-400 text-neutral-950' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
          >
            {formatMoney(b)}
          </button>
        ))}
      </div>

      {byBet.size > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm [&_td]:pr-4 [&_th]:pr-4">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="py-1">Apuesta</th>
                <th>Giros</th>
                <th>Apostado</th>
                <th>Pagado</th>
                <th>% devuelto</th>
                <th>Neto</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {[...byBet.entries()]
                .sort((x, y) => x[0] - y[0])
                .map(([b, r]) => (
                  <tr key={b} className="border-t border-neutral-800 text-neutral-200">
                    <td className="py-1">{formatMoney(b)}</td>
                    <td>{formatInt(r.spins)}</td>
                    <td>{formatMoney(r.wagered)}</td>
                    <td>{formatMoney(r.paid)}</td>
                    <td>{formatPct(r.paid / r.wagered, 0)}</td>
                    <td className={r.paid - r.wagered < 0 ? 'text-rose-300' : 'text-emerald-300'}>{formatMoney(r.paid - r.wagered)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-neutral-500">Con pocos giros el % devuelto varía mucho. Con miles de giros se acerca al RTP del juego en todas las apuestas.</p>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'down' }) {
  const color = tone === 'down' ? 'text-rose-300' : tone === 'up' ? 'text-emerald-300' : 'text-neutral-100';
  return (
    <div className="rounded-xl bg-neutral-950/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 font-mono text-lg ${color}`}>{value}</p>
      {sub && <p className="text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}
