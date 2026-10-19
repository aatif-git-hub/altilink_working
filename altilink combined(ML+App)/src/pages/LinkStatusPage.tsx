import React, { useState } from 'react';
import {
  Radio,
  SlidersHorizontal,
  Compass,
  TreePine,
  Mountain,
  Sun,
  ShieldCheck,
  Zap,
  Info,
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
    currentTerrain,
    setCurrentTerrain,
    safetyMargin,
    setSafetyMargin,
    linkAssessment,
    runLinkAssessment,
  } = useSimulation();

  const [selectedTerrain, setSelectedTerrain] = useState<TerrainType>(currentTerrain);
  const [selectedMargin, setSelectedMargin] = useState<number>(safetyMargin);

  const handleRunAssessment = () => {
    setCurrentTerrain(selectedTerrain);
    setSafetyMargin(selectedMargin);
    runLinkAssessment(selectedTerrain, selectedMargin);
  };

  const terrains: { id: TerrainType; title: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
    {
      id: 'OPEN_TERRAIN',
      title: 'Open Ridge / Plateau',
      icon: Sun,
      desc: 'Line-of-sight conditions. Minimal foliage absorption. Reliable boundary ~600m.',
    },
    {
      id: 'DENSE_FOREST',
      title: 'Dense Forest / Canopy',
      icon: TreePine,
      desc: 'Foliage RF scattering and multipath. Reliable boundary ~400m.',
    },
    {
      id: 'MOUNTAINOUS_TERRAIN',
      title: 'Mountainous / Gorge',
      icon: Mountain,
      desc: 'Non-line-of-sight granite ridges and drop-offs. Reliable boundary ~300m.',
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12 text-slate-900 select-none">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Communication Quality
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-xs font-mono font-bold text-slate-600">LoRa Link Assessment</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Link Status & Separation Limits
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            The reliable communication boundary is estimated from observed link quality under current conditions.
          </p>
        </div>

        <button
          onClick={handleRunAssessment}
          className="px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all flex items-center gap-2"
        >
          <Radio className="w-4 h-4" />
          <span>Assess Link</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4.5 rounded-2xl border border-slate-200 bg-white space-y-1.5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Communication Quality</span>
          <span className="text-xl font-extrabold text-slate-900 block">{linkAssessment.overallQuality}</span>
          <span className="text-xs text-slate-500">{linkAssessment.avgPacketSuccess}% packet delivery rate</span>
        </div>

        <div className="p-4.5 rounded-2xl border border-slate-200 bg-white space-y-1.5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Signal Strength (RSSI / SNR)</span>
          <span className="text-xl font-extrabold text-slate-900 font-mono block">{linkAssessment.avgRssi} dBm</span>
          <span className="text-xs text-slate-500 font-mono">SNR: {linkAssessment.avgSnr} dB</span>
        </div>

        <div className="p-4.5 rounded-2xl border border-slate-200 bg-white space-y-1.5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reliable Boundary</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 font-mono">{linkAssessment.reliableBoundary}</span>
            <span className="text-xs text-slate-500">meters</span>
          </div>
          <span className="text-xs text-slate-500">90%+ delivery threshold</span>
        </div>

        <div
          onClick={() => setActiveTab('group')}
          className="p-4.5 rounded-2xl border border-blue-200 bg-blue-50/50 space-y-1.5 shadow-xs cursor-pointer hover:bg-blue-50 transition-all"
        >
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Recommended Group Distance</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-blue-700 font-mono">{linkAssessment.recommendedGroupLimit}</span>
            <span className="text-xs text-slate-600 font-semibold">meters</span>
          </div>
          <div className="text-xs text-blue-700 font-semibold flex items-center gap-1">
            <span>Applied to Group Awareness</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Columns: Terrain Environment Selection */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <TreePine className="w-4 h-4 text-emerald-600" />
              <span>Observed Terrain Environment</span>
            </h3>

            <div className="space-y-2">
              {terrains.map((t) => {
                const Icon = t.icon;
                const isSelected = selectedTerrain === t.id;

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTerrain(t.id)}
                    className={clsx(
                      'p-3.5 rounded-xl border transition-all cursor-pointer text-xs',
                      isSelected
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={clsx('w-4 h-4', isSelected ? 'text-slate-900' : 'text-slate-500')} />
                      <span className="font-bold text-slate-900 text-sm">{t.title}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{t.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

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
              <span className="text-slate-900 font-bold">20% (Default)</span>
              <span>40% (Cautious)</span>
            </div>

            <button
              onClick={handleRunAssessment}
              className="w-full mt-2 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-xs"
            >
              Assess Link & Propagate Boundary
            </button>
          </div>
        </div>

        {/* Right 7 Columns: Link Measurements Table */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-4 h-4 text-slate-600" />
                <span>Observed Link Measurements</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">SX1262 LoRa Layer</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-[11px] uppercase tracking-wider">
                    <th className="pb-2.5 font-semibold">Distance</th>
                    <th className="pb-2.5 font-semibold font-mono">RSSI</th>
                    <th className="pb-2.5 font-semibold font-mono">SNR</th>
                    <th className="pb-2.5 font-semibold">Packet Success</th>
                    <th className="pb-2.5 font-semibold text-right">Evaluation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {linkAssessment.measurements.map((m) => {
                    const isWithin = m.distance <= linkAssessment.reliableBoundary;

                    return (
                      <tr
                        key={m.distance}
                        className={clsx(isWithin ? 'bg-slate-50/80 text-slate-900' : 'text-slate-400')}
                      >
                        <td className="py-2.5 font-bold">
                          {m.distance} m
                          {m.distance === linkAssessment.reliableBoundary && (
                            <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold font-sans">
                              Boundary
                            </span>
                          )}
                        </td>
                        <td className="py-2.5">{m.rssi} dBm</td>
                        <td className="py-2.5">{m.snr} dB</td>
                        <td className="py-2.5 font-bold">
                          <span className={clsx(m.packetSuccess >= 90 ? 'text-emerald-700' : 'text-amber-700')}>
                            {m.packetSuccess}%
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-bold font-sans">
                          <span
                            className={clsx(
                              'text-[11px] px-2 py-0.5 rounded border inline-block',
                              m.quality === 'EXCELLENT' || m.quality === 'GOOD'
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                : m.quality === 'FAIR'
                                ? 'text-amber-700 bg-amber-50 border-amber-200'
                                : 'text-red-700 bg-red-50 border-red-200'
                            )}
                          >
                            {m.quality}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Formula Summary Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-600">Reliable Communication Boundary:</span>
                <span className="text-slate-900 font-bold font-mono">{linkAssessment.reliableBoundary} meters</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Applied Safety Margin:</span>
                <span className="text-slate-900 font-bold font-mono">-{linkAssessment.safetyMarginPercent}%</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-slate-900 font-bold text-sm">
                <span>Recommended Group Separation Limit:</span>
                <span className="font-mono text-blue-700">{linkAssessment.recommendedGroupLimit} meters</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
