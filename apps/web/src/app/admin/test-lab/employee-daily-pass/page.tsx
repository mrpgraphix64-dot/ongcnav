'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Users,
  Clock,
  Send,
  RotateCcw,
  Sparkles,
  Printer,
  Zap,
  Check,
  ChevronRight,
  X,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { getStoredAuthUser } from '@/lib/auth-session';
import {
  OFFICIAL_EVENT_DATES,
  getEventDayTheme,
  DEFAULT_DISPATCH_SCHEDULE,
  DailyEmployeePassPresentation,
} from '@/types/shared-types';
import DailyEmployeeTicketCard from '@/components/pass/DailyEmployeeTicketCard';
import AdminModal from '@/components/admin/AdminModal';

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
  presentation?: DailyEmployeePassPresentation;
  createdAt: string;
}

export default function EmployeeDailyPassTestLabPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // STEP 1: Search & Multi-Employee Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [employeeResults, setEmployeeResults] = useState<EmployeeOption[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  // STEP 2: Event Night Selection State (Which official event night to test)
  const [selectedEventDate, setSelectedEventDate] = useState<string>(OFFICIAL_EVENT_DATES[0]);

  // STEP 3: Generated Test Passes State
  const [generating, setGenerating] = useState(false);
  const [generatedPasses, setGeneratedPasses] = useState<TestPassData[]>([]);
  const [testSessionId, setTestSessionId] = useState('');
  const [generationSummary, setGenerationSummary] = useState<{
    newlyGenerated: number;
    alreadyExisted: number;
    total: number;
  } | null>(null);

  // Active View QR Modal for inspecting any generated pass
  const [viewingPass, setViewingPass] = useState<TestPassData | null>(null);

  // Test Email Delivery State
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [selectedPassForEmail, setSelectedPassForEmail] = useState<string>('');
  const [emailStatusMessage, setEmailStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Email Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');

  // Turnstile Scanner Test State
  const [scanning, setScanning] = useState(false);
  const [selectedPassForScan, setSelectedPassForScan] = useState<string>('');
  const [scannerResult, setScannerResult] = useState<any>(null);
  const [wrongDateTarget, setWrongDateTarget] = useState<string>(
    OFFICIAL_EVENT_DATES[1] || '2026-10-12',
  );

  // AUTOMATION SIMULATOR STATE (Visually separate from pass generation)
  const [simDate, setSimDate] = useState<string>(OFFICIAL_EVENT_DATES[0]);
  const [simTime, setSimTime] = useState<string>('18:00');
  const [cfgDispatchTime, setCfgDispatchTime] = useState<string>('18:00');
  const [simTestEmailRecipient, setSimTestEmailRecipient] = useState<string>('');
  const [runningSimulator, setRunningSimulator] = useState(false);
  const [simulatorResult, setSimulatorResult] = useState<any | null>(null);

  // Cleanup State
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [confirmPurgeAll, setConfirmPurgeAll] = useState(false);

  // Global Alert Message
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // 1. Authorization Guard & Initial Employee Load
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
      // Default: select first employee
      if (data && data.length > 0 && selectedEmployeeIds.length === 0) {
        setSelectedEmployeeIds([data[0].id]);
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
      if (data && data.length > 0 && selectedEmployeeIds.length === 0) {
        setSelectedEmployeeIds([data[0].id]);
      }
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Search failed' });
    } finally {
      setSearching(false);
    }
  }

  // Multi-select helpers
  const selectedEmployees = useMemo(() => {
    return employeeResults.filter((emp) => selectedEmployeeIds.includes(emp.id));
  }, [employeeResults, selectedEmployeeIds]);

  const totalPeopleCount = useMemo(() => {
    return selectedEmployees.reduce((acc, emp) => {
      // 1 primary employee + all family members
      return acc + 1 + (emp.familyMembers?.length || 0);
    }, 0);
  }, [selectedEmployees]);

  const allVisibleSelected =
    employeeResults.length > 0 &&
    employeeResults.every((emp) => selectedEmployeeIds.includes(emp.id));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(employeeResults.map((emp) => emp.id));
    }
  }

  function toggleSelectEmployee(id: string) {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  // 2. Generate Test Passes for Selected Employees & Event Date
  async function handleGenerateTestPasses() {
    if (selectedEmployeeIds.length === 0) {
      setAlert({ type: 'error', message: 'Please select at least one employee in Step 1.' });
      return;
    }

    try {
      setGenerating(true);
      setAlert(null);
      setScannerResult(null);
      setEmailStatusMessage(null);

      const payload = {
        employeeIds: selectedEmployeeIds,
        eventDate: selectedEventDate,
        testSessionId: testSessionId.trim() || undefined,
      };

      const result = await fetchApi<any>(
        '/admin/test-lab/employee-daily-pass/generate',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      const passesList: TestPassData[] = result.passes || [result];
      setGeneratedPasses(passesList);
      setTestSessionId(result.testSessionId || passesList[0]?.testSessionId || '');
      setGenerationSummary({
        newlyGenerated: result.newlyGeneratedCount ?? passesList.length,
        alreadyExisted: result.existingCount ?? 0,
        total: passesList.length,
      });

      if (passesList.length > 0) {
        setSelectedPassForEmail(passesList[0].qrToken);
        setSelectedPassForScan(passesList[0].qrToken);
      }

      setAlert({
        type: 'success',
        message: `Successfully generated/retrieved ${passesList.length} isolated test pass(es) for ${selectedTheme.fullDateLabel}.`,
      });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to generate test passes' });
    } finally {
      setGenerating(false);
    }
  }

  // 3. Email Preview & Dispatch
  async function handleOpenEmailPreview(token: string) {
    try {
      setPreviewLoading(true);
      setPreviewModalOpen(true);
      const data = await fetchApi<{ subject: string; html: string }>(
        `/admin/test-lab/employee-daily-pass/preview-email/${token}`,
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

  async function handleSendTestEmail() {
    if (!selectedPassForEmail) {
      setAlert({ type: 'error', message: 'Please select a generated pass to email.' });
      return;
    }
    if (!testEmailRecipient || !testEmailRecipient.includes('@')) {
      setAlert({ type: 'error', message: 'Please enter a valid test recipient email address.' });
      return;
    }

    try {
      setSendingEmail(true);
      setEmailStatusMessage(null);

      const result = await fetchApi<any>(
        '/admin/test-lab/employee-daily-pass/send-test-email',
        {
          method: 'POST',
          body: JSON.stringify({
            token: selectedPassForEmail,
            recipientEmail: testEmailRecipient.trim(),
          }),
        },
      );

      if (result.success) {
        // Update pass in list
        setGeneratedPasses((prev) =>
          prev.map((p) =>
            p.qrToken === selectedPassForEmail ? { ...p, emailStatus: result.emailStatus } : p,
          ),
        );
        setEmailStatusMessage({
          type: 'success',
          text: `Test email dispatched successfully to ${result.sentTo}`,
        });
      } else {
        setEmailStatusMessage({
          type: 'error',
          text: `Delivery failed: ${result.error}`,
        });
      }
    } catch (err: any) {
      setEmailStatusMessage({
        type: 'error',
        text: err.message || 'Failed to dispatch test email',
      });
    } finally {
      setSendingEmail(false);
    }
  }

  // 4. Scanner Validation Test
  async function handleScan(simulatedDate?: string) {
    if (!selectedPassForScan) {
      setAlert({ type: 'error', message: 'Please select a pass to scan.' });
      return;
    }

    try {
      setScanning(true);
      setScannerResult(null);

      const currentPass = generatedPasses.find((p) => p.qrToken === selectedPassForScan);
      const dateToScan = simulatedDate || currentPass?.eventDate || selectedEventDate;

      const res = await fetchApi<any>('/admin/test-lab/employee-daily-pass/scanner/scan', {
        method: 'POST',
        body: JSON.stringify({
          token: selectedPassForScan,
          scanDate: dateToScan,
        }),
      });

      setScannerResult(res);

      if (res.passStatus) {
        setGeneratedPasses((prev) =>
          prev.map((p) =>
            p.qrToken === selectedPassForScan ? { ...p, status: res.passStatus } : p,
          ),
        );
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
    if (!selectedPassForScan) return;

    try {
      setScanning(true);
      const res = await fetchApi<any>('/admin/test-lab/employee-daily-pass/revoke', {
        method: 'POST',
        body: JSON.stringify({ token: selectedPassForScan }),
      });

      setGeneratedPasses((prev) =>
        prev.map((p) =>
          p.qrToken === selectedPassForScan ? { ...p, status: res.status } : p,
        ),
      );
      setAlert({ type: 'success', message: 'Pass status updated to REVOKED.' });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to revoke pass' });
    } finally {
      setScanning(false);
    }
  }

  // 5. Automation Simulator Action (Completely decoupled from Step 1-3)
  async function handleRunDispatchTest() {
    try {
      setRunningSimulator(true);
      setSimulatorResult(null);

      const payload = {
        simulatedDate: simDate,
        simulatedTime: simTime,
        configuredDispatchTime: cfgDispatchTime,
        testRecipientEmail: simTestEmailRecipient.trim() || undefined,
        testSessionId: testSessionId.trim() || undefined,
      };

      const result = await fetchApi<any>(
        '/admin/test-lab/employee-daily-pass/check-dispatch',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      setSimulatorResult(result);
    } catch (err: any) {
      setSimulatorResult({
        isDue: false,
        status: 'ERROR',
        message: err.message || 'Simulator request failed',
      });
    } finally {
      setRunningSimulator(false);
    }
  }

  // 6. Cleanup Actions
  async function handleCleanupSession() {
    if (!testSessionId) {
      setAlert({ type: 'error', message: 'No active test session to cleanup.' });
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

      setGeneratedPasses([]);
      setGenerationSummary(null);
      setScannerResult(null);
      setCleanupMessage(
        `Session ${res.sessionId} purged: ${res.deletedPassesCount} passes, ${res.deletedCheckinsCount} checkins removed.`,
      );
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

      setGeneratedPasses([]);
      setGenerationSummary(null);
      setScannerResult(null);
      setSimulatorResult(null);
      setConfirmPurgeAll(false);
      setCleanupMessage(
        `All Test Lab Data Purged: ${res.deletedPassesCount} test passes, ${res.deletedCheckinsCount} test checkins. Operational data remains intact.`,
      );
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

  // Calculate if simulator is due
  const [simH, simM] = simTime.split(':').map((v) => parseInt(v, 10) || 0);
  const [cfgH, cfgM] = cfgDispatchTime.split(':').map((v) => parseInt(v, 10) || 0);
  const isSimulatorDueLive = simH * 60 + simM >= cfgH * 60 + cfgM;

  return (
    <div className="h-full min-h-0 flex-1 flex flex-col overflow-hidden space-y-3 pb-6">
      {/* ================= TOP HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gold/30 pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-cinzel text-maroon flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-maroon" />
              Employee Daily Pass Test Lab
            </h1>
            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider animate-pulse flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              ISOLATED TEST MODE
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-ink-soft mt-0.5">
            Test employee passes, 9-night themes, family pass hierarchy, and dispatch automation with complete operational isolation.
          </p>
        </div>

        {/* Global Purge Action */}
        <div className="flex items-center gap-2 shrink-0">
          {confirmPurgeAll ? (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 p-1 rounded-xl">
              <span className="text-[11px] font-bold text-red-700 px-1.5">Purge All Test Records?</span>
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

      {/* Scrollable Container */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-6">
        {/* ================= PRIMARY WORKFLOW (WHO? WHEN? GENERATE!) ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* STEP 1 — SELECT EMPLOYEE(S) */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-maroon text-white flex items-center justify-center text-[10px]">
                  1
                </span>
                Step 1 — Select Employee(s)
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-bold text-maroon hover:underline"
              >
                {allVisibleSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {/* Search Box */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, CPF, or department..."
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
                {searching ? '...' : 'Search'}
              </button>
            </form>

            {/* Dynamic Counter Pill */}
            <div className="p-2.5 bg-cream/60 rounded-xl border border-gold/30 text-xs flex items-center justify-between">
              <span className="font-semibold text-ink">
                Selected:{' '}
                <strong className="text-maroon">
                  {selectedEmployees.length} employee{selectedEmployees.length !== 1 ? 's' : ''} &bull; {totalPeopleCount} {totalPeopleCount === 1 ? 'person' : 'people'}
                </strong>
              </span>
              <span className="text-[10px] text-stone-500 font-medium">
                (Includes all family members)
              </span>
            </div>

            {/* Employee Checkbox List */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-stone-100">
              {employeeResults.length === 0 ? (
                <p className="text-xs text-stone-400 italic py-4 text-center">No employees found.</p>
              ) : (
                employeeResults.map((emp) => {
                  const isChecked = selectedEmployeeIds.includes(emp.id);
                  const famCount = emp.familyMembers?.length || 0;
                  const personCount = 1 + famCount;

                  return (
                    <label
                      key={emp.id}
                      className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-maroon-soft/20 border-maroon/40 shadow-2xs'
                          : 'bg-white border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectEmployee(emp.id)}
                        className="mt-0.5 rounded text-maroon focus:ring-maroon cursor-pointer"
                      />
                      <div className="min-w-0 flex-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-ink">{emp.name}</span>
                          <span className="text-[10px] font-mono font-bold text-maroon">
                            CPF: {emp.cpf}
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-500 flex items-center gap-1.5 mt-0.5">
                          <span>{emp.department}</span>
                          &bull;
                          <span className="text-stone-700 font-semibold">
                            {personCount} {personCount === 1 ? 'person' : 'people'}
                          </span>
                          {famCount > 0 && (
                            <span className="text-purple-700">
                              (+{famCount} family)
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* STEP 2 — SELECT EVENT NIGHT & STEP 3 — GENERATE */}
          <div className="lg:col-span-7 space-y-4">
            {/* STEP 2: SELECT EVENT NIGHT */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-maroon text-white flex items-center justify-center text-[10px]">
                    2
                  </span>
                  Step 2 — Select Event Night
                </span>
                <span className="text-[11px] font-bold text-ink" style={{ color: selectedTheme.primaryColor }}>
                  Night {selectedTheme.dayNumber} &bull; {selectedTheme.themeTitle}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-9 gap-1.5">
                {OFFICIAL_EVENT_DATES.map((dateStr) => {
                  const theme = getEventDayTheme(dateStr);
                  const isSelected = selectedEventDate === dateStr;

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => setSelectedEventDate(dateStr)}
                      className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                        isSelected
                          ? 'border-2 shadow-xs'
                          : 'border-stone-200 hover:border-stone-300 bg-stone-50/50'
                      }`}
                      style={{
                        borderColor: isSelected ? theme.primaryColor : undefined,
                        backgroundColor: isSelected ? theme.bgColor : undefined,
                      }}
                    >
                      <span
                        className="text-[9px] font-extrabold uppercase"
                        style={{ color: isSelected ? theme.primaryColor : '#78716C' }}
                      >
                        Night {theme.dayNumber}
                      </span>
                      <span
                        className="text-base font-black leading-tight"
                        style={{ color: isSelected ? theme.primaryColor : '#292524' }}
                      >
                        {theme.dayLabel}
                      </span>
                      <span className="text-[8px] uppercase tracking-wider text-stone-500 font-semibold truncate max-w-full">
                        {theme.themeTitle.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 3 — GENERATE TEST PASSES */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-maroon text-white flex items-center justify-center text-[10px]">
                    3
                  </span>
                  Step 3 — Generate Test Passes
                </span>
                <span className="text-[10px] text-stone-500">
                  Target Date: <strong>{selectedTheme.fullDateLabel}</strong>
                </span>
              </div>

              {/* Clear Summary Box */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-ink">
                  <span>Selected Attendees:</span>
                  <span className="text-maroon font-bold">
                    {selectedEmployees.length} employee{selectedEmployees.length !== 1 ? 's' : ''} &bull; {totalPeopleCount} total {totalPeopleCount === 1 ? 'person' : 'people'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-stone-600 text-[11px]">
                  <span>Event Night:</span>
                  <span className="font-semibold" style={{ color: selectedTheme.primaryColor }}>
                    Night {selectedTheme.dayNumber} &bull; {selectedTheme.themeTitle} ({selectedTheme.fullDateLabel})
                  </span>
                </div>
                <p className="text-[10px] text-stone-500 pt-1 border-t border-stone-200/80">
                  Generates date-specific isolated test <code className="font-mono bg-stone-200 px-1 rounded">DailyEmployeePass</code> records. Operational metrics and real attendance remain untouched.
                </p>
              </div>

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={handleGenerateTestPasses}
                disabled={generating || selectedEmployeeIds.length === 0}
                className="w-full py-2.5 px-4 rounded-xl bg-maroon text-white text-xs font-bold hover:bg-maroon-dark transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Generating Secure Test Passes...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 text-gold-light" />
                    <span>Generate Test Passes ({totalPeopleCount} passes)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ================= RESULTS: AFTER GENERATION ================= */}
        {generatedPasses.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  &check;
                </div>
                <h2 className="text-sm font-bold text-ink font-cinzel">
                  {generatedPasses.length} Test Daily Passes Generated
                </h2>
                {generationSummary && (
                  <span className="text-[10px] font-mono bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full">
                    {generationSummary.newlyGenerated} created &bull; {generationSummary.alreadyExisted} reused
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-stone-500">
                  Session: {testSessionId}
                </span>
                <button
                  type="button"
                  onClick={handleCleanupSession}
                  disabled={cleaningUp}
                  className="px-2.5 py-1 bg-stone-100 text-stone-700 hover:text-red-700 hover:bg-red-50 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {cleaningUp ? 'Cleaning...' : 'Cleanup This Session'}
                </button>
              </div>
            </div>

            {/* Passes Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold tracking-wider border-b border-stone-200">
                    <th className="py-2.5 px-3">Attendee</th>
                    <th className="py-2.5 px-3">Pass Type</th>
                    <th className="py-2.5 px-3">Primary Employee</th>
                    <th className="py-2.5 px-3">Employee CPF</th>
                    <th className="py-2.5 px-3">Event Date</th>
                    <th className="py-2.5 px-3">Pass Status</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {generatedPasses.map((p) => {
                    const theme = p.dayTheme || getEventDayTheme(p.eventDate);

                    return (
                      <tr key={p.testPassId || p.qrToken} className="hover:bg-cream/40 transition-colors">
                        {/* Attendee */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-ink">{p.attendeeName}</div>
                          <div className="font-mono text-[9px] text-stone-400">{p.ticketNumber}</div>
                        </td>

                        {/* Pass Type */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              p.isFamily
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {p.passType}
                          </span>
                        </td>

                        {/* Primary Employee */}
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-ink">{p.employeeName}</div>
                        </td>

                        {/* CPF */}
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[11px] font-bold text-maroon">
                            {p.employeeCpf}
                          </span>
                        </td>

                        {/* Event Date */}
                        <td className="py-2.5 px-3">
                          <span
                            className="inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs"
                            style={{ backgroundColor: theme.primaryColor }}
                          >
                            {theme.dayLabel} {theme.monthLabel} (Night {theme.dayNumber})
                          </span>
                        </td>

                        {/* Pass Status */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-bold uppercase text-[10px] ${
                              p.status === 'ACTIVE'
                                ? 'text-emerald-700'
                                : p.status === 'USED'
                                ? 'text-blue-700'
                                : 'text-red-700'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>

                        {/* Email Status */}
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] font-mono text-stone-600">
                            {p.emailStatus}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingPass(p)}
                              className="px-2 py-1 bg-stone-100 hover:bg-maroon hover:text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                              title="View Ticket Modal"
                            >
                              View Pass
                            </button>
                            <a
                              href={`${apiBaseUrl}/public/employee/daily-pass/${p.qrToken}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg text-[10px] font-bold transition-colors"
                              title="Download PDF"
                            >
                              PDF
                            </a>
                            <button
                              type="button"
                              onClick={() => handleOpenEmailPreview(p.qrToken)}
                              className="px-2 py-1 bg-maroon-soft text-maroon-dark hover:bg-maroon hover:text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                              title="Email HTML Preview"
                            >
                              Email
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Test Email Delivery & Turnstile Scanner Testing Suite */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
              {/* TEST EMAIL DELIVERY */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-maroon" />
                    Test Email Delivery
                  </span>
                  <span className="text-[9px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                    Safe Test Recipient Only
                  </span>
                </div>
                <p className="text-[10px] text-stone-500">
                  Sends the pass template strictly to your designated test address. Real employee emails are never contacted.
                </p>

                <div className="space-y-1.5">
                  <select
                    value={selectedPassForEmail}
                    onChange={(e) => setSelectedPassForEmail(e.target.value)}
                    className="w-full p-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium text-ink"
                  >
                    {generatedPasses.map((p) => (
                      <option key={p.qrToken} value={p.qrToken}>
                        {p.attendeeName} ({p.passType}) &bull; {p.ticketNumber}
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="Enter test email (e.g. test@example.com)"
                      value={testEmailRecipient}
                      onChange={(e) => setTestEmailRecipient(e.target.value)}
                      className="flex-1 p-1.5 bg-white border border-stone-200 rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-maroon"
                    />
                    <button
                      type="button"
                      onClick={handleSendTestEmail}
                      disabled={sendingEmail || !testEmailRecipient}
                      className="px-3 py-1.5 bg-maroon text-white text-xs font-bold rounded-lg hover:bg-maroon-dark transition-all flex items-center gap-1 shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      {sendingEmail ? 'Sending...' : 'Send Test'}
                    </button>
                  </div>
                </div>

                {emailStatusMessage && (
                  <div
                    className={`p-1.5 rounded-lg text-[11px] ${
                      emailStatusMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-red-50 text-red-800'
                    }`}
                  >
                    {emailStatusMessage.text}
                  </div>
                )}
              </div>

              {/* TEST TURNSTILE SCANNER */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <ScanLine className="w-3.5 h-3.5 text-maroon" />
                    Turnstile Scanner Suite
                  </span>
                  <span className="text-[10px] font-mono text-stone-500">
                    Isolated Test Log
                  </span>
                </div>

                <select
                  value={selectedPassForScan}
                  onChange={(e) => setSelectedPassForScan(e.target.value)}
                  className="w-full p-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium text-ink"
                >
                  {generatedPasses.map((p) => (
                    <option key={p.qrToken} value={p.qrToken}>
                      {p.attendeeName} ({p.passType}) &bull; {p.ticketNumber}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleScan()}
                    disabled={scanning}
                    className="p-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-center transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mx-auto" />
                    <div className="text-[10px] font-bold text-emerald-900 mt-0.5">Valid</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScan()}
                    disabled={scanning}
                    className="p-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg text-center transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-blue-600 mx-auto" />
                    <div className="text-[10px] font-bold text-blue-900 mt-0.5">Duplicate</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScan(wrongDateTarget)}
                    disabled={scanning}
                    className="p-1.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg text-center transition-colors cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-600 mx-auto" />
                    <div className="text-[10px] font-bold text-amber-900 mt-0.5">Wrong Date</div>
                  </button>

                  <button
                    type="button"
                    onClick={handleRevokePass}
                    disabled={scanning}
                    className="p-1.5 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg text-center transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5 text-red-600 mx-auto" />
                    <div className="text-[10px] font-bold text-red-900 mt-0.5">Revoke</div>
                  </button>
                </div>

                {scannerResult && (
                  <div className="p-2 rounded-lg bg-stone-900 text-white text-[10px] space-y-0.5">
                    <div className="flex items-center justify-between border-b border-stone-800 pb-1">
                      <span className="text-stone-400 uppercase font-bold">Scanner Response</span>
                      <span
                        className={`font-mono font-bold px-1 rounded ${
                          scannerResult.scannerResponse?.result === 'SUCCESS'
                            ? 'bg-emerald-900 text-emerald-300'
                            : 'bg-red-900 text-red-300'
                        }`}
                      >
                        {scannerResult.scannerResponse?.result || 'RESULT'}
                      </span>
                    </div>
                    <p className="text-stone-200">{scannerResult.scannerResponse?.message}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= VISUALLY SEPARATE: AUTOMATION SIMULATOR ================= */}
        <div className="bg-stone-900 text-white rounded-3xl p-5 border border-gold/40 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gold" />
                <h2 className="text-sm sm:text-base font-bold font-cinzel text-gold-light uppercase tracking-wider">
                  Automation Simulator
                </h2>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    isSimulatorDueLive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {isSimulatorDueLive ? '✓ Dispatch is Due' : 'Not Due'}
                </span>
              </div>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Simulate whether automated daily QR dispatch would trigger for a particular simulated date and time. Does not alter system clocks or production data.
              </p>
            </div>
          </div>

          {/* Quick Date Buttons (Only changes Simulated Date) */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-stone-400 block">
              Simulated Date Quick Select (Navratri Nights):
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {OFFICIAL_EVENT_DATES.map((dateStr) => {
                const th = getEventDayTheme(dateStr);
                const isActive = simDate === dateStr;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => setSimDate(dateStr)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      isActive
                        ? 'border-gold text-white shadow-xs'
                        : 'border-stone-700 bg-stone-800/80 text-stone-400 hover:text-stone-200'
                    }`}
                    style={{
                      backgroundColor: isActive ? th.primaryColor : undefined,
                    }}
                  >
                    Oct {th.dayLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Simulator Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            {/* Simulated Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-stone-400 block">
                Simulated Date
              </label>
              <select
                value={simDate}
                onChange={(e) => setSimDate(e.target.value)}
                className="w-full p-2 bg-stone-800 border border-stone-700 rounded-xl text-xs text-white focus:outline-none focus:border-gold"
              >
                {OFFICIAL_EVENT_DATES.map((d) => (
                  <option key={d} value={d}>
                    {d} ({getEventDayTheme(d).themeTitle})
                  </option>
                ))}
              </select>
            </div>

            {/* Simulated Time */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-stone-400 block">
                Simulated Time
              </label>
              <input
                type="time"
                value={simTime}
                onChange={(e) => setSimTime(e.target.value)}
                className="w-full p-2 bg-stone-800 border border-stone-700 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-gold"
              />
            </div>

            {/* Configured Dispatch Time */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-stone-400 block">
                Configured Dispatch Time
              </label>
              <input
                type="time"
                value={cfgDispatchTime}
                onChange={(e) => setCfgDispatchTime(e.target.value)}
                className="w-full p-2 bg-stone-800 border border-stone-700 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-gold"
              />
            </div>

            {/* Safe Test Recipient */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-stone-400 block">
                Safe Test Recipient (Optional)
              </label>
              <input
                type="email"
                placeholder="test@example.com"
                value={simTestEmailRecipient}
                onChange={(e) => setSimTestEmailRecipient(e.target.value)}
                className="w-full p-2 bg-stone-800 border border-stone-700 rounded-xl text-xs text-white focus:outline-none focus:border-gold"
              />
            </div>
          </div>

          {/* Action & Result */}
          <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleRunDispatchTest}
              disabled={runningSimulator}
              className="py-2.5 px-4 rounded-xl bg-gold text-maroon-deep text-xs font-bold hover:bg-gold-light transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {runningSimulator ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-maroon-deep border-t-transparent rounded-full animate-spin" />
                  <span>Evaluating Dispatch Schedule...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Run Dispatch Test</span>
                </>
              )}
            </button>

            <span className="text-[11px] text-stone-400">
              Evaluates: <strong className="text-white">{simTime} &ge; {cfgDispatchTime}</strong> on {simDate}
            </span>
          </div>

          {/* Simulator Result Banner */}
          {simulatorResult && (
            <div
              className={`p-3 rounded-xl border text-xs space-y-1 ${
                simulatorResult.isDue
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                  : 'bg-amber-950/80 border-amber-500/40 text-amber-200'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span>
                  {simulatorResult.isDue ? 'STATUS: DISPATCH IS DUE' : 'STATUS: NOT DUE'}
                </span>
                <span className="font-mono text-[10px]">
                  Simulated: {simulatorResult.simulatedTime} &bull; Configured: {simulatorResult.configuredDispatchTime}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-stone-300">{simulatorResult.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* ================= VIEW PASS MODAL (DATE-SPECIFIC TICKET) ================= */}
      {viewingPass && viewingPass.presentation && (
        <AdminModal
          isOpen={!!viewingPass}
          onClose={() => setViewingPass(null)}
          title="Daily Entry Ticket Preview"
        >
          <div className="space-y-4 p-1">
            <DailyEmployeeTicketCard
              presentation={viewingPass.presentation}
              qrSvg={null}
              showSecurityFooter={true}
            />

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-gold text-maroon-deep font-bold text-xs hover:bg-gold-light transition-all flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print QR Pass</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingPass(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-ink hover:bg-stone-100"
              >
                Close
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* ================= EMAIL PREVIEW MODAL ================= */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-stone-200">
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
