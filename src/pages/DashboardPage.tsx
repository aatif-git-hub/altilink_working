import { coordinates, numberOrUnknown } from '../hardware/display';
import React from 'react';
import {
  Users,
  Compass,
  AlertOctagon,
  ShieldCheck,
  MapPin,
  Radio,
  ArrowRight,
  Mountain,
} from 'lucide-react';
import clsx from 'clsx';
import { useSimulation } from '../context/SimulationContext';
import { TabType } from '../components/layout/Sidebar';
import { LeafletMap } from '../components/map/LeafletMap';
import { GroupGPSMiniMap } from '../components/map/GroupGPSMiniMap';

interface DashboardPageProps {
  setActiveTab: (tab: TabType) => void;
  onOpenSOSModal: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  setActiveTab,
  onOpenSOSModal,
}) => {
  const {
    dataMode,
    groupProfile,
    members,
    overallGroupStatus,
    trekMode,
    selectedTrail,
    linkAssessment,
    activeEmergency,
    checkpoints,
    simulatedElapsedSeconds,
    separationThreshold,
  } = useSimulation();

  const currentUser = members.find((m) => m.isCurrentUser) || members[0];
  const lastPassedCheckpoint = [...checkpoints].reverse().find((cp) => cp.passed) || checkpoints[0];

  const elapsedMins = Math.floor(simulatedElapsedSeconds / 60);
  const formattedElapsed = `${Math.floor(elapsedMins / 60).toString().padStart(2, '0')}:${(elapsedMins % 60).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-6 animate-fadeIn pb-12 text-slate-900 select-none">
      {/* 1. Header (Group / Trek / Safety Status) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Active Hike
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-xs font-mono font-bold text-slate-600">Group {groupProfile?.code || 'ALT-7K4P'}</span>
            <span className="text-slate-400">•</span>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {trekMode === 'EXISTING' ? selectedTrail.name : 'Custom Trek'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {groupProfile?.name || 'Western Ghats Trek'}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Off-grid group awareness, topographic trail map, connection tests, and safety response.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSOSModal}
            className={clsx(
              'px-6 py-3 rounded-xl text-sm font-bold tracking-wide flex items-center gap-2 shadow-xs transition-all active:scale-98',
              activeEmergency
                ? 'bg-red-600 text-white animate-pulse shadow-md shadow-red-500/30'
                : 'bg-red-600 hover:bg-red-700 text-white'
            )}
          >
            <AlertOctagon className="w-5 h-5" />
            <span>{activeEmergency ? 'Emergency Active' : 'Emergency / SOS'}</span>
          </button>
        </div>
      </div>

      {/* Emergency Active Alert Banner if active */}
      {activeEmergency && (
        <div
          onClick={() => setActiveTab('emergency')}
          className="p-5 rounded-2xl bg-red-50 border-2 border-red-300 shadow-sm cursor-pointer hover:bg-red-100/70 transition-colors flex items-center justify-between gap-4 animate-emergency-alert"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-red-600 text-white shadow-xs">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-bold text-red-700 uppercase tracking-wider block">
                Emergency Distress Active
              </span>
              <h3 className="text-base font-bold text-slate-900">
                {activeEmergency.senderName} ({activeEmergency.senderID}) triggered {activeEmergency.messageType.replace('_', ' ')}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Location: {coordinates(activeEmergency)} {dataMode === 'simulation' ? '• Simulated wearable alert' : ''}
              </p>
            </div>
          </div>

          <button className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold shrink-0 shadow-xs">
            View Emergency →
          </button>
        </div>
      )}

      {/* 2. EXISTING GROUP LOCATIONS — LARGER TOPOGRAPHIC DASHBOARD MAP (KEPT INTACT) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-700" />
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">GROUP LOCATIONS</h2>
              <span className="text-xs text-slate-500">Live positions of all {members.length} connected trekkers along trail</span>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('map')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <span>Full Trail Map</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Compact Map & Trekker Status Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Leaflet Map (240px height) */}
          <div className="md:col-span-8 w-full h-[240px] rounded-xl overflow-hidden border border-slate-200 shadow-inner">
            <LeafletMap
              members={members}
              checkpoints={checkpoints}
              selectedTrail={trekMode === 'EXISTING' ? selectedTrail : null}
              separationThreshold={400}
              activeEmergency={activeEmergency}
              height="100%"
              mode="MINI"
            />
          </div>

          {/* Connected Trekkers Quick Overview */}
          <div className="md:col-span-4 space-y-2 h-[240px] overflow-y-auto pr-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Connected Group ({members.length}):
            </span>

            <div className="space-y-1.5">
              {members.map((m) => {
                const isYou = m.isCurrentUser;
                const isEmergent = activeEmergency && activeEmergency.senderID === m.id;

                return (
                  <div
                    key={m.id}
                    className={clsx(
                      'p-2.5 rounded-xl border text-xs flex items-center justify-between transition-colors',
                      isEmergent
                        ? 'border-red-300 bg-red-50'
                        : isYou
                        ? 'border-slate-300 bg-slate-50 font-medium'
                        : 'border-slate-200 bg-white'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          'w-6 h-6 rounded-md font-bold font-mono text-[11px] flex items-center justify-center',
                          isEmergent
                            ? 'bg-red-600 text-white'
                            : isYou
                            ? 'bg-slate-900 text-white ring-1 ring-amber-400'
                            : m.isLeader
                            ? 'bg-blue-600 text-white'
                            : 'bg-emerald-600 text-white'
                        )}
                      >
                        {m.id}
                      </span>
                      <div>
                        <span className="font-bold text-slate-900 block leading-tight">
                          {isYou ? `YOU • ${m.name}` : m.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {coordinates(m)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right text-[11px]">
                      <span className="font-mono font-semibold text-slate-700 block">
                        {dataMode === 'hardware' ? `${numberOrUnknown(m.distance)} m` : m.isLeader ? 'Leader' : `${m.distance}m`}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-semibold">
                        {m.connectionStatus}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. NEW ADDITION: COMPACT GROUP GPS MINI-MAP ("Where are the other members relative to me right now?") */}
      <GroupGPSMiniMap
        members={members}
        separationThreshold={separationThreshold}
        activeEmergency={activeEmergency}
        selectedTrail={trekMode === 'EXISTING' ? selectedTrail : null}
      />

      {/* 4. 4 Clean Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Group Status Card */}
        <div
          onClick={() => setActiveTab('map')}
          className={clsx(
            'p-4.5 rounded-2xl border transition-all cursor-pointer shadow-xs flex flex-col justify-between space-y-2',
            overallGroupStatus === 'SAFE'
              ? 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50'
              : 'border-red-200 bg-red-50 hover:bg-red-100/80'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase text-slate-500 font-semibold">Group Safety</span>
            {overallGroupStatus === 'SAFE' ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertOctagon className="w-4 h-4 text-red-600" />
            )}
          </div>

          <div>
            <span className="text-xl font-extrabold text-slate-900 block">
              {overallGroupStatus === 'SAFE' ? (dataMode === 'hardware' ? 'Observed links qualified' : 'All Members Safe') : overallGroupStatus === 'EMERGENCY' ? 'Emergency Active' : 'Check group connection'}
            </span>
            <span className="text-xs text-slate-600 mt-0.5 block">
              {members.length} member{members.length === 1 ? '' : 's'} in group party
            </span>
          </div>

          <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
            <span>View trail map</span>
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>

        {/* Communication Quality */}
        <div
          onClick={() => setActiveTab('link')}
          className="p-4.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/70 transition-all cursor-pointer shadow-xs flex flex-col justify-between space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase text-slate-500 font-semibold">Communication Link</span>
            <Radio className="w-4 h-4 text-emerald-600" />
          </div>

          <div>
            <span className="text-xl font-extrabold text-slate-900 block">
              {linkAssessment.overallQuality} Quality
            </span>
            <span className="text-xs text-slate-600 mt-0.5 block">
              {numberOrUnknown(linkAssessment.avgPacketSuccess)}% {dataMode === 'hardware' ? 'observed delivery' : 'simulated delivery'}
            </span>
          </div>

          <span className="text-xs text-blue-600 font-semibold flex items-center gap-1">
            <span>Run connection check</span>
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>

        {/* Checkpoint & Hike Time */}
        <div
          onClick={() => setActiveTab('map')}
          className="p-4.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/70 transition-all cursor-pointer shadow-xs flex flex-col justify-between space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase text-slate-500 font-semibold">Checkpoints</span>
            <Compass className="w-4 h-4 text-blue-600" />
          </div>

          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 font-mono">{checkpoints.length}</span>
              <span className="text-xs text-slate-500">recorded</span>
            </div>
            <span className="text-xs text-slate-600 mt-0.5 block">
              {dataMode === "hardware" ? "Hardware recording not integrated" : `Elapsed: ${formattedElapsed}`}
            </span>
          </div>

          <span className="text-xs text-slate-500">
            Last: {lastPassedCheckpoint?.name || (dataMode === 'hardware' ? 'None recorded' : 'Trailhead')}
          </span>
        </div>

        {/* GPS Location (YOU) */}
        <div
          onClick={() => setActiveTab('map')}
          className="p-4.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/70 transition-all cursor-pointer shadow-xs flex flex-col justify-between space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase text-slate-500 font-semibold">Current GPS (YOU)</span>
            <MapPin className="w-4 h-4 text-slate-600" />
          </div>

          <div>
            <span className="text-sm font-bold font-mono text-slate-900 block">
              {coordinates(currentUser)}
            </span>
            <span className="text-xs text-slate-600 mt-0.5 block">
              {dataMode === 'hardware' ? 'Altitude unavailable • WGS84' : `Alt: ${currentUser?.altitude || selectedTrail.trailheadCoords.altitude || 820}m • WGS84`}
            </span>
          </div>

          <span className="text-xs text-slate-500 font-medium">{trekMode === 'EXISTING' ? selectedTrail.name : 'Open Wilderness'}</span>
        </div>
      </div>

      {/* 5. Quick Navigation Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <button
          onClick={() => setActiveTab('map')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-left transition-all shadow-xs flex items-center justify-between group"
        >
          <div>
            <span className="text-xs font-bold text-slate-900 block group-hover:text-blue-600 transition-colors">
              Trail Map & Checkpoints
            </span>
            <span className="text-[11px] text-slate-500">
              Detailed navigation, checkpoints & backtracking
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
        </button>

        <button
          onClick={() => setActiveTab('link')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-left transition-all shadow-xs flex items-center justify-between group"
        >
          <div>
            <span className="text-xs font-bold text-slate-900 block group-hover:text-blue-600 transition-colors">
              Communication Check
            </span>
            <span className="text-[11px] text-slate-500">
              Evaluate terrain RF propagation & safe range
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
        </button>

        <button
          onClick={() => setActiveTab('emergency')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-left transition-all shadow-xs flex items-center justify-between group"
        >
          <div>
            <span className="text-xs font-bold text-slate-900 block group-hover:text-red-600 transition-colors">
              Emergency & Fall Detection
            </span>
            <span className="text-[11px] text-slate-500">
              Manual SOS broadcast & ML fall response
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-red-600 transition-colors" />
        </button>
      </div>
    </div>
  );
};
