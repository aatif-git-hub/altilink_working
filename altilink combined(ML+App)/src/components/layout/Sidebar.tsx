import React from 'react';
import {
  LayoutDashboard,
  Users,
  MapPin,
  AlertOctagon,
  Radio,
  LogOut,
  Bluetooth,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import { useSimulation } from '../../context/SimulationContext';

export type TabType = 'dashboard' | 'group' | 'map' | 'link' | 'emergency';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const {
    groupProfile,
    members,
    separationThreshold,
    overallGroupStatus,
    activeEmergency,
    wearableState,
    endHike,
    toggleBLE,
  } = useSimulation();

  const separatedCount = members.filter((m) => m.distance > separationThreshold).length;

  const navItems: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string; badgeColor?: string }[] = [
    {
      id: 'dashboard',
      label: 'Home',
      icon: LayoutDashboard,
    },
    {
      id: 'group',
      label: 'Group Awareness',
      icon: Users,
      badge: separatedCount > 0 ? `${separatedCount} Warn` : `${members.length}`,
      badgeColor: separatedCount > 0 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      id: 'map',
      label: 'Trail Map',
      icon: MapPin,
    },
    {
      id: 'link',
      label: 'Link Status',
      icon: Radio,
    },
    {
      id: 'emergency',
      label: 'Emergency / SOS',
      icon: AlertOctagon,
      badge: activeEmergency ? 'ACTIVE' : undefined,
      badgeColor: 'bg-red-600 text-white animate-pulse',
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 select-none text-slate-800">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-sm shadow-xs">
              AL
            </div>
            <div>
              <span className="font-bold text-base text-slate-900 block leading-tight">
                AltiLink
              </span>
              <p className="text-xs text-slate-500">Off-Grid Hiking Safety</p>
            </div>
          </div>
        </div>

        {/* Group Context Badge */}
        <div className="p-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
            <div className="flex justify-between items-center text-slate-500 text-[11px]">
              <span className="font-semibold uppercase tracking-wider">Active Group</span>
              <span className="font-mono font-bold text-slate-800">{groupProfile?.code || 'ALT-7K4P'}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
              <span className="font-bold text-slate-900 truncate max-w-[120px]">{groupProfile?.name || 'Trek Group'}</span>
              <span
                className={clsx(
                  'text-[10px] font-bold px-2 py-0.5 rounded border',
                  overallGroupStatus === 'SAFE' && 'text-emerald-700 bg-emerald-50 border-emerald-200',
                  overallGroupStatus === 'WARNING' && 'text-amber-800 bg-amber-50 border-amber-300',
                  overallGroupStatus === 'EMERGENCY' && 'text-red-700 bg-red-50 border-red-200 animate-pulse'
                )}
              >
                {overallGroupStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={clsx(
                  'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all',
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={clsx('w-4 h-4', isActive ? 'text-white' : 'text-slate-500')} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={clsx(
                      'text-[10px] font-bold px-2 py-0.5 rounded border font-mono',
                      isActive ? 'bg-slate-800 text-slate-200 border-slate-700' : item.badgeColor
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="p-4 border-t border-slate-100 space-y-2.5">
        {/* Wearable Connection */}
        <button
          onClick={toggleBLE}
          className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between hover:bg-slate-100 transition-colors"
          title="Click to toggle simulated wearable connection"
        >
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <Bluetooth className={clsx('w-4 h-4', wearableState.bleStatus === 'CONNECTED' ? 'text-blue-600' : 'text-slate-400')} />
            <span>Wearable Band:</span>
          </div>
          <span className={clsx('font-bold font-mono text-[11px]', wearableState.bleStatus === 'CONNECTED' ? 'text-emerald-700' : 'text-slate-400')}>
            {wearableState.bleStatus}
          </span>
        </button>

        {/* End Hike Button */}
        <button
          onClick={endHike}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>End Hike Session</span>
        </button>
      </div>
    </aside>
  );
};
