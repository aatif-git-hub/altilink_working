import React, { ReactNode } from 'react';
import clsx from 'clsx';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: ReactNode;
  variant?: 'default' | 'safe' | 'warning' | 'emergency';
  onClick?: () => void;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  badge,
  variant = 'default',
  onClick,
  className,
}) => {
  const getBorderColor = () => {
    switch (variant) {
      case 'safe':
        return 'border-emerald-500/20 hover:border-emerald-500/40 bg-[#0f141c]';
      case 'warning':
        return 'border-amber-500/25 hover:border-amber-500/50 bg-[#151310]';
      case 'emergency':
        return 'border-red-500/35 hover:border-red-500/60 bg-[#180e10]';
      default:
        return 'border-zinc-800 hover:border-zinc-700 bg-[#0d1017]';
    }
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        'relative rounded-xl border p-4.5 transition-all duration-200 shadow-sm',
        getBorderColor(),
        onClick && 'cursor-pointer hover:scale-[1.01]',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-400 font-mono">
          {title}
        </span>
        {Icon && (
          <div className="p-2 rounded-lg bg-zinc-800/60 text-zinc-300 border border-zinc-700/50">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold font-mono tracking-tight text-white">
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-zinc-400 font-mono">{unit}</span>}
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        {subtitle && <p className="text-xs text-zinc-400">{subtitle}</p>}
        {badge && <div className="ml-auto">{badge}</div>}
      </div>
    </div>
  );
};
