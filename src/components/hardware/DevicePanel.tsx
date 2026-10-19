import React from 'react';
import { useSimulation } from '../../context/SimulationContext';
export const DevicePanel: React.FC = () => {
  const { dataMode, setDataMode, band, hardware, groupProfile, currentUser, lifecycleState } = useSimulation();
  const hardwareMode = dataMode === 'hardware';
  const locked = lifecycleState === 'ACTIVE_HIKE' || band.busy || band.connection === 'connecting';
  const button = 'px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold disabled:opacity-50';
  return <section aria-label="Band connection" className="mb-5 p-4 rounded-xl border border-slate-200 bg-white space-y-3 text-slate-800">
    <div className="flex flex-wrap justify-between gap-3 items-center">
      <label className="font-semibold text-sm">Data source <select aria-label="Data source" value={dataMode} disabled={locked} onChange={e => setDataMode(e.target.value as typeof dataMode)} className="ml-2 p-2 rounded-lg border border-slate-300">
        <option value="simulation">Software demo</option><option value="hardware">My Heltec band</option>
      </select></label>
      <span className="text-sm">{hardwareMode ? `Bluetooth: ${band.connection}` : 'Simulated positions, radio and wearable actions'}</span>
    </div>
    {hardwareMode && <>
      <p className="text-sm">Group <strong>{groupProfile?.code}</strong> · Your member ID <strong>{currentUser?.memberId}</strong>. Each band needs a unique member ID and the same group code.</p>
      <div className="flex flex-wrap gap-2">
        {band.connection === 'disconnected' ? <button className={button} onClick={() => void band.connect()}>Connect band</button> : <button className={button} disabled={band.busy || band.connection === 'connecting'} onClick={() => void band.disconnect()}>Disconnect band</button>}
        {band.connection === 'connected' && <>
          <button className={button} disabled={band.busy || lifecycleState === 'ACTIVE_HIKE'} onClick={() => void band.configure(groupProfile!.code, currentUser!.memberId)}>Use this group and member ID</button>
          <button className={button} disabled={band.busy} onClick={() => void band.refresh()}>Refresh band status</button>
        </>}
      </div>
      <p className="text-sm" role="status">{!band.hello ? 'Connect a board running the included bridge firmware.' : !hardware.matches ? `Connected to ${band.hello.node} in ${band.hello.group}. Save this group and member ID to use its data.` : !hardware.connected ? 'Disconnected. Displayed alerts are retained; live positions are unavailable.' : !band.hello.radio ? 'Bluetooth connected. LoRa is unavailable: check the firmware frequency and radio settings.' : `LoRa ready · ${hardware.localFix ? 'Your GPS has a fresh fix' : 'Waiting for your GPS fix'} · ${Object.keys(band.peers).length} bands heard`}</p>
      {band.error && <p role="alert" className="text-sm text-red-700">{band.error}</p>}
      <p className="text-xs text-slate-500">Prototype field test. Keep this screen open. Live checkpoints, physical fall sensors, buzzers and offline map tiles are not integrated yet.</p>
      <details className="text-xs"><summary className="cursor-pointer">Connection details</summary><p className="mt-2">{band.name || 'No band selected'} · Last 100 connection events</p><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap">{band.log.join('\n') || 'No events yet.'}</pre></details>
    </>}
    {!hardwareMode && <p className="text-xs text-slate-500">Choose My Heltec band in the lobby to use physical Bluetooth and LoRa. The existing Python model can be tested with simulated motion in software demo mode.</p>}
  </section>;
};
