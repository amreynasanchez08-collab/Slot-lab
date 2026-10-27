export type LabTab = 'play' | 'sim' | 'math';

const TABS: { id: LabTab; label: string }[] = [
  { id: 'play', label: 'Modo manual' },
  { id: 'sim', label: 'Simulación Monte Carlo' },
  { id: 'math', label: 'Matemática del juego' },
];

export function TabBar({ tab, onChange }: { tab: LabTab; onChange: (t: LabTab) => void }) {
  return (
    <nav className="flex w-fit flex-wrap gap-1 rounded-full bg-neutral-900 p-1">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${tab === t.id ? 'bg-amber-400 text-neutral-950' : 'text-neutral-300 hover:text-white'}`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

export function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">{label}</span>
      <input
        value={value}
        inputMode="decimal"
        onChange={(e) => onChange(e.target.value)}
        className="w-40 rounded-lg bg-neutral-800 px-3 py-2 font-mono text-neutral-100 outline-none ring-amber-400 focus:ring-2"
      />
    </label>
  );
}
