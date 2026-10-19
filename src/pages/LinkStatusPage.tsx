import { HardwareLinkPanel } from '../components/hardware/HardwareLinkPanel';
import React, { useState } from 'react';
import {
  Radio,
  TreePine,
  Mountain,
  Sun,
  ShieldCheck,
  CheckCircle2,
  Signal,
  ArrowRight,
} from 'lucide-react';
import clsx from 'clsx';
import { useSimulation } from '../context/SimulationContext';
import { TerrainType } from '../types';
import { TabType } from '../components/layout/Sidebar';

interface LinkStatusPageProps {
  setActiveTab: (tab: TabType) => void;
}

export const LinkStatusPage: React.FC<LinkStatusPageProps> = ({ setActiveTab }) => {
  const {
    dataMode,
    currentTerrain,
    setCurrentTerrain,
    safetyMargin,
    setSafetyMargin,
    linkAssessment,
    runLinkAssessment,
  } = useSimulation();

  const [selectedTerrain, setSelectedTerrain] = useState<TerrainType>(currentTerrain);
  const [selectedMargin, setSelectedMargin] = useState<number>(safetyMargin);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  const handleTestConnection = () => {
    setIsTesting(true);
    setTimeout(() => {
      setCurrentTerrain(selectedTerrain);
      setSafetyMargin(selectedMargin);
      runLinkAssessment(selectedTerrain, selectedMargin);
      setIsTesting(false);
    }, 600);
  };

  const terrainOptions: { id: TerrainType; title: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
    {
      id: 'OPEN_TERRAIN',
      title: 'Open Terrain / Ridge',
      icon: Sun,
      desc: 'Line-of-sight conditions with minimal foliage absorption. Est. range ~600m.',
    },
    {
      id: 'DENSE_FOREST',
      title: 'Dense Forest / Canopy',
      icon: TreePine,
      desc: 'Foliage RF attenuation and multipath reflection. Est. range ~400m.',
    },
    {
      id: 'MOUNTAINOUS_TERRAIN',
      title: 'Mountainous / Gorge',
      icon: Mountain,
      desc: 'Non-line-of-sight terrain with rock ridge shadowing. Est. range ~300m.',
    },
  ];

  const getSignalStrengthLabel = (quality: string) => {
    if (quality === 'EXCELLENT') return 'Excellent (-68 dBm)';
    if (quality === 'GOOD') return 'Good (-76 dBm)';
    if (quality === 'FAIR') return 'Fair (-85 dBm)';
    return 'Marginal (-94 dBm)';
  };

  const getSignalQualityLabel = (quality: string) => {
    if (quality === 'EXCELLENT') return 'Excellent (+11 dB SNR)';
    if (quality === 'GOOD') return 'Good (+7.5 dB SNR)';
    if (quality === 'FAIR') return 'Moderate (+2.0 dB SNR)';
    return 'Low (-3.5 dB SNR)';
  };

  if (dataMode === "hardware") return <HardwareLinkPanel />;

  return (
    <div className="space-y-6 animate-fadeIn pb-12 text-slate-900 select-none">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Communication Test
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-xs font-mono font-bold text-slate-600">LoRa RF Link</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            COMMUNICATION CHECK
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Software demo: evaluate predefined terrain measurements. No radio test is performed.
          </p>
        </div>

        <button
          onClick={handleTestConnection}
          disabled={isTesting}
          className="px-6 py-3 rounded-xl font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Radio className={clsx('w-4 h-4', isTesting && 'animate-spin')} />
          <span>{isTesting ? 'Testing Link...' : 'TEST CONNECTION'}</span>
        </button>
      </div>

      {/* Main Field Test Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Columns: Environment Selection */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <TreePine className="w-4 h-4 text-emerald-600" />
              <span>Select Environment</span>
            </h2>

            <div className="space-y-2.5">
              {terrainOptions.map((t) => {
                const Icon = t.icon;
                const isSelected = selectedTerrain === t.id;

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTerrain(t.id)}
                    className={clsx(
                      'p-3.5 rounded-xl border transition-all cursor-pointer text-xs',
                      isSelected
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Icon className={clsx('w-4 h-4', isSelected ? 'text-slate-900' : 'text-slate-500')} />
                        <span className="font-bold text-slate-900 text-sm">{t.title}</span>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] bg-slate-900 text-white font-bold px-2 py-0.5 rounded">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{t.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Safety Margin Selector */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Safety Margin:</span>
              <span className="text-xs font-mono font-bold text-slate-900">{selectedMargin}%</span>
            </div>

            <input
              type="range"
              min="10"
              max="40"
              step="5"
              value={selectedMargin}
              onChange={(e) => setSelectedMargin(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>10% (Tight)</span>
              <span className="text-slate-900 font-bold">20% (Standard)</span>
              <span>40% (Cautious)</span>
            </div>
          </div>
        </div>

        {/* Right 7 Columns: Practical Results Display */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Connection Test Results</span>
              </h2>
              <span className="text-xs text-slate-500 font-mono">Simulated Link Assessment</span>
            </div>

            {/* 3 Practical Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Signal Strength</span>
                <span className="text-sm font-bold text-slate-900 block">{getSignalStrengthLabel(linkAssessment.overallQuality)}</span>
                <span className="text-[10px] text-emerald-700 font-semibold">Reliable RF Power</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Signal Quality</span>
                <span className="text-sm font-bold text-slate-900 block">{getSignalQualityLabel(linkAssessment.overallQuality)}</span>
                <span className="text-[10px] text-emerald-700 font-semibold">Clean SNR Margin</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Packet Delivery</span>
                <span className="text-base font-extrabold text-emerald-700 font-mono block">{linkAssessment.avgPacketSuccess}%</span>
                <span className="text-[10px] text-slate-500">Successful Frames</span>
              </div>
            </div>

            {/* Range Breakdown Box */}
            <div className="p-5 rounded-xl bg-slate-900 text-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold">
                    Estimated Communication Range
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-3xl font-black font-mono text-white">{linkAssessment.reliableBoundary}</span>
                    <span className="text-sm text-slate-300 font-semibold">meters</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-emerald-400 uppercase tracking-wider block font-semibold">
                    Recommended Operating Range
                  </span>
                  <div className="flex items-baseline justify-end gap-1 mt-0.5">
                    <span className="text-3xl font-black font-mono text-emerald-400">{linkAssessment.recommendedGroupLimit}</span>
                    <span className="text-sm text-emerald-300 font-semibold">meters</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Applied Safety Margin: <strong>{linkAssessment.safetyMarginPercent}% buffer</strong></span>
                <span className="text-slate-300">Environment: {terrainOptions.find(t => t.id === currentTerrain)?.title}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
