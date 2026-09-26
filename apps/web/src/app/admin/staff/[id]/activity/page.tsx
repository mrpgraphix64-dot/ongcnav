'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  Check,
  Copy,
  CalendarX,
  ShieldAlert,
  X,
  RefreshCw,
  AlertCircle,
  Clock,
  DoorOpen,
  User,
  Ticket,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface GateItem {
  id: string;
  name: string;
  code?: string;
  gateNumber?: string;
}

interface StaffUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  mobile?: string | null;
  staffId?: string | null;
  staff_id?: string | null;
  role: string;
  status: 'active' | 'inactive';
  isActive: boolean;
  gates?: GateItem[];
  assignedGates?: GateItem[];
}

interface ScanLogItem {
  id: string;
  scannedAt: string;
  created_at: string;
  gate?: {
    id: string | null;
    name: string;
    code: string;
  };
  gateName?: string;
  gateCode?: string;
  attendee?: {
    id: string | null;
    name: string;
    ticketNumber: string;
    category?: string;
  };
  attendeeName?: string;
  ticket_id_scanned?: string;
  ticketNumber?: string;
  result: string;
  responseTimeMs?: number;
  ipAddress?: string;
  userAgent?: string;
  error_reason?: string;
}

interface ActivityResponse {
  user: StaffUser;
  logs: {
    data: ScanLogItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function StaffActivityPage() {
  const params = useParams();
  const staffId = params?.id as string;

  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 25;

  const loadActivity = useCallback(
    async (pageToLoad: number) => {
      if (!staffId) return;
      try {
        setLoading(true);
        setError(null);
        const res = await fetchApi<ActivityResponse>(
          `/admin/staff/${staffId}/activity?page=${pageToLoad}&limit=${limit}`,
        );
        setData(res);
        setCurrentPage(pageToLoad);
      } catch (err: any) {
        setError(err.message || 'Failed to load operator activity log');
      } finally {
        setLoading(false);
      }
    },
    [staffId, limit],
  );

  useEffect(() => {
    loadActivity(1);
  }, [loadActivity]);

  // IST Date Formatter
  const formatIST = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '—';
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(d);
    } catch {
      return isoString;
    }
  };

  const user = data?.user;
  const logs = data?.logs?.data || [];
  const totalLogs = data?.logs?.total || 0;
  const totalPages = data?.logs?.totalPages || 1;

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'ST';

  const isUnrestricted = user?.role === 'SUPER_ADMIN' || user?.role === 'EVENT_ADMIN';
  const assignedGates = user?.gates || user?.assignedGates || [];

  return (
    <div className="space-y-6">
      {/* Staff Header Card */}
      <div className="bg-white rounded-2xl border border-stone-200/70 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#7A1113] text-white font-outfit font-black text-base flex items-center justify-center shrink-0 shadow-sm">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-outfit font-extrabold text-xl text-stone-900">
                {user?.name || (loading ? 'Loading Operator...' : 'Staff Member')}
              </h2>
              <span className="px-2.5 py-0.5 rounded-md bg-stone-100 text-[#7A1113] text-xs font-bold uppercase tracking-wide">
                {user?.role ? user.role.replace(/_/g, ' ') : 'Staff'}
              </span>
              {user?.isActive || user?.status === 'active' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                  Inactive
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 mt-1">
              <span>{user?.email}</span>
              {(user?.mobile || user?.phone) && (
                <>
                  <span className="text-stone-300">&bull;</span>
                  <span>{user.mobile || user.phone}</span>
                </>
              )}
              <span className="text-stone-300">&bull;</span>
              <span className="font-bold text-stone-800">Role: {user?.role}</span>
            </div>

            {/* Assigned Gates */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[11px] font-bold text-stone-500">Gates:</span>
              {isUnrestricted ? (
                <span className="text-xs font-semibold text-emerald-700 italic">
                  All Gates (Unrestricted)
                </span>
              ) : assignedGates.length > 0 ? (
                assignedGates.map((g) => (
                  <span
                    key={g.id}
                    className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#FAF7F2] border border-stone-200 text-stone-800"
                  >
                    {g.name} ({g.code || g.gateNumber || `G-${g.id}`})
                  </span>
                ))
              ) : (
                <span className="text-xs text-amber-700 italic">No gates assigned</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadActivity(currentPage)}
            disabled={loading}
            title="Refresh Scan Logs"
            className="p-2 rounded-xl border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/admin/staff"
            className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Staff Directory</span>
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl border bg-rose-50 border-rose-200 text-rose-800 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Operator Scan & Check-in History Table */}
      <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="font-outfit font-bold text-base text-stone-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-500" />
            <span>Operator Scan & Check-in History</span>
          </h3>
          <span className="text-xs text-stone-500 font-semibold">
            Total: {totalLogs} recorded operations
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF7F2] border-b border-stone-200/70 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Timestamp (IST)</th>
                <th className="px-5 py-3.5">Gate</th>
                <th className="px-5 py-3.5">Attendee Name</th>
                <th className="px-5 py-3.5">Ticket ID</th>
                <th className="px-5 py-3.5">Action / Result</th>
                <th className="px-5 py-3.5">Details / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-900">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-stone-400">
                    <RefreshCw className="w-6 h-6 text-stone-300 animate-spin mx-auto mb-2" />
                    <p className="font-semibold text-stone-600">Loading audit history...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-stone-400">
                    <Activity className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="font-semibold text-stone-600">
                      No scan operations recorded for this staff member yet.
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const attendeeName =
                    log.attendee?.name || log.attendeeName || 'Unrecognized';
                  const ticketId =
                    log.ticket_id_scanned || log.ticketNumber || log.attendee?.ticketNumber || 'N/A';
                  const gateLabel =
                    log.gate?.name || log.gateName || (log.gate?.code ? `Gate ${log.gate.code}` : '—');
                  const category = log.attendee?.category;

                  const rawResult = (log.result || '').toUpperCase();
                  const isApproved = rawResult === 'APPROVED' || rawResult === 'SUCCESS';
                  const isDuplicate =
                    rawResult === 'DUPLICATE' || rawResult === 'ALREADY_CHECKED_IN';
                  const isNotBooked =
                    rawResult === 'NOT_BOOKED' || rawResult === 'NOT_BOOKED_TODAY';
                  const isUnauthorizedGate =
                    rawResult === 'UNAUTHORIZED_GATE' || rawResult === 'GATE_RESTRICTED';

                  return (
                    <tr key={log.id} className="hover:bg-[#FAF7F2]/40 transition-colors">
                      {/* Timestamp (IST) */}
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono text-stone-500">
                        {formatIST(log.scannedAt || log.created_at)}
                      </td>

                      {/* Gate */}
                      <td className="px-5 py-3.5 whitespace-nowrap font-semibold text-stone-800">
                        {gateLabel}
                      </td>

                      {/* Attendee Name */}
                      <td className="px-5 py-3.5 font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="text-stone-900">{attendeeName}</span>
                          {category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                              {category}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Ticket ID */}
                      <td className="px-5 py-3.5 font-mono font-bold text-[#7A1113] whitespace-nowrap">
                        {ticketId}
                      </td>

                      {/* Action / Result */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {isApproved ? (
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

                      {/* Details / Notes */}
                      <td className="px-5 py-3.5 text-stone-500">
                        {log.error_reason || (isApproved ? 'Normal validation scan' : 'Validation rejected')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
            <div>
              Showing page <span className="font-bold text-stone-800">{currentPage}</span> of{' '}
              <span className="font-bold text-stone-800">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadActivity(currentPage - 1)}
                disabled={currentPage <= 1 || loading}
                className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors disabled:opacity-40 inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                onClick={() => loadActivity(currentPage + 1)}
                disabled={currentPage >= totalPages || loading}
                className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors disabled:opacity-40 inline-flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
