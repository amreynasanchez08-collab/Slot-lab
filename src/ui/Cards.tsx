// Small figure cards shared by both games' playground and simulator panels.

export function Big({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'ok' | 'warn' }) {
  const color = tone === 'warn' ? 'text-rose-300' : tone === 'ok' ? 'text-emerald-300' : 'text-amber-300';
  return (
    <div className="rounded-xl bg-neutral-950/70 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 font-mono text-3xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-neutral-400">{sub}</p>
    </div>
  );
}

export function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-neutral-900 p-3 ring-1 ring-neutral-800">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 font-mono text-lg text-neutral-100">{value}</p>
      {sub && <p className="text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

export function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-neutral-900 p-3">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 font-mono ${strong ? 'text-2xl font-bold text-amber-300' : 'text-lg text-neutral-100'}`}>{value}</p>
    </div>
  );
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-900/70 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="font-mono text-neutral-200">{value}</p>
    </div>
  );
}
