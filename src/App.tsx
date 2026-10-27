import { useEffect, useState } from 'react';
import { BigShowLab } from './ui/BigShowLab.tsx';
import { PlentyLab } from './ui/plenty/PlentyLab.tsx';
import { loadJson, saveJson } from './ui/storage.ts';

type Game = 'bigshow' | 'plenty';

const GAMES: { id: Game; label: string; detail: string }[] = [
  { id: 'bigshow', label: 'Gran Show', detail: '3x3 · 5 líneas · bailarinas' },
  { id: 'plenty', label: 'Frutas 20 Hot', detail: '5x3 · 20 líneas · estrellas' },
];

export default function App() {
  // Opens on the last game played on this device.
  const [game, setGame] = useState<Game>(() => loadJson<Game>('slotlab.game') ?? 'plenty');
  useEffect(() => saveJson('slotlab.game', game), [game]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Slot Lab</h1>
            <p className="text-xs text-neutral-500">Laboratorio de matemática de tragamonedas. Saldo ficticio: no conecta con dinero real.</p>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Juego">
            {GAMES.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGame(g.id)}
                className={`rounded-xl px-4 py-2 text-left transition ${game === g.id ? 'bg-rose-600 text-white' : 'bg-neutral-900 text-neutral-300 hover:text-white'}`}
              >
                <span className="block text-sm font-semibold">{g.label}</span>
                <span className="block text-[11px] opacity-75">{g.detail}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Both games stay mounted so switching keeps each session. */}
        <div hidden={game !== 'bigshow'}>
          <BigShowLab active={game === 'bigshow'} />
        </div>
        <div hidden={game !== 'plenty'}>
          <PlentyLab active={game === 'plenty'} />
        </div>
      </main>
    </div>
  );
}
