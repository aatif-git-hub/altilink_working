import React from 'react';
import { useSimulation } from '../../context/SimulationContext';
const metric = (n: number | null, unit = '') => n === null || !Number.isFinite(n) ? 'Unavailable' : `${Math.round(n * 10) / 10}${unit}`;
export const HardwareLinkPanel: React.FC = () => {
  const { hardware, safetyMargin, setSafetyMargin } = useSimulation();
  return <section className="space-y-4 text-slate-800">
    <div className="rounded-xl border bg-white p-5 space-y-3">
      <h1 className="text-2xl font-bold">Band communication</h1>
      <p>Measurements from packets received by your band. Distances are relative to your band.</p>
      <p className="font-semibold">Suggested separation limit: {metric(hardware.limit, ' m')}</p>
      <p className="text-sm">This is a margin below a tested distance, not a prediction of maximum radio range. An unknown limit must not be treated as a safe connection.</p>
      <label className="block text-sm">Safety margin: {safetyMargin}%<input aria-label="Hardware safety margin" className="block w-full mt-2" type="range" min={10} max={50} step={5} value={safetyMargin} onChange={e => setSafetyMargin(Number(e.target.value))}/></label>
    </div>
    {!hardware.connected && <p role="status">Connect your configured band to receive current measurements.</p>}
    {!hardware.stats.length && <p>No other bands heard yet. Both boards must use the same group and radio settings.</p>}
    {hardware.stats.map(s => <article key={s.id} className="rounded-xl border bg-white p-5 space-y-2">
      <h2 className="font-bold">{s.id} · {!hardware.connected || s.stale ? 'Stale / unavailable' : 'Receiving packets'}</h2>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div><dt>Signal</dt><dd>{metric(s.rssi, ' dBm')}</dd></div>
        <div><dt>Signal quality</dt><dd>{metric(s.snr, ' dB')}</dd></div>
        <div><dt>Observed delivery</dt><dd>{metric(s.delivery, '%')}</dd></div>
        <div><dt>Position samples</dt><dd>{s.samples}</dd></div>
      </dl>
      <p className="text-sm">Qualified distance: {metric(hardware.connected ? s.boundary : null, ' m')} · Suggested limit: {metric(hardware.connected && hardware.localFix ? s.limit : null, ' m')}</p>
    </article>)}
    <p className="text-xs text-slate-500">A limit needs at least 10 recent position packets at roughly constant separation, GPS on both boards, delivery ≥90%, RSSI ≥−90 dBm and SNR ≥0 dB. Positions expire after 45 seconds. Delivery counts sequence gaps between received packets over the last two minutes; it cannot count losses after the last received packet. These measurements cover the bands heard, not an enrolled roster or every link in the group.</p>
  </section>;
};
