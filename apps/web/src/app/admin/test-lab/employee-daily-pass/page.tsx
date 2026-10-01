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
  Printer,
  Play,
  Zap,
  Check,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { getStoredAuthUser } from '@/lib/auth-session';
import {
  OFFICIAL_EVENT_DATES,
  EVENT_DAY_THEMES,
  getEventDayTheme,
  DEFAULT_DISPATCH_SCHEDULE,
  buildDailyEmployeePassPresentation,
  DailyEmployeePassPresentation,
} from '@/types/shared-types';
import DailyEmployeeTicketCard from '@/components/pass/DailyEmployeeTicketCard';

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

  // Search & Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [employeeResults, setEmployeeResults] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string>('');
  const [selectedAttendeeName, setSelectedAttendeeName] = useState<string>('');
  const [selectedEventDate, setSelectedEventDate] = useState<string>(OFFICIAL_EVENT_DATES[0]);

  // Test Clock Simulator State
  const [testClockMode, setTestClockMode] = useState<'REAL_TIME' | 'SIMULATED_TIME'>('REAL_TIME');
  const [simulatedDate, setSimulatedDate] = useState<string>(OFFICIAL_EVENT_DATES[0]);
  const [simulatedTime, setSimulatedTime] = useState<string>('18:00');
  const [appliedSimulation, setAppliedSimulation] = useState<{ date: string; time: string } | null>(null);
  const [realClock, setRealClock] = useState<Date>(new Date());

  // Daily Dispatch Schedule State
  const [dispatchSchedule, setDispatchSchedule] = useState<Record<string, string>>(DEFAULT_DISPATCH_SCHEDULE);
  const [checkingDispatch, setCheckingDispatch] = useState(false);
  const [dispatchCheckResult, setDispatchCheckResult] = useState<any | null>(null);

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

  // 1. Super Admin Authorization Guard & Initial Clock ticker
  useEffect(() => {
    const user = getStoredAuthUser();
    setCurrentUser(user);
    setAuthChecked(true);

    if (user?.role === 'SUPER_ADMIN') {
      loadInitialEmployees();
    }

    const interval = setInterval(() => {
      setRealClock(new Date());
    }, 1000);

    return () => clearInterval(interval);
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

  // 2. Test Clock Controllers
  function handleApplySimulation() {
    setTestClockMode('SIMULATED_TIME');
    setAppliedSimulation({ date: simulatedDate, time: simulatedTime });
    setSelectedEventDate(simulatedDate);
    setAlert({
      type: 'success',
      message: `Simulated Clock Applied: ${simulatedDate} at ${simulatedTime} IST. Real server time remains untouched.`,
    });
  }

  function handleResetRealTime() {
    setTestClockMode('REAL_TIME');
    setAppliedSimulation(null);
    setAlert({
      type: 'success',
      message: 'Reset to Real System Clock. Simulation disabled.',
    });
  }

  function handleQuickDateSelect(dateStr: string) {
    setSimulatedDate(dateStr);
    setSelectedEventDate(dateStr);
    if (testClockMode === 'SIMULATED_TIME') {
      setAppliedSimulation({ date: dateStr, time: simulatedTime });
    }
  }

  // 3. Automated Dispatch Check Trigger
  async function handleRunDispatchCheck() {
    try {
      setCheckingDispatch(true);
      setDispatchCheckResult(null);

      const targetDate = testClockMode === 'SIMULATED_TIME'
        ? (appliedSimulation?.date || simulatedDate)
        : simulatedDate;
      const targetTime = testClockMode === 'SIMULATED_TIME'
        ? (appliedSimulation?.time || simulatedTime)
        : `${String(realClock.getHours()).padStart(2, '0')}:${String(realClock.getMinutes()).padStart(2, '0')}`;
      const configuredTime = dispatchSchedule[targetDate] || '18:00';

      const payload = {
        simulatedDate: targetDate,
        simulatedTime: targetTime,
        configuredDispatchTime: configuredTime,
        attendeeId: selectedAttendeeId || undefined,
        testRecipientEmail: testEmailRecipient.trim() || undefined,
        testSessionId: testSessionId.trim() || undefined,
      };

      const result = await fetchApi<any>(
        '/admin/test-lab/employee-daily-pass/check-dispatch',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      setDispatchCheckResult(result);

      if (result.pass) {
        setActiveTestPass(result.pass);
        setTestSessionId(result.pass.testSessionId);
        setEmailStatus(result.pass.emailStatus);
      }

      setAlert({
        type: result.isDue ? 'success' : 'error',
        message: result.message,
      });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Dispatch check failed' });
    } finally {
      setCheckingDispatch(false);
    }
  }

  // 4. Generate Test Daily Pass
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

  // 5. Email Preview
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

  // 6. Send Test Email
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

  // 7. Scanner Validations
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

  // 8. Cleanup Methods
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
      setDispatchCheckResult(null);
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
      setDispatchCheckResult(null);
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

  // Compute attendee details for live card presentation
  const selectedFm = selectedEmployee?.familyMembers.find((f) => f.attendeeId === selectedAttendeeId);
  const isSelectedFamily = Boolean(selectedFm);
  const attendeeRelation = selectedFm ? selectedFm.relation : 'Self';
  const attendeeDisplayName = selectedFm ? selectedFm.name : selectedEmployee?.name || 'Attendee';

  const previewPresentation: DailyEmployeePassPresentation | null = activeTestPass?.presentation
    ? activeTestPass.presentation
    : selectedEmployee
    ? buildDailyEmployeePassPresentation({
        eventDate: selectedEventDate,
        ticketNumber:
          (selectedFm ? selectedFm.ticketNumber : selectedEmployee.ticketNumber) ||
          `TK-${selectedEmployee.cpf}-PREVIEW`,
        qrToken: activeTestPass?.qrToken || 'TEST-SAMPLE-TOKEN',
        status: activeTestPass?.status || 'ACTIVE',
        attendeeName: attendeeDisplayName,
        isFamily: isSelectedFamily,
        relation: attendeeRelation,
        employeeName: selectedEmployee.name,
        employeeCpf: selectedEmployee.cpf,
        department: selectedEmployee.department,
      })
    : null;

  return (
    <div className="h-full min-h-0 flex-1 flex flex-col overflow-hidden space-y-3">
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
            Test date-specific employee QR passes, real-time ticket preview, 9-night themes, daily dispatch schedule simulator, and scanner turnstile validation without affecting production data.
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

      {/* ================= TEST CLOCK CONTROLLER BANNER ================= */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-white rounded-2xl p-4 border border-gold/40 shadow-md shrink-0 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gold" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-gold-light">
              Super Admin Test Clock Simulator
            </h2>
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider ${
                testClockMode === 'SIMULATED_TIME'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                  : 'bg-stone-800 text-stone-300 border border-stone-700'
              }`}
            >
              {testClockMode === 'SIMULATED_TIME' ? 'Simulated Time Active' : 'Real System Time Active'}
            </span>
          </div>

          <div className="text-[11px] font-mono text-stone-300">
            {testClockMode === 'SIMULATED_TIME' && appliedSimulation ? (
              <span className="text-amber-300 font-bold">
                SIMULATED: {getEventDayTheme(appliedSimulation.date).fullDateLabel} &bull; {appliedSimulation.time} IST
              </span>
            ) : (
              <span>
                REAL TIME: {realClock.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} &bull; {realClock.toLocaleTimeString('en-US', { hour12: false })} IST
              </span>
            )}
          </div>
        </div>

        {/* Quick Date Pills & Simulator Inputs */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Quick 9-Day Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase text-stone-400 mr-1">Quick Date:</span>
            {OFFICIAL_EVENT_DATES.map((dateStr) => {
              const th = getEventDayTheme(dateStr);
              const isActive = (testClockMode === 'SIMULATED_TIME' && appliedSimulation?.date === dateStr) || simulatedDate === dateStr;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => handleQuickDateSelect(dateStr)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                    isActive
                      ? 'border-gold text-white shadow-xs'
                      : 'border-stone-700 bg-stone-800/80 text-stone-400 hover:text-stone-200 hover:border-stone-600'
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

          {/* Time Picker & Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-stone-800 px-2 py-1 rounded-lg border border-stone-700">
              <span className="text-[10px] text-stone-400 uppercase">Sim Time:</span>
              <input
                type="time"
                value={simulatedTime}
                onChange={(e) => setSimulatedTime(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleApplySimulation}
              className="px-3 py-1 bg-gold text-maroon-deep text-xs font-bold rounded-lg hover:bg-gold-light transition-all flex items-center gap-1"
            >
              <Zap className="w-3 h-3" />
              <span>Apply Simulation</span>
            </button>

            {testClockMode === 'SIMULATED_TIME' && (
              <button
                type="button"
                onClick={handleResetRealTime}
                className="px-2.5 py-1 bg-stone-800 text-stone-300 hover:text-white border border-stone-700 text-xs font-medium rounded-lg transition-all"
              >
                Reset Real Time
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Main Content Container */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-4">
        {/* Grid: Left Column Controls, Right Column Live Pass & Scanner */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* ================= LEFT COLUMN: STEPS 1-3 & DISPATCH TRIGGER ================= */}
          <div className="lg:col-span-6 space-y-4">
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

            {/* STEP 2: SELECT EVENT DATE (9-DAY COLOR IDENTITY) */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-maroon text-white flex items-center justify-center text-[10px]">
                  2
                </span>
                Step 2: Select Event Date (9-Night Visual System)
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-0.5">
                {OFFICIAL_EVENT_DATES.map((dateStr) => {
                  const theme = getEventDayTheme(dateStr);
                  const isSelected = selectedEventDate === dateStr;

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => {
                        setSelectedEventDate(dateStr);
                        setSimulatedDate(dateStr);
                      }}
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

            {/* STEP 3: DISPATCH SCHEDULE & AUTOMATIC TRIGGER SIMULATION */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-maroon text-white flex items-center justify-center text-[10px]">
                    3
                  </span>
                  Step 3: Daily Dispatch Schedule &amp; Automatic Trigger
                </span>
                <span className="text-[10px] text-stone-500 font-mono">
                  Target: {selectedEventDate}
                </span>
              </div>

              <p className="text-[11px] text-stone-500 leading-relaxed">
                Configure dispatch times for each Navratri night. When <strong>Simulated Time &ge; Configured Dispatch Time</strong>, the automatic check triggers date-specific pass generation with guaranteed idempotency.
              </p>

              {/* Schedule Table */}
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-1.5 text-xs bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                {OFFICIAL_EVENT_DATES.map((dateStr) => {
                  const th = getEventDayTheme(dateStr);
                  const isTarget = dateStr === (appliedSimulation?.date || selectedEventDate);

                  return (
                    <div
                      key={dateStr}
                      className={`p-1.5 rounded-lg border flex flex-col justify-between ${
                        isTarget ? 'bg-white border-gold shadow-xs' : 'bg-stone-100/60 border-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-stone-800">
                          Night {th.dayNumber} ({th.dayLabel} Oct)
                        </span>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: th.primaryColor }}
                        />
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-[9px] text-stone-500">Dispatch:</span>
                        <input
                          type="time"
                          value={dispatchSchedule[dateStr] || '18:00'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDispatchSchedule((prev) => ({ ...prev, [dateStr]: val }));
                          }}
                          className="text-[11px] font-mono font-bold bg-white border border-stone-200 rounded px-1 py-0.5 text-ink w-full focus:outline-none focus:border-maroon"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Optional Test Recipient Email */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-stone-500 block">
                  Safe Test Email Recipient (Optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. test@example.com (Never real employee)"
                  value={testEmailRecipient}
                  onChange={(e) => setTestEmailRecipient(e.target.value)}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-ink focus:outline-none focus:ring-1 focus:ring-maroon"
                />
              </div>

              {/* Action Buttons: Run Automatic Dispatch Check OR Manual Generate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRunDispatchCheck}
                  disabled={checkingDispatch || !selectedAttendeeId}
                  className="py-2.5 px-3 rounded-xl bg-gold text-maroon-deep text-xs font-bold hover:bg-gold-light transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {checkingDispatch ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-maroon-deep border-t-transparent rounded-full animate-spin" />
                      <span>Checking Schedule...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Run Automatic Dispatch Check</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleGeneratePass}
                  disabled={generating || !selectedAttendeeId}
                  className="py-2.5 px-3 rounded-xl bg-maroon text-white text-xs font-bold hover:bg-maroon-dark transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Generating Pass...</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Manual Generate Pass</span>
                    </>
                  )}
                </button>
              </div>

              {/* Dispatch Check Result Banner */}
              {dispatchCheckResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    dispatchCheckResult.isDue
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>
                      {dispatchCheckResult.isDue ? 'STATUS: DUE FOR DISPATCH' : 'STATUS: NOT DUE'}
                    </span>
                    <span className="font-mono text-[10px]">
                      Sim: {dispatchCheckResult.simulatedTime} | Cfg: {dispatchCheckResult.configuredDispatchTime}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{dispatchCheckResult.message}</p>
                </div>
              )}
            </div>
          </div>

          {/* ================= RIGHT COLUMN: LIVE TICKET PREVIEW, PASS ACTIONS, SCANNER ================= */}
          <div className="lg:col-span-6 space-y-4">
            {/* LIVE TICKET CARD PREVIEW */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block">
                    {activeTestPass ? 'Active Issued Test Pass' : 'Live Ticket Preview (Pre-Generation)'}
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-ink">
                    {selectedTheme.fullDateLabel} &bull; Night {selectedTheme.dayNumber} ({selectedTheme.themeTitle})
                  </h3>
                </div>

                {activeTestPass ? (
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    ISSUED TEST PASS
                  </span>
                ) : (
                  <span className="text-[10px] font-mono bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                    DRAFT PREVIEW
                  </span>
                )}
              </div>

              {previewPresentation ? (
                <div className="space-y-3">
                  {/* The date-specific Daily Employee Ticket Card */}
                  <DailyEmployeeTicketCard
                    presentation={previewPresentation}
                    qrSvg={null}
                    showSecurityFooter={true}
                  />

                  {/* Actions when Active Test Pass Exists */}
                  {activeTestPass ? (
                    <div className="space-y-3 pt-1">
                      {/* Ticket Action Buttons */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Link
                          href={`/employee/daily-pass/${activeTestPass.qrToken}`}
                          target="_blank"
                          className="py-2 px-2 rounded-xl bg-white border border-stone-300 text-stone-800 text-[11px] font-bold hover:border-maroon hover:text-maroon transition-all flex items-center justify-center gap-1 shadow-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View Pass</span>
                        </Link>

                        <a
                          href={`${apiBaseUrl}/public/employee/daily-pass/${activeTestPass.qrToken}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-2 rounded-xl bg-white border border-stone-300 text-stone-800 text-[11px] font-bold hover:border-maroon hover:text-maroon transition-all flex items-center justify-center gap-1 shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF Ticket</span>
                        </a>

                        <button
                          onClick={handleOpenEmailPreview}
                          type="button"
                          className="py-2 px-2 rounded-xl bg-maroon-soft text-maroon-dark border border-maroon/20 text-[11px] font-bold hover:bg-maroon-soft/80 transition-all flex items-center justify-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Email HTML</span>
                        </button>

                        <button
                          onClick={() => window.print()}
                          type="button"
                          className="py-2 px-2 rounded-xl bg-gold/20 text-maroon-dark border border-gold/40 text-[11px] font-bold hover:bg-gold/30 transition-all flex items-center justify-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                      </div>

                      {/* Send Test Email Card */}
                      <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-ink flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-maroon" />
                            Dispatch Isolated Test Email
                          </span>
                          <span className="text-[10px] font-bold font-mono bg-white px-2 py-0.5 rounded border border-stone-200">
                            Status: {emailStatus}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="email"
                            placeholder="Enter test email address..."
                            value={testEmailRecipient}
                            onChange={(e) => setTestEmailRecipient(e.target.value)}
                            className="flex-1 p-1.5 bg-white border border-stone-200 rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-maroon"
                          />
                          <button
                            type="button"
                            onClick={handleSendTestEmail}
                            disabled={sendingEmail || !testEmailRecipient}
                            className="px-3 py-1.5 bg-maroon text-white text-xs font-bold rounded-lg hover:bg-maroon-dark transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
                          >
                            {sendingEmail ? (
                              <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Sending...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3 h-3" />
                                <span>Send</span>
                              </>
                            )}
                          </button>
                        </div>

                        {emailMessage && (
                          <div
                            className={`p-1.5 rounded-lg text-[11px] ${
                              emailStatus === 'SENT'
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-red-50 text-red-800'
                            }`}
                          >
                            {emailMessage}
                          </div>
                        )}
                      </div>

                      {/* Turnstile Scanner Testing Suite */}
                      <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-stone-200 pb-1.5">
                          <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                            <ScanLine className="w-3.5 h-3.5 text-maroon" />
                            Turnstile Scanner Validation Suite
                          </span>
                          <span className="text-[10px] font-mono text-stone-500">
                            Token: {activeTestPass.qrToken.substring(0, 10)}...
                          </span>
                        </div>

                        {/* Scanner Actions */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {/* Valid Scan */}
                          <button
                            type="button"
                            onClick={() => handleScan()}
                            disabled={scanning}
                            className="p-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-center transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto mb-0.5" />
                            <div className="text-[11px] font-bold text-emerald-900">Valid Scan</div>
                            <div className="text-[9px] text-emerald-700">Expects SUCCESS</div>
                          </button>

                          {/* Duplicate Scan */}
                          <button
                            type="button"
                            onClick={() => handleScan()}
                            disabled={scanning}
                            className="p-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg text-center transition-colors"
                          >
                            <RotateCcw className="w-4 h-4 text-blue-600 mx-auto mb-0.5" />
                            <div className="text-[11px] font-bold text-blue-900">Duplicate Scan</div>
                            <div className="text-[9px] text-blue-700">ALREADY_CHECKED_IN</div>
                          </button>

                          {/* Wrong Date */}
                          <button
                            type="button"
                            onClick={() => handleScan(wrongDateTarget)}
                            disabled={scanning}
                            className="p-2 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg text-center transition-colors"
                          >
                            <Calendar className="w-4 h-4 text-amber-600 mx-auto mb-0.5" />
                            <div className="text-[11px] font-bold text-amber-900">Wrong Date</div>
                            <div className="text-[9px] text-amber-700">NOT_BOOKED_TODAY</div>
                          </button>

                          {/* Revoke Pass */}
                          {activeTestPass.status === 'REVOKED' ? (
                            <button
                              type="button"
                              onClick={() => handleScan()}
                              disabled={scanning}
                              className="p-2 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg text-center transition-colors"
                            >
                              <XCircle className="w-4 h-4 text-red-600 mx-auto mb-0.5" />
                              <div className="text-[11px] font-bold text-red-900">Scan Revoked</div>
                              <div className="text-[9px] text-red-700">ATTENDEE_INACTIVE</div>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleRevokePass}
                              disabled={scanning}
                              className="p-2 bg-stone-100 border border-stone-300 hover:bg-red-50 hover:border-red-200 rounded-lg text-center transition-colors"
                            >
                              <XCircle className="w-4 h-4 text-stone-500 mx-auto mb-0.5" />
                              <div className="text-[11px] font-bold text-stone-800">Revoke Pass</div>
                              <div className="text-[9px] text-stone-500">Sets REVOKED</div>
                            </button>
                          )}
                        </div>

                        {/* Wrong Date Target Dropdown */}
                        <div className="flex items-center gap-2 text-xs pt-1">
                          <span className="text-[10px] text-stone-500">Wrong Date to Simulate:</span>
                          <select
                            value={wrongDateTarget}
                            onChange={(e) => setWrongDateTarget(e.target.value)}
                            className="p-1 bg-white border border-stone-200 rounded-lg text-xs text-ink"
                          >
                            {OFFICIAL_EVENT_DATES.filter((d) => d !== activeTestPass.eventDate).map((d) => (
                              <option key={d} value={d}>
                                {d} ({getEventDayTheme(d).themeTitle})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Scanner Response Output */}
                        {scannerResult && (
                          <div className="p-2.5 rounded-lg bg-stone-900 text-white text-xs space-y-1">
                            <div className="flex items-center justify-between border-b border-stone-800 pb-1">
                              <span className="text-[9px] font-bold text-stone-400 uppercase">Scanner Turnstile Result</span>
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
                            <div className="space-y-0.5 text-[10px] text-stone-300">
                              <p>Message: <strong className="text-white">{scannerResult.scannerResponse?.message || 'N/A'}</strong></p>
                              <p>Scan Date: <span className="text-amber-400 font-mono">{scannerResult.simulatedScanDate}</span> &bull; Pass Date: <span className="text-stone-400 font-mono">{scannerResult.passEventDate}</span></p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Cleanup Session Button */}
                      <div className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                        <span className="text-xs text-stone-600">
                          Session <strong>{activeTestPass.testSessionId}</strong>
                        </span>
                        <button
                          onClick={handleCleanupSession}
                          disabled={cleaningUp}
                          className="px-2.5 py-1 bg-white border border-stone-300 text-stone-700 text-xs font-semibold rounded-lg hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors shadow-xs"
                        >
                          {cleaningUp ? 'Cleaning...' : 'Cleanup This Session'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="py-12 text-center space-y-2 text-stone-400">
                  <User className="w-8 h-8 mx-auto text-stone-300" />
                  <p className="text-xs">Select an employee from Step 1 to preview their date-specific ticket.</p>
                </div>
              )}
            </div>
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
