'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  QrCode,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  RefreshCw,
  Eye,
  FileSpreadsheet,
  Check,
  Calendar,
  Phone,
  Mail,
  User,
  ExternalLink,
  Shield,
  Layers,
  Globe,
  Tag,
  Clock,
  Building,
  Briefcase,
  Ticket,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import AdminModal from '@/components/admin/AdminModal';
import TicketPassCard, { TicketPassData } from '@/components/TicketPassCard';

interface EmployeeItem {
  id: string;
  cpf: string;
  name: string;
  department: string;
  designation: string;
  mobile: string;
  email: string;
  employeeCategory?: string;
  registrationStatus?: string;
  photoPath?: string | null;
  hasPhoto?: boolean;
  bookingDays?: string[];
  registrationDate: string;
  ticketNumber: string;
  qrCodeToken: string;
  passStatus: string;
  passType: string;
  familyMembersCount: number;
  totalPasses: number;
  checkedInCount: number;
  isCheckedIn: boolean;
  primaryCheckedIn: boolean;
  latestCheckin?: {
    gateName: string;
    checkinTime: string;
  } | null;
}

interface EmployeeDetailData {
  id: string;
  cpf: string;
  name: string;
  designation: string;
  department: string;
  phone: string;
  email: string;
  employeeCategory: string;
  registrationStatus: string;
  photoPath: string | null;
  hasPhoto: boolean;
  bookingDays: string[];
  createdAt: string;
  familyMembers: Array<{
    id: string;
    name: string;
    relation: string;
    age?: number;
    gender?: string;
    phone: string;
    photoPath: string | null;
    hasPhoto: boolean;
  }>;
  attendees: Array<{
    id: string;
    ticketNumber: string;
    status: string;
    attendeeName: string;
    relation: string;
    bookingDays: string[];
    photoPath: string | null;
  }>;
}

interface PassSummary {
  totalPasses: number;
  websitePasses: number;
  agentPasses: number;
  employeePasses: number;
  checkedInPasses: number;
  notCheckedInPasses: number;
}

interface EmployeePassData {
  id: string;
  employeeId: string;
  ticketNumber: string;
  name: string;
  attendeeName: string;
  registrationType: string;
  category: string;
  passType: string;
  department: string;
  designation: string;
  cpf: string;
  mobile: string;
  email: string;
  bookingDays: string[];
  qrSvg: string;
  qrCodeToken: string;
  status: string;
  isCheckedIn: boolean;
  familyPasses: Array<{
    id: string;
    ticketNumber: string;
    name: string;
    relation: string;
    age?: number;
    gender?: string;
    category: string;
    passType: string;
    bookingDays: string[];
    qrSvg: string;
    qrCodeToken: string;
    status: string;
    isCheckedIn: boolean;
  }>;
}

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [summary, setSummary] = useState<PassSummary>({
    totalPasses: 0,
    websitePasses: 0,
    agentPasses: 0,
    employeePasses: 0,
    checkedInPasses: 0,
    notCheckedInPasses: 0,
  });

  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [checkinFilter, setCheckinFilter] = useState('ALL');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // View Pass Modal
  const [viewingEmployeeId, setViewingEmployeeId] = useState<string | null>(null);
  const [passData, setPassData] = useState<EmployeePassData | null>(null);
  const [passLoading, setPassLoading] = useState(false);
  const [selectedPassIndex, setSelectedPassIndex] = useState<number>(0); // 0 = primary, 1..n = family

  // Details Modal & Actions
  const [detailEmployee, setDetailEmployee] = useState<EmployeeDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleViewDetails = async (id: string) => {
    setDetailLoading(true);
    try {
      const data = await fetchApi<EmployeeDetailData>(`/admin/employees/${id}`);
      setDetailEmployee(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load employee details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    setActionSuccess(null);
    try {
      const res = await fetchApi<{ success: boolean; message: string }>(`/admin/employees/${id}/approve`, {
        method: 'POST',
      });
      setActionSuccess(res.message || 'Registration approved.');
      if (detailEmployee && detailEmployee.id === id) {
        setDetailEmployee((prev) => (prev ? { ...prev, registrationStatus: 'APPROVED' } : null));
      }
      await loadEmployees();
      await loadSummary();
    } catch (err: any) {
      alert(err.message || 'Failed to approve registration');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Are you sure you want to reject this employee registration? Linked passes will be revoked.')) {
      return;
    }
    setProcessingId(id);
    setActionSuccess(null);
    try {
      const res = await fetchApi<{ success: boolean; message: string }>(`/admin/employees/${id}/reject`, {
        method: 'POST',
      });
      setActionSuccess(res.message || 'Registration rejected.');
      if (detailEmployee && detailEmployee.id === id) {
        setDetailEmployee((prev) => (prev ? { ...prev, registrationStatus: 'REJECTED' } : null));
      }
      await loadEmployees();
      await loadSummary();
    } catch (err: any) {
      alert(err.message || 'Failed to reject registration');
    } finally {
      setProcessingId(null);
    }
  };

  // Load Pass Summary
  const loadSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const res = await fetchApi<PassSummary>('/admin/pass-summary');
      if (res) {
        setSummary(res);
      }
    } catch (err: any) {
      console.warn('Failed to load pass summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Load Employees List
  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (checkinFilter !== 'ALL') params.set('checkinStatus', checkinFilter);

      const res = await fetchApi<{
        employees: EmployeeItem[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/admin/employees?${params.toString()}`);

      if (res) {
        setEmployees(res.employees || []);
        setTotalCount(res.total || 0);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load employees list.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, statusFilter, checkinFilter]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Open Pass View Modal
  const handleOpenPass = async (employeeId: string) => {
    setViewingEmployeeId(employeeId);
    setSelectedPassIndex(0);
    setPassLoading(true);
    setPassData(null);
    try {
      const data = await fetchApi<EmployeePassData>(`/admin/employees/${employeeId}/pass`);
      setPassData(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load employee pass.');
    } finally {
      setPassLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Prepare current ticket data for TicketPassCard
  const activeTicketPass: TicketPassData | null = useMemo(() => {
    if (!passData) return null;
    if (selectedPassIndex === 0) {
      return {
        id: passData.id,
        name: passData.name,
        attendeeName: passData.name,
        ticketNumber: passData.ticketNumber,
        registrationType: 'EMPLOYEE',
        category: 'ONGC STAFF',
        passType: 'ONGC Employee Pass',
        bookingDays: passData.bookingDays,
        qrSvg: passData.qrSvg,
        qrCodeToken: passData.qrCodeToken,
        status: passData.status,
      };
    }
    const fam = passData.familyPasses[selectedPassIndex - 1];
    if (!fam) return null;
    return {
      id: fam.id,
      name: fam.name,
      attendeeName: fam.name,
      ticketNumber: fam.ticketNumber,
      registrationType: 'EMPLOYEE',
      category: fam.category,
      passType: fam.passType,
      relation: fam.relation,
      bookingDays: fam.bookingDays,
      qrSvg: fam.qrSvg,
      qrCodeToken: fam.qrCodeToken,
      status: fam.status,
    };
  }, [passData, selectedPassIndex]);

  return (
    <div className="space-y-3.5 sm:space-y-4 2xl:space-y-6">
      {/* ERROR BANNER */}
      {errorMsg && (
        <div className="p-3 2xl:p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 2xl:w-5 2xl:h-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-stone-400 hover:text-stone-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP PASS SUMMARY CARDS (PART 5) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5 2xl:gap-3">
        {/* TOTAL PASSES */}
        <div className="bg-white rounded-2xl p-3 2xl:p-4 border border-stone-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 mb-1.5 2xl:mb-2">
            <span className="text-[10px] 2xl:text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Total Passes
            </span>
            <Ticket className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-maroon" />
          </div>
          <div className="font-outfit font-black text-xl 2xl:text-2xl text-ink">
            {summaryLoading ? '—' : summary.totalPasses.toLocaleString()}
          </div>
          <div className="text-[9px] 2xl:text-[10px] text-ink-soft mt-1">Across all categories</div>
        </div>

        {/* WEBSITE PASSES */}
        <div className="bg-white rounded-2xl p-3 2xl:p-4 border border-stone-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 mb-1.5 2xl:mb-2">
            <span className="text-[10px] 2xl:text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Website
            </span>
            <Globe className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-emerald-600" />
          </div>
          <div className="font-outfit font-black text-xl 2xl:text-2xl text-emerald-700">
            {summaryLoading ? '—' : summary.websitePasses.toLocaleString()}
          </div>
          <div className="text-[9px] 2xl:text-[10px] text-emerald-600 mt-1">Public online sales</div>
        </div>

        {/* AGENT PASSES */}
        <div className="bg-white rounded-2xl p-3 2xl:p-4 border border-stone-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 mb-1.5 2xl:mb-2">
            <span className="text-[10px] 2xl:text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Agent
            </span>
            <Shield className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-blue-600" />
          </div>
          <div className="font-outfit font-black text-xl 2xl:text-2xl text-blue-700">
            {summaryLoading ? '—' : summary.agentPasses.toLocaleString()}
          </div>
          <div className="text-[9px] 2xl:text-[10px] text-blue-600 mt-1">Authorized agents</div>
        </div>

        {/* EMPLOYEE PASSES */}
        <div className="bg-white rounded-2xl p-3 2xl:p-4 border border-stone-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 mb-1.5 2xl:mb-2">
            <span className="text-[10px] 2xl:text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Employee
            </span>
            <Users className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-purple-600" />
          </div>
          <div className="font-outfit font-black text-xl 2xl:text-2xl text-purple-700">
            {summaryLoading ? '—' : summary.employeePasses.toLocaleString()}
          </div>
          <div className="text-[9px] 2xl:text-[10px] text-purple-600 mt-1">Staff &amp; family passes</div>
        </div>

        {/* CHECKED IN */}
        <div className="bg-white rounded-2xl p-3 2xl:p-4 border border-stone-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 mb-1.5 2xl:mb-2">
            <span className="text-[10px] 2xl:text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Checked In
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-emerald-600" />
          </div>
          <div className="font-outfit font-black text-xl 2xl:text-2xl text-emerald-600">
            {summaryLoading ? '—' : summary.checkedInPasses.toLocaleString()}
          </div>
          <div className="text-[9px] 2xl:text-[10px] text-emerald-600 mt-1">Verified at turnstiles</div>
        </div>

        {/* NOT CHECKED IN */}
        <div className="bg-white rounded-2xl p-3 2xl:p-4 border border-stone-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 mb-1.5 2xl:mb-2">
            <span className="text-[10px] 2xl:text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Pending Entry
            </span>
            <Clock className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-amber-600" />
          </div>
          <div className="font-outfit font-black text-xl 2xl:text-2xl text-amber-700">
            {summaryLoading ? '—' : summary.notCheckedInPasses.toLocaleString()}
          </div>
          <div className="text-[9px] 2xl:text-[10px] text-amber-600 mt-1">Yet to check in</div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-3 sm:p-3.5 2xl:p-4 rounded-2xl border border-stone-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by Employee Name, CPF / ID, Mobile, Email, Department..."
              className="w-full pl-9 pr-3.5 py-1.5 2xl:py-2 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon bg-cream/30"
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

          {/* Filter dropdowns */}
          <div className="flex flex-wrap items-center gap-2 2xl:gap-2.5">
            {/* Pass Status Filter */}
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1 2xl:px-3 2xl:py-1.5 text-xs font-semibold text-ink">
              <span className="text-ink-soft font-normal">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none text-xs font-bold text-ink focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="ACTIVE">Pass Active</option>
                <option value="SUSPENDED">Pass Suspended</option>
                <option value="REVOKED">Pass Revoked</option>
              </select>
            </div>

            {/* Checkin Status Filter */}
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1 2xl:px-3 2xl:py-1.5 text-xs font-semibold text-ink">
              <span className="text-ink-soft font-normal">Check-in:</span>
              <select
                value={checkinFilter}
                onChange={(e) => {
                  setCheckinFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none text-xs font-bold text-ink focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Check-ins</option>
                <option value="CHECKED_IN">Checked In</option>
                <option value="NOT_CHECKED_IN">Not Checked In</option>
              </select>
            </div>

            {/* Refresh */}
            <button
              onClick={() => {
                loadEmployees();
                loadSummary();
              }}
              title="Refresh"
              className="p-1.5 2xl:p-2 rounded-xl border border-stone-200 text-stone-600 hover:text-maroon hover:border-maroon/30 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 2xl:w-4 2xl:h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* EMPLOYEES DATA TABLE */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200/70 text-ink-soft uppercase text-[9px] 2xl:text-[10px] font-bold tracking-wider">
                <th className="py-2.5 2xl:py-3.5 px-3 sm:px-4 font-bold">Employee Name</th>
                <th className="py-2.5 2xl:py-3.5 px-3 sm:px-4 font-bold">CPF / ID</th>
                <th className="py-2.5 2xl:py-3.5 px-3 sm:px-4 font-bold">Mobile &amp; Email</th>
                <th className="py-2.5 2xl:py-3.5 px-3 sm:px-4 font-bold">Department</th>
                <th className="py-2.5 2xl:py-3.5 px-3 sm:px-4 font-bold">Registration</th>
                <th className="py-2.5 2xl:py-3.5 px-3 sm:px-4 font-bold">Pass Type</th>
                <th className="py-2.5 2xl:py-3.5 px-3 sm:px-4 font-bold">Pass Status</th>
                <th className="py-2.5 2xl:py-3.5 px-3 sm:px-4 font-bold">Check-in Status</th>
                <th className="py-2.5 2xl:py-3.5 px-3 sm:px-4 font-bold">Registered</th>
                <th className="py-2.5 2xl:py-3.5 px-3 sm:px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 2xl:py-12 text-center text-ink-soft">
                    <RefreshCw className="w-5 h-5 2xl:w-6 2xl:h-6 animate-spin mx-auto text-maroon mb-2" />
                    <span>Loading employee passes...</span>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 2xl:py-12 text-center text-ink-soft">
                    <Users className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="font-semibold text-ink text-sm">No employee records found</p>
                    <p className="text-xs text-ink-soft mt-1">
                      {searchQuery
                        ? 'Try modifying your search or filter criteria'
                        : 'No employees have been registered yet'}
                    </p>
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="hover:bg-cream/40 transition-colors group"
                  >
                    {/* Name */}
                    <td className="py-2 2xl:py-3.5 px-3 sm:px-4">
                      <div className="font-bold text-ink text-xs sm:text-sm group-hover:text-maroon transition-colors">
                        {emp.name}
                      </div>
                      <div className="text-[10px] 2xl:text-[11px] text-ink-soft flex items-center gap-1 mt-0.5">
                        <Briefcase className="w-3 h-3 text-stone-400" />
                        <span>{emp.designation || 'Staff'}</span>
                      </div>
                    </td>

                    {/* CPF */}
                    <td className="py-2 2xl:py-3.5 px-3 sm:px-4">
                      <span className="font-mono font-bold text-maroon bg-maroon/5 border border-maroon/20 px-1.5 2xl:px-2 py-0.5 rounded text-xs">
                        {emp.cpf}
                      </span>
                    </td>

                    {/* Mobile & Email */}
                    <td className="py-2 2xl:py-3.5 px-3 sm:px-4">
                      <div className="font-semibold text-ink text-xs flex items-center gap-1">
                        <Phone className="w-3 h-3 text-stone-400" />
                        <span>{emp.mobile || '—'}</span>
                      </div>
                      {emp.email && (
                        <div className="text-[10px] 2xl:text-[11px] text-ink-soft flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-stone-400" />
                          <span className="truncate max-w-[150px] 2xl:max-w-[180px]">{emp.email}</span>
                        </div>
                      )}
                    </td>

                    {/* Department */}
                    <td className="py-2 2xl:py-3.5 px-3 sm:px-4">
                      <div className="font-semibold text-ink text-xs">{emp.department || 'ONGC'}</div>
                    </td>

                    {/* Registration Status */}
                    <td className="py-2 2xl:py-3.5 px-3 sm:px-4">
                      <span
                        className={`inline-flex items-center px-1.5 2xl:px-2 py-0.5 rounded text-[9px] 2xl:text-[10px] font-extrabold uppercase tracking-wide border ${
                          emp.registrationStatus === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : emp.registrationStatus === 'REJECTED'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {emp.registrationStatus === 'APPROVED'
                          ? 'Approved'
                          : emp.registrationStatus === 'REJECTED'
                          ? 'Rejected'
                          : 'Pending Review'}
                      </span>
                    </td>

                    {/* Pass Type */}
                    <td className="py-2 2xl:py-3.5 px-3 sm:px-4">
                      <div className="inline-flex items-center gap-1 px-2 2xl:px-2.5 py-0.5 2xl:py-1 rounded-lg text-[11px] 2xl:text-xs font-semibold bg-purple-50 text-purple-900 border border-purple-200">
                        <Ticket className="w-3 h-3 text-purple-700" />
                        <span>{emp.passType}</span>
                      </div>
                      {emp.familyMembersCount > 0 && (
                        <div className="text-[9px] 2xl:text-[10px] text-ink-soft mt-0.5">
                          Total: {emp.totalPasses} pass{emp.totalPasses > 1 ? 'es' : ''}
                        </div>
                      )}
                    </td>

                    {/* Pass Status */}
                    <td className="py-2 2xl:py-3.5 px-3 sm:px-4">
                      <span
                        className={`inline-flex items-center px-1.5 2xl:px-2 py-0.5 rounded text-[9px] 2xl:text-[10px] font-extrabold uppercase tracking-wide border ${
                          emp.passStatus === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : emp.passStatus === 'SUSPENDED'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {emp.passStatus}
                      </span>
                    </td>

                    {/* Check-in Status */}
                    <td className="py-2 2xl:py-3.5 px-3 sm:px-4">
                      {emp.isCheckedIn ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-1.5 2xl:px-2 py-0.5 rounded text-[9px] 2xl:text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Checked In</span>
                          </span>
                          {emp.latestCheckin && (
                            <div className="text-[9px] 2xl:text-[10px] text-ink-soft mt-0.5">
                              {emp.latestCheckin.gateName} &bull;{' '}
                              {new Date(emp.latestCheckin.checkinTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 2xl:px-2 py-0.5 rounded text-[9px] 2xl:text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                          <Clock className="w-3 h-3 text-stone-400" />
                          <span>Not Checked In</span>
                        </span>
                      )}
                    </td>

                    {/* Registration Date */}
                    <td className="py-2 2xl:py-3.5 px-3 sm:px-4 text-ink-soft whitespace-nowrap text-[11px] 2xl:text-xs">
                      {new Date(emp.registrationDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-2 2xl:py-3.5 px-3 sm:px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {emp.registrationStatus === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              disabled={processingId === emp.id}
                              onClick={() => handleApprove(emp.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white border border-emerald-300 font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                              title="Approve Employee Registration"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              disabled={processingId === emp.id}
                              onClick={() => handleReject(emp.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 text-rose-800 hover:bg-rose-600 hover:text-white border border-rose-300 font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                              title="Reject Employee Registration"
                            >
                              <X className="w-3 h-3" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleViewDetails(emp.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 font-bold text-[11px] transition-colors cursor-pointer"
                          title="View Registration Details"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Details</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenPass(emp.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-maroon/10 text-maroon hover:bg-maroon hover:text-white font-bold text-[11px] transition-colors cursor-pointer"
                          title="View Official E-Pass"
                        >
                          <Ticket className="w-3 h-3" />
                          <span>Pass</span>
                        </button>
                      </div>
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
            Showing <strong>{employees.length}</strong> of <strong>{totalCount}</strong> employees
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white font-semibold text-ink hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Previous
            </button>
            <span className="px-2 font-bold text-ink">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white font-semibold text-ink hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* VIEW E-PASS MODAL */}
      <AdminModal
        isOpen={Boolean(viewingEmployeeId)}
        onClose={() => {
          setViewingEmployeeId(null);
          setPassData(null);
        }}
        title="Official ONGC Navratri E-Pass"
        subtitle={passData ? `${passData.name} (CPF: ${passData.cpf})` : 'Loading pass...'}
        icon={<Ticket className="w-5 h-5 text-gold" />}
        maxWidth="lg"
      >
        {passLoading ? (
          <div className="py-16 text-center text-ink-soft space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-maroon mx-auto" />
            <p className="text-sm font-semibold">Generating high-resolution digital pass...</p>
          </div>
        ) : passData && activeTicketPass ? (
          <div className="space-y-5">
            {/* PASS SELECTOR TABS (Primary vs Family Members) */}
            {passData.familyPasses.length > 0 && (
              <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl overflow-x-auto text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSelectedPassIndex(0)}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    selectedPassIndex === 0
                      ? 'bg-white text-maroon shadow-xs'
                      : 'text-stone-600 hover:text-ink'
                  }`}
                >
                  Primary ({passData.name})
                </button>
                {passData.familyPasses.map((fam, idx) => (
                  <button
                    key={fam.id}
                    type="button"
                    onClick={() => setSelectedPassIndex(idx + 1)}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                      selectedPassIndex === idx + 1
                        ? 'bg-white text-maroon shadow-xs'
                        : 'text-stone-600 hover:text-ink'
                    }`}
                  >
                    {fam.relation}: {fam.name}
                  </button>
                ))}
              </div>
            )}

            {/* TICKET PASS CARD COMPONENT */}
            <TicketPassCard
              ticket={activeTicketPass}
              id="employeePrintablePass"
              showTestBadge={false}
            />

            {/* ACTION BUTTONS (PRINT & DOWNLOAD) */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-stone-100">
              <div className="text-xs text-ink-soft">
                Pass Ticket ID: <strong className="font-mono text-ink">{activeTicketPass.ticketNumber}</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Pass</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewingEmployeeId(null)}
                  className="px-4 py-2 rounded-xl bg-maroon text-white text-xs font-bold hover:bg-maroon-dark transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </AdminModal>

      {/* REGISTRATION REVIEW DETAILS MODAL */}
      <AdminModal
        isOpen={Boolean(detailEmployee)}
        onClose={() => setDetailEmployee(null)}
        title="Employee Registration Review"
        subtitle={detailEmployee ? `${detailEmployee.name} (CPF: ${detailEmployee.cpf})` : 'Loading...'}
        icon={<Users className="w-5 h-5 text-maroon" />}
        maxWidth="2xl"
      >
        {detailLoading ? (
          <div className="py-16 text-center text-ink-soft space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-maroon mx-auto" />
            <p className="text-sm font-semibold">Loading registration details...</p>
          </div>
        ) : detailEmployee ? (
          <div className="space-y-6">
            {/* Status & Review Action Bar */}
            <div className="p-4 rounded-2xl bg-cream-light border border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink">Status:</span>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide border ${
                    detailEmployee.registrationStatus === 'APPROVED'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : detailEmployee.registrationStatus === 'REJECTED'
                      ? 'bg-rose-50 text-rose-800 border-rose-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  {detailEmployee.registrationStatus === 'APPROVED'
                    ? 'Approved'
                    : detailEmployee.registrationStatus === 'REJECTED'
                    ? 'Rejected'
                    : 'Pending Admin Review'}
                </span>
              </div>

              {detailEmployee.registrationStatus === 'PENDING' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={processingId === detailEmployee.id}
                    onClick={() => handleApprove(detailEmployee.id)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve Registration</span>
                  </button>
                  <button
                    type="button"
                    disabled={processingId === detailEmployee.id}
                    onClick={() => handleReject(detailEmployee.id)}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              )}
            </div>

            {/* Employee Information Card */}
            <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex flex-col sm:flex-row gap-4 items-start">
              {detailEmployee.photoPath ? (
                <img
                  src={detailEmployee.photoPath}
                  alt={detailEmployee.name}
                  className="w-24 h-24 rounded-2xl object-cover border-2 border-gold/40 shadow-sm shrink-0"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-maroon-soft text-maroon flex items-center justify-center border border-maroon/20 shrink-0">
                  <User className="w-10 h-10" />
                </div>
              )}

              <div className="flex-1 space-y-1.5 text-xs text-ink">
                <div className="font-outfit font-black text-lg text-ink">{detailEmployee.name}</div>
                <div className="text-ink-soft">
                  CPF: <strong className="font-mono text-maroon font-bold text-sm">{detailEmployee.cpf}</strong> &bull; {detailEmployee.designation} &bull; {detailEmployee.department}
                </div>
                <div className="text-ink-soft">
                  Mobile: <strong>{detailEmployee.phone}</strong> &bull; Email: <strong>{detailEmployee.email}</strong>
                </div>
                <div className="text-[11px] text-stone-500 pt-1">
                  Category: <span className="font-semibold text-ink">{detailEmployee.employeeCategory}</span> &bull; Submitted: {new Date(detailEmployee.createdAt).toLocaleString('en-IN')}
                </div>

                {/* Selected Dates */}
                <div className="pt-2">
                  <div className="text-[11px] font-bold text-ink-soft uppercase tracking-wider mb-1">
                    Employee Attendance Dates ({detailEmployee.bookingDays.length}):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detailEmployee.bookingDays.map((d) => (
                      <span key={d} className="px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-[11px] font-mono font-semibold">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Family Members Section */}
            <div className="space-y-3">
              <h3 className="font-outfit font-bold text-sm text-ink flex items-center gap-2">
                <Users className="w-4 h-4 text-maroon" />
                <span>Registered Family Members ({detailEmployee.familyMembers.length})</span>
              </h3>

              {detailEmployee.familyMembers.length === 0 ? (
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs text-ink-soft text-center">
                  No family members registered. Attending as a single attendee.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {detailEmployee.familyMembers.map((fam) => {
                    const famAttendee = detailEmployee.attendees.find((a) => a.attendeeName === fam.name);
                    const famDates = famAttendee?.bookingDays || detailEmployee.bookingDays;
                    return (
                      <div key={fam.id} className="p-4 rounded-xl bg-cream-light/60 border border-stone-200 flex gap-3 items-start">
                        {fam.photoPath ? (
                          <img
                            src={fam.photoPath}
                            alt={fam.name}
                            className="w-14 h-14 rounded-xl object-cover border border-gold/40 shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-maroon-soft text-maroon flex items-center justify-center shrink-0">
                            <User className="w-6 h-6" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 text-xs space-y-1">
                          <div className="font-bold text-ink truncate">{fam.name}</div>
                          <div className="text-[11px] text-maroon font-semibold">
                            {fam.relation} {fam.age ? `• ${fam.age} yrs` : ''} {fam.gender ? `• ${fam.gender}` : ''}
                          </div>
                          <div className="text-[11px] text-ink-soft">Mobile: {fam.phone}</div>
                          <div className="pt-1">
                            <span className="text-[10px] text-stone-500 font-bold block mb-0.5">Dates:</span>
                            <div className="flex flex-wrap gap-1">
                              {famDates.map((d) => (
                                <span key={d} className="px-1.5 py-0.5 bg-white border border-stone-200 rounded text-[10px] font-mono">
                                  {d.slice(5)}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Close Button */}
            <div className="pt-3 border-t border-stone-200 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailEmployee(null)}
                className="px-5 py-2 rounded-xl bg-stone-200 text-stone-800 text-xs font-bold hover:bg-stone-300 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}
