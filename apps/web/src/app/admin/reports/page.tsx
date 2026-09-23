'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  RefreshCw,
  Clock,
  DoorOpen,
  CheckCircle2,
} from 'lucide-react';
import { fetchApi, API_BASE_URL } from '@/lib/api';

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

export default function AdminReportsPage() {
  const [selectedDate, setSelectedDate] = useState('2026-09-23');
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    try {
      setLoading(true);
      const data = await fetchApi(`/admin/reports/summary?date=${selectedDate}`);
      setSummary(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedDate]);

  const handleDownloadCsv = () => {
    const downloadUrl = `${API_BASE_URL}/admin/reports/export/checkins?date=${selectedDate}`;
    window.open(downloadUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-red-500" />
            Event Analytics & CSV Reports
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated check-in numbers, gate distributions, and complete raw IST audit exports.
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
            onClick={handleDownloadCsv}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV Export</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Total Check-ins ({selectedDate})
          </span>
          <div className="text-3xl font-black text-white mt-2">
            {summary?.todayTotalCheckins ?? 0}
          </div>
          <span className="text-xs text-emerald-400 font-semibold mt-1 block">
            Unique Verified Passes
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Peak Entry Window
          </span>
          <div className="text-3xl font-black text-amber-400 mt-2">
            {summary?.peakHour ?? 'N/A'}
          </div>
          <span className="text-xs text-slate-400 font-medium mt-1 block">
            Max Surge: {summary?.peakHourCount ?? 0} scans
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Total Registered Passes
          </span>
          <div className="text-3xl font-black text-white mt-2">
            {summary?.totalRegisteredPasses ?? 0}
          </div>
          <span className="text-xs text-slate-400 font-medium mt-1 block">
            Across All Festival Nights
          </span>
        </div>
      </div>

      {/* Gate Breakdown */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="font-extrabold text-base text-white flex items-center gap-2">
          <DoorOpen className="w-5 h-5 text-red-500" />
          Gate Scans Breakdown
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {summary?.gateBreakdown?.map((gb: any) => (
            <div
              key={gb.gateId}
              className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-bold text-white block">{gb.gateName}</span>
                <span className="text-[11px] text-slate-400 font-mono">ID: {gb.gateId}</span>
              </div>
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {gb.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
