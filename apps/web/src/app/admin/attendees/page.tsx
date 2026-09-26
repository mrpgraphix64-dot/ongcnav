'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  UserPlus,
  UploadCloud,
  QrCode,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Trash2,
  Eye,
  FileSpreadsheet,
  Check,
  ShieldCheck,
  Calendar,
  Phone,
  Mail,
  User,
  ExternalLink,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface EmployeeData {
  id: string;
  name: string;
  cpf_no?: string;
  mobile_no?: string;
  designation?: string;
  department?: string;
  bookingDays?: string[];
  has_photo?: boolean;
  photo_url?: string | null;
}

interface CommercialOrderData {
  id: string;
  orderNumber: string;
  customerName: string;
  customerMobile: string;
  customerEmail: string;
  ticketType: string;
  quantity: number;
  unitPricePaise: number;
  amountPaise: number;
  amountInr: number;
  orderStatus: string;
  paymentStatus: string;
  selectedDates: string[];
  paidAt?: string | null;
}

interface AttendeeItem {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
  ticket_id: string;
  ticketNumber: string;
  secure_token: string;
  category: string;
  status: string;
  rawStatus?: string;
  relation?: string;
  age?: number;
  gender?: string;
  checked_in_at?: string | null;
  gate?: string | null;
  employee_id?: string | null;
  employee?: EmployeeData | null;
  family_tickets?: AttendeeItem[];
  qr_svg?: string;
  isCommercialOrder?: boolean;
  order_id?: string | null;
  order?: CommercialOrderData | null;
  passes?: AttendeeItem[];
  passesCount?: number;
  bookingDays?: string[];
}

interface SummaryMetrics {
  total_registrations: number;
  total_people: number;
  total_employees: number;
  total_family_members: number;
}

export default function AdminAttendeesPage() {
  const [metrics, setMetrics] = useState<SummaryMetrics>({
    total_registrations: 0,
    total_people: 0,
    total_employees: 0,
    total_family_members: 0,
  });
  const [primaryAttendees, setPrimaryAttendees] = useState<AttendeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Multi-selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupByRegistration, setGroupByRegistration] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Modals
  const [qrModalAttendee, setQrModalAttendee] = useState<AttendeeItem | null>(null);
  const [employeeModal, setEmployeeModal] = useState<EmployeeData | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    mobile: '',
    email: '',
    category: 'General',
  });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Live Statuses
  const [liveStatuses, setLiveStatuses] = useState<
    Record<string, { status: string; gate: string; checked_in_at: string | null }>
  >({});

  // Load Primary Attendees
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        status: statusFilter,
        category: categoryFilter,
      });
      if (search.trim() !== '') params.append('search', search.trim());

      const res = await fetchApi<any>(`/admin/attendees?${params.toString()}`);
      if (res) {
        setMetrics(
          res.metrics || {
            total_registrations: 0,
            total_people: 0,
            total_employees: 0,
            total_family_members: 0,
          },
        );
        const list: AttendeeItem[] = res.primaryAttendees || res.attendees || [];
        setPrimaryAttendees(list);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
        }

        // Initialize live statuses from payload
        const initialStatusMap: Record<string, any> = {};
        for (const p of list) {
          initialStatusMap[p.id] = {
            status: p.status,
            gate: p.gate || 'Main Gate',
            checked_in_at: p.checked_in_at,
          };
          if (p.family_tickets) {
            for (const f of p.family_tickets) {
              initialStatusMap[f.id] = {
                status: f.status,
                gate: f.gate || 'Main Gate',
                checked_in_at: f.checked_in_at,
              };
            }
          }
        }
        setLiveStatuses((prev) => ({ ...prev, ...initialStatusMap }));
      }
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to load attendees', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, categoryFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live status synchronization polling every 3.5 seconds
  useEffect(() => {
    const allIds: string[] = [];
    for (const p of primaryAttendees) {
      allIds.push(p.id);
      if (p.family_tickets) {
        for (const f of p.family_tickets) {
          allIds.push(f.id);
        }
      }
    }
    if (allIds.length === 0) return;

    const timer = setInterval(async () => {
      try {
        const syncRes = await fetchApi<any>(
          `/admin/attendees/status-sync?ids=${allIds.join(',')}`,
        );
        if (syncRes && syncRes.statuses) {
          setLiveStatuses((prev) => ({ ...prev, ...syncRes.statuses }));
        }
      } catch {
        // Non-blocking sync error
      }
    }, 3500);

    return () => clearInterval(timer);
  }, [primaryAttendees]);

  // All IDs on current page
  const pageIds = useMemo(() => {
    const ids: string[] = [];
    for (const p of primaryAttendees) {
      if (!ids.includes(p.id)) ids.push(p.id);
      const subList = p.passes || p.family_tickets;
      if (subList) {
        for (const f of subList) {
          if (!ids.includes(f.id)) {
            ids.push(f.id);
          }
        }
      }
    }
    return ids;
  }, [primaryAttendees]);

  const allSelected = pageIds.length > 0 && selectedIds.length === pageIds.length;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : [...pageIds]);
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const expandAll = () => setCollapsedGroups({});
  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const p of primaryAttendees) {
      next[`group_${p.id}`] = true;
    }
    setCollapsedGroups(next);
  };

  // Quick Add Attendee
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = addForm.email.trim();
    if (!cleanEmail) {
      setMsg({
        text: 'Email address is required because your digital QR pass will be sent here.',
        type: 'error',
      });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setMsg({
        text: 'Please enter a valid email address.',
        type: 'error',
      });
      return;
    }

    try {
      setAddSubmitting(true);
      const res = await fetchApi<any>('/admin/attendees', {
        method: 'POST',
        body: JSON.stringify({
          ...addForm,
          email: cleanEmail.toLowerCase(),
        }),
      });

      setShowAddModal(false);
      setAddForm({ name: '', mobile: '', email: '', category: 'General' });
      setMsg({
        text: res.message || 'Attendee created successfully!',
        type: 'success',
      });
      loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to add attendee', type: 'error' });
    } finally {
      setAddSubmitting(false);
    }
  };

  // Single Actions
  const handleRegenerateQr = async (id: string, ticketNumber: string) => {
    try {
      await fetchApi(`/admin/attendees/${id}/regenerate-qr`, { method: 'POST' });
      setMsg({ text: `QR Code for Ticket ${ticketNumber} regenerated!`, type: 'success' });
      loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to regenerate QR', type: 'error' });
    }
  };

  const handleDeleteAttendee = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete attendee '${name}'?`)) return;
    try {
      await fetchApi(`/admin/attendees/${id}`, { method: 'DELETE' });
      setMsg({ text: `Attendee '${name}' deleted successfully.`, type: 'success' });
      loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to delete attendee', type: 'error' });
    }
  };

  // Bulk Actions
  const handleBulkRegenerate = async () => {
    if (selectedIds.length === 0 || bulkBusy) return;
    try {
      setBulkBusy(true);
      const res = await fetchApi<any>('/admin/attendees/bulk/regenerate-qr', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds }),
      });
      setMsg({ text: res.message || 'QR codes regenerated.', type: 'success' });
      setSelectedIds([]);
      loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Bulk regenerate failed', type: 'error' });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0 || bulkBusy) return;
    if (!confirm(`Delete ${selectedIds.length} attendee(s)? This cannot be undone.`)) return;
    try {
      setBulkBusy(true);
      const res = await fetchApi<any>('/admin/attendees/bulk', {
        method: 'DELETE',
        body: JSON.stringify({ ids: selectedIds }),
      });
      setMsg({ text: res.message || 'Attendees deleted.', type: 'success' });
      setSelectedIds([]);
      loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Bulk delete failed', type: 'error' });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkExport = () => {
    const params = new URLSearchParams();
    if (selectedIds.length > 0) {
      params.append('ids', selectedIds.join(','));
    } else {
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
    }
    window.location.href = `/api/attendees/bulk/export?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* TOP SUMMARY METRICS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              Total Registrations
            </div>
            <div className="font-outfit font-black text-2xl text-[#7A1113] mt-0.5">
              {metrics.total_registrations}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#7A1113]/10 text-[#7A1113] flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              Total People
            </div>
            <div className="font-outfit font-black text-2xl text-stone-900 mt-0.5">
              {metrics.total_people}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              ONGC Staff
            </div>
            <div className="font-outfit font-black text-2xl text-emerald-600 mt-0.5">
              {metrics.total_employees}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              Family Members
            </div>
            <div className="font-outfit font-black text-2xl text-blue-600 mt-0.5">
              {metrics.total_family_members}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {msg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Action Bar & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/70 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search by attendee name, mobile, email, ticket ID, or employee CPF..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 text-xs text-stone-800 focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto justify-end">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#7A1113] hover:bg-[#8F1417] text-white text-xs font-bold transition-all shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5 text-amber-300" />
              <span>Quick Add</span>
            </button>

            <Link
              href="/admin/bulk-upload"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-[#FAF7F2] text-stone-700 text-xs font-bold transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5 text-[#7A1113]" />
              <span>Bulk Upload</span>
            </Link>

            <button
              onClick={handleBulkExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-[#FAF7F2] text-stone-700 text-xs font-bold transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              title="Refresh"
              className="p-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters and Grouping Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-stone-100 text-xs">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-stone-700 bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active / Pending</option>
              <option value="checked_in">Checked In</option>
              <option value="suspended">Suspended</option>
              <option value="revoked">Revoked</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-stone-700 bg-white"
            >
              <option value="all">All Categories</option>
              <option value="General">General</option>
              <option value="VIP">VIP</option>
              <option value="VVIP">VVIP</option>
              <option value="ONGC STAFF">ONGC Staff</option>
              <option value="FAMILY MEMBER">Family Member</option>
              <option value="Commercial Pass">All E-Passes</option>
              <option value="DAILY">Daily Pass</option>
              <option value="SEASON">Season Pass</option>
              <option value="MANDLI">Mandli Pass</option>
              <option value="ANY_DAY">Any Day Pass</option>
            </select>
          </div>

          {/* Grouping toggles & Bulk bar */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 text-amber-900 text-xs font-bold">
                <span>{selectedIds.length} Selected</span>
                <button
                  onClick={handleBulkRegenerate}
                  disabled={bulkBusy}
                  className="hover:underline text-[#7A1113]"
                >
                  Regen QR
                </button>
                <span>&bull;</span>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkBusy}
                  className="hover:underline text-rose-600"
                >
                  Delete
                </button>
              </div>
            )}

            <button
              onClick={() => setGroupByRegistration(!groupByRegistration)}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
                groupByRegistration
                  ? 'bg-[#FAF7F2] border-stone-300 text-[#7A1113]'
                  : 'bg-white border-stone-200 text-stone-600'
              }`}
            >
              {groupByRegistration ? 'Grouped by Registration' : 'Flat List'}
            </button>

            {groupByRegistration && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={expandAll}
                  className="px-2 py-1 text-stone-500 hover:text-stone-900 font-semibold"
                >
                  Expand All
                </button>
                <span className="text-stone-300">/</span>
                <button
                  onClick={collapseAll}
                  className="px-2 py-1 text-stone-500 hover:text-stone-900 font-semibold"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ATTENDEE DIRECTORY TABLE */}
      <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF7F2] border-b border-stone-200/70 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded text-[#7A1113] focus:ring-[#7A1113] border-stone-300"
                  />
                </th>
                <th className="px-4 py-3.5">Attendee / Pass Holder</th>
                <th className="px-4 py-3.5">Ticket ID</th>
                <th className="px-4 py-3.5">Registration / Employee</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Live Entry Status</th>
                <th className="px-4 py-3.5">Digital Pass</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-900">
              {loading && primaryAttendees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-stone-400">
                    <RefreshCw className="w-6 h-6 text-stone-300 animate-spin mx-auto mb-2" />
                    <p className="font-semibold text-stone-600">Loading attendee directory...</p>
                  </td>
                </tr>
              ) : primaryAttendees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-stone-400">
                    <Users className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                    <p className="font-semibold text-stone-600">No attendees found.</p>
                  </td>
                </tr>
              ) : (
                primaryAttendees.map((primary) => {
                  const childPasses = primary.passes || primary.family_tickets || [];
                  const hasChildren = childPasses.length > 0;
                  const isCollapsed = collapsedGroups[`group_${primary.id}`];
                  const primarySelected = selectedIds.includes(primary.id);
                  const pLive = liveStatuses[primary.id] || {
                    status: primary.status,
                    gate: primary.gate,
                    checked_in_at: primary.checked_in_at,
                  };
                  const isCheckedIn = pLive.status === 'checked_in';

                  const commCheckedInCount = childPasses.filter(
                    (p) => (liveStatuses[p.id]?.status || p.status) === 'checked_in'
                  ).length;
                  const commTotalCount = childPasses.length;

                  return (
                    <React.Fragment key={primary.id}>
                      {/* Primary Attendee Row / Commercial Order Parent Row */}
                      <tr className="hover:bg-[#FAF7F2]/50 transition-colors bg-white font-medium">
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            checked={primarySelected}
                            onChange={() => toggleSelectId(primary.id)}
                            className="rounded text-[#7A1113] focus:ring-[#7A1113] border-stone-300"
                          />
                        </td>

                        {/* Name & Contact */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            {groupByRegistration && hasChildren ? (
                              <button
                                onClick={() => toggleGroup(`group_${primary.id}`)}
                                className="p-1 rounded hover:bg-stone-100 text-stone-500"
                                title={isCollapsed ? 'Expand passes' : 'Collapse passes'}
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="w-4 h-4 text-[#7A1113]" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-[#7A1113]" />
                                )}
                              </button>
                            ) : (
                              <div className="w-6"></div>
                            )}

                            <div>
                              <div className="font-bold text-stone-900 flex items-center gap-1.5 flex-wrap">
                                <span>{primary.name}</span>
                                {primary.isCommercialOrder ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                    {primary.order?.quantity || commTotalCount || 1} Passes
                                  </span>
                                ) : hasChildren && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#7A1113]/10 text-[#7A1113]">
                                    +{primary.family_tickets?.length} family
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-stone-500 flex items-center gap-2 flex-wrap">
                                {primary.mobile && <span>{primary.mobile}</span>}
                                {primary.email && (
                                  <>
                                    <span>&bull;</span>
                                    <span>{primary.email}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Ticket ID / Commercial Order Number */}
                        <td className="px-4 py-3.5 font-mono font-bold whitespace-nowrap">
                          {primary.isCommercialOrder ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[#7A1113]">
                                {primary.order?.orderNumber || primary.ticketNumber}
                              </span>
                              <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                                Order
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#7A1113]">{primary.ticketNumber}</span>
                          )}
                        </td>

                        {/* Registration / Employee / Commercial Order info */}
                        <td className="px-4 py-3.5">
                          {primary.isCommercialOrder ? (
                            <div>
                              <div className="font-bold text-xs text-stone-800 flex items-center gap-1.5">
                                <span>
                                  ₹{(primary.order?.amountInr ?? (primary.order ? primary.order.amountPaise / 100 : 0)).toLocaleString('en-IN')}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                  {primary.order?.orderStatus || 'PAID'}
                                </span>
                              </div>
                              <div className="text-[10px] text-stone-500">
                                E-Pass Checkout &bull; {primary.order?.quantity || commTotalCount} passes
                              </div>
                            </div>
                          ) : primary.employee ? (
                            <button
                              onClick={() => setEmployeeModal(primary.employee!)}
                              className="text-left group"
                            >
                              <div className="font-bold text-xs text-stone-800 group-hover:text-[#7A1113] flex items-center gap-1">
                                <span>{primary.employee.name}</span>
                                <ExternalLink className="w-3 h-3 text-stone-400 group-hover:text-[#7A1113]" />
                              </div>
                              <div className="text-[10px] text-stone-500">
                                CPF: {primary.employee.cpf_no || '—'} &bull;{' '}
                                {primary.employee.department || ''}
                              </div>
                            </button>
                          ) : (
                            <span className="text-xs text-stone-500 italic">
                              Standalone Attendee
                            </span>
                          )}
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                              primary.isCommercialOrder
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : primary.category === 'VIP' || primary.category === 'VVIP'
                                ? 'bg-amber-100 text-amber-900 border-amber-200'
                                : primary.category === 'ONGC STAFF'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-stone-100 text-stone-700 border-stone-200'
                            }`}
                          >
                            {primary.category}
                          </span>
                        </td>

                        {/* Live Entry Status */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {primary.isCommercialOrder ? (
                            commCheckedInCount > 0 ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  {commCheckedInCount}/{commTotalCount} Checked In
                                </span>
                                {pLive.gate && (
                                  <div className="text-[10px] text-stone-400 mt-0.5">
                                    {pLive.gate}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                                0/{commTotalCount} Checked In
                              </span>
                            )
                          ) : isCheckedIn ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Checked In
                              </span>
                              <div className="text-[10px] text-stone-400 mt-0.5">
                                {pLive.gate || 'Main Gate'}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                              Pending Entry
                            </span>
                          )}
                        </td>

                        {/* Digital Pass / QR */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <button
                            onClick={() => setQrModalAttendee(primary)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-stone-200 text-stone-700 hover:bg-[#FAF7F2] font-semibold text-xs transition-colors"
                          >
                            <QrCode className="w-3.5 h-3.5 text-[#7A1113]" />
                            <span>{primary.isCommercialOrder ? 'View Passes' : 'View Pass'}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <a
                              href={`/api/attendees/${primary.id}/qr-download`}
                              download
                              title="Download QR PNG"
                              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => handleRegenerateQr(primary.id, primary.ticketNumber)}
                              title="Regenerate QR Token"
                              className="p-1.5 rounded-lg text-stone-400 hover:text-[#7A1113] hover:bg-[#FAF7F2]"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAttendee(primary.id, primary.name)}
                              title="Delete Attendee"
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Nested Individual Passes (Commercial Order Children) */}
                      {groupByRegistration &&
                        !isCollapsed &&
                        primary.isCommercialOrder &&
                        childPasses.map((pass, passIdx) => {
                          const passSelected = selectedIds.includes(pass.id);
                          const passLive = liveStatuses[pass.id] || {
                            status: pass.status,
                            gate: pass.gate,
                            checked_in_at: pass.checked_in_at,
                          };
                          const passCheckedIn = passLive.status === 'checked_in';

                          return (
                            <tr
                              key={pass.id}
                              className="bg-[#FAF7F2]/60 hover:bg-[#FAF7F2] transition-colors text-xs border-stone-100"
                            >
                              <td className="px-4 py-2.5">
                                <input
                                  type="checkbox"
                                  checked={passSelected}
                                  onChange={() => toggleSelectId(pass.id)}
                                  className="rounded text-[#7A1113] focus:ring-[#7A1113] border-stone-300"
                                />
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2 pl-8">
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                                  <div>
                                    <div className="font-semibold text-stone-800 flex items-center gap-2">
                                      <span>{pass.name || `Pass Holder #${passIdx + 1}`}</span>
                                      <span className="text-[10px] text-stone-500 font-medium">
                                        (Pass {passIdx + 1} of {childPasses.length})
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-stone-400 flex items-center gap-1.5">
                                      {pass.mobile && <span>{pass.mobile}</span>}
                                      {pass.email && <span>&bull; {pass.email}</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-mono font-bold text-[#7A1113]">
                                {pass.ticketNumber}
                              </td>
                              <td className="px-4 py-2.5 text-stone-500 text-[11px]">
                                {Array.isArray(pass.bookingDays) && pass.bookingDays.length > 0
                                  ? pass.bookingDays.join(', ')
                                  : primary.order?.ticketType || 'E-Pass'}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  {pass.category || primary.category}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                {passCheckedIn ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                      Checked In
                                    </span>
                                    {passLive.gate && (
                                      <div className="text-[10px] text-stone-400 mt-0.5">
                                        {passLive.gate}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-500">
                                    Pending Entry
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <button
                                  onClick={() => setQrModalAttendee(pass)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-stone-200 text-stone-600 hover:bg-white text-[11px]"
                                >
                                  <QrCode className="w-3 h-3 text-[#7A1113]" />
                                  <span>View Pass</span>
                                </button>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <a
                                    href={`/api/attendees/${pass.id}/qr-download`}
                                    download
                                    title="Download QR"
                                    className="p-1 rounded text-stone-400 hover:text-stone-800"
                                  >
                                    <Download className="w-3 h-3" />
                                  </a>
                                  <button
                                    onClick={() => handleRegenerateQr(pass.id, pass.ticketNumber)}
                                    title="Regenerate QR"
                                    className="p-1 rounded text-stone-400 hover:text-[#7A1113]"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAttendee(pass.id, pass.name || pass.ticketNumber)}
                                    title="Delete Pass"
                                    className="p-1 rounded text-stone-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                      {/* Nested Family Tickets (Employee Children) */}
                      {groupByRegistration &&
                        !isCollapsed &&
                        !primary.isCommercialOrder &&
                        primary.family_tickets &&
                        primary.family_tickets.map((fam) => {
                          const famSelected = selectedIds.includes(fam.id);
                          const fLive = liveStatuses[fam.id] || {
                            status: fam.status,
                            gate: fam.gate,
                            checked_in_at: fam.checked_in_at,
                          };
                          const famCheckedIn = fLive.status === 'checked_in';

                          return (
                            <tr
                              key={fam.id}
                              className="bg-[#FAF7F2]/60 hover:bg-[#FAF7F2] transition-colors text-xs border-stone-100"
                            >
                              <td className="px-4 py-2.5">
                                <input
                                  type="checkbox"
                                  checked={famSelected}
                                  onChange={() => toggleSelectId(fam.id)}
                                  className="rounded text-[#7A1113] focus:ring-[#7A1113] border-stone-300"
                                />
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2 pl-8">
                                  <div className="w-1.5 h-1.5 rounded-full bg-stone-300"></div>
                                  <div>
                                    <div className="font-semibold text-stone-800 flex items-center gap-2">
                                      <span>{fam.name}</span>
                                      <span className="text-[10px] text-stone-400 font-normal">
                                        ({fam.relation || 'Family'})
                                      </span>
                                    </div>
                                    {fam.mobile && (
                                      <div className="text-[10px] text-stone-400">
                                        {fam.mobile}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-mono font-bold text-stone-600">
                                {fam.ticketNumber}
                              </td>
                              <td className="px-4 py-2.5 text-stone-400 text-[11px]">
                                Family of {primary.employee?.name || primary.name}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                  Family Member
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                {famCheckedIn ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Checked In
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-500">
                                    Pending
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <button
                                  onClick={() => setQrModalAttendee(fam)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-stone-200 text-stone-600 hover:bg-white text-[11px]"
                                >
                                  <QrCode className="w-3 h-3 text-[#7A1113]" />
                                  <span>Pass</span>
                                </button>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <a
                                    href={`/api/attendees/${fam.id}/qr-download`}
                                    download
                                    title="Download QR"
                                    className="p-1 rounded text-stone-400 hover:text-stone-800"
                                  >
                                    <Download className="w-3 h-3" />
                                  </a>
                                  <button
                                    onClick={() => handleRegenerateQr(fam.id, fam.ticketNumber)}
                                    title="Regenerate QR"
                                    className="p-1 rounded text-stone-400 hover:text-[#7A1113]"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAttendee(fam.id, fam.name)}
                                    title="Delete"
                                    className="p-1 rounded text-stone-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </React.Fragment>
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
              Page <span className="font-bold text-stone-800">{page}</span> of{' '}
              <span className="font-bold text-stone-800">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DIGITAL PASS / QR CODE MODAL */}
      {qrModalAttendee && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 border border-stone-200 shadow-2xl text-center">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">
                ONGC Digital Entry Pass
              </span>
              <button
                onClick={() => setQrModalAttendee(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-stone-200/70 space-y-3">
              <div className="font-outfit font-extrabold text-lg text-stone-900">
                {qrModalAttendee.name}
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-white border border-stone-200 text-[#7A1113]">
                  {qrModalAttendee.ticketNumber}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#7A1113] text-white">
                  {qrModalAttendee.category}
                </span>
              </div>

              {/* QR Code Graphic */}
              <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-inner flex items-center justify-center min-h-[200px]">
                {qrModalAttendee.qr_svg ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: qrModalAttendee.qr_svg }}
                    className="w-48 h-48 mx-auto"
                  />
                ) : (
                  <QrCode className="w-36 h-36 text-stone-800" />
                )}
              </div>

              <p className="text-[11px] text-stone-500">
                Present this QR code at any turnstile scanner gate for verification.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <a
                href={`/api/attendees/${qrModalAttendee.id}/qr-download`}
                download
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Download QR</span>
              </a>
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-[#7A1113] hover:bg-[#8F1417] text-white text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Print Pass</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMPLOYEE VERIFICATION MODAL */}
      {employeeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-outfit font-bold text-base text-[#7A1113] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Employee Verification Details</span>
              </h3>
              <button
                onClick={() => setEmployeeModal(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-4 bg-[#FAF7F2] p-4 rounded-xl border border-stone-200">
                {employeeModal.photo_url ? (
                  <img
                    src={employeeModal.photo_url}
                    alt={employeeModal.name}
                    className="w-16 h-16 rounded-full object-cover border border-stone-300 shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[#7A1113] text-white font-bold text-lg flex items-center justify-center shrink-0">
                    {employeeModal.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-bold text-sm text-stone-900">{employeeModal.name}</div>
                  <div className="text-stone-500 font-mono mt-0.5">
                    CPF: {employeeModal.cpf_no || '—'}
                  </div>
                  <div className="text-stone-500 mt-0.5">
                    {employeeModal.designation || 'Staff'} &bull;{' '}
                    {employeeModal.department || 'ONGC'}
                  </div>
                </div>
              </div>

              <div className="space-y-2 border border-stone-100 rounded-xl p-3.5 bg-white">
                <div className="flex justify-between py-1 border-b border-stone-50">
                  <span className="text-stone-400">Mobile Phone:</span>
                  <span className="font-semibold text-stone-800">
                    {employeeModal.mobile_no || '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-50">
                  <span className="text-stone-400">Department:</span>
                  <span className="font-semibold text-stone-800">
                    {employeeModal.department || '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-400">Designation:</span>
                  <span className="font-semibold text-stone-800">
                    {employeeModal.designation || '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setEmployeeModal(null)}
                className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold hover:bg-stone-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD ATTENDEE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-stone-200 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-outfit font-bold text-base text-[#7A1113] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-500" />
                <span>Quick Add Attendee</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#7A1113]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Mobile Number * (10 Digits)
                </label>
                <input
                  type="text"
                  required
                  placeholder="9876543210"
                  value={addForm.mobile}
                  onChange={(e) => setAddForm({ ...addForm, mobile: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#7A1113]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="ramesh@example.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#7A1113]"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Your QR pass will be sent to this email.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  Ticket Category *
                </label>
                <select
                  value={addForm.category}
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs bg-white focus:outline-none focus:border-[#7A1113]"
                >
                  <option value="General">General</option>
                  <option value="VIP">VIP</option>
                  <option value="VVIP">VVIP</option>
                </select>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#7A1113] hover:bg-[#8F1417] text-white text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {addSubmitting ? 'Generating Pass...' : 'Create & Issue Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
