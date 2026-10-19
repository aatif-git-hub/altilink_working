import React, { useState } from 'react';
import {
  MapPin,
  Compass,
  RotateCcw,
  Plus,
  Navigation,
  Download,
  Mountain,
  Flag,
  Info,
} from 'lucide-react';
import clsx from 'clsx';
import { useSimulation } from '../context/SimulationContext';
import { generateBacktrackSequence } from '../utils/backtrack';
import { LeafletMap } from '../components/map/LeafletMap';

export const TrailMapPage: React.FC = () => {
  const {
    groupProfile,
    members,
    checkpoints,
    separationThreshold,
    activeEmergency,
    isBacktracking,
    activeBacktrackIndex,
    toggleBacktracking,
    nextBacktrackStep,
    prevBacktrackStep,
    addCheckpoint,
    isOfflineMapDownloaded,
    toggleOfflineMap,
  } = useSimulation();

  const [isAddCpModalOpen, setIsAddCpModalOpen] = useState(false);
  const [newCpName, setNewCpName] = useState('Mist Ridge Junction');
  const [newCpNotes, setNewCpNotes] = useState('Steep rocky ascent checkpoint');

  const leader = members.find((m) => m.isLeader) || members[0];
  const backtrackData = generateBacktrackSequence(checkpoints);

  const handleAddCpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCpName.trim()) return;
    addCheckpoint(newCpName, newCpNotes);
    setIsAddCpModalOpen(false);
    setNewCpName(`Trail Marker ${checkpoints.length + 1}`);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12 text-slate-900">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Offline Trail Map
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-xs font-mono font-bold text-slate-600">Group {groupProfile?.code || 'ALT-7K4P'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Trail Route & Waypoints
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Record checkpoints along your route and backtrack safely using chronological route history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Offline Map Status Button */}
          <button
            onClick={toggleOfflineMap}
            className={clsx(
              'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors',
              isOfflineMapDownloaded
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            )}
            title="Download offline map cache for remote wilderness areas"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isOfflineMapDownloaded ? 'Offline Map Ready' : 'Download Map'}</span>
          </button>

          {/* Backtrack Toggle Button */}
          <button
            onClick={toggleBacktracking}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs',
              isBacktracking
                ? 'bg-purple-700 hover:bg-purple-800 text-white ring-2 ring-purple-400'
                : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
            )}
          >
            <RotateCcw className={clsx('w-3.5 h-3.5', isBacktracking && 'animate-spin-slow')} />
            <span>{isBacktracking ? 'Backtracking Active' : 'Backtrack Route'}</span>
          </button>
        </div>
      </div>

      {/* Backtrack Active Banner */}
      {isBacktracking && (
        <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-purple-900 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-600 text-white shadow-xs">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 uppercase block">
                Backtracking Through Route History:
              </span>
              <span className="text-purple-800">
                Retracing reverse sequence: Current → {backtrackData.backtrackOrder.map(c => c.id).join(' → ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <button
              onClick={prevBacktrackStep}
              disabled={activeBacktrackIndex === 0}
              className="px-2.5 py-1 rounded bg-purple-100 hover:bg-purple-200 disabled:opacity-40 text-purple-900 border border-purple-300 font-semibold"
            >
              ← Prev
            </button>
            <span className="text-purple-900 font-bold px-1">
              Step {activeBacktrackIndex + 1} of {Math.max(1, backtrackData.backtrackOrder.length)}
            </span>
            <button
              onClick={nextBacktrackStep}
              disabled={activeBacktrackIndex >= backtrackData.backtrackOrder.length - 1}
              className="px-2.5 py-1 rounded bg-purple-100 hover:bg-purple-200 disabled:opacity-40 text-purple-900 border border-purple-300 font-semibold"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Left Map Visualizer, Right Checkpoint History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Columns: Leaflet Map */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <Mountain className="w-4 h-4 text-slate-700" />
                <span>Interactive Trail Map</span>
              </div>
              <div className="text-slate-500 font-mono">
                Leader GPS: {leader ? `${leader.latitude.toFixed(4)}, ${leader.longitude.toFixed(4)}` : '13.0827, 80.2707'}
              </div>
            </div>

            <div className="w-full h-[420px] rounded-xl overflow-hidden">
              <LeafletMap
                members={members}
                checkpoints={checkpoints}
                separationThreshold={separationThreshold}
                activeEmergency={activeEmergency}
                isBacktracking={isBacktracking}
                activeBacktrackIndex={activeBacktrackIndex}
                height="100%"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-1">
              <span>Map Cache: <strong className="text-slate-800">{isOfflineMapDownloaded ? 'Offline Map Available (Prototype)' : 'Online Stream'}</strong></span>
              <span className="font-mono">WGS84 GPS Coordinates</span>
            </div>
          </div>
        </div>

        {/* Right 4 Columns: Checkpoint Sequence */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Flag className="w-4 h-4 text-slate-600" />
                <span>Trail Waypoints ({checkpoints.length})</span>
              </h3>

              <button
                onClick={() => setIsAddCpModalOpen(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Waypoint</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {checkpoints.map((cp) => (
                <div
                  key={cp.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs font-mono">
                        {cp.sequenceNumber}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">{cp.name}</span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">{cp.timestamp}</span>
                  </div>

                  <div className="flex justify-between text-xs text-slate-500 pl-8 font-mono">
                    <span>Alt: {cp.altitude}m</span>
                    <span>GPS: {cp.latitude.toFixed(4)}, {cp.longitude.toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                <span>Sequential Backtracking</span>
              </div>
              <p className="text-xs leading-relaxed">
                Backtracking traverses recorded waypoints in reverse sequence, preventing switchback and circular trail disorientation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RECORD CHECKPOINT MODAL */}
      {isAddCpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4 animate-scaleUp text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Record Trail Waypoint</h3>
              <button
                onClick={() => setIsAddCpModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCpSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-slate-700 font-semibold uppercase text-[11px]">Waypoint Name:</label>
                <input
                  type="text"
                  required
                  value={newCpName}
                  onChange={(e) => setNewCpName(e.target.value)}
                  placeholder="e.g. Ridge Water Spring"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 font-semibold uppercase text-[11px]">Terrain Notes:</label>
                <input
                  type="text"
                  value={newCpNotes}
                  onChange={(e) => setNewCpNotes(e.target.value)}
                  placeholder="e.g. Clear line of sight, water point"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCpModalOpen(false)}
                  className="flex-1 py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
                >
                  Record Waypoint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
