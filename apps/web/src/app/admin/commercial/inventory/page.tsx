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
      const res = await fetchApi('/admin/commercial/orders?limit=1');
      setData({
        totalPassesIssued: res?.summary?.totalPasses ?? 0,
        totalRevenue: res?.summary?.totalSalesInr ?? 0,
        paidOrdersCount: res?.summary?.totalOrders ?? res?.total ?? 0,
        activeAgentsCount: res?.summary?.agentOrdersCount ?? 0,
        breakdown: {
          COMMERCIAL_DAILY: res?.summary?.publicPassesCount ?? 0,
          COMMERCIAL_SEASON: res?.summary?.agentPassesCount ?? 0,
          COMMERCIAL_MANDLI: res?.summary?.freePassesCount ?? 0,
          COMMERCIAL_ANY_DAY: 0,
        },
      });
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
    <div className="space-y-3.5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-maroon" />
            <h1 className="text-xl font-bold font-outfit text-ink">E-Pass Inventory &amp; Quotas</h1>
          </div>
          <p className="text-xs text-ink-soft mt-0.5">
            Real-time commercial quota balances, total allocations, and direct sales inventory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadInventory}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-stone-200 text-ink hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/admin/commercial/agents"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-maroon text-white hover:bg-maroon-dark transition-colors shadow-2xs"
          >
            <Shield className="w-3.5 h-3.5" />
            Manage Agent Quotas
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="bg-white py-2 px-3 rounded-xl border border-stone-200/80 shadow-2xs flex items-center justify-between min-h-[55px]">
          <div>
            <span className="text-[10px] font-bold text-ink-soft uppercase tracking-wider block">Commercial Passes</span>
            <span className="text-[10px] text-stone-400">Direct sales &amp; agents</span>
          </div>
          <span className="font-outfit font-black text-xl text-ink leading-none text-right ml-2">
            {loading ? '...' : (data?.totalPassesIssued ?? 0).toLocaleString()}
          </span>
        </div>

        <div className="bg-emerald-50/40 py-2 px-3 rounded-xl border border-emerald-200/60 shadow-2xs flex items-center justify-between min-h-[55px]">
          <div>
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Revenue</span>
            <span className="text-[10px] text-emerald-600">Paid orders</span>
          </div>
          <span className="font-outfit font-black text-xl text-emerald-700 leading-none text-right ml-2">
            ₹{loading ? '...' : (data?.totalRevenue ?? 0).toLocaleString('en-IN')}
          </span>
        </div>

        <div className="bg-white py-2 px-3 rounded-xl border border-stone-200/80 shadow-2xs flex items-center justify-between min-h-[55px]">
          <div>
            <span className="text-[10px] font-bold text-ink-soft uppercase tracking-wider block">Paid Orders</span>
            <span className="text-[10px] text-stone-400">Confirmed bookings</span>
          </div>
          <span className="font-outfit font-black text-xl text-ink leading-none text-right ml-2">
            {loading ? '...' : (data?.paidOrdersCount ?? 0).toLocaleString()}
          </span>
        </div>

        <div className="bg-amber-50/40 py-2 px-3 rounded-xl border border-amber-200/60 shadow-2xs flex items-center justify-between min-h-[55px]">
          <div>
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Active Agents</span>
            <span className="text-[10px] text-amber-600">Distributors</span>
          </div>
          <span className="font-outfit font-black text-xl text-amber-800 leading-none text-right ml-2">
            {loading ? '...' : (data?.activeAgentsCount ?? 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Inventory Breakdown by Category */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
        <div className="py-2.5 px-3.5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-ink font-outfit">Pass Type Quota Allocation</h2>
            <p className="text-[11px] text-ink-soft">Inventory distribution configured for the commercial entry system</p>
          </div>
          <Link
            href="/admin/commercial/allocations"
            className="text-xs font-bold text-maroon hover:underline flex items-center gap-1"
          >
            Detailed Allocations <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="divide-y divide-stone-100 text-xs">
          {passTypes.map((pt) => {
            const count = data?.breakdown?.[pt.code] ?? 0;
            return (
              <div key={pt.code} className="py-2.5 px-3.5 flex items-center justify-between hover:bg-stone-50/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-maroon/10 text-maroon flex items-center justify-center font-bold shrink-0">
                    <Ticket className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-ink">{pt.name}</div>
                    <div className="text-[10px] text-ink-soft">{pt.desc} ({pt.code})</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-ink">{loading ? '...' : count.toLocaleString()}</div>
                  <div className="text-[10px] font-semibold text-emerald-600">Active Issued</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
