'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  User,
  Users,
  Calendar,
  Ticket,
  CheckCircle2,
  XCircle,
  AlertCircle,
  QrCode,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { AttendeeStatus } from '@ongc/shared-types';

export default function AdminAttendeesPage() {
  const [query, setQuery] = useState('');
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const res = await fetchApi(`/admin/attendees/search?q=${encodeURIComponent(query.trim())}`);
      setAttendees(res.data || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (attendeeId: string, status: AttendeeStatus) => {
    try {
      await fetchApi(`/admin/attendees/${attendeeId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      handleSearch();
    } catch (e: any) {
      alert(e.message || 'Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white flex items-center gap-2">
          <Search className="w-6 h-6 text-red-500" />
          Attendee Passes Directory
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Search issued festival passes by CPF, attendee name, phone number, or ticket number.
        </p>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
        <input
          type="text"
          placeholder="Search by CPF, Name, Ticket # or Phone..."
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
          <span>{loading ? 'Searching...' : 'Search'}</span>
        </button>
      </form>

      {/* Results Table */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Found {total} Matching Passes</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Attendee</th>
                <th className="px-6 py-4">Ticket Number</th>
                <th className="px-6 py-4">Employee CPF</th>
                <th className="px-6 py-4">Registered Days</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {attendees.map((att) => (
                <tr key={att.id} className="hover:bg-slate-800/30">
                  <td className="px-6 py-4">
                    <div className="font-bold text-white text-sm">
                      {att.attendeeName}
                    </div>
                    <span className="text-[11px] text-amber-400 font-semibold uppercase">
                      {att.relation}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-300">
                    {att.ticketNumber}
                  </td>
                  <td className="px-6 py-4 font-mono text-amber-400">
                    {att.employee.cpf}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {att.employee.bookingDays.map((d: string) => (
                        <span
                          key={d}
                          className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400"
                        >
                          {d.slice(5)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        att.status === AttendeeStatus.ACTIVE
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                          : 'bg-red-950/80 text-red-300 border border-red-500/40'
                      }`}
                    >
                      {att.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/ticket/${att.qrCodeToken}`}
                        target="_blank"
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
                      >
                        <QrCode className="w-3 h-3 text-amber-400" />
                        Pass
                      </Link>

                      {att.status === AttendeeStatus.ACTIVE ? (
                        <button
                          onClick={() => updateStatus(att.id, AttendeeStatus.SUSPENDED)}
                          className="text-[11px] text-red-400 hover:underline font-semibold"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => updateStatus(att.id, AttendeeStatus.ACTIVE)}
                          className="text-[11px] text-emerald-400 hover:underline font-semibold"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {attendees.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No attendee passes found. Enter search query above.
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
