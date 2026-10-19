import React, { useState } from 'react';
import {
  Users,
  Copy,
  Plus,
  Play,
  Check,
  Shield,
  Trash2,
  Mountain,
  LogOut,
  Radio,
} from 'lucide-react';
import clsx from 'clsx';
import { useSimulation } from '../context/SimulationContext';

export const GroupLobbyPage: React.FC = () => {
  const {
    groupProfile,
    members,
    currentUser,
    addLobbyMember,
    removeLobbyMember,
    startHike,
    resetSession,
    addToast,
  } = useSimulation();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('Rahul');
  const [newMemberId, setNewMemberId] = useState('M02');
  const [newMemberDistance, setNewMemberDistance] = useState(210);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (groupProfile?.code) {
      navigator.clipboard.writeText(groupProfile.code);
      setCopied(true);
      addToast('Copied Code', `Group code ${groupProfile.code} copied to clipboard.`, 'info');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    addLobbyMember(newMemberName, newMemberId, newMemberDistance);
    setIsAddModalOpen(false);

    if (newMemberId === 'M02') {
      setNewMemberName('Karthik');
      setNewMemberId('M03');
      setNewMemberDistance(320);
    } else {
      setNewMemberName(`Trekker ${members.length + 2}`);
      setNewMemberId(`M0${members.length + 2}`);
      setNewMemberDistance(250);
    }
  };

  if (!groupProfile) {
    return (
      <div className="p-8 text-center text-slate-500 space-y-4">
        <p>No active group found.</p>
        <button
          onClick={resetSession}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
        >
          Return to Welcome Screen
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn pb-12 text-slate-900 select-none">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold tracking-wide text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Group Lobby
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-xs text-slate-500">Waiting for members before starting hike</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {groupProfile.name}
            </h1>
          </div>

          <button
            onClick={resetSession}
            className="self-start sm:self-auto text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave Group</span>
          </button>
        </div>

        {/* Group Code Share Box */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Group Invite Code (Share with your hiking party):
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono tracking-wider">
              {groupProfile.code}
            </span>
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Group Code'}</span>
          </button>
        </div>
      </div>

      {/* Group Members List */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">
              Joined Members ({members.length})
            </h2>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Member</span>
          </button>
        </div>

        {/* Members Cards */}
        <div className="space-y-2.5">
          {members.map((m) => (
            <div
              key={m.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-200 text-slate-800 font-bold font-mono text-sm flex items-center justify-center">
                  {m.id}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{m.name}</span>
                    {m.isLeader && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                        Leader
                      </span>
                    )}
                    {m.isCurrentUser && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                        You
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500 text-xs">
                    Ready in lobby • GPS: {m.latitude.toFixed(4)}, {m.longitude.toFixed(4)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!m.isLeader && (
                  <button
                    onClick={() => removeLobbyMember(m.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                    title="Remove member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Start Hike Action */}
      <div className="pt-2">
        <button
          onClick={startHike}
          className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base flex items-center justify-center gap-2.5 shadow-sm transition-all active:scale-98"
        >
          <Play className="w-5 h-5 fill-white" />
          <span>Start Hike</span>
        </button>
      </div>

      {/* ADD MEMBER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4 animate-scaleUp text-slate-900 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Group Member</h3>
                <p className="text-xs text-slate-500">Add a peer member to the lobby</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMemberSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-slate-700 font-semibold uppercase text-[11px]">Member Name:</label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Rahul"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-800 text-slate-900 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-semibold uppercase text-[11px]">Member ID:</label>
                  <input
                    type="text"
                    required
                    value={newMemberId}
                    onChange={(e) => setNewMemberId(e.target.value)}
                    placeholder="M02"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-800 text-slate-900 text-sm focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-semibold uppercase text-[11px]">Initial Distance (m):</label>
                  <input
                    type="number"
                    min="50"
                    max="800"
                    step="10"
                    value={newMemberDistance}
                    onChange={(e) => setNewMemberDistance(parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-800 text-slate-900 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
