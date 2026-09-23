'use client';

import { useState } from 'react';
import {
  Headphones,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  ShieldCheck,
  DoorOpen,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function AdminHelpDeskPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Manual Checkin Modal
  const [selectedAttendee, setSelectedAttendee] = useState<any | null>(null);
  const [manualGateId, setManualGateId] = useState('1');
  const [manualReason, setManualReason] = useState('');

  // Void Checkin Modal
  const [selectedCheckin, setSelectedCheckin] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setMsg(null);
    try {
      const data = await fetchApi(`/admin/helpdesk/search?q=${encodeURIComponent(query.trim())}`);
      setResults(data || []);
    } catch (e: any) {
      setMsg({ text: e.message || 'Search failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualReason.trim()) {
      alert('Mandatory justification is required for manual check-in override');
      return;
    }

    try {
      await fetchApi('/admin/helpdesk/manual-checkin', {
        method: 'POST',
        body: JSON.stringify({
          attendeeId: selectedAttendee.id,
          gateId: manualGateId,
          reason: manualReason.trim(),
        }),
      });
      setSelectedAttendee(null);
      setManualReason('');
      handleSearch();
      setMsg({ text: 'Manual check-in override recorded successfully', type: 'success' });
    } catch (e: any) {
      alert(e.message || 'Manual checkin failed');
    }
  };

  const handleVoidCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidReason.trim()) {
      alert('Mandatory justification is required to void check-in');
      return;
    }

    try {
      await fetchApi('/admin/helpdesk/void-checkin', {
        method: 'POST',
        body: JSON.stringify({
          checkinId: selectedCheckin.id,
          reason: voidReason.trim(),
        }),
      });
      setSelectedCheckin(null);
      setVoidReason('');
      handleSearch();
      setMsg({ text: 'Check-in voided successfully. Attendee may now enter.', type: 'success' });
    } catch (e: any) {
      alert(e.message || 'Void checkin failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white flex items-center gap-2">
          <Headphones className="w-6 h-6 text-red-500" />
          Help Desk Overrides & Corrections
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Perform manual turnstile check-ins for damaged passes, or void accidental scans with full audit logs.
        </p>
      </div>

      {msg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
            msg.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/60 border-red-500/40 text-red-200'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
        <input
          type="text"
          placeholder="Lookup by CPF, Name, or Ticket Number..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-red-500 font-medium"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-900/30"
        >
          <Search className="w-4 h-4" />
          <span>{loading ? 'Finding...' : 'Find Attendee'}</span>
        </button>
      </form>

      {/* Results Cards */}
      <div className="space-y-3">
        {results.map((att) => (
          <div
            key={att.id}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400 uppercase">
                  {att.relation}
                </span>
                <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {att.ticketNumber}
                </span>
              </div>

              <h3 className="text-lg font-bold text-white mt-1">
                {att.attendeeName}
              </h3>

              <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-2">
                <span>CPF: <strong className="text-white font-mono">{att.employee.cpf}</strong></span>
                <span>•</span>
                <span>{att.employee.designation}</span>
                <span>•</span>
                <span>{att.employee.department}</span>
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs">
                {att.isBookedToday ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Booked for Today
                  </span>
                ) : (
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Not Booked for Today
                  </span>
                )}

                {att.isCheckedInToday && (
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    • Already Checked In at {att.todayCheckin?.gateName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!att.isCheckedInToday ? (
                <button
                  onClick={() => setSelectedAttendee(att)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Manual Check-in Override
                </button>
              ) : (
                <button
                  onClick={() => setSelectedCheckin(att.todayCheckin)}
                  className="px-4 py-2 rounded-xl bg-red-950/80 hover:bg-red-900/80 border border-red-500/50 text-red-300 font-bold text-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  Void Check-in
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Manual Check-in Modal */}
      {selectedAttendee && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-lg font-bold text-white">Manual Check-in Override</h3>
            <p className="text-xs text-slate-400">
              Manually checking in <strong className="text-white">{selectedAttendee.attendeeName}</strong> ({selectedAttendee.ticketNumber}).
            </p>

            <form onSubmit={handleManualCheckin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Gate
                </label>
                <select
                  value={manualGateId}
                  onChange={(e) => setManualGateId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                >
                  <option value="1">Gate 1 (Main Entrance)</option>
                  <option value="2">Gate 2 (Officers Entry)</option>
                  <option value="3">Gate 3 (Family Turnstile)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Mandatory Justification / Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Phone battery exhausted. Physical ONGC ID verified."
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedAttendee(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  Confirm Check-in
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Check-in Modal */}
      {selectedCheckin && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-lg font-bold text-white">Void Accidental Check-in</h3>
            <p className="text-xs text-slate-400">
              Voiding this check-in will restore the attendee's entry privilege for tonight, allowing them to scan again.
            </p>

            <form onSubmit={handleVoidCheckin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Reason for Voiding *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Operator scanned incorrect family pass by mistake."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCheckin(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                >
                  Void Check-in
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
