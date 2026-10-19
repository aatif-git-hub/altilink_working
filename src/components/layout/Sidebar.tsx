import React from 'react';
import {
  Home,
  MapPin,
  Radio,
  AlertOctagon,
  Users,
  Compass,
} from 'lucide-react';
import clsx from 'clsx';
import { useSimulation } from '../../context/SimulationContext';

export type TabType = 'home' | 'map' | 'link' | 'emergency';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenSOSModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSOSModal,
}) => {
  const { groupProfile, members, activeEmergency, dataMode } = useSimulation();

  const navItems: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'map', label: 'Trail Map', icon: MapPin },
    { id: 'link', label: 'Communication Check', icon: Radio },
    { id: 'emergency', label: 'Emergency', icon: AlertOctagon },
  ];

  return (
    <aside className="w-64 h-full bg-white border-r border-slate-200/80 flex flex-col justify-between p-4 select-none shrink-0">
      {/* Brand Header */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-base shadow-xs">
            AL
          </div>
          <div>
            <span className="font-bold text-base text-slate-900 block leading-tight">
              AltiLink
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Off-Grid Safety System</span>
          </div>
        </div>

        {/* Group Info Box */}
        {groupProfile && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Active Group:</span>
              <span className="font-mono font-bold text-slate-900">{groupProfile.code}</span>
            </div>
            <div className="font-bold text-xs text-slate-900 truncate">
              {groupProfile.name}
            </div>
            <div className="text-[11px] text-slate-500">
              {members.length} Observed Trekker{members.length === 1 ? '' : 's'}
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isEmergency = item.id === 'emergency' && activeEmergency;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left',
                  isActive
                    ? 'bg-slate-900 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
                  isEmergency && !isActive && 'text-red-700 bg-red-50 font-bold border border-red-200 animate-pulse'
                )}
              >
                <Icon className={clsx('w-4 h-4', isEmergency && 'text-red-600')} />
                <span className="flex-1">{item.label}</span>
                {isEmergency && (
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom SOS Quick Action */}
      <div className="pt-4 border-t border-slate-100 space-y-2">
        <button
          onClick={onOpenSOSModal}
          className={clsx(
            'w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 shadow-xs',
            activeEmergency
              ? 'bg-red-600 text-white animate-pulse shadow-md shadow-red-500/30'
              : 'bg-red-600 hover:bg-red-700 text-white'
          )}
        >
          <AlertOctagon className="w-4 h-4" />
          <span>{activeEmergency ? 'Emergency Active' : dataMode === 'hardware' ? 'Send SOS' : 'Simulate SOS'}</span>
        </button>

        <div className="text-[10px] text-center text-slate-400">
          AltiLink Protocol v2.5
        </div>
      </div>
    </aside>
  );
};
