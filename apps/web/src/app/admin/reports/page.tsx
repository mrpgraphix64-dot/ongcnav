'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  Clock,
  DoorOpen,
  CheckCircle2,
  Users,
  AlertTriangle,
  ShieldAlert,
  Filter,
  Check,
  X,
  Hash,
} from 'lucide-react';
import { fetchApi, API_BASE_URL } from '@/lib/api';

export default function AdminReportsPage() {
  const [report, setReport] = useState<any>(null);
  const [gates, setGates] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [gateFilter, setGateFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [eventDateFilter, setEventDateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (gateFilter && gateFilter !== 'all') params.set('gate', gateFilter);
      if (staffFilter && staffFilter !== 'all') params.set('staff_id', staffFilter);
      if (resultFilter && resultFilter !== 'all') params.set('result', resultFilter);
      if (eventDateFilter) params.set('event_date', eventDateFilter);
      if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const qs = params.toString();
      const data = await fetchApi(`/admin/reports${qs ? `?${qs}` : ''}`);

      if (data) {
        setReport(data);
        if (Array.isArray(data.gates)) setGates(data.gates);
        if (Array.isArray(data.staffList)) setStaffList(data.staffList);
      }
    } catch (e) {
      console.error('Failed to load reports:', e);
    } finally {
      setLoading(false);
    }
  }, [
    gateFilter,
    staffFilter,
    resultFilter,
    eventDateFilter,
    categoryFilter,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleResetFilters = () => {
    setGateFilter('');
    setStaffFilter('');
    setResultFilter('');
    setEventDateFilter('');
    setCategoryFilter('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const handleDownloadCsv = () => {
    const params = new URLSearchParams();
    if (gateFilter && gateFilter !== 'all') params.set('gate', gateFilter);
    if (staffFilter && staffFilter !== 'all') params.set('staff_id', staffFilter);
    if (resultFilter && resultFilter !== 'all') params.set('result', resultFilter);
    if (eventDateFilter) params.set('event_date', eventDateFilter);
    if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter);
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);

    const qs = params.toString();
    const downloadUrl = `${API_BASE_URL}/admin/reports/export${qs ? `?${qs}` : ''}`;
    window.open(downloadUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200/80 card-shadow print:hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 uppercase">
              Operations &amp; Security Analytics
            </span>
            <h2 className="font-outfit font-extrabold text-2xl text-ink mt-1 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-maroon" />
              <span>Event Analytics &amp; Reports</span>
            </h2>
            <p className="text-xs text-ink-soft mt-0.5">
              Aggregated check-in analytics, gate throughput metrics, and complete raw IST audit
              exports.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadReport}
              disabled={loading}
              title="Refresh"
              className="p-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-ink shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-maroon ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print View</span>
            </button>

            <button
              onClick={handleDownloadCsv}
              className="px-4 py-2.5 rounded-xl bg-maroon hover:bg-maroon-dark text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV Export</span>
            </button>
          </div>
        </div>

        {/* Filters Form */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-4 mt-4 border-t border-stone-100 text-xs">
          <select
            value={gateFilter}
            onChange={(e) => setGateFilter(e.target.value)}
            className="px-2.5 py-2 rounded-xl border border-stone-200 bg-cream-soft font-medium text-ink focus:outline-maroon"
          >
            <option value="">All Gates</option>
            {gates.map((g) => (
              <option key={g.id} value={g.name}>
                {g.name}
              </option>
            ))}
          </select>

          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="px-2.5 py-2 rounded-xl border border-stone-200 bg-cream-soft font-medium text-ink focus:outline-maroon"
          >
            <option value="">All Staff</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="px-2.5 py-2 rounded-xl border border-stone-200 bg-cream-soft font-medium text-ink focus:outline-maroon"
          >
            <option value="">All Results</option>
            <option value="approved">Approved</option>
            <option value="duplicate">Duplicate</option>
            <option value="invalid">Invalid</option>
            <option value="not_booked">Not Booked</option>
            <option value="unauthorized_gate">Wrong Gate</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-2 rounded-xl border border-stone-200 bg-cream-soft font-medium text-ink focus:outline-maroon"
          >
            <option value="">All Categories</option>
            <option value="VIP">VIP</option>
            <option value="FAMILY">Family</option>
            <option value="ONGC STAFF">ONGC Staff</option>
            <option value="General">General</option>
          </select>

          <input
            type="date"
            placeholder="Event Date"
            value={eventDateFilter}
            onChange={(e) => setEventDateFilter(e.target.value)}
            className="px-2 py-2 rounded-xl border border-stone-200 bg-cream-soft font-medium text-ink focus:outline-maroon"
          />

          <input
            type="date"
            placeholder="From"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2 py-2 rounded-xl border border-stone-200 bg-cream-soft font-medium text-ink focus:outline-maroon"
          />

          <input
            type="date"
            placeholder="To"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2 py-2 rounded-xl border border-stone-200 bg-cream-soft font-medium text-ink focus:outline-maroon"
          />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={loadReport}
              className="flex-1 py-2 px-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-ink font-bold transition text-center cursor-pointer shadow-xs"
            >
              Filter
            </button>
            {(gateFilter || staffFilter || resultFilter || eventDateFilter || categoryFilter || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="py-2 px-2 rounded-xl text-stone-500 hover:text-stone-800 font-bold transition cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {report && (
        <div className="space-y-6">
          {/* 4 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-stone-200/80 card-shadow">
              <span className="text-[10px] font-bold text-ink-soft uppercase tracking-wider block">
                Total Passes Registered
              </span>
              <div className="text-3xl font-black text-ink mt-1 font-outfit">
                {report.totalAttendees?.toLocaleString() ?? 0}
              </div>
              <span className="text-xs text-stone-400 font-medium mt-0.5 block">
                {report.pendingCount?.toLocaleString() ?? 0} pending arrival
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-stone-200/80 card-shadow">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                Successfully Checked In
              </span>
              <div className="text-3xl font-black text-emerald-700 mt-1 font-outfit">
                {report.checkedInCount?.toLocaleString() ?? 0}
              </div>
              <span className="text-xs text-emerald-600 font-medium mt-0.5 block">
                {report.checkInPct ?? 0}% overall turnout
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-stone-200/80 card-shadow">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                Duplicate Attempts Blocked
              </span>
              <div className="text-3xl font-black text-amber-700 mt-1 font-outfit">
                {report.duplicateAttempts?.toLocaleString() ?? 0}
              </div>
              <span className="text-xs text-amber-600 font-medium mt-0.5 block">
                Prevented entry re-use
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-stone-200/80 card-shadow">
              <span className="text-[10px] font-bold text-ink-soft uppercase tracking-wider block">
                Active Gates Monitored
              </span>
              <div className="text-3xl font-black text-maroon mt-1 font-outfit">
                {report.gatePerformance?.length ?? 0}
              </div>
              <span className="text-xs text-stone-400 font-medium mt-0.5 block">
                Turnstiles in perimeter
              </span>
            </div>
          </div>

          {/* Gate Performance Table */}
          <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow overflow-hidden">
            <div className="p-5 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="font-outfit font-extrabold text-base text-ink">Gate Throughput Breakdown</h3>
                <p className="text-xs text-ink-soft">Scan statistics across physical turnstile lanes.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50/80 text-stone-600 font-bold border-b border-stone-200/70">
                    <th className="py-3.5 px-4">Gate</th>
                    <th className="py-3.5 px-3">Type</th>
                    <th className="py-3.5 px-3">Total Scans</th>
                    <th className="py-3.5 px-3">Verified Entries</th>
                    <th className="py-3.5 px-3">Duplicates Blocked</th>
                    <th className="py-3.5 px-3">Invalid Attempts</th>
                    <th className="py-3.5 px-4 text-right">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {report.gatePerformance && report.gatePerformance.length > 0 ? (
                    report.gatePerformance.map((g: any, i: number) => (
                      <tr key={i} className="hover:bg-cream/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-ink">
                          <div className="font-outfit text-sm text-maroon">{g.name}</div>
                          <span className="font-mono text-[10px] text-stone-500">{g.code || '—'}</span>
                        </td>
                        <td className="py-3.5 px-3 text-stone-600">{g.type}</td>
                        <td className="py-3.5 px-3 font-mono font-bold text-ink">
                          {g.totalEntries?.toLocaleString() ?? 0}
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-emerald-700">
                          {g.checkedIn?.toLocaleString() ?? 0}
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-amber-700">
                          {g.duplicates?.toLocaleString() ?? 0}
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-rose-700">
                          {g.invalid?.toLocaleString() ?? 0}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-[11px] text-stone-500">
                          {g.lastActivity}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-stone-400">
                        No gate performance records available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Breakdown & QR Summary Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Distribution */}
            <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow p-5 space-y-4">
              <div>
                <h3 className="font-outfit font-extrabold text-base text-ink">Category Distribution</h3>
                <p className="text-xs text-ink-soft">Turnout rates by ticket credential type.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-100 text-stone-500 font-semibold">
                      <th className="pb-2">Category</th>
                      <th className="pb-2 text-center">Registered</th>
                      <th className="pb-2 text-center">Checked In</th>
                      <th className="pb-2 text-right">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {report.categoryBreakdown && report.categoryBreakdown.length > 0 ? (
                      report.categoryBreakdown.map((c: any, i: number) => (
                        <tr key={i} className="hover:bg-cream/40">
                          <td className="py-2.5 font-bold text-ink">{c.name}</td>
                          <td className="py-2.5 text-center font-mono">{c.registered}</td>
                          <td className="py-2.5 text-center font-mono font-bold text-emerald-700">
                            {c.checkedIn}
                          </td>
                          <td className="py-2.5 text-right font-mono font-bold text-maroon">
                            {c.pct}%
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-stone-400">
                          No category records.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* QR Verification Summary */}
            <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow p-5 space-y-4">
              <div>
                <h3 className="font-outfit font-extrabold text-base text-ink">QR Verification Telemetry</h3>
                <p className="text-xs text-ink-soft">Real-time cryptographic scanner evaluation results.</p>
              </div>

              {report.qrSummary && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200">
                    <span className="text-[10px] text-stone-500 uppercase font-bold">QR Codes Generated</span>
                    <div className="text-xl font-bold font-mono text-ink mt-0.5">
                      {report.qrSummary.generated}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 uppercase font-bold">Successfully Verified</span>
                    <div className="text-xl font-bold font-mono text-emerald-900 mt-0.5">
                      {report.qrSummary.verified}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                    <span className="text-[10px] text-amber-800 uppercase font-bold">Already Checked In</span>
                    <div className="text-xl font-bold font-mono text-amber-900 mt-0.5">
                      {report.qrSummary.alreadyCheckedIn}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                    <span className="text-[10px] text-rose-800 uppercase font-bold">Invalid / Tampered</span>
                    <div className="text-xl font-bold font-mono text-rose-900 mt-0.5">
                      {report.qrSummary.invalid}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Scan History */}
          <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow overflow-hidden">
            <div className="p-5 border-b border-stone-100">
              <h3 className="font-outfit font-extrabold text-base text-ink">Recent Verification Activity</h3>
              <p className="text-xs text-ink-soft">Latest turnstile verification attempts and status results.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50/80 text-stone-600 font-bold border-b border-stone-200/70">
                    <th className="py-3.5 px-4">Date &amp; Time (IST)</th>
                    <th className="py-3.5 px-3">Attendee</th>
                    <th className="py-3.5 px-3">Ticket ID</th>
                    <th className="py-3.5 px-3">Gate</th>
                    <th className="py-3.5 px-3">Operator</th>
                    <th className="py-3.5 px-3">Category</th>
                    <th className="py-3.5 px-4 text-right">Verification Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {report.recentActivity && report.recentActivity.length > 0 ? (
                    report.recentActivity.map((log: any, i: number) => (
                      <tr key={i} className="hover:bg-cream/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-stone-500">
                          {log.date} &bull; {log.time}
                        </td>
                        <td className="py-3.5 px-3 font-bold text-ink">{log.name}</td>
                        <td className="py-3.5 px-3 font-mono text-maroon font-bold">{log.ticket_id}</td>
                        <td className="py-3.5 px-3 text-stone-700">{log.gate}</td>
                        <td className="py-3.5 px-3 text-stone-600">{log.staff}</td>
                        <td className="py-3.5 px-3">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-stone-100 text-stone-700">
                            {log.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              log.result === 'approved' || log.result === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.result === 'duplicate'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {log.result}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-stone-400">
                        No recent activity recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
