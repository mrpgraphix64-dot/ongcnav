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
  RotateCcw,
  Sparkles,
  Printer,
  Zap,
  Check,
  Send,
  FileText,
  Clock,
  ShieldCheck,
  Copy,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { getStoredAuthUser } from '@/lib/auth-session';
import {
  OFFICIAL_EVENT_DATES,
  getEventDayTheme,
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
  bookingDays?: string[];
  status: string;
  emailStatus: string;
  dayTheme: any;
  presentation?: DailyEmployeePassPresentation;
  createdAt: string;
}

interface GateOption {
  id: string;
  name: string;
  isOpen: boolean;
}

interface DeliveryRecord {
  passToken: string;
  attendeeName: string;
  recipientEmail: string;
  status: 'QUEUED' | 'SENDING' | 'ACCEPTED' | 'DELIVERED' | 'FAILED' | 'BOUNCED';
  error?: string;
  updatedAt?: string;
}

export default function EmployeeQrTestLabPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // STEP 1: Search & Approved Employees Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [employeeResults, setEmployeeResults] = useState<EmployeeOption[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  // STEP 2: Permanent QR Generation State
  const [generating, setGenerating] = useState(false);
  const [generatedPasses, setGeneratedPasses] = useState<TestPassData[]>([]);
  const [testSessionId, setTestSessionId] = useState('');
  const [ineligibleAttendees, setIneligibleAttendees] = useState<any[]>([]);
  const [generationSummary, setGenerationSummary] = useState<{
    newlyGenerated: number;
    alreadyExisted: number;
    total: number;
  } | null>(null);

  // STEP 3: One-Time Email Release Test State
  const [testEmailRecipient, setTestEmailRecipient] = useState<string>('');
  const [bulkSending, setBulkSending] = useState(false);
  const [deliveryRecords, setDeliveryRecords] = useState<Record<string, DeliveryRecord>>({});
  const [retryingPassToken, setRetryingPassToken] = useState<string | null>(null);

  // Modals & Inspection
  const [viewingPass, setViewingPass] = useState<TestPassData | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const previewScrollRef = useRef<HTMLDivElement>(null);

  // STEP 4: Scanner Validation Test State
  const [scanning, setScanning] = useState(false);
  const [selectedPassForScan, setSelectedPassForScan] = useState<string>('');
  const [testScanDate, setTestScanDate] = useState<string>(OFFICIAL_EVENT_DATES[0]);
  const [selectedGateId, setSelectedGateId] = useState<string>('1');
  const [gatesList, setGatesList] = useState<GateOption[]>([
    { id: '1', name: 'Main Gate 1', isOpen: true },
    { id: '2', name: 'Gate 2 (Turnstile)', isOpen: true },
    { id: '3', name: 'VIP & Staff Gate', isOpen: true },
  ]);
  const [scannerResult, setScannerResult] = useState<any>(null);

  // Cleanup State
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [confirmPurgeAll, setConfirmPurgeAll] = useState(false);

  // Global Alert Message
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // 1. Initial Load & Auth Guard
  useEffect(() => {
    const user = getStoredAuthUser();
    setCurrentUser(user);
    setAuthChecked(true);

    if (user?.email) {
      setTestEmailRecipient(user.email);
    }

    if (user?.role === 'SUPER_ADMIN') {
      loadInitialEmployees();
      loadGates();
    }
  }, []);

  // Reset preview modal scroll on open
  useEffect(() => {
    if (previewModalOpen && previewScrollRef.current) {
      previewScrollRef.current.scrollTop = 0;
    }
  }, [previewModalOpen, previewHtml]);

  async function loadGates() {
    try {
      const gates = await fetchApi<any[]>('/admin/gates');
      if (Array.isArray(gates) && gates.length > 0) {
        setGatesList(
          gates.map((g) => ({
            id: String(g.id),
            name: g.name || `Gate ${g.id}`,
            isOpen: g.isOpen ?? true,
          })),
        );
        setSelectedGateId(String(gates[0].id));
      }
    } catch {
      // Fallback defaults preserved
    }
  }

  async function loadInitialEmployees() {
    try {
      setSearching(true);
      const data = await fetchApi<EmployeeOption[]>(
        '/admin/test-lab/employee-daily-pass/employees',
      );
      setEmployeeResults(data || []);
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

  // Active pass selected for Step 4 scanning
  const activePassForScan = useMemo(() => {
    if (!selectedPassForScan && generatedPasses.length > 0) {
      return generatedPasses[0];
    }
    return generatedPasses.find((p) => p.qrToken === selectedPassForScan) || null;
  }, [generatedPasses, selectedPassForScan]);

  // Copy token helper
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedToken(text);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  // ================= STEP 2: GENERATE PERMANENT TEST QR =================
  async function handleGeneratePermanentQr() {
    if (selectedEmployeeIds.length === 0) {
      setAlert({ type: 'error', message: 'Please select at least one employee from the roster.' });
      return;
    }

    try {
      setGenerating(true);
      setAlert(null);
      const newSessionId = `EMP-PERM-${Date.now().toString(36).toUpperCase()}`;
      setTestSessionId(newSessionId);

      const result = await fetchApi<any>('/admin/test-lab/employee-daily-pass/generate', {
        method: 'POST',
        body: JSON.stringify({
          employeeIds: selectedEmployeeIds,
          testSessionId: newSessionId,
        }),
      });

      const passesList: TestPassData[] = result.passes || [result];
      setGeneratedPasses(passesList);
      setIneligibleAttendees(result.ineligible || []);
      setGenerationSummary({
        newlyGenerated: result.newlyGeneratedCount ?? passesList.length,
        alreadyExisted: result.existingCount ?? 0,
        total: passesList.length,
      });

      // Initialize delivery records for these passes
      const initialDeliveries: Record<string, DeliveryRecord> = {};
      for (const pass of passesList) {
        initialDeliveries[pass.qrToken] = {
          passToken: pass.qrToken,
          attendeeName: pass.attendeeName,
          recipientEmail: testEmailRecipient.trim() || 'Safe Test Recipient',
          status: pass.emailStatus === 'SENT' ? 'ACCEPTED' : 'QUEUED',
        };
      }
      setDeliveryRecords(initialDeliveries);

      if (passesList.length > 0) {
        setSelectedPassForScan(passesList[0].qrToken);
      }

      setAlert({
        type: 'success',
        message: `Successfully generated ${passesList.length} permanent test QR passes (${result.newlyGeneratedCount || 0} created, ${result.existingCount || 0} reused). Each pass is permanent across all 9 nights.`,
      });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Permanent QR generation failed' });
    } finally {
      setGenerating(false);
    }
  }

  // ================= STEP 3: ONE-TIME EMAIL RELEASE TEST =================
  async function handleSendSingleTestEmail(token: string) {
    if (!testEmailRecipient || !testEmailRecipient.includes('@')) {
      setAlert({ type: 'error', message: 'A valid safe test recipient email is required.' });
      return;
    }

    const pass = generatedPasses.find((p) => p.qrToken === token);
    if (!pass) return;

    try {
      setRetryingPassToken(token);
      setDeliveryRecords((prev) => ({
        ...prev,
        [token]: {
          passToken: token,
          attendeeName: pass.attendeeName,
          recipientEmail: testEmailRecipient.trim(),
          status: 'SENDING',
          updatedAt: new Date().toLocaleTimeString(),
        },
      }));

      const res = await fetchApi<any>('/admin/test-lab/employee-daily-pass/send-test-email', {
        method: 'POST',
        body: JSON.stringify({
          token,
          recipientEmail: testEmailRecipient.trim(),
        }),
      });

      if (res.success) {
        setDeliveryRecords((prev) => ({
          ...prev,
          [token]: {
            passToken: token,
            attendeeName: pass.attendeeName,
            recipientEmail: testEmailRecipient.trim(),
            status: 'ACCEPTED',
            updatedAt: new Date().toLocaleTimeString(),
          },
        }));
        setGeneratedPasses((prev) =>
          prev.map((p) => (p.qrToken === token ? { ...p, emailStatus: 'SENT' } : p)),
        );
        setAlert({
          type: 'success',
          message: `Test email dispatched to safe recipient: ${testEmailRecipient.trim()}`,
        });
      } else {
        setDeliveryRecords((prev) => ({
          ...prev,
          [token]: {
            passToken: token,
            attendeeName: pass.attendeeName,
            recipientEmail: testEmailRecipient.trim(),
            status: 'FAILED',
            error: res.error || 'Provider rejected test email',
            updatedAt: new Date().toLocaleTimeString(),
          },
        }));
        setGeneratedPasses((prev) =>
          prev.map((p) => (p.qrToken === token ? { ...p, emailStatus: 'FAILED' } : p)),
        );
        setAlert({ type: 'error', message: `Test email delivery failed: ${res.error}` });
      }
    } catch (err: any) {
      setDeliveryRecords((prev) => ({
        ...prev,
        [token]: {
          passToken: token,
          attendeeName: pass.attendeeName,
          recipientEmail: testEmailRecipient.trim(),
          status: 'FAILED',
          error: err.message || 'Delivery request failed',
          updatedAt: new Date().toLocaleTimeString(),
        },
      }));
      setAlert({ type: 'error', message: err.message || 'Failed to send test email' });
    } finally {
      setRetryingPassToken(null);
    }
  }

  async function handleBulkTestEmailRelease() {
    if (!testEmailRecipient || !testEmailRecipient.includes('@')) {
      setAlert({ type: 'error', message: 'A valid safe test recipient email is required.' });
      return;
    }

    if (generatedPasses.length === 0) {
      setAlert({ type: 'error', message: 'Generate test passes first in Step 2 before testing release.' });
      return;
    }

    try {
      setBulkSending(true);
      setAlert(null);

      // Set all to SENDING
      setDeliveryRecords((prev) => {
        const next = { ...prev };
        for (const pass of generatedPasses) {
          next[pass.qrToken] = {
            passToken: pass.qrToken,
            attendeeName: pass.attendeeName,
            recipientEmail: testEmailRecipient.trim(),
            status: 'SENDING',
            updatedAt: new Date().toLocaleTimeString(),
          };
        }
        return next;
      });

      let successCount = 0;
      let failCount = 0;

      for (const pass of generatedPasses) {
        try {
          const res = await fetchApi<any>('/admin/test-lab/employee-daily-pass/send-test-email', {
            method: 'POST',
            body: JSON.stringify({
              token: pass.qrToken,
              recipientEmail: testEmailRecipient.trim(),
            }),
          });

          if (res.success) {
            successCount++;
            setDeliveryRecords((prev) => ({
              ...prev,
              [pass.qrToken]: {
                passToken: pass.qrToken,
                attendeeName: pass.attendeeName,
                recipientEmail: testEmailRecipient.trim(),
                status: 'ACCEPTED',
                updatedAt: new Date().toLocaleTimeString(),
              },
            }));
            setGeneratedPasses((prev) =>
              prev.map((p) => (p.qrToken === pass.qrToken ? { ...p, emailStatus: 'SENT' } : p)),
            );
          } else {
            failCount++;
            setDeliveryRecords((prev) => ({
              ...prev,
              [pass.qrToken]: {
                passToken: pass.qrToken,
                attendeeName: pass.attendeeName,
                recipientEmail: testEmailRecipient.trim(),
                status: 'FAILED',
                error: res.error || 'Failed',
                updatedAt: new Date().toLocaleTimeString(),
              },
            }));
          }
        } catch (subErr: any) {
          failCount++;
          setDeliveryRecords((prev) => ({
            ...prev,
            [pass.qrToken]: {
              passToken: pass.qrToken,
              attendeeName: pass.attendeeName,
              recipientEmail: testEmailRecipient.trim(),
              status: 'FAILED',
              error: subErr.message || 'Request failed',
              updatedAt: new Date().toLocaleTimeString(),
            },
          }));
        }
      }

      setAlert({
        type: failCount === 0 ? 'success' : 'error',
        message: `Bulk email release test finished: ${successCount} accepted by provider, ${failCount} failed. All emails directed safely to ${testEmailRecipient.trim()}.`,
      });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Bulk release test encountered an error' });
    } finally {
      setBulkSending(false);
    }
  }

  // Delivery metrics derived from records
  const deliveryMetrics = useMemo(() => {
    let queued = 0;
    let sending = 0;
    let accepted = 0;
    let delivered = 0;
    let failed = 0;
    let bounced = 0;

    Object.values(deliveryRecords).forEach((rec) => {
      if (rec.status === 'QUEUED') queued++;
      else if (rec.status === 'SENDING') sending++;
      else if (rec.status === 'ACCEPTED') accepted++;
      else if (rec.status === 'DELIVERED') delivered++;
      else if (rec.status === 'FAILED') failed++;
      else if (rec.status === 'BOUNCED') bounced++;
    });

    return { queued, sending, accepted, delivered, failed, bounced };
  }, [deliveryRecords]);

  // Email Preview Modal
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

  // ================= STEP 4: SCANNER VALIDATION TEST =================
  async function handleScan(simulatedDate?: string) {
    if (!selectedPassForScan) {
      setAlert({ type: 'error', message: 'Please select a pass to test scan.' });
      return;
    }

    try {
      setScanning(true);
      setScannerResult(null);

      const targetDate = simulatedDate || testScanDate;

      const res = await fetchApi<any>('/admin/test-lab/employee-daily-pass/scanner/scan', {
        method: 'POST',
        body: JSON.stringify({
          token: selectedPassForScan,
          scanDate: targetDate,
          gateId: Number(selectedGateId) || 1,
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

  // Scan on Wrong Date: Pick a date NOT in attendee's bookingDays
  function handleScanOnWrongDate() {
    if (!activePassForScan) return;

    const booked = activePassForScan.bookingDays || [activePassForScan.eventDate];
    const unbookedDate = OFFICIAL_EVENT_DATES.find((d) => !booked.includes(d));

    const dateToTest = unbookedDate || '2026-10-20';
    handleScan(dateToTest);
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
        message: 'Pass revoked. Turnstile scans will now return ATTENDEE_INACTIVE.',
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

  // ================= CLEANUP ACTIONS =================
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
      setDeliveryRecords({});
      setCleanupMessage(
        `Session ${res.sessionId} purged: ${res.deletedPassesCount} test passes and ${res.deletedCheckinsCount} test check-ins deleted.`,
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
      setDeliveryRecords({});
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
          The Employee QR Test Lab is exclusively restricted to <strong>SUPER_ADMIN</strong>.
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
              Employee QR Test Lab
            </h1>
            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider animate-pulse flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              ISOLATED TEST MODE
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-ink-soft mt-0.5">
            Test permanent employee QR generation, one-time email release, delivery status, and daily entry authorization without affecting operational data.
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
        {/* ================= STEP 1: PERMANENT QR TEST SETUP ================= */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-maroon text-white flex items-center justify-center text-[10px]">
                1
              </span>
              Permanent QR Test Setup (Select Employees)
            </span>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs font-bold text-maroon hover:underline cursor-pointer"
            >
              {allVisibleSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {/* Search Box & Controls */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <form onSubmit={handleSearch} className="md:col-span-8 flex gap-2">
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
            <div className="md:col-span-4 p-2 bg-cream/70 rounded-xl border border-gold/30 text-xs flex items-center justify-between">
              <span className="font-semibold text-ink">
                Selected:{' '}
                <strong className="text-maroon">
                  {selectedEmployees.length} emp &bull; {totalPeopleCount} {totalPeopleCount === 1 ? 'person' : 'people'}
                </strong>
              </span>
              <span className="text-[10px] text-stone-500 font-medium">
                (Incl. family)
              </span>
            </div>
          </div>

          {/* Employee Checkbox List */}
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-stone-100">
            {employeeResults.length === 0 ? (
              <p className="text-xs text-stone-400 italic py-6 text-center">No approved employees found.</p>
            ) : (
              employeeResults.map((emp) => {
                const isChecked = selectedEmployeeIds.includes(emp.id);
                const famCount = emp.familyMembers?.length || 0;
                const personCount = 1 + famCount;
                const selectedDates = emp.bookingDays || [];

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
                      <div className="text-[10px] text-stone-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
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
                        &bull;
                        <span className="text-emerald-700 font-medium">
                          {selectedDates.length} night{selectedDates.length === 1 ? '' : 's'} registered
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* ================= STEP 2: PERMANENT QR GENERATION TEST ================= */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-maroon text-white flex items-center justify-center text-[10px]">
                2
              </span>
              Permanent QR Generation Test
            </span>
            {generationSummary && (
              <span className="text-[10px] font-mono bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full">
                {generationSummary.total} passes ({generationSummary.newlyGenerated} created, {generationSummary.alreadyExisted} reused)
              </span>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-stone-50 rounded-xl p-3 border border-stone-200">
            <div className="space-y-0.5 max-w-xl">
              <p className="text-xs font-bold text-ink">
                One Person &rarr; One Permanent QR Token
              </p>
              <p className="text-[11px] text-ink-soft leading-relaxed">
                Generates an isolated test permanent QR for selected attendees without touching production data. The same QR token will represent the attendee across all 9 nights.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleGeneratePermanentQr}
                disabled={generating || selectedEmployeeIds.length === 0}
                className="px-4 py-2 bg-maroon hover:bg-maroon-dark text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-3.5 h-3.5 text-gold-light" />
                    <span>GENERATE TEST QR ({totalPeopleCount} people)</span>
                  </>
                )}
              </button>

              {testSessionId && (
                <button
                  type="button"
                  onClick={handleCleanupSession}
                  disabled={cleaningUp}
                  className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  title="Purge passes generated in this session"
                >
                  {cleaningUp ? 'Resetting...' : 'Reset Session'}
                </button>
              )}
            </div>
          </div>

          {/* Generated Passes Table */}
          {generatedPasses.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-ink uppercase tracking-wider text-[11px]">
                  Generated Permanent QR Credentials ({generatedPasses.length})
                </span>
                <span className="text-[10px] font-mono text-stone-500">
                  Session: {testSessionId}
                </span>
              </div>

              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold tracking-wider border-b border-stone-200">
                      <th className="py-2.5 px-3">Person / Attendee</th>
                      <th className="py-2.5 px-3">Pass Type</th>
                      <th className="py-2.5 px-3">Primary Employee & CPF</th>
                      <th className="py-2.5 px-3">Permanent QR Token</th>
                      <th className="py-2.5 px-3">QR Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {generatedPasses.map((p) => {
                      const isSelectedForScan = selectedPassForScan === p.qrToken;

                      return (
                        <tr
                          key={p.testPassId || p.qrToken}
                          className={`transition-colors ${
                            isSelectedForScan ? 'bg-amber-50/50' : 'hover:bg-cream/40'
                          }`}
                        >
                          {/* Person */}
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

                          {/* Primary Employee & CPF */}
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-ink">{p.employeeName}</div>
                            <div className="font-mono text-[10px] text-maroon">{p.employeeCpf}</div>
                          </td>

                          {/* QR Token */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded truncate max-w-[140px]">
                                {p.qrToken.slice(0, 12)}...
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(p.qrToken)}
                                className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
                                title="Copy token"
                              >
                                {copiedToken === p.qrToken ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3">
                            <span
                              className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded-full ${
                                p.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : p.status === 'USED'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedPassForScan(p.qrToken)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                                  isSelectedForScan
                                    ? 'bg-maroon text-white'
                                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                                }`}
                              >
                                {isSelectedForScan ? 'Active Scanner' : 'Select'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setViewingPass(p)}
                                className="px-2 py-1 bg-stone-100 hover:bg-maroon hover:text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                              >
                                View QR
                              </button>
                              <a
                                href={`${apiBaseUrl}/public/employee/daily-pass/${p.qrToken}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg text-[10px] font-bold transition-colors"
                              >
                                PDF
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ================= STEP 3: ONE-TIME EMAIL RELEASE TEST ================= */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-maroon text-white flex items-center justify-center text-[10px]">
                3
              </span>
              One-Time Email Release Test
            </span>
            <span className="text-[10px] text-stone-500 font-medium">
              Permanent QR Email Dispatch & Lifecycle Tracking
            </span>
          </div>

          <p className="text-[11px] text-ink-soft leading-relaxed">
            Test the permanent QR email release. Emails are dispatched exclusively to the designated safe test recipient with [TEST] prefix and official festival branding attached.
          </p>

          {/* Safe Recipient Config & Dispatch Trigger */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-stone-50 p-3 rounded-xl border border-stone-200">
            <div className="md:col-span-6 space-y-1">
              <label className="text-[10px] font-bold uppercase text-stone-500 block">
                Safe Test Recipient Email
              </label>
              <input
                type="email"
                placeholder="admin@example.com"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs text-ink focus:outline-none focus:ring-1 focus:ring-maroon"
              />
              <span className="text-[9px] text-amber-700 block font-medium">
                ⚠️ Test emails will only be sent to this safe test address — never to real employees.
              </span>
            </div>

            <div className="md:col-span-6 flex items-center justify-end gap-2 flex-wrap pt-2 md:pt-4">
              <button
                type="button"
                onClick={() => {
                  if (activePassForScan) handleSendSingleTestEmail(activePassForScan.qrToken);
                }}
                disabled={!activePassForScan || retryingPassToken !== null || bulkSending}
                className="px-3 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-gold" />
                <span>SEND TEST EMAIL (Selected)</span>
              </button>

              <button
                type="button"
                onClick={handleBulkTestEmailRelease}
                disabled={generatedPasses.length === 0 || bulkSending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {bulkSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Release...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>TEST BULK RELEASE ({generatedPasses.length} passes)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Delivery Lifecycle Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
            <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-center">
              <div className="text-[10px] font-bold text-stone-500 uppercase">Queued</div>
              <div className="text-base font-bold text-stone-700">{deliveryMetrics.queued}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-center">
              <div className="text-[10px] font-bold text-blue-600 uppercase">Sending</div>
              <div className="text-base font-bold text-blue-700">{deliveryMetrics.sending}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-[10px] font-bold text-emerald-600 uppercase">Provider Accepted</div>
              <div className="text-base font-bold text-emerald-700">{deliveryMetrics.accepted}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-100 border border-emerald-300 text-center">
              <div className="text-[10px] font-bold text-emerald-800 uppercase">Delivered</div>
              <div className="text-base font-bold text-emerald-900">{deliveryMetrics.delivered || deliveryMetrics.accepted}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-center">
              <div className="text-[10px] font-bold text-rose-600 uppercase">Failed</div>
              <div className="text-base font-bold text-rose-700">{deliveryMetrics.failed}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <div className="text-[10px] font-bold text-amber-600 uppercase">Bounced</div>
              <div className="text-base font-bold text-amber-700">{deliveryMetrics.bounced}</div>
            </div>
          </div>

          {/* Delivery Status Table */}
          {generatedPasses.length > 0 && (
            <div className="overflow-x-auto border border-stone-200 rounded-xl mt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold tracking-wider border-b border-stone-200">
                    <th className="py-2.5 px-3">Attendee</th>
                    <th className="py-2.5 px-3">Test Recipient</th>
                    <th className="py-2.5 px-3">Delivery Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {generatedPasses.map((p) => {
                    const record = deliveryRecords[p.qrToken];
                    const status = record?.status || (p.emailStatus === 'SENT' ? 'ACCEPTED' : 'QUEUED');

                    return (
                      <tr key={`del-${p.qrToken}`} className="hover:bg-cream/40 transition-colors">
                        <td className="py-2 px-3">
                          <span className="font-bold text-ink">{p.attendeeName}</span>
                          <span className="text-[10px] text-stone-400 block font-mono">{p.ticketNumber}</span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-stone-600">
                          {record?.recipientEmail || testEmailRecipient}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              status === 'ACCEPTED' || status === 'DELIVERED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : status === 'SENDING'
                                ? 'bg-blue-100 text-blue-800 animate-pulse'
                                : status === 'FAILED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {(status === 'ACCEPTED' || status === 'DELIVERED') && (
                              <Check className="w-3 h-3 text-emerald-600" />
                            )}
                            {status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEmailPreview(p.qrToken)}
                              className="px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                            >
                              Preview Email
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSendSingleTestEmail(p.qrToken)}
                              disabled={retryingPassToken === p.qrToken}
                              className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                            >
                              {retryingPassToken === p.qrToken ? 'Sending...' : 'Send / Retry'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ================= STEP 4: PERMANENT QR ENTRY TEST (SCANNER VALIDATION) ================= */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-maroon flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-maroon text-white flex items-center justify-center text-[10px]">
                4
              </span>
              Permanent QR Entry Test (Scanner Validation)
            </span>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Dynamic Date Authorization at Gate
            </span>
          </div>

          <p className="text-[11px] text-ink-soft leading-relaxed">
            The permanent QR credential remains identical across the entire 9 nights of Navratri. At scan time, the server inspects whether the attendee registered for the tested date and ensures maximum one entry per day.
          </p>

          {generatedPasses.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-400 italic bg-stone-50 rounded-xl border border-stone-200">
              Generate at least one permanent test QR pass in Step 2 to test turnstile entry.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Attendee & Entry Controls */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-stone-50 p-3 rounded-xl border border-stone-200">
                {/* Select Pass */}
                <div className="md:col-span-4 space-y-1">
                  <label className="text-[10px] font-bold uppercase text-stone-500 block">
                    Select Attendee QR To Test
                  </label>
                  <select
                    value={selectedPassForScan}
                    onChange={(e) => setSelectedPassForScan(e.target.value)}
                    className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-maroon cursor-pointer"
                  >
                    {generatedPasses.map((p) => (
                      <option key={p.qrToken} value={p.qrToken}>
                        {p.attendeeName} ({p.passType}) &bull; {p.ticketNumber} &bull; [{p.status}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Simulated Test Date Dropdown (HERE ONLY!) */}
                <div className="md:col-span-5 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase text-stone-500 block">
                      Simulated Test Event Date
                    </label>
                    <span className="text-[9px] text-maroon font-bold">Entry Authorization Date</span>
                  </div>
                  <select
                    value={testScanDate}
                    onChange={(e) => setTestScanDate(e.target.value)}
                    className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-maroon cursor-pointer"
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

                {/* Gate Selector */}
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[10px] font-bold uppercase text-stone-500 block">
                    Turnstile Gate
                  </label>
                  <select
                    value={selectedGateId}
                    onChange={(e) => setSelectedGateId(e.target.value)}
                    className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-maroon cursor-pointer"
                  >
                    {gatesList.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Attendee Booking Days Context Bar */}
              {activePassForScan && (
                <div className="p-3 bg-cream/70 rounded-xl border border-gold/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-ink">{activePassForScan.attendeeName}</span>
                    <span className="text-stone-500 text-[11px] ml-1.5">
                      ({activePassForScan.passType} &bull; CPF: {activePassForScan.employeeCpf})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase text-stone-500">Registered Nights:</span>
                    {(activePassForScan.bookingDays || [activePassForScan.eventDate]).map((d) => {
                      const isTarget = d === testScanDate;
                      return (
                        <span
                          key={d}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isTarget
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-white text-stone-700 border-stone-200'
                          }`}
                        >
                          {d} {isTarget ? '🎯' : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleScan(testScanDate)}
                  disabled={scanning}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Simulate scan on the chosen event date"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Simulate Scan ({testScanDate})</span>
                </button>

                <button
                  type="button"
                  onClick={handleScanOnWrongDate}
                  disabled={scanning}
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Simulate scan on a date the attendee has NOT booked"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Scan on Wrong Date</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleScan(testScanDate)}
                  disabled={scanning}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Scan again on the same day to test ALREADY_CHECKED_IN"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Duplicate Scan Today</span>
                </button>

                <button
                  type="button"
                  onClick={handleRevokePass}
                  disabled={scanning}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Revoke pass to verify ATTENDEE_INACTIVE"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Revoke Pass</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetScanner}
                  disabled={scanning}
                  className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Reset pass back to ACTIVE and remove test checkin records"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Scanner State</span>
                </button>
              </div>

              {/* Explicit Scanner Result Display */}
              {scannerResult && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-2 ${
                    scannerResult.scannerResponse?.result === 'SUCCESS'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : scannerResult.scannerResponse?.result === 'ALREADY_CHECKED_IN'
                      ? 'bg-amber-50 border-amber-200 text-amber-950'
                      : scannerResult.scannerResponse?.result === 'NOT_BOOKED_TODAY'
                      ? 'bg-red-50 border-red-200 text-red-950'
                      : 'bg-rose-50 border-rose-200 text-rose-950'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-2">
                      {scannerResult.scannerResponse?.result === 'SUCCESS' ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <span className="text-sm">✓ VALID ENTRY GRANTED</span>
                        </>
                      ) : scannerResult.scannerResponse?.result === 'ALREADY_CHECKED_IN' ? (
                        <>
                          <RotateCcw className="w-5 h-5 text-amber-600" />
                          <span className="text-sm">DUPLICATE SCAN DETECTED</span>
                        </>
                      ) : scannerResult.scannerResponse?.result === 'NOT_BOOKED_TODAY' ? (
                        <>
                          <Calendar className="w-5 h-5 text-red-600" />
                          <span className="text-sm">NOT BOOKED FOR THIS DATE</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 text-rose-600" />
                          <span className="text-sm">SCAN REJECTED</span>
                        </>
                      )}
                    </span>
                    <span className="font-mono text-[11px] px-2.5 py-1 rounded bg-white/90 border border-stone-200 font-bold">
                      {scannerResult.scannerResponse?.result}
                    </span>
                  </div>

                  <p className="text-ink text-xs leading-relaxed">
                    {scannerResult.scannerResponse?.result === 'SUCCESS'
                      ? 'Permanent pass authorized for this date. Check-in logged and gate turnstile opened.'
                      : scannerResult.scannerResponse?.result === 'ALREADY_CHECKED_IN'
                      ? 'Already checked in for this date. Turnstile refuses double-entry.'
                      : scannerResult.scannerResponse?.result === 'NOT_BOOKED_TODAY'
                      ? scannerResult.scannerResponse?.message || 'Attendee did not select this date in their registration.'
                      : scannerResult.scannerResponse?.message}
                  </p>

                  <div className="pt-1 flex items-center gap-3 text-[10px] text-stone-500 font-mono flex-wrap">
                    <span>Date Tested: <strong>{scannerResult.simulatedScanDate || testScanDate}</strong></span>
                    &bull;
                    <span>Gate: <strong>Gate {scannerResult.gateId || selectedGateId}</strong></span>
                    {scannerResult.passStatus && (
                      <>
                        &bull;
                        <span>Current Status: <strong>{scannerResult.passStatus}</strong></span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ================= VIEW PASS MODAL (DATE-SPECIFIC TICKET) ================= */}
      {viewingPass && viewingPass.presentation && (
        <AdminModal
          isOpen={!!viewingPass}
          onClose={() => setViewingPass(null)}
          title="Permanent Employee QR Pass Preview"
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

            {/* Scrollable Container with previewScrollRef */}
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
