import React, { useState } from 'react';
import {
  Users,
  Compass,
  MapPin,
  AlertTriangle,
  ShieldCheck,
  Edit3,
  Check,
  Info,
} from 'lucide-react';
import clsx from 'clsx';
import { useSimulation } from '../context/SimulationContext';
import { Member } from '../types';

export const GroupAwarenessPage: React.FC = () => {
  const {
    groupProfile,
    members,
    separationThreshold,
    activeEmergency,
    updateMemberLocation,
    updateMemberDistanceOffset,
  } = useSimulation();

  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editLat, setEditLat] = useState<string>('');
  const [editLon, setEditLon] = useState<string>('');
  const [sliderDistance, setSliderDistance] = useState<number>(200);

  const leader = members.find((m) => m.isLeader) || members[0];

  const handleStartEdit = (m: Member) => {
    setEditingMember(m);
    setEditLat(m.latitude.toString());
    setEditLon(m.longitude.toString());
    setSliderDistance(m.distance);
  };

  const handleSaveCoords = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    const lat = parseFloat(editLat);
    const lon = parseFloat(editLon);
    if (!isNaN(lat) && !isNaN(lon)) {
      updateMemberLocation(editingMember.id, lat, lon);
      setEditingMember(null);
    }
  };

  const handleSliderChange = (distance: number) => {
    setSliderDistance(distance);
    if (editingMember) {
      updateMemberDistanceOffset(editingMember.id, distance);
    }
  };

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
            {groupProfile?.name || 'Western Ghats Trek'}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Monitors distance relative to group leader to warn before members become separated.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-right shrink-0">
          <span className="text-xs font-semibold text-slate-500 uppercase block">
            Safe Group Distance
          </span>
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-2xl font-black text-slate-900 font-mono">{separationThreshold}</span>
            <span className="text-xs text-slate-600 font-semibold">meters</span>
          </div>
          <span className="text-[11px] text-slate-500">Adaptive limit from Link Status</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Members Roster */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-600" />
              <span>Group Roster ({members.length} Members)</span>
            </h2>
            <span className="text-xs text-slate-500">
              Reference: <strong className="text-slate-700">{leader?.name || 'Leader'}</strong>
            </span>
          </div>

          <div className="space-y-3">
            {members.map((m) => {
              const isSeparated = m.distance > separationThreshold;
              const isEmergency = activeEmergency && activeEmergency.senderID === m.id;

              return (
                <div
                  key={m.id}
                  className={clsx(
                    'p-4.5 rounded-2xl border transition-all shadow-xs space-y-3',
                    isEmergency
                      ? 'bg-red-50 border-red-300'
                      : isSeparated
                      ? 'bg-amber-50/70 border-amber-300'
                      : 'bg-white border-slate-200'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={clsx(
                          'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 font-mono',
                          isEmergency
                            ? 'bg-red-600 text-white animate-pulse'
                            : isSeparated
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                        )}
                      >
                        {m.id}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">{m.name}</h3>
                          {m.isLeader && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                              Leader
                            </span>
                          )}
                          {m.isCurrentUser && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                              You
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 font-mono">
                          <span>GPS: {m.latitude.toFixed(4)}, {m.longitude.toFixed(4)}</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-sans font-semibold">Connected</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={clsx(
                          'text-xs px-2.5 py-0.5 rounded border font-bold inline-block mb-1',
                          isEmergency
                            ? 'bg-red-600 text-white border-red-600'
                            : isSeparated
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        )}
                      >
                        {isEmergency ? 'Emergency' : isSeparated ? 'Separation Warning' : 'Safe'}
                      </span>

                      <div className="text-xs">
                        <span className="text-slate-500">Distance: </span>
                        <span
                          className={clsx(
                            'font-bold text-sm font-mono',
                            isSeparated ? 'text-amber-700' : 'text-slate-900'
                          )}
                        >
                          {m.distance} m
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Distance Buffer Progress Bar */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                    <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden relative">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all duration-300',
                          isSeparated ? 'bg-amber-500' : 'bg-emerald-500'
                        )}
                        style={{ width: `${Math.min(100, (m.distance / 700) * 100)}%` }}
                      />
                    </div>

                    <button
                      onClick={() => handleStartEdit(m)}
                      className="text-slate-700 hover:text-slate-900 text-xs flex items-center gap-1 font-semibold py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Update Location</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Location Editor Modal / Form */}
          {editingMember && (
            <div className="p-5 rounded-2xl bg-white border-2 border-slate-900 shadow-lg space-y-4 animate-scaleUp">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <MapPin className="w-4 h-4 text-slate-700" />
                  <span>Update Location: {editingMember.name} ({editingMember.id})</span>
                </div>
                <button
                  onClick={() => setEditingMember(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Simulate Distance from Leader:</span>
                  <span className="text-slate-900 font-bold font-mono">{sliderDistance} meters</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="750"
                  step="10"
                  value={sliderDistance}
                  onChange={(e) => handleSliderChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                />
                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span>50m (Close)</span>
                  <span className="text-slate-900 font-bold">Safe Limit: {separationThreshold}m</span>
                  <span>750m (Separated)</span>
                </div>
              </div>

              <form onSubmit={handleSaveCoords} className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div>
                  <label className="text-slate-600 font-semibold uppercase text-[10px]">Latitude:</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editLat}
                    onChange={(e) => setEditLat(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-semibold uppercase text-[10px]">Longitude:</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editLon}
                    onChange={(e) => setEditLon(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono"
                  />
                </div>
                <div className="col-span-2 flex justify-between items-center pt-2">
                  <span className="text-[11px] text-slate-500">
                    Simulated location (GPS integration pending)
                  </span>
                  <button
                    type="submit"
                    className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
                  >
                    Save Location
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right 5 Columns: Proximity Visualizer */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between h-full space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Compass className="w-4 h-4 text-slate-600" />
                  <span>Proximity Overview</span>
                </h3>
                <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {separationThreshold}m Threshold
                </span>
              </div>

              {/* Radar Circle */}
              <div className="relative w-full aspect-square max-w-[320px] mx-auto my-3 rounded-full bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-200">
                <div className="absolute w-[85%] h-[85%] rounded-full border border-slate-700 border-dashed" />
                <div className="absolute w-[60%] h-[60%] rounded-full border border-slate-700" />
                <div className="absolute w-[35%] h-[35%] rounded-full border border-slate-700 border-dashed" />

                <div className="absolute top-0 bottom-0 w-[1px] bg-slate-800" />
                <div className="absolute left-0 right-0 h-[1px] bg-slate-800" />

                {/* Separation Threshold Ring */}
                <div
                  className="absolute rounded-full border-2 border-amber-400/80 bg-amber-400/5 transition-all duration-300"
                  style={{
                    width: `${Math.min(92, (separationThreshold / 600) * 85)}%`,
                    height: `${Math.min(92, (separationThreshold / 600) * 85)}%`,
                  }}
                  title={`Separation limit: ${separationThreshold}m`}
                />

                {/* Leader Node */}
                <div className="absolute z-20 flex flex-col items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-blue-500 ring-4 ring-blue-500/20 flex items-center justify-center text-[8px] font-bold text-white">
                    {leader?.id || 'M01'}
                  </div>
                  <span className="text-[9px] text-white font-bold bg-slate-950/80 px-1 rounded mt-0.5">
                    {leader?.name || 'Leader'}
                  </span>
                </div>

                {/* Member Nodes */}
                {members.slice(1).map((m, idx) => {
                  const isSeparated = m.distance > separationThreshold;
                  const angle = (idx * 110 + 45) * (Math.PI / 180);
                  const scale = Math.min(0.42, (m.distance / 700) * 0.42);
                  const top = 50 - Math.sin(angle) * scale * 100;
                  const left = 50 + Math.cos(angle) * scale * 100;

                  return (
                    <div
                      key={m.id}
                      className="absolute z-20 flex flex-col items-center justify-center transition-all duration-300"
                      style={{ top: `${top}%`, left: `${left}%` }}
                    >
                      <div
                        className={clsx(
                          'w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white ring-2',
                          isSeparated
                            ? 'bg-amber-500 ring-amber-400 animate-pulse'
                            : 'bg-emerald-500 ring-emerald-400'
                        )}
                      >
                        {m.id}
                      </div>
                      <span className="text-[8px] px-1 rounded font-bold bg-slate-950/80 text-white">
                        {m.name} ({m.distance}m)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                <span>Haversine GPS Separation</span>
              </div>
              <p className="text-xs leading-relaxed">
                Distance is calculated from GPS latitude and longitude. Changes in link quality dynamically adjust the safe radius.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
