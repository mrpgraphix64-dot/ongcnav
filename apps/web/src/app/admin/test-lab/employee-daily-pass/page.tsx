'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FlaskConical,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Download,
  Mail,
  RefreshCw,
  QrCode,
  ScanLine,
  Trash2,
  Eye,
  Calendar,
  User,
  Clock,
  Send,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { getStoredAuthUser } from '@/lib/auth-session';
import { OFFICIAL_EVENT_DATES, EVENT_DAY_THEMES, getEventDayTheme } from '@/types/shared-types';

interface EmployeeOption {
  id: string;
  cpf: string;
  name: string;
  designation: string;
  department: string;
  email: string;
  phone: string;
  registrationStatus: string;
  bookingDays: string[];
  attendeeId: string | null;
  ticketNumber: string | null;
  familyMembers: Array<{
    id: string;
    name: string;
    relation: string;
    attendeeId: string | null;
    ticketNumber: string | null;
    bookingDays: string[];
  }>;
}

interface TestPassData {
  testPassId: string;
  testSessionId: string;
  qrToken: string;
  attendeeId: string;
  attendeeName: string;
  isFamily: boolean;
  relation: string;
  employeeName: string;
  employeeCpf: string;
  department: string;
  passType: string;
  ticketNumber: string;
  eventDate: string;
  status: string;
  emailStatus: string;
  dayTheme: any;
  createdAt: string;
}

export default function EmployeeDailyPassTestLabPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Search & Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [employeeResults, setEmployeeResults] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string>('');
  const [selectedAttendeeName, setSelectedAttendeeName] = useState<string>('');
  const [selectedEventDate, setSelectedEventDate] = useState<string>(OFFICIAL_EVENT_DATES[0]);

  // Pass Generation State
  const [generating, setGenerating] = useState(false);
  const [activeTestPass, setActiveTestPass] = useState<TestPassData | null>(null);
  const [testSessionId, setTestSessionId] = useState('');

  // Email Test State
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string>('PENDING');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  // Email Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');

  // Scanner Test State
  const [scanning, setScanning] = useState(false);
  const [scannerResult, setScannerResult] = useState<any>(null);
  const [wrongDateTarget, setWrongDateTarget] = useState<string>(
    OFFICIAL_EVENT_DATES[1] || '2026-10-12',
  );

  // Cleanup State
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [confirmPurgeAll, setConfirmPurgeAll] = useState(false);

  // General Notification
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // 1. Super Admin Authorization Guard
  useEffect(() => {
    const user = getStoredAuthUser();
    setCurrentUser(user);
    setAuthChecked(true);

    if (user?.role === 'SUPER_ADMIN') {
      loadInitialEmployees();
    }
  }, []);

  async function loadInitialEmployees() {
    try {
      setSearching(true);
      const data = await fetchApi<EmployeeOption[]>(
        '/admin/test-lab/employee-daily-pass/employees',
      );
      setEmployeeResults(data || []);
      if (data && data.length > 0 && !selectedEmployee) {
        selectEmployee(data[0]);
      }
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to load employees for testing' });
    } finally {
      setSearching(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSearching(true);
      const data = await fetchApi<EmployeeOption[]>(
        `/admin/test-lab/employee-daily-pass/employees?search=${encodeURIComponent(searchQuery)}`,
      );
      setEmployeeResults(data || []);
      if (data && data.length > 0) {
        selectEmployee(data[0]);
      }
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Search failed' });
    } finally {
      setSearching(false);
    }
  }

  function selectEmployee(emp: EmployeeOption) {
    setSelectedEmployee(emp);
    if (emp.attendeeId) {
      setSelectedAttendeeId(emp.attendeeId);
      setSelectedAttendeeName(`${emp.name} (Employee)`);
    } else if (emp.familyMembers.length > 0 && emp.familyMembers[0].attendeeId) {
      setSelectedAttendeeId(emp.familyMembers[0].attendeeId);
      setSelectedAttendeeName(
        `${emp.familyMembers[0].name} (${emp.familyMembers[0].relation})`,
      );
    } else {
      setSelectedAttendeeId('');
      setSelectedAttendeeName('');
    }
  }

  // 2. Generate Test Daily Pass
  async function handleGeneratePass() {
    if (!selectedAttendeeId) {
      setAlert({ type: 'error', message: 'Please select an attendee (employee or family member)' });
      return;
    }

    try {
      setGenerating(true);
      setAlert(null);
      setScannerResult(null);

      const payload = {
        attendeeId: selectedAttendeeId,
        eventDate: selectedEventDate,
        testSessionId: testSessionId.trim() || undefined,
      };

      const result = await fetchApi<TestPassData>(
        '/admin/test-lab/employee-daily-pass/generate',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      setActiveTestPass(result);
      setTestSessionId(result.testSessionId);
      setEmailStatus(result.emailStatus);
      setEmailMessage(null);
      setAlert({
        type: 'success',
        message: `Isolated test pass generated for ${result.attendeeName} (${result.eventDate})`,
      });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to generate test pass' });
    } finally {
      setGenerating(false);
    }
  }

  // 3. Email Preview
  async function handleOpenEmailPreview() {
    if (!activeTestPass) return;
    try {
      setPreviewLoading(true);
      setPreviewModalOpen(true);
      const data = await fetchApi<{ subject: string; html: string }>(
        `/admin/test-lab/employee-daily-pass/preview-email/${activeTestPass.qrToken}`,
      );
      setPreviewHtml(data.html);
      setPreviewSubject(data.subject);
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to preview email template' });
      setPreviewModalOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  }

  // 4. Send Test Email
  async function handleSendTestEmail() {
    if (!activeTestPass) return;
    if (!testEmailRecipient || !testEmailRecipient.includes('@')) {
      setAlert({ type: 'error', message: 'Please enter a valid test recipient email address' });
      return;
    }

    try {
      setSendingEmail(true);
      setEmailMessage(null);

      const result = await fetchApi<any>(
        '/admin/test-lab/employee-daily-pass/send-test-email',
        {
          method: 'POST',
          body: JSON.stringify({
            token: activeTestPass.qrToken,
            recipientEmail: testEmailRecipient.trim(),
          }),
        },
      );

      setEmailStatus(result.emailStatus);
      if (result.success) {
        setEmailMessage(`Test email sent successfully to ${result.sentTo}`);
        setAlert({
          type: 'success',
          message: `Test email dispatched to ${result.sentTo}`,
        });
      } else {
        setEmailMessage(`Email delivery failed: ${result.error}`);
        setAlert({
          type: 'error',
          message: `Delivery failed: ${result.error}`,
        });
      }
    } catch (err: any) {
      setEmailStatus('FAILED');
      setEmailMessage(err.message || 'Failed to send test email');
      setAlert({ type: 'error', message: err.message || 'Email test request failed' });
    } finally {
      setSendingEmail(false);
    }
  }

  // 5. Scanner Validations
  async function handleScan(simulatedDate?: string) {
    if (!activeTestPass) return;

    try {
      setScanning(true);
      setScannerResult(null);

      const dateToScan = simulatedDate || activeTestPass.eventDate;
      const res = await fetchApi<any>('/admin/test-lab/employee-daily-pass/scanner/scan', {
        method: 'POST',
        body: JSON.stringify({
          token: activeTestPass.qrToken,
          scanDate: dateToScan,
        }),
      });

      setScannerResult(res);

      if (res.passStatus) {
        setActiveTestPass((prev) => (prev ? { ...prev, status: res.passStatus } : null));
      }
    } catch (err: any) {
      setScannerResult({
        scannerResponse: {
          success: false,
          result: 'REQUEST_ERROR',
          message: err.message || 'Scanner request failed',
        },
      });
    } finally {
      setScanning(false);
    }
  }

  async function handleRevokePass() {
    if (!activeTestPass) return;

    try {
      setScanning(true);
      const res = await fetchApi<any>('/admin/test-lab/employee-daily-pass/revoke', {
        method: 'POST',
        body: JSON.stringify({ token: activeTestPass.qrToken }),
      });

      setActiveTestPass((prev) => (prev ? { ...prev, status: res.status } : null));
      setAlert({ type: 'success', message: 'Test pass status changed to REVOKED' });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to revoke test pass' });
    } finally {
      setScanning(false);
    }
  }

  // 6. Cleanup Methods
  async function handleCleanupSession() {
    if (!testSessionId) {
      setAlert({ type: 'error', message: 'No active test session to cleanup' });
      return;
    }

    try {
      setCleaningUp(true);
      const res = await fetchApi<any>(
        '/admin/test-lab/employee-daily-pass/cleanup-session',
        {
          method: 'POST',
          body: JSON.stringify({ testSessionId }),
        },
      );

      setActiveTestPass(null);
      setScannerResult(null);
      setCleanupMessage(
        `Session ${res.sessionId} purged: ${res.deletedPassesCount} passes, ${res.deletedCheckinsCount} checkins, ${res.deletedLogsCount} scan logs removed.`,
      );
      setAlert({ type: 'success', message: 'Test session records purged cleanly' });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Cleanup failed' });
    } finally {
      setCleaningUp(false);
    }
  }

  async function handleCleanupAll() {
    try {
      setCleaningUp(true);
      const res = await fetchApi<any>('/admin/test-lab/employee-daily-pass/cleanup-all', {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });

      setActiveTestPass(null);
      setScannerResult(null);
      setConfirmPurgeAll(false);
      setCleanupMessage(
        `All Test Lab Data Purged: ${res.deletedPassesCount} test passes, ${res.deletedCheckinsCount} test checkins, ${res.deletedLogsCount} test scan logs. Operational data remains intact.`,
      );
      setAlert({ type: 'success', message: 'All test lab data deleted' });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Purge failed' });
    } finally {
      setCleaningUp(false);
    }
  }

  if (!authChecked) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-maroon border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Hard UI Guard
  if (currentUser?.role !== 'SUPER_ADMIN') {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold font-cinzel text-maroon">Super Admin Restricted Area</h1>
        <p className="text-xs text-ink-soft leading-relaxed">
          The Employee Daily Pass Test Lab is exclusively restricted to <strong>SUPER_ADMIN</strong>.
          Your current role does not have authorization to access this feature.
        </p>
        <Link
          href="/admin"
          className="inline-block mt-4 px-5 py-2.5 rounded-xl bg-maroon text-white text-xs font-bold hover:bg-maroon-dark transition-all"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const selectedTheme = getEventDayTheme(selectedEventDate);

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] sm:h-[calc(100vh-7rem)] max-h-[calc(100vh-6.5rem)] sm:max-h-[calc(100vh-7rem)] overflow-hidden space-y-3">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gold/30 pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-cinzel text-maroon flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-maroon" />
              Employee Daily Pass Test Lab
            </h1>
            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider animate-pulse flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              TEST MODE
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-ink-soft mt-0.5">
            Test employee date-specific QR passes, ticket previews, PDFs, email delivery and scanner validation without affecting operational employee data.
          </p>
        </div>

        {/* Global Purge Action */}
        <div className="flex items-center gap-2 shrink-0">
          {confirmPurgeAll ? (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 p-1 rounded-xl">
              <span className="text-[11px] font-bold text-red-700 px-1.5">Purge All Test Data?</span>
              <button
                onClick={handleCleanupAll}
                disabled={cleaningUp}
                className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
              >
                {cleaningUp ? 'Purging...' : 'Yes, Delete All'}
              </button>
              <button
                onClick={() => setConfirmPurgeAll(false)}
                className="px-2 py-1 bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg hover:bg-stone-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmPurgeAll(true)}
              className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-600 text-xs font-semibold hover:border-red-400 hover:text-red-700 transition-all flex items-center gap-1.5 shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5 text-stone-400" />
              <span>Cleanup All Test Data</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {alert && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 shrink-0 ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {alert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{alert.message}</span>
          </div>
          <button
            onClick={() => setAlert(null)}
            className="text-stone-400 hover:text-stone-700 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {cleanupMessage && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between shrink-0">
          <p>{cleanupMessage}</p>
          <button
            onClick={() => setCleanupMessage(null)}
            className="text-amber-700 hover:text-amber-900 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* Scrollable Main Content Container */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-4">
        {/* Grid: Left Column Controls, Right Column Live Pass & Scanner */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* ================= LEFT COLUMN: STEP 1, STEP 2, STEP 3 ================= */}
          <div className="lg:col-span-5 space-y-4">
            {/* STEP 1: SELECT EMPLOYEE */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-maroon text-white flex items-center justify-center text-[10px]">
                    1
                  </span>
                  Step 1: Select Employee
                </span>
                <span className="text-[10px] text-stone-500 font-medium">From existing database</span>
              </div>

              {/* Search Box */}
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by name, CPF, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-ink focus:outline-none focus:ring-1 focus:ring-maroon"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded-xl text-xs font-semibold hover:bg-stone-200 transition-colors shrink-0"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </form>

              {/* Employee Selector Dropdown / Results */}
              {employeeResults.length > 0 ? (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-stone-500">
                    Select Registered Employee ({employeeResults.length} found)
                  </label>
                  <select
                    value={selectedEmployee?.id || ''}
                    onChange={(e) => {
                      const emp = employeeResults.find((r) => r.id === e.target.value);
                      if (emp) selectEmployee(emp);
                    }}
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-maroon"
                  >
                    {employeeResults.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} &bull; CPF: {emp.cpf} &bull; {emp.department}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-xs text-stone-400 italic">No employees found matching query.</p>
              )}

              {/* Selected Employee Details Card */}
              {selectedEmployee && (
                <div className="p-3 bg-cream/50 rounded-xl border border-gold/30 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-ink text-sm">{selectedEmployee.name}</div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        selectedEmployee.registrationStatus === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedEmployee.registrationStatus === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {selectedEmployee.registrationStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[11px] text-stone-600">
                    <div>CPF: <span className="font-mono font-semibold text-stone-800">{selectedEmployee.cpf}</span></div>
                    <div>Dept: <span className="font-medium text-stone-800">{selectedEmployee.department}</span></div>
                    <div className="col-span-2 truncate">Email: <span className="text-stone-800">{selectedEmployee.email}</span></div>
                    <div className="col-span-2">
                      Selected Dates: <span className="font-semibold text-maroon">{selectedEmployee.bookingDays.join(', ') || 'None'}</span>
                    </div>
                  </div>

                  {/* Sub-Person Selector: Employee or Family Member */}
                  <div className="pt-2 border-t border-gold/20">
                    <label className="text-[10px] font-bold uppercase text-stone-500 block mb-1">
                      Select Test Attendee (Person)
                    </label>
                    <div className="space-y-1">
                      {/* Primary Employee Option */}
                      {selectedEmployee.attendeeId && (
                        <label className="flex items-center gap-2 p-1.5 rounded-lg bg-white border border-stone-200 cursor-pointer hover:border-maroon/40 text-xs">
                          <input
                            type="radio"
                            name="attendeeSelect"
                            checked={selectedAttendeeId === selectedEmployee.attendeeId}
                            onChange={() => {
                              setSelectedAttendeeId(selectedEmployee.attendeeId!);
                              setSelectedAttendeeName(`${selectedEmployee.name} (Employee)`);
                            }}
                            className="text-maroon focus:ring-maroon"
                          />
                          <span className="font-semibold text-ink">{selectedEmployee.name}</span>
                          <span className="text-[10px] font-bold bg-maroon-soft text-maroon-dark px-1.5 py-0.5 rounded ml-auto">
                            Self (Employee)
                          </span>
                        </label>
                      )}

                      {/* Family Members Options */}
                      {selectedEmployee.familyMembers.map((fm) => (
                        <label
                          key={fm.id}
                          className={`flex items-center gap-2 p-1.5 rounded-lg bg-white border border-stone-200 text-xs ${
                            fm.attendeeId
                              ? 'cursor-pointer hover:border-maroon/40'
                              : 'opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <input
                            type="radio"
                            name="attendeeSelect"
                            disabled={!fm.attendeeId}
                            checked={selectedAttendeeId === fm.attendeeId}
                            onChange={() => {
                              if (fm.attendeeId) {
                                setSelectedAttendeeId(fm.attendeeId);
                                setSelectedAttendeeName(`${fm.name} (${fm.relation})`);
                              }
                            }}
                            className="text-maroon focus:ring-maroon"
                          />
                          <span className="font-medium text-ink">{fm.name}</span>
                          <span className="text-[10px] font-bold bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded ml-auto">
                            {fm.relation}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 2: SELECT EVENT DATE */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-maroon text-white flex items-center justify-center text-[10px]">
                  2
                </span>
                Step 2: Select Event Date to Test
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-0.5">
                {OFFICIAL_EVENT_DATES.map((dateStr) => {
                  const theme = getEventDayTheme(dateStr);
                  const isSelected = selectedEventDate === dateStr;

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => setSelectedEventDate(dateStr)}
                      className={`p-1.5 sm:p-2 rounded-xl border text-left transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'border-2 shadow-xs'
                          : 'border-stone-200 hover:border-stone-300 bg-stone-50/50'
                      }`}
                      style={{
                        borderColor: isSelected ? theme.primaryColor : undefined,
                        backgroundColor: isSelected ? theme.bgColor : undefined,
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0"
                        style={{
                          backgroundColor: isSelected ? theme.primaryColor : '#E5DDD3',
                          color: isSelected ? '#FFFFFF' : '#4A3B32',
                        }}
                      >
                        {theme.dayLabel}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] sm:text-[11px] font-bold truncate text-ink">
                          {theme.themeTitle}
                        </div>
                        <div className="text-[9px] text-stone-500">
                          {theme.monthLabel} &bull; {theme.dayOfWeek}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 3: GENERATE TEST PASS */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-maroon text-white flex items-center justify-center text-[10px]">
                  3
                </span>
                Step 3: Generate Test Daily Pass
              </span>

              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-0.5">
                <p className="text-stone-700">
                  Attendee: <strong className="text-ink">{selectedAttendeeName || 'None'}</strong>
                </p>
                <p className="text-stone-700">
                  Target Date: <strong style={{ color: selectedTheme.primaryColor }}>{selectedTheme.fullDateLabel}</strong>
                </p>
                <p className="text-[10px] text-stone-500 pt-0.5">
                  Creates an isolated test <code className="font-mono text-[9px] bg-stone-200 px-1 rounded">DailyEmployeePass</code> record (marked <code className="font-mono text-[9px] bg-amber-100 text-amber-800 px-1 rounded">isTest: true</code>).
                </p>
              </div>

              <button
                onClick={handleGeneratePass}
                disabled={generating || !selectedAttendeeId}
                className="w-full py-2.5 px-4 rounded-xl bg-maroon text-white text-xs font-bold hover:bg-maroon-dark transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Generating Secure Test Pass...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4" />
                    <span>Generate Test Pass</span>
                  </>
                )}
              </button>
            </div>
        </div>

        {/* ================= RIGHT COLUMN: STEP 4, 5, 6, CLEANUP ================= */}
        <div className="lg:col-span-7 space-y-4">
          {activeTestPass ? (
            <>
              {/* STEP 4: TICKET ACTIONS & PREVIEWS */}
              <div
                className="bg-white rounded-2xl p-4 border-2 shadow-xs space-y-3"
                style={{ borderColor: activeTestPass.dayTheme?.secondaryColor || '#C59B27' }}
              >
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400">
                      Active Test Pass Session
                    </span>
                    <h2 className="text-sm sm:text-base font-bold font-cinzel text-ink">
                      {activeTestPass.attendeeName} &bull; {activeTestPass.dayTheme?.themeTitle}
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono bg-stone-100 px-2 py-0.5 rounded text-stone-700">
                    {activeTestPass.testSessionId}
                  </span>
                </div>

                {/* Pass Metadata Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                  <div className="p-2 bg-stone-50 rounded-lg">
                    <span className="text-[9px] text-stone-500 uppercase block">Ticket No</span>
                    <span className="font-mono font-bold text-stone-800 truncate block text-[11px]">
                      {activeTestPass.ticketNumber}
                    </span>
                  </div>
                  <div className="p-2 bg-stone-50 rounded-lg">
                    <span className="text-[9px] text-stone-500 uppercase block">Authorized Date</span>
                    <span className="font-semibold text-stone-800 truncate block text-[11px]">
                      {activeTestPass.dayTheme?.dayLabel} {activeTestPass.dayTheme?.monthLabel}
                    </span>
                  </div>
                  <div className="p-2 bg-stone-50 rounded-lg">
                    <span className="text-[9px] text-stone-500 uppercase block">Pass Status</span>
                    <span
                      className={`font-bold uppercase text-[11px] ${
                        activeTestPass.status === 'ACTIVE'
                          ? 'text-emerald-700'
                          : activeTestPass.status === 'USED'
                          ? 'text-blue-700'
                          : 'text-red-700'
                      }`}
                    >
                      {activeTestPass.status}
                    </span>
                  </div>
                  <div className="p-2 bg-stone-50 rounded-lg">
                    <span className="text-[9px] text-stone-500 uppercase block">Email Status</span>
                    <span className="font-bold uppercase text-[11px] text-stone-700">
                      {emailStatus}
                    </span>
                  </div>
                </div>

                {/* Action Buttons: View Ticket, Download PDF, Preview Email */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <Link
                    href={`/employee/daily-pass/${activeTestPass.qrToken}`}
                    target="_blank"
                    className="py-2 px-3 rounded-xl bg-white border border-stone-300 text-stone-800 text-xs font-bold hover:border-maroon hover:text-maroon transition-all flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Ticket</span>
                  </Link>

                  <a
                    href={`${apiBaseUrl}/public/employee/daily-pass/${activeTestPass.qrToken}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-3 rounded-xl bg-white border border-stone-300 text-stone-800 text-xs font-bold hover:border-maroon hover:text-maroon transition-all flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </a>

                  <button
                    onClick={handleOpenEmailPreview}
                    type="button"
                    className="py-2 px-3 rounded-xl bg-maroon-soft text-maroon-dark border border-maroon/20 text-xs font-bold hover:bg-maroon-soft/80 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview Email</span>
                  </button>
                </div>
              </div>

              {/* STEP 5: TEST EMAIL DISPATCH */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-maroon" />
                    Step 5: Test Email Dispatch
                  </span>
                  <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                    Isolated Test Recipient
                  </span>
                </div>

                <p className="text-[11px] text-stone-500 leading-tight">
                  Enter an address where you want to receive the test pass. The email will <strong>never</strong> be sent to the employee&apos;s real address.
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    placeholder="Enter test recipient (e.g. test@example.com)"
                    value={testEmailRecipient}
                    onChange={(e) => setTestEmailRecipient(e.target.value)}
                    className="flex-1 p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-ink focus:outline-none focus:ring-1 focus:ring-maroon"
                  />
                  <button
                    onClick={handleSendTestEmail}
                    disabled={sendingEmail || !testEmailRecipient}
                    className="px-3.5 py-2 bg-maroon text-white text-xs font-bold rounded-xl hover:bg-maroon-dark transition-all flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    {sendingEmail ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Test Email</span>
                      </>
                    )}
                  </button>
                </div>

                {emailMessage && (
                  <div
                    className={`p-2 rounded-xl text-xs flex items-center justify-between ${
                      emailStatus === 'SENT'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    <span>{emailMessage}</span>
                    {emailStatus === 'FAILED' && (
                      <button
                        onClick={handleSendTestEmail}
                        className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* STEP 6: SCANNER TESTING SUITE */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
                    <ScanLine className="w-3.5 h-3.5 text-maroon" />
                    Step 6: Scanner Turnstile Validation Suite
                  </span>
                  <span className="text-[10px] text-stone-500 font-mono">
                    Token: {activeTestPass.qrToken.substring(0, 10)}...
                  </span>
                </div>

                <p className="text-[11px] text-stone-500">
                  Exercises real turnstile validation logic without affecting production attendance counts.
                </p>

                {/* 4 Test Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {/* VALID SCAN */}
                  <button
                    onClick={() => handleScan()}
                    disabled={scanning}
                    className="p-2.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-center transition-colors group"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                    <div className="text-xs font-bold text-emerald-900">Valid Scan</div>
                    <div className="text-[9px] text-emerald-700">Expects SUCCESS</div>
                  </button>

                  {/* DUPLICATE SCAN */}
                  <button
                    onClick={() => handleScan()}
                    disabled={scanning}
                    className="p-2.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl text-center transition-colors group"
                  >
                    <RotateCcw className="w-4 h-4 text-blue-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                    <div className="text-xs font-bold text-blue-900">Duplicate Scan</div>
                    <div className="text-[9px] text-blue-700">ALREADY_CHECKED_IN</div>
                  </button>

                  {/* WRONG DATE SCAN */}
                  <button
                    onClick={() => handleScan(wrongDateTarget)}
                    disabled={scanning}
                    className="p-2.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-xl text-center transition-colors group"
                  >
                    <Calendar className="w-4 h-4 text-amber-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                    <div className="text-xs font-bold text-amber-900">Wrong Date</div>
                    <div className="text-[9px] text-amber-700">NOT_BOOKED_TODAY</div>
                  </button>

                  {/* REVOKE / REVOKED SCAN */}
                  {activeTestPass.status === 'REVOKED' ? (
                    <button
                      onClick={() => handleScan()}
                      disabled={scanning}
                      className="p-2.5 bg-red-50 border border-red-200 hover:bg-red-100 rounded-xl text-center transition-colors group"
                    >
                      <XCircle className="w-4 h-4 text-red-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                      <div className="text-xs font-bold text-red-900">Scan Revoked</div>
                      <div className="text-[9px] text-red-700">ATTENDEE_INACTIVE</div>
                    </button>
                  ) : (
                    <button
                      onClick={handleRevokePass}
                      disabled={scanning}
                      className="p-2.5 bg-stone-100 border border-stone-300 hover:bg-red-50 hover:border-red-200 rounded-xl text-center transition-colors group"
                    >
                      <XCircle className="w-4 h-4 text-stone-500 group-hover:text-red-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                      <div className="text-xs font-bold text-stone-800 group-hover:text-red-900">Revoke Pass</div>
                      <div className="text-[9px] text-stone-500">Sets status REVOKED</div>
                    </button>
                  )}
                </div>

                {/* Wrong Date Selector for test customization */}
                <div className="flex items-center gap-2 pt-0.5 text-xs">
                  <span className="text-stone-500 text-[10px]">Simulated Wrong Date:</span>
                  <select
                    value={wrongDateTarget}
                    onChange={(e) => setWrongDateTarget(e.target.value)}
                    className="p-1 bg-stone-50 border border-stone-200 rounded-lg text-xs text-ink"
                  >
                    {OFFICIAL_EVENT_DATES.filter((d) => d !== activeTestPass.eventDate).map((d) => (
                      <option key={d} value={d}>
                        {d} ({getEventDayTheme(d).themeTitle})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scanner Test Result Card */}
                {scannerResult && (
                  <div className="p-3 rounded-xl bg-stone-900 text-white text-xs space-y-1.5">
                    <div className="flex items-center justify-between border-b border-stone-800 pb-1.5">
                      <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">
                        Turnstile Scanner API Response
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          scannerResult.scannerResponse?.result === 'SUCCESS'
                            ? 'bg-emerald-900 text-emerald-300'
                            : scannerResult.scannerResponse?.result === 'ALREADY_CHECKED_IN'
                            ? 'bg-blue-900 text-blue-300'
                            : 'bg-red-900 text-red-300'
                        }`}
                      >
                        {scannerResult.scannerResponse?.result || 'RESULT'}
                      </span>
                    </div>

                    <div className="space-y-0.5 text-[10px]">
                      <p>
                        Status Code:{' '}
                        <strong className="text-stone-300">
                          {scannerResult.scannerResponse?.statusCode || 200}
                        </strong>
                      </p>
                      <p>
                        Message:{' '}
                        <strong className="text-stone-200">
                          {scannerResult.scannerResponse?.message || 'N/A'}
                        </strong>
                      </p>
                      <p>
                        Simulated Scan Date:{' '}
                        <span className="text-amber-400 font-mono">
                          {scannerResult.simulatedScanDate}
                        </span>{' '}
                        &bull; Pass Date:{' '}
                        <span className="text-stone-400 font-mono">
                          {scannerResult.passEventDate}
                        </span>
                      </p>
                      <p className="text-[9px] text-stone-400 pt-0.5">
                        Isolated Test Scan Log Recorded &bull; Operational Metrics Unchanged
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* CLEANUP THIS TEST SESSION */}
              <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
                <div>
                  <span className="text-xs font-bold text-stone-800 block">
                    Cleanup Session {activeTestPass.testSessionId}
                  </span>
                  <span className="text-[10px] text-stone-500">
                    Deletes only this session&apos;s test pass, simulated checkins, and scan logs.
                  </span>
                </div>
                <button
                  onClick={handleCleanupSession}
                  disabled={cleaningUp}
                  className="px-3 py-1.5 bg-white border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors shadow-xs"
                >
                  {cleaningUp ? 'Cleaning...' : 'Cleanup This Test'}
                </button>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="bg-white rounded-2xl p-8 border border-stone-200 shadow-xs text-center space-y-3">
              <div className="w-12 h-12 bg-cream text-maroon rounded-full flex items-center justify-center mx-auto border border-gold/30">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="font-cinzel font-bold text-base text-ink">
                No Active Test Pass Session
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Select an employee, pick one of the 9 official event dates, and click <strong>Generate Test Pass</strong> to begin testing.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* ================= EMAIL PREVIEW MODAL ================= */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-stone-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-maroon">
                  Email Template Preview
                </span>
                <h3 className="text-xs font-bold text-stone-800 truncate max-w-md">
                  {previewSubject || 'Subject Loading...'}
                </h3>
              </div>
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-200 text-stone-700 hover:bg-stone-300 flex items-center justify-center text-sm font-bold"
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 bg-stone-100">
              {previewLoading ? (
                <div className="py-24 text-center space-y-3">
                  <div className="w-8 h-8 border-4 border-maroon border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-bold text-stone-500">Rendering Email Template...</p>
                </div>
              ) : (
                <div
                  className="bg-white rounded-2xl shadow-sm overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 flex justify-end">
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="px-4 py-2 bg-stone-200 text-stone-800 text-xs font-bold rounded-xl hover:bg-stone-300"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
