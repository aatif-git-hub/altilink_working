import React from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { ShieldCheck, AlertTriangle, AlertOctagon, Info, X } from 'lucide-react';
import clsx from 'clsx';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useSimulation();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none">
      {toasts.map((toast) => {
        const getIcon = () => {
          switch (toast.type) {
            case 'success':
              return <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />;
            case 'warning':
              return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />;
            case 'error':
              return <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />;
            default:
              return <Info className="w-4 h-4 text-blue-600 shrink-0" />;
          }
        };

        const getBorderColor = () => {
          switch (toast.type) {
            case 'success':
              return 'border-emerald-300 bg-white text-emerald-950 shadow-md';
            case 'warning':
              return 'border-amber-300 bg-white text-amber-950 shadow-md';
            case 'error':
              return 'border-red-300 bg-white text-red-950 shadow-md';
            default:
              return 'border-slate-200 bg-white text-slate-900 shadow-md';
          }
        };

        return (
          <div
            key={toast.id}
            className={clsx(
              'pointer-events-auto rounded-xl border p-3.5 transition-all duration-300 flex items-start justify-between gap-3 animate-slideInRight',
              getBorderColor()
            )}
          >
            <div className="flex items-start gap-2.5">
              {getIcon()}
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wide">
                    {toast.title}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">{toast.timestamp}</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 leading-snug">{toast.message}</p>
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
