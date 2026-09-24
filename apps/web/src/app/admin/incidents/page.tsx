'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  PlusCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Filter,
  X,
  DoorOpen,
  Calendar,
  Check,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { IncidentCategory, IncidentSeverity, IncidentStatus } from '@ongc/shared-types';

interface GateItem {
  id: string;
  name: string;
  code?: string;
}

interface IncidentItem {
  id: string;
  incident_id?: string;
  incidentNumber: string;
  category: string;
  categoryLabel?: string;
  severity: string;
  status: string;
  title?: string;
  description: string;
  ticket_id?: string | null;
  ticketId?: string | null;
  incident_date?: string | null;
  incident_time?: string | null;
  resolution_notes?: string | null;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  gate?: {
    id: string;
    name: string;
    gateNumber?: string;
  } | null;
  reportedBy?: {
    id: string;
    name: string;
    role: string;
    staffId?: string;
  } | null;
  resolvedBy?: {
    id: string;
    name: string;
    role: string;
    staffId?: string;
  } | null;
  attendee?: {
    id: string;
    name: string;
    ticketNumber?: string;
    mobile?: string;
  } | null;
}

const CATEGORIES_MAP: Record<string, string> = {
  TICKET_ISSUE: 'Ticket / QR Issue',
  CAPACITY_LIMIT: 'Capacity Limit Reached',
  DUPLICATE_CLAIM: 'Duplicate Entry Dispute',
  SECURITY: 'Security Concern',
  MEDICAL: 'Medical / First Aid',
  LOST_FOUND: 'Lost & Found',
  OTHER: 'Other Incident',
  CROWD: 'Crowd Congestion',
  SYSTEM: 'Technical / System',
  VIP: 'VIP Escort',
};

export default function AdminIncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [gates, setGates] = useState<GateItem[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>(CATEGORIES_MAP);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Metrics
  const [metrics, setMetrics] = useState({
    totalCount: 0,
    openCount: 0,
    inReviewCount: 0,
    resolvedCount: 0,
  });

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [gateFilter, setGateFilter] = useState<string>('');

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createCategory, setCreateCategory] = useState<string>('TICKET_ISSUE');
  const [createGateId, setCreateGateId] = useState<string>('');
  const [createTicketId, setCreateTicketId] = useState<string>('');
  const [createDescription, setCreateDescription] = useState<string>('');
  const [createSeverity, setCreateSeverity] = useState<string>('MEDIUM');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Resolve Modal
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<IncidentItem | null>(null);
  const [resolveStatus, setResolveStatus] = useState<string>('RESOLVED');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [resolveSubmitting, setResolveSubmitting] = useState(false);

  const loadIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (selectedDate) queryParams.set('date', selectedDate);
      if (statusFilter) queryParams.set('status', statusFilter);
      if (categoryFilter) queryParams.set('category', categoryFilter);
      if (gateFilter) queryParams.set('gateId', gateFilter);

      const qs = queryParams.toString();
      const res = await fetchApi(`/admin/incidents${qs ? `?${qs}` : ''}`);

      if (res) {
        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.incidents)
          ? res.incidents
          : Array.isArray(res)
          ? res
          : [];
        setIncidents(list);

        if (res.metrics) {
          setMetrics({
            totalCount: res.metrics.totalCount ?? list.length,
            openCount:
              res.metrics.openCount ?? list.filter((i: any) => i.status === 'OPEN').length,
            inReviewCount:
              res.metrics.inReviewCount ??
              list.filter((i: any) => i.status === 'IN_REVIEW').length,
            resolvedCount:
              res.metrics.resolvedCount ??
              list.filter((i: any) => i.status === 'RESOLVED' || i.status === 'CLOSED').length,
          });
        } else {
          setMetrics({
            totalCount: list.length,
            openCount: list.filter((i: any) => i.status === 'OPEN').length,
            inReviewCount: list.filter((i: any) => i.status === 'IN_REVIEW').length,
            resolvedCount: list.filter(
              (i: any) => i.status === 'RESOLVED' || i.status === 'CLOSED',
            ).length,
          });
        }

        if (Array.isArray(res.gates)) {
          setGates(res.gates);
        }

        if (res.categories && typeof res.categories === 'object') {
          setCategories(res.categories);
        }

        if (res.selectedDate && !selectedDate) {
          setSelectedDate(res.selectedDate);
        }
      }
    } catch (err: any) {
      console.error('Error fetching incidents:', err);
      setMsg({ text: err.message || 'Failed to load incidents', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedDate, statusFilter, categoryFilter, gateFilter]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const handleResetFilters = () => {
    setSelectedDate('');
    setStatusFilter('');
    setCategoryFilter('');
    setGateFilter('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const desc = createDescription.trim();
    if (!desc || desc.length < 5) {
      alert('Detailed description is required (minimum 5 characters).');
      return;
    }

    setCreateSubmitting(true);
    try {
      await fetchApi('/admin/incidents', {
        method: 'POST',
        body: JSON.stringify({
          category: createCategory,
          gate_id: createGateId ? createGateId : undefined,
          gateId: createGateId ? createGateId : undefined,
          ticket_id: createTicketId.trim() ? createTicketId.trim() : undefined,
          ticketId: createTicketId.trim() ? createTicketId.trim() : undefined,
          description: desc,
          severity: createSeverity,
          title: `${CATEGORIES_MAP[createCategory] || createCategory} incident`,
        }),
      });

      setShowCreateModal(false);
      setCreateDescription('');
      setCreateTicketId('');
      setCreateGateId('');
      setMsg({ text: 'Incident successfully recorded and dispatched.', type: 'success' });
      loadIncidents();
    } catch (err: any) {
      alert(err.message || 'Failed to log incident.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openResolveModal = (inc: IncidentItem) => {
    setSelectedIncident(inc);
    setResolveStatus('RESOLVED');
    setResolutionNotes(inc.resolution_notes || inc.resolutionNotes || '');
    setShowResolveModal(true);
  };

  const closeResolveModal = () => {
    setShowResolveModal(false);
    setSelectedIncident(null);
    setResolutionNotes('');
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    const notes = resolutionNotes.trim();
    if (!notes || notes.length < 3) {
      alert('Mandatory resolution notes are required to resolve/update an incident.');
      return;
    }

    setResolveSubmitting(true);
    try {
      await fetchApi(`/admin/incidents/${selectedIncident.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          status: resolveStatus,
          resolution_notes: notes,
          resolutionNotes: notes,
        }),
      });

      closeResolveModal();
      setMsg({
        text: `Incident ${selectedIncident.incidentNumber} marked as ${resolveStatus}.`,
        type: 'success',
      });
      loadIncidents();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve incident.');
    } finally {
      setResolveSubmitting(false);
    }
  };

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

      {/* Header Card with Metrics */}
      <div className="p-6 rounded-3xl bg-white border border-stone-200/80 card-shadow space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-outfit font-extrabold text-2xl text-ink flex items-center gap-2.5">
              <AlertTriangle className="w-6 h-6 text-maroon shrink-0" />
              <span>Gate &amp; Operations Incident Log</span>
            </h2>
            <p className="text-xs text-ink-soft mt-0.5">
              Log, escalate, and resolve gate issues, duplicate claims, capacity bottlenecks, and
              security matters.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadIncidents}
              disabled={loading}
              title="Refresh list"
              className="p-2.5 rounded-xl border border-stone-200 bg-white hover:bg-cream-soft text-ink transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-maroon ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 rounded-xl bg-maroon hover:bg-maroon-dark text-white text-xs font-bold transition flex items-center gap-2 shrink-0 shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Log New Incident</span>
            </button>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/70">
            <div className="text-[10px] font-bold text-stone-500 uppercase">Total Incidents</div>
            <div className="font-outfit font-extrabold text-xl text-ink mt-0.5">
              {metrics.totalCount}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/70">
            <div className="text-[10px] font-bold text-rose-700 uppercase">
              Open / Action Required
            </div>
            <div className="font-outfit font-extrabold text-xl text-rose-800 mt-0.5">
              {metrics.openCount}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/70">
            <div className="text-[10px] font-bold text-amber-700 uppercase">In Review</div>
            <div className="font-outfit font-extrabold text-xl text-amber-800 mt-0.5">
              {metrics.inReviewCount}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/70">
            <div className="text-[10px] font-bold text-emerald-700 uppercase">Resolved</div>
            <div className="font-outfit font-extrabold text-xl text-emerald-800 mt-0.5">
              {metrics.resolvedCount}
            </div>
          </div>
        </div>

        {/* Filters Form */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 text-xs">
          <input
            type="date"
            name="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 bg-cream-soft font-semibold text-ink focus:outline-maroon"
          />

          <select
            name="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 bg-white font-medium text-ink focus:outline-maroon"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_REVIEW">IN_REVIEW</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>

          <select
            name="category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 bg-white font-medium text-ink focus:outline-maroon"
          >
            <option value="">All Categories</option>
            {Object.entries(categories).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            name="gate_id"
            value={gateFilter}
            onChange={(e) => setGateFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 bg-white font-medium text-ink focus:outline-maroon"
          >
            <option value="">All Gates</option>
            {gates.map((gate) => (
              <option key={gate.id} value={gate.id}>
                {gate.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadIncidents}
            className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-ink font-bold transition cursor-pointer"
          >
            Filter
          </button>
          {(selectedDate || statusFilter || categoryFilter || gateFilter) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-2 rounded-xl text-stone-500 hover:text-stone-800 font-semibold transition cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50/80 text-stone-600 font-bold border-b border-stone-200/70">
                <th className="py-3.5 px-4">Incident ID &amp; Time</th>
                <th className="py-3.5 px-3">Category</th>
                <th className="py-3.5 px-4">Description &amp; Context</th>
                <th className="py-3.5 px-3">Gate / Reporter</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {incidents.length > 0 ? (
                incidents.map((inc) => {
                  const incCode = inc.incident_id || inc.incidentNumber;
                  const categoryTitle =
                    categories[inc.category] || inc.categoryLabel || inc.category;
                  const isResolved = inc.status === 'RESOLVED' || inc.status === 'CLOSED';

                  return (
                    <tr key={inc.id} className="hover:bg-cream/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-ink">{incCode}</div>
                        <div className="text-[11px] text-stone-400">
                          {inc.incident_date ? inc.incident_date : 'Today'}
                          {inc.incident_time ? ` • ${inc.incident_time}` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-stone-100 text-stone-700">
                          {categoryTitle}
                        </span>
                        {(inc.ticket_id || inc.ticketId) && (
                          <div className="font-mono text-[10px] text-maroon mt-0.5 font-bold">
                            {inc.ticket_id || inc.ticketId}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-sm">
                        <p className="text-xs text-ink/80 leading-relaxed">{inc.description}</p>
                        {isResolved && (inc.resolution_notes || inc.resolutionNotes) && (
                          <div className="mt-1.5 p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900">
                            <span className="font-bold text-emerald-800">Resolution:</span>{' '}
                            {inc.resolution_notes || inc.resolutionNotes}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-stone-800">
                          {inc.gate?.name || 'General Perimeter'}
                        </div>
                        <div className="text-[11px] text-stone-400">
                          By: {inc.reportedBy?.name || 'Staff'}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        {inc.status === 'OPEN' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />{' '}
                            OPEN
                          </span>
                        ) : inc.status === 'IN_REVIEW' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            IN REVIEW
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <Check className="w-3 h-3 text-emerald-600" />{' '}
                            {inc.status === 'CLOSED' ? 'CLOSED' : 'RESOLVED'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {!isResolved ? (
                          <button
                            type="button"
                            onClick={() => openResolveModal(inc)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs cursor-pointer"
                          >
                            Resolve
                          </button>
                        ) : (
                          <span className="text-[11px] text-stone-400 font-medium">Closed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-stone-400 font-medium">
                    No incidents logged for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Incident Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-stone-200 card-shadow space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5 text-maroon">
                <div className="w-9 h-9 rounded-xl bg-maroon/10 text-maroon flex items-center justify-center font-bold">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-outfit font-extrabold text-base text-ink">
                    Log New Incident
                  </h4>
                  <p className="text-[11px] text-ink-soft">Event-day operational report</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Incident Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={createCategory}
                  onChange={(e) => setCreateCategory(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-200 bg-white font-medium focus:outline-maroon"
                >
                  {Object.entries(categories).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Related Entry Gate (Optional)
                </label>
                <select
                  value={createGateId}
                  onChange={(e) => setCreateGateId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-200 bg-white font-medium focus:outline-maroon"
                >
                  <option value="">None / General Venue</option>
                  {gates.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} {g.code ? `(${g.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Ticket ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. NR2026-0042"
                  value={createTicketId}
                  onChange={(e) => setCreateTicketId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-200 font-mono focus:outline-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the occurrence, people involved, or action taken..."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-maroon"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-maroon hover:bg-maroon-dark text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {createSubmitting ? 'Saving...' : 'Save Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Incident Modal */}
      {showResolveModal && selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-emerald-200 card-shadow space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
              <div className="flex items-center gap-2.5 text-emerald-700">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-outfit font-extrabold text-base text-ink">
                    Resolve Incident
                  </h4>
                  <p className="text-[11px] text-emerald-700 font-semibold font-mono">
                    {selectedIncident.incident_id || selectedIncident.incidentNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeResolveModal}
                className="text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResolve} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Status</label>
                <select
                  value={resolveStatus}
                  onChange={(e) => setResolveStatus(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-200 bg-white font-medium focus:outline-emerald-600"
                >
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="IN_REVIEW">IN_REVIEW</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Resolution Notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Action taken to address and close this incident..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeResolveModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolveSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {resolveSubmitting ? 'Saving...' : 'Mark as Resolved'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
