import React, { useState } from 'react';
import {
  AlertOctagon,
  Radio,
  Volume2,
  CheckCircle2,
  Clock,
  MapPin,
  Activity,
  ShieldCheck,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';
import { useSimulation } from '../context/SimulationContext';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

export const EmergencyPage: React.FC = () => {
  const {
    groupProfile,
    members,
    activeEmergency,
    broadcastRecipients,
    broadcastProgress,
    wearableState,
    triggerManualSOS,
    triggerFallEmergency,
    resolveEmergency,
  } = useSimulation();

  const [isSOSConfirmOpen, setIsSOSConfirmOpen] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);

  return (
    <div className="space-y-6 animate-fadeIn pb-12 text-slate-900 select-none">
      <ConfirmationModal
        isOpen={isSOSConfirmOpen}
        onClose={() => setIsSOSConfirmOpen(false)}
        onConfirm={() => triggerManualSOS()}
        title="Broadcast Emergency SOS"
        message={`This will transmit a high-priority distress alert with your GPS location to all members in group ${groupProfile?.code || 'ALT-7K4P'}.`}
      />

      {/* Header */}
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
                Emergency & SOS
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-xs font-mono font-bold text-slate-600">Group {groupProfile?.code || 'ALT-7K4P'}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <span>Emergency Distress Response</span>
              {activeEmergency && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-600 text-white font-bold animate-pulse">
                  Active Alert
                </span>
              )}
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              Broadcast distress beacons to your group with GPS location fix and trigger physical wearable buzzer alerts.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {activeEmergency ? (
              <button
                onClick={resolveEmergency}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white transition-colors shadow-xs"
              >
                Resolve & Clear Alert
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => triggerFallEmergency()}
                  className="px-3.5 py-2.5 rounded-xl font-semibold text-xs bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 transition-colors flex items-center gap-1.5"
                >
                  <Activity className="w-3.5 h-3.5 text-purple-700" />
                  <span>Simulate Fall Alert</span>
                </button>

                <button
                  onClick={() => setIsSOSConfirmOpen(true)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-red-600 hover:bg-red-700 text-white shadow-xs transition-all flex items-center gap-2"
                >
                  <AlertOctagon className="w-4 h-4" />
                  <span>Send SOS</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ACTIVE EMERGENCY DISPLAY */}
      {activeEmergency ? (
        <div className="rounded-2xl border-2 border-red-300 bg-white p-5 md:p-6 shadow-sm space-y-5 animate-scaleUp">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-red-100">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-600 text-white shadow-xs">
                <AlertOctagon className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
                  Emergency Alert Active
                </span>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {activeEmergency.messageType === 'FALL_DETECTED' ? 'Possible Fall Detected' : 'Manual SOS Distress'}
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
                {activeEmergency.latitude.toFixed(4)}, {activeEmergency.longitude.toFixed(4)}
              </span>
              <span className="text-xs text-slate-500 font-sans">Alt: {activeEmergency.altitude}m</span>
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
                <span>Buzzer & Vibration Active</span>
              </span>
            </div>
          </div>

          {/* Group Delivery Checklist */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-4 h-4 text-slate-600" />
                <span>Group Peer Delivery Status</span>
              </h3>
              <span className="text-emerald-700 font-bold font-mono">{broadcastProgress}% Delivered</span>
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
                        {rec.received ? `✓ Alert Received (${rec.receivedAt || 'Mesh ACK'})` : 'Transmitting...'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Standby State */
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">No Active Emergency</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            All members in group <strong>{groupProfile?.name || 'Trek Group'}</strong> ({groupProfile?.code || 'ALT-7K4P'}) are connected and safe.
          </p>
        </div>
      )}

      {/* Expandable Technical Details Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <button
          onClick={() => setShowTechDetails(!showTechDetails)}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors py-1"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-600" />
            <span>Technical Packet & Protocol Details</span>
          </div>
          {showTechDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showTechDetails && (
          <div className="pt-3 border-t border-slate-100 space-y-3 text-xs font-mono animate-fadeIn">
            <div className="p-3 rounded-xl bg-slate-900 text-slate-200 text-[11px] overflow-x-auto">
              <pre>
                {JSON.stringify(
                  activeEmergency || {
                    packetID: 'SOS-SAMPLE',
                    groupID: groupProfile?.code || 'ALT-7K4P',
                    senderID: 'M01',
                    senderName: 'Nirmal',
                    messageType: 'MANUAL_SOS',
                    latitude: 13.0827,
                    longitude: 80.2707,
                    altitude: 420,
                    timestamp: new Date().toLocaleTimeString(),
                  },
                  null,
                  2
                )}
              </pre>
            </div>
            <p className="text-xs font-sans text-slate-500 leading-relaxed">
              Group Isolation Filter: Packets with non-matching Group IDs (e.g. from other trekking parties) are rejected at the protocol layer to eliminate alert fatigue.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
