import { coordinates, numberOrUnknown } from '../hardware/display';
import React, { useState } from 'react';
import {
  Users,
  Copy,
  Plus,
  Play,
  Check,
  Trash2,
  Mountain,
  LogOut,
  Compass,
  Clock,
  Download,
  Info,
  Route,
  MapPin,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';
import { useSimulation } from '../context/SimulationContext';
import { TRAIL_CATALOGUE } from '../data/initialData';
import { TrailCatalogueItem, TrekMode } from '../types';
import { LeafletMap } from '../components/map/LeafletMap';

export const GroupLobbyPage: React.FC = () => {
  const {
    dataMode,
    groupProfile,
    members,
    currentUser,
    trekMode,
    setTrekMode,
    selectedTrail,
    setSelectedTrail,
    checkpointIntervalMinutes,
    setCheckpointIntervalMinutes,
    isOfflineMapDownloaded,
    toggleOfflineMap,
    addLobbyMember,
    removeLobbyMember,
    startHike,
    resetSession,
    addToast,
  } = useSimulation();

  const isLeader = currentUser?.isLeader === true;

  const [isTrailModalOpen, setIsTrailModalOpen] = useState(false);
  const [viewingRouteTrailId, setViewingRouteTrailId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('Rahul');
  const [newMemberId, setNewMemberId] = useState('M02');
  const [newMemberDistance, setNewMemberDistance] = useState(180);
  const [copied, setCopied] = useState(false);

  // Checkpoint interval options
  const intervalOptions = [3, 5, 10, 15];

  const handleCopyCode = () => {
    if (groupProfile?.code) {
      navigator.clipboard.writeText(groupProfile.code);
      setCopied(true);
      addToast('Copied Code', `Group code ${groupProfile.code} copied to clipboard.`, 'info');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSelectTrail = (trail: TrailCatalogueItem) => {
    setSelectedTrail(trail);
    setTrekMode('EXISTING');
    setIsTrailModalOpen(false);
    addToast('Trek Selected', `Selected "${trail.name}" (${trail.distanceKm} km).`, 'info');
  };

  const handleAddMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    addLobbyMember(newMemberName, newMemberId, newMemberDistance);
    setIsAddModalOpen(false);

    if (newMemberId === 'M02') {
      setNewMemberName('Karthik');
      setNewMemberId('M03');
      setNewMemberDistance(240);
    } else {
      setNewMemberName(`Trekker ${members.length + 2}`);
      setNewMemberId(`M0${members.length + 2}`);
      setNewMemberDistance(200);
    }
  };

  if (!groupProfile) {
    return (
      <div className="p-8 text-center text-slate-500 space-y-4">
        <p>No active group found.</p>
        <button
          onClick={resetSession}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
        >
          Return to Welcome Screen
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn pb-12 text-slate-900 select-none">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold tracking-wide text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Group Lobby
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-xs text-slate-500">
                {isLeader ? 'You are Group Leader' : 'Connected as Member'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {groupProfile.name}
            </h1>
          </div>

          <button
            onClick={resetSession}
            className="self-start sm:self-auto text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave Group</span>
          </button>
        </div>

        {/* Group Code Share Box */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Group Invite Code (Share with other laptops/members):
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono tracking-wider">
              {groupProfile.code}
            </span>
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Group Code'}</span>
          </button>
        </div>
      </div>

      {/* HIKE CONFIGURATION & TREK SELECTION (Leader Controlled) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Mountain className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">
              Hike Setup & Trek Configuration
            </h2>
          </div>
          {isLeader ? (
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Leader Controls
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-medium">Configured by Leader</span>
          )}
        </div>

        {/* Option 1: Trek Mode Selector */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            1. Select Trek Type:
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Existing Trek Card */}
            <div
              onClick={() => isLeader && setTrekMode('EXISTING')}
              className={clsx(
                'p-4 rounded-xl border transition-all text-xs space-y-2',
                isLeader ? 'cursor-pointer' : 'cursor-default',
                trekMode === 'EXISTING'
                  ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Route className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-900 text-sm">Existing Trek</span>
                </div>
                {trekMode === 'EXISTING' && (
                  <span className="text-[10px] bg-slate-900 text-white font-bold px-2 py-0.5 rounded">
                    Selected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Select a predefined trail from the catalogue with known route coordinates, waypoints, and offline cache.
              </p>
            </div>

            {/* Custom Trek Card */}
            <div
              onClick={() => isLeader && setTrekMode('CUSTOM')}
              className={clsx(
                'p-4 rounded-xl border transition-all text-xs space-y-2',
                isLeader ? 'cursor-pointer' : 'cursor-default',
                trekMode === 'CUSTOM'
                  ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-slate-900 text-sm">Custom Trek</span>
                </div>
                {trekMode === 'CUSTOM' && (
                  <span className="text-[10px] bg-slate-900 text-white font-bold px-2 py-0.5 rounded">
                    Selected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Open expedition with no predefined trail. Supports GPS tracking, dynamic checkpointing, and backtracking.
              </p>
            </div>
          </div>
        </div>

        {/* Existing Trek Details & Trail Browser */}
        {trekMode === 'EXISTING' ? (
          <div className="p-4.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                  Active Selected Trail
                </span>
                <h3 className="text-base font-bold text-slate-900">{selectedTrail.name}</h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                  <span>Distance: <strong className="text-slate-800">{selectedTrail.distanceKm} km</strong></span>
                  <span>•</span>
                  <span>Est. Time: <strong className="text-slate-800">{selectedTrail.durationHours}</strong></span>
                  <span>•</span>
                  <span>Difficulty: <strong className="text-slate-800">{selectedTrail.difficulty}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleOfflineMap}
                  className={clsx(
                    'py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors',
                    isOfflineMapDownloaded
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  )}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isOfflineMapDownloaded ? 'Offline Ready' : 'Download Offline'}</span>
                </button>

                {isLeader && (
                  <button
                    onClick={() => {
                      setViewingRouteTrailId(null);
                      setIsTrailModalOpen(true);
                    }}
                    className="py-2 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs"
                  >
                    Browse Trails
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pt-1 border-t border-slate-200/60">
              {selectedTrail.description}
            </p>
          </div>
        ) : (
          /* Custom Trek Notice */
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 space-y-1 animate-fadeIn">
            <div className="flex items-center gap-1.5 font-bold">
              <Info className="w-4 h-4 text-blue-700" />
              <span>Custom Trek Active</span>
            </div>
            <p className="text-xs leading-relaxed text-blue-800">
              Custom trek has no predefined route, so off-trail monitoring is unavailable. Software demo supports checkpointing, backtracking and model tests. Hardware mode currently supports received GPS, manual SOS and measured link status.
            </p>
          </div>
        )}

        {/* Option 2: Configurable Checkpoint Interval */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-600" />
              <span>2. Checkpoint Interval (Periodic Auto-Recording):</span>
            </label>
            <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Every {checkpointIntervalMinutes} min
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {intervalOptions.map((mins) => (
              <button
                key={mins}
                disabled={!isLeader}
                onClick={() => setCheckpointIntervalMinutes(mins)}
                className={clsx(
                  'py-2 px-3 rounded-xl text-xs font-semibold transition-all border text-center',
                  checkpointIntervalMinutes === mins
                    ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200',
                  !isLeader && 'opacity-80 cursor-default'
                )}
              >
                {mins} Min {mins === 5 ? '(Default)' : ''}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            A new sequential checkpoint (CP1, CP2, CP3...) will be recorded automatically at each interval during the hike.
          </p>
        </div>
      </div>

      {/* Group Members List */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">
              {dataMode === "hardware" ? "Observed bands" : "Joined Members"} ({members.length})
            </h2>
          </div>

          <button
            disabled={dataMode === "hardware"} onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Member</span>
          </button>
        </div>

        {/* Members Cards */}
        <div className="space-y-2.5">
          {members.map((m) => (
            <div
              key={m.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-200 text-slate-800 font-bold font-mono text-sm flex items-center justify-center">
                  {m.id}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{m.name}</span>
                    {m.isLeader && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                        Group Leader
                      </span>
                    )}
                    {m.isCurrentUser && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                        You
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500 text-xs">
                    {m.connectionStatus} • GPS: {coordinates(m)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {dataMode === "simulation" && !m.isLeader && isLeader && (
                  <button
                    onClick={() => removeLobbyMember(m.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                    title="Remove member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* START HIKE / WAITING BANNER */}
      <div className="pt-2">
        {(isLeader || dataMode === "hardware") ? (
          <button
            onClick={startHike}
            className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base flex items-center justify-center gap-2.5 shadow-sm transition-all active:scale-98"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>{dataMode === "hardware" ? "Open band session" : "Start Hike Session"}</span>
          </button>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-100 border border-slate-300/80 text-center space-y-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Waiting for the group leader to start the hike.
            </span>
            <p className="text-xs text-slate-500">
              When the leader starts the hike, your device will automatically update with the active trail map and monitoring state.
            </p>
          </div>
        )}
      </div>

      {/* BROWSE TRAILS MODAL */}
      {isTrailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4 animate-scaleUp text-slate-900 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Trail Catalogue</h3>
                <p className="text-xs text-slate-500">Select a predefined trail for your group expedition</p>
              </div>
              <button
                onClick={() => setIsTrailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {TRAIL_CATALOGUE.map((trail) => {
                const isSelected = selectedTrail.id === trail.id;
                const isViewingRoute = viewingRouteTrailId === trail.id;

                return (
                  <div
                    key={trail.id}
                    className={clsx(
                      'p-4 rounded-xl border transition-all text-xs space-y-3',
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{trail.name}</h4>
                          <span
                            className={clsx(
                              'text-[10px] font-bold px-2 py-0.5 rounded border',
                              trail.difficulty === 'Easy'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : trail.difficulty === 'Moderate'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            )}
                          >
                            {trail.difficulty}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span>{trail.distanceKm} km</span>
                          <span>•</span>
                          <span>{trail.durationHours}</span>
                          <span>•</span>
                          <span>+{trail.elevationGainMeters}m elevation gain</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* VIEW ROUTE Button */}
                        <button
                          onClick={() => setViewingRouteTrailId(isViewingRoute ? null : trail.id)}
                          className="py-2 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isViewingRoute ? 'Hide Route' : 'View Route'}</span>
                        </button>

                        {/* SELECT TREK Button */}
                        <button
                          onClick={() => handleSelectTrail(trail)}
                          className={clsx(
                            'py-2 px-4 rounded-lg font-bold text-xs transition-colors',
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                          )}
                        >
                          {isSelected ? 'Selected' : 'Select Trek'}
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {trail.description}
                    </p>

                    {/* Inline Route Map Preview when VIEW ROUTE is toggled */}
                    {isViewingRoute && (
                      <div className="pt-2 border-t border-slate-200 space-y-2 animate-fadeIn">
                        <span className="text-[11px] font-bold text-slate-700 uppercase">Topographic Route Preview:</span>
                        <div className="w-full h-48 rounded-xl overflow-hidden border border-slate-200 shadow-inner">
                          <LeafletMap
                            members={[]}
                            checkpoints={[]}
                            selectedTrail={trail}
                            height="100%"
                            interactive={false}
                            mode="MINI"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4 animate-scaleUp text-slate-900 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Group Member</h3>
                <p className="text-xs text-slate-500">Simulate adding a peer member to the lobby</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMemberSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-slate-700 font-semibold uppercase text-[11px]">Member Name:</label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Rahul"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-800 text-slate-900 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-semibold uppercase text-[11px]">Member ID:</label>
                  <input
                    type="text"
                    required
                    value={newMemberId}
                    onChange={(e) => setNewMemberId(e.target.value)}
                    placeholder="M02"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-800 text-slate-900 text-sm focus:outline-none font-mono uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-semibold uppercase text-[11px]">Simulated Distance (m):</label>
                  <input
                    type="number"
                    min="50"
                    max="600"
                    step="10"
                    value={newMemberDistance}
                    onChange={(e) => setNewMemberDistance(parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-800 text-slate-900 text-sm focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
