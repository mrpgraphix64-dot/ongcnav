'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  RefreshCw,
  Ticket,
  TrendingUp,
  AlertCircle,
  Shield,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function CommercialInventoryPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInventory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchApi('/commercial/admin/summary');
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const passTypes = [
    { code: 'COMMERCIAL_DAILY', name: 'Daily Pass', desc: 'Single-day access tickets' },
    { code: 'COMMERCIAL_SEASON', name: 'Season Pass', desc: 'Full event duration access' },
    { code: 'COMMERCIAL_MANDLI', name: 'Mandli Pass', desc: 'Group & troupe passes' },
    { code: 'COMMERCIAL_ANY_DAY', name: 'Any Day Pass', desc: 'Flexible single-day entry' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-maroon" />
            <h1 className="text-2xl font-bold font-outfit text-ink">E-Pass Inventory & Quotas</h1>
          </div>
          <p className="text-sm text-ink-soft mt-1">
            Real-time commercial quota balances, total allocations, and direct sales inventory.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadInventory}
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
            Manage Agent Quotas
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-soft uppercase tracking-wider">Total Commercial Passes</span>
            <Ticket className="w-4 h-4 text-maroon" />
          </div>
          <div className="text-2xl font-black font-outfit text-ink mt-2">
            {loading ? '...' : (data?.totalPassesIssued ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-ink-soft mt-1">Issued across direct sales & agents</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-soft uppercase tracking-wider">Commercial Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black font-outfit text-emerald-700 mt-2">
            ₹{loading ? '...' : (data?.totalRevenue ?? 0).toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-ink-soft mt-1">From confirmed paid orders</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-soft uppercase tracking-wider">Paid Orders</span>
            <CheckCircle2 className="w-4 h-4 text-maroon" />
          </div>
          <div className="text-2xl font-black font-outfit text-ink mt-2">
            {loading ? '...' : (data?.paidOrdersCount ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-ink-soft mt-1">Confirmed commercial bookings</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-soft uppercase tracking-wider">Active Agents</span>
            <Shield className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black font-outfit text-ink mt-2">
            {loading ? '...' : (data?.activeAgentsCount ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-ink-soft mt-1">Authorized distributors</div>
        </div>
      </div>

      {/* Inventory Breakdown by Category */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-ink font-outfit">Pass Type Quota Allocation</h2>
            <p className="text-xs text-ink-soft">Inventory distribution configured for the commercial entry system</p>
          </div>
          <Link
            href="/admin/commercial/allocations"
            className="text-xs font-bold text-maroon hover:underline flex items-center gap-1"
          >
            Detailed Allocations <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-stone-100">
          {passTypes.map((pt) => {
            const count = data?.breakdown?.[pt.code] ?? 0;
            return (
              <div key={pt.code} className="p-4 sm:p-5 flex items-center justify-between hover:bg-stone-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-maroon/10 text-maroon flex items-center justify-center font-bold">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-ink">{pt.name}</div>
                    <div className="text-xs text-ink-soft">{pt.desc} ({pt.code})</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-ink">{loading ? '...' : count.toLocaleString()}</div>
                  <div className="text-[11px] font-semibold text-emerald-600">Active Issued</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
