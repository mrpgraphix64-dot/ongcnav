'use client';

import { useState, useEffect } from 'react';
import {
  CheckCheck,
  Calendar,
  Printer,
  ShieldCheck,
  Users,
  Award,
  Clock,
  DoorOpen,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

const FESTIVAL_DATES = [
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
  '2026-09-27',
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
];

export default function AdminDailyClosingPage() {
  const [selectedDate, setSelectedDate] = useState('2026-09-23');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadClosing = async () => {
    try {
      setLoading(true);
      const data = await fetchApi(`/admin/reports/daily-closing?date=${selectedDate}`);
      setReport(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClosing();
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <CheckCheck className="w-6 h-6 text-emerald-400" />
            Official Daily Closing Audit
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            End-of-day operational closure, staff performance audit, and verified entry totals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white text-xs font-semibold rounded-xl px-3 py-2"
          >
            {FESTIVAL_DATES.map((d, i) => (
              <option key={d} value={d}>
                Night {i + 1} ({d})
              </option>
            ))}
          </select>

          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Main Closing Document Card */}
      {report && (
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 print:border-black print:bg-white print:text-black">
          {/* Header */}
          <div className="flex items-start justify-between pb-6 border-b border-slate-800 print:border-gray-300">
            <div>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">
                ONGC Cultural Committee • Navratri Mahotsav 2026
              </span>
              <h3 className="text-2xl font-black text-white mt-1 print:text-black">
                DAILY EVENT CLOSING AUDIT REPORT
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 print:text-black">
                Event Date: <strong className="text-white print:text-black">{report.closingDate}</strong> • Timezone: {report.timezone}
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-emerald-400 font-bold block">
                VERIFIED CLOSED
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {new Date(report.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </span>
            </div>
          </div>

          {/* Metrics Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 print:bg-gray-50 print:border-gray-300">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Check-ins</span>
              <div className="text-2xl font-black text-white mt-1 print:text-black">
                {report.metrics.totalCheckins}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 print:bg-gray-50 print:border-gray-300">
              <span className="text-[10px] uppercase font-bold text-slate-400">Peak Hour Surge</span>
              <div className="text-2xl font-black text-amber-400 mt-1 print:text-black">
                {report.metrics.peakHourVolume} scans
              </div>
              <span className="text-[10px] text-slate-500 block">At {report.metrics.peakHour}</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 print:bg-gray-50 print:border-gray-300">
              <span className="text-[10px] uppercase font-bold text-slate-400">Voided Scans</span>
              <div className="text-2xl font-black text-rose-400 mt-1 print:text-black">
                {report.metrics.voidedCheckins}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 print:bg-gray-50 print:border-gray-300">
              <span className="text-[10px] uppercase font-bold text-slate-400">Active Incidents</span>
              <div className="text-2xl font-black text-emerald-400 mt-1 print:text-black">
                {report.metrics.activeIncidents}
              </div>
            </div>
          </div>

          {/* Staff Performance Breakdown */}
          <div className="space-y-3 pt-4">
            <h4 className="font-extrabold text-sm text-white flex items-center gap-2 print:text-black">
              <Award className="w-4 h-4 text-amber-400" />
              Turnstile Staff Performance & Operator Logs
            </h4>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 print:border-gray-300">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 uppercase text-[10px] text-slate-400 font-bold print:bg-gray-100 print:text-black">
                  <tr>
                    <th className="px-4 py-3">Operator Name</th>
                    <th className="px-4 py-3">Staff ID</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 text-right">Successful Scans</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-gray-200">
                  {report.staffPerformance.map((sp: any) => (
                    <tr key={sp.userId}>
                      <td className="px-4 py-3 font-bold text-white print:text-black">
                        {sp.staffName}
                      </td>
                      <td className="px-4 py-3 font-mono text-amber-400 print:text-black">
                        {sp.staffId}
                      </td>
                      <td className="px-4 py-3 text-slate-400 print:text-black">
                        {sp.role}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400 print:text-black">
                        {sp.scanCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures for Print */}
          <div className="hidden print:grid grid-cols-3 gap-8 pt-16 text-center text-xs">
            <div className="border-t border-black pt-2">
              <strong>Gate Supervisor</strong>
            </div>
            <div className="border-t border-black pt-2">
              <strong>Chief Security Officer</strong>
            </div>
            <div className="border-t border-black pt-2">
              <strong>Cultural Committee Head</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
