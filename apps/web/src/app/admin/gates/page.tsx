'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  DoorOpen,
  PlusCircle,
  MapPin,
  Users,
  ChevronRight,
  Power,
  Edit3,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Calendar,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  staffId?: string | null;
  staff_id?: string | null;
  role: string;
  isActive?: boolean;
}

interface GateRecord {
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
  capacityEnabled: boolean;
  blockWhenFull: boolean;
  todayCheckinCount: number;
  today_checkins_count: number;
  users: StaffUser[];
}

const GATE_TYPES = ['General', 'Staff', 'Family', 'VIP', 'VVIP', 'Other'];

export default function AdminGatesPage() {
  const [gates, setGates] = useState<GateRecord[]>([]);
  const [availableStaff, setAvailableStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [msg, setMsg] = useState<{
    text: string;
    type: 'success' | 'warning' | 'error';
  } | null>(null);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    type: 'General',
    location: '',
    description: '',
    status: 'active',
    staff_ids: [] as string[],
  });

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    code: '',
    type: 'General',
    location: '',
    description: '',
    status: 'active',
    staff_ids: [] as string[],
  });

  // Safe Delete Confirmation Modal
  const [gateToDelete, setGateToDelete] = useState<GateRecord | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [gatesData, staffData] = await Promise.all([
        fetchApi('/admin/gates'),
        fetchApi('/admin/gates/available-staff').catch(() =>
          fetchApi('/admin/staff').catch(() => []),
        ),
      ]);

      const parsedGates: GateRecord[] = Array.isArray(gatesData)
        ? gatesData
        : gatesData?.gates || [];
      const parsedStaff: StaffUser[] = Array.isArray(staffData)
        ? staffData
        : staffData?.staff || [];

      setGates(parsedGates);
      setAvailableStaff(parsedStaff);
    } catch (e: any) {
      setMsg({
        text: e.message || 'Failed to load event gates',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Total checkins summary
  const totalGates = gates.length;
  const activeGates = gates.filter(
    (g) => g.status === 'active' || g.gateStatus === 'ACTIVE',
  ).length;
  const totalTodayCheckins = gates.reduce(
    (acc, g) => acc + (g.today_checkins_count || g.todayCheckinCount || 0),
    0,
  );

  // Filtered gates
  const filteredGates = gates.filter((gate) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      gate.name?.toLowerCase().includes(q) ||
      gate.code?.toLowerCase().includes(q) ||
      gate.location?.toLowerCase().includes(q) ||
      gate.type?.toLowerCase().includes(q)
    );
  });

  // Open Edit Modal
  const openEdit = (gate: GateRecord) => {
    setEditForm({
      id: gate.id,
      name: gate.name || '',
      code: gate.code || gate.gateNumber || '',
      type: gate.type || 'General',
      location: gate.location || '',
      description: gate.description || '',
      status: (gate.status || 'active').toLowerCase(),
      staff_ids: (gate.users || []).map((u) => u.id),
    });
    setShowEditModal(true);
  };

  // Toggle Active Status
  const handleToggleStatus = async (gate: GateRecord) => {
    try {
      setActionLoading(`toggle-${gate.id}`);
      const res = await fetchApi(`/admin/gates/${gate.id}/toggle-status`, {
        method: 'POST',
      });
      await loadData();
      setMsg({
        text: res?.message || `Gate '${gate.name}' status updated.`,
        type: 'success',
      });
    } catch (e: any) {
      setMsg({
        text: e.message || 'Failed to toggle gate status',
        type: 'error',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Create Gate
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading('create');
      const payload = {
        name: createForm.name.trim(),
        code: createForm.code.trim().toUpperCase(),
        type: createForm.type,
        location: createForm.location.trim() || undefined,
        description: createForm.description.trim() || undefined,
        status: createForm.status,
        staff_ids: createForm.staff_ids,
      };

      await fetchApi('/admin/gates', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setShowCreateModal(false);
      setCreateForm({
        name: '',
        code: '',
        type: 'General',
        location: '',
        description: '',
        status: 'active',
        staff_ids: [],
      });
      await loadData();
      setMsg({
        text: `Gate '${payload.name}' (${payload.code}) created successfully.`,
        type: 'success',
      });
    } catch (e: any) {
      alert(e.message || 'Failed to create gate');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Edit Gate
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading('edit');
      const payload = {
        name: editForm.name.trim(),
        code: editForm.code.trim().toUpperCase(),
        type: editForm.type,
        location: editForm.location.trim() || undefined,
        description: editForm.description.trim() || undefined,
        status: editForm.status,
        staff_ids: editForm.staff_ids,
      };

      await fetchApi(`/admin/gates/${editForm.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setShowEditModal(false);
      await loadData();
      setMsg({
        text: `Gate '${payload.name}' updated successfully.`,
        type: 'success',
      });
    } catch (e: any) {
      alert(e.message || 'Failed to update gate');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Safe Delete
  const handleConfirmDelete = async () => {
    if (!gateToDelete) return;
    try {
      setActionLoading(`delete-${gateToDelete.id}`);
      const res = await fetchApi(`/admin/gates/${gateToDelete.id}`, {
        method: 'DELETE',
      });

      setGateToDelete(null);
      await loadData();

      if (res?.action === 'deactivated' || res?.warning) {
        setMsg({
          text:
            res.warning ||
            `Gate '${gateToDelete.name}' has historical entry records and cannot be permanently deleted. It has been deactivated to preserve complete audit reporting.`,
          type: 'warning',
        });
      } else {
        setMsg({
          text:
            res?.message || `Gate '${gateToDelete.name}' was deleted successfully.`,
          type: 'success',
        });
      }
    } catch (e: any) {
      setMsg({
        text: e.message || 'Failed to delete gate',
        type: 'error',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Multi-select helper
  const toggleStaffSelection = (
    staffId: string,
    isEdit: boolean,
  ) => {
    if (isEdit) {
      setEditForm((prev) => {
        const exists = prev.staff_ids.includes(staffId);
        return {
          ...prev,
          staff_ids: exists
            ? prev.staff_ids.filter((id) => id !== staffId)
            : [...prev.staff_ids, staffId],
        };
      });
    } else {
      setCreateForm((prev) => {
        const exists = prev.staff_ids.includes(staffId);
        return {
          ...prev,
          staff_ids: exists
            ? prev.staff_ids.filter((id) => id !== staffId)
            : [...prev.staff_ids, staffId],
        };
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Alert Message */}
      {msg && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 text-sm font-medium transition-all ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : msg.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : msg.type === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p>{msg.text}</p>
            </div>
          </div>
          <button
            onClick={() => setMsg(null)}
            className="text-stone-400 hover:text-stone-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Stats & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200/70 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
              Total Gates
            </div>
            <div className="font-outfit font-black text-2xl text-maroon">
              {totalGates}
            </div>
          </div>
          <div className="h-8 w-px bg-stone-200 hidden sm:block"></div>
          <div>
            <div className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
              Active Gates
            </div>
            <div className="font-outfit font-black text-2xl text-emerald-600">
              {activeGates}
            </div>
          </div>
          <div className="h-8 w-px bg-stone-200 hidden sm:block"></div>
          <div>
            <div className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
              Today&apos;s Check-ins
            </div>
            <div className="font-outfit font-black text-2xl text-ink">
              {totalTodayCheckins}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-stone-200 text-ink-soft hover:text-ink hover:bg-stone-50 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-maroon text-white font-semibold text-sm hover:bg-maroon-light transition-all shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-gold-light" />
            <span>Add Event Gate</span>
          </button>
        </div>
      </div>

      {/* Search / Filter Bar */}
      {gates.length > 0 && (
        <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-stone-200/70 max-w-md shadow-sm">
          <Search className="w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search gate name, code, type, or landmark..."
            className="w-full text-xs bg-transparent focus:outline-none text-ink placeholder:text-stone-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Gates Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredGates.map((gate) => {
          const isActive =
            gate.status === 'active' || gate.gateStatus === 'ACTIVE';
          const checkinCount =
            gate.today_checkins_count ?? gate.todayCheckinCount ?? 0;
          const assignedCount = gate.users?.length ?? 0;

          return (
            <div
              key={gate.id}
              className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5 flex flex-col justify-between hover:border-gold/50 transition-all group"
            >
              <div className="space-y-3.5">
                {/* Header: Name, Code & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-maroon text-gold-light text-xs font-black font-outfit uppercase tracking-wider">
                        {gate.code || gate.gateNumber || `G${gate.id}`}
                      </span>
                      <h3 className="font-outfit font-bold text-lg text-ink group-hover:text-maroon transition-colors">
                        {gate.name}
                      </h3>
                    </div>
                    <div className="text-xs text-ink-soft mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gold shrink-0" />
                      <span>{gate.location || 'Location not specified'}</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-600 border border-stone-200">
                      Inactive
                    </span>
                  )}
                </div>

                {/* Type Badge & Description */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wide bg-amber-50 text-amber-800 border border-amber-200">
                    {gate.type || 'General'} Entry
                  </span>
                  {gate.description && (
                    <p className="text-xs text-ink-soft line-clamp-1 w-full">
                      {gate.description}
                    </p>
                  )}
                </div>

                {/* Assigned Staff & Today's Volume */}
                <div className="bg-cream-soft rounded-xl p-3 border border-stone-200/60 grid grid-cols-2 gap-3 text-center">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-soft">
                      Assigned Staff
                    </div>
                    <div className="font-outfit font-bold text-base text-ink mt-0.5">
                      {assignedCount} Staff
                    </div>
                  </div>
                  <div className="border-l border-stone-200/80 pl-3">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-soft">
                      Today&apos;s Check-ins
                    </div>
                    <div className="font-outfit font-black text-base text-maroon mt-0.5">
                      {checkinCount}
                    </div>
                  </div>
                </div>

                {/* Staff Names list */}
                {gate.users && gate.users.length > 0 ? (
                  <div className="text-xs text-ink-soft">
                    <span className="font-semibold text-ink">Operators: </span>
                    <span className="truncate">
                      {gate.users.map((u) => u.name).join(', ')}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-amber-700 italic">
                    No operators assigned yet
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="pt-4 mt-4 border-t border-stone-100 flex items-center justify-between gap-2">
                <Link
                  href={`/admin/gates/${gate.id}`}
                  className="text-xs font-bold text-maroon hover:text-maroon-dark inline-flex items-center gap-1 group-hover:underline"
                >
                  <span>View Activity</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>

                <div className="flex items-center gap-1">
                  {/* Toggle Active Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(gate)}
                    disabled={actionLoading === `toggle-${gate.id}`}
                    className="p-1.5 rounded-lg text-ink-soft hover:text-ink hover:bg-stone-100 transition-colors"
                    title={isActive ? 'Deactivate Gate' : 'Activate Gate'}
                  >
                    <Power
                      className={`w-4 h-4 ${
                        isActive
                          ? 'text-stone-400 hover:text-rose-600'
                          : 'text-emerald-600'
                      }`}
                    />
                  </button>

                  {/* Edit Button */}
                  <button
                    onClick={() => openEdit(gate)}
                    type="button"
                    className="p-1.5 rounded-lg text-ink-soft hover:text-maroon hover:bg-cream-soft transition-colors"
                    title="Edit Gate"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {/* Safe Delete Button */}
                  <button
                    onClick={() => setGateToDelete(gate)}
                    type="button"
                    className="p-1.5 rounded-lg text-ink-soft hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete Gate"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredGates.length === 0 && !loading && (
          <div className="col-span-full bg-white rounded-2xl border border-stone-200 p-12 text-center">
            <DoorOpen className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <h3 className="font-outfit font-bold text-lg text-ink">
              {searchQuery ? 'No Matching Gates Found' : 'No Event Gates Found'}
            </h3>
            <p className="text-sm text-ink-soft mt-1">
              {searchQuery
                ? 'Try adjusting your search criteria.'
                : 'Create your first entry gate to organize attendee check-ins.'}
            </p>
          </div>
        )}
      </div>

      {/* CREATE GATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 border border-stone-200 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-outfit font-bold text-lg text-maroon flex items-center gap-2">
                <DoorOpen className="w-5 h-5 text-gold" />
                <span>Create Event Entry Gate</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-ink-soft hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink uppercase mb-1">
                    Gate Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    placeholder="e.g. Gate 1, VIP North Gate"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink uppercase mb-1">
                    Gate Code (Unique) *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.code}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g. G1, G2, VIP-1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm uppercase focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink uppercase mb-1">
                    Gate Type *
                  </label>
                  <select
                    required
                    value={createForm.type}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, type: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                  >
                    {GATE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type} Entry
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink uppercase mb-1">
                    Status *
                  </label>
                  <select
                    required
                    value={createForm.status}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, status: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink uppercase mb-1">
                  Location / Landmark
                </label>
                <input
                  type="text"
                  value={createForm.location}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, location: e.target.value })
                  }
                  placeholder="e.g. Near West Parking, Main Pavilion"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink uppercase mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Operational instructions or notes for scanning operators"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                />
              </div>

              {/* Assigned Staff Multiselect */}
              <div>
                <label className="block text-xs font-bold text-ink uppercase mb-1">
                  Assign Staff Operators ({createForm.staff_ids.length} Selected)
                </label>
                <div className="max-h-36 overflow-y-auto border border-stone-200 rounded-xl p-2.5 space-y-1.5 bg-cream-soft">
                  {availableStaff.map((staff) => (
                    <label
                      key={staff.id}
                      className="flex items-center gap-2.5 text-xs text-ink cursor-pointer hover:bg-white p-1.5 rounded-lg transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={createForm.staff_ids.includes(staff.id)}
                        onChange={() => toggleStaffSelection(staff.id, false)}
                        className="rounded text-maroon focus:ring-maroon border-stone-300"
                      />
                      <span className="font-semibold">{staff.name}</span>
                      <span className="text-ink-soft">
                        ({staff.staff_id || staff.staffId || staff.role})
                      </span>
                    </label>
                  ))}
                  {availableStaff.length === 0 && (
                    <div className="text-xs text-ink-soft py-2 text-center">
                      No active staff available. Create staff under Staff
                      Management.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-ink-soft hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create'}
                  className="px-5 py-2.5 rounded-xl bg-maroon text-white text-sm font-semibold hover:bg-maroon-light transition-all shadow-sm disabled:opacity-50"
                >
                  {actionLoading === 'create' ? 'Creating...' : 'Create Gate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT GATE MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 border border-stone-200 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-outfit font-bold text-lg text-maroon flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-gold" />
                <span>Edit Event Gate</span>
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-ink-soft hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink uppercase mb-1">
                    Gate Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink uppercase mb-1">
                    Gate Code (Unique) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.code}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm uppercase focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink uppercase mb-1">
                    Gate Type *
                  </label>
                  <select
                    required
                    value={editForm.type}
                    onChange={(e) =>
                      setEditForm({ ...editForm, type: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                  >
                    {GATE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type} Entry
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink uppercase mb-1">
                    Status *
                  </label>
                  <select
                    required
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({ ...editForm, status: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink uppercase mb-1">
                  Location / Landmark
                </label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) =>
                    setEditForm({ ...editForm, location: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink uppercase mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                />
              </div>

              {/* Assigned Staff Multiselect */}
              <div>
                <label className="block text-xs font-bold text-ink uppercase mb-1">
                  Assign Staff Operators ({editForm.staff_ids.length} Selected)
                </label>
                <div className="max-h-36 overflow-y-auto border border-stone-200 rounded-xl p-2.5 space-y-1.5 bg-cream-soft">
                  {availableStaff.map((staff) => (
                    <label
                      key={staff.id}
                      className="flex items-center gap-2.5 text-xs text-ink cursor-pointer hover:bg-white p-1.5 rounded-lg transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={editForm.staff_ids.includes(staff.id)}
                        onChange={() => toggleStaffSelection(staff.id, true)}
                        className="rounded text-maroon focus:ring-maroon border-stone-300"
                      />
                      <span className="font-semibold">{staff.name}</span>
                      <span className="text-ink-soft">
                        ({staff.staff_id || staff.staffId || staff.role})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-ink-soft hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'edit'}
                  className="px-5 py-2.5 rounded-xl bg-maroon text-white text-sm font-semibold hover:bg-maroon-light transition-all shadow-sm disabled:opacity-50"
                >
                  {actionLoading === 'edit' ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SAFE DELETE CONFIRMATION MODAL */}
      {gateToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-outfit font-bold text-lg text-ink">
                  Remove Gate &lsquo;{gateToDelete.name}&rsquo;?
                </h3>
                <span className="text-xs text-ink-soft">
                  Code: {gateToDelete.code || gateToDelete.gateNumber}
                </span>
              </div>
            </div>

            <p className="text-xs text-ink-soft leading-relaxed">
              Are you sure you want to remove this gate?
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-normal">
              <strong>Historical Data Protection:</strong> If this gate has any
              historical scan or check-in records, it will <em>not</em> be
              deleted. Instead, it will be safely deactivated to protect audit
              compliance.
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setGateToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-soft hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={actionLoading === `delete-${gateToDelete.id}`}
                className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all shadow-sm disabled:opacity-50"
              >
                {actionLoading === `delete-${gateToDelete.id}`
                  ? 'Processing...'
                  : 'Confirm Removal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
