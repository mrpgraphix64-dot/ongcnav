'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Edit3,
  History,
  UserCheck,
  UserX,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  DoorOpen,
  KeyRound,
  Mail,
  Phone,
  Hash,
  Shield,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface GateItem {
  id: string;
  name: string;
  code?: string;
  gateNumber?: string;
  type?: string;
  isOpen?: boolean;
}

interface StaffRecord {
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
  last_activity_at?: string | null;
  gates: GateItem[];
  assignedGates: GateItem[];
  createdAt?: string;
}

const ROLES_MAP: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  EVENT_ADMIN: 'Event Admin',
  GATE_MANAGER: 'Gate Manager',
  SCANNER_STAFF: 'Scanner Staff',
  REGISTRATION_STAFF: 'Registration Staff',
  REPORT_VIEWER: 'Report Viewer',
};

export default function AdminStaffPage() {
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [gatesList, setGatesList] = useState<GateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    staff_id: '',
    email: '',
    mobile: '',
    role: 'SCANNER_STAFF',
    status: 'active',
    password: '',
    gate_ids: [] as string[],
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    staff_id: '',
    email: '',
    mobile: '',
    role: 'SCANNER_STAFF',
    status: 'active',
    password: '',
    gate_ids: [] as string[],
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [staffData, gatesData] = await Promise.all([
        fetchApi<StaffRecord[]>('/admin/staff'),
        fetchApi<any[]>('/admin/gates'),
      ]);

      setStaffList(Array.isArray(staffData) ? staffData : []);
      const mappedGates: GateItem[] = Array.isArray(gatesData)
        ? gatesData.map((g: any) => ({
            id: g.id?.toString() || '',
            name: g.name || '',
            code: g.code || g.gateNumber || `G-${g.id}`,
            gateNumber: g.gateNumber || g.code || `G-${g.id}`,
            type: g.type || g.gateType || 'General',
            isOpen: g.isOpen ?? true,
          }))
        : [];
      setGatesList(mappedGates);
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to load staff records', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      // Role filter
      if (selectedRole !== 'ALL' && staff.role !== selectedRole) {
        return false;
      }
      // Status filter
      if (selectedStatus !== 'ALL') {
        const staffStatus = staff.isActive ? 'active' : 'inactive';
        if (staffStatus !== selectedStatus) return false;
      }
      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const name = (staff.name || '').toLowerCase();
        const email = (staff.email || '').toLowerCase();
        const phone = (staff.mobile || staff.phone || '').toLowerCase();
        const sId = (staff.staffId || staff.staff_id || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !phone.includes(q) && !sId.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [staffList, selectedRole, selectedStatus, searchQuery]);

  const activeOperatorsCount = useMemo(() => {
    return staffList.filter((s) => s.isActive || s.status === 'active').length;
  }, [staffList]);

  // Handle Create Staff
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name || !createForm.email || !createForm.password) {
      setMsg({ text: 'Please fill in all required fields.', type: 'error' });
      return;
    }

    try {
      setCreateSubmitting(true);
      await fetchApi('/admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name,
          email: createForm.email,
          mobile: createForm.mobile || undefined,
          staff_id: createForm.staff_id || undefined,
          role: createForm.role,
          status: createForm.status,
          password: createForm.password,
          gate_ids: createForm.gate_ids,
        }),
      });

      setShowCreateModal(false);
      setCreateForm({
        name: '',
        staff_id: '',
        email: '',
        mobile: '',
        role: 'SCANNER_STAFF',
        status: 'active',
        password: '',
        gate_ids: [],
      });
      setMsg({ text: `Staff operator created successfully.`, type: 'success' });
      loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to create staff member', type: 'error' });
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (staff: StaffRecord) => {
    const existingGateIds = (staff.gates || staff.assignedGates || []).map((g) => g.id);
    setEditForm({
      id: staff.id,
      name: staff.name,
      staff_id: staff.staffId || staff.staff_id || '',
      email: staff.email,
      mobile: staff.mobile || staff.phone || '',
      role: staff.role,
      status: staff.isActive ? 'active' : 'inactive',
      password: '',
      gate_ids: existingGateIds,
    });
    setShowEditModal(true);
  };

  // Handle Update Staff
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name || !editForm.email || !editForm.staff_id) {
      setMsg({ text: 'Please fill in required fields.', type: 'error' });
      return;
    }

    try {
      setEditSubmitting(true);
      await fetchApi(`/admin/staff/${editForm.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editForm.name,
          staff_id: editForm.staff_id,
          email: editForm.email,
          mobile: editForm.mobile || undefined,
          role: editForm.role,
          status: editForm.status,
          password: editForm.password ? editForm.password : undefined,
          gate_ids: editForm.gate_ids,
        }),
      });

      setShowEditModal(false);
      setMsg({ text: `Staff member '${editForm.name}' updated successfully.`, type: 'success' });
      loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to update staff member', type: 'error' });
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle Toggle Status
  const handleToggleStatus = async (staff: StaffRecord) => {
    try {
      setTogglingId(staff.id);
      await fetchApi(`/admin/staff/${staff.id}/toggle`, {
        method: 'POST',
      });
      const newStatus = staff.isActive ? 'deactivated' : 'activated';
      setMsg({ text: `Staff account '${staff.name}' ${newStatus}.`, type: 'success' });
      loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to toggle staff status', type: 'error' });
    } finally {
      setTogglingId(null);
    }
  };

  // Format timestamp
  const formatTimeAgo = (isoString?: string | null) => {
    if (!isoString) return 'No activity yet';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'No activity yet';
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'No activity yet';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action & Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200/70 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Total Staff
            </div>
            <div className="font-outfit font-black text-2xl text-[#7A1113]">
              {staffList.length}
            </div>
          </div>
          <div className="h-8 w-px bg-stone-200 hidden sm:block"></div>
          <div>
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Active Operators
            </div>
            <div className="font-outfit font-black text-2xl text-emerald-600">
              {activeOperatorsCount}
            </div>
          </div>
          <div className="h-8 w-px bg-stone-200 hidden sm:block"></div>
          <div>
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Active Gates
            </div>
            <div className="font-outfit font-black text-2xl text-stone-900">
              {gatesList.length}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            title="Refresh Staff Data"
            className="p-2.5 rounded-xl border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#7A1113] hover:bg-[#8F1417] text-white font-semibold text-sm transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4 text-amber-300" />
            <span>Add Staff Operator</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {msg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
          <button
            onClick={() => setMsg(null)}
            className="text-stone-400 hover:text-stone-700 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/70 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search staff by name, email, mobile, or staff ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Role Filter */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 bg-white focus:outline-none focus:border-[#7A1113]"
          >
            <option value="ALL">All Roles</option>
            {Object.entries(ROLES_MAP).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 bg-white focus:outline-none focus:border-[#7A1113]"
          >
            <option value="ALL">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Staff Directory Table */}
      <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF7F2] border-b border-stone-200/70 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Staff Member</th>
                <th className="px-5 py-3.5">Staff ID</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Assigned Gates</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Last Activity</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-900">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-stone-400">
                    <Users className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                    <p className="font-semibold text-stone-600">
                      {staffList.length === 0
                        ? 'No staff members created yet.'
                        : 'No staff matching the search filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => {
                  const initials = (staff.name || 'ST')
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  const roleBadgeClass =
                    staff.role === 'SUPER_ADMIN'
                      ? 'bg-rose-100 text-rose-900 border-rose-200'
                      : staff.role === 'EVENT_ADMIN'
                      ? 'bg-[#7A1113]/10 text-[#7A1113] border-[#7A1113]/20'
                      : staff.role === 'GATE_MANAGER'
                      ? 'bg-amber-100 text-amber-900 border-amber-200'
                      : staff.role === 'SCANNER_STAFF'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                      : staff.role === 'REGISTRATION_STAFF'
                      ? 'bg-blue-100 text-blue-900 border-blue-200'
                      : 'bg-stone-100 text-stone-800 border-stone-200';

                  const isUnrestricted =
                    staff.role === 'SUPER_ADMIN' || staff.role === 'EVENT_ADMIN';
                  const assignedGates = staff.gates || staff.assignedGates || [];

                  return (
                    <tr key={staff.id} className="hover:bg-[#FAF7F2]/40 transition-colors">
                      {/* Name & Contact */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#7A1113] text-white font-outfit font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-stone-900 truncate">
                              {staff.name}
                            </div>
                            <div className="text-[11px] text-stone-500 truncate">
                              {staff.email}
                            </div>
                            {(staff.mobile || staff.phone) && (
                              <div className="text-[10px] text-stone-400">
                                {staff.mobile || staff.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Staff ID */}
                      <td className="px-5 py-4 font-mono font-bold text-[#7A1113] whitespace-nowrap">
                        {staff.staffId || staff.staff_id || '—'}
                      </td>

                      {/* Role Badge */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-extrabold border ${roleBadgeClass}`}
                        >
                          {ROLES_MAP[staff.role] || staff.role}
                        </span>
                      </td>

                      {/* Assigned Gates */}
                      <td className="px-5 py-4">
                        {isUnrestricted ? (
                          <span className="text-xs font-semibold text-emerald-700 italic">
                            All Gates (Unrestricted)
                          </span>
                        ) : assignedGates.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {assignedGates.map((gate) => (
                              <span
                                key={gate.id}
                                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#FAF7F2] border border-stone-200 text-stone-800"
                              >
                                {gate.name} ({gate.code || gate.gateNumber || `G-${gate.id}`})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-700 italic">No gates assigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {staff.isActive || staff.status === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Last Activity */}
                      <td className="px-5 py-4 whitespace-nowrap text-stone-500">
                        {formatTimeAgo(staff.last_activity_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Activity */}
                          <Link
                            href={`/admin/staff/${staff.id}/activity`}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-[#7A1113] hover:bg-[#FAF7F2] transition-colors"
                            title="View Operator Activity Logs"
                          >
                            <History className="w-4 h-4" />
                          </Link>

                          {/* Edit Staff */}
                          <button
                            onClick={() => openEditModal(staff)}
                            type="button"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-[#7A1113] hover:bg-[#FAF7F2] transition-colors"
                            title="Edit Staff Member"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Toggle Status */}
                          <button
                            onClick={() => handleToggleStatus(staff)}
                            disabled={togglingId === staff.id}
                            type="button"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors disabled:opacity-50"
                            title={
                              staff.isActive
                                ? 'Deactivate Operator Account'
                                : 'Activate Operator Account'
                            }
                          >
                            {staff.isActive ? (
                              <UserX className="w-4 h-4 text-stone-400 hover:text-rose-600 transition-colors" />
                            ) : (
                              <UserCheck className="w-4 h-4 text-emerald-600" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE STAFF MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 border border-stone-200 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-outfit font-bold text-lg text-[#7A1113] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-500" />
                <span>Create Staff Operator Account</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Staff ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. STF-101 (Auto if blank)"
                    value={createForm.staff_id}
                    onChange={(e) => setCreateForm({ ...createForm, staff_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm uppercase focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Email (Login ID) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="rahul@ongc.co.in"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    value={createForm.mobile}
                    onChange={(e) => setCreateForm({ ...createForm, mobile: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Role *
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
                  >
                    {Object.entries(ROLES_MAP).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Account Status *
                  </label>
                  <select
                    value={createForm.status}
                    onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Password * (Min 6 characters)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
                />
              </div>

              {/* Assigned Gates Multi-select */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Assigned Gate(s)
                </label>
                <div className="max-h-36 overflow-y-auto border border-stone-200 rounded-xl p-2.5 space-y-1.5 bg-[#FAF7F2]">
                  {gatesList.length === 0 ? (
                    <div className="text-xs text-stone-400 py-2 text-center">
                      No active gates available. Create gates under Gates Management.
                    </div>
                  ) : (
                    gatesList.map((gate) => {
                      const checked = createForm.gate_ids.includes(gate.id);
                      return (
                        <label
                          key={gate.id}
                          className="flex items-center gap-2.5 text-xs text-stone-800 cursor-pointer hover:bg-white p-1.5 rounded-lg transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCreateForm({
                                  ...createForm,
                                  gate_ids: [...createForm.gate_ids, gate.id],
                                });
                              } else {
                                setCreateForm({
                                  ...createForm,
                                  gate_ids: createForm.gate_ids.filter((id) => id !== gate.id),
                                });
                              }
                            }}
                            className="rounded text-[#7A1113] focus:ring-[#7A1113] border-stone-300"
                          />
                          <span className="font-bold font-outfit text-[#7A1113]">
                            {gate.code || gate.gateNumber || `G-${gate.id}`}
                          </span>
                          <span className="font-semibold">{gate.name}</span>
                          <span className="text-stone-400 text-[11px]">
                            ({gate.type || 'General'} Entry)
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Scanner Staff can only scan tickets at their assigned gate(s).
                </p>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-stone-600 hover:text-stone-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#7A1113] hover:bg-[#8F1417] text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
                >
                  {createSubmitting ? 'Creating...' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STAFF MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 border border-stone-200 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-outfit font-bold text-lg text-[#7A1113] flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-500" />
                <span>Edit Staff Account</span>
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Staff ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.staff_id}
                    onChange={(e) => setEditForm({ ...editForm, staff_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm uppercase focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Email (Login ID) *
                  </label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={editForm.mobile}
                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Role *
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
                  >
                    {Object.entries(ROLES_MAP).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Account Status *
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Change Password (Leave blank to keep current)
                </label>
                <input
                  type="password"
                  placeholder="Leave blank to keep existing password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
                />
              </div>

              {/* Assigned Gates Multi-select */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Assigned Gate(s)
                </label>
                <div className="max-h-36 overflow-y-auto border border-stone-200 rounded-xl p-2.5 space-y-1.5 bg-[#FAF7F2]">
                  {gatesList.map((gate) => {
                    const checked = editForm.gate_ids.includes(gate.id);
                    return (
                      <label
                        key={gate.id}
                        className="flex items-center gap-2.5 text-xs text-stone-800 cursor-pointer hover:bg-white p-1.5 rounded-lg transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditForm({
                                ...editForm,
                                gate_ids: [...editForm.gate_ids, gate.id],
                              });
                            } else {
                              setEditForm({
                                ...editForm,
                                gate_ids: editForm.gate_ids.filter((id) => id !== gate.id),
                              });
                            }
                          }}
                          className="rounded text-[#7A1113] focus:ring-[#7A1113] border-stone-300"
                        />
                        <span className="font-bold font-outfit text-[#7A1113]">
                          {gate.code || gate.gateNumber || `G-${gate.id}`}
                        </span>
                        <span className="font-semibold">{gate.name}</span>
                        <span className="text-stone-400 text-[11px]">
                          ({gate.type || 'General'} Entry)
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-stone-600 hover:text-stone-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#7A1113] hover:bg-[#8F1417] text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
