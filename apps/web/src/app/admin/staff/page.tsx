'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  AlertTriangle,
  X,
  RefreshCw,
  DoorOpen,
  KeyRound,
  Mail,
  Phone,
  Hash,
  Shield,
  Trash2,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import PasswordInput from '@/components/PasswordInput';

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
  COMMERCIAL_ADMIN: 'E-Pass Admin',
  EMPLOYEE_ADMIN: 'Employee Admin',
  COMMERCIAL_AGENT: 'E-Pass Agent',
  COMMERCIAL_SUB_AGENT: 'E-Pass Sub-Agent',
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
  const [createError, setCreateError] = useState<string | null>(null);

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
  const [editError, setEditError] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Staff Delete Modal State
  const [staffToDelete, setStaffToDelete] = useState<StaffRecord | null>(null);
  const [deletingStaff, setDeletingStaff] = useState(false);
  const [staffDeleteError, setStaffDeleteError] = useState<string | null>(null);

  // Staff Deactivate/Activate Confirmation Modal State
  const [staffToToggle, setStaffToToggle] = useState<StaffRecord | null>(null);
  const [togglingStaff, setTogglingStaff] = useState(false);

  // Reset Password Modal State
  const [staffToResetPwd, setStaffToResetPwd] = useState<StaffRecord | null>(null);
  const [resetPwdInput, setResetPwdInput] = useState('OngcPass@2026');
  const [resettingPwd, setResettingPwd] = useState(false);
  const [resetPwdError, setResetPwdError] = useState<string | null>(null);

  // Handle ESC key to dismiss any active modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (staffToDelete) {
          setStaffToDelete(null);
          setStaffDeleteError(null);
        } else if (staffToToggle) {
          setStaffToToggle(null);
        } else if (staffToResetPwd) {
          setStaffToResetPwd(null);
          setResetPwdError(null);
        } else if (showEditModal) {
          setShowEditModal(false);
          setEditError(null);
        } else if (showCreateModal) {
          setShowCreateModal(false);
          setCreateError(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [staffToDelete, staffToToggle, staffToResetPwd, showEditModal, showCreateModal]);

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

  // Dedicated single-admin per domain references
  const ePassAdmin = useMemo(() => {
    return staffList.find((s) => s.role === 'COMMERCIAL_ADMIN') || null;
  }, [staffList]);

  const employeeAdmin = useMemo(() => {
    return staffList.find((s) => s.role === 'EMPLOYEE_ADMIN') || null;
  }, [staffList]);

  // Handle Create Staff
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!createForm.name?.trim() || !createForm.email?.trim() || !createForm.password) {
      setCreateError('Please fill in all required fields.');
      return;
    }

    try {
      setCreateSubmitting(true);
      await fetchApi('/admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          mobile: createForm.mobile?.trim() || undefined,
          staff_id: createForm.staff_id?.trim() || undefined,
          role: createForm.role,
          status: createForm.status,
          password: createForm.password,
          gate_ids: createForm.gate_ids,
        }),
      });

      setShowCreateModal(false);
      setCreateError(null);
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
      setCreateError(e.message || 'Failed to create staff member');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (staff: StaffRecord) => {
    const existingGateIds = (staff.gates || staff.assignedGates || []).map((g) => g.id);
    setEditError(null);
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
    setEditError(null);
    if (!editForm.name?.trim() || !editForm.email?.trim() || !editForm.staff_id?.trim()) {
      setEditError('Please fill in required fields.');
      return;
    }

    try {
      setEditSubmitting(true);
      await fetchApi(`/admin/staff/${editForm.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editForm.name.trim(),
          staff_id: editForm.staff_id.trim(),
          email: editForm.email.trim(),
          mobile: editForm.mobile?.trim() || undefined,
          role: editForm.role,
          status: editForm.status,
          password: editForm.password?.trim() ? editForm.password.trim() : undefined,
          gate_ids: editForm.gate_ids,
        }),
      });

      setShowEditModal(false);
      setEditError(null);
      setMsg({ text: `Staff member '${editForm.name}' updated successfully.`, type: 'success' });
      loadData();
    } catch (e: any) {
      setEditError(e.message || 'Failed to update staff member');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle Confirm Toggle Status
  const handleConfirmToggleStaff = async () => {
    if (!staffToToggle) return;
    try {
      setTogglingStaff(true);
      await fetchApi(`/admin/staff/${staffToToggle.id}/toggle`, {
        method: 'POST',
      });
      const newStatus = staffToToggle.isActive ? 'deactivated' : 'activated';
      setMsg({ text: `Staff account '${staffToToggle.name}' ${newStatus}.`, type: 'success' });
      setStaffToToggle(null);
      loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to toggle staff status', type: 'error' });
    } finally {
      setTogglingStaff(false);
    }
  };

  // Handle Confirm Delete Staff
  const handleConfirmDeleteStaff = async () => {
    if (!staffToDelete) return;
    try {
      setDeletingStaff(true);
      setStaffDeleteError(null);
      const res = await fetchApi<any>(`/admin/staff/${staffToDelete.id}`, {
        method: 'DELETE',
      });
      setMsg({ text: res.message || 'Staff member deleted successfully.', type: 'success' });
      setStaffToDelete(null);
      loadData();
    } catch (e: any) {
      setStaffDeleteError(e.message || 'Failed to delete staff member.');
    } finally {
      setDeletingStaff(false);
    }
  };

  // Handle Confirm Reset Password
  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffToResetPwd) return;
    try {
      setResettingPwd(true);
      setResetPwdError(null);
      const res = await fetchApi<any>(`/admin/staff/${staffToResetPwd.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: resetPwdInput }),
      });
      setMsg({ text: res.message || 'Password reset successfully.', type: 'success' });
      setStaffToResetPwd(null);
    } catch (e: any) {
      setResetPwdError(e.message || 'Failed to reset password.');
    } finally {
      setResettingPwd(false);
    }
  };

  // Handle Deactivate Instead from Delete Modal
  const handleDeactivateInsteadFromDeleteModal = async () => {
    if (!staffToDelete) return;
    try {
      setDeletingStaff(true);
      await fetchApi(`/admin/staff/${staffToDelete.id}/toggle`, {
        method: 'POST',
      });
      setMsg({ text: `Staff account '${staffToDelete.name}' deactivated.`, type: 'success' });
      setStaffToDelete(null);
      setStaffDeleteError(null);
      loadData();
    } catch (e: any) {
      setStaffDeleteError(e.message || 'Failed to deactivate staff account.');
    } finally {
      setDeletingStaff(false);
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

      {/* ADMINISTRATORS SECTION */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200/70 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#7A1113]" />
            <h3 className="font-outfit font-bold text-base text-stone-900">
              Domain Administrators
            </h3>
            <span className="text-[11px] font-semibold text-stone-500 bg-stone-100 px-2.5 py-0.5 rounded-full border border-stone-200">
              Strict 1 Admin Per Domain
            </span>
          </div>
          <p className="text-xs text-stone-500 hidden sm:block">
            Global authority managed by Super Admin
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* E-Pass Admin Card */}
          <div className="p-4 rounded-xl border border-stone-200 bg-[#FAF7F2]/60 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#7A1113]/10 text-[#7A1113] flex items-center justify-center font-bold text-xs shrink-0 border border-[#7A1113]/20">
                  EP
                </div>
                <div>
                  <h4 className="font-outfit font-bold text-sm text-stone-900">
                    E-Pass Admin
                  </h4>
                  <span className="text-[10px] font-mono font-bold text-stone-500">
                    Role: COMMERCIAL_ADMIN
                  </span>
                </div>
              </div>

              {ePassAdmin ? (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    ePassAdmin.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-stone-100 text-stone-600 border-stone-200'
                  }`}
                >
                  {ePassAdmin.isActive ? 'Active' : 'Inactive'}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Not Configured
                </span>
              )}
            </div>

            {ePassAdmin ? (
              <div className="space-y-2 text-xs">
                <div className="bg-white p-3 rounded-lg border border-stone-200/80 space-y-1 shadow-xs">
                  <div className="font-bold text-stone-900">{ePassAdmin.name}</div>
                  <div className="text-[11px] text-stone-500">{ePassAdmin.email}</div>
                  {(ePassAdmin.mobile || ePassAdmin.phone) && (
                    <div className="text-[11px] text-stone-400">
                      {ePassAdmin.mobile || ePassAdmin.phone}
                    </div>
                  )}
                  <div className="text-[10px] text-stone-400 pt-1.5 border-t border-stone-100 flex items-center justify-between">
                    <span>Staff ID: <strong className="font-mono text-[#7A1113]">{ePassAdmin.staffId || '—'}</strong></span>
                    <span>Last active: {formatTimeAgo(ePassAdmin.last_activity_at)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    E-Pass Admin already exists
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(ePassAdmin)}
                      className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 font-semibold text-xs transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setStaffToToggle(ePassAdmin)}
                      className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 font-semibold text-xs transition-colors"
                    >
                      {ePassAdmin.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffToResetPwd(ePassAdmin);
                        setResetPwdInput('OngcPass@2026');
                      }}
                      className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 font-semibold text-xs transition-colors"
                    >
                      Reset Password
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 bg-white rounded-lg border border-dashed border-stone-200 space-y-2">
                <p className="text-xs text-stone-500">
                  No E-Pass Admin configured for commercial orders, allocations, and inventory.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCreateForm((prev) => ({
                      ...prev,
                      role: 'COMMERCIAL_ADMIN',
                    }));
                    setShowCreateModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7A1113] hover:bg-[#8F1417] text-white font-bold text-xs shadow-xs transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create E-Pass Admin</span>
                </button>
              </div>
            )}
          </div>

          {/* Employee Admin Card */}
          <div className="p-4 rounded-xl border border-stone-200 bg-[#FAF7F2]/60 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-200">
                  EA
                </div>
                <div>
                  <h4 className="font-outfit font-bold text-sm text-stone-900">
                    Employee Admin
                  </h4>
                  <span className="text-[10px] font-mono font-bold text-stone-500">
                    Role: EMPLOYEE_ADMIN
                  </span>
                </div>
              </div>

              {employeeAdmin ? (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    employeeAdmin.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-stone-100 text-stone-600 border-stone-200'
                  }`}
                >
                  {employeeAdmin.isActive ? 'Active' : 'Inactive'}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Not Configured
                </span>
              )}
            </div>

            {employeeAdmin ? (
              <div className="space-y-2 text-xs">
                <div className="bg-white p-3 rounded-lg border border-stone-200/80 space-y-1 shadow-xs">
                  <div className="font-bold text-stone-900">{employeeAdmin.name}</div>
                  <div className="text-[11px] text-stone-500">{employeeAdmin.email}</div>
                  {(employeeAdmin.mobile || employeeAdmin.phone) && (
                    <div className="text-[11px] text-stone-400">
                      {employeeAdmin.mobile || employeeAdmin.phone}
                    </div>
                  )}
                  <div className="text-[10px] text-stone-400 pt-1.5 border-t border-stone-100 flex items-center justify-between">
                    <span>Staff ID: <strong className="font-mono text-[#7A1113]">{employeeAdmin.staffId || '—'}</strong></span>
                    <span>Last active: {formatTimeAgo(employeeAdmin.last_activity_at)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Employee Admin already exists
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(employeeAdmin)}
                      className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 font-semibold text-xs transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setStaffToToggle(employeeAdmin)}
                      className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 font-semibold text-xs transition-colors"
                    >
                      {employeeAdmin.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffToResetPwd(employeeAdmin);
                        setResetPwdInput('OngcPass@2026');
                      }}
                      className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 font-semibold text-xs transition-colors"
                    >
                      Reset Password
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 bg-white rounded-lg border border-dashed border-stone-200 space-y-2">
                <p className="text-xs text-stone-500">
                  No Employee Admin configured for registrations, attendees, and employee operations.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCreateForm((prev) => ({
                      ...prev,
                      role: 'EMPLOYEE_ADMIN',
                    }));
                    setShowCreateModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Employee Admin</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

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

                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              setStaffToResetPwd(staff);
                              setResetPwdInput('OngcPass@2026');
                            }}
                            type="button"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                            title="Reset Password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Toggle Status (opens confirmation modal) */}
                          <button
                            onClick={() => setStaffToToggle(staff)}
                            type="button"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                            title={
                              staff.isActive
                                ? 'Deactivate Operator Account'
                                : 'Activate Operator Account'
                            }
                          >
                            {staff.isActive ? (
                              <UserX className="w-4 h-4 text-stone-400 hover:text-amber-600 transition-colors" />
                            ) : (
                              <UserCheck className="w-4 h-4 text-emerald-600" />
                            )}
                          </button>

                          {/* Delete Staff (opens confirmation modal) */}
                          <button
                            onClick={() => {
                              setStaffToDelete(staff);
                              setStaffDeleteError(null);
                            }}
                            type="button"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Staff Account"
                          >
                            <Trash2 className="w-4 h-4 text-stone-400 hover:text-rose-600" />
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
      {mounted && showCreateModal && createPortal(
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
              setCreateError(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 sm:space-y-5 border border-stone-200 shadow-2xl my-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-outfit font-bold text-lg text-[#7A1113] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-500" />
                <span>Create Staff Operator Account</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError(null);
                }}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="name"
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
                    autoComplete="off"
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
                    autoComplete="username"
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
                    autoComplete="tel"
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
                    {Object.entries(ROLES_MAP).map(([val, label]) => {
                      const isEPassDisabled = val === 'COMMERCIAL_ADMIN' && !!ePassAdmin && ePassAdmin.isActive;
                      const isEmployeeDisabled = val === 'EMPLOYEE_ADMIN' && !!employeeAdmin && employeeAdmin.isActive;
                      const isDisabled = isEPassDisabled || isEmployeeDisabled;

                      return (
                        <option key={val} value={val} disabled={isDisabled}>
                          {label} {isDisabled ? '(Already exists)' : ''}
                        </option>
                      );
                    })}
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
                <PasswordInput
                  required
                  placeholder="••••••••"
                  autoComplete="new-password"
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
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError(null);
                  }}
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
        </div>,
        document.body
      )}

      {/* EDIT STAFF MODAL */}
      {mounted && showEditModal && createPortal(
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEditModal(false);
              setEditError(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 sm:space-y-5 border border-stone-200 shadow-2xl my-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-outfit font-bold text-lg text-[#7A1113] flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-500" />
                <span>Edit Staff Account</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditError(null);
                }}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="name"
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
                    autoComplete="off"
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
                    autoComplete="username"
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
                    autoComplete="tel"
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
                    {Object.entries(ROLES_MAP).map(([val, label]) => {
                      const isEPassDisabled =
                        val === 'COMMERCIAL_ADMIN' &&
                        !!ePassAdmin &&
                        ePassAdmin.isActive &&
                        ePassAdmin.id !== editForm.id;
                      const isEmployeeDisabled =
                        val === 'EMPLOYEE_ADMIN' &&
                        !!employeeAdmin &&
                        employeeAdmin.isActive &&
                        employeeAdmin.id !== editForm.id;
                      const isDisabled = isEPassDisabled || isEmployeeDisabled;

                      return (
                        <option key={val} value={val} disabled={isDisabled}>
                          {label} {isDisabled ? '(Already exists)' : ''}
                        </option>
                      );
                    })}
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
                <PasswordInput
                  placeholder="Leave blank to keep existing password"
                  autoComplete="new-password"
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
                  onClick={() => {
                    setShowEditModal(false);
                    setEditError(null);
                  }}
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
        </div>,
        document.body
      )}

      {/* DELETE STAFF CONFIRMATION MODAL */}
      {mounted && staffToDelete && createPortal(
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setStaffToDelete(null);
              setStaffDeleteError(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-2xl my-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-outfit font-bold text-lg text-stone-900">
                  Delete Staff Account
                </h3>
                <p className="text-xs text-stone-500">
                  Irreversible administrative operation
                </p>
              </div>
            </div>

            {/* Staff Details Card */}
            <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-500">Staff Name:</span>
                <span className="font-bold text-stone-900">{staffToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Staff ID:</span>
                <span className="font-mono font-bold text-[#7A1113]">
                  {staffToDelete.staffId || staffToDelete.staff_id || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Email:</span>
                <span className="font-semibold text-stone-700">{staffToDelete.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Role:</span>
                <span className="font-bold text-stone-800">
                  {ROLES_MAP[staffToDelete.role] || staffToDelete.role}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Status:</span>
                <span
                  className={`font-bold ${
                    staffToDelete.isActive ? 'text-emerald-700' : 'text-stone-500'
                  }`}
                >
                  {staffToDelete.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Error / Audit Safety Notice */}
            {staffDeleteError ? (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-3">
                <div className="flex items-start gap-2 text-rose-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span className="font-medium leading-relaxed">{staffDeleteError}</span>
                </div>
                <div className="pt-2 border-t border-rose-200/70 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-rose-700 font-semibold">
                    Recommendation:
                  </span>
                  <button
                    type="button"
                    disabled={deletingStaff}
                    onClick={handleDeactivateInsteadFromDeleteModal}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all"
                  >
                    {deletingStaff ? 'Deactivating...' : 'Deactivate Instead'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-stone-600 leading-relaxed">
                Are you sure you want to permanently delete this staff account? If this account
                has performed scans, issued passes, or generated audit logs, the backend will
                safely protect historical records and recommend deactivation instead.
              </p>
            )}

            {/* Action Buttons */}
            <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setStaffToDelete(null);
                  setStaffDeleteError(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingStaff}
                onClick={handleConfirmDeleteStaff}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              >
                {deletingStaff ? 'Checking & Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* TOGGLE STATUS (ACTIVATE / DEACTIVATE) CONFIRMATION MODAL */}
      {mounted && staffToToggle && createPortal(
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setStaffToToggle(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-2xl my-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  staffToToggle.isActive
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                {staffToToggle.isActive ? (
                  <UserX className="w-5 h-5" />
                ) : (
                  <UserCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-outfit font-bold text-lg text-stone-900">
                  {staffToToggle.isActive
                    ? 'Deactivate Staff Account'
                    : 'Activate Staff Account'}
                </h3>
                <p className="text-xs text-stone-500">
                  {staffToToggle.isActive
                    ? 'Disable login and operational access'
                    : 'Restore login and scanner access'}
                </p>
              </div>
            </div>

            <div className="bg-[#FAF7F2] rounded-xl p-3.5 border border-stone-200 text-xs space-y-1.5">
              <div>
                <span className="text-stone-500">Staff Member: </span>
                <span className="font-bold text-stone-900">{staffToToggle.name}</span>
              </div>
              <div>
                <span className="text-stone-500">Staff ID: </span>
                <span className="font-mono font-bold text-[#7A1113]">
                  {staffToToggle.staffId || staffToToggle.staff_id || '—'}
                </span>
              </div>
              <div>
                <span className="text-stone-500">Role: </span>
                <span className="font-bold text-stone-800">
                  {ROLES_MAP[staffToToggle.role] || staffToToggle.role}
                </span>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              {staffToToggle.isActive
                ? 'Deactivating will immediately prevent this user from logging in or scanning passes at gates. Historical scans and pass issuance audit logs remain completely preserved.'
                : 'Activating will immediately restore login and operational access for this staff member.'}
            </p>

            <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setStaffToToggle(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={togglingStaff}
                onClick={handleConfirmToggleStaff}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50 ${
                  staffToToggle.isActive
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {togglingStaff
                  ? 'Updating...'
                  : staffToToggle.isActive
                  ? 'Deactivate Staff'
                  : 'Activate Staff'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* RESET PASSWORD MODAL */}
      {mounted && staffToResetPwd && createPortal(
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-stone-900/60 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setStaffToResetPwd(null);
              setResetPwdError(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-2xl my-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-stone-900">
              <div className="w-10 h-10 rounded-full bg-[#7A1113]/10 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5 text-[#7A1113]" />
              </div>
              <div>
                <h3 className="font-outfit font-bold text-lg text-stone-900">
                  Reset Staff Password
                </h3>
                <p className="text-xs text-stone-500">
                  Set a new password for this operator account
                </p>
              </div>
            </div>

            <div className="bg-[#FAF7F2] rounded-xl p-3.5 border border-stone-200 text-xs space-y-1">
              <div>
                <span className="text-stone-500">Staff Member: </span>
                <span className="font-bold text-stone-900">{staffToResetPwd.name}</span>
              </div>
              <div>
                <span className="text-stone-500">Email (Login): </span>
                <span className="font-semibold text-stone-700">{staffToResetPwd.email}</span>
              </div>
            </div>

            {resetPwdError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{resetPwdError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  New Password *
                </label>
                <PasswordInput
                  required
                  minLength={6}
                  value={resetPwdInput}
                  onChange={(e) => setResetPwdInput(e.target.value)}
                  placeholder="Enter new secure password"
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113] font-mono"
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  Provide this temporary/new password to the operator so they can sign in.
                </p>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStaffToResetPwd(null);
                    setResetPwdError(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPwd || !resetPwdInput.trim()}
                  className="px-4 py-2 rounded-xl bg-[#7A1113] hover:bg-[#8F1417] text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {resettingPwd ? 'Updating Password...' : 'Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
