import { useEffect, useMemo, useState } from 'react';
import { tune } from '../../plenty/machine.ts';
import { BET_STEP } from '../../plenty/session.ts';
import { Field, TabBar, type LabTab } from '../Controls.tsx';
import { formatMoney, formatPct, parseMoney } from '../format.ts';
import { loadJson, saveJson } from '../storage.ts';
import { PlentyMath } from './PlentyMath.tsx';
import { PlentyPlayground } from './PlentyPlayground.tsx';
import { PlentySimulator } from './PlentySimulator.tsx';

const RTP_MIN = 86;
const RTP_MAX = 99;
/** The game's published RTP. */
const DEFAULT_RTP = 95.61;

interface Config {
  startBalance: number;
  bet: number;
  targetRtp: number;
  version: number;
}

const CONFIG_KEY = 'slotlab.plenty.config.v1';
const DEFAULT_CONFIG: Config = { startBalance: 10_000, bet: 100, targetRtp: DEFAULT_RTP, version: 0 };

export function PlentyLab({ active }: { active: boolean }) {
  const [tab, setTab] = useState<LabTab>('play');
  const [config, setConfig] = useState<Config>(() => loadJson<Config>(CONFIG_KEY) ?? DEFAULT_CONFIG);
  const [form, setForm] = useState(() => ({
    startBalance: (config.startBalance / 100).toFixed(2),
    bet: (config.bet / 100).toFixed(2),
    targetRtp: String(config.targetRtp),
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

  // Tuning takes ~0.6 s; it only runs when the RTP target changes.
  const tuned = useMemo(() => tune(config.targetRtp / 100), [config.targetRtp]);
  const a = tuned.analysis;

  const parsedBalance = parseMoney(form.startBalance);
  const parsedBet = parseMoney(form.bet);
  const parsedRtp = Number(form.targetRtp);
  const errors = [
    parsedBalance === null || parsedBalance <= 0 ? 'Saldo inicial inválido.' : null,
    parsedBet === null || parsedBet <= 0 || parsedBet % BET_STEP !== 0 ? 'La apuesta debe ser múltiplo de $0.20 (20 líneas).' : null,
    !Number.isFinite(parsedRtp) || parsedRtp < RTP_MIN || parsedRtp > RTP_MAX ? `RTP entre ${RTP_MIN}% y ${RTP_MAX}%.` : null,
  ].filter((e): e is string => e !== null);

  const apply = () => {
    if (errors.length > 0 || parsedBalance === null || parsedBet === null) return;
    setConfig((c) => ({ startBalance: parsedBalance, bet: parsedBet, targetRtp: parsedRtp, version: c.version + 1 }));
  };
  const dirty = parsedBalance !== config.startBalance || parsedBet !== config.bet || parsedRtp !== config.targetRtp;

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
            RTP {formatPct(a.rtp, 2)} · saldo inicial {formatMoney(config.startBalance)} ▸
          </span>
        </button>
      )}
      <section hidden={!showSettings} className="flex flex-wrap items-end gap-4 rounded-2xl bg-neutral-900 p-5">
        <Field label="Saldo inicial ($)" value={form.startBalance} onChange={(v) => setForm((f) => ({ ...f, startBalance: v }))} />
        <Field label="Apuesta por giro ($)" value={form.bet} onChange={(v) => setForm((f) => ({ ...f, bet: v }))} />
        <Field label={`RTP objetivo (${RTP_MIN}–${RTP_MAX}%)`} value={form.targetRtp} onChange={(v) => setForm((f) => ({ ...f, targetRtp: v }))} />
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
            Líneas {formatPct(a.lineRtp / a.rtp, 0)} · estrellas {formatPct(a.scatterRtp / a.rtp, 0)} · saldo {formatMoney(config.startBalance)} · apuesta{' '}
            {formatMoney(config.bet)}
          </p>
          {!tuned.reachable && <p className="text-xs text-rose-300">Ese RTP no se alcanza con estos rodillos; se usó el más cercano.</p>}
        </div>
        {errors.length > 0 && <p className="w-full text-sm text-rose-300">{errors.join(' ')}</p>}
        <button type="button" onClick={() => setShowSettings(false)} className="text-xs text-neutral-500 underline sm:hidden">
          Ocultar ajustes
        </button>
      </section>

      <div hidden={tab !== 'play'}>
        <PlentyPlayground
          key={config.version}
          machine={tuned.machine}
          startBalance={config.startBalance}
          bet={config.bet}
          configVersion={config.version}
          active={active && tab === 'play'}
        />
      </div>
      <div hidden={tab !== 'sim'}>
        <PlentySimulator key={config.version} machine={tuned.machine} analysis={a} startBalance={config.startBalance} bet={config.bet} />
      </div>
      <div hidden={tab !== 'math'}>
        <PlentyMath tuned={tuned} />
      </div>
    </div>
  );
}
