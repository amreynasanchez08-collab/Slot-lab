import { useEffect, useMemo, useState } from 'react';
import { tune } from '../../fuego/machine.ts';
import { BET_STEP } from '../../fuego/session.ts';
import { Field, TabBar, type LabTab } from '../Controls.tsx';
import { formatMoney, formatPct, parseMoney } from '../format.ts';
import { loadJson, saveJson } from '../storage.ts';
import { FuegoMath } from './FuegoMath.tsx';
import { FuegoPlayground } from './FuegoPlayground.tsx';
import { FuegoSimulator } from './FuegoSimulator.tsx';

const RTP_MIN = 90;
const RTP_MAX = 99;
/** The original's published RTP. */
const DEFAULT_RTP = 96.37;
const WHEEL_MIN = 130;
const WHEEL_MAX = 400;

interface Config {
  startBalance: number;
  bet: number;
  targetRtp: number;
  wheelEvery: number;
  version: number;
}

const CONFIG_KEY = 'slotlab.fuego.config.v1';
const DEFAULT_CONFIG: Config = { startBalance: 10_000, bet: 30, targetRtp: DEFAULT_RTP, wheelEvery: 150, version: 0 };

export function FuegoLab({ active }: { active: boolean }) {
  // Tuning waits until the game is first opened, so the other games load without paying for it.
  const [opened, setOpened] = useState(active);
  useEffect(() => {
    if (active) setOpened(true);
  }, [active]);
  if (!opened) return null;
  return <FuegoLabBody active={active} />;
}

function FuegoLabBody({ active }: { active: boolean }) {
  const [tab, setTab] = useState<LabTab>('play');
  const [config, setConfig] = useState<Config>(() => loadJson<Config>(CONFIG_KEY) ?? DEFAULT_CONFIG);
  const [form, setForm] = useState(() => ({
    startBalance: (config.startBalance / 100).toFixed(2),
    bet: (config.bet / 100).toFixed(2),
    targetRtp: String(config.targetRtp),
    wheelEvery: String(config.wheelEvery),
  }));
  useEffect(() => saveJson(CONFIG_KEY, config), [config]);
  // On a phone the settings start folded so the machine shows first.
  const [showSettings, setShowSettings] = useState(() => {
    try {
      return window.matchMedia('(min-width: 640px)').matches;
    } catch {
      return true;
    }
  });

  // Tuning takes ~0.3 s; it only runs when a target changes.
  const tuned = useMemo(() => tune({ rtp: config.targetRtp / 100, wheelEvery: config.wheelEvery }), [config.targetRtp, config.wheelEvery]);
  const a = tuned.analysis;

  const parsedBalance = parseMoney(form.startBalance);
  const parsedBet = parseMoney(form.bet);
  const parsedRtp = Number(form.targetRtp);
  const parsedWheel = Number(form.wheelEvery);
  const errors = [
    parsedBalance === null || parsedBalance <= 0 ? 'Saldo inicial inválido.' : null,
    parsedBet === null || parsedBet <= 0 || parsedBet % BET_STEP !== 0 ? 'La apuesta debe ser múltiplo de $0.10.' : null,
    !Number.isFinite(parsedRtp) || parsedRtp < RTP_MIN || parsedRtp > RTP_MAX ? `RTP entre ${RTP_MIN}% y ${RTP_MAX}%.` : null,
    !Number.isInteger(parsedWheel) || parsedWheel < WHEEL_MIN || parsedWheel > WHEEL_MAX ? `Rueda cada ${WHEEL_MIN} a ${WHEEL_MAX} giros.` : null,
  ].filter((e): e is string => e !== null);

  const apply = () => {
    if (errors.length > 0 || parsedBalance === null || parsedBet === null) return;
    setConfig((c) => ({ startBalance: parsedBalance, bet: parsedBet, targetRtp: parsedRtp, wheelEvery: parsedWheel, version: c.version + 1 }));
  };
  const dirty = parsedBalance !== config.startBalance || parsedBet !== config.bet || parsedRtp !== config.targetRtp || parsedWheel !== config.wheelEvery;

  return (
    <div className="space-y-6">
      <TabBar tab={tab} onChange={setTab} />
      {!showSettings && (
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="flex w-full items-center justify-between rounded-2xl bg-neutral-900 px-5 py-3 text-left text-sm text-neutral-300"
        >
          <span className="font-semibold text-neutral-100">Ajustes</span>
          <span className="text-xs text-neutral-500">
            RTP {formatPct(a.rtp, 2)} · rueda 1 en {Math.round(1 / a.triggerProbability)} ▸
          </span>
        </button>
      )}
      <section hidden={!showSettings} className="flex flex-wrap items-end gap-4 rounded-2xl bg-neutral-900 p-5">
        <Field label="Saldo inicial ($)" value={form.startBalance} onChange={(v) => setForm((f) => ({ ...f, startBalance: v }))} />
        <Field label="Apuesta por giro ($)" value={form.bet} onChange={(v) => setForm((f) => ({ ...f, bet: v }))} />
        <Field label={`RTP objetivo (${RTP_MIN}–${RTP_MAX}%)`} value={form.targetRtp} onChange={(v) => setForm((f) => ({ ...f, targetRtp: v }))} />
        <Field label={`Rueda cada (giros)`} value={form.wheelEvery} onChange={(v) => setForm((f) => ({ ...f, wheelEvery: v }))} />
        <button
          type="button"
          onClick={apply}
          disabled={errors.length > 0 || !dirty}
          className="rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-neutral-950 hover:bg-amber-300 disabled:opacity-40"
        >
          Aplicar y reiniciar
        </button>
        <div className="ml-auto text-right text-sm">
          <p className="text-neutral-400">
            RTP teórico exacto: <span className="font-mono font-semibold text-amber-300">{formatPct(a.rtp, 3)}</span>
          </p>
          <p className="text-xs text-neutral-500">
            Base {formatPct(a.baseRtp / a.rtp, 0)} · rueda {formatPct(a.wheelRtp / a.rtp, 0)} · rueda 1 en {Math.round(1 / a.triggerProbability)} giros · saldo{' '}
            {formatMoney(config.startBalance)} · apuesta {formatMoney(config.bet)}
          </p>
          {!tuned.reachable && (
            <p className="text-xs text-rose-300">
              Con esa frecuencia de rueda el RTP va de {formatPct(tuned.minRtp, 1)} a {formatPct(tuned.maxRtp, 1)}; se usó el más cercano.
            </p>
          )}
        </div>
        {errors.length > 0 && <p className="w-full text-sm text-rose-300">{errors.join(' ')}</p>}
        <button type="button" onClick={() => setShowSettings(false)} className="text-xs text-neutral-500 underline sm:hidden">
          Ocultar ajustes
        </button>
      </section>

      <div hidden={tab !== 'play'}>
        <FuegoPlayground
          key={config.version}
          machine={tuned.machine}
          startBalance={config.startBalance}
          bet={config.bet}
          configVersion={config.version}
          active={active && tab === 'play'}
        />
      </div>
      <div hidden={tab !== 'sim'}>
        <FuegoSimulator key={config.version} machine={tuned.machine} analysis={a} startBalance={config.startBalance} bet={config.bet} />
      </div>
      <div hidden={tab !== 'math'}>
        <FuegoMath tuned={tuned} />
      </div>
    </div>
  );
}
