import React from 'react';
import clsx from 'clsx';
import { ShieldCheck, AlertTriangle, AlertOctagon, Wifi, WifiOff } from 'lucide-react';

interface StatusBadgeProps {
  status: 'SAFE' | 'WARNING' | 'EMERGENCY' | 'Connected' | 'Warning' | 'Disconnected' | 'Safe' | 'Emergency' | 'ACTIVE' | 'STANDBY';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  className,
}) => {
  const norm = status.toUpperCase();

  const getTheme = () => {
    switch (norm) {
      case 'SAFE':
      case 'CONNECTED':
      case 'ACTIVE':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-400',
          icon: ShieldCheck,
        };
      case 'WARNING':
      case 'STANDBY':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          dot: 'bg-amber-400',
          icon: AlertTriangle,
        };
      case 'EMERGENCY':
        return {
          bg: 'bg-red-500/15 text-red-400 border-red-500/40 animate-pulse',
          dot: 'bg-red-400 animate-ping',
          icon: AlertOctagon,
        };
      case 'DISCONNECTED':
        return {
          bg: 'bg-zinc-700/20 text-zinc-400 border-zinc-700/40',
          dot: 'bg-zinc-500',
          icon: WifiOff,
        };
      default:
        return {
          bg: 'bg-zinc-800 text-zinc-300 border-zinc-700',
          dot: 'bg-zinc-400',
          icon: Wifi,
        };
    }
  };

  const theme = getTheme();
  const IconComponent = theme.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs font-medium gap-1.5',
    lg: 'px-3.5 py-1.5 text-sm font-semibold gap-2',
  }[size];

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md border font-mono uppercase tracking-wider',
        theme.bg,
        sizeClasses,
        className
      )}
    >
      {showIcon && <IconComponent className={clsx(size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5')} />}
      <span>{status}</span>
    </span>
  );
};
