'use client';

import { useState, useEffect } from 'react';
import {
  DoorOpen,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Users,
  AlertCircle,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { GateType, GateStatus } from '@ongc/shared-types';

export default function AdminGatesPage() {
  const [gates, setGates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Gate Form Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGateName, setNewGateName] = useState('');
  const [newGateNumber, setNewGateNumber] = useState('');
  const [newGateType, setNewGateType] = useState<GateType>(GateType.REGULAR);
  const [newCapacityTotal, setNewCapacityTotal] = useState<number | ''>('');
  const [newCapacityPerHour, setNewCapacityPerHour] = useState<number | ''>('');

  const loadGates = async () => {
    try {
      setLoading(true);
      const data = await fetchApi('/admin/gates');
      setGates(data || []);
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to load gates', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGates();
  }, []);

  const toggleOpen = async (gateId: string, currentIsOpen: boolean) => {
    try {
      await fetchApi(`/admin/gates/${gateId}/toggle-open`, {
        method: 'PATCH',
        body: JSON.stringify({ isOpen: !currentIsOpen }),
      });
      loadGates();
      setMsg({
        text: `Gate ${!currentIsOpen ? 'opened' : 'closed'} successfully`,
        type: 'success',
      });
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to update gate', type: 'error' });
    }
  };

  const toggleScanning = async (gateId: string, currentIsPaused: boolean) => {
    try {
      await fetchApi(`/admin/gates/${gateId}/toggle-scanning`, {
        method: 'PATCH',
        body: JSON.stringify({ isScanningPaused: !currentIsPaused }),
      });
      loadGates();
      setMsg({
        text: `Gate scanning ${!currentIsPaused ? 'paused' : 'resumed'} successfully`,
        type: 'success',
      });
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to update gate', type: 'error' });
    }
  };

  const handleCreateGate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/admin/gates', {
        method: 'POST',
        body: JSON.stringify({
          name: newGateName,
          gateNumber: newGateNumber,
          gateType: newGateType,
          totalCapacity: newCapacityTotal ? Number(newCapacityTotal) : undefined,
          capacityPerHour: newCapacityPerHour ? Number(newCapacityPerHour) : undefined,
        }),
      });
      setShowAddModal(false);
      setNewGateName('');
      setNewGateNumber('');
      loadGates();
      setMsg({ text: 'Gate created successfully', type: 'success' });
    } catch (e: any) {
      alert(e.message || 'Failed to create gate');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <DoorOpen className="w-6 h-6 text-red-500" />
            Turnstile Gate Management
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure turnstile gates, live capacities, open/closed status, and scanning controls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadGates}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-900/30"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Gate</span>
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
            msg.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/60 border-red-500/40 text-red-200'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Gates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {gates.map((gate) => (
          <div
            key={gate.id}
            className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-5"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-400">
                  GATE #{gate.gateNumber}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {gate.gateType}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mt-2">{gate.name}</h3>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide flex items-center gap-1.5 ${
                    gate.isOpen
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                      : 'bg-red-950/80 text-red-300 border border-red-500/40'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      gate.isOpen ? 'bg-emerald-400' : 'bg-red-400'
                    }`}
                  />
                  {gate.isOpen ? 'OPEN' : 'CLOSED'}
                </span>

                {gate.isScanningPaused ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40">
                    SCANNING PAUSED
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-950/80 text-blue-300 border border-blue-500/40">
                    SCANNING ACTIVE
                  </span>
                )}
              </div>

              {/* Capacities */}
              <div className="grid grid-cols-2 gap-2 mt-4 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px]">TOTAL CAPACITY</span>
                  <span className="font-bold text-white font-mono">
                    {gate.totalCapacity || 'Unlimited'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">HOURLY CAP</span>
                  <span className="font-bold text-white font-mono">
                    {gate.capacityPerHour || 'Unlimited'} / hr
                  </span>
                </div>
              </div>

              {/* Assigned Staff */}
              <div className="mt-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Assigned Staff ({gate.gateUsers?.length || 0})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {gate.gateUsers && gate.gateUsers.length > 0 ? (
                    gate.gateUsers.map((gu: any) => (
                      <span
                        key={gu.id}
                        className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300"
                      >
                        {gu.user.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">No operators assigned</span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                onClick={() => toggleOpen(gate.id, gate.isOpen)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                  gate.isOpen
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {gate.isOpen ? 'Close Gate' : 'Open Gate'}
              </button>

              <button
                onClick={() => toggleScanning(gate.id, gate.isScanningPaused)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                  gate.isScanningPaused
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300'
                }`}
              >
                {gate.isScanningPaused ? 'Resume Scan' : 'Pause Scan'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Gate Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-lg font-bold text-white">Create New Gate</h3>
            <form onSubmit={handleCreateGate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Gate Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gate 4 (East Promenade)"
                  value={newGateName}
                  onChange={(e) => setNewGateName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Gate Number / Identifier *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 4"
                  value={newGateNumber}
                  onChange={(e) => setNewGateNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Gate Type
                </label>
                <select
                  value={newGateType}
                  onChange={(e) => setNewGateType(e.target.value as GateType)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                >
                  <option value={GateType.REGULAR}>Regular General Entry</option>
                  <option value={GateType.VIP}>VIP & Dignitary Entry</option>
                  <option value={GateType.OFFICIAL}>Official Staff Entry</option>
                  <option value={GateType.SERVICE}>Service & Catering Entry</option>
                  <option value={GateType.EMERGENCY}>Emergency Exit Only</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Total Capacity
                  </label>
                  <input
                    type="number"
                    placeholder="Unlimited"
                    value={newCapacityTotal}
                    onChange={(e) =>
                      setNewCapacityTotal(e.target.value ? Number(e.target.value) : '')
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Hourly Limit
                  </label>
                  <input
                    type="number"
                    placeholder="Unlimited"
                    value={newCapacityPerHour}
                    onChange={(e) =>
                      setNewCapacityPerHour(e.target.value ? Number(e.target.value) : '')
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                >
                  Create Gate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
