'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  DoorOpen,
  Radio,
  Clock,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [gates, setGates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumData, gatesData] = await Promise.all([
        fetchApi('/admin/reports/summary'),
        fetchApi('/admin/gates'),
      ]);
      setSummary(sumData);
      setGates(gatesData || []);
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Live Event Command Center</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time entry monitoring for event date:{' '}
            <span className="text-amber-400 font-bold">{summary?.targetDate || 'Active Night'}</span>
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Today's Entries
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-white">
            {summary?.todayTotalCheckins ?? 0}
          </div>
          <span className="text-[11px] text-emerald-400 font-semibold mt-1 block">
            100% Unique Verified Scans
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Peak Hourly Surge
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-amber-400">
            {summary?.peakHourCount ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 font-medium mt-1 block">
            Peak Window: {summary?.peakHour ?? 'N/A'}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Passes Issued
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-500/40 text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-white">
            {summary?.totalRegisteredPasses ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 font-medium mt-1 block">
            {summary?.totalRegisteredEmployees ?? 0} Employees + {summary?.totalRegisteredFamilyMembers ?? 0} Family
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Incidents
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-950/60 border border-red-500/40 text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-red-400">
            {summary?.activeIncidents ?? 0}
          </div>
          <Link
            href="/admin/incidents"
            className="text-[11px] text-red-400 hover:underline font-semibold mt-1 block"
          >
            View Incident Logs →
          </Link>
        </div>
      </div>

      {/* Live Gate Status Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
            <DoorOpen className="w-5 h-5 text-red-500" />
            Gate Turnstile Status
          </h3>
          <Link
            href="/admin/gates"
            className="text-xs text-amber-400 hover:underline font-semibold"
          >
            Manage Gates →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {gates.map((gate) => (
            <div
              key={gate.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-400">
                    GATE #{gate.gateNumber}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {gate.isOpen ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                        OPEN
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-red-950/80 border border-red-500/40 text-red-300 text-[10px] font-bold">
                        CLOSED
                      </span>
                    )}
                    {gate.isScanningPaused && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                        PAUSED
                      </span>
                    )}
                  </div>
                </div>

                <h4 className="font-bold text-base text-white mt-1">
                  {gate.name}
                </h4>
                <span className="text-xs text-slate-400 font-medium">
                  Type: {gate.gateType}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Today's Scans:</span>
                <span className="font-bold font-mono text-emerald-400 text-sm">
                  {summary?.gateBreakdown?.find((g: any) => g.gateId === gate.id)?.count || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hourly Entry Chart */}
      {summary?.hourlyDistribution && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Hourly Entry Distribution (IST Asia/Kolkata)
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Event Evening: 17:00 – 23:00
            </span>
          </div>

          <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-24 gap-1 items-end h-32 pt-4">
            {summary.hourlyDistribution.map((h: any) => {
              const maxVal = Math.max(...summary.hourlyDistribution.map((i: any) => i.count), 1);
              const heightPct = (h.count / maxVal) * 100;
              return (
                <div key={h.hour} className="flex flex-col items-center gap-1 group relative h-full justify-end">
                  <div
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                    className={`w-full rounded-t transition-all ${
                      h.count > 0 ? 'bg-gradient-to-t from-red-600 to-amber-500' : 'bg-slate-800'
                    }`}
                  />
                  <span className="text-[9px] font-mono text-slate-500 -rotate-90 sm:rotate-0 mt-1">
                    {h.hour.slice(0, 2)}
                  </span>
                  {h.count > 0 && (
                    <div className="absolute -top-7 hidden group-hover:block bg-black px-2 py-0.5 rounded text-[10px] text-white z-10 font-mono">
                      {h.count}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
