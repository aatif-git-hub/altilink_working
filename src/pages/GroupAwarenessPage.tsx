import { coordinates, numberOrUnknown } from '../hardware/display';
import React from 'react';
import {
  Users,
  Compass,
  MapPin,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import clsx from 'clsx';
import { useSimulation } from '../context/SimulationContext';

export const GroupAwarenessPage: React.FC = () => {
  const {
    dataMode,
    groupProfile,
    members,
    activeEmergency,
  } = useSimulation();

  const leader = members.find((m) => m.isLeader) || members[0];

  return (
    <div className="space-y-6 animate-fadeIn pb-12 text-slate-900 select-none">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Group Awareness
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-xs font-mono font-bold text-slate-600">Group {groupProfile?.code || 'ALT-7K4P'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Group Roster & Status
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Real-time peer node awareness over LoRa mesh.
          </p>
        </div>
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((m) => {
          const isEmergent = activeEmergency && activeEmergency.senderID === m.id;

          return (
            <div
              key={m.id}
              className={clsx(
                'p-5 rounded-2xl border bg-white shadow-xs space-y-3 transition-all',
                isEmergent ? 'border-red-300 bg-red-50' : 'border-slate-200'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      'w-10 h-10 rounded-xl font-bold font-mono text-sm flex items-center justify-center',
                      isEmergent ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 text-slate-800'
                    )}
                  >
                    {m.id}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-sm">{m.name}</span>
                      {m.isLeader && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-bold">
                          Leader
                        </span>
                      )}
                      {m.isCurrentUser && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">{m.connectionStatus}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>GPS:</span>
                  <span>{coordinates(m)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Distance to Leader:</span>
                  <span>{numberOrUnknown(m.distance)} m</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
