'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Ticket,
  RefreshCw,
  Search,
  Shield,
  ArrowRight,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function CommercialAllocationsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchApi('/admin/commercial/agents?limit=100');
      setAgents(Array.isArray(res) ? res : res?.agents || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load agent allocations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredAgents = agents.filter((ag) => {
    const q = search.toLowerCase();
    return (
      ag.name?.toLowerCase().includes(q) ||
      ag.email?.toLowerCase().includes(q) ||
      ag.agentCode?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Ticket className="w-6 h-6 text-maroon" />
            <h1 className="text-2xl font-bold font-outfit text-ink">Agent Allocations & Quotas</h1>
          </div>
          <p className="text-sm text-ink-soft mt-1">
            Track authorized agent quota limits, sold counts, and available inventory.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-stone-200 text-ink hover:bg-stone-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/admin/commercial/agents"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-maroon text-white hover:bg-maroon-dark transition-colors shadow-xs"
          >
            <Shield className="w-3.5 h-3.5" />
            Manage Agents
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by agent name, email, or agent code..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm text-ink placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-maroon/20 focus:border-maroon"
        />
      </div>

      {/* Allocations Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <span className="text-xs font-bold text-ink-soft uppercase tracking-wider">
            {filteredAgents.length} Agents Registered
          </span>
          <Link
            href="/admin/commercial/inventory"
            className="text-xs font-bold text-maroon hover:underline flex items-center gap-1"
          >
            Global Inventory <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50/70 border-b border-stone-100 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3 text-right">Quota Allocated</th>
                <th className="px-5 py-3 text-right">Passes Sold</th>
                <th className="px-5 py-3 text-right">Available</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-ink-soft">
                    Loading allocations...
                  </td>
                </tr>
              ) : filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-ink-soft">
                    No agents match your search.
                  </td>
                </tr>
              ) : (
                filteredAgents.map((ag) => {
                  const allocated = ag.totalAllocatedQuota ?? ag.allocatedCount ?? 0;
                  const sold = ag.totalSold ?? ag.soldCount ?? 0;
                  const available = Math.max(0, allocated - sold);

                  return (
                    <tr key={ag.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-ink">{ag.name}</div>
                        <div className="text-xs text-ink-soft">{ag.email} &bull; {ag.agentCode || 'NO-CODE'}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 uppercase">
                          {ag.role === 'COMMERCIAL_SUB_AGENT' ? 'Sub Agent' : 'Master Agent'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-ink">
                        {allocated.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-emerald-700">
                        {sold.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-amber-700">
                        {available.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <Link
                          href={`/admin/commercial/agents?agentId=${ag.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-maroon hover:underline"
                        >
                          Manage <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
