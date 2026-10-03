'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Send,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Info,
  Sparkles,
  User,
  Users,
  Calendar,
  FileText,
  ClipboardCheck,
  Plus,
  Loader2,
  RefreshCw,
  QrCode,
  Lock,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { getStoredAuthUser } from '@/lib/auth-session';
import {
  getEventDayTheme,
  ALLOWED_FAMILY_RELATIONS,
  AllowedFamilyRelation,
  DEFAULT_SPONSOR_VOUCHER_CONFIG,
  SponsorVoucherConfig,
  buildEmployeeWhatsAppMessage,
  WhatsAppDeliveryStatus,
  WhatsAppConfigDto,
} from '@/types/shared-types';

const EVENT_DATES = [
  '2026-10-11',
  '2026-10-12',
  '2026-10-13',
  '2026-10-14',
  '2026-10-15',
  '2026-10-16',
  '2026-10-17',
  '2026-10-18',
  '2026-10-19',
];

const EMPLOYEE_CATEGORIES = [
  { value: 'REGULAR', label: 'Regular Employee', desc: 'Active permanent ONGC employees' },
  { value: 'RETIRED', label: 'Retired Employee', desc: 'Superannuated / retired ONGC personnel' },
  { value: 'CONTRACT', label: 'Contract Employee', desc: 'Tenure-based contract & project staff' },
] as const;

type EmployeeCategory = (typeof EMPLOYEE_CATEGORIES)[number]['value'];

const INDIAN_MOBILE_REGEX = /^[6-9][0-9]{9}$/;
const CPF_REGEX = /^[0-9]{5,6}$/;

interface FamilyMemberForm {
  localId: string;
  name: string;
  relation: AllowedFamilyRelation;
  mobileNo: string;
  email: string;
  dateOfBirth: string;
  selectedDates: string[];
}

export default function WhatsAppTestLabPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Lab Config & Readiness
  const [providerConfig, setProviderConfig] = useState<WhatsAppConfigDto | null>(null);
  const [safeRecipient, setSafeRecipient] = useState<string | null>(null);
  const [providerName, setProviderName] = useState<string>('TEST_ADAPTER (Unconfigured)');
  const [providerStatus, setProviderStatus] = useState<WhatsAppDeliveryStatus>('PROVIDER_NOT_CONFIGURED');
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [sponsorVoucher, setSponsorVoucher] = useState<SponsorVoucherConfig>(DEFAULT_SPONSOR_VOUCHER_CONFIG);
  const [voucherImageUrl, setVoucherImageUrl] = useState<string>('/images/sponsors/mahavir-jewellers-voucher.jpg');

  // Form Step State (1: Details, 2: Guidelines, 3: Dates, 4: Family, 5: Review & Submit)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [category, setCategory] = useState<EmployeeCategory>('REGULAR');
  const [cpf, setCpf] = useState('99999');
  const [name, setName] = useState('Siddharth');
  const [mobile, setMobile] = useState('9876543210');
  const [email, setEmail] = useState('siddharth@ongc.co.in');
  const [dateOfBirth, setDateOfBirth] = useState('1988-06-15');
  const [dateOfJoining, setDateOfJoining] = useState('2014-08-01');
  const [guidelinesAgreed, setGuidelinesAgreed] = useState(true);
  const [employeeDates, setEmployeeDates] = useState<string[]>([...EVENT_DATES]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberForm[]>([]);

  // Action / Feedback State
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generated Test Pass & WhatsApp Preview State
  const [testResult, setTestResult] = useState<{
    referenceNumber: string;
    ticketNumber: string;
    qrToken: string;
    passUrl: string;
    safeRecipient: string | null;
    messageText: string;
    voucherImageUrl: string;
    providerStatus: WhatsAppDeliveryStatus;
    providerName: string;
    isConfigured: boolean;
    templateName?: string;
    templateLanguage?: string;
    passTemplateName?: string;
    passTemplateConfigured?: boolean;
  } | null>(null);

  const [sendResultNotice, setSendResultNotice] = useState<{
    success: boolean;
    status: string;
    message: string;
    safeRecipient?: string | null;
    providerMessageId?: string | null;
    metaErrorCode?: number | null;
    httpStatus?: number | null;
    templateName?: string | null;
    templateLanguage?: string | null;
  } | null>(null);

  // Verify Role & Fetch Lab Config
  useEffect(() => {
    const user = getStoredAuthUser();
    const role = (user?.role || '').toUpperCase();
    setUserRole(role);
    setAuthChecked(true);

    if (role === 'SUPER_ADMIN') {
      fetchApi('/admin/employees/whatsapp-test/config')
        .then((data: any) => {
          if (data) {
            setProviderConfig(data);
            if (data.safeRecipient) setSafeRecipient(data.safeRecipient);
            if (data.providerName) setProviderName(data.providerName);
            if (data.providerStatus) setProviderStatus(data.providerStatus);
            if (data.isConfigured !== undefined) setIsConfigured(Boolean(data.isConfigured));
            if (data.sponsorVoucher) setSponsorVoucher(data.sponsorVoucher);
            if (data.voucherImageUrl) setVoucherImageUrl(data.voucherImageUrl);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Quick preset test data
  const handleQuickFill = () => {
    setCpf('99999');
    setName('Siddharth');
    setMobile('9876543210');
    setEmail('siddharth@ongc.co.in');
    setCategory('REGULAR');
    setDateOfBirth('1988-06-15');
    setDateOfJoining('2014-08-01');
    setGuidelinesAgreed(true);
    setEmployeeDates([...EVENT_DATES]);
    setFamilyMembers([
      {
        localId: 'fm-1',
        name: 'Pooja Patel',
        relation: 'Spouse',
        mobileNo: '9876543211',
        email: 'pooja.patel@example.com',
        dateOfBirth: '1990-04-20',
        selectedDates: ['2026-10-11', '2026-10-12', '2026-10-13'],
      },
    ]);
    setFormError(null);
  };

  // Family Member Management
  const addFamilyMember = () => {
    if (familyMembers.length >= 3) {
      setFormError('Maximum 3 family members are permitted.');
      return;
    }
    setFamilyMembers((prev) => [
      ...prev,
      {
        localId: `fm-${Date.now()}`,
        name: '',
        relation: 'Spouse',
        mobileNo: '',
        email: '',
        dateOfBirth: '',
        selectedDates: [...EVENT_DATES],
      },
    ]);
    setFormError(null);
  };

  const removeFamilyMember = (idx: number) => {
    setFamilyMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  // Toggle Event Date Chips
  const toggleDate = (date: string) => {
    setEmployeeDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date],
    );
  };

  const toggleAllDates = () => {
    if (employeeDates.length === EVENT_DATES.length) {
      setEmployeeDates([]);
    } else {
      setEmployeeDates([...EVENT_DATES]);
    }
  };

  // Validation
  const validateForm = (): string | null => {
    if (!CPF_REGEX.test(cpf.trim())) {
      return 'Employee CPF No. must contain 5 or 6 numeric digits.';
    }
    if (!name.trim()) {
      return 'Please enter the employee full name.';
    }
    if (!INDIAN_MOBILE_REGEX.test(mobile.trim())) {
      return 'Please enter a valid 10-digit Indian mobile number.';
    }
    if (!email.trim() || !email.includes('@')) {
      return 'Please enter a valid employee email address.';
    }
    if (!guidelinesAgreed) {
      return 'You must acknowledge the guidelines before generating a test pass.';
    }
    if (employeeDates.length === 0) {
      return 'Please select at least one attendance date for the employee.';
    }
    for (let i = 0; i < familyMembers.length; i++) {
      const fm = familyMembers[i];
      if (!fm.name.trim()) {
        return `Please enter the name of Family Member #${i + 1}.`;
      }
      if (fm.selectedDates.length === 0) {
        return `Please select at least one date for Family Member #${i + 1} (${fm.name}).`;
      }
    }
    return null;
  };

  // Submit test registration & generate pass
  const handleGenerateTestPass = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }

    setFormError(null);
    setSubmitting(true);
    setSendResultNotice(null);

    try {
      const payload = {
        name: name.trim(),
        mobile: mobile.trim(),
        cpf: cpf.trim(),
        email: email.trim().toLowerCase(),
        category,
        dateOfBirth: dateOfBirth || undefined,
        dateOfJoining: dateOfJoining || undefined,
        guidelinesAccepted: true,
        bookingDays: employeeDates,
        familyMembers: familyMembers.map((fm) => ({
          name: fm.name.trim(),
          relation: fm.relation,
          mobileNo: fm.mobileNo.trim() || undefined,
          email: fm.email.trim().toLowerCase() || undefined,
          dateOfBirth: fm.dateOfBirth || undefined,
          bookingDays: fm.selectedDates,
        })),
      };

      const res = await fetchApi('/admin/employees/whatsapp-test/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setTestResult(res);
      // Scroll to preview smoothly
      setTimeout(() => {
        const el = document.getElementById('whatsapp-preview-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit test registration.');
    } finally {
      setSubmitting(false);
    }
  };

  // Dispatch WhatsApp message to safe recipient
  const handleSendTestWhatsApp = async () => {
    if (!testResult) return;
    if (!testResult.safeRecipient) {
      setSendResultNotice({
        success: false,
        status: 'TEST RECIPIENT NOT CONFIGURED',
        message:
          'Test recipient is not configured. Set WHATSAPP_TEST_RECIPIENT in environment to enable test sending.',
      });
      return;
    }

    const targetPhone = testResult.safeRecipient || safeRecipient;
    if (
      !window.confirm(
        `Send this test WhatsApp message to the configured safe test recipient (${targetPhone})?`,
      )
    ) {
      return;
    }

    setSending(true);
    setSendResultNotice(null);

    try {
      const res = await fetchApi('/admin/employees/whatsapp-test/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceNumber: testResult.referenceNumber,
          includeVoucherImage: false,
        }),
      });

      if (res.status === 'TEST_RECIPIENT_NOT_CONFIGURED') {
        setSendResultNotice({
          success: false,
          status: 'TEST RECIPIENT NOT CONFIGURED',
          message:
            'Test recipient is not configured. Set WHATSAPP_TEST_RECIPIENT in environment or database settings to enable test dispatch.',
        });
      } else if (res.status === 'PROVIDER_NOT_CONFIGURED') {
        setSendResultNotice({
          success: false,
          status: 'PROVIDER NOT CONFIGURED',
          message:
            'PREVIEW ONLY — WHATSAPP PROVIDER NOT CONFIGURED. To deliver real WhatsApp messages, configure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in environment.',
        });
      } else if (res.status === 'TEMPLATE_NOT_CONFIGURED') {
        setSendResultNotice({
          success: false,
          status: 'CUSTOM TEMPLATE NOT CONFIGURED',
          message:
            res.error ||
            'Dedicated WhatsApp template for dynamic employee pass messages is not configured. Meta Cloud API requires an approved custom template with parameters ({{1}}=employeeName, {{2}}=referenceNumber, {{3}}=ePassUrl). The generic "hello_world" template cannot deliver pass text. Message preview is ready below.',
          safeRecipient: res.safeRecipient,
          templateName: res.templateName,
          templateLanguage: res.templateLanguage,
        });
      } else if (res.success) {
        setSendResultNotice({
          success: true,
          status: 'MESSAGE SENT',
          message: `Test WhatsApp template message successfully dispatched via Meta Cloud API to safe recipient: ${res.safeRecipient}`,
          safeRecipient: res.safeRecipient,
          providerMessageId: res.providerMessageId,
          templateName: res.templateName,
          templateLanguage: res.templateLanguage,
        });
      } else {
        setSendResultNotice({
          success: false,
          status: 'MESSAGE FAILED',
          message: res.error || 'Failed to send WhatsApp message via provider.',
          safeRecipient: res.safeRecipient,
          httpStatus: res.httpStatus,
          metaErrorCode: res.metaErrorCode,
          templateName: res.templateName,
          templateLanguage: res.templateLanguage,
        });
      }
    } catch (err: any) {
      setSendResultNotice({
        success: false,
        status: 'ERROR',
        message: err.message || 'An unexpected error occurred.',
      });
    } finally {
      setSending(false);
    }
  };

  // Dispatch basic hello_world ping to safe recipient for Meta connectivity verification
  const handlePingHelloWorld = async () => {
    if (!testResult) return;
    const targetPhone = testResult.safeRecipient || safeRecipient;
    if (!targetPhone) {
      setSendResultNotice({
        success: false,
        status: 'TEST RECIPIENT NOT CONFIGURED',
        message: 'Configure WHATSAPP_TEST_RECIPIENT in environment to test ping.',
      });
      return;
    }

    if (!window.confirm(`Send a basic 'hello_world' Meta ping to safe test recipient (${targetPhone})?`)) {
      return;
    }

    setSending(true);
    setSendResultNotice(null);

    try {
      const res = await fetchApi('/admin/employees/whatsapp-test/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceNumber: testResult.referenceNumber,
          templateOverride: 'hello_world',
          includeVoucherImage: false,
        }),
      });

      if (res.success) {
        setSendResultNotice({
          success: true,
          status: 'PING SENT (hello_world)',
          message: `Meta Cloud API connectivity verified! 'hello_world' template delivered to safe recipient: ${res.safeRecipient}`,
          safeRecipient: res.safeRecipient,
          providerMessageId: res.providerMessageId,
          templateName: 'hello_world',
          templateLanguage: res.templateLanguage || 'en_US',
        });
      } else {
        setSendResultNotice({
          success: false,
          status: 'PING FAILED',
          message: res.error || 'Failed to ping Meta API.',
          safeRecipient: res.safeRecipient,
          httpStatus: res.httpStatus,
          metaErrorCode: res.metaErrorCode,
          templateName: 'hello_world',
          templateLanguage: res.templateLanguage || 'en_US',
        });
      }
    } catch (err: any) {
      setSendResultNotice({
        success: false,
        status: 'ERROR',
        message: err.message || 'An unexpected error occurred during ping.',
      });
    } finally {
      setSending(false);
    }
  };

  // Clear test data
  const handleClearTestData = async () => {
    if (!window.confirm('Are you sure you want to clear test records created by this lab? Real employee records will NOT be affected.')) {
      return;
    }

    setClearing(true);
    try {
      const res = await fetchApi('/admin/employees/whatsapp-test/cleanup', {
        method: 'DELETE',
      });
      setTestResult(null);
      setSendResultNotice({
        success: true,
        status: 'DATA CLEARED',
        message: `Isolated test data cleared (${res.deletedAttendeesCount || 0} passes, ${res.deletedEmployeesCount || 0} employees).`,
      });
    } catch (err: any) {
      alert(`Cleanup failed: ${err.message}`);
    } finally {
      setClearing(false);
    }
  };

  const handleCopyMessage = () => {
    if (!testResult?.messageText) return;
    navigator.clipboard.writeText(testResult.messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Access Control: SUPER_ADMIN Only
  if (authChecked && userRole !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="bg-white border-2 border-red-200 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-stone-900 mb-2">Access Restricted</h2>
          <p className="text-sm text-stone-600 mb-6">
            The Employee WhatsApp Test Lab is strictly reserved for <strong>SUPER_ADMIN</strong>.
            You do not have permission to view or execute test dispatches.
          </p>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-stone-900 text-white font-bold text-sm hover:bg-stone-800 transition"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {/* Top Banner: Isolated Test Mode & Safe Recipient Warning */}
      <div className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 text-white px-4 py-3 shadow-md">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="bg-black/30 text-amber-200 px-2 py-0.5 rounded font-black tracking-wider text-[11px] uppercase">
              ISOLATED TEST MODE
            </span>
            <span className="font-semibold">
              Messages from this page are sent only to the configured Super Admin safe test recipient.
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono bg-black/20 px-3 py-1 rounded-lg shrink-0">
            <span className="text-amber-200 font-bold">SAFE RECIPIENT:</span>
            {safeRecipient ? (
              <span className="font-extrabold tracking-wide">{safeRecipient}</span>
            ) : (
              <span className="font-bold text-amber-200 bg-red-900/70 px-2 py-0.5 rounded text-xs border border-red-500/40">
                Test recipient is not configured.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Page Header */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <Smartphone className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight font-outfit">
                EMPLOYEE WHATSAPP TEST LAB
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 font-medium">
              Test the employee e-pass WhatsApp experience without contacting real employees.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleQuickFill}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Quick Fill Sample Data
            </button>
            <button
              type="button"
              onClick={handleClearTestData}
              disabled={clearing}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {clearing ? 'Clearing...' : 'Clear Test Data'}
            </button>
          </div>
        </div>

        {/* WHATSAPP PROVIDER: META WHATSAPP CLOUD API */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
            <div>
              <div className="text-[11px] font-bold text-stone-500 uppercase tracking-widest">
                WHATSAPP PROVIDER
              </div>
              <div className="text-lg font-black text-stone-900 font-outfit flex items-center gap-2">
                <span>{providerConfig?.provider || 'META WHATSAPP CLOUD API'}</span>
                {providerConfig?.configured ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    CONFIGURED
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    TEST ADAPTER (UNCONFIGURED)
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-stone-500 font-semibold">API Version:</span>
              <span className="font-bold text-stone-800 bg-stone-100 px-2 py-1 rounded border border-stone-200">
                {providerConfig?.apiVersion || 'v25.0'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <div className="text-stone-500 font-medium text-[11px]">Phone Number ID</div>
              <div className="font-bold text-stone-900 flex items-center gap-1.5 mt-0.5">
                {providerConfig?.phoneNumberIdConfigured ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Configured</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-amber-800">Not Configured</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <div className="text-stone-500 font-medium text-[11px]">Access Token</div>
              <div className="font-bold text-stone-900 flex items-center gap-1.5 mt-0.5">
                {providerConfig?.configured ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Configured (Secured)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-amber-800">Not Configured</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <div className="text-stone-500 font-medium text-[11px]">Test Recipient</div>
              <div className="font-mono font-bold text-stone-900 flex items-center gap-1.5 mt-0.5">
                {safeRecipient ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{safeRecipient}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-amber-800 font-sans">Not Configured</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <div className="text-stone-500 font-medium text-[11px]">Template Dispatch</div>
              <div className="font-mono font-bold text-stone-900 flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>
                  {providerConfig?.templateName || 'hello_world'} ({providerConfig?.templateLanguage || 'en_US'})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sponsor Banner Feature */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white p-4 rounded-2xl border border-blue-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              💎
            </div>
            <div>
              <div className="text-[11px] font-bold text-amber-300 uppercase tracking-widest">
                OFFICIAL FESTIVAL SPONSOR
              </div>
              <div className="text-base font-black tracking-tight font-outfit">
                MAHAVIR JEWELLERS — EXCLUSIVE FESTIVAL VOUCHER
              </div>
              <div className="text-xs text-blue-200 mt-0.5">
                Offer: <strong className="text-white">₹5,000 OFF on Making Charges</strong> | Lifetime | No expiry
              </div>
            </div>
          </div>
          <div className="text-xs text-right sm:text-right shrink-0">
            <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-[11px]">
              Voucher Included in WhatsApp
            </span>
          </div>
        </div>

        {/* Main Grid: Mobile-First Duplicated Registration Form */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-stone-200 bg-stone-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <h2 className="text-sm sm:text-base font-bold text-stone-900 uppercase tracking-wider font-outfit">
                DUPLICATE EMPLOYEE FORM (TEST DATA ONLY)
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-stone-500 bg-white px-2.5 py-1 rounded-full border border-stone-200">
              Step {step} of 5
            </span>
          </div>

          <form onSubmit={handleGenerateTestPass} className="p-4 sm:p-6 space-y-6">
            {formError && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs sm:text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>{formError}</div>
              </div>
            )}

            {/* Step Tabs */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {[
                { s: 1, label: 'Employee', icon: User },
                { s: 2, label: 'Guidelines', icon: FileText },
                { s: 3, label: 'Dates', icon: Calendar },
                { s: 4, label: 'Family', icon: Users },
                { s: 5, label: 'Review', icon: ClipboardCheck },
              ].map((item) => (
                <button
                  key={item.s}
                  type="button"
                  onClick={() => setStep(item.s as any)}
                  className={`p-2 rounded-xl border text-center transition flex flex-col items-center cursor-pointer ${
                    step === item.s
                      ? 'bg-stone-900 text-white border-stone-900 shadow'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border-stone-200'
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mb-0.5" />
                  <span className="text-[10px] sm:text-xs font-bold truncate max-w-full">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            {/* STEP 1: EMPLOYEE DETAILS */}
            {step === 1 && (
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-extrabold text-stone-500 uppercase tracking-wider">
                  Employee Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      ONGC CPF Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stone-900"
                      placeholder="e.g. 99999"
                    />
                    <span className="text-[10px] text-stone-500 mt-1 block">
                      5 or 6 numeric digits (Will be saved as test record TEST-WA-{cpf || '...'})
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stone-900"
                      placeholder="e.g. Siddharth"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stone-900"
                      placeholder="10-digit mobile"
                    />
                    <span className="text-[10px] text-amber-700 font-medium mt-1 block">
                      ⚠️ Test messages will NEVER be sent to this number. They go only to Safe Test Recipient.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stone-900"
                      placeholder="e.g. siddharth@ongc.co.in"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Employee Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-stone-900"
                    >
                      {EMPLOYEE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-stone-900"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-5 py-2.5 rounded-xl bg-stone-900 text-white font-bold text-xs sm:text-sm hover:bg-stone-800 transition cursor-pointer"
                  >
                    Next: Guidelines →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: GUIDELINES ACKNOWLEDGEMENT */}
            {step === 2 && (
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-extrabold text-stone-500 uppercase tracking-wider">
                  Registration & QR Guidelines
                </h3>

                <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5 text-xs text-stone-700 max-h-60 overflow-y-auto">
                  <div className="font-bold text-stone-900 text-sm">
                    ONGC Navratri 2026 QR E-Pass Rules:
                  </div>
                  <p>
                    1. <strong>Personal Permanent QR:</strong> One unique QR is issued per approved employee and remains valid throughout all selected event nights.
                  </p>
                  <p>
                    2. <strong>One Entry Per Day:</strong> Each registered person is permitted one entry per eligible event day.
                  </p>
                  <p>
                    3. <strong>Strictly Non-Transferable:</strong> Passes cannot be shared or forwarded. Misuse will result in pass revocation.
                  </p>
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-stone-200 bg-amber-50/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={guidelinesAgreed}
                    onChange={(e) => setGuidelinesAgreed(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                  />
                  <span className="text-xs font-semibold text-stone-800">
                    I acknowledge and accept the ONGC Navratri 2026 Entry & QR guidelines.
                  </span>
                </label>

                <div className="pt-3 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-100 transition cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-5 py-2.5 rounded-xl bg-stone-900 text-white font-bold text-xs sm:text-sm hover:bg-stone-800 transition cursor-pointer"
                  >
                    Next: Attendance Dates →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: ATTENDANCE DATES */}
            {step === 3 && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-stone-500 uppercase tracking-wider">
                    Select Eligible Event Dates ({employeeDates.length} Selected)
                  </h3>
                  <button
                    type="button"
                    onClick={toggleAllDates}
                    className="text-xs font-bold text-amber-700 hover:text-amber-800 cursor-pointer"
                  >
                    {employeeDates.length === EVENT_DATES.length ? 'Deselect All' : 'Select All 9 Nights'}
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
                  {EVENT_DATES.map((date, idx) => {
                    const theme = getEventDayTheme(date);
                    const selected = employeeDates.includes(date);
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => toggleDate(date)}
                        className={`p-2.5 rounded-xl border-2 text-center transition flex flex-col items-center justify-center cursor-pointer ${
                          selected
                            ? 'bg-[#7A1930] text-white border-amber-400 shadow-sm scale-[1.02]'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${selected ? 'text-amber-300' : 'text-stone-500'}`}>
                          Day {idx + 1}
                        </span>
                        <span className="font-extrabold text-base leading-tight font-outfit mt-0.5">
                          {theme.dayLabel}
                        </span>
                        <span className="text-[10px] font-semibold opacity-90">
                          {theme.monthLabel.slice(0, 3)}
                        </span>
                        <span className={`text-[9px] font-medium mt-0.5 ${selected ? 'text-amber-200' : 'text-stone-400'}`}>
                          {theme.dayOfWeek.slice(0, 3)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-3 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-100 transition cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="px-5 py-2.5 rounded-xl bg-stone-900 text-white font-bold text-xs sm:text-sm hover:bg-stone-800 transition cursor-pointer"
                  >
                    Next: Family Members →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: FAMILY MEMBERS */}
            {step === 4 && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-stone-500 uppercase tracking-wider">
                    Accompanying Family Members (Max 3)
                  </h3>
                  {familyMembers.length < 3 && (
                    <button
                      type="button"
                      onClick={addFamilyMember}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Family Member
                    </button>
                  )}
                </div>

                {familyMembers.length === 0 ? (
                  <div className="p-6 bg-stone-50 border border-dashed border-stone-300 rounded-xl text-center text-xs text-stone-500">
                    No family members added for this test pass. (Click &apos;Add Family Member&apos; if testing family passes).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {familyMembers.map((fm, idx) => (
                      <div
                        key={fm.localId}
                        className="p-4 bg-stone-50 border border-stone-200 rounded-xl relative space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-stone-700">
                            Family Member #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFamilyMember(idx)}
                            className="text-red-600 hover:text-red-800 text-xs font-bold cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-stone-600 mb-1">
                              Name
                            </label>
                            <input
                              type="text"
                              value={fm.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFamilyMembers((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, name: val } : item,
                                  ),
                                );
                              }}
                              className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs"
                              placeholder="Full Name"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-stone-600 mb-1">
                              Relation
                            </label>
                            <select
                              value={fm.relation}
                              onChange={(e) => {
                                const val = e.target.value as AllowedFamilyRelation;
                                setFamilyMembers((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, relation: val } : item,
                                  ),
                                );
                              }}
                              className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs bg-white"
                            >
                              {ALLOWED_FAMILY_RELATIONS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-stone-600 mb-1">
                              Mobile (Optional)
                            </label>
                            <input
                              type="tel"
                              value={fm.mobileNo}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                                setFamilyMembers((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, mobileNo: val } : item,
                                  ),
                                );
                              }}
                              className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs"
                              placeholder="10-digit"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-3 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-100 transition cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(5)}
                    className="px-5 py-2.5 rounded-xl bg-stone-900 text-white font-bold text-xs sm:text-sm hover:bg-stone-800 transition cursor-pointer"
                  >
                    Next: Review & Submit →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: REVIEW & GENERATE TEST PASS */}
            {step === 5 && (
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-extrabold text-stone-500 uppercase tracking-wider">
                  Review Test Registration
                </h3>

                <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2 text-xs text-stone-700">
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="font-semibold text-stone-500">Employee:</span>
                    <span className="font-bold text-stone-900">{name} ({cpf})</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="font-semibold text-stone-500">Form Mobile:</span>
                    <span className="font-mono text-stone-700">{mobile}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="font-semibold text-stone-500">Form Email:</span>
                    <span className="font-medium text-stone-900">{email}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="font-semibold text-stone-500">Category / Dates:</span>
                    <span className="font-bold text-stone-900">
                      {category} — {employeeDates.length} nights selected
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="font-semibold text-stone-500">Family Members:</span>
                    <span className="font-bold text-stone-900">
                      {familyMembers.length} additional member(s)
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-100 transition cursor-pointer"
                  >
                    ← Back
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-extrabold text-sm hover:from-emerald-700 hover:to-teal-800 shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Test Pass...
                      </>
                    ) : (
                      <>
                        <QrCode className="w-4 h-4" />
                        GENERATE TEST PASS
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Mandatory bottom warnings */}
            <div className="pt-4 border-t border-stone-200 text-center space-y-1">
              <div className="text-xs font-black text-amber-800 uppercase tracking-wider">
                THIS IS A TEST REGISTRATION
              </div>
              <p className="text-[11px] text-stone-500">
                Submitting this form will not register a real employee. All created passes are isolated under test markers.
              </p>
            </div>
          </form>
        </div>

        {/* Feedback Notices */}
        {sendResultNotice && (
          <div
            className={`p-5 rounded-2xl border text-xs sm:text-sm flex items-start gap-3.5 shadow-md ${
              sendResultNotice.success
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-red-50 border-red-300 text-red-950'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {sendResultNotice.success ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              )}
            </div>
            <div className="space-y-2 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b pb-2 border-stone-200/60">
                <span className="font-black tracking-wide uppercase text-xs sm:text-sm flex items-center gap-1.5">
                  {sendResultNotice.success ? '✓ MESSAGE SENT' : '✕ MESSAGE FAILED'}
                </span>
                <span className="font-mono text-[11px] text-stone-500 font-semibold">
                  Provider: {providerConfig?.provider || 'Meta WhatsApp Cloud API'}
                </span>
              </div>

              <div className="font-medium text-xs sm:text-sm leading-relaxed">
                {sendResultNotice.message}
              </div>

              {sendResultNotice.providerMessageId && (
                <div className="p-3 bg-white/90 rounded-xl border border-emerald-300 font-mono text-xs space-y-1">
                  <div className="text-stone-500 font-bold text-[11px] uppercase tracking-wider">
                    Meta Cloud API Dispatch Confirmed
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-stone-700">Provider Message ID:</span>
                    <span className="font-extrabold text-emerald-800 break-all bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {sendResultNotice.providerMessageId}
                    </span>
                  </div>
                  {sendResultNotice.templateName && (
                    <div className="text-[11px] text-stone-600">
                      Template: <strong>{sendResultNotice.templateName}</strong> ({sendResultNotice.templateLanguage || 'en_US'})
                    </div>
                  )}
                </div>
              )}

              {sendResultNotice.metaErrorCode && (
                <div className="p-3 bg-white/90 rounded-xl border border-red-300 font-mono text-xs space-y-1 text-red-900">
                  <div className="text-red-700 font-bold text-[11px] uppercase tracking-wider">
                    Meta Diagnostic Error
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>
                      Error Code: <strong>{sendResultNotice.metaErrorCode}</strong>
                    </span>
                    {sendResultNotice.httpStatus && (
                      <span className="text-stone-500">
                        (HTTP Status: {sendResultNotice.httpStatus})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 7, 8, 9, 14, 18: WHATSAPP TEST PREVIEW & CONTROLS */}
        {testResult && (
          <div
            id="whatsapp-preview-section"
            className="bg-white rounded-2xl border-2 border-emerald-500 shadow-xl p-5 sm:p-7 space-y-6"
          >
            {/* Header: TEST PASS GENERATED */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-stone-200 gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black tracking-widest uppercase">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  TEST PASS GENERATED
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-stone-900 font-outfit">
                  Employee Pass Generated &amp; WhatsApp Message Ready
                </h2>
                <p className="text-xs text-stone-500">
                  Isolated test record created with permanent QR architecture and test markers.
                </p>
              </div>

              {/* Status Badge */}
              <div>
                {!testResult.safeRecipient ? (
                  <span className="px-3.5 py-1.5 rounded-full bg-red-100 text-red-900 font-bold text-xs flex items-center gap-1.5 border border-red-300 shadow-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-700" />
                    TEST RECIPIENT NOT CONFIGURED
                  </span>
                ) : testResult.isConfigured ? (
                  <span className="px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5 border border-emerald-300 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                    TEST MESSAGE READY
                  </span>
                ) : (
                  <span className="px-3.5 py-1.5 rounded-full bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1.5 border border-amber-300 shadow-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                    PREVIEW ONLY — WHATSAPP PROVIDER NOT CONFIGURED
                  </span>
                )}
              </div>
            </div>

            {/* Generated Pass Summary Strip: Reference No, Safe Recipient, E-Pass Link */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs">
              {/* Reference No */}
              <div className="bg-white p-3 rounded-lg border border-stone-200/80 shadow-xs space-y-1">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                  Reference No.
                </span>
                <span className="font-mono font-black text-stone-900 text-sm block">
                  {testResult.referenceNumber}
                </span>
                <span className="text-[10px] text-stone-400">
                  Isolated test reference
                </span>
              </div>

              {/* Safe WhatsApp Recipient */}
              <div className="bg-white p-3 rounded-lg border border-stone-200/80 shadow-xs space-y-1">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                  Safe WhatsApp Recipient
                </span>
                <span className="font-mono font-black text-emerald-800 text-sm block">
                  {testResult.safeRecipient || 'Not Configured'}
                </span>
                <span className="text-[10px] text-stone-400">
                  Real employee numbers are never contacted
                </span>
              </div>

              {/* E-Pass Link */}
              <div className="bg-white p-3 rounded-lg border border-stone-200/80 shadow-xs space-y-1 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                    Permanent E-Pass Link
                  </span>
                  <span className="text-[11px] text-stone-600 truncate block font-mono">
                    /employee/my-tickets?ref={testResult.referenceNumber}
                  </span>
                </div>
                <a
                  href={testResult.passUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 underline pt-0.5"
                >
                  <span>Open Test E-Pass</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Template Notice / Requirements Banner */}
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <div>
                  <strong>Meta Template Architecture:</strong> To deliver dynamic pass parameters ({'{{1}}'}=employeeName, {'{{2}}'}=referenceNumber, {'{{3}}'}=ePassUrl), Meta requires an approved custom template configured via <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">WHATSAPP_PASS_TEMPLATE_NAME</code>.
                </div>
                <div className="text-[11px] text-amber-800">
                  The built-in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">hello_world</code> template cannot deliver pass text. If custom template is unapproved, preview mode is displayed.
                </div>
              </div>
            </div>

            {/* High-Fidelity WhatsApp Chat Bubble Container */}
            <div className="bg-[#EFEAE2] p-4 sm:p-6 rounded-2xl border border-stone-300 max-w-md mx-auto shadow-inner relative">
              {/* WhatsApp Message Bubble */}
              <div className="bg-white rounded-2xl rounded-tl-sm p-4 sm:p-5 shadow space-y-3.5 text-stone-900 text-xs sm:text-[13px] leading-relaxed relative">
                {/* Header */}
                <div className="text-center font-black text-stone-900 text-sm tracking-wide">
                  🎉 *ONGC NAVRATRI 2026* 🎉
                </div>

                {/* Greeting */}
                <div>
                  Hello *{name}* 👋
                </div>

                <div className="text-stone-800">
                  Your ONGC Navratri E-Pass has been generated successfully as a TEST PASS. 🪔✨
                </div>

                {/* Reference Number */}
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl font-mono font-bold text-stone-900">
                  🎟️ *Reference No.: {testResult.referenceNumber}*
                </div>

                <div className="text-stone-600 text-xs space-y-1">
                  <div>Your permanent QR pass is your entry credential for the event.</div>
                  <div>Please keep your QR safe and do not share it.</div>
                </div>

                <div className="border-t border-stone-200 my-2" />

                {/* Sponsor Offer Card Inside Message */}
                <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white p-3.5 rounded-xl space-y-2 border border-blue-800">
                  <div className="text-center text-xs font-bold text-amber-300 uppercase tracking-wider">
                    💎 *A SPECIAL GIFT FOR YOU* 💎
                  </div>
                  <div className="text-center text-sm font-extrabold tracking-wide font-outfit">
                    *MAHAVIR JEWELLERS*
                  </div>
                  <div className="text-center text-base font-black text-amber-400 font-outfit leading-tight">
                    ✨ *₹5,000 OFF*
                    <span className="block text-xs font-bold text-white tracking-normal mt-0.5">
                      *ON MAKING CHARGES*
                    </span>
                  </div>
                  <div className="text-center text-[11px] text-blue-200">
                    Valid: Lifetime | No expiry
                  </div>
                  <div className="text-[11px] text-blue-100 pt-1 border-t border-blue-800/80 space-y-0.5">
                    <div>📍 2 Amrakunj, Anne, below NY Cinemas, Tapovan Circle, Chandkheda</div>
                    <div>📞 90330 56098</div>
                  </div>
                </div>

                {/* Image Attachment Preview */}
                <div className="rounded-xl overflow-hidden border border-stone-300 bg-stone-100">
                  <div className="relative aspect-[2.3/1] w-full bg-stone-200">
                    <Image
                      src="/images/sponsors/mahavir-jewellers-voucher.jpg"
                      alt="Mahavir Jewellers Voucher"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 400px"
                    />
                  </div>
                  <div className="p-2 bg-stone-50 text-[10px] text-stone-600 flex items-center justify-between border-t border-stone-200">
                    <span className="font-bold text-stone-800 flex items-center gap-1">
                      📷 SPONSOR VOUCHER: Mahavir Jewellers
                    </span>
                    <span className="text-stone-400">JPG</span>
                  </div>
                </div>

                <div className="border-t border-stone-200 my-2" />

                {/* Pass Link */}
                <div className="space-y-1">
                  <div className="font-bold text-stone-900">
                    🎟️ *VIEW YOUR E-PASS*
                  </div>
                  <div className="text-blue-700 underline font-mono text-xs break-all">
                    {testResult.passUrl}
                  </div>
                </div>

                <div className="text-[11px] text-stone-600 bg-amber-50/80 p-2 rounded-lg border border-amber-200/60 font-medium">
                  ⚠️ This is a test registration. The generated pass is isolated from production employee records.
                </div>

                <div className="text-center font-bold text-stone-800 text-xs pt-1">
                  ✨ See you at ONGC Navratri 2026! ✨
                </div>

                {/* WhatsApp Timestamp Footer */}
                <div className="text-right text-[10px] text-stone-400 pt-1 font-mono">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                </div>
              </div>
            </div>

            {/* Test Action Controls: SEND TEST WHATSAPP + Ping Meta + Preview Copy */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-stone-200">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-800 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied Message' : 'PREVIEW WHATSAPP (Copy Text)'}
                </button>

                <button
                  type="button"
                  onClick={handlePingHelloWorld}
                  disabled={sending || !testResult.safeRecipient}
                  title="Verify Meta Cloud API connectivity to safe recipient with built-in hello_world template"
                  className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-indigo-300 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Ping Meta (hello_world)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleSendTestWhatsApp}
                disabled={sending || !testResult.safeRecipient}
                title={
                  !testResult.safeRecipient
                    ? 'Configure WHATSAPP_TEST_RECIPIENT in environment to enable test sending'
                    : undefined
                }
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    SENDING...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    SEND TEST WHATSAPP
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
