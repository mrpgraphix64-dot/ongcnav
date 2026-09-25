'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  Shield,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

const PASS_TYPES = [
  { code: 'COMMERCIAL_DAILY', name: 'Daily Pass' },
  { code: 'COMMERCIAL_SEASON', name: 'Season Pass' },
  { code: 'COMMERCIAL_MANDLI', name: 'Mandli Pass' },
  { code: 'COMMERCIAL_ANY_DAY', name: 'Any Day Pass' },
];

export default function CommercialAgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Register Agent Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    staffId: '',
  });
  const [registering, setRegistering] = useState(false);

  // Allocate Modal
  const [selectedAgentForAlloc, setSelectedAgentForAlloc] = useState<any>(null);
  const [allocPassType, setAllocPassType] = useState('COMMERCIAL_DAILY');
  const [allocQuantity, setAllocQuantity] = useState<number>(50);
  const [allocating, setAllocating] = useState(false);

  // Reclaim Modal
  const [selectedAgentForReclaim, setSelectedAgentForReclaim] = useState<any>(null);
  const [reclaimPassType, setReclaimPassType] = useState('COMMERCIAL_DAILY');
  const [reclaimQuantity, setReclaimQuantity] = useState<number>(10);
  const [reclaimNotes, setReclaimNotes] = useState('');
  const [reclaiming, setReclaiming] = useState(false);

  const handleReclaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForReclaim) return;
    setReclaiming(true);
    try {
      await fetchApi(`/admin/commercial/agents/${selectedAgentForReclaim.id}/reclaim`, {
        method: 'POST',
        body: JSON.stringify({
          passType: reclaimPassType,
          quantity: reclaimQuantity,
          notes: reclaimNotes || undefined,
        }),
      });
      setSelectedAgentForReclaim(null);
      setReclaimNotes('');
      loadAgents();
    } catch (err: any) {
      alert(err.message || 'Failed to reclaim inventory.');
    } finally {
      setReclaiming(false);
    }
  };

  const loadAgents = useCallback(async () => {
    try {
      setErrorMsg(null);
      const q = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const res = await fetchApi(`/admin/commercial/agents${q}`);
      setAgents(res.agents || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load commercial agents.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleRegisterAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    try {
      await fetchApi('/admin/commercial/agents', {
        method: 'POST',
        body: JSON.stringify(registerForm),
      });
      setShowRegisterModal(false);
      setRegisterForm({ name: '', email: '', phone: '', password: '', staffId: '' });
      loadAgents();
    } catch (err: any) {
      alert(err.message || 'Failed to register commercial agent.');
    } finally {
      setRegistering(false);
    }
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForAlloc) return;
    setAllocating(true);
    try {
      await fetchApi(`/admin/commercial/agents/${selectedAgentForAlloc.id}/allocate`, {
        method: 'POST',
        body: JSON.stringify({
          passType: allocPassType,
          quantity: allocQuantity,
        }),
      });
      setSelectedAgentForAlloc(null);
      loadAgents();
    } catch (err: any) {
      alert(err.message || 'Failed to allocate inventory.');
    } finally {
      setAllocating(false);
    }
  };

  const totalAllocatedAll = agents.reduce((sum, a) => sum + (a.summary?.totalAllocated || 0), 0);
  const totalBookedAll = agents.reduce((sum, a) => sum + (a.summary?.totalBooked || 0), 0);
  const totalAvailableAll = agents.reduce((sum, a) => sum + (a.summary?.totalAvailable || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner / Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="text-xs font-bold text-stone-500 uppercase font-outfit">Total Commercial Agents</div>
          <div className="text-2xl font-outfit font-black text-ink mt-1">{agents.length}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="text-xs font-bold text-stone-500 uppercase font-outfit">Total Quota Allocated</div>
          <div className="text-2xl font-outfit font-black text-maroon mt-1">{totalAllocatedAll}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="text-xs font-bold text-stone-500 uppercase font-outfit">Total Direct Sales</div>
          <div className="text-2xl font-outfit font-black text-emerald-700 mt-1">{totalBookedAll}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
          <div className="text-xs font-bold text-stone-500 uppercase font-outfit">Total Available Quota</div>
          <div className="text-2xl font-outfit font-black text-amber-700 mt-1">{totalAvailableAll}</div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agent by name, email, phone..."
            className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-stone-300 w-72 focus:outline-hidden focus:border-maroon"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => loadAgents()}
            className="p-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-maroon text-white font-outfit font-bold text-xs hover:bg-maroon-dark transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register Commercial Agent</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Agents Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-stone-500">Loading agents...</div>
      ) : agents.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs">
          No commercial agents registered yet.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 font-outfit font-bold text-stone-600">
                <tr>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Hierarchy / Parent</th>
                  <th className="px-4 py-3">Allocations Overview</th>
                  <th className="px-4 py-3">Sales / Orders</th>
                  <th className="px-4 py-3">Available Quota</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {agents.map((ag) => (
                  <tr key={ag.id} className="hover:bg-cream-soft transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-ink">{ag.name}</div>
                      <div className="text-[11px] text-stone-500">{ag.email}</div>
                      <div className="text-[11px] text-stone-500">
                        {ag.phone} {ag.staffId && `• Staff ID: ${ag.staffId}`}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {ag.parentAgent ? (
                        <div>
                          <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                            Sub-Agent
                          </span>
                          <div className="text-[11px] text-stone-500 mt-1">
                            Under: {ag.parentAgent.name}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="text-[10px] font-extrabold bg-blue-100 text-blue-900 px-2 py-0.5 rounded">
                            Master Agent
                          </span>
                          {ag.subAgentsCount > 0 && (
                            <div className="text-[11px] text-stone-500 mt-1">
                              {ag.subAgentsCount} Sub-agents
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {ag.allocations?.map((al: any) => (
                          <span
                            key={al.id}
                            className="text-[10px] font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-700"
                          >
                            {al.passType.replace('COMMERCIAL_', '')}: {al.availableQuantity} avail / {al.allocatedQuantity}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3 font-semibold text-stone-700">
                      {ag.ordersCount || 0} Orders Sold
                    </td>

                    <td className="px-4 py-3 font-outfit font-black text-maroon text-sm">
                      {ag.summary?.totalAvailable || 0} Passes
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedAgentForAlloc(ag)}
                          className="px-3 py-1.5 rounded-xl bg-maroon text-white font-outfit font-bold text-xs hover:bg-maroon-dark transition-colors cursor-pointer"
                        >
                          Allocate
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAgentForReclaim(ag);
                            setReclaimPassType(ag.allocations?.[0]?.passType || 'COMMERCIAL_DAILY');
                          }}
                          className="px-3 py-1.5 rounded-xl border border-stone-300 text-stone-700 font-outfit font-bold text-xs hover:bg-stone-100 transition-colors cursor-pointer"
                        >
                          Reclaim
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER AGENT */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-outfit font-black text-lg text-ink">
              Register Commercial Agent
            </h3>
            <p className="text-xs text-stone-500">
              Create a top-level commercial agent with direct offline sales access.
            </p>

            <form onSubmit={handleRegisterAgent} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  placeholder="e.g. Vipul Shah"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  placeholder="vipul@example.com"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Mobile Phone * (10 Digits)</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={registerForm.phone}
                  onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                  placeholder="9876543210"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Staff / Agent ID (Optional)</label>
                <input
                  type="text"
                  value={registerForm.staffId}
                  onChange={(e) => setRegisterForm({ ...registerForm, staffId: e.target.value })}
                  placeholder="AGT-001"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="px-5 py-2 rounded-xl bg-maroon text-white font-outfit font-bold text-xs hover:bg-maroon-dark disabled:opacity-50"
                >
                  {registering ? 'Creating Agent...' : 'Create Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ALLOCATE MASTER INVENTORY */}
      {selectedAgentForAlloc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-outfit font-black text-lg text-ink">
              Allocate Master Inventory to {selectedAgentForAlloc.name}
            </h3>
            <p className="text-xs text-stone-500">
              Master allocation rule: Agent + Pass Type + Quantity.
            </p>

            <form onSubmit={handleAllocate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Pass Category</label>
                <select
                  value={allocPassType}
                  onChange={(e) => setAllocPassType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                >
                  {PASS_TYPES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Quantity of Passes</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={allocQuantity}
                  onChange={(e) => setAllocQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAgentForAlloc(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={allocating}
                  className="px-5 py-2 rounded-xl bg-maroon text-white font-outfit font-bold text-xs hover:bg-maroon-dark disabled:opacity-50"
                >
                  {allocating ? 'Allocating...' : 'Allocate Passes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECLAIM MODAL */}
      {selectedAgentForReclaim && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-outfit font-black text-lg text-ink">
              Reclaim Unused Passes from {selectedAgentForReclaim.name}
            </h3>
            <p className="text-xs text-stone-500">
              Reclaim unallocated and unsold quota back to central pool. Booked or sub-allocated passes cannot be reclaimed.
            </p>

            <form onSubmit={handleReclaim} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Pass Category</label>
                <select
                  value={reclaimPassType}
                  onChange={(e) => setReclaimPassType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                >
                  {PASS_TYPES.map((pt) => {
                    const alloc = selectedAgentForReclaim.allocations?.find((a: any) => a.passType === pt.code);
                    const avail = alloc?.availableQuantity || 0;
                    return (
                      <option key={pt.code} value={pt.code}>
                        {pt.name} ({avail} unused available)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Quantity to Reclaim</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={reclaimQuantity}
                  onChange={(e) => setReclaimQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Reason / Notes (Optional)</label>
                <input
                  type="text"
                  value={reclaimNotes}
                  onChange={(e) => setReclaimNotes(e.target.value)}
                  placeholder="e.g. Quota reallocation"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAgentForReclaim(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reclaiming}
                  className="px-5 py-2 rounded-xl bg-amber-700 text-white font-outfit font-bold text-xs hover:bg-amber-800 disabled:opacity-50"
                >
                  {reclaiming ? 'Reclaiming...' : 'Reclaim Passes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
