import React from 'react';
import { Home, MapPin, Radio, AlertOctagon } from 'lucide-react';
import clsx from 'clsx';
import { TabType } from './Sidebar';

interface MobileNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  hasEmergency: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  setActiveTab,
  hasEmergency,
}) => {
  const items = [
    { id: 'home' as TabType, label: 'Home', icon: Home },
    { id: 'map' as TabType, label: 'Trail Map', icon: MapPin },
    { id: 'link' as TabType, label: 'Link Check', icon: Radio },
    { id: 'emergency' as TabType, label: 'SOS', icon: AlertOctagon, highlight: hasEmergency },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 z-40 select-none shadow-lg">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={clsx(
              'flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors',
              isActive
                ? 'text-slate-900 font-bold'
                : item.highlight
                ? 'text-red-600 animate-pulse font-bold'
                : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <Icon className={clsx('w-5 h-5 mb-0.5', isActive ? 'text-slate-900' : item.highlight ? 'text-red-600' : 'text-slate-500')} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
