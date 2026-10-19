import { coordinates, numberOrUnknown } from '../hardware/display';
import React, { useState } from 'react';
import {
  AlertOctagon,
  Radio,
  Volume2,
  CheckCircle2,
  Clock,
  MapPin,
  Activity,
  XCircle,
  Cpu,
} from 'lucide-react';
import clsx from 'clsx';
import { useSimulation } from '../context/SimulationContext';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

export const EmergencyPage: React.FC = () => {
  const {
    dataMode, band, hardware, acknowledgeHardwareSOS,
    groupProfile,
    members,
    activeEmergency,
    broadcastRecipients,
    broadcastProgress,
    wearableState,
    triggerManualSOS,
    resolveEmergency,
    fallDetectionState,
    startFallSimulation,
    cancelFallAlert,
    confirmFallAndSendSOS,
  } = useSimulation();

  const [isSOSConfirmOpen, setIsSOSConfirmOpen] = useState(false);

  return (
    <div className="space-y-6 animate-fadeIn pb-12 text-slate-900 select-none">
      <ConfirmationModal
        isOpen={isSOSConfirmOpen}
        onClose={() => setIsSOSConfirmOpen(false)}
        onConfirm={() => triggerManualSOS()}
        title="Broadcast Emergency SOS"
        message={dataMode === 'hardware' ? 'Send an SOS over LoRa? GPS is included only with a fresh fix. Peer delivery remains unconfirmed until an acknowledgement arrives.' : 'Simulate an SOS in this software group? This does not transmit over physical LoRa.'}
      />

      {/* Header Banner */}
      <div
        className={clsx(
          'rounded-2xl border p-5 md:p-6 shadow-xs transition-all',
          activeEmergency
            ? 'border-red-300 bg-red-50 animate-emergency-alert'
            : 'border-slate-200 bg-white'
        )}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-red-700 uppercase bg-red-100 px-2 py-0.5 rounded border border-red-200">
                Emergency & SOS Response
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-xs font-mono font-bold text-slate-600">Group {groupProfile?.code || 'ALT-7K4P'}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <span>Emergency Response Subsystem</span>
              {activeEmergency && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-600 text-white font-bold animate-pulse">
                  Active Alert
                </span>
              )}
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              {dataMode === 'hardware' ? 'Manual SOS through your band. Physical fall sensor integration is planned.' : 'Software demo: manual SOS and simulated motion evaluated by the Python fall model.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {activeEmergency ? (
              <button
                onClick={resolveEmergency}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white transition-colors shadow-xs"
              >
                {dataMode === 'hardware' ? 'Clear on this device' : 'Resolve & Clear Alert'}
              </button>
            ) : (
              <button
                disabled={dataMode === "hardware" && (!hardware.ready || band.busy)} onClick={() => setIsSOSConfirmOpen(true)}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-red-600 hover:bg-red-700 text-white shadow-xs transition-all flex items-center gap-2"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>{dataMode === 'hardware' ? 'SEND SOS' : 'SIMULATE SOS'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ACTIVE EMERGENCY DISPLAY */}
      {activeEmergency && (
        <div className="rounded-2xl border-2 border-red-300 bg-white p-5 md:p-6 shadow-sm space-y-5 animate-scaleUp">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-red-100">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-600 text-white shadow-xs">
                <AlertOctagon className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
                  {dataMode === 'hardware' ? (activeEmergency.senderID === band.hello?.node ? 'SOS transmission completed' : 'SOS received over LoRa') : 'Simulated Emergency Alert'}
                </span>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {activeEmergency.messageType === 'FALL_DETECTED' ? 'Confirmed Fall Distress' : 'Manual SOS Distress'}
                </h2>
              </div>
            </div>

            <span className="text-xs font-mono px-3 py-1 rounded-full bg-red-50 text-red-800 border border-red-200 font-bold self-start md:self-auto">
              Group: {activeEmergency.groupID}
            </span>
          </div>

          {/* Details Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold uppercase block">Distressed Member</span>
              <span className="text-base font-bold text-slate-900 mt-0.5 block">
                {activeEmergency.senderName} ({activeEmergency.senderID})
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 font-mono">
              <span className="text-xs text-slate-500 font-semibold uppercase font-sans block">GPS Coordinates</span>
              <span className="text-sm font-bold text-red-700 mt-0.5 block">
                {coordinates(activeEmergency)}
              </span>
              <span className="text-xs text-slate-500 font-sans">Alt: {numberOrUnknown(activeEmergency.altitude)} m</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold uppercase block">Timestamp</span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block font-mono">
                {activeEmergency.timestamp}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-xs text-amber-800 font-semibold uppercase block">Wearable Actuator</span>
              <span className="text-sm font-bold text-amber-900 mt-0.5 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-amber-700" />
                <span>{dataMode === 'hardware' ? 'Not integrated' : 'Simulated buzzer & vibration'}</span>
              </span>
            </div>
          </div>

          {dataMode === 'hardware' && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2 text-sm">
            {activeEmergency.senderID === band.hello?.node ? <>
              <p>{band.outgoingReceipts.length ? `Acknowledged by ${[...new Set(band.outgoingReceipts.map(r => r.from))].join(', ')}` : 'No peer acknowledgement received. Delivery is unconfirmed.'}</p>
              <p>LoRa transmission completion confirms the local radio sent a packet. It does not confirm rescue or delivery to every group member.</p>
            </> : <>
              <p>Received from {activeEmergency.senderID}. Clearing this alert only hides it on this device.</p>
              <button className="px-3 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-50" disabled={!hardware.ready || band.busy || !!band.alerts.find(a => a.id === activeEmergency.packetID)?.acknowledged} onClick={() => void acknowledgeHardwareSOS()}>{band.alerts.find(a => a.id === activeEmergency.packetID)?.acknowledged ? 'Acknowledgement transmitted' : 'Acknowledge received SOS'}</button>
            </>}
          </div>}
          {/* Group Delivery Checklist */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-4 h-4 text-slate-600" />
                <span>{dataMode === 'hardware' ? 'Known peer acknowledgements for your SOS' : 'Group Peer Delivery Status'}</span>
              </h3>
              <span className="text-emerald-700 font-bold font-mono">{broadcastProgress}% Acknowledged</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {broadcastRecipients.map((rec) => (
                <div
                  key={rec.memberId}
                  className={clsx(
                    'p-3 rounded-xl border flex items-center justify-between text-xs transition-all',
                    rec.received
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-500'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2
                      className={clsx('w-4 h-4', rec.received ? 'text-emerald-600' : 'text-slate-400')}
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">
                        {rec.memberName} ({rec.memberId})
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {rec.received ? `✓ Alert Received (${rec.receivedAt || 'Peer ACK'})` : dataMode === 'hardware' ? 'No acknowledgement' : 'Transmitting...'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TWO DISTINCT PATHWAYS: 1. MANUAL SOS, 2. FALL DETECTION ML PIPELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Columns: Manual SOS Pathway */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-red-600" />
                <h2 className="text-base font-bold text-slate-900">1. Manual SOS Distress</h2>
              </div>
              <span className="text-[10px] uppercase font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                Direct Broadcast
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {dataMode === 'hardware' ? 'Ask your band to send an SOS to nearby group bands over LoRa, with GPS when available. Physical buzzer control is not included.' : 'Simulate a distress beacon and wearable alerts using the software communication layer.'}
            </p>

            <button
              disabled={dataMode === "hardware" && (!hardware.ready || band.busy)} onClick={() => setIsSOSConfirmOpen(true)}
              className="w-full py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>{dataMode === 'hardware' ? 'SEND MANUAL SOS' : 'SIMULATE MANUAL SOS'}</span>
            </button>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
              <span className="font-semibold text-slate-800 block">Emergency Payload:</span>
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <div>• Type: Manual Emergency Distress (SOS)</div>
                <div>• Group: {groupProfile?.code || 'ALT-7K4P'}</div>
                <div>• GPS Location: Included only when available</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 7 Columns: Fall Detection ML Pipeline */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-purple-700" />
                <h2 className="text-base font-bold text-slate-900">2. Fall Detection Subsystem</h2>
              </div>
              <span className="text-[10px] uppercase font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                Trained Random Forest
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              In software demo mode, simulated motion samples are sent to the existing Python Random Forest model. A detected fall starts a 10-second cancellation window. Physical IMU data is not connected yet.
            </p>

            {dataMode === 'hardware' && <p className="text-sm text-amber-800">Physical motion data unavailable. The gauges below belong to the software demo; fall detection is disabled in hardware mode.</p>}
            {/* Simulated IMU Stream Sensor Gauges */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Accelerometer (g)</span>
                <div className="font-mono font-bold text-slate-900 text-sm flex items-center justify-between">
                  <span>X: {fallDetectionState.liveAccel.x}</span>
                  <span>Y: {fallDetectionState.liveAccel.y}</span>
                  <span>Z: {fallDetectionState.liveAccel.z}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Magnitude: <strong className="text-slate-800">{fallDetectionState.liveAccel.mag} g</strong>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Gyroscope (°/s)</span>
                <div className="font-mono font-bold text-slate-900 text-sm flex items-center justify-between">
                  <span>X: {fallDetectionState.liveGyro.x}</span>
                  <span>Y: {fallDetectionState.liveGyro.y}</span>
                  <span>Z: {fallDetectionState.liveGyro.z}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Magnitude: <strong className="text-slate-800">{fallDetectionState.liveGyro.mag} °/s</strong>
                </div>
              </div>
            </div>

            {/* 10-Second Confirmation Countdown Banner */}
            {fallDetectionState.stage === 'COUNTDOWN' && (
              <div className="p-4.5 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-3.5 animate-scaleUp text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500 text-white animate-pulse">
                      <AlertOctagon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-amber-950 text-base">Possible Fall Detected</h4>
                      <p className="text-amber-900 text-xs mt-0.5">
                        Are you okay? Automatic SOS will be broadcasted unless cancelled.
                      </p>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500 text-white font-black text-xl flex items-center justify-center font-mono shadow-sm shrink-0">
                    {fallDetectionState.countdown}s
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={cancelFallAlert}
                    className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
                  >
                    <XCircle className="w-4 h-4 text-emerald-400" />
                    <span>I'M OK — CANCEL</span>
                  </button>
                  <button
                    onClick={confirmFallAndSendSOS}
                    className="py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors"
                  >
                    Send SOS Immediately
                  </button>
                </div>
              </div>
            )}

            {/* Cancelled State Message */}
            {fallDetectionState.stage === 'CANCELLED' && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                <span>✓ False alarm — SOS cancelled by user.</span>
                <span className="font-semibold text-emerald-900">Wearable Disarmed</span>
              </div>
            )}

            {/* Action Trigger Button */}
            {fallDetectionState.stage !== 'COUNTDOWN' && (
              <button
                disabled={dataMode === "hardware" || fallDetectionState.stage === "STREAMING"} onClick={startFallSimulation}
                className="w-full py-3 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2"
              >
                <Activity className="w-4 h-4" />
                <span>SIMULATE FALL (TEST ML MODEL)</span>
              </button>
            )}

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between text-slate-600">
              <span>Status: <strong className="text-slate-900">{dataMode === 'hardware' ? 'Physical IMU not connected' : fallDetectionState.statusMessage || (fallDetectionState.lastPrediction === 'FALL' ? 'Fall Motion Evaluated' : fallDetectionState.lastPrediction === 'NORMAL' ? 'Normal prediction' : 'No prediction yet')}</strong></span>
              <span className="text-[11px] text-slate-500 font-mono">Inference Latency: {fallDetectionState.latencyMs} ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
