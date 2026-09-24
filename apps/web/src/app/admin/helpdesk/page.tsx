'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LifeBuoy,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  UserCheck,
  DoorOpen,
  Calendar,
  X,
  Phone,
  Shield,
  ShieldAlert,
  Hash,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface GateOption {
  id: string;
  name: string;
  code?: string;
}

interface CheckinInfo {
  id: string;
  gateId?: string;
  gateName?: string;
  gateCode?: string;
  checkinTime?: string;
  isManual?: boolean;
  manualReason?: string | null;
  scannedBy?: string | null;
  voidReason?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
}

interface AttendeeResult {
  id: string;
  ticketNumber: string;
  ticket_id?: string;
  name: string;
  attendeeName?: string;
  category: string;
  mobile: string;
  relation: string;
  isFamily: boolean;
  cpf?: string | null;
  isBookedToday: boolean;
  isCheckedInToday: boolean;
  activeCheckin?: CheckinInfo | null;
  voidedCheckin?: CheckinInfo | null;
}

export default function AdminHelpDeskPage() {
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [results, setResults] = useState<AttendeeResult[]>([]);
  const [gates, setGates] = useState<GateOption[]>([]);
  const [activeDate, setActiveDate] = useState<string>('');
  const [canViewCpf, setCanViewCpf] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Manual Check-in Modal
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualAttendee, setManualAttendee] = useState<AttendeeResult | null>(null);
  const [manualGateId, setManualGateId] = useState<string>('');
  const [manualReason, setManualReason] = useState<string>('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Reverse Check-in (Void) Modal
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidCheckin, setVoidCheckin] = useState<CheckinInfo | null>(null);
  const [voidAttendee, setVoidAttendee] = useState<AttendeeResult | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  // Load current user role and initial gates
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ongc_admin_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.role) setUserRole(u.role.toUpperCase());
      }
    } catch {}

    async function init() {
      try {
        const [gatesRes, statusRes] = await Promise.all([
          fetchApi('/admin/gates').catch(() => []),
          fetchApi('/event-control/status').catch(() => null),
        ]);

        if (Array.isArray(gatesRes)) {
          setGates(
            gatesRes.map((g: any) => ({
              id: g.id.toString(),
              name: g.name,
              code: g.gateNumber || g.code,
            })),
          );
          if (gatesRes.length > 0) {
            setManualGateId(gatesRes[0].id.toString());
          }
        }

        if (statusRes?.activeDate) {
          setActiveDate(statusRes.activeDate);
        }
      } catch (err) {
        console.error('Helpdesk init failed:', err);
      }
    }

    init();
  }, []);

  const handleSearch = useCallback(
    async (e?: React.FormEvent, searchQueryOverride?: string) => {
      if (e) e.preventDefault();
      const q = (searchQueryOverride !== undefined ? searchQueryOverride : query).trim();
      if (!q) {
        setResults([]);
        setSearchedQuery('');
        return;
      }

      setLoading(true);
      setMsg(null);
      try {
        const res = await fetchApi(`/admin/helpdesk/search?q=${encodeURIComponent(q)}`);
        if (res && res.attendees) {
          setResults(res.attendees || []);
          if (Array.isArray(res.gates) && res.gates.length > 0) {
            setGates(res.gates);
            if (!manualGateId) setManualGateId(res.gates[0].id);
          }
          if (res.activeDate) setActiveDate(res.activeDate);
          if (typeof res.canViewCpf === 'boolean') setCanViewCpf(res.canViewCpf);
        } else if (Array.isArray(res)) {
          setResults(res);
        } else {
          setResults([]);
        }
        setSearchedQuery(q);
      } catch (err: any) {
        setMsg({ text: err.message || 'Lookup failed. Please try again.', type: 'error' });
      } finally {
        setLoading(false);
      }
    },
    [query, manualGateId],
  );

  const handleClear = () => {
    setQuery('');
    setSearchedQuery('');
    setResults([]);
    setMsg(null);
  };

  const openManualModal = (att: AttendeeResult) => {
    setManualAttendee(att);
    setManualReason('');
    if (gates.length > 0 && !manualGateId) {
      setManualGateId(gates[0].id);
    }
    setManualModalOpen(true);
  };

  const closeManualModal = () => {
    setManualModalOpen(false);
    setManualAttendee(null);
    setManualReason('');
  };

  const handleConfirmManualCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAttendee) return;
    const trimmed = manualReason.trim();
    if (!trimmed || trimmed.length < 3) {
      alert('Mandatory justification is required for manual entry (minimum 3 characters).');
      return;
    }

    setManualSubmitting(true);
    try {
      await fetchApi('/admin/helpdesk/manual-checkin', {
        method: 'POST',
        body: JSON.stringify({
          ticket_id: manualAttendee.ticketNumber || manualAttendee.ticket_id,
          attendeeId: manualAttendee.id,
          gate_id: manualGateId || (gates[0] ? gates[0].id : '1'),
          gateId: manualGateId || (gates[0] ? gates[0].id : '1'),
          manual_reason: trimmed,
          reason: trimmed,
        }),
      });

      setMsg({
        text: `Manual entry approved and logged for ${manualAttendee.name} (${manualAttendee.ticketNumber}).`,
        type: 'success',
      });
      closeManualModal();
      handleSearch(undefined, searchedQuery);
    } catch (err: any) {
      alert(err.message || 'Manual check-in failed.');
    } finally {
      setManualSubmitting(false);
    }
  };

  const openVoidModal = (att: AttendeeResult, checkin: CheckinInfo) => {
    setVoidAttendee(att);
    setVoidCheckin(checkin);
    setVoidReason('');
    setVoidModalOpen(true);
  };

  const closeVoidModal = () => {
    setVoidModalOpen(false);
    setVoidAttendee(null);
    setVoidCheckin(null);
    setVoidReason('');
  };

  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidCheckin) return;
    const trimmed = voidReason.trim();
    if (!trimmed || trimmed.length < 3) {
      alert('Mandatory justification is required to reverse/void check-in.');
      return;
    }

    setVoidSubmitting(true);
    try {
      await fetchApi(`/admin/helpdesk/void-checkin`, {
        method: 'POST',
        body: JSON.stringify({
          checkinId: voidCheckin.id,
          checkin_id: voidCheckin.id,
          void_reason: trimmed,
          reason: trimmed,
        }),
      });

      setMsg({
        text: `Check-in reversed successfully. Attendee status restored to Registered.`,
        type: 'success',
      });
      closeVoidModal();
      handleSearch(undefined, searchedQuery);
    } catch (err: any) {
      alert(err.message || 'Check-in reversal failed.');
    } finally {
      setVoidSubmitting(false);
    }
  };

  const isSuperOrEventAdmin =
    userRole === 'SUPER_ADMIN' || userRole === 'EVENT_ADMIN' || userRole === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Flash Alerts */}
      {msg && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between shadow-xs transition-all ${
            msg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-3">
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-sm font-semibold">{msg.text}</span>
          </div>
          <button
            onClick={() => setMsg(null)}
            className={`p-1 rounded-lg hover:bg-black/5 transition-colors ${
              msg.type === 'success' ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Header Card */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200/80 card-shadow space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="font-outfit font-extrabold text-2xl text-ink flex items-center gap-2.5">
              <LifeBuoy className="w-6 h-6 text-maroon shrink-0" />
              <span>Attendee Help Desk & Verification</span>
            </h2>
            <p className="text-xs text-ink-soft mt-0.5">
              Search attendee records by Ticket ID, Full Name, Mobile Number{' '}
              {canViewCpf ? (
                <span className="font-bold text-maroon">or ONGC CPF Number</span>
              ) : (
                <span className="text-stone-400 italic">
                  (CPF search restricted to authorized administrative staff)
                </span>
              )}
              .
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-xl bg-cream-soft border border-stone-200 text-xs font-semibold text-stone-700 flex items-center gap-1.5 shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-maroon" />
              <span>Active Date:</span>
              <strong className="text-maroon font-bold">
                {activeDate ? activeDate : 'Today'}
              </strong>
            </span>
          </div>
        </div>

        {/* Search Form */}
        <form
          onSubmit={(e) => handleSearch(e)}
          className="flex flex-col sm:flex-row items-center gap-2.5"
        >
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search by Ticket ID (e.g. NR2026-0001), Name, Mobile${
                canViewCpf ? ', CPF' : ''
              }...`}
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-cream-soft text-xs text-ink placeholder-stone-400 focus:outline-maroon font-medium transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-maroon hover:bg-maroon-dark text-white text-xs font-bold transition flex items-center justify-center gap-2 shrink-0 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{loading ? 'Searching...' : 'Lookup Attendee'}</span>
          </button>
          {searchedQuery !== '' && (
            <button
              type="button"
              onClick={handleClear}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-ink text-xs font-bold transition text-center shrink-0 cursor-pointer"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Results Section */}
      {searchedQuery !== '' && (
        <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow overflow-hidden">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-outfit font-extrabold text-base text-ink">
              Search Results{' '}
              <span className="text-xs font-normal text-stone-400">
                ({results.length} {results.length === 1 ? 'attendee found' : 'attendees found'})
              </span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50/80 text-stone-600 font-bold border-b border-stone-200/70">
                  <th className="py-3.5 px-4">Ticket / Attendee</th>
                  <th className="py-3.5 px-3">Category</th>
                  <th className="py-3.5 px-3">Contact</th>
                  {canViewCpf && <th className="py-3.5 px-3">CPF</th>}
                  <th className="py-3.5 px-3">Today Booking</th>
                  <th className="py-3.5 px-3">Entry Status Today</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {results.length > 0 ? (
                  results.map((att) => {
                    const isBookedToday = att.isBookedToday;
                    const activeCheckin = att.activeCheckin;
                    const voidedCheckin = att.voidedCheckin;

                    return (
                      <tr key={att.id} className="hover:bg-cream/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-outfit font-bold text-sm text-maroon">
                            {att.name || att.attendeeName}
                          </div>
                          <div className="font-mono text-[11px] text-stone-600">
                            {att.ticketNumber || att.ticket_id}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              att.category === 'VIP'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {att.category}
                          </span>
                          <div className="text-[10px] text-stone-400 mt-0.5">
                            {att.isFamily ? 'Family Member' : 'Primary Employee'}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-stone-700">
                          {att.mobile || 'N/A'}
                        </td>
                        {canViewCpf && (
                          <td className="py-3.5 px-3 font-mono font-semibold text-ink">
                            {att.cpf ? att.cpf : '—'}
                          </td>
                        )}
                        <td className="py-3.5 px-3">
                          {isBookedToday ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Booked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                              <XCircle className="w-3.5 h-3.5 text-rose-500" /> Not Booked
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          {activeCheckin ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Checked In
                              </span>
                              <div className="text-[11px] text-stone-600 font-medium">
                                {activeCheckin.checkinTime
                                  ? new Date(activeCheckin.checkinTime).toLocaleTimeString(
                                      'en-IN',
                                      {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true,
                                        timeZone: 'Asia/Kolkata',
                                      },
                                    )
                                  : 'Today'}{' '}
                                &bull; {activeCheckin.gateName || 'Gate'}
                              </div>
                              {activeCheckin.isManual && (
                                <div className="text-[10px] text-amber-700 font-semibold">
                                  Manual: {activeCheckin.manualReason || 'Admin Override'}
                                </div>
                              )}
                            </div>
                          ) : voidedCheckin ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                Voided
                              </span>
                              <div className="text-[10px] text-stone-400">
                                Reason: {voidedCheckin.voidReason}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-600">
                              Not Checked In
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {!activeCheckin ? (
                              <button
                                type="button"
                                onClick={() => openManualModal(att)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-maroon hover:bg-maroon-dark text-white transition shadow-xs cursor-pointer"
                              >
                                Manual Check-in
                              </button>
                            ) : (
                              isSuperOrEventAdmin && (
                                <button
                                  type="button"
                                  onClick={() => openVoidModal(att, activeCheckin)}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
                                >
                                  Reverse Check-in
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={canViewCpf ? 7 : 6}
                      className="py-10 text-center text-stone-400 font-medium"
                    >
                      No attendees matching &ldquo;{searchedQuery}&rdquo; were found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Check-in Modal */}
      {manualModalOpen && manualAttendee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-stone-200 card-shadow space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-maroon/10 text-maroon flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-outfit font-extrabold text-base text-ink">
                    Manual Attendee Entry
                  </h4>
                  <p className="text-[11px] text-ink-soft">Authorized help desk admission</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeManualModal}
                className="text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmManualCheckin} className="space-y-4">
              <div className="p-3 rounded-2xl bg-cream-soft border border-stone-200">
                <div className="text-[11px] font-bold text-stone-400 uppercase">Attendee</div>
                <div className="font-outfit font-bold text-sm text-maroon">
                  {manualAttendee.name || manualAttendee.attendeeName}
                </div>
                <div className="font-mono text-xs text-stone-600">
                  {manualAttendee.ticketNumber || manualAttendee.ticket_id}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Entry Gate <span className="text-rose-500">*</span>
                </label>
                <select
                  value={manualGateId}
                  onChange={(e) => setManualGateId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-200 bg-white font-medium focus:outline-maroon"
                >
                  {gates.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} {g.code ? `(${g.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Reason for Manual Check-in <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Screen damaged / QR unreadable, Paper pass presented with photo ID"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-maroon"
                />
                <p className="text-[10px] text-stone-400 mt-1">
                  Reason is mandatory and permanently logged for operational audit.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeManualModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-maroon hover:bg-maroon-dark text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {manualSubmitting ? 'Confirming...' : 'Confirm Manual Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reverse Check-in (Void) Modal */}
      {voidModalOpen && voidAttendee && voidCheckin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-rose-200 card-shadow space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-outfit font-extrabold text-base text-ink">
                    Reverse Check-in (Void)
                  </h4>
                  <p className="text-[11px] text-rose-600 font-semibold">
                    Strict Super / Event Admin Action
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeVoidModal}
                className="text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmVoid} className="space-y-4">
              <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200 text-xs">
                <div className="text-[10px] font-bold text-rose-800 uppercase">
                  Attendee to Void
                </div>
                <div className="font-outfit font-bold text-sm text-ink">
                  {voidAttendee.name || voidAttendee.attendeeName}
                </div>
                <div className="font-mono text-[11px] text-stone-600">
                  {voidAttendee.ticketNumber || voidAttendee.ticket_id}
                </div>
                <p className="text-[11px] text-rose-700 mt-2">
                  Voiding will mark this check-in as voided while preserving the audit record. The
                  attendee will be restored to &apos;registered&apos; and allowed re-entry.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Reason for Reversal / Void <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Scanned at incorrect gate by mistake; Attendee stepped out immediately with gate supervisor approval"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-rose-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeVoidModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={voidSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {voidSubmitting ? 'Voiding...' : 'Void Check-in'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
