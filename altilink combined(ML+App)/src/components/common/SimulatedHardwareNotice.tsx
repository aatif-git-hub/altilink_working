import React, { useState } from 'react';
import { Cpu, Radio, Activity, Navigation, Info, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';

export const SimulatedHardwareNotice: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-3 text-xs text-blue-300/90 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="font-semibold text-blue-200">
            PROTOTYPE MODE:
          </span>
          <span className="text-zinc-300">
            Wearable communication & sensors are simulated for software validation and panel review.
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-blue-400 hover:text-blue-200 transition-colors py-0.5 px-2 rounded bg-blue-900/30 border border-blue-500/30"
        >
          <span>{expanded ? 'Hide Architecture' : 'Intended Hardware Specs'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-blue-500/20 grid grid-cols-1 md:grid-cols-4 gap-3 text-zinc-300 animate-fadeIn">
          <div className="p-2.5 rounded-lg bg-[#0b0f19] border border-zinc-800">
            <div className="flex items-center gap-1.5 font-medium text-white mb-1">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span>MCU & Logic</span>
            </div>
            <p className="text-[11px] text-zinc-400">Heltec WiFi LoRa 32 V3 (ESP32-S3 Dual-Core Xtensa LX7 @ 240MHz)</p>
          </div>

          <div className="p-2.5 rounded-lg bg-[#0b0f19] border border-zinc-800">
            <div className="flex items-center gap-1.5 font-medium text-white mb-1">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>Radio & Mesh</span>
            </div>
            <p className="text-[11px] text-zinc-400">Semtech SX1262 LoRa 868/915MHz with BLE 5.0 GATT link to smartphone</p>
          </div>

          <div className="p-2.5 rounded-lg bg-[#0b0f19] border border-zinc-800">
            <div className="flex items-center gap-1.5 font-medium text-white mb-1">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Motion & TinyML</span>
            </div>
            <p className="text-[11px] text-zinc-400">Bosch BMI270 6-axis ultra-low-power IMU with embedded fall classification</p>
          </div>

          <div className="p-2.5 rounded-lg bg-[#0b0f19] border border-zinc-800">
            <div className="flex items-center gap-1.5 font-medium text-white mb-1">
              <Navigation className="w-3.5 h-3.5 text-purple-400" />
              <span>Positioning & Power</span>
            </div>
            <p className="text-[11px] text-zinc-400">Adaptive Phone GPS primary; dedicated wearable GNSS activated during emergencies</p>
          </div>
        </div>
      )}
    </div>
  );
};
