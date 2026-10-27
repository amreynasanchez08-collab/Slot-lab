import type { ReelSet, TuneResult } from '../engine/machine.ts';
import { MYSTERY_MEAN_PAY, MYSTERY_SYMBOLS, PAYS, SYMBOL_NAMES } from '../engine/symbols.ts';
import { formatInt, formatPct } from './format.ts';
import { SymbolIcon } from './SymbolIcon.tsx';

export function MathPanel({ tuned }: { tuned: TuneResult }) {
  const { machine, analysis } = tuned;
  const award = machine.freeGames.award;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold text-neutral-100">Desglose teórico (cálculo exacto)</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Se recorren todas las combinaciones de paradas de los dos juegos de rodillos con su peso. No es una estimación.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Item label="RTP total" value={formatPct(analysis.rtp, 4)} />
          <Item label="RTP juego base" value={`${formatPct(analysis.baseRtp, 2)} (${formatPct(analysis.baseRtp / analysis.rtp, 0)})`} />
          <Item label="RTP juegos gratis" value={`${formatPct(analysis.freeGameRtp, 2)} (${formatPct(analysis.freeGameRtp / analysis.rtp, 0)})`} />
          <Item label="Juegos gratis" value={`1 en ${(1 / analysis.triggerProbability).toFixed(1)}`} />
          <Item label="Premio medio por ronda" value={`${analysis.expectedRoundWin.toFixed(1)}x apuesta`} />
          <Item label="Premio medio por juego gratis" value={`${analysis.freeGameValue.toFixed(2)}x apuesta`} />
          <Item label="Giros con premio (base)" value={formatPct(analysis.hitFrequency)} />
          <Item label="Retrigger" value={`1 en ${formatInt(Math.round(1 / analysis.retriggerProbability))} juegos`} />
        </dl>
        <p className="mt-4 text-sm text-neutral-400">
          Fórmula: RTP = base + p × E[juegos por ronda] × E[premio por juego gratis], con E[juegos por ronda] = {award} / (1 − r × {award}).
          p = probabilidad de las 3 bailarinas completas en el juego base; r = la misma probabilidad en los rodillos de juegos gratis.
        </p>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold text-neutral-100">Reglas</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-neutral-300">
          <li>Juego base: paga solo en 5 líneas (3 horizontales y 2 diagonales), por 3 iguales.</li>
          <li>Bailarina: ocupa el rodillo entero (cabeza x3, torso x2, piernas x1). Con las 3 completas: {award} juegos gratis.</li>
          <li>
            En el juego base la bailarina no es comodín: solo activa los juegos gratis. Si lo fuera, con un bonus frecuente dos bailarinas
            completas coincidirían a menudo y pagarían todas las líneas: con bonus cada 150 giros, el juego base solo devolvería más de 200%.
          </li>
          <li>
            Juegos gratis: paga cualquier trío en pantalla, una vez por símbolo. La bailarina es comodín y completa los pares con su
            multiplicador; los multiplicadores de las bailarinas usadas se multiplican. Las bailarinas solas no pagan.
          </li>
          <li>3 bailarinas completas durante los juegos gratis suman {award} juegos más (retrigger).</li>
          <li>
            Bonus misterioso: 3 en un premio pagan al azar como uno de los 7 símbolos de la tabla (promedio {MYSTERY_MEAN_PAY.toFixed(1)}x por
            línea).
          </li>
        </ul>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold text-neutral-100">Tabla de pagos</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="py-2">Símbolo (3 iguales)</th>
                <th>x apuesta por línea</th>
                <th>x apuesta total</th>
              </tr>
            </thead>
            <tbody>
              {[...MYSTERY_SYMBOLS].reverse().map((s) => (
                <tr key={s} className="border-t border-neutral-800">
                  <td className="flex items-center gap-3 py-2 text-neutral-200">
                    <SymbolIcon id={s} size={32} />
                    {SYMBOL_NAMES[s]}
                  </td>
                  <td className="font-mono text-neutral-100">{PAYS[s]}x</td>
                  <td className="font-mono text-neutral-400">{(PAYS[s] / 5).toFixed(1)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <StripTable title="Rodillos del juego base" reels={machine.base} />
        <StripTable title="Rodillos de los juegos gratis" reels={machine.free} />
      </div>
    </div>
  );
}

function StripTable({ title, reels }: { title: string; reels: ReelSet }) {
  return (
    <section className="rounded-2xl bg-neutral-900 p-5">
      <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
      <p className="mt-1 text-sm text-neutral-400">Peso de cada parada = probabilidad de que ese símbolo quede en la fila del centro.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {reels.strips.map((strip, r) => (
          <div key={r} className="rounded-xl bg-neutral-950/60 p-3">
            <p className="mb-2 text-sm font-semibold text-neutral-200">Rodillo {r + 1}</p>
            <ol className="space-y-0.5 text-xs">
              {strip.map((sym, i) => (
                <li key={i} className="flex items-center gap-2 text-neutral-300">
                  <span className="w-5 text-right font-mono text-neutral-500">{i}</span>
                  <SymbolIcon id={sym} size={16} />
                  <span className="flex-1 truncate">{SYMBOL_NAMES[sym]}</span>
                  <span className="w-14 text-right font-mono text-neutral-500">{formatPct(reels.weights[r][i] / reels.totalWeight[r])}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-950/60 p-3">
      <dt className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 font-mono text-lg text-neutral-100">{value}</dd>
    </div>
  );
}
