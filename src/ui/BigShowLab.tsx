import { useMemo, useState } from 'react';
import { tune } from '../engine/machine.ts';
import { Field, TabBar } from './Controls.tsx';
import { formatMoney, formatPct, parseMoney } from './format.ts';
import { MathPanel } from './MathPanel.tsx';
import { Playground } from './Playground.tsx';
import { Simulator } from './Simulator.tsx';

type Tab = 'play' | 'sim' | 'math';

const RTP_MIN = 85;
const RTP_MAX = 99;
const BONUS_MIN = 80;
const BONUS_MAX = 400;

interface Config {
  startBalance: number;
  bet: number;
  targetRtp: number;
  bonusEvery: number;
  version: number;
}

export function BigShowLab({ active }: { active: boolean }) {
  const [tab, setTab] = useState<Tab>('play');
  const [config, setConfig] = useState<Config>({ startBalance: 10_000, bet: 100, targetRtp: 95, bonusEvery: 150, version: 0 });
  const [form, setForm] = useState({ startBalance: '100.00', bet: '1.00', targetRtp: '95', bonusEvery: '150' });

  const tuned = useMemo(() => tune({ rtp: config.targetRtp / 100, bonusEvery: config.bonusEvery }), [config.targetRtp, config.bonusEvery]);
  const a = tuned.analysis;

  const parsedBalance = parseMoney(form.startBalance);
  const parsedBet = parseMoney(form.bet);
  const parsedRtp = Number(form.targetRtp);
  const parsedBonus = Number(form.bonusEvery);
  const errors = [
    parsedBalance === null || parsedBalance <= 0 ? 'Saldo inicial inválido.' : null,
    parsedBet === null || parsedBet <= 0 || parsedBet % 5 !== 0 ? 'La apuesta debe ser múltiplo de $0.05 (5 líneas).' : null,
    !Number.isFinite(parsedRtp) || parsedRtp < RTP_MIN || parsedRtp > RTP_MAX ? `RTP entre ${RTP_MIN}% y ${RTP_MAX}%.` : null,
    !Number.isInteger(parsedBonus) || parsedBonus < BONUS_MIN || parsedBonus > BONUS_MAX ? `Bonus cada ${BONUS_MIN} a ${BONUS_MAX} giros.` : null,
  ].filter((e): e is string => e !== null);

  const apply = () => {
    if (errors.length > 0 || parsedBalance === null || parsedBet === null) return;
    setConfig((c) => ({ startBalance: parsedBalance, bet: parsedBet, targetRtp: parsedRtp, bonusEvery: parsedBonus, version: c.version + 1 }));
  };

  const dirty =
    parsedBalance !== config.startBalance || parsedBet !== config.bet || parsedRtp !== config.targetRtp || parsedBonus !== config.bonusEvery;

  return (
    <div className="space-y-6">
      <TabBar tab={tab} onChange={setTab} />
      <section className="flex flex-wrap items-end gap-4 rounded-2xl bg-neutral-900 p-5">
        <Field label="Saldo inicial ($)" value={form.startBalance} onChange={(v) => setForm((f) => ({ ...f, startBalance: v }))} />
        <Field label="Apuesta por giro ($)" value={form.bet} onChange={(v) => setForm((f) => ({ ...f, bet: v }))} />
        <Field label={`RTP objetivo (${RTP_MIN}–${RTP_MAX}%)`} value={form.targetRtp} onChange={(v) => setForm((f) => ({ ...f, targetRtp: v }))} />
        <Field label="Bonus cada N giros" value={form.bonusEvery} onChange={(v) => setForm((f) => ({ ...f, bonusEvery: v }))} />
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
            Base {formatPct(a.baseRtp / a.rtp, 0)} · juegos gratis {formatPct(a.freeGameRtp / a.rtp, 0)} · ronda media {a.expectedRoundWin.toFixed(0)}x ·
            saldo {formatMoney(config.startBalance)} · apuesta {formatMoney(config.bet)}
          </p>
          {!tuned.reachable && <p className="text-xs text-rose-300">Ese RTP no se alcanza con este bonus; se usó el más cercano.</p>}
        </div>
        {errors.length > 0 && <p className="w-full text-sm text-rose-300">{errors.join(' ')}</p>}
      </section>

      {/* All tabs stay mounted so the session, the log and a running round survive a tab switch. */}
      <div hidden={tab !== 'play'}>
        <Playground key={config.version} machine={tuned.machine} startBalance={config.startBalance} bet={config.bet} active={active && tab === 'play'} />
      </div>
      <div hidden={tab !== 'sim'}>
        <Simulator key={config.version} machine={tuned.machine} analysis={a} startBalance={config.startBalance} bet={config.bet} />
      </div>
      <div hidden={tab !== 'math'}>
        <MathPanel tuned={tuned} />
      </div>
    </div>
  );
}
