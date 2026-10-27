import { PAYLINES } from '../../plenty/evaluate.ts';
import type { TuneResult } from '../../plenty/machine.ts';
import { LINE_PAYS, SCATTER_PAYS, STAR, SYMBOL_NAMES } from '../../plenty/symbols.ts';
import { MAX_GAMBLES } from '../../plenty/session.ts';
import { formatPct } from '../format.ts';
import { LINE_COLORS, PlentySymbol } from './common.tsx';

/** Paytable rows, highest first; symbols that share a prize share a row. */
const PAY_ROWS: number[][] = [[6], [4], [5, 3], [0, 1, 2]];

export function PlentyMath({ tuned }: { tuned: TuneResult }) {
  const { machine, analysis } = tuned;
  const starOdds = analysis.starDistribution[3] + analysis.starDistribution[4] + analysis.starDistribution[5];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold text-neutral-100">Desglose teórico (cálculo exacto)</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Cada línea ve una fila por rodillo y los rodillos son independientes, así que el pago esperado de una línea es exacto sin
          recorrer las combinaciones de 5 rodillos. Las estrellas nunca caen dos en el mismo rodillo.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Item label="RTP total" value={formatPct(analysis.rtp, 4)} />
          <Item label="RTP líneas" value={formatPct(analysis.lineRtp, 2)} />
          <Item label="RTP estrellas" value={formatPct(analysis.scatterRtp, 2)} />
          <Item label="3+ estrellas" value={`1 en ${(1 / starOdds).toFixed(1)}`} />
        </dl>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold text-neutral-100">Reglas</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-neutral-300">
          <li>5 rodillos x 3 filas, 20 líneas fijas. Premios de izquierda a derecha, solo en líneas.</li>
          <li>El Siete es comodín: sustituye a todo menos a la estrella, y paga por sí mismo. Por línea se paga solo el premio más alto.</li>
          <li>La estrella paga en cualquier posición, en veces la apuesta total, y se suma a las líneas.</li>
          <li>Las frutas caen apiladas. No hay juegos gratis.</li>
          <li>Doble o nada (rojo o negro) tras cada premio, hasta {MAX_GAMBLES} dobles. Es 50/50: no cambia el RTP.</li>
        </ul>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold text-neutral-100">Tabla de pagos</h2>
        <p className="mt-1 text-sm text-neutral-400">Fuente: pantalla de pagos del juego (5 créditos por línea), convertida a veces la apuesta por línea.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="py-2">Símbolos</th>
                <th>x3</th>
                <th>x4</th>
                <th>x5</th>
              </tr>
            </thead>
            <tbody>
              {PAY_ROWS.map((group) => (
                <tr key={group.join()} className="border-t border-neutral-800">
                  <td className="py-2">
                    <div className="flex flex-wrap items-center gap-2 text-neutral-200">
                      {group.map((s) => (
                        <span key={s} className="flex items-center gap-1">
                          <PlentySymbol id={s} size={30} />
                          {SYMBOL_NAMES[s]}
                        </span>
                      ))}
                    </div>
                  </td>
                  {[3, 4, 5].map((k) => (
                    <td key={k} className="font-mono text-neutral-100">
                      {LINE_PAYS[group[0]][k]}x línea
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-neutral-800">
                <td className="py-2">
                  <span className="flex items-center gap-2 text-neutral-200">
                    <PlentySymbol id={STAR} size={30} />
                    Estrella, en cualquier posición
                  </span>
                </td>
                {[3, 4, 5].map((k) => (
                  <td key={k} className="font-mono text-amber-300">
                    {SCATTER_PAYS[k]}x apuesta
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold text-neutral-100">Las 20 líneas</h2>
        <p className="mt-1 text-sm text-amber-300">Provisional: es el dibujo más común en 5x3. Falta confirmarlo con la pantalla de líneas del juego.</p>
        <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-10">
          {PAYLINES.map((rows, l) => (
            <figure key={l} className="rounded-lg bg-neutral-950/60 p-2">
              <svg viewBox="0 0 50 30" className="w-full">
                {[0, 1, 2].map((row) =>
                  [0, 1, 2, 3, 4].map((reel) => (
                    <rect key={`${row}-${reel}`} x={reel * 10 + 1} y={row * 10 + 1} width={8} height={8} rx={1.5} fill={rows[reel] === row ? LINE_COLORS[l] : '#262626'} />
                  )),
                )}
              </svg>
              <figcaption className="mt-1 text-center font-mono text-xs text-neutral-400">{l + 1}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold text-neutral-100">Rodillos y pesos virtuales</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Peso de cada parada = probabilidad de que ese símbolo quede en la fila del centro. Para fijar el RTP solo se mueve el peso del Siete.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {machine.strips.map((strip, r) => (
            <div key={r} className="rounded-xl bg-neutral-950/60 p-3">
              <p className="mb-2 text-sm font-semibold text-neutral-200">Rodillo {r + 1}</p>
              <ol className="space-y-0.5 text-xs">
                {strip.map((sym, i) => (
                  <li key={i} className="flex items-center gap-2 text-neutral-300">
                    <span className="w-5 text-right font-mono text-neutral-500">{i}</span>
                    <PlentySymbol id={sym} size={14} />
                    <span className="flex-1 truncate">{SYMBOL_NAMES[sym].split(' (')[0]}</span>
                    <span className="font-mono text-neutral-500">{formatPct(machine.weights[r][i] / machine.totalWeight[r], 1)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>
    </div>
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
