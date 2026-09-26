'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  DoorOpen,
  Users,
  AlertTriangle,
  RefreshCw,
  Award,
  ShieldCheck,
  CheckCheck,
} from 'lucide-react';
import { fetchApi, API_BASE_URL } from '@/lib/api';

export default function AdminDailyClosingPage() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Initialize with active event date from backend
  useEffect(() => {
    async function init() {
      try {
        const statusRes = await fetchApi('/event-control/status').catch(() => null);
        const date =
          statusRes?.activeDate ||
          new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        setSelectedDate(date);
      } catch {
        setSelectedDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
      }
    }
    init();
  }, []);

  const loadClosing = useCallback(async () => {
    if (!selectedDate) return;
    try {
      setLoading(true);
      const data = await fetchApi(`/admin/daily-closing?date=${selectedDate}`);
      setReport(data);
    } catch (e) {
      console.error('Failed to load daily closing report:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedDate) {
      loadClosing();
    }
  }, [selectedDate, loadClosing]);

  const handleExportCsv = () => {
    const dateParam = selectedDate ? `?date=${encodeURIComponent(selectedDate)}` : '';
    const exportUrl = `${API_BASE_URL}/admin/daily-closing/export${dateParam}`;
    window.open(exportUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header Actions & Date Picker */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200/80 card-shadow print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 uppercase">
              Daily Closing Reconciliation
            </span>
            <h2 className="font-outfit font-extrabold text-2xl text-ink mt-1 flex items-center gap-2">
              <CheckCheck className="w-6 h-6 text-maroon" />
              <span>Event Day Closing Report</span>
            </h2>
            <p className="text-xs text-ink-soft mt-0.5">
              Comprehensive audit of attendance, gate volumes, operator productivity, verification
              failures, and incident logs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                name="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-200 bg-cream-soft font-semibold text-ink focus:outline-maroon"
              />
              <button
                type="button"
                onClick={loadClosing}
                disabled={loading}
                className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-ink font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load Date'}
              </button>
            </div>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-4 py-2 rounded-xl bg-maroon hover:bg-maroon-dark text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            {/* Print Report */}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Print-Only Official Document Header */}
      <div className="hidden print:block p-6 border-b-2 border-stone-900 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-black uppercase tracking-wider font-outfit">
              ONGC NAVRATRI 2026
            </h1>
            <h2 className="text-base font-bold text-stone-700">DAILY OPERATIONAL CLOSING AUDIT REPORT</h2>
            <p className="text-xs text-stone-500 mt-1">
              Operational Date: <strong>{selectedDate}</strong> • Generated:{' '}
              {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono font-bold text-stone-700">STATUS: OFFICIAL RECONCILIATION</span>
          </div>
        </div>
      </div>

      {report && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-stone-200/80 card-shadow">
              <div className="text-[10px] font-bold tracking-wider uppercase text-ink-soft">
                Booked for Date
              </div>
              <div className="font-outfit font-extrabold text-2xl text-maroon mt-1">
                {report.bookedForDate?.toLocaleString() ?? 0}
              </div>
              <div className="text-[10px] text-stone-400 mt-0.5">Eligible passes</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-stone-200/80 card-shadow">
              <div className="text-[10px] font-bold tracking-wider uppercase text-emerald-800">
                Checked In
              </div>
              <div className="font-outfit font-extrabold text-2xl text-emerald-700 mt-1">
                {report.checkedInCount?.toLocaleString() ?? 0}
              </div>
              <div className="text-[10px] text-emerald-600 mt-0.5">Active arrivals</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-stone-200/80 card-shadow">
              <div className="text-[10px] font-bold tracking-wider uppercase text-amber-800">
                Pending Attendance
              </div>
              <div className="font-outfit font-extrabold text-2xl text-amber-700 mt-1">
                {report.pendingCount?.toLocaleString() ?? 0}
              </div>
              <div className="text-[10px] text-amber-600 mt-0.5">No-shows so far</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-stone-200/80 card-shadow">
              <div className="text-[10px] font-bold tracking-wider uppercase text-ink-soft">
                Attendance Rate
              </div>
              <div className="font-outfit font-extrabold text-2xl text-ink mt-1">
                {report.attendanceRate ?? 0}%
              </div>
              <div className="w-full bg-stone-100 rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className="bg-maroon h-1.5 rounded-full"
                  style={{ width: `${Math.min(100, report.attendanceRate ?? 0)}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-stone-200/80 card-shadow">
              <div className="text-[10px] font-bold tracking-wider uppercase text-ink-soft">
                Peak Inflow Hour
              </div>
              <div className="font-outfit font-extrabold text-xl text-ink mt-1 truncate">
                {report.peakHourFormatted || 'N/A'}
              </div>
              <div className="text-[10px] text-stone-400 mt-0.5">
                {report.peakHourCount?.toLocaleString() ?? 0} check-ins
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-stone-200/80 card-shadow">
              <div className="text-[10px] font-bold tracking-wider uppercase text-ink-soft">
                Incidents Logged
              </div>
              <div
                className={`font-outfit font-extrabold text-2xl mt-1 ${
                  report.incidentsOpen > 0 ? 'text-rose-600' : 'text-ink'
                }`}
              >
                {report.incidentsTotal ?? 0}
              </div>
              <div
                className={`text-[10px] mt-0.5 ${
                  report.incidentsOpen > 0 ? 'text-rose-600 font-bold' : 'text-stone-400'
                }`}
              >
                {report.incidentsOpen ?? 0} open &bull; {report.incidentsResolved ?? 0} resolved
              </div>
            </div>
          </div>

          {/* Check-in Audit Results Breakdown Grid */}
          <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow p-5 space-y-4">
            <div>
              <h3 className="font-outfit font-extrabold text-base text-ink">
                Check-In Verification Audit Summary
              </h3>
              <p className="text-xs text-ink-soft">
                Breakdown of legitimate admissions vs. anomalous or rejected scan attempts for{' '}
                {selectedDate}.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="text-[10px] font-bold text-emerald-800 uppercase">Approved</div>
                <div className="font-outfit font-extrabold text-xl text-emerald-900 mt-0.5">
                  {report.approvedCount?.toLocaleString() ?? 0}
                </div>
                <div className="text-[10px] text-emerald-700">Valid entries</div>
              </div>

              <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200">
                <div className="text-[10px] font-bold text-blue-800 uppercase">Manual Entry</div>
                <div className="font-outfit font-extrabold text-xl text-blue-900 mt-0.5">
                  {report.manualCount?.toLocaleString() ?? 0}
                </div>
                <div className="text-[10px] text-blue-700">Help desk overrides</div>
              </div>

              <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200">
                <div className="text-[10px] font-bold text-purple-800 uppercase">Voided / Reversed</div>
                <div className="font-outfit font-extrabold text-xl text-purple-900 mt-0.5">
                  {report.voidedCount?.toLocaleString() ?? 0}
                </div>
                <div className="text-[10px] text-purple-700">Admin corrections</div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                <div className="text-[10px] font-bold text-amber-800 uppercase">Duplicate Scans</div>
                <div className="font-outfit font-extrabold text-xl text-amber-900 mt-0.5">
                  {report.duplicateCount?.toLocaleString() ?? 0}
                </div>
                <div className="text-[10px] text-amber-700">Already entered</div>
              </div>

              <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200">
                <div className="text-[10px] font-bold text-stone-700 uppercase">Not Booked</div>
                <div className="font-outfit font-extrabold text-xl text-stone-900 mt-0.5">
                  {report.notBookedCount?.toLocaleString() ?? 0}
                </div>
                <div className="text-[10px] text-stone-500">Other date pass</div>
              </div>

              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                <div className="text-[10px] font-bold text-rose-800 uppercase">Unauthorized Gate</div>
                <div className="font-outfit font-extrabold text-xl text-rose-900 mt-0.5">
                  {report.unauthorizedGateCount?.toLocaleString() ?? 0}
                </div>
                <div className="text-[10px] text-rose-700">Staff misassignment</div>
              </div>

              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                <div className="text-[10px] font-bold text-rose-800 uppercase">Invalid Ticket</div>
                <div className="font-outfit font-extrabold text-xl text-rose-900 mt-0.5">
                  {report.invalidCount?.toLocaleString() ?? 0}
                </div>
                <div className="text-[10px] text-rose-700">Unknown code</div>
              </div>

              <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200">
                <div className="text-[10px] font-bold text-stone-700 uppercase">Lane / Cap Block</div>
                <div className="font-outfit font-extrabold text-xl text-stone-900 mt-0.5">
                  {((report.gateClosedCount ?? 0) + (report.capacityReachedCount ?? 0)).toLocaleString()}
                </div>
                <div className="text-[10px] text-stone-500">Closed / Full</div>
              </div>
            </div>
          </div>

          {/* Gate Volume Breakdown */}
          <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow overflow-hidden">
            <div className="p-5 border-b border-stone-100">
              <h3 className="font-outfit font-extrabold text-base text-ink">Gate Check-in Volumes</h3>
              <p className="text-xs text-ink-soft">Traffic distribution across all event entry lanes.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50/80 text-stone-600 font-bold border-b border-stone-200/70">
                    <th className="py-3.5 px-4">Gate</th>
                    <th className="py-3.5 px-3">Type</th>
                    <th className="py-3.5 px-3">Lane Status</th>
                    <th className="py-3.5 px-3">Entries Processed</th>
                    <th className="py-3.5 px-3">Capacity Limit</th>
                    <th className="py-3.5 px-4">Capacity Utilization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {report.gates && report.gates.length > 0 ? (
                    report.gates.map((item: any) => {
                      const g = item.gate;
                      return (
                        <tr key={g.id} className="hover:bg-cream/40 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-ink">
                            <div className="font-outfit text-sm text-maroon">{g.name}</div>
                            <span className="font-mono text-[10px] text-stone-500">{g.code}</span>
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-stone-700">{g.type}</td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                item.is_open
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-stone-100 text-stone-600'
                              }`}
                            >
                              {item.is_open ? 'OPEN' : 'CLOSED'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-sm text-emerald-700">
                            {item.count?.toLocaleString() ?? 0}
                          </td>
                          <td className="py-3.5 px-3 text-stone-600 font-mono">
                            {item.capacity ? item.capacity.toLocaleString() : 'Unlimited'}
                          </td>
                          <td className="py-3.5 px-4 min-w-[180px]">
                            {item.capacity > 0 ? (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[11px] font-semibold text-stone-600">
                                  <span>{item.percentage}%</span>
                                  <span
                                    className={`text-[10px] uppercase font-bold ${
                                      item.status_level === 'critical'
                                        ? 'text-rose-600'
                                        : item.status_level === 'warning'
                                        ? 'text-amber-600'
                                        : 'text-emerald-600'
                                    }`}
                                  >
                                    {item.status_level}
                                  </span>
                                </div>
                                <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      item.status_level === 'critical'
                                        ? 'bg-rose-500'
                                        : item.status_level === 'warning'
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${Math.min(100, item.percentage)}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-stone-400 italic">&mdash;</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-stone-400">
                        No gate records available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Staff Productivity Table */}
          <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow overflow-hidden">
            <div className="p-5 border-b border-stone-100">
              <h3 className="font-outfit font-extrabold text-base text-ink">
                Staff Productivity &amp; Operator Audit
              </h3>
              <p className="text-xs text-ink-soft">
                Scan volumes and timestamps recorded by operational personnel on this date.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50/80 text-stone-600 font-bold border-b border-stone-200/70">
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-3">Role</th>
                    <th className="py-3.5 px-3">Assigned Gates</th>
                    <th className="py-3.5 px-3">Check-ins Handled</th>
                    <th className="py-3.5 px-4 text-right">Last Recorded Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {report.staffMembers && report.staffMembers.length > 0 ? (
                    report.staffMembers.map((member: any) => {
                      const s = member.staff;
                      return (
                        <tr key={s.id} className="hover:bg-cream/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-outfit font-bold text-sm text-ink">{s.name}</div>
                            <div className="font-mono text-[10px] text-stone-500">
                              {s.email}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-stone-100 text-stone-700">
                              {s.role ? s.role.replace(/_/g, ' ') : 'STAFF'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-stone-700 font-medium">
                            {member.assigned_gates}
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-sm text-emerald-700">
                            {member.checkins_count?.toLocaleString() ?? 0}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-[11px] text-stone-500">
                            {member.last_activity_at
                              ? new Date(member.last_activity_at).toLocaleTimeString('en-IN', {
                                  timeZone: 'Asia/Kolkata',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                })
                              : 'No activity'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-stone-400">
                        No staff activity found for this date.
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
