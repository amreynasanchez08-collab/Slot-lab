import { useEffect, useRef, useState } from 'react';
import { randomSeed } from '../../engine/rng.ts';
import type { Analysis, Machine } from '../../plenty/machine.ts';
import type { PlentySimulationResult } from '../../plenty/simulate.ts';
import type { PlentySimulationMessage, PlentySimulationRequest } from '../../workers/plenty.worker.ts';
import { BalanceChart } from '../BalanceChart.tsx';
import { Big, Card } from '../Cards.tsx';
import { formatInt, formatMoney, formatPct } from '../format.ts';

const PRESETS = [10_000, 100_000, 1_000_000];
const MAX_SPINS = 10_000_000;

interface Props {
  machine: Machine;
  analysis: Analysis;
  startBalance: number;
  bet: number;
}

export function PlentySimulator({ machine, analysis, startBalance, bet }: Props) {
  const [spins, setSpins] = useState(100_000);
  const [seedText, setSeedText] = useState(() => String(randomSeed()));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<PlentySimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const seed = /^\d+$/.test(seedText) ? Number(seedText) : NaN;
  const seedValid = Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;
  const spinsValid = Number.isInteger(spins) && spins > 0 && spins <= MAX_SPINS;

  const run = () => {
    if (!seedValid || !spinsValid) return;
    workerRef.current?.terminate();
    const worker = new Worker(new URL('../../workers/plenty.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    setRunning(true);
    setProgress(0);
    setError(null);
    worker.onmessage = (e: MessageEvent<PlentySimulationMessage>) => {
      // A cancelled or replaced worker can still deliver one last message; ignore it.
      if (workerRef.current !== worker) return;
      const msg = e.data;
      if (msg.type === 'progress') setProgress(msg.done / spins);
      else {
        if (msg.type === 'done') setResult(msg.result);
        else setError(msg.message);
        setRunning(false);
        worker.terminate();
        workerRef.current = null;
      }
    };
    const copy = (x: readonly (readonly number[])[]) => x.map((row) => [...row]);
    const request: PlentySimulationRequest = {
      strips: copy(machine.strips),
      weights: copy(machine.weights),
      params: { spins, bet, startBalance, seed },
    };
    worker.postMessage(request);
  };

  const cancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
  };

  const r = result;
  const gap = r ? r.rtp - analysis.rtp : 0;
  const withinCi = r ? Math.abs(gap) <= r.rtpCi95 : true;
  const starTheory = analysis.starDistribution[3] + analysis.starDistribution[4] + analysis.starDistribution[5];
  const starHits = r ? r.starHits[0] + r.starHits[1] + r.starHits[2] : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-2xl bg-neutral-900 p-5">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Giros a simular</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSpins(n)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${spins === n ? 'bg-amber-400 text-neutral-950' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
              >
                {formatInt(n)}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={MAX_SPINS}
              value={spins}
              onChange={(e) => setSpins(Math.floor(Number(e.target.value)))}
              className="w-32 rounded-lg bg-neutral-800 px-3 py-2 font-mono text-sm text-neutral-100"
              aria-label="Giros personalizados"
            />
          </div>
        </div>
        <div>
          <label htmlFor="plenty-seed" className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
            Semilla (reproducible)
          </label>
          <div className="flex gap-2">
            <input
              id="plenty-seed"
              value={seedText}
              onChange={(e) => setSeedText(e.target.value.trim())}
              className="w-36 rounded-lg bg-neutral-800 px-3 py-2 font-mono text-sm text-neutral-100"
            />
            <button type="button" onClick={() => setSeedText(String(randomSeed()))} className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700">
              Nueva
            </button>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {running ? (
            <button type="button" onClick={cancel} className="rounded-full bg-neutral-700 px-6 py-3 font-semibold text-white">
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              onClick={run}
              disabled={!seedValid || !spinsValid}
              className="rounded-full bg-gradient-to-b from-orange-500 to-red-700 px-8 py-3 font-bold text-white shadow-lg hover:brightness-110 disabled:opacity-40"
            >
              Ejecutar simulación
            </button>
          )}
        </div>
        {!spinsValid && <p className="w-full text-sm text-rose-300">Giros entre 1 y {formatInt(MAX_SPINS)}.</p>}
        {!seedValid && <p className="w-full text-sm text-rose-300">La semilla debe ser un entero entre 0 y 4,294,967,295.</p>}
        {running && (
          <div className="w-full">
            <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
              <div className="h-full bg-amber-400 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-neutral-400">{Math.round(progress * 100)}%</p>
          </div>
        )}
        {error && <p className="w-full text-sm text-rose-300">Error: {error}</p>}
        <p className="w-full text-xs text-neutral-500">La simulación nunca juega el doble o nada: es 50/50 y no cambia el RTP, solo la volatilidad.</p>
      </div>

      {r && (
        <>
          <div className="rounded-2xl bg-neutral-900 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-neutral-100">RTP real vs. teórico</h2>
              <p className="text-xs text-neutral-500">
                {formatInt(r.spins)} giros · semilla {r.seed} · {(r.elapsedMs / 1000).toFixed(2)} s
              </p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Big label="RTP real" value={formatPct(r.rtp, 3)} sub={`± ${formatPct(r.rtpCi95, 3)} (IC 95%)`} />
              <Big label="RTP teórico (exacto)" value={formatPct(analysis.rtp, 3)} sub={`Líneas ${formatPct(analysis.lineRtp)} · Estrellas ${formatPct(analysis.scatterRtp)}`} />
              <Big
                label="Diferencia"
                value={`${gap >= 0 ? '+' : ''}${(gap * 100).toFixed(3)} pts`}
                sub={withinCi ? 'Dentro del margen estadístico' : 'Fuera del margen del 95%: revisar o simular más giros'}
                tone={withinCi ? 'ok' : 'warn'}
              />
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              Real: líneas {formatPct(r.lineRtp)} + estrellas {formatPct(r.scatterRtp)}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card label="Hit frequency" value={formatPct(r.hitFrequency)} sub="Giros con algún premio" />
            <Card
              label="3+ estrellas"
              value={starHits ? `1 en ${formatInt(Math.round(r.spins / starHits))}` : 'Ninguna'}
              sub={`Teórico 1 en ${formatInt(Math.round(1 / starTheory))} · 3/4/5: ${r.starHits.map(formatInt).join(' / ')}`}
            />
            <Card label="Premio máximo" value={`${r.maxWinX.toFixed(1)}x`} sub={`${formatMoney(r.maxWinX * bet)} en el giro ${formatInt(r.maxWinSpin)}`} />
            <Card label="Pérdidas disfrazadas (LDW)" value={formatPct(r.ldwCount / r.spins)} sub={`${formatInt(r.ldwCount)} giros cobran menos de lo apostado`} />
            <Card label="Total apostado / pagado" value={formatMoney(r.totalBet)} sub={`Pagado ${formatMoney(r.totalWin)}`} />
          </div>

          <div className="rounded-2xl bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold text-neutral-100">Curva de saldo</h2>
            <p className="mb-3 text-xs text-neutral-500">
              La banda muestra el mínimo y el máximo de cada tramo. El saldo puede quedar negativo: la simulación sigue para medir el RTP aunque el jugador ya se habría quedado sin dinero.
            </p>
            <BalanceChart curve={r.curve} startBalance={startBalance} bet={bet} bustSpin={r.bustSpin} />
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
              <Card label="Saldo final" value={formatMoney(r.finalBalance)} sub={`Inicial ${formatMoney(startBalance)}`} />
              <Card label="Pico" value={formatMoney(r.peakBalance)} sub={`+${formatMoney(r.peakBalance - startBalance)}`} />
              <Card label="Mínimo" value={formatMoney(r.lowBalance)} />
              <Card label="Drawdown máximo" value={formatMoney(r.maxDrawdown)} sub={`${(r.maxDrawdown / bet).toFixed(0)} apuestas`} />
              <Card label="Saldo agotado" value={r.bustSpin ? `Giro ${formatInt(r.bustSpin)}` : 'No se agotó'} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
