import { coordinates, numberOrUnknown } from '../hardware/display';
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
  Clock,
  FastForward,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import { useSimulation } from '../context/SimulationContext';
import { generateBacktrackSequence } from '../utils/backtrack';
import { LeafletMap } from '../components/map/LeafletMap';
import { Checkpoint } from '../types';

export const TrailMapPage: React.FC = () => {
  const {
    dataMode,
    separationThreshold,
    groupProfile,
    members,
    checkpoints,
    trekMode,
    selectedTrail,
    checkpointIntervalMinutes,
    simulatedElapsedSeconds,
    advanceSimulatedTime,
    activeEmergency,
    isBacktracking,
    activeBacktrackIndex,
    toggleBacktracking,
    nextBacktrackStep,
    prevBacktrackStep,
    addCheckpoint,
    deleteCheckpoint,
    isOfflineMapDownloaded,
    toggleOfflineMap,
  } = useSimulation();

  const [isAddCpModalOpen, setIsAddCpModalOpen] = useState(false);
  const [newCpName, setNewCpName] = useState('Mist Ridge Junction');
  const [newCpNotes, setNewCpNotes] = useState('Steep rocky ascent marker');

  // Delete confirmation state
  const [cpToDelete, setCpToDelete] = useState<Checkpoint | null>(null);

  const leader = members.find((m) => m.isLeader) || members[0];
  const backtrackData = generateBacktrackSequence(checkpoints);

  const elapsedMins = Math.floor(simulatedElapsedSeconds / 60);
  const elapsedSecs = simulatedElapsedSeconds % 60;
  const formattedTime = `${elapsedMins.toString().padStart(2, '0')}:${elapsedSecs.toString().padStart(2, '0')}`;

  const handleAddCpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCpName.trim()) return;
    addCheckpoint(newCpName, newCpNotes);
    setIsAddCpModalOpen(false);
    setNewCpName(`Trail Marker ${checkpoints.length + 1}`);
  };

  const handleConfirmDelete = () => {
    if (cpToDelete) {
      deleteCheckpoint(cpToDelete.id);
      setCpToDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12 text-slate-900 select-none">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Trail Map & Checkpoints
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-xs font-mono font-bold text-slate-600">Group {groupProfile?.code || 'ALT-7K4P'}</span>
            <span className="text-slate-400">•</span>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {trekMode === 'EXISTING' ? selectedTrail.name : 'Custom Trek (Open Route)'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Trail Route & Dynamic Checkpoints
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Topographic trail navigation with automatic periodic checkpoint recording and sequential backtracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Offline Map Cache */}
          {trekMode === 'EXISTING' && (
            <button
              onClick={toggleOfflineMap}
              className={clsx(
                'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors',
                isOfflineMapDownloaded
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              )}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isOfflineMapDownloaded ? 'Offline Cache Ready' : 'Download Route'}</span>
            </button>
          )}

          {/* Backtrack Route Button */}
          <button
            onClick={toggleBacktracking}
            disabled={checkpoints.length < 2}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed',
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

      {dataMode === 'hardware' && <p className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm">Live received locations are shown on the planned trail. Automatic checkpoints and backtracking from hardware are not integrated yet. Map tiles require internet access.</p>}
      {/* Custom Trek Notice */}
      {trekMode === 'CUSTOM' && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-700 shrink-0" />
            <span>Custom trek has no predefined route, so off-trail monitoring is unavailable. Checkpoint recording is currently a software simulation.</span>
          </div>
        </div>
      )}

      {/* Backtrack Active Banner */}
      {isBacktracking && backtrackData.steps.length > 0 && (
        <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-purple-900 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-600 text-white shadow-xs">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 uppercase block">
                Backtracking Through Dynamic Route History:
              </span>
              <span className="text-purple-800 font-mono">
                Current → {backtrackData.backtrackOrder.map((c) => c.id).join(' → ')}
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
              Step {activeBacktrackIndex + 1} of {backtrackData.steps.length}
            </span>
            <button
              onClick={nextBacktrackStep}
              disabled={activeBacktrackIndex >= backtrackData.steps.length - 1}
              className="px-2.5 py-1 rounded bg-purple-100 hover:bg-purple-200 disabled:opacity-40 text-purple-900 border border-purple-300 font-semibold"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Left Map Visualizer, Right Checkpoint History & Simulation Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Columns: Leaflet Map */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <Mountain className="w-4 h-4 text-slate-700" />
                <span>Topographic Trail Map</span>
              </div>
              <div className="text-slate-500 font-mono">
                {dataMode === 'hardware' ? 'Received GPS' : 'Simulated GPS'}: {coordinates(leader)}
              </div>
            </div>

            <div className="w-full h-[440px] rounded-xl overflow-hidden">
              <LeafletMap
                members={members}
                checkpoints={checkpoints}
                selectedTrail={trekMode === 'EXISTING' ? selectedTrail : null}
                separationThreshold={separationThreshold}
                activeEmergency={activeEmergency}
                isBacktracking={isBacktracking}
                activeBacktrackIndex={activeBacktrackIndex}
                height="100%"
                mode="FULL"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-1">
              <span>
                Trail: <strong className="text-slate-800">{trekMode === 'EXISTING' ? selectedTrail.name : 'Custom Open Trail'}</strong>
              </span>
              <span className="font-mono">WGS84 • Elevation Contours Active</span>
            </div>
          </div>
        </div>

        {/* Right 4 Columns: Checkpoint Interval Simulation & Checkpoint List */}
        <div className="lg:col-span-4 space-y-4">
          {/* Feature-Level Checkpoint Simulation Controls */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Checkpoint Simulation
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                Interval: {checkpointIntervalMinutes}m
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Hike Elapsed Time:</span>
                <span className="text-base font-black font-mono text-slate-900">{formattedTime}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Advance simulated time to test automatic periodic checkpoint recording.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={dataMode === "hardware"} onClick={() => advanceSimulatedTime(1)}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>+1 Min</span>
              </button>

              <button
                disabled={dataMode === "hardware"} onClick={() => advanceSimulatedTime(checkpointIntervalMinutes)}
                className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>+{checkpointIntervalMinutes} Min</span>
              </button>
            </div>
          </div>

          {/* Dynamic Checkpoints List with DELETE */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Flag className="w-4 h-4 text-slate-600" />
                <span>Waypoints & History ({checkpoints.length})</span>
              </h3>

              <button
                disabled={dataMode === "hardware"} onClick={() => setIsAddCpModalOpen(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Waypoint</span>
              </button>
            </div>

            {checkpoints.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                No checkpoints recorded yet. Advance time to trigger automatic periodic checkpoints or add manually.
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {checkpoints.map((cp) => (
                  <div
                    key={cp.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1 group hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs font-mono">
                          {cp.sequenceNumber}
                        </span>
                        <span className="font-bold text-slate-900 text-sm">{cp.name}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-mono">{cp.timestamp}</span>
                        {/* Checkpoint Delete Button */}
                        <button
                          onClick={() => setCpToDelete(cp)}
                          title={`Delete ${cp.id}`}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-500 pl-8 font-mono">
                      <span>Alt: {cp.altitude}m</span>
                      <span>{cp.latitude.toFixed(4)}, {cp.longitude.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              <h3 className="text-base font-bold text-slate-900">Record Manual Waypoint</h3>
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
                  placeholder="e.g. Ridge Spring Crossing"
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

      {/* DELETE CONFIRMATION MODAL */}
      {cpToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4 animate-scaleUp text-xs text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 rounded-xl bg-red-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Checkpoint?</h3>
            </div>

            <p className="text-slate-600 text-xs leading-relaxed">
              Are you sure you want to delete <strong>{cpToDelete.name} ({cpToDelete.id})</strong>? This will remove its marker from the trail map and update the backtracking route.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCpToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
