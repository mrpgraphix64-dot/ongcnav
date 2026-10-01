'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Mail,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Filter,
  Eye,
  Printer,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Users,
  QrCode,
  ArrowRight,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import AdminModal from '@/components/admin/AdminModal';
import { OFFICIAL_EVENT_DATES } from '@ongc/shared-types';

interface DeliveryStats {
  eventDate: string;
  eligibleCount: number;
  generatedCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  checkedInCount: number;
}

interface DailyPassItem {
  id: string;
  attendeeId: string;
  eventDate: string;
  ticketNumber: string;
  qrToken: string;
  qrSvg: string | null;
  attendeeName: string;
  relation: string;
  isFamily: boolean;
  employeeName: string;
  cpf: string;
  department: string;
  email: string;
  phone: string;
  status: string;
  emailStatus: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
  emailSentAt: string | null;
  emailError: string | null;
  checkedInAt: string | null;
  createdAt: string;
}

export default function DailyQrDeliveryPage() {
  const [selectedDate, setSelectedDate] = useState<string>(OFFICIAL_EVENT_DATES[0]);
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [passes, setPasses] = useState<DailyPassItem[]>([]);
  const [passesLoading, setPassesLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');
  const [emailStatusFilter, setEmailStatusFilter] = useState('ALL');
  const [passStatusFilter, setPassStatusFilter] = useState('ALL');

  const [generating, setGenerating] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [viewPass, setViewPass] = useState<DailyPassItem | null>(null);

  // Load stats for current selected date
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await fetchApi<DeliveryStats>(`/admin/employees/daily-passes/stats?date=${selectedDate}`);
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [selectedDate]);

  // Load passes list
  const loadPasses = useCallback(async () => {
    setPassesLoading(true);
    try {
      const params = new URLSearchParams({
        date: selectedDate,
        page: page.toString(),
        limit: '20',
      });
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (emailStatusFilter !== 'ALL') params.append('emailStatus', emailStatusFilter);
      if (passStatusFilter !== 'ALL') params.append('status', passStatusFilter);

      const res = await fetchApi<{
        passes: DailyPassItem[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/admin/employees/daily-passes?${params.toString()}`);

      setPasses(res.passes || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to load passes:', err);
    } finally {
      setPassesLoading(false);
    }
  }, [selectedDate, page, searchQuery, emailStatusFilter, passStatusFilter]);

  useEffect(() => {
    loadStats();
    loadPasses();
  }, [loadStats, loadPasses]);

  // Generate passes for selected date
  const handleGeneratePasses = async () => {
    setGenerating(true);
    setActionMessage(null);
    try {
      const res = await fetchApi<{
        success: boolean;
        message: string;
        generatedCount: number;
        existingCount: number;
      }>('/admin/employees/daily-passes/generate', {
        method: 'POST',
        body: JSON.stringify({ eventDate: selectedDate }),
      });
      setActionMessage({ type: 'success', text: res.message });
      await loadStats();
      await loadPasses();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to generate passes' });
    } finally {
      setGenerating(false);
    }
  };

  // Send emails
  const handleSendEmails = async (retryFailedOnly: boolean = false) => {
    setSendingEmails(true);
    setActionMessage(null);
    try {
      const res = await fetchApi<{
        success: boolean;
        message: string;
        sentCount: number;
        failedCount: number;
      }>('/admin/employees/daily-passes/send-emails', {
        method: 'POST',
        body: JSON.stringify({ eventDate: selectedDate, retryFailedOnly }),
      });
      setActionMessage({ type: 'success', text: res.message });
      await loadStats();
      await loadPasses();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to dispatch emails' });
    } finally {
      setSendingEmails(false);
    }
  };

  const formatDateDisplay = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <div className="space-y-6">
      {/* ACTION BANNER */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-3 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-stone-400 hover:text-ink cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* EVENT DATE SELECTOR TABS */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-ink uppercase tracking-wider mb-2">
          <Calendar className="w-4 h-4 text-maroon" />
          <span>Select Official Event Date:</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
          {OFFICIAL_EVENT_DATES.map((d, idx) => {
            const isSelected = selectedDate === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setSelectedDate(d);
                  setPage(1);
                  setActionMessage(null);
                }}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-maroon text-white border-maroon shadow-md scale-[1.02]'
                    : 'bg-cream-light/60 hover:bg-cream border-stone-200 text-ink'
                }`}
              >
                <div className={`text-[10px] uppercase font-bold ${isSelected ? 'text-gold-light' : 'text-stone-500'}`}>
                  Night {idx + 1}
                </div>
                <div className="font-outfit font-black text-xs sm:text-sm mt-0.5">
                  {formatDateDisplay(d)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* STATS CARDS FOR SELECTED DATE */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Eligible */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-ink-soft uppercase tracking-wider">Eligible Attendees</div>
          <div className="font-outfit font-black text-2xl text-ink mt-1">
            {statsLoading ? '—' : stats?.eligibleCount.toLocaleString() ?? 0}
          </div>
          <div className="text-[10px] text-ink-soft mt-1">Registered for {formatDateDisplay(selectedDate)}</div>
        </div>

        {/* Generated */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-ink-soft uppercase tracking-wider">QR Passes Generated</div>
          <div className="font-outfit font-black text-2xl text-purple-700 mt-1">
            {statsLoading ? '—' : stats?.generatedCount.toLocaleString() ?? 0}
          </div>
          <div className="text-[10px] text-purple-600 mt-1">Unique tokens issued</div>
        </div>

        {/* Sent */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Emails Sent</div>
          <div className="font-outfit font-black text-2xl text-emerald-700 mt-1">
            {statsLoading ? '—' : stats?.sentCount.toLocaleString() ?? 0}
          </div>
          <div className="text-[10px] text-emerald-600 mt-1">Delivered to inbox</div>
        </div>

        {/* Failed */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-xs">
          <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Failed Emails</div>
          <div className="font-outfit font-black text-2xl text-rose-700 mt-1">
            {statsLoading ? '—' : stats?.failedCount.toLocaleString() ?? 0}
          </div>
          <div className="text-[10px] text-rose-600 mt-1">Ready for retry</div>
        </div>

        {/* Pending */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-xs">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pending Dispatch</div>
          <div className="font-outfit font-black text-2xl text-amber-700 mt-1">
            {statsLoading ? '—' : stats?.pendingCount.toLocaleString() ?? 0}
          </div>
          <div className="text-[10px] text-amber-600 mt-1">Awaiting send</div>
        </div>

        {/* Checked In */}
        <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-blue-50/30 shadow-xs">
          <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Gate Scans</div>
          <div className="font-outfit font-black text-2xl text-blue-700 mt-1">
            {statsLoading ? '—' : stats?.checkedInCount.toLocaleString() ?? 0}
          </div>
          <div className="text-[10px] text-blue-600 mt-1">Attended event</div>
        </div>
      </div>

      {/* ACTION TOOLBAR */}
      <div className="bg-gradient-to-r from-cream-light to-white p-4 sm:p-5 rounded-2xl border border-gold/40 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h2 className="font-outfit font-extrabold text-sm text-ink flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-maroon" />
            <span>Delivery Actions for {formatDateDisplay(selectedDate)}</span>
          </h2>
          <p className="text-xs text-ink-soft mt-0.5">
            Step 1 creates unique tokens. Step 2 emails the passes. Deliveries are idempotent.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleGeneratePasses}
            disabled={generating}
            className="px-4 py-2.5 rounded-xl bg-maroon text-white font-bold text-xs hover:bg-maroon-dark transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {generating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <QrCode className="w-3.5 h-3.5 text-gold-light" />
            )}
            <span>1. Generate Today's Passes</span>
          </button>

          <button
            type="button"
            onClick={() => handleSendEmails(false)}
            disabled={sendingEmails || (stats?.pendingCount === 0 && stats?.failedCount === 0)}
            className="px-4 py-2.5 rounded-xl bg-gold text-maroon-deep font-extrabold text-xs hover:bg-gold-light transition-all shadow-xs flex items-center gap-2 border border-maroon/20 cursor-pointer disabled:opacity-50"
          >
            {sendingEmails ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>2. Send QR Pass Emails</span>
          </button>

          {stats && stats.failedCount > 0 && (
            <button
              type="button"
              onClick={() => handleSendEmails(true)}
              disabled={sendingEmails}
              className="px-3.5 py-2.5 rounded-xl bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs hover:bg-rose-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry {stats.failedCount} Failed</span>
            </button>
          )}
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by Attendee Name, Employee CPF, Email, or Ticket ID..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-maroon bg-cream/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-ink cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Email Status */}
          <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-ink-soft">Email:</span>
            <select
              value={emailStatusFilter}
              onChange={(e) => {
                setEmailStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-none text-xs font-bold text-ink focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Delivery States</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>

          {/* Pass Status */}
          <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-ink-soft">Pass:</span>
            <select
              value={passStatusFilter}
              onChange={(e) => {
                setPassStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-none text-xs font-bold text-ink focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Passes</option>
              <option value="ACTIVE">Active</option>
              <option value="USED">Checked In</option>
              <option value="REVOKED">Revoked</option>
            </select>
          </div>
        </div>
      </div>

      {/* PASSES DATA TABLE */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200/70 text-ink-soft uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3 px-4 font-bold">Attendee</th>
                <th className="py-3 px-4 font-bold">Role / Family</th>
                <th className="py-3 px-4 font-bold">Employee &amp; CPF</th>
                <th className="py-3 px-4 font-bold">Recipient Email</th>
                <th className="py-3 px-4 font-bold">Email Status</th>
                <th className="py-3 px-4 font-bold">Pass Status</th>
                <th className="py-3 px-4 font-bold">Check-in</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {passesLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-ink-soft">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-maroon mb-2" />
                    <span>Loading daily passes...</span>
                  </td>
                </tr>
              ) : passes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-ink-soft">
                    <QrCode className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="font-semibold text-ink text-sm">No daily passes found for this date</p>
                    <p className="text-xs text-ink-soft mt-1">
                      Click <strong>"Generate Today's Passes"</strong> above to issue passes for registered attendees.
                    </p>
                  </td>
                </tr>
              ) : (
                passes.map((p) => (
                  <tr key={p.id} className="hover:bg-cream/40 transition-colors">
                    {/* Attendee */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-ink text-sm">{p.attendeeName}</div>
                      <div className="font-mono text-[10px] text-stone-400 mt-0.5">{p.ticketNumber}</div>
                    </td>

                    {/* Role / Family */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          p.isFamily
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}
                      >
                        {p.relation}
                      </span>
                    </td>

                    {/* Employee & CPF */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-ink">{p.employeeName}</div>
                      {p.cpf && (
                        <div className="font-mono text-[11px] text-maroon font-bold mt-0.5">CPF: {p.cpf}</div>
                      )}
                    </td>

                    {/* Recipient Email */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-ink-soft">
                        <Mail className="w-3 h-3 text-stone-400 shrink-0" />
                        <span className="truncate max-w-[170px]">{p.email}</span>
                      </div>
                    </td>

                    {/* Email Status */}
                    <td className="py-3 px-4">
                      {p.emailStatus === 'SENT' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Sent</span>
                          </span>
                          {p.emailSentAt && (
                            <div className="text-[9px] text-ink-soft mt-0.5">
                              {new Date(p.emailSentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      ) : p.emailStatus === 'FAILED' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200 uppercase">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>Failed</span>
                          </span>
                          {p.emailError && (
                            <div className="text-[9px] text-rose-600 truncate max-w-[120px] mt-0.5" title={p.emailError}>
                              {p.emailError}
                            </div>
                          )}
                        </div>
                      ) : p.emailStatus === 'SENDING' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200 uppercase">
                          <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                          <span>Sending</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>

                    {/* Pass Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                          p.status === 'USED'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : p.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    {/* Check-in */}
                    <td className="py-3 px-4">
                      {p.checkedInAt ? (
                        <div className="text-[10px] font-bold text-blue-800">
                          {new Date(p.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      ) : (
                        <span className="text-[10px] text-stone-400 font-semibold">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setViewPass(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-maroon hover:text-white text-ink text-xs font-bold transition-colors cursor-pointer"
                        title="View Scannable QR Pass"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>View QR</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="p-4 border-t border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-soft">
          <div>
            Showing <strong>{passes.length}</strong> of <strong>{totalCount}</strong> passes
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white font-bold disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span>
                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white font-bold disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* VIEW QR MODAL */}
      {viewPass && (
        <AdminModal
          isOpen={!!viewPass}
          onClose={() => setViewPass(null)}
          title="Daily Entry QR Pass"
        >
          <div className="space-y-5 text-center p-2">
            <div className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-xs font-extrabold uppercase tracking-wider">
              VALID ONLY FOR: {formatDateDisplay(viewPass.eventDate)}
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#5A0F21] to-[#3D0714] text-white border-2 border-gold shadow-lg max-w-sm mx-auto space-y-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gold-light">
                ONGC NAVRATRI 2026 &bull; OFFICIAL ENTRY
              </div>
              <div className="font-outfit font-black text-xl text-white">
                {viewPass.attendeeName}
              </div>
              <div className="text-xs text-gold font-semibold">
                {viewPass.relation} {viewPass.cpf ? `(CPF: ${viewPass.cpf})` : ''}
              </div>

              {/* QR Image Box */}
              <div className="bg-white p-4 rounded-xl inline-block mx-auto shadow-md">
                {viewPass.qrSvg ? (
                  <div
                    className="w-48 h-48 mx-auto"
                    dangerouslySetInnerHTML={{ __html: viewPass.qrSvg }}
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-stone-400">
                    QR Preview
                  </div>
                )}
                <div className="text-[10px] font-black tracking-widest text-maroon uppercase mt-1">
                  SCAN AT GATE
                </div>
              </div>

              <div className="font-mono text-xs font-bold text-gold-light">
                Ticket: {viewPass.ticketNumber}
              </div>
              <div className="text-[11px] text-stone-300">
                Single-use entry credential valid on {formatDateDisplay(viewPass.eventDate)}.
              </div>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-gold text-maroon-deep font-bold text-xs hover:bg-gold-light transition-all flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print QR Pass</span>
              </button>
              <button
                type="button"
                onClick={() => setViewPass(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-ink hover:bg-stone-100"
              >
                Close
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
