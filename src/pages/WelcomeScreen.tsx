import React, { useState } from 'react';
import {
  Compass,
  Users,
  MapPin,
  AlertOctagon,
  Mountain,
  PlusCircle,
  LogIn,
  Radio,
} from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';
import { generateGroupCode } from '../data/initialData';

export const WelcomeScreen: React.FC = () => {
  const { createGroup, joinGroup } = useSimulation();

  const [modalMode, setModalMode] = useState<'NONE' | 'CREATE' | 'JOIN'>('NONE');

  // Create Form State
  const [createGroupName, setCreateGroupName] = useState('Western Ghats Trek');
  const [createUserName, setCreateUserName] = useState('Nirmal');
  const [createMemberId, setCreateMemberId] = useState('M01');
  const [previewCode] = useState(generateGroupCode());

  // Join Form State
  const [joinGroupCode, setJoinGroupCode] = useState('');
  const [joinUserName, setJoinUserName] = useState('Rahul');
  const [joinMemberId, setJoinMemberId] = useState('M02');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createGroupName.trim() || !createUserName.trim()) return;
    createGroup(createGroupName, createUserName, createMemberId);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinGroupCode.trim() || !joinUserName.trim()) return;
    joinGroup(joinGroupCode, joinUserName, joinMemberId);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-4 md:p-8 select-none">
      {/* Top Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-lg shadow-xs">
            AL
          </div>
          <div>
            <span className="font-bold text-lg text-slate-900 block leading-tight">
              AltiLink
            </span>
            <span className="text-xs text-slate-500 font-medium">Off-Grid Hiking Safety System</span>
          </div>
        </div>

        <div className="text-xs text-emerald-800 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Off-Grid System</span>
        </div>
      </header>

      {/* Main Hero Card */}
      <main className="max-w-xl w-full mx-auto my-auto py-8 text-center space-y-8 animate-fadeIn">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <Mountain className="w-3.5 h-3.5" />
            <span>Off-Grid Group Hiking Safety</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Off-grid group awareness for hikers.
          </h1>

          <p className="text-base text-slate-600 max-w-md mx-auto leading-relaxed">
            Stay connected with your hiking party when cellular networks are unavailable. Share routes, record periodic checkpoints, verify communication range, and detect falls.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
          <button
            onClick={() => setModalMode('CREATE')}
            className="flex-1 py-3.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Group</span>
          </button>

          <button
            onClick={() => setModalMode('JOIN')}
            className="flex-1 py-3.5 px-5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98"
          >
            <LogIn className="w-4 h-4" />
            <span>Join Group</span>
          </button>
        </div>

        {/* 3 Core Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-slate-200 text-left text-xs">
          <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Trail Routes & Checkpoints</span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed">
              Configurable periodic checkpoint recording with sequential backtracking.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Radio className="w-4 h-4 text-blue-600" />
              <span>Communication Check</span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed">
              Practical connection tests with terrain-adaptive range estimation.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <AlertOctagon className="w-4 h-4 text-red-600" />
              <span>SOS & Fall Detection</span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed">
              Manual emergency distress and ML-based fall detection with confirmation window.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center text-xs text-slate-500 py-2">
        AltiLink Safety Protocol • Designed for backcountry expeditions
      </footer>

      {/* CREATE GROUP MODAL */}
      {modalMode === 'CREATE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-5 animate-scaleUp text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Create a Hiking Group</h2>
                <p className="text-xs text-slate-500">You will be designated as the Group Leader</p>
              </div>
              <button
                onClick={() => setModalMode('NONE')}
                className="text-slate-400 hover:text-slate-600 p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  Group / Trek Name:
                </label>
                <input
                  type="text"
                  required
                  value={createGroupName}
                  onChange={(e) => setCreateGroupName(e.target.value)}
                  placeholder="e.g. Western Ghats Trek"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-800 text-slate-900 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                    Leader Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={createUserName}
                    onChange={(e) => setCreateUserName(e.target.value)}
                    placeholder="e.g. Nirmal"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-800 text-slate-900 text-sm focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                    Member ID:
                  </label>
                  <input
                    type="text"
                    required
                    value={createMemberId}
                    onChange={(e) => setCreateMemberId(e.target.value)}
                    placeholder="M01"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-800 text-slate-900 text-sm focus:outline-none font-mono uppercase"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                    Generated Group Code:
                  </span>
                  <span className="text-base font-bold text-slate-900 font-mono">{previewCode}</span>
                </div>
                <span className="text-xs text-slate-500">Share with members</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode('NONE')}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold tracking-wide shadow-sm"
                >
                  Create & Enter Lobby
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN GROUP MODAL */}
      {modalMode === 'JOIN' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-5 animate-scaleUp text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Join a Hiking Group</h2>
                <p className="text-xs text-slate-500">Enter the group code provided by your leader</p>
              </div>
              <button
                onClick={() => setModalMode('NONE')}
                className="text-slate-400 hover:text-slate-600 p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  Group Code:
                </label>
                <input
                  type="text"
                  required
                  value={joinGroupCode}
                  onChange={(e) => setJoinGroupCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ALT-7K4P"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-800 text-slate-900 text-base font-mono font-bold uppercase tracking-wider focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                    Your Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={joinUserName}
                    onChange={(e) => setJoinUserName(e.target.value)}
                    placeholder="e.g. Rahul"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-800 text-slate-900 text-sm focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                    Member ID:
                  </label>
                  <input
                    type="text"
                    required
                    value={joinMemberId}
                    onChange={(e) => setJoinMemberId(e.target.value)}
                    placeholder="M02"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-800 text-slate-900 text-sm focus:outline-none font-mono uppercase"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode('NONE')}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold tracking-wide shadow-sm"
                >
                  Join Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
