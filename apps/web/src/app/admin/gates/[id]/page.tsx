'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ScanLine,
  Tag,
  MapPin,
  CheckCircle2,
  Copy,
  AlertTriangle,
  CalendarX,
  Users,
  History,
  Check,
  X,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface GateDetailData {
  gate: {
    id: string;
    name: string;
    code: string;
    gateNumber: string;
    type: string;
    gateType: string;
    location: string | null;
    description: string | null;
    status: 'active' | 'inactive';
    gateStatus: string;
    is_active: boolean;
    isOpen: boolean;
    isScanningPaused: boolean;
    capacityPerHour: number | null;
    totalCapacity: number | null;
    maximum_capacity: number | null;
    users: Array<{
      id: string;
      name: string;
      email: string;
      staff_id?: string | null;
      staffId?: string | null;
      role: string;
      isActive?: boolean;
    }>;
  };
  todaySuccessful: number;
  todayDuplicates: number;
  todayInvalid: number;
  todayNotBooked: number;
  recentLogs: Array<{
    id: string;
    created_at: string;
    scannedAt: string;
    ticket_id_scanned: string;
    ticketIdScanned: string;
    result: string;
    attendee: {
      id: string;
      name: string;
      mobile?: string | null;
      category?: string | null;
    } | null;
    staff: {
      id: string;
      name: string;
      staff_id?: string | null;
      role?: string;
    } | null;
  }>;
}

function formatISTTime(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export default function AdminGateDetailPage() {
  const params = useParams();
  const gateId = params.id as string;

  const [data, setData] = useState<GateDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!gateId) return;
    try {
      setLoading(true);
      const res = await fetchApi(`/admin/gates/${gateId}`);
      setData(res);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load gate telemetry');
    } finally {
      setLoading(false);
    }
  }, [gateId]);

  useEffect(() => {
    loadData();
    // Auto-refresh telemetry every 5 seconds
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-16">
        <RefreshCw className="w-8 h-8 text-maroon animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-ink">Gate Not Found</h3>
        <p className="text-xs text-ink-soft">{error}</p>
        <Link
          href="/admin/gates"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-maroon text-white text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Gates</span>
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const { gate, todaySuccessful, todayDuplicates, todayInvalid, todayNotBooked, recentLogs } = data;
  const isActive = gate.status === 'active' || gate.gateStatus === 'ACTIVE';

  return (
    <div className="space-y-6">
      {/* Top Gate Summary Banner */}
      <div className="bg-white rounded-2xl border border-stone-200/70 p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg bg-maroon text-gold-light text-sm font-black font-outfit uppercase tracking-wider">
              {gate.code || gate.gateNumber || 'GATE'}
            </span>
            <h2 className="font-outfit font-extrabold text-2xl text-ink">
              {gate.name}
            </h2>
            {isActive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Active
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-600 border border-stone-200">
                Inactive
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-ink-soft">
            <span className="inline-flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-gold" />
              <strong className="text-ink">{gate.type || 'General'} Entry</strong>
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-gold" />
              <span>{gate.location || 'No location specified'}</span>
            </span>
            {gate.description && (
              <>
                <span className="text-stone-300">•</span>
                <span>{gate.description}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/gates"
            className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-ink-soft hover:text-ink hover:bg-stone-50 transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Gates</span>
          </Link>

          <Link
            href={`/scanner?gate=${encodeURIComponent(gate.name)}&gateId=${gate.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-maroon text-white text-xs font-bold hover:bg-maroon-light transition-all shadow-sm"
          >
            <ScanLine className="w-4 h-4 text-gold-light" />
            <span>Open Scanner at this Gate</span>
          </Link>
        </div>
      </div>

      {/* Today's Gate Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Entries Allowed */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/70 shadow-sm">
          <div className="flex items-center justify-between text-ink-soft mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Entries Allowed
            </span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="font-outfit font-black text-3xl text-emerald-600">
            {todaySuccessful}
          </div>
          <div className="text-[11px] text-ink-soft mt-1">Confirmed check-ins today</div>
        </div>

        {/* Duplicate Scans */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/70 shadow-sm">
          <div className="flex items-center justify-between text-ink-soft mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Duplicate Scans
            </span>
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <Copy className="w-4 h-4" />
            </div>
          </div>
          <div className="font-outfit font-black text-3xl text-amber-600">
            {todayDuplicates}
          </div>
          <div className="text-[11px] text-ink-soft mt-1">Already checked-in attempts</div>
        </div>

        {/* Invalid QRs */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/70 shadow-sm">
          <div className="flex items-center justify-between text-ink-soft mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Invalid QRs
            </span>
            <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="font-outfit font-black text-3xl text-rose-600">
            {todayInvalid}
          </div>
          <div className="text-[11px] text-ink-soft mt-1">Unknown or forged passes</div>
        </div>

        {/* Not Booked Today */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/70 shadow-sm">
          <div className="flex items-center justify-between text-ink-soft mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Not Booked Today
            </span>
            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CalendarX className="w-4 h-4" />
            </div>
          </div>
          <div className="font-outfit font-black text-3xl text-indigo-600">
            {todayNotBooked}
          </div>
          <div className="text-[11px] text-ink-soft mt-1">Valid ticket, different day</div>
        </div>
      </div>

      {/* Assigned Staff Box */}
      <div className="bg-white rounded-2xl border border-stone-200/70 p-5 shadow-sm">
        <h3 className="font-outfit font-bold text-base text-ink mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-maroon" />
          <span>
            Authorized Operators Assigned to this Gate ({gate.users?.length || 0})
          </span>
        </h3>

        {gate.users && gate.users.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {gate.users.map((operator) => (
              <div
                key={operator.id}
                className="p-3 rounded-xl bg-cream-soft border border-stone-200/60 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-full bg-maroon text-white font-outfit font-bold text-xs flex items-center justify-center shrink-0">
                  {(operator.name || 'OP').substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-ink truncate">
                    {operator.name}
                  </div>
                  <div className="text-[10px] text-ink-soft truncate">
                    {operator.staff_id || operator.staffId || operator.email}
                  </div>
                  <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-stone-200 text-stone-700">
                    {operator.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-soft italic">
            No operators specifically assigned to this gate. Super Admins and Event
            Admins can still operate this gate.
          </p>
        )}
      </div>

      {/* Recent Gate Scans Activity Table */}
      <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-outfit font-bold text-base text-ink flex items-center gap-2">
            <History className="w-4 h-4 text-gold" />
            <span>Recent Check-In & Scan Activity</span>
          </h3>
          <span className="text-xs text-ink-soft font-semibold">
            Latest {recentLogs?.length || 0} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-cream-soft/80 border-b border-stone-200/70 text-ink-soft font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Time (IST)</th>
                <th className="px-5 py-3">Attendee</th>
                <th className="px-5 py-3">Ticket ID</th>
                <th className="px-5 py-3">Operator</th>
                <th className="px-5 py-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-ink">
              {recentLogs && recentLogs.length > 0 ? (
                recentLogs.map((log) => {
                  const res = log.result?.toUpperCase();
                  const isSuccess = res === 'APPROVED' || res === 'SUCCESS';
                  const isDuplicate =
                    res === 'DUPLICATE' || res === 'ALREADY_CHECKED_IN';
                  const isNotBooked =
                    res === 'NOT_BOOKED' || res === 'NOT_BOOKED_TODAY';
                  const isUnauthorizedGate =
                    res === 'UNAUTHORIZED_GATE' || res === 'WRONG_GATE';

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-cream-soft/30 transition-colors"
                    >
                      <td className="px-5 py-3 whitespace-nowrap text-ink-soft font-mono">
                        {formatISTTime(log.scannedAt || log.created_at)}
                      </td>
                      <td className="px-5 py-3 font-semibold">
                        {log.attendee?.name || 'Unrecognized Person'}
                        {log.attendee?.category && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-stone-100 text-stone-600">
                            {log.attendee.category}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono font-bold text-maroon">
                        {log.ticketIdScanned || log.ticket_id_scanned}
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        {log.staff?.name || 'System Operator'}
                      </td>
                      <td className="px-5 py-3">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                            <Check className="w-3 h-3" />
                            ENTRY ALLOWED
                          </span>
                        ) : isDuplicate ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900">
                            <Copy className="w-3 h-3" />
                            ALREADY CHECKED IN
                          </span>
                        ) : isNotBooked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-900">
                            <CalendarX className="w-3 h-3" />
                            NOT BOOKED TODAY
                          </span>
                        ) : isUnauthorizedGate ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-900">
                            <ShieldAlert className="w-3 h-3" />
                            UNAUTHORIZED GATE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
                            <X className="w-3 h-3" />
                            INVALID TICKET
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-ink-soft"
                  >
                    No check-ins or scan attempts recorded at this gate yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
