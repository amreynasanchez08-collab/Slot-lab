import { wildVisibility, type TuneResult } from '../../fuego/machine.ts';
import { GAMBLE_LIMIT_X, MAX_GAMBLES } from '../../fuego/session.ts';
import { BELL, CHERRY, GRAPES, LEMON, MELON, ORANGE, PAYS, PEAR, PLUM, SEVEN, SYMBOL_NAMES, WILD } from '../../fuego/symbols.ts';
import { sectorProbability, WHEEL_SECTORS } from '../../fuego/wheel.ts';
import { formatPct } from '../format.ts';
import { FuegoIcon } from './FuegoSymbols.tsx';

const PAY_ROWS: number[][] = [[WILD], [SEVEN, BELL], [PEAR, GRAPES], [MELON, PLUM], [CHERRY, LEMON, ORANGE]];

export function FuegoMath({ tuned }: { tuned: TuneResult }) {
  const { machine, analysis: a } = tuned;
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const wildBase = mean(wildVisibility(machine.base));
  const wildFree = mean(wildVisibility(machine.free));
  const avgFreeSpins =
    WHEEL_SECTORS.reduce((s, x, i) => s + (x.kind === 'free' ? sectorProbability(i) * x.value : 0), 0) /
    WHEEL_SECTORS.reduce((s, x, i) => s + (x.kind === 'free' ? sectorProbability(i) : 0), 0);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold text-neutral-100">Desglose teórico (cálculo exacto)</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Cada una de las 27 formas ve una fila por rodillo y los rodillos son independientes, así que su pago esperado es exacto. La rueda suma
          sus multiplicadores y el valor esperado de los giros gratis, que se calcula igual sobre sus propios rodillos.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Item label="RTP total" value={formatPct(a.rtp, 4)} />
          <Item label="RTP juego base" value={formatPct(a.baseRtp, 2)} />
          <Item label="RTP rueda" value={formatPct(a.wheelRtp, 2)} />
          <Item label="Rueda" value={`1 en ${(1 / a.triggerProbability).toFixed(1)}`} />
          <Item label="Giros con premio (base)" value={formatPct(a.baseHitFrequency, 2)} />
          <Item label="Valor de la rueda" value={`${a.wheelValue.toFixed(1)}x apuesta`} />
          <Item label="Valor de un giro gratis" value={`${a.freeSpinValue.toFixed(2)}x apuesta`} />
          <Item label="Ronda gratis promedio" value={`${avgFreeSpins.toFixed(1)} giros · ${(avgFreeSpins * a.freeSpinValue).toFixed(0)}x`} />
        </dl>
        <p className="mt-3 text-xs text-neutral-500">
          El premio mínimo es 2 veces la apuesta, así que este juego no tiene pérdidas disfrazadas: cuando paga, paga más de lo apostado.
        </p>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold text-neutral-100">Reglas</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-neutral-300">
          <li>3 rodillos x 3 filas, 27 formas de ganar: un símbolo por rodillo, de izquierda a derecha, en cualquier fila.</li>
          <li>El mismo símbolo dos veces en un rodillo paga dos formas. Cada forma paga en veces la apuesta total; se suman todas.</li>
          <li>El comodín sustituye a todos los símbolos menos a la rueda. Tres comodines en una forma pagan 50 veces.</li>
          <li>Una rueda en cada rodillo, en cualquier posición, gira la rueda misteriosa. Tres comodines no la activan.</li>
          <li>
            Los giros gratis usan otros rodillos, sin ruedas, y pagan a la apuesta que activó la rueda. Un rodillo muestra comodín el{' '}
            {formatPct(wildFree, 1)} de las veces en los giros gratis y el {formatPct(wildBase, 1)} en el juego base: el ajuste de RTP mueve sobre todo el comodín de la base.
          </li>
          <li>
            Doble o nada (rojo o negro) hasta {MAX_GAMBLES} veces, solo con premios de hasta {GAMBLE_LIMIT_X} veces la apuesta. Es 50/50: no cambia el RTP.
          </li>
          <li className="text-amber-300">
            Supuestos nuestros: el original no publica las probabilidades de la rueda ni sus rodillos. Las de abajo son de diseño propio.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold text-neutral-100">Tabla de pagos</h2>
        <p className="mt-1 text-sm text-neutral-400">Fuente: pantalla de reglas del juego original (demo oficial), en veces la apuesta total por forma.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="py-2">Símbolos</th>
                <th>3 iguales en una forma</th>
              </tr>
            </thead>
            <tbody>
              {PAY_ROWS.map((group) => (
                <tr key={group.join()} className="border-t border-neutral-800">
                  <td className="py-2">
                    <div className="flex flex-wrap items-center gap-3 text-neutral-200">
                      {group.map((s) => (
                        <span key={s} className="flex items-center gap-1.5">
                          <FuegoIcon id={s} size={26} />
                          {SYMBOL_NAMES[s]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="font-mono text-neutral-100">{PAYS[group[0]]}x apuesta</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold text-neutral-100">Rueda misteriosa</h2>
        <p className="mt-1 text-sm text-neutral-400">Las 8 casillas se dibujan del mismo tamaño; lo que cuenta es su probabilidad.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {WHEEL_SECTORS.map((s, i) => (
            <div key={i} className="rounded-xl bg-neutral-950/60 p-3">
              <p className={`font-mono text-lg font-bold ${s.kind === 'multiplier' ? 'text-amber-300' : 'text-orange-200'}`}>{s.kind === 'multiplier' ? `x${s.value}` : `${s.value} giros`}</p>
              <p className="text-xs text-neutral-400">{formatPct(sectorProbability(i), 0)} de las veces</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold text-neutral-100">Rodillos y pesos virtuales</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Cada rodillo carga una fruta apilada de a tres (cerezas, limones, naranjas). Para fijar el RTP se mueve el peso del comodín y sus
          vecinos; para fijar la frecuencia de la rueda, el peso de las ruedas.
        </p>
        {(['base', 'free'] as const).map((which) => (
          <div key={which} className="mt-4">
            <p className="mb-2 text-sm font-semibold text-neutral-200">{which === 'base' ? 'Juego base' : 'Giros gratis'}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {machine[which].strips.map((strip, r) => (
                <div key={r} className="rounded-xl bg-neutral-950/60 p-3">
                  <p className="mb-2 text-sm font-semibold text-neutral-300">Rodillo {r + 1}</p>
                  <ol className="max-h-72 space-y-0.5 overflow-y-auto pr-1 text-xs">
                    {strip.map((sym, i) => (
                      <li key={i} className="flex items-center gap-2 text-neutral-300">
                        <span className="w-5 text-right font-mono text-neutral-500">{i}</span>
                        <FuegoIcon id={sym} size={14} />
                        <span className="flex-1 truncate">{SYMBOL_NAMES[sym]}</span>
                        <span className="font-mono text-neutral-500">{formatPct(machine[which].weights[r][i] / machine[which].totalWeight[r], 1)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        ))}
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
