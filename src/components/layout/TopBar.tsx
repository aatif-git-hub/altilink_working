import React from 'react';
import { AlertOctagon, Mountain } from 'lucide-react';
import clsx from 'clsx';
import { useSimulation } from '../../context/SimulationContext';

interface TopBarProps {
  onOpenSOSModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenSOSModal }) => {
  const {
    groupProfile,
    overallGroupStatus,
    activeEmergency,
    trekMode,
    selectedTrail,
    endHike,
  } = useSimulation();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shrink-0 gap-4 text-slate-900 select-none">
      {/* Left Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs">
            <span className="text-slate-500 font-semibold uppercase text-[10px]">Group:</span>
            <span className="font-bold text-slate-900 font-mono">{groupProfile?.code || 'ALT-7K4P'}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs">
            <Mountain className="w-3.5 h-3.5 text-blue-700" />
            <span className="font-bold text-blue-900">
              {trekMode === 'EXISTING' ? selectedTrail.name : 'Custom Trek'}
            </span>
          </div>
        </div>

        <span
          className={clsx(
            'text-xs font-bold px-2.5 py-0.5 rounded border',
            overallGroupStatus === 'SAFE' && 'text-emerald-700 bg-emerald-50 border-emerald-200',
            overallGroupStatus === 'WARNING' && 'text-amber-800 bg-amber-50 border-amber-300',
            overallGroupStatus === 'EMERGENCY' && 'text-red-700 bg-red-50 border-red-200 animate-pulse'
          )}
        >
          {overallGroupStatus}
        </span>
      </div>

      {/* Right SOS Action & End Hike */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={endHike}
          className="text-xs text-slate-600 hover:text-slate-900 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-medium transition-colors"
        >
          Lobby
        </button>

        <button
          onClick={onOpenSOSModal}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all shadow-xs active:scale-98',
            activeEmergency
              ? 'bg-red-600 text-white animate-pulse shadow-md shadow-red-500/30'
              : 'bg-red-600 hover:bg-red-700 text-white'
          )}
        >
          <AlertOctagon className="w-4 h-4" />
          <span>{activeEmergency ? 'Emergency Active' : 'Emergency / SOS'}</span>
        </button>
      </div>
    </header>
  );
};
