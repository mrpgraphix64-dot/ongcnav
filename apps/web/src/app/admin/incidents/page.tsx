'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Filter,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { IncidentCategory, IncidentSeverity, IncidentStatus } from '@ongc/shared-types';

export default function AdminIncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [gateId, setGateId] = useState('1');
  const [category, setCategory] = useState<IncidentCategory>(IncidentCategory.SECURITY);
  const [severity, setSeverity] = useState<IncidentSeverity>(IncidentSeverity.MEDIUM);

  // Resolution Modal State
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resStatus, setResStatus] = useState<IncidentStatus>(IncidentStatus.RESOLVED);

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const data = await fetchApi('/admin/incidents');
      setIncidents(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/admin/incidents', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          gateId,
          category,
          severity,
        }),
      });
      setShowAddModal(false);
      setTitle('');
      setDescription('');
      loadIncidents();
    } catch (e: any) {
      alert(e.message || 'Failed to report incident');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi(`/admin/incidents/${selectedIncident.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: resStatus,
          resolutionNotes,
        }),
      });
      setSelectedIncident(null);
      setResolutionNotes('');
      loadIncidents();
    } catch (e: any) {
      alert(e.message || 'Failed to update incident');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            Security & Incident Log
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track real-time gate incidents, crowd surges, medical alerts, and security escalations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadIncidents}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-900/30"
          >
            <Plus className="w-4 h-4" />
            <span>Report Incident</span>
          </button>
        </div>
      </div>

      {/* Incidents List */}
      <div className="space-y-3">
        {incidents.map((inc) => (
          <div
            key={inc.id}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold text-amber-400">
                  {inc.incidentNumber}
                </span>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    inc.severity === IncidentSeverity.CRITICAL
                      ? 'bg-red-950 text-red-400 border border-red-500/60 animate-pulse'
                      : inc.severity === IncidentSeverity.HIGH
                      ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                      : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {inc.severity}
                </span>

                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  {inc.category}
                </span>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    inc.status === IncidentStatus.RESOLVED || inc.status === IncidentStatus.CLOSED
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                      : 'bg-yellow-950/80 text-yellow-300 border border-yellow-500/40'
                  }`}
                >
                  {inc.status}
                </span>
              </div>

              <h3 className="text-base font-bold text-white">{inc.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{inc.description}</p>

              <div className="text-[11px] text-slate-500 flex flex-wrap gap-3 pt-1">
                <span>Gate: <strong className="text-slate-400">{inc.gate?.name || 'All Gates'}</strong></span>
                <span>•</span>
                <span>Reported By: {inc.reportedBy?.name || 'Staff'}</span>
                <span>•</span>
                <span>{new Date(inc.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
              </div>

              {inc.resolutionNotes && (
                <div className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-emerald-300">
                  <span className="font-bold">Resolution:</span> {inc.resolutionNotes}
                </div>
              )}
            </div>

            <div>
              {inc.status !== IncidentStatus.RESOLVED && inc.status !== IncidentStatus.CLOSED && (
                <button
                  onClick={() => {
                    setSelectedIncident(inc);
                    setResStatus(IncidentStatus.RESOLVED);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-colors"
                >
                  Update / Resolve
                </button>
              )}
            </div>
          </div>
        ))}

        {incidents.length === 0 && !loading && (
          <div className="p-12 text-center text-slate-500 rounded-3xl bg-slate-900 border border-slate-800">
            No active incidents reported. All gates operating normally.
          </div>
        )}
      </div>

      {/* Report Incident Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-lg font-bold text-white">Report New Incident</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Incident Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Crowd congestion at turnstile 2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                  >
                    <option value={IncidentCategory.SECURITY}>Security Alert</option>
                    <option value={IncidentCategory.CROWD}>Crowd Congestion</option>
                    <option value={IncidentCategory.MEDICAL}>Medical Emergency</option>
                    <option value={IncidentCategory.VIP}>VIP Escort</option>
                    <option value={IncidentCategory.SYSTEM}>System / Network</option>
                    <option value={IncidentCategory.OTHER}>Other Issue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                  >
                    <option value={IncidentSeverity.LOW}>Low</option>
                    <option value={IncidentSeverity.MEDIUM}>Medium</option>
                    <option value={IncidentSeverity.HIGH}>High</option>
                    <option value={IncidentSeverity.CRITICAL}>Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Gate Location
                </label>
                <select
                  value={gateId}
                  onChange={(e) => setGateId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                >
                  <option value="1">Gate 1 (Main Entrance)</option>
                  <option value="2">Gate 2 (Officers Entry)</option>
                  <option value="3">Gate 3 (Family Turnstile)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Detailed Description *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe what occurred and immediate actions taken..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                >
                  Submit Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Incident Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-lg font-bold text-white">Resolve Incident</h3>
            <p className="text-xs text-slate-400">
              Updating <strong className="text-white">{selectedIncident.incidentNumber}</strong>
            </p>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  New Status
                </label>
                <select
                  value={resStatus}
                  onChange={(e) => setResStatus(e.target.value as IncidentStatus)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                >
                  <option value={IncidentStatus.IN_PROGRESS}>In Progress</option>
                  <option value={IncidentStatus.RESOLVED}>Resolved</option>
                  <option value={IncidentStatus.CLOSED}>Closed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Resolution Notes
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Actions taken to clear the incident..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  Save Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
