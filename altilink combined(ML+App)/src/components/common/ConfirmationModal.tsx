import React from 'react';
import { AlertOctagon, X, Radio } from 'lucide-react';
import { useSimulation } from '../../context/SimulationContext';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Send SOS Distress',
  cancelText = 'Cancel',
}) => {
  const { groupProfile, members } = useSimulation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn select-none">
      <div
        className="relative w-full max-w-md rounded-2xl bg-white border-2 border-red-500/80 p-6 shadow-2xl animate-scaleUp text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-red-600 text-white shadow-md shadow-red-500/20">
            <AlertOctagon className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 leading-tight">{title}</h3>
            <span className="text-xs text-red-700 font-semibold uppercase tracking-wider">High-Priority Alert</span>
          </div>
        </div>

        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          {message}
        </p>

        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-slate-700 space-y-1.5 font-mono mb-5">
          <div className="flex justify-between">
            <span className="text-slate-500 font-sans">Target Group:</span>
            <span className="font-bold text-slate-900">{groupProfile?.name || 'Trek Group'} ({groupProfile?.code || 'ALT-7K4P'})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-sans">Recipient Wearables:</span>
            <span className="text-slate-900 font-bold">{members.length} Peer Nodes</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-sans">Wearable Alert:</span>
            <span className="text-red-700 font-bold font-sans">Buzzer & Haptic Vibration</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs tracking-wide transition-all shadow-md shadow-red-500/20 flex items-center justify-center gap-2"
          >
            <Radio className="w-4 h-4 animate-pulse" />
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
