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
    <div className="space-y-6">
      {/* ERROR BANNER */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* TOTAL PASSES */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Total Passes
            </span>
            <Ticket className="w-4 h-4 text-maroon" />
          </div>
          <div className="font-outfit font-black text-2xl text-ink">
            {summaryLoading ? '—' : summary.totalPasses.toLocaleString()}
          </div>
          <div className="text-[10px] text-ink-soft mt-1">Across all categories</div>
        </div>

        {/* WEBSITE PASSES */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Website
            </span>
            <Globe className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-outfit font-black text-2xl text-emerald-700">
            {summaryLoading ? '—' : summary.websitePasses.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 mt-1">Public online sales</div>
        </div>

        {/* AGENT PASSES */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Agent
            </span>
            <Shield className="w-4 h-4 text-blue-600" />
          </div>
          <div className="font-outfit font-black text-2xl text-blue-700">
            {summaryLoading ? '—' : summary.agentPasses.toLocaleString()}
          </div>
          <div className="text-[10px] text-blue-600 mt-1">Authorized agents</div>
        </div>

        {/* EMPLOYEE PASSES */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Employee
            </span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="font-outfit font-black text-2xl text-purple-700">
            {summaryLoading ? '—' : summary.employeePasses.toLocaleString()}
          </div>
          <div className="text-[10px] text-purple-600 mt-1">Staff &amp; family passes</div>
        </div>

        {/* CHECKED IN */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Checked In
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-outfit font-black text-2xl text-emerald-600">
            {summaryLoading ? '—' : summary.checkedInPasses.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 mt-1">Verified at turnstiles</div>
        </div>

        {/* NOT CHECKED IN */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Pending Entry
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-outfit font-black text-2xl text-amber-700">
            {summaryLoading ? '—' : summary.notCheckedInPasses.toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-600 mt-1">Yet to check in</div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by Employee Name, CPF / ID, Mobile, Email, Department..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon bg-cream/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Pass Status Filter */}
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-ink">
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
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </div>

            {/* Checkin Status Filter */}
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-ink">
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
              className="p-2.5 rounded-xl border border-stone-200 text-stone-600 hover:text-maroon hover:border-maroon/30 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* EMPLOYEES DATA TABLE */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200/70 text-ink-soft uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3.5 px-4 font-bold">Employee Name</th>
                <th className="py-3.5 px-4 font-bold">CPF / ID</th>
                <th className="py-3.5 px-4 font-bold">Mobile &amp; Email</th>
                <th className="py-3.5 px-4 font-bold">Department</th>
                <th className="py-3.5 px-4 font-bold">Pass Type</th>
                <th className="py-3.5 px-4 font-bold">Pass Status</th>
                <th className="py-3.5 px-4 font-bold">Check-in Status</th>
                <th className="py-3.5 px-4 font-bold">Registered</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-soft">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-maroon mb-2" />
                    <span>Loading employee passes...</span>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-soft">
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
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-ink text-sm group-hover:text-maroon transition-colors">
                        {emp.name}
                      </div>
                      <div className="text-[11px] text-ink-soft flex items-center gap-1 mt-0.5">
                        <Briefcase className="w-3 h-3 text-stone-400" />
                        <span>{emp.designation || 'Staff'}</span>
                      </div>
                    </td>

                    {/* CPF */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-maroon bg-maroon/5 border border-maroon/20 px-2 py-0.5 rounded text-xs">
                        {emp.cpf}
                      </span>
                    </td>

                    {/* Mobile & Email */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-ink flex items-center gap-1">
                        <Phone className="w-3 h-3 text-stone-400" />
                        <span>{emp.mobile || '—'}</span>
                      </div>
                      {emp.email && (
                        <div className="text-[11px] text-ink-soft flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-stone-400" />
                          <span className="truncate max-w-[180px]">{emp.email}</span>
                        </div>
                      )}
                    </td>

                    {/* Department */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-ink">{emp.department || 'ONGC'}</div>
                    </td>

                    {/* Pass Type */}
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-900 border border-purple-200">
                        <Ticket className="w-3 h-3 text-purple-700" />
                        <span>{emp.passType}</span>
                      </div>
                      {emp.familyMembersCount > 0 && (
                        <div className="text-[10px] text-ink-soft mt-0.5">
                          Total: {emp.totalPasses} pass{emp.totalPasses > 1 ? 'es' : ''}
                        </div>
                      )}
                    </td>

                    {/* Pass Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border ${
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
                    <td className="py-3.5 px-4">
                      {emp.isCheckedIn ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Checked In</span>
                          </span>
                          {emp.latestCheckin && (
                            <div className="text-[10px] text-ink-soft mt-0.5">
                              {emp.latestCheckin.gateName} &bull;{' '}
                              {new Date(emp.latestCheckin.checkinTime).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                          <Clock className="w-3 h-3 text-stone-400" />
                          <span>Not Checked In</span>
                        </span>
                      )}
                    </td>

                    {/* Registration Date */}
                    <td className="py-3.5 px-4 text-ink-soft whitespace-nowrap">
                      {new Date(emp.registrationDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenPass(emp.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-maroon/10 text-maroon hover:bg-maroon hover:text-white font-bold text-xs transition-colors cursor-pointer"
                        title="View Official E-Pass"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View E-Pass</span>
                      </button>
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
    </div>
  );
}
