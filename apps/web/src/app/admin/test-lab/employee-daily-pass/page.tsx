'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  FlaskConical,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Download,
  Mail,
  RefreshCw,
  QrCode,
  ScanLine,
  Trash2,
  Eye,
  Calendar,
  Clock,
  RotateCcw,
  Sparkles,
  Printer,
  Zap,
  Check,
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
  simulatedDispatchTime?: string | null;
  simulatedEventTime?: string | null;
  realCreatedAt?: string;
  realEmailSentAt?: string | null;
  createdAt: string;
}

export default function EmployeeDailyPassTestLabPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // TOP CONTROL: SELECTED EVENT DATE & PRODUCTION DISPATCH SCHEDULE
  const [testDate, setTestDate] = useState<string>(OFFICIAL_EVENT_DATES[0]);
  const [testEmailRecipient, setTestEmailRecipient] = useState<string>('');
  const [dispatchSchedule, setDispatchSchedule] = useState<Record<string, string>>(DEFAULT_DISPATCH_SCHEDULE);

  // Time arithmetic helpers
  function addMinutes(timeStr: string, mins: number): string {
    const [h, m] = (timeStr || '15:40').split(':').map((v) => parseInt(v, 10) || 0);
    const total = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
    const resH = Math.floor(total / 60);
    const resM = total % 60;
    return `${String(resH).padStart(2, '0')}:${String(resM).padStart(2, '0')}`;
  }

  function subtractMinutes(timeStr: string, mins: number): string {
    return addMinutes(timeStr, -mins);
  }

  // Production schedule is the single source of truth for dispatch time
  const configuredDispatchTime = dispatchSchedule[testDate] || DEFAULT_DISPATCH_SCHEDULE[testDate] || '17:00';
  const selectedTheme = getEventDayTheme(testDate);

  // 10-Minute Simulation State
  const [simulationStartTime, setSimulationStartTime] = useState<string>(() =>
    subtractMinutes(DEFAULT_DISPATCH_SCHEDULE[OFFICIAL_EVENT_DATES[0]] || '18:00', 5),
  );
  const [simulatedCurrentTime, setSimulatedCurrentTime] = useState<string>(simulationStartTime);
  const [simulationMinuteStep, setSimulationMinuteStep] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isSimulationPaused, setIsSimulationPaused] = useState<boolean>(false);
  const [simulationPhase, setSimulationPhase] = useState<'IDLE' | 'WAITING' | 'DISPATCH_SATISFIED' | 'COMPLETED'>('IDLE');
  const [hasDispatched, setHasDispatched] = useState<boolean>(false);
  const [simulationSpeedMs, setSimulationSpeedMs] = useState<number>(1000); // 1s per simulated minute
  const [autoResetOnComplete, setAutoResetOnComplete] = useState<boolean>(true);

  const simulationEndTime = useMemo(() => addMinutes(simulationStartTime, 10), [simulationStartTime]);

  // STEP 1: Search & Approved Employees Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [employeeResults, setEmployeeResults] = useState<EmployeeOption[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  // STEP 2 & 3: Generation & Simulation State
  const [simulating, setSimulating] = useState(false);
  const [generatedPasses, setGeneratedPasses] = useState<TestPassData[]>([]);
  const [testSessionId, setTestSessionId] = useState('');
  const [ineligibleAttendees, setIneligibleAttendees] = useState<any[]>([]);
  const [generationSummary, setGenerationSummary] = useState<{
    newlyGenerated: number;
    alreadyExisted: number;
    emailsSent: number;
    total: number;
  } | null>(null);
  const [simulationResultBanner, setSimulationResultBanner] = useState<{
    isDue: boolean;
    text: string;
  } | null>(null);

  // Retry single email state
  const [retryingPassToken, setRetryingPassToken] = useState<string | null>(null);

  // Active View QR Modal for inspecting any generated pass
  const [viewingPass, setViewingPass] = useState<TestPassData | null>(null);

  // Email Preview Modal & Ref for Auto Scroll Reset
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const previewScrollRef = useRef<HTMLDivElement>(null);

  // Turnstile Scanner Test State
  const [scanning, setScanning] = useState(false);
  const [selectedPassForScan, setSelectedPassForScan] = useState<string>('');
  const [scannerResult, setScannerResult] = useState<any>(null);
  const [wrongDateTarget, setWrongDateTarget] = useState<string>(
    OFFICIAL_EVENT_DATES[1] || '2026-10-12',
  );

  // Cleanup State
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [confirmPurgeAll, setConfirmPurgeAll] = useState(false);

  // Global Alert Message
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // 1. Authorization Guard, Initial Employee Load & Production Schedule Sync
  useEffect(() => {
    const user = getStoredAuthUser();
    setCurrentUser(user);
    setAuthChecked(true);

    if (user?.email) {
      setTestEmailRecipient(user.email);
    }

    if (user?.role === 'SUPER_ADMIN') {
      loadInitialEmployees();
      fetchApi<Record<string, string>>('/admin/test-lab/employee-daily-pass/dispatch-schedule')
        .then((sched) => {
          if (sched && typeof sched === 'object') {
            setDispatchSchedule(sched);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Reset email preview scroll position to top whenever modal opens
  useEffect(() => {
    if (previewModalOpen && previewScrollRef.current) {
      previewScrollRef.current.scrollTop = 0;
    }
  }, [previewModalOpen, previewHtml]);

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

  // People eligibility breakdown for the selected test date
  const peopleForSelectedDate = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      role: string;
      isFamily: boolean;
      employeeName: string;
      employeeCpf: string;
      isEligible: boolean;
      selectedDates: string[];
    }> = [];

    for (const emp of selectedEmployees) {
      // Primary employee
      list.push({
        id: emp.attendeeId || `emp-${emp.id}`,
        name: emp.name,
        role: 'Employee',
        isFamily: false,
        employeeName: emp.name,
        employeeCpf: emp.cpf,
        isEligible: (emp.bookingDays || []).includes(testDate),
        selectedDates: emp.bookingDays || [],
      });

      // Family members
      for (const fm of emp.familyMembers || []) {
        list.push({
          id: fm.attendeeId || `fm-${fm.id}`,
          name: fm.name,
          role: fm.relation || 'Family Member',
          isFamily: true,
          employeeName: emp.name,
          employeeCpf: emp.cpf,
          isEligible: (fm.bookingDays || []).includes(testDate),
          selectedDates: fm.bookingDays || [],
        });
      }
    }

    return list;
  }, [selectedEmployees, testDate]);

  const eligiblePeople = useMemo(() => {
    return peopleForSelectedDate.filter((p) => p.isEligible);
  }, [peopleForSelectedDate]);

  const ineligiblePeople = useMemo(() => {
    return peopleForSelectedDate.filter((p) => !p.isEligible);
  }, [peopleForSelectedDate]);

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

  // Timeline points for the 10-minute window (0 to 10 minutes)
  const timelinePoints = useMemo(() => {
    const [startH, startM] = simulationStartTime.split(':').map((v) => parseInt(v, 10) || 0);
    const [dispH, dispM] = configuredDispatchTime.split(':').map((v) => parseInt(v, 10) || 0);
    const startMins = startH * 60 + startM;
    const dispMins = dispH * 60 + dispM;

    const points: Array<{ minute: number; time: string; isDue: boolean }> = [];
    for (let m = 0; m <= 10; m++) {
      const stepMins = startMins + m;
      points.push({
        minute: m,
        time: addMinutes(simulationStartTime, m),
        isDue: stepMins >= dispMins,
      });
    }
    return points;
  }, [simulationStartTime, configuredDispatchTime]);

  const [currH, currM] = (simulatedCurrentTime || '15:40').split(':').map((v) => parseInt(v, 10) || 0);
  const [cfgH, cfgM] = configuredDispatchTime.split(':').map((v) => parseInt(v, 10) || 0);
  const isDueLive = currH * 60 + currM >= cfgH * 60 + cfgM;

  // Auto-synchronize default simulation start time (5 mins before dispatch) when date or schedule changes
  useEffect(() => {
    if (!isSimulating && simulationPhase === 'IDLE') {
      const defStart = subtractMinutes(configuredDispatchTime, 5);
      setSimulationStartTime(defStart);
      setSimulatedCurrentTime(defStart);
    }
  }, [configuredDispatchTime, isSimulating, simulationPhase]);

  // Automatic 10-Minute Simulation Window Engine
  useEffect(() => {
    if (!isSimulating || isSimulationPaused) return;

    const timer = setTimeout(async () => {
      const nextStep = simulationMinuteStep + 1;

      if (nextStep > 10) {
        setIsSimulating(false);
        setSimulationPhase('COMPLETED');

        if (autoResetOnComplete && testSessionId) {
          try {
            await fetchApi<any>('/admin/test-lab/employee-daily-pass/cleanup-session', {
              method: 'POST',
              body: JSON.stringify({ testSessionId }),
            });
            setGeneratedPasses([]);
            setScannerResult(null);
            setCleanupMessage(
              `TEST SESSION COMPLETE: 10-minute simulation window (${simulationStartTime} → ${simulationEndTime}) finished. Test data for session ${testSessionId} reset successfully. Real production data remains untouched.`,
            );
          } catch (err: any) {
            setAlert({ type: 'error', message: err.message || 'Auto-cleanup failed' });
          }
        }
        return;
      }

      const nextTime = addMinutes(simulationStartTime, nextStep);
      setSimulationMinuteStep(nextStep);
      setSimulatedCurrentTime(nextTime);

      const [nextH, nextM] = nextTime.split(':').map((v) => parseInt(v, 10) || 0);
      const [dispH, dispM] = configuredDispatchTime.split(':').map((v) => parseInt(v, 10) || 0);
      const isDue = nextH * 60 + nextM >= dispH * 60 + dispM;

      if (isDue && !hasDispatched) {
        setHasDispatched(true);
        setSimulationPhase('DISPATCH_SATISFIED');

        try {
          const result = await fetchApi<any>(
            '/admin/test-lab/employee-daily-pass/simulate-delivery',
            {
              method: 'POST',
              body: JSON.stringify({
                employeeIds: selectedEmployeeIds,
                simulatedDate: testDate,
                simulatedTime: nextTime,
                configuredDispatchTime,
                testRecipientEmail: testEmailRecipient.trim() || undefined,
                testSessionId,
              }),
            },
          );

          const passesList: TestPassData[] = result.passes || [result];
          setGeneratedPasses(passesList);
          setIneligibleAttendees(result.ineligible || []);
          setGenerationSummary({
            newlyGenerated: result.newlyGeneratedCount ?? passesList.length,
            alreadyExisted: result.existingCount ?? 0,
            emailsSent: result.emailsSentCount ?? 0,
            total: passesList.length,
          });

          if (passesList.length > 0) {
            setSelectedPassForScan(passesList[0].qrToken);
          }
        } catch (err: any) {
          setAlert({ type: 'error', message: err.message || 'Dispatch evaluation failed' });
        }
      } else if (!isDue) {
        setSimulationPhase('WAITING');
      }
    }, simulationSpeedMs);

    return () => clearTimeout(timer);
  }, [
    isSimulating,
    isSimulationPaused,
    simulationMinuteStep,
    simulationStartTime,
    simulationEndTime,
    configuredDispatchTime,
    hasDispatched,
    autoResetOnComplete,
    simulationSpeedMs,
    selectedEmployeeIds,
    testDate,
    testEmailRecipient,
    testSessionId,
  ]);

  // 2. Primary Simulation Actions
  async function handleStartSimulation() {
    if (selectedEmployeeIds.length === 0) {
      setAlert({ type: 'error', message: 'Please select at least one employee from the roster.' });
      return;
    }

    if (eligiblePeople.length === 0) {
      setAlert({
        type: 'error',
        message: `None of the selected people registered for ${selectedTheme.fullDateLabel}. Please select a different event date or employee.`,
      });
      return;
    }

    const newSessionId = `EMP-SIM-${Date.now().toString(36).toUpperCase()}`;
    setTestSessionId(newSessionId);
    setGeneratedPasses([]);
    setIneligibleAttendees([]);
    setGenerationSummary(null);
    setSimulationResultBanner(null);
    setScannerResult(null);
    setAlert(null);
    setCleanupMessage(null);

    setSimulationMinuteStep(0);
    setSimulatedCurrentTime(simulationStartTime);
    setIsSimulating(true);
    setIsSimulationPaused(false);

    // Check if start time itself satisfies dispatch condition (e.g. start at or after dispatch)
    const [startH, startM] = simulationStartTime.split(':').map((v) => parseInt(v, 10) || 0);
    const [dispH, dispM] = configuredDispatchTime.split(':').map((v) => parseInt(v, 10) || 0);
    const dueAtStart = startH * 60 + startM >= dispH * 60 + dispM;

    if (dueAtStart) {
      setHasDispatched(true);
      setSimulationPhase('DISPATCH_SATISFIED');
      try {
        const result = await fetchApi<any>(
          '/admin/test-lab/employee-daily-pass/simulate-delivery',
          {
            method: 'POST',
            body: JSON.stringify({
              employeeIds: selectedEmployeeIds,
              simulatedDate: testDate,
              simulatedTime: simulationStartTime,
              configuredDispatchTime,
              testRecipientEmail: testEmailRecipient.trim() || undefined,
              testSessionId: newSessionId,
            }),
          },
        );
        const passesList: TestPassData[] = result.passes || [result];
        setGeneratedPasses(passesList);
        setIneligibleAttendees(result.ineligible || []);
        setGenerationSummary({
          newlyGenerated: result.newlyGeneratedCount ?? passesList.length,
          alreadyExisted: result.existingCount ?? 0,
          emailsSent: result.emailsSentCount ?? 0,
          total: passesList.length,
        });
        if (passesList.length > 0) {
          setSelectedPassForScan(passesList[0].qrToken);
        }
      } catch (err: any) {
        setAlert({ type: 'error', message: err.message || 'Dispatch evaluation failed' });
      }
    } else {
      setHasDispatched(false);
      setSimulationPhase('WAITING');
    }
  }

  function handleTogglePause() {
    setIsSimulationPaused((prev) => !prev);
  }

  async function handleResetSimulation() {
    setIsSimulating(false);
    setIsSimulationPaused(false);
    setSimulationPhase('IDLE');
    setSimulationMinuteStep(0);
    setSimulatedCurrentTime(simulationStartTime);
    setHasDispatched(false);

    if (testSessionId) {
      try {
        setCleaningUp(true);
        await fetchApi<any>('/admin/test-lab/employee-daily-pass/cleanup-session', {
          method: 'POST',
          body: JSON.stringify({ testSessionId }),
        });
        setGeneratedPasses([]);
        setGenerationSummary(null);
        setScannerResult(null);
        setCleanupMessage(`Simulation reset. Test session ${testSessionId} cleaned up.`);
      } catch (err: any) {
        setAlert({ type: 'error', message: err.message || 'Failed to cleanup session' });
      } finally {
        setCleaningUp(false);
      }
    }
  }

  async function handleRunInstantWindow() {
    if (selectedEmployeeIds.length === 0) {
      setAlert({ type: 'error', message: 'Please select at least one employee from the roster.' });
      return;
    }
    if (eligiblePeople.length === 0) {
      setAlert({
        type: 'error',
        message: `None of the selected people registered for ${selectedTheme.fullDateLabel}.`,
      });
      return;
    }

    try {
      setSimulating(true);
      setAlert(null);
      const newSessionId = `EMP-WIN-${Date.now().toString(36).toUpperCase()}`;
      setTestSessionId(newSessionId);

      const res = await fetchApi<any>(
        '/admin/test-lab/employee-daily-pass/simulate-window',
        {
          method: 'POST',
          body: JSON.stringify({
            employeeIds: selectedEmployeeIds,
            simulatedDate: testDate,
            simulatedStartTime: simulationStartTime,
            testRecipientEmail: testEmailRecipient.trim() || undefined,
            testSessionId: newSessionId,
            autoCleanup: false,
          }),
        },
      );

      setGeneratedPasses(res.passes || []);
      setSimulatedCurrentTime(res.dispatchSatisfiedTime || res.simulatedEndTime);
      setSimulationPhase(res.isDue ? 'DISPATCH_SATISFIED' : 'WAITING');
      setHasDispatched(res.isDue);
      setGenerationSummary({
        newlyGenerated: res.passes?.length || 0,
        alreadyExisted: 0,
        emailsSent: res.emailsSentCount || 0,
        total: res.passes?.length || 0,
      });
      if (res.passes && res.passes.length > 0) {
        setSelectedPassForScan(res.passes[0].qrToken);
      }
      setAlert({ type: 'success', message: res.message });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Window simulation failed' });
    } finally {
      setSimulating(false);
    }
  }

  // 3. Retry Individual Email
  async function handleRetryEmail(token: string) {
    if (!testEmailRecipient || !testEmailRecipient.includes('@')) {
      setAlert({ type: 'error', message: 'A valid safe test recipient email is required to retry delivery.' });
      return;
    }

    try {
      setRetryingPassToken(token);
      const res = await fetchApi<any>('/admin/test-lab/employee-daily-pass/retry-test-email', {
        method: 'POST',
        body: JSON.stringify({
          token,
          recipientEmail: testEmailRecipient.trim(),
        }),
      });

      if (res.success) {
        setGeneratedPasses((prev) =>
          prev.map((p) => (p.qrToken === token ? { ...p, emailStatus: 'SENT' } : p)),
        );
        setAlert({
          type: 'success',
          message: `Test email dispatched successfully to ${res.sentTo}`,
        });
      } else {
        setGeneratedPasses((prev) =>
          prev.map((p) => (p.qrToken === token ? { ...p, emailStatus: 'FAILED' } : p)),
        );
        setAlert({
          type: 'error',
          message: `Retry delivery failed: ${res.error}`,
        });
      }
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to retry email delivery' });
    } finally {
      setRetryingPassToken(null);
    }
  }

  // 4. Email Preview Modal
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

  // 5. Turnstile Scanner Validation Test
  async function handleScan(simulatedDate?: string) {
    if (!selectedPassForScan) {
      setAlert({ type: 'error', message: 'Please select a pass to scan.' });
      return;
    }

    try {
      setScanning(true);
      setScannerResult(null);

      const currentPass = generatedPasses.find((p) => p.qrToken === selectedPassForScan);
      const dateToScan = simulatedDate || currentPass?.eventDate || testDate;

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
    if (!selectedPassForScan) {
      setAlert({ type: 'error', message: 'Please select a pass to revoke.' });
      return;
    }

    try {
      setScanning(true);
      await fetchApi<any>('/admin/test-lab/employee-daily-pass/revoke', {
        method: 'POST',
        body: JSON.stringify({ token: selectedPassForScan }),
      });

      setGeneratedPasses((prev) =>
        prev.map((p) =>
          p.qrToken === selectedPassForScan ? { ...p, status: 'REVOKED' } : p,
        ),
      );
      setScannerResult(null);
      setAlert({
        type: 'success',
        message: 'Pass revoked. Future scans will be rejected as ATTENDEE_INACTIVE.',
      });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to revoke test pass' });
    } finally {
      setScanning(false);
    }
  }

  async function handleResetScanner() {
    if (!selectedPassForScan) {
      setAlert({ type: 'error', message: 'Please select a pass to reset.' });
      return;
    }

    try {
      setScanning(true);
      await fetchApi<any>('/admin/test-lab/employee-daily-pass/reset-scanner', {
        method: 'POST',
        body: JSON.stringify({ token: selectedPassForScan }),
      });

      setGeneratedPasses((prev) =>
        prev.map((p) =>
          p.qrToken === selectedPassForScan ? { ...p, status: 'ACTIVE' } : p,
        ),
      );
      setScannerResult(null);
      setAlert({
        type: 'success',
        message: 'Pass status reset to ACTIVE and test scan history cleared (test data only).',
      });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to reset scanner state' });
    } finally {
      setScanning(false);
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
      setSimulationResultBanner(null);
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
      setSimulationResultBanner(null);
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
            Simulate real QR delivery, multi-employee date eligibility, safe test emailing, and gate scanning with zero impact on operational data.
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
              className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-600 text-xs font-semibold hover:border-red-400 hover:text-red-700 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
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
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
        {/* ================= SIMULATION CONTROLS & PRODUCTION DISPATCH (TOP) ================= */}
        <div className="bg-stone-900 text-white rounded-2xl p-4 border border-gold/40 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-stone-800 pb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Clock className="w-4 h-4 text-gold shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-gold-light font-cinzel">
                SIMULATION CONTROLS & PRODUCTION DISPATCH
              </span>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  simulationPhase === 'DISPATCH_SATISFIED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : simulationPhase === 'WAITING'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : simulationPhase === 'COMPLETED'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : 'bg-stone-700 text-stone-300 border border-stone-600'
                }`}
              >
                {simulationPhase === 'DISPATCH_SATISFIED'
                  ? '✓ QR Delivery Condition Satisfied'
                  : simulationPhase === 'WAITING'
                  ? 'Waiting for Dispatch'
                  : simulationPhase === 'COMPLETED'
                  ? '✓ Test Session Complete'
                  : 'Ready to Simulate'}
              </span>
            </div>
            <div className="text-[11px] text-stone-300 flex items-center gap-2 flex-wrap">
              <span>
                Simulated Clock: <strong className="text-white font-mono">{selectedTheme.fullDateLabel}, {simulatedCurrentTime}</strong>
              </span>
              <span className="text-stone-600 hidden sm:inline">&bull;</span>
              <span className="text-stone-400 text-[10px] italic">
                Test mode only — does not change server time.
              </span>
            </div>
          </div>

          {/* 4 Compact Inputs / Status Blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Official Event Date Selector */}
            <div>
              <label className="text-[10px] font-bold uppercase text-stone-400 block mb-1">
                Official Event Date
              </label>
              <select
                value={testDate}
                disabled={isSimulating}
                onChange={(e) => setTestDate(e.target.value)}
                className="w-full p-2 bg-stone-800 border border-stone-700 rounded-xl text-xs text-white focus:outline-none focus:border-gold font-medium cursor-pointer disabled:opacity-60"
              >
                {OFFICIAL_EVENT_DATES.map((dateStr) => {
                  const th = getEventDayTheme(dateStr);
                  return (
                    <option key={dateStr} value={dateStr}>
                      {dateStr} — Night {th.dayNumber} ({th.themeTitle})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 2. Simulation Start Time (User chooses start point only) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase text-stone-400 block">
                  Simulation Start Time
                </label>
                <span className="text-[9px] text-stone-400 font-mono">
                  Window: 10 mins
                </span>
              </div>
              <input
                type="time"
                value={simulationStartTime}
                disabled={isSimulating}
                onChange={(e) => {
                  setSimulationStartTime(e.target.value);
                  setSimulatedCurrentTime(e.target.value);
                }}
                className="w-full p-2 bg-stone-800 border border-stone-700 rounded-xl text-xs text-white focus:outline-none focus:border-gold font-mono font-bold disabled:opacity-60"
              />
              <span className="text-[9px] text-stone-400 block mt-0.5">
                Starting point of the simulated clock
              </span>
            </div>

            {/* 3. Production Dispatch Time (Read-only single source of truth) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase text-stone-400 block">
                  Production Dispatch Time
                </label>
                <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                  Single Source of Truth
                </span>
              </div>
              <div className="w-full p-2 bg-stone-800/90 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 font-mono font-bold flex items-center justify-between">
                <span>{configuredDispatchTime}</span>
                <span className="text-[9px] uppercase tracking-wider text-stone-400 font-sans font-semibold">
                  Read-only
                </span>
              </div>
              <span className="text-[9px] text-stone-400 block mt-0.5 truncate">
                Source: Production QR Dispatch Schedule
              </span>
            </div>

            {/* 4. Safe Test Recipient Email */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase text-stone-400 block">
                  Safe Test Recipient
                </label>
                <span className="text-[9px] text-amber-400 font-bold">
                  Never contacts real employees
                </span>
              </div>
              <input
                type="email"
                placeholder="admin@example.com"
                value={testEmailRecipient}
                disabled={isSimulating}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                className="w-full p-2 bg-stone-800 border border-stone-700 rounded-xl text-xs text-white focus:outline-none focus:border-gold disabled:opacity-60"
              />
              <span className="text-[9px] text-stone-400 block mt-0.5 truncate">
                Receives actual employee pass email
              </span>
            </div>
          </div>

          {/* Live Status and Timeline Progression Banner */}
          <div className="bg-stone-950/80 rounded-xl p-3 border border-stone-800 space-y-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-stone-300 uppercase tracking-wider">
                    SIMULATION: <strong className="text-white font-mono">{simulationStartTime} → {simulationEndTime}</strong>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                    Window: 10 minutes (Minute {simulationMinuteStep}/10)
                  </span>
                </div>

                {/* Status Lines matching exact requirement */}
                {simulationPhase === 'IDLE' && (
                  <div className="text-xs text-stone-400">
                    Ready to run 10-minute simulation. Simulation will evaluate production dispatch at <strong className="text-white font-mono">{configuredDispatchTime}</strong>.
                  </div>
                )}

                {simulationPhase === 'WAITING' && (
                  <div className="text-xs space-y-0.5">
                    <div className="font-bold text-amber-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      WAITING FOR DISPATCH
                    </div>
                    <div className="text-[11px] text-stone-300 font-mono">
                      Simulation: <strong className="text-white">{simulatedCurrentTime}</strong> &bull; Production dispatch: <strong className="text-amber-300">{configuredDispatchTime}</strong>
                    </div>
                  </div>
                )}

                {simulationPhase === 'DISPATCH_SATISFIED' && (
                  <div className="text-xs space-y-0.5">
                    <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      QR DELIVERY CONDITION SATISFIED
                    </div>
                    <div className="text-[11px] text-stone-300 font-mono">
                      Simulation: <strong className="text-white">{simulatedCurrentTime}</strong> &bull; Production dispatch: <strong className="text-emerald-300">{configuredDispatchTime}</strong>
                    </div>
                    <div className="text-[10px] text-emerald-300 font-bold">
                      {generatedPasses.length} eligible pass{generatedPasses.length === 1 ? '' : 'es'} &bull; {generationSummary?.emailsSent ?? 0} test email{generationSummary?.emailsSent === 1 ? '' : 's'} sent
                    </div>
                  </div>
                )}

                {simulationPhase === 'COMPLETED' && (
                  <div className="text-xs space-y-0.5">
                    <div className="font-bold text-blue-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      TEST SESSION COMPLETE
                    </div>
                    <div className="text-[11px] text-stone-400">
                      Test data reset successfully.
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {!isSimulating ? (
                  <button
                    type="button"
                    onClick={handleStartSimulation}
                    disabled={selectedEmployeeIds.length === 0 || eligiblePeople.length === 0}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Start 10-Minute Simulation</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        isSimulationPaused
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-amber-600 hover:bg-amber-700 text-white'
                      }`}
                    >
                      {isSimulationPaused ? '▶ Resume' : '⏸ Pause'}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetSimulation}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset & Cleanup</span>
                    </button>
                  </>
                )}

                {/* Instant Quick Run */}
                {!isSimulating && (
                  <button
                    type="button"
                    onClick={handleRunInstantWindow}
                    disabled={simulating || selectedEmployeeIds.length === 0 || eligiblePeople.length === 0}
                    className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Evaluate 10-minute window instantly without animation"
                  >
                    <span>Instant Run</span>
                  </button>
                )}
              </div>
            </div>

            {/* 11-Minute Visual Timeline Progress Track */}
            <div className="pt-1">
              <div className="grid grid-cols-11 gap-1">
                {timelinePoints.map((pt) => {
                  const isCurrent = isSimulating && pt.minute === simulationMinuteStep;
                  const isPassed = isSimulating && pt.minute < simulationMinuteStep;
                  const isDispatchTarget = pt.time === configuredDispatchTime;

                  return (
                    <div
                      key={pt.minute}
                      className={`text-center p-1 rounded-lg border text-[9px] font-mono transition-all ${
                        isCurrent
                          ? 'bg-gold/20 border-gold text-gold font-bold ring-2 ring-gold/40'
                          : isPassed
                          ? pt.isDue
                            ? 'bg-emerald-950/40 border-emerald-700 text-emerald-400'
                            : 'bg-amber-950/40 border-amber-800 text-amber-400'
                          : pt.isDue
                          ? 'bg-emerald-950/20 border-emerald-900/60 text-emerald-600'
                          : 'bg-stone-900 border-stone-800 text-stone-500'
                      }`}
                      title={`${pt.time} (Min ${pt.minute}) ${pt.isDue ? '— Dispatch Satisfied' : '— Waiting'}`}
                    >
                      <div className="font-bold truncate">{pt.time}</div>
                      <div className="text-[8px] truncate mt-0.5 opacity-80">
                        {isDispatchTarget ? '🎯 DISPATCH' : `+${pt.minute}m`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ================= MAIN WORKFLOW: APPROVED EMPLOYEES & SIMULATION ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT: APPROVED EMPLOYEES LIST */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-maroon text-white flex items-center justify-center text-[10px]">
                  1
                </span>
                Approved Employees Roster
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-bold text-maroon hover:underline cursor-pointer"
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
                  placeholder="Search approved employee name, CPF, or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-ink focus:outline-none focus:ring-1 focus:ring-maroon"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded-xl text-xs font-semibold hover:bg-stone-200 transition-colors shrink-0 cursor-pointer"
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
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-stone-100">
              {employeeResults.length === 0 ? (
                <p className="text-xs text-stone-400 italic py-6 text-center">No approved employees found.</p>
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
                            <span className="text-purple-700 font-medium">
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

          {/* RIGHT: DATE ELIGIBILITY & SIMULATION ACTION */}
          <div className="lg:col-span-7 space-y-4">
            {/* PEOPLE FOR THIS DATE BREAKDOWN */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-maroon text-white flex items-center justify-center text-[10px]">
                    2
                  </span>
                  Eligibility for {selectedTheme.fullDateLabel}
                </span>
                <span className="font-bold text-xs" style={{ color: selectedTheme.primaryColor }}>
                  Night {selectedTheme.dayNumber} &bull; {selectedTheme.themeTitle}
                </span>
              </div>

              {selectedEmployees.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-400 italic">
                  Select at least one employee from Step 1 to evaluate individual date eligibility.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs border-b border-stone-200/80 pb-2">
                    <span className="font-bold text-ink uppercase tracking-wider text-[11px]">
                      Registered People Breakdown
                    </span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-stone-500">
                        Total: <strong>{totalPeopleCount} registered</strong>
                      </span>
                      <span className="text-stone-300">|</span>
                      <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Eligible for this date: {eligiblePeople.length} {eligiblePeople.length === 1 ? 'person' : 'people'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pt-1 pr-1">
                    {peopleForSelectedDate.map((person) => (
                      <div
                        key={person.id}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                          person.isEligible
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                            : 'bg-stone-100/60 border-stone-200 text-stone-500 opacity-75'
                        }`}
                      >
                        <div className="flex items-start gap-1.5 min-w-0">
                          {person.isEligible ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full border border-stone-400 text-stone-400 flex items-center justify-center text-[9px] shrink-0 mt-0.5">
                              ○
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-ink text-xs truncate">{person.name}</div>
                            <div className="text-[10px] text-stone-500 truncate">
                              {person.role} &bull; {person.employeeName}
                            </div>
                            <div className={`text-[10px] font-semibold mt-0.5 ${person.isEligible ? 'text-emerald-700' : 'text-stone-400'}`}>
                              {person.isEligible ? 'Selected this date' : 'Not selected for this date'}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ml-1 ${
                            person.isEligible
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-stone-200 text-stone-600 border-stone-300'
                          }`}
                        >
                          {person.isEligible ? 'Eligible' : 'Not Eligible'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SIMULATION EVALUATION & ACTION */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-maroon text-white flex items-center justify-center text-[10px]">
                    3
                  </span>
                  10-Minute Simulation Workflow
                </span>
                <span className="text-[10px] text-stone-500">
                  Target: <strong>{selectedTheme.fullDateLabel}</strong>
                </span>
              </div>

              {/* Status Banner */}
              <div
                className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                  isDueLive
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    {isDueLive ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>✓ QR Delivery Condition Satisfied</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>Waiting for QR delivery time</span>
                      </>
                    )}
                  </span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/80 border border-stone-200">
                    Sim: {simulatedCurrentTime} &bull; Due: {configuredDispatchTime}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-stone-700">
                  {isDueLive ? (
                    <>
                      Simulated time (<strong>{simulatedCurrentTime}</strong>) &ge; production dispatch time (<strong>{configuredDispatchTime}</strong>).
                      Passes are generated for this session and test emails dispatched to <strong>{testEmailRecipient || 'safe recipient'}</strong> using the official event day theme.
                    </>
                  ) : (
                    <>
                      Simulated time (<strong>{simulatedCurrentTime}</strong>) is before production dispatch time (<strong>{configuredDispatchTime}</strong>).
                      Simulation will automatically trigger pass generation when the clock reaches <strong>{configuredDispatchTime}</strong>.
                    </>
                  )}
                </p>
              </div>

              {/* Simulation Controls in Step 3 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleStartSimulation}
                  disabled={isSimulating || selectedEmployeeIds.length === 0 || eligiblePeople.length === 0}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-maroon hover:bg-maroon-dark text-white"
                >
                  <Zap className="w-4 h-4 text-gold-light" />
                  <span>
                    {isSimulating ? 'Simulation in Progress...' : `Start 10-Min Simulation (${eligiblePeople.length} eligible)`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleRunInstantWindow}
                  disabled={simulating || isSimulating || selectedEmployeeIds.length === 0 || eligiblePeople.length === 0}
                  className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>Instant Run (Full Window)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ================= RESULTS: AFTER SIMULATION ================= */}
        {generatedPasses.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <h2 className="text-sm font-bold text-ink font-cinzel">
                  {generatedPasses.length} TEST DAILY PASS{generatedPasses.length === 1 ? '' : 'ES'}
                </h2>
                {generationSummary && (
                  <span className="text-[10px] font-mono bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full">
                    {generationSummary.newlyGenerated} created &bull; {generationSummary.alreadyExisted} reused &bull; {generationSummary.emailsSent} emailed
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
                    <th className="py-2.5 px-3">Email Status</th>
                    <th className="py-2.5 px-3">Delivery Time</th>
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
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              p.emailStatus === 'SENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.emailStatus === 'FAILED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {p.emailStatus === 'SENT' && <Check className="w-3 h-3 text-emerald-600" />}
                            {p.emailStatus}
                          </span>
                        </td>

                        {/* Delivery Time (Simulated vs Real) */}
                        <td className="py-2.5 px-3">
                          <div className="font-mono text-[11px] font-bold text-ink">
                            Simulated: {p.simulatedDispatchTime || configuredDispatchTime}
                          </div>
                          <div className="text-[9px] text-stone-400 font-mono">
                            Real: {p.realCreatedAt ? new Date(p.realCreatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : (p.createdAt ? new Date(p.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '—')}
                          </div>
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
                              title="Preview Email Template"
                            >
                              Preview Email
                            </button>
                            {p.emailStatus === 'FAILED' && (
                              <button
                                type="button"
                                onClick={() => handleRetryEmail(p.qrToken)}
                                disabled={retryingPassToken === p.qrToken}
                                className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                                title="Retry sending email"
                              >
                                {retryingPassToken === p.qrToken ? 'Retrying...' : 'Retry Email'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Ineligible Attendees Reminder */}
            {ineligibleAttendees.length > 0 && (
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider font-cinzel">
                  NOT INCLUDED FOR {selectedTheme.dayLabel} {selectedTheme.monthLabel.toUpperCase()} (Did Not Register For This Date)
                </div>
                <div className="flex flex-wrap gap-2">
                  {ineligibleAttendees.map((p) => (
                    <span
                      key={p.attendeeId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-200/80 text-stone-700 text-[11px] border border-stone-300"
                    >
                      <span className="font-semibold text-ink">{p.attendeeName}</span>
                      <span className="text-stone-500 text-[10px]">({p.relation || 'Self'})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ================= TURNSTILE SCANNER TEST SUITE ================= */}
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                <div className="flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-maroon" />
                  <span className="text-xs font-bold text-ink uppercase tracking-wider font-cinzel">
                    Turnstile Scanner Validation Suite
                  </span>
                </div>
                <span className="text-[10px] text-stone-500 font-mono">
                  Test Pass Scans &bull; Zero Impact on Production Gates
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                {/* Select Pass to Scan */}
                <div className="md:col-span-4">
                  <label className="text-[10px] font-bold uppercase text-stone-500 block mb-1">
                    Select Pass To Test Scan
                  </label>
                  <select
                    value={selectedPassForScan}
                    onChange={(e) => setSelectedPassForScan(e.target.value)}
                    className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-maroon"
                  >
                    {generatedPasses.map((p) => (
                      <option key={p.qrToken} value={p.qrToken}>
                        {p.attendeeName} ({p.passType}) &bull; {p.ticketNumber} &bull; [{p.status}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scan Action Buttons */}
                <div className="md:col-span-8 flex items-center gap-2 flex-wrap pt-2 md:pt-4">
                  <button
                    type="button"
                    onClick={() => handleScan()}
                    disabled={scanning}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Valid Scan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScan()}
                    disabled={scanning}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Duplicate Scan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScan(wrongDateTarget)}
                    disabled={scanning}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Wrong Date Scan</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRevokePass}
                    disabled={scanning}
                    className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Revoke Pass</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetScanner}
                    disabled={scanning}
                    className="px-3 py-1.5 bg-stone-200 text-stone-800 rounded-xl text-xs font-bold hover:bg-stone-300 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset to ACTIVE</span>
                  </button>
                </div>
              </div>

              {/* Explicit Scanner Result Display */}
              {scannerResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    scannerResult.scannerResponse?.result === 'SUCCESS'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : scannerResult.scannerResponse?.result === 'ALREADY_CHECKED_IN'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      {scannerResult.scannerResponse?.result === 'SUCCESS' ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>✓ VALID ENTRY GRANTED</span>
                        </>
                      ) : scannerResult.scannerResponse?.result === 'ALREADY_CHECKED_IN' ? (
                        <>
                          <RotateCcw className="w-4 h-4 text-amber-600" />
                          <span>DUPLICATE SCAN DETECTED</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          <span>SCAN REJECTED</span>
                        </>
                      )}
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/80 border border-stone-200">
                      {scannerResult.scannerResponse?.result}
                    </span>
                  </div>
                  <p className="text-stone-700 text-xs">
                    {scannerResult.scannerResponse?.result === 'SUCCESS'
                      ? 'Pass accepted. Turnstile check-in logged and pass status updated to USED.'
                      : scannerResult.scannerResponse?.result === 'ALREADY_CHECKED_IN'
                      ? 'Already checked in for this date. Turnstile refuses double-entry.'
                      : scannerResult.scannerResponse?.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
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
                className="px-4 py-2 rounded-xl bg-gold text-maroon-deep font-bold text-xs hover:bg-gold-light transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print QR Pass</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingPass(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-ink hover:bg-stone-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* ================= EMAIL PREVIEW MODAL (WITH TOP SCROLL RESET) ================= */}
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
                className="w-8 h-8 rounded-full bg-stone-200 text-stone-700 hover:bg-stone-300 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Scrollable Container with previewScrollRef to reset scrollTop to 0 */}
            <div ref={previewScrollRef} className="flex-1 overflow-y-auto p-4 bg-stone-100">
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
                className="px-4 py-2 bg-stone-200 text-stone-800 text-xs font-bold rounded-xl hover:bg-stone-300 cursor-pointer"
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
