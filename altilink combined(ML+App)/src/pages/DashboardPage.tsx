import React from 'react';
import {
  Users,
  Compass,
  AlertOctagon,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Radio,
  ArrowRight,
  Mountain,
} from 'lucide-react';
import clsx from 'clsx';
import { useSimulation } from '../context/SimulationContext';
import { TabType } from '../components/layout/Sidebar';
import { LeafletMap } from '../components/map/LeafletMap';

interface DashboardPageProps {
  setActiveTab: (tab: TabType) => void;
  onOpenSOSModal: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  setActiveTab,
  onOpenSOSModal,
}) => {
  const {
    groupProfile,
    members,
    overallGroupStatus,
    separationThreshold,
    linkAssessment,
    activeEmergency,
    checkpoints,
    isOfflineMapDownloaded,
  } = useSimulation();

  const separatedMembers = members.filter((m) => m.distance > separationThreshold);
  const leader = members.find((m) => m.isLeader) || members[0];
  const lastPassedCheckpoint = [...checkpoints].reverse().find((cp) => cp.passed) || checkpoints[0];

  return (
    <div className="space-y-6 animate-fadeIn pb-12 text-slate-900">
      {/* Top Hike Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Active Hike
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-xs font-mono font-bold text-slate-600">Group {groupProfile?.code || 'ALT-7K4P'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {groupProfile?.name || 'Western Ghats Trek'}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Off-grid group proximity, live map, and emergency awareness.
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
                Emergency Alert Active
              </span>
              <h3 className="text-base font-bold text-slate-900">
                {activeEmergency.senderName} ({activeEmergency.senderID}) triggered {activeEmergency.messageType.replace('_', ' ')}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Location: {activeEmergency.latitude.toFixed(4)}, {activeEmergency.longitude.toFixed(4)} • Wearable buzzer & vibration active
              </p>
            </div>
          </div>

          <button className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold shrink-0 shadow-xs">
            View Alert →
          </button>
        </div>
      )}

      {/* PROMINENT MAP ON DASHBOARD */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mountain className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">Live Group Trail Map</h2>
          </div>
          <button
            onClick={() => setActiveTab('map')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>Full Map & Routes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Leaflet Interactive Map */}
        <div className="w-full h-80 sm:h-96 rounded-xl overflow-hidden">
          <LeafletMap
            members={members}
            checkpoints={checkpoints}
            separationThreshold={separationThreshold}
            activeEmergency={activeEmergency}
            height="100%"
            onSelectMember={() => setActiveTab('group')}
          />
        </div>
      </div>

      {/* 4 Clean Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Card */}
        <div
          onClick={() => setActiveTab('group')}
          className={clsx(
            'p-4.5 rounded-2xl border transition-all cursor-pointer shadow-xs flex flex-col justify-between space-y-2',
            overallGroupStatus === 'SAFE'
              ? 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50'
              : overallGroupStatus === 'WARNING'
              ? 'border-amber-200 bg-amber-50/70 hover:bg-amber-50'
              : 'border-red-200 bg-red-50 hover:bg-red-100/80'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase text-slate-500 font-semibold">Group Status</span>
            {overallGroupStatus === 'SAFE' ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            ) : overallGroupStatus === 'WARNING' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            ) : (
              <AlertOctagon className="w-4 h-4 text-red-600" />
            )}
          </div>

          <div>
            <span className="text-xl font-extrabold text-slate-900 block">
              {overallGroupStatus === 'SAFE'
                ? 'Everyone is safe'
                : overallGroupStatus === 'WARNING'
                ? `${separatedMembers.length} member separated`
                : 'Emergency Active'}
            </span>
            <span className="text-xs text-slate-600 mt-0.5 block">
              {members.length} members in group
            </span>
          </div>

          <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
            <span>View members</span>
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>

        {/* Communication Quality */}
        <div
          onClick={() => setActiveTab('link')}
          className="p-4.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/70 transition-all cursor-pointer shadow-xs flex flex-col justify-between space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase text-slate-500 font-semibold">Communication</span>
            <Radio className="w-4 h-4 text-emerald-600" />
          </div>

          <div>
            <span className="text-xl font-extrabold text-slate-900 block">
              {linkAssessment.overallQuality}
            </span>
            <span className="text-xs text-slate-600 mt-0.5 block">
              {linkAssessment.avgPacketSuccess}% packet delivery rate
            </span>
          </div>

          <span className="text-xs text-slate-500">LoRa Link Status</span>
        </div>

        {/* Separation Limit */}
        <div
          onClick={() => setActiveTab('link')}
          className="p-4.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/70 transition-all cursor-pointer shadow-xs flex flex-col justify-between space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase text-slate-500 font-semibold">Separation Limit</span>
            <Compass className="w-4 h-4 text-blue-600" />
          </div>

          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-slate-900">{separationThreshold}</span>
              <span className="text-xs text-slate-500">meters</span>
            </div>
            <span className="text-xs text-slate-600 mt-0.5 block">
              Boundary: {linkAssessment.reliableBoundary}m (-{linkAssessment.safetyMarginPercent}%)
            </span>
          </div>

          <span className="text-xs text-blue-600 font-semibold">Adaptive threshold</span>
        </div>

        {/* Current Location */}
        <div
          onClick={() => setActiveTab('map')}
          className="p-4.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/70 transition-all cursor-pointer shadow-xs flex flex-col justify-between space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase text-slate-500 font-semibold">Current Location</span>
            <MapPin className="w-4 h-4 text-slate-600" />
          </div>

          <div>
            <span className="text-sm font-bold font-mono text-slate-900 block">
              {leader ? `${leader.latitude.toFixed(4)}, ${leader.longitude.toFixed(4)}` : '13.0827, 80.2707'}
            </span>
            <span className="text-xs text-slate-600 mt-0.5 block">
              Near {lastPassedCheckpoint?.name || 'Trailhead'}
            </span>
          </div>

          <span className="text-xs text-slate-500">WGS84 GPS</span>
        </div>
      </div>
    </div>
  );
};
