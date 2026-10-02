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
    <div className="space-y-3.5">
      {/* Header Actions & Date Picker */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-stone-200/80 card-shadow print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 uppercase">
              Daily Closing Reconciliation
            </span>
            <h2 className="font-outfit font-extrabold text-xl text-ink mt-0.5 flex items-center gap-2">
              <CheckCheck className="w-5 h-5 text-maroon" />
              <span>Event Day Closing Report</span>
            </h2>
            <p className="text-[11px] text-ink-soft">
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
                className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-cream-soft font-semibold text-ink text-xs focus:outline-maroon"
              />
              <button
                type="button"
                onClick={loadClosing}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-ink text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load Date'}
              </button>
            </div>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-xl bg-maroon hover:bg-maroon-dark text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            {/* Print Report */}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Print-Only Official Document Header */}
      <div className="hidden print:block p-4 border-b-2 border-stone-900 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-black uppercase tracking-wider font-outfit">
              ONGC NAVRATRI 2026
            </h1>
            <h2 className="text-sm font-bold text-stone-700">DAILY OPERATIONAL CLOSING AUDIT REPORT</h2>
            <p className="text-xs text-stone-500 mt-0.5">
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
        <div className="space-y-3.5">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <div className="bg-white py-2 px-3 rounded-xl border border-stone-200/80 shadow-2xs flex items-center justify-between min-h-[55px]">
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-ink-soft block">
                  Booked for Date
                </span>
                <span className="text-[10px] text-stone-400">Eligible passes</span>
              </div>
              <span className="font-outfit font-black text-xl text-maroon leading-none text-right ml-2">
                {report.bookedForDate?.toLocaleString() ?? 0}
              </span>
            </div>

            <div className="bg-emerald-50/40 py-2 px-3 rounded-xl border border-emerald-200/60 shadow-2xs flex items-center justify-between min-h-[55px]">
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-800 block">
                  Checked In
                </span>
                <span className="text-[10px] text-emerald-600">Active arrivals</span>
              </div>
              <span className="font-outfit font-black text-xl text-emerald-700 leading-none text-right ml-2">
                {report.checkedInCount?.toLocaleString() ?? 0}
              </span>
            </div>

            <div className="bg-amber-50/40 py-2 px-3 rounded-xl border border-amber-200/60 shadow-2xs flex items-center justify-between min-h-[55px]">
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-amber-800 block">
                  Pending
                </span>
                <span className="text-[10px] text-amber-600">No-shows so far</span>
              </div>
              <span className="font-outfit font-black text-xl text-amber-700 leading-none text-right ml-2">
                {report.pendingCount?.toLocaleString() ?? 0}
              </span>
            </div>

            <div className="bg-white py-2 px-3 rounded-xl border border-stone-200/80 shadow-2xs flex items-center justify-between min-h-[55px]">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] font-bold tracking-wider uppercase text-ink-soft block">
                  Attendance Rate
                </span>
                <div className="w-16 bg-stone-100 rounded-full h-1.5 mt-1 overflow-hidden">
                  <div
                    className="bg-maroon h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, report.attendanceRate ?? 0)}%` }}
                  />
                </div>
              </div>
              <span className="font-outfit font-black text-xl text-ink leading-none text-right shrink-0">
                {report.attendanceRate ?? 0}%
              </span>
            </div>

            <div className="bg-white py-2 px-3 rounded-xl border border-stone-200/80 shadow-2xs flex items-center justify-between min-h-[55px]">
              <div className="min-w-0">
                <span className="text-[10px] font-bold tracking-wider uppercase text-ink-soft block">
                  Peak Inflow
                </span>
                <span className="text-[10px] text-stone-400 truncate block">
                  {report.peakHourCount?.toLocaleString() ?? 0} arrivals
                </span>
              </div>
              <span className="font-outfit font-black text-sm text-ink leading-tight text-right ml-2 shrink-0 truncate max-w-[110px]">
                {report.peakHourFormatted || 'N/A'}
              </span>
            </div>

            <div className="bg-white py-2 px-3 rounded-xl border border-stone-200/80 shadow-2xs flex items-center justify-between min-h-[55px]">
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-ink-soft block">
                  Incidents
                </span>
                <span
                  className={`text-[10px] ${
                    report.incidentsOpen > 0 ? 'text-rose-600 font-bold' : 'text-stone-400'
                  }`}
                >
                  {report.incidentsOpen ?? 0} open &bull; {report.incidentsResolved ?? 0} res
                </span>
              </div>
              <span
                className={`font-outfit font-black text-xl leading-none text-right ml-2 ${
                  report.incidentsOpen > 0 ? 'text-rose-600' : 'text-ink'
                }`}
              >
                {report.incidentsTotal ?? 0}
              </span>
            </div>
          </div>

          {/* Check-in Audit Results Breakdown Grid */}
          <div className="bg-white rounded-2xl border border-stone-200/80 card-shadow p-3.5 space-y-2.5">
            <div>
              <h3 className="font-outfit font-extrabold text-sm text-ink">
                Check-In Verification Audit Summary
              </h3>
              <p className="text-[11px] text-ink-soft">
                Breakdown of legitimate admissions vs. anomalous or rejected scan attempts for{' '}
                {selectedDate}.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
              <div className="py-2 px-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between min-h-[48px]">
                <div>
                  <div className="text-[10px] font-bold text-emerald-800 uppercase">Approved</div>
                  <div className="text-[9px] text-emerald-700">Valid entries</div>
                </div>
                <div className="font-outfit font-black text-base text-emerald-900 ml-1.5">
                  {report.approvedCount?.toLocaleString() ?? 0}
                </div>
              </div>

              <div className="py-2 px-2.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between min-h-[48px]">
                <div>
                  <div className="text-[10px] font-bold text-blue-800 uppercase">Manual Entry</div>
                  <div className="text-[9px] text-blue-700">Helpdesk overrides</div>
                </div>
                <div className="font-outfit font-black text-base text-blue-900 ml-1.5">
                  {report.manualCount?.toLocaleString() ?? 0}
                </div>
              </div>

              <div className="py-2 px-2.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between min-h-[48px]">
                <div>
                  <div className="text-[10px] font-bold text-purple-800 uppercase">Voided / Rev</div>
                  <div className="text-[9px] text-purple-700">Admin fixes</div>
                </div>
                <div className="font-outfit font-black text-base text-purple-900 ml-1.5">
                  {report.voidedCount?.toLocaleString() ?? 0}
                </div>
              </div>

              <div className="py-2 px-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between min-h-[48px]">
                <div>
                  <div className="text-[10px] font-bold text-amber-800 uppercase">Duplicate</div>
                  <div className="text-[9px] text-amber-700">Already in</div>
                </div>
                <div className="font-outfit font-black text-base text-amber-900 ml-1.5">
                  {report.duplicateCount?.toLocaleString() ?? 0}
                </div>
              </div>

              <div className="py-2 px-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between min-h-[48px]">
                <div>
                  <div className="text-[10px] font-bold text-stone-700 uppercase">Not Booked</div>
                  <div className="text-[9px] text-stone-500">Other date</div>
                </div>
                <div className="font-outfit font-black text-base text-stone-900 ml-1.5">
                  {report.notBookedCount?.toLocaleString() ?? 0}
                </div>
              </div>

              <div className="py-2 px-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between min-h-[48px]">
                <div>
                  <div className="text-[10px] font-bold text-rose-800 uppercase">Wrong Gate</div>
                  <div className="text-[9px] text-rose-700">Misassigned</div>
                </div>
                <div className="font-outfit font-black text-base text-rose-900 ml-1.5">
                  {report.unauthorizedGateCount?.toLocaleString() ?? 0}
                </div>
              </div>

              <div className="py-2 px-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between min-h-[48px]">
                <div>
                  <div className="text-[10px] font-bold text-rose-800 uppercase">Invalid Pass</div>
                  <div className="text-[9px] text-rose-700">Unknown QR</div>
                </div>
                <div className="font-outfit font-black text-base text-rose-900 ml-1.5">
                  {report.invalidCount?.toLocaleString() ?? 0}
                </div>
              </div>

              <div className="py-2 px-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between min-h-[48px]">
                <div>
                  <div className="text-[10px] font-bold text-stone-700 uppercase">Lane / Cap</div>
                  <div className="text-[9px] text-stone-500">Closed / Full</div>
                </div>
                <div className="font-outfit font-black text-base text-stone-900 ml-1.5">
                  {((report.gateClosedCount ?? 0) + (report.capacityReachedCount ?? 0)).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Gate Volume Breakdown */}
          <div className="bg-white rounded-2xl border border-stone-200/80 card-shadow overflow-hidden">
            <div className="py-2.5 px-3.5 border-b border-stone-100">
              <h3 className="font-outfit font-extrabold text-sm text-ink">Gate Check-in Volumes</h3>
              <p className="text-[11px] text-ink-soft">Traffic distribution across all event entry lanes.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50/80 text-stone-600 font-bold border-b border-stone-200/70">
                    <th className="py-2 px-3">Gate</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Lane Status</th>
                    <th className="py-2 px-3">Entries Processed</th>
                    <th className="py-2 px-3">Capacity Limit</th>
                    <th className="py-2 px-3">Capacity Utilization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {report.gates && report.gates.length > 0 ? (
                    report.gates.map((item: any) => {
                      const g = item.gate;
                      return (
                        <tr key={g.id} className="hover:bg-cream/40 transition-colors">
                          <td className="py-2 px-3 font-bold text-ink">
                            <div className="font-outfit text-xs text-maroon">{g.name}</div>
                            <span className="font-mono text-[9px] text-stone-500">{g.code}</span>
                          </td>
                          <td className="py-2 px-3 font-semibold text-stone-700 text-xs">{g.type}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                item.is_open
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-stone-100 text-stone-600'
                              }`}
                            >
                              {item.is_open ? 'OPEN' : 'CLOSED'}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-xs text-emerald-700">
                            {item.count?.toLocaleString() ?? 0}
                          </td>
                          <td className="py-2 px-3 text-stone-600 font-mono text-xs">
                            {item.capacity ? item.capacity.toLocaleString() : 'Unlimited'}
                          </td>
                          <td className="py-2 px-3 min-w-[150px]">
                            {item.capacity > 0 ? (
                              <div className="space-y-0.5">
                                <div className="flex justify-between text-[10px] font-semibold text-stone-600">
                                  <span>{item.percentage}%</span>
                                  <span
                                    className={`text-[9px] uppercase font-bold ${
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
                              <span className="text-[10px] text-stone-400 italic">&mdash;</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-stone-400">
                        No gate records available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Staff Productivity Table */}
          <div className="bg-white rounded-2xl border border-stone-200/80 card-shadow overflow-hidden">
            <div className="py-2.5 px-3.5 border-b border-stone-100">
              <h3 className="font-outfit font-extrabold text-sm text-ink">
                Staff Productivity &amp; Operator Audit
              </h3>
              <p className="text-[11px] text-ink-soft">
                Scan volumes and timestamps recorded by operational personnel on this date.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50/80 text-stone-600 font-bold border-b border-stone-200/70">
                    <th className="py-2 px-3">Staff Member</th>
                    <th className="py-2 px-3">Role</th>
                    <th className="py-2 px-3">Assigned Gates</th>
                    <th className="py-2 px-3">Check-ins Handled</th>
                    <th className="py-2 px-3 text-right">Last Recorded Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {report.staffMembers && report.staffMembers.length > 0 ? (
                    report.staffMembers.map((member: any) => {
                      const s = member.staff;
                      return (
                        <tr key={s.id} className="hover:bg-cream/40 transition-colors">
                          <td className="py-2 px-3">
                            <div className="font-outfit font-bold text-xs text-ink">{s.name}</div>
                            <div className="font-mono text-[9px] text-stone-500">
                              {s.email}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-stone-100 text-stone-700">
                              {s.role ? s.role.replace(/_/g, ' ') : 'STAFF'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-stone-700 font-medium text-xs">
                            {member.assigned_gates}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-xs text-emerald-700">
                            {member.checkins_count?.toLocaleString() ?? 0}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[10px] text-stone-500">
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
