'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Mail,
  Send,
  ExternalLink,
  Shield,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Phone,
  Ticket,
  Eye,
  Info,
  Layers,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { getStoredAuthUser, subscribeToAuthSync } from '@/lib/auth-session';
import TicketPassCard, { TicketPassData } from '@/components/TicketPassCard';
import BookPassSection from '@/components/BookPassSection';

export interface TestingPreviewResponse {
  order: {
    orderNumber: string;
    customerName: string;
    customerMobile: string;
    customerEmail: string;
    ticketType: string;
    selectedDates: string[];
    quantity: number;
    amountInr: number;
    amountPaise: number;
    orderStatus: string;
    paymentStatus: string;
    paymentReference: string;
    createdAt: string;
    paidAt: string | null;
    isTestPayment: boolean;
    isSampleFixture: boolean;
    passes: Array<TicketPassData & { token: string; qrCodeToken: string }>;
  };
  emailPreview: {
    subject: string;
    html: string;
    fromName: string;
    fromEmail: string;
    isConfigured: boolean;
  };
  paymentGateway: {
    status: 'ENABLED' | 'DISABLED';
    enabled: boolean;
    environment: string;
    gateway: string;
    isConfigured: boolean;
  };
  serverTime: string;
}

export interface SuperAdminTestingViewProps {
  initialData?: TestingPreviewResponse;
}

export default function SuperAdminTestingView({
  initialData,
}: SuperAdminTestingViewProps = {}) {
  const [currentUser, setCurrentUser] = useState<{ id?: string; role?: string; email?: string } | null>(
    () => getStoredAuthUser() as any,
  );
  const [previewData, setPreviewData] = useState<TestingPreviewResponse | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [selectedPassIndex, setSelectedPassIndex] = useState(0);

  // Test email state
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isSuperAdmin = (currentUser?.role || '').toUpperCase() === 'SUPER_ADMIN';

  const loadData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await fetchApi<TestingPreviewResponse>('/admin/testing/preview');
      if (res) {
        setPreviewData(res);
        setLastRefreshed(new Date().toLocaleTimeString('en-IN', { hour12: true, hour: 'numeric', minute: 'numeric', second: 'numeric' }));
        setSelectedPassIndex(0);
      }
    } catch (err: any) {
      // Handled gracefully in UI
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const stored = getStoredAuthUser();
    if (stored) {
      setCurrentUser(stored as any);
    }

    fetchApi('/auth/me')
      .then((res: any) => {
        if (res?.user) {
          setCurrentUser(res.user);
        }
      })
      .catch(() => {});

    const unsubscribe = subscribeToAuthSync((event) => {
      if (event.type === 'LOGIN' && event.user) {
        setCurrentUser(event.user as any);
      } else if (event.type === 'LOGOUT') {
        setCurrentUser(null);
      }
    });

    if (!initialData) {
      loadData();
    }

    return () => {
      unsubscribe?.();
    };
  }, [initialData]);

  const handleSendTestEmail = async () => {
    try {
      setSendingEmail(true);
      setEmailStatus(null);
      const res = await fetchApi<any>('/admin/testing/send-test-email', {
        method: 'POST',
      });
      setEmailStatus({
        text: res?.message || `Test email dispatched to ${res?.recipient || currentUser?.email}`,
        type: 'success',
      });
    } catch (err: any) {
      setEmailStatus({
        text: err?.message || 'Failed to dispatch test email. Please check mail server credentials.',
        type: 'error',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-4">
        <div className="bg-white border border-stone-200 p-8 rounded-3xl shadow-sm space-y-4">
          <Shield className="w-12 h-12 text-rose-600 mx-auto" />
          <h1 className="text-xl font-bold font-cinzel text-maroon">Access Restricted</h1>
          <p className="text-xs text-stone-600">
            This Testing &amp; Preview tool is accessible exclusively to Super Administrators.
          </p>
          <div className="pt-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-maroon text-white font-bold text-xs hover:bg-maroon-dark transition"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const order = previewData?.order;
  const currentPass = order?.passes?.[selectedPassIndex] || order?.passes?.[0];
  const gateway = previewData?.paymentGateway;
  const emailPreview = previewData?.emailPreview;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Section D: Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-outfit font-black text-2xl text-ink">Testing &amp; Preview Lab</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-gold/15 text-gold-dark text-[10px] font-black uppercase tracking-wider border border-gold/30">
              SUPER ADMIN
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Authoritative inspection of live E-Pass layouts, customer email templates, test email dispatch, and gateway controls.
          </p>
        </div>

        {/* Section D: Refresh Button */}
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <div className="text-[11px] text-stone-500 font-medium">
              Last refreshed: <span className="font-bold text-ink">{lastRefreshed}</span>
            </div>
          )}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-stone-300 text-ink text-xs font-bold hover:border-maroon/50 hover:text-maroon transition shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-maroon ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Pass'}</span>
          </button>
        </div>
      </div>

      {loading && !previewData ? (
        <div className="py-24 text-center space-y-3">
          <div className="w-10 h-10 border-3 border-maroon border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-maroon">Loading latest commercial booking and email preview...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* SECTION A: CUSTOMER BOOKING PAGE PREVIEW */}
          <div className="bg-white rounded-3xl border border-stone-200/80 p-6 card-shadow space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-100 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="font-outfit font-black text-xl text-ink">
                    Section A &bull; Customer Booking Page Preview
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-wider border border-blue-200">
                    PREVIEW MODE
                  </span>
                  <span
                    data-testid="preview-payment-badge"
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      gateway?.enabled
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    PAYMENT: {gateway?.enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  Live preview of public pass booking (/bookpass) reflecting current payment configuration. Real payments cannot be initiated in preview mode.
                </p>
              </div>

              <a
                href="/bookpass"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-maroon text-white text-xs font-bold hover:bg-maroon-dark transition flex items-center gap-2 shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
              >
                <span>Open Live Book Pass</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Embedded Interactive Booking Section Preview */}
            <div className="border border-stone-200 rounded-3xl p-2 sm:p-4 bg-stone-50/50">
              <BookPassSection
                isPreview={true}
                paymentEnabled={gateway?.enabled ?? false}
              />
            </div>
          </div>

          {/* SECTION B: PAYMENT GATEWAY STATE & TEST EMAIL */}
          <div className="space-y-4">
            <div className="border-b border-stone-200 pb-2">
              <h2 className="font-outfit font-black text-lg text-ink">
                Section B &bull; Payment Gateway State &amp; Test Email
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Runtime gateway health status and transactional delivery verification
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* PAYMENT GATEWAY STATUS CARD */}
              <div className="bg-white rounded-3xl border border-stone-200/80 p-5 card-shadow flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-cream-soft border border-stone-200 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-maroon" />
                      </div>
                      <div>
                        <h3 className="font-outfit font-bold text-sm text-ink">Payment Gateway Status</h3>
                        <div className="text-[10px] text-stone-400 font-medium">Razorpay Online Gateway</div>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                        gateway?.enabled
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {gateway?.status || 'ENABLED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 pt-2">
                    <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/60">
                      <div className="text-[10px] font-bold uppercase text-stone-400">Status</div>
                      <div className="text-xs font-bold text-ink mt-0.5">
                        {gateway?.enabled ? 'Online (ON)' : 'Disabled (OFF)'}
                      </div>
                    </div>
                    <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/60">
                      <div className="text-[10px] font-bold uppercase text-stone-400">Environment</div>
                      <div className="text-xs font-bold text-ink mt-0.5">
                        {gateway?.environment || 'TEST'}
                      </div>
                    </div>
                    <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/60">
                      <div className="text-[10px] font-bold uppercase text-stone-400">Configuration</div>
                      <div className="text-xs font-bold text-ink mt-0.5">
                        {gateway?.isConfigured ? 'Live Configured' : 'Sandbox / Mock'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-100">
                  <Link
                    href="/admin/settings?tab=payment"
                    className="inline-flex items-center gap-2 text-xs font-bold text-maroon hover:text-maroon-dark hover:underline"
                  >
                    <span>Open Payment Settings &rarr;</span>
                  </Link>
                </div>
              </div>

              {/* SEND TEST EMAIL CARD */}
              <div className="bg-white rounded-3xl border border-stone-200/80 p-5 card-shadow flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-cream-soft border border-stone-200 flex items-center justify-center">
                        <Mail className="w-4 h-4 text-maroon" />
                      </div>
                      <div>
                        <h3 className="font-outfit font-bold text-sm text-ink">Send Test Transactional Email</h3>
                        <div className="text-[10px] text-stone-400 font-medium">Verify Live Mail Delivery Pipeline</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-lg">
                      Hostinger API
                    </span>
                  </div>

                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/60 text-xs text-stone-700 space-y-1.5">
                    <div className="text-stone-500 text-[11px]">
                      Test email will be sent strictly to your authenticated address:
                    </div>
                    <div className="font-mono font-bold text-maroon text-xs break-all">
                      {currentUser?.email || 'Logged-in Super Admin'}
                    </div>
                    <div className="text-[10px] text-stone-400">
                      Subject: <span className="font-mono font-semibold">TEST — ONGC Navratri 2026 E-Pass</span>
                    </div>
                  </div>

                  {emailStatus && (
                    <div
                      className={`p-3 rounded-2xl text-xs font-medium flex items-center gap-2 ${
                        emailStatus.type === 'success'
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border border-rose-200 text-rose-900'
                      }`}
                    >
                      {emailStatus.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{emailStatus.text}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={sendingEmail || !currentUser?.email}
                    className="px-5 py-2.5 rounded-xl bg-maroon hover:bg-maroon-dark text-white text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5 text-gold" />
                    <span>{sendingEmail ? 'Dispatching Test Email...' : 'Send Test Email'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sample Fixture Notice (if no orders in DB yet) */}
          {order?.isSampleFixture && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-3 shadow-2xs">
              <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Displaying Sample Test Pass Fixture:</span>
                <span className="ml-1 text-amber-800">
                  No confirmed commercial orders exist in the database yet. A sample commercial booking fixture with 2 tickets has been loaded so you can test multi-pass attendee selection, QR code generation, and the exact email template.
                </span>
              </div>
            </div>
          )}

          {/* SECTION C & SECTION D SPLIT: LATEST E-PASS PREVIEW & EMAIL PREVIEW */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* SECTION C: LATEST E-PASS PREVIEW (5 cols on xl) */}
            <div className="xl:col-span-5 space-y-4">
              <div className="bg-white rounded-3xl border border-stone-200/80 p-5 card-shadow space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="font-outfit font-extrabold text-base text-ink">
                      Section C &bull; Latest E-Pass Preview
                    </h3>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Most recent confirmed booking from commercial database
                    </p>
                  </div>
                  {currentPass?.token && (
                    <a
                      href={`/ticket/${encodeURIComponent(currentPass.token)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-cream-soft border border-stone-300 text-xs font-bold text-maroon hover:bg-maroon hover:text-white transition flex items-center gap-1.5 shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Live Pass</span>
                    </a>
                  )}
                </div>

                {/* Booking Summary Meta */}
                {order && (
                  <div className="grid grid-cols-2 gap-2 text-xs bg-cream-soft/60 p-3.5 rounded-2xl border border-stone-200/70">
                    <div>
                      <div className="text-[9px] font-bold uppercase text-stone-400">Order Reference</div>
                      <div className="font-mono font-bold text-maroon text-xs mt-0.5">{order.orderNumber}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase text-stone-400">Amount Paid</div>
                      <div className="font-bold text-ink text-xs mt-0.5">₹{order.amountInr}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase text-stone-400">Customer Name</div>
                      <div className="font-medium text-ink text-xs mt-0.5">{order.customerName}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase text-stone-400">Customer Mobile</div>
                      <div className="font-mono text-ink text-xs mt-0.5">{order.customerMobile}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase text-stone-400">Customer Email</div>
                      <div className="font-medium text-ink text-[11px] truncate mt-0.5">{order.customerEmail}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase text-stone-400">Payment Reference</div>
                      <div className="font-mono text-[11px] text-stone-600 truncate mt-0.5">{order.paymentReference}</div>
                    </div>
                  </div>
                )}

                {/* Attendee Selector (if order contains multiple passes) */}
                {order && order.passes.length > 1 && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Select Attendee Pass ({order.passes.length} tickets in order):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {order.passes.map((pass, idx) => (
                        <button
                          key={pass.id || idx}
                          type="button"
                          onClick={() => setSelectedPassIndex(idx)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            selectedPassIndex === idx
                              ? 'bg-maroon text-white shadow-2xs'
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          Pass #{idx + 1}: {pass.name || pass.attendeeName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Real Rendered TicketPassCard Component */}
                <div className="pt-2">
                  {currentPass ? (
                    <TicketPassCard
                      ticket={{
                        ...currentPass,
                        date: order?.selectedDates?.join(', '),
                        bookingDays: currentPass.bookingDays || order?.selectedDates,
                        ticketType: order?.ticketType,
                        isTestPayment: order?.isTestPayment,
                      }}
                      id="previewTicketCard"
                    />
                  ) : (
                    <div className="p-8 text-center text-xs text-stone-500">No pass available.</div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION D: E-PASS EMAIL PREVIEW (7 cols on xl) */}
            <div className="xl:col-span-7 space-y-4">
              <div className="bg-white rounded-3xl border border-stone-200/80 p-5 card-shadow space-y-4">
                <div className="border-b border-stone-100 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-outfit font-extrabold text-base text-ink">
                        Section D &bull; E-Pass Email Template Preview
                      </h3>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Exact HTML generated by <span className="font-mono font-semibold">MailService</span> for transactional confirmations
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                      Live Template Parity
                    </span>
                  </div>

                  {/* Email Headers Box */}
                  {emailPreview && (
                    <div className="mt-3 p-3 bg-stone-50 rounded-2xl border border-stone-200/60 text-xs space-y-1 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="text-stone-400 font-bold uppercase text-[9px] w-12 shrink-0">From:</span>
                        <span className="font-semibold text-ink">
                          {emailPreview.fromName} &lt;{emailPreview.fromEmail}&gt;
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-stone-400 font-bold uppercase text-[9px] w-12 shrink-0">Subject:</span>
                        <span className="font-bold text-maroon">{emailPreview.subject}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Email HTML Sandbox Frame */}
                {emailPreview?.html ? (
                  <div className="border-2 border-stone-200 rounded-2xl overflow-hidden bg-stone-100 shadow-inner">
                    <iframe
                      title="Transactional Email Preview"
                      srcDoc={emailPreview.html}
                      className="w-full h-[650px] border-0"
                      sandbox="allow-same-origin allow-scripts"
                    />
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-stone-400">
                    No email preview generated.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
