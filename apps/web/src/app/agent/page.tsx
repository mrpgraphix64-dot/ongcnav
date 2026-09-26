'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Ticket,
  Users,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  LogOut,
  Shield,
  Plus,
  Mail,
  Phone,
  User,
  ExternalLink,
  ChevronRight,
  QrCode,
  Download,
  Printer,
  Sparkles,
  Layers,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { clearStoredAuth } from '@/lib/auth-session';
import PasswordInput from '@/components/PasswordInput';

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

const PASS_TYPES = [
  {
    code: 'COMMERCIAL_DAILY',
    name: 'Daily Pass',
    priceInr: 499,
    description: 'Single day entry for one person',
    isSeason: false,
  },
  {
    code: 'COMMERCIAL_SEASON',
    name: 'Season Pass',
    priceInr: 2999,
    description: 'All 9 nights entry for one person',
    isSeason: true,
  },
  {
    code: 'COMMERCIAL_MANDLI',
    name: 'Mandli Pass',
    priceInr: 3999,
    description: 'Group entry pass for Garba groups',
    isSeason: false,
  },
  {
    code: 'COMMERCIAL_ANY_DAY',
    name: 'Any Day Pass',
    priceInr: 599,
    description: 'Flexible single day entry',
    isSeason: false,
  },
];

export default function CommercialAgentPortal() {
  const router = useRouter();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'booking' | 'allocations' | 'history' | 'subagents'>('booking');

  // Agent Profile & Allocations
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Booking Flow State
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedPassType, setSelectedPassType] = useState<string>('COMMERCIAL_DAILY');
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-11');
  const [quantity, setQuantity] = useState<number>(1);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerMobile, setCustomerMobile] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [termsAccepted, setTermsAccepted] = useState<boolean>(true);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  // Bookings History State
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingSearch, setBookingSearch] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  // Sub-Agents State
  const [subAgents, setSubAgents] = useState<any[]>([]);
  const [subAgentsLoading, setSubAgentsLoading] = useState(false);
  const [showAddSubAgentModal, setShowAddSubAgentModal] = useState(false);
  const [subAgentForm, setSubAgentForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [subAgentSubmitting, setSubAgentSubmitting] = useState(false);

  // Sub-Allocation Modal State
  const [selectedSubAgentForAlloc, setSelectedSubAgentForAlloc] = useState<any>(null);
  const [allocPassType, setAllocPassType] = useState('COMMERCIAL_DAILY');
  const [allocQuantity, setAllocQuantity] = useState<number>(10);
  const [allocSubmitting, setAllocSubmitting] = useState(false);

  // Sub-Agent Reclaim Modal State
  const [selectedSubAgentForReclaim, setSelectedSubAgentForReclaim] = useState<any>(null);
  const [reclaimPassType, setReclaimPassType] = useState('COMMERCIAL_DAILY');
  const [reclaimQuantity, setReclaimQuantity] = useState<number>(5);
  const [reclaimNotes, setReclaimNotes] = useState('');
  const [reclaimSubmitting, setReclaimSubmitting] = useState(false);

  const handleReclaimFromSubAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubAgentForReclaim) return;
    setReclaimSubmitting(true);
    try {
      await fetchApi(`/agent/sub-agents/${selectedSubAgentForReclaim.id}/reclaim`, {
        method: 'POST',
        body: JSON.stringify({
          passType: reclaimPassType,
          quantity: reclaimQuantity,
          notes: reclaimNotes || undefined,
        }),
      });
      setSelectedSubAgentForReclaim(null);
      setReclaimNotes('');
      loadAgentData();
      loadSubAgents();
    } catch (err: any) {
      alert(err.message || 'Failed to reclaim passes.');
    } finally {
      setReclaimSubmitting(false);
    }
  };

  // Sub-Agent Oversight Modal State
  const [oversightSubAgent, setOversightSubAgent] = useState<any>(null);
  const [oversightAllocations, setOversightAllocations] = useState<any[]>([]);
  const [oversightBookings, setOversightBookings] = useState<any[]>([]);
  const [oversightLoading, setOversightLoading] = useState(false);

  // Fetch agent profile and allocations
  const loadAgentData = useCallback(async () => {
    try {
      setErrorMsg(null);
      const [profileData, allocData] = await Promise.all([
        fetchApi('/agent/profile'),
        fetchApi('/agent/allocations'),
      ]);
      setAgentProfile(profileData);
      setAllocations(allocData.allocations || []);
      setSummary(allocData.summary || null);
    } catch (err: any) {
      if (err?.message?.includes('Authentication required') || err?.status === 401 || err?.status === 403) {
        clearStoredAuth();
        router.push('/agent/login');
        return;
      }
      setErrorMsg(err.message || 'Failed to load agent profile.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  // Fetch bookings history
  const loadBookings = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const q = bookingSearch.trim() ? `?search=${encodeURIComponent(bookingSearch.trim())}` : '';
      const res = await fetchApi(`/agent/bookings${q}`);
      setBookings(res.orders || []);
    } catch {
      setBookings([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [bookingSearch]);

  // Fetch sub-agents
  const loadSubAgents = useCallback(async () => {
    setSubAgentsLoading(true);
    try {
      const res = await fetchApi('/agent/sub-agents');
      setSubAgents(Array.isArray(res) ? res : []);
    } catch {
      setSubAgents([]);
    } finally {
      setSubAgentsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgentData();
  }, [loadAgentData]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadBookings();
    } else if (activeTab === 'subagents') {
      loadSubAgents();
    }
  }, [activeTab, loadBookings, loadSubAgents]);

  const handleLogout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } catch {}
    clearStoredAuth();
    router.push('/agent/login');
  };

  // Helper to find available quantity for current pass type
  const currentAvailableBalance = useMemo(() => {
    const alloc = allocations.find((a) => a.passType === selectedPassType);
    return alloc?.availableQuantity || 0;
  }, [allocations, selectedPassType]);

  const currentPassConfig = useMemo(() => {
    return PASS_TYPES.find((p) => p.code === selectedPassType) || PASS_TYPES[0];
  }, [selectedPassType]);

  const totalBookingPrice = useMemo(() => {
    return currentPassConfig.priceInr * quantity;
  }, [currentPassConfig, quantity]);

  // Handle Offline Booking Submission
  const handleConfirmOfflineSale = async () => {
    setBookingError(null);
    if (!customerName.trim()) {
      setBookingError('Customer name is required.');
      return;
    }
    const cleanPhone = customerMobile.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setBookingError('A valid 10-digit Indian mobile number is required.');
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setBookingError('A valid customer email address is mandatory for digital ticket delivery.');
      return;
    }
    if (quantity > currentAvailableBalance) {
      setBookingError(
        `Insufficient allocation! Required: ${quantity}, Available: ${currentAvailableBalance}. The entire booking is rejected.`,
      );
      return;
    }

    setIsSubmittingBooking(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        customerMobile: cleanPhone,
        customerEmail: customerEmail.trim().toLowerCase(),
        ticketType: selectedPassType,
        selectedDates: currentPassConfig.isSeason ? EVENT_DATES : [selectedDate],
        quantity,
        termsAccepted: true,
      };

      const res = await fetchApi('/agent/bookings/offline', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setConfirmedOrder(res);
      // Reload allocations so available inventory updates immediately
      loadAgentData();
    } catch (err: any) {
      setBookingError(err.message || 'Offline booking transaction failed.');
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Reset booking form
  const handleResetBooking = () => {
    setConfirmedOrder(null);
    setBookingStep(1);
    setCustomerName('');
    setCustomerMobile('');
    setCustomerEmail('');
    setQuantity(1);
    setBookingError(null);
  };

  // Handle Add Sub-Agent
  const handleCreateSubAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubAgentSubmitting(true);
    try {
      await fetchApi('/agent/sub-agents', {
        method: 'POST',
        body: JSON.stringify(subAgentForm),
      });
      setShowAddSubAgentModal(false);
      setSubAgentForm({ name: '', email: '', phone: '', password: '' });
      loadSubAgents();
    } catch (err: any) {
      alert(err.message || 'Failed to create sub-agent.');
    } finally {
      setSubAgentSubmitting(false);
    }
  };

  // Handle Sub-Allocation
  const handleSubAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubAgentForAlloc) return;
    setAllocSubmitting(true);
    try {
      await fetchApi(`/agent/sub-agents/${selectedSubAgentForAlloc.id}/allocate`, {
        method: 'POST',
        body: JSON.stringify({
          passType: allocPassType,
          quantity: allocQuantity,
        }),
      });
      setSelectedSubAgentForAlloc(null);
      loadAgentData();
      loadSubAgents();
    } catch (err: any) {
      alert(err.message || 'Sub-allocation failed.');
    } finally {
      setAllocSubmitting(false);
    }
  };

  // Handle Oversight View
  const handleOpenOversight = async (subAgent: any) => {
    setOversightSubAgent(subAgent);
    setOversightLoading(true);
    try {
      const [allocRes, bookingRes] = await Promise.all([
        fetchApi(`/agent/sub-agents/${subAgent.id}/allocations`),
        fetchApi(`/agent/sub-agents/${subAgent.id}/bookings`),
      ]);
      setOversightAllocations(allocRes.allocations || []);
      setOversightBookings(bookingRes.orders || []);
    } catch {
      setOversightAllocations([]);
      setOversightBookings([]);
    } finally {
      setOversightLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-maroon animate-spin" />
          <p className="text-sm font-bold text-ink-soft">Loading E-Pass Agent Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream text-ink font-sans pb-12">
      {/* Top Banner & Header */}
      <header className="bg-maroon text-white border-b border-gold/30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img
                src="/images/logo-web.png"
                alt="ONGC Logo"
                className="h-9 w-auto object-contain shrink-0"
              />
              <div>
                <div className="font-outfit font-bold text-base leading-tight tracking-wide flex items-center gap-2">
                  <span>E-Pass Agent Portal</span>
                  <span className="text-[10px] bg-gold/20 text-gold px-2 py-0.5 rounded-full font-extrabold uppercase border border-gold/40">
                    Offline Sales
                  </span>
                </div>
                <p className="text-xs text-stone-200">
                  {agentProfile?.name}{agentProfile?.email ? ` • ${agentProfile.email}` : ''} • {agentProfile?.role === 'COMMERCIAL_SUB_AGENT' ? 'Sub-Agent' : 'Master Agent'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setRefreshing(true);
                  loadAgentData();
                }}
                disabled={refreshing}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white"
                title="Refresh Inventory"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-900/60 transition-colors text-xs font-bold text-rose-200"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Global Inventory Balance Header Bar */}
        <div className="bg-maroon-dark/90 border-t border-gold/20 py-2.5 px-4 sm:px-8">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs font-semibold">
            <div className="flex items-center gap-2 text-stone-200">
              <Shield className="w-4 h-4 text-gold" />
              <span>
                Inventory Allocation Rule: <strong>Agent + Pass Type + Quantity</strong> (Never Date-Restricted)
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-white/10 px-3 py-1 rounded-lg border border-white/10">
                Total Allocated: <span className="font-bold text-gold">{summary?.totalAllocated || 0}</span>
              </div>
              <div className="bg-white/10 px-3 py-1 rounded-lg border border-white/10">
                Direct Sold: <span className="font-bold text-emerald-400">{summary?.totalBooked || 0}</span>
              </div>
              <div className="bg-white/10 px-3 py-1 rounded-lg border border-white/10">
                Sub-Allocated: <span className="font-bold text-amber-300">{summary?.totalSubAllocated || 0}</span>
              </div>
              <div className="bg-white/10 px-3 py-1 rounded-lg border border-white/10">
                Checked In: <span className="font-bold text-indigo-300">{summary?.checkedIn || 0}</span>
              </div>
              <div className="bg-gold/20 px-3 py-1 rounded-lg border border-gold/40 text-gold">
                Available to Sell: <span className="font-black text-sm">{summary?.totalAvailable || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex border-b border-stone-200 space-x-1 sm:space-x-4">
          <button
            onClick={() => setActiveTab('booking')}
            className={`pb-3 px-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'booking'
                ? 'border-maroon text-maroon'
                : 'border-transparent text-stone-500 hover:text-ink'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>New Offline Pass Sale</span>
          </button>

          <button
            onClick={() => setActiveTab('allocations')}
            className={`pb-3 px-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'allocations'
                ? 'border-maroon text-maroon'
                : 'border-transparent text-stone-500 hover:text-ink'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>My Allocations & Inventory</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-maroon text-maroon'
                : 'border-transparent text-stone-500 hover:text-ink'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Offline Bookings History</span>
          </button>

          {!agentProfile?.parentAgent && agentProfile?.role !== 'COMMERCIAL_SUB_AGENT' && (
            <button
              onClick={() => setActiveTab('subagents')}
              className={`pb-3 px-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'subagents'
                  ? 'border-maroon text-maroon'
                  : 'border-transparent text-stone-500 hover:text-ink'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Sub-Agents Network</span>
              {agentProfile?.subAgentsCount > 0 && (
                <span className="bg-maroon/10 text-maroon text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                  {agentProfile.subAgentsCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs font-semibold shrink-0">
              <Link href="/agent/login" className="text-maroon hover:underline">
                Sign In
              </Link>
              <span className="text-stone-300">&bull;</span>
              <Link href="/forgot-password" className="text-maroon hover:underline">
                Forgot Password?
              </Link>
            </div>
          </div>
        )}

        {/* TAB 1: NEW OFFLINE BOOKING */}
        {activeTab === 'booking' && (
          <div>
            {confirmedOrder ? (
              /* Success / Ticket Confirmation Screen */
              <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-8 space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-outfit font-black text-ink">
                    Offline Sale Confirmed!
                  </h2>
                  <p className="text-sm text-stone-600">
                    Order <strong>#{confirmedOrder.order.orderNumber}</strong> has been created and verified offline. Digital passes have been dispatched to <strong>{confirmedOrder.order.customerEmail}</strong>.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-cream-soft border border-stone-200 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-500">Customer Name:</span>
                    <span className="font-bold text-ink">{confirmedOrder.order.customerName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-500">Customer Mobile:</span>
                    <span className="font-bold text-ink">{confirmedOrder.order.customerMobile}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-500">Customer Email:</span>
                    <span className="font-bold text-ink">{confirmedOrder.order.customerEmail}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-500">Ticket Type:</span>
                    <span className="font-bold text-maroon">{confirmedOrder.order.ticketType}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-500">Quantity & Amount:</span>
                    <span className="font-bold text-ink">
                      {confirmedOrder.order.quantity} Passes • ₹{confirmedOrder.order.amountInr} (Collected Offline)
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-stone-500">Payment Mode:</span>
                    <span className="font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      OFFLINE DIRECT SALE
                    </span>
                  </div>
                </div>

                {/* Generated Passes with QR codes */}
                <div className="space-y-4">
                  <h3 className="font-outfit font-bold text-sm text-ink flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-maroon" />
                    <span>Issued Digital Entry Passes ({confirmedOrder.passes?.length || 0})</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {confirmedOrder.passes?.map((pass: any, idx: number) => (
                      <div
                        key={pass.id || idx}
                        className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs flex flex-col items-center text-center space-y-3"
                      >
                        <div className="w-36 h-36 bg-stone-50 rounded-xl p-2 border border-stone-100 flex items-center justify-center">
                          {pass.qrSvg ? (
                            <div
                              className="w-full h-full"
                              dangerouslySetInnerHTML={{ __html: pass.qrSvg }}
                            />
                          ) : (
                            <QrCode className="w-24 h-24 text-stone-300" />
                          )}
                        </div>

                        <div>
                          <div className="text-[11px] font-mono font-bold text-maroon">
                            {pass.ticketNumber}
                          </div>
                          <div className="text-xs font-bold text-ink">{pass.name}</div>
                          <div className="text-[10px] text-stone-500">{pass.category}</div>
                        </div>

                        <Link
                          href={`/ticket/${pass.qrCodeToken}`}
                          target="_blank"
                          className="w-full py-1.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-ink text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View Digital Ticket</span>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex justify-center">
                  <button
                    onClick={handleResetBooking}
                    className="px-6 py-3 rounded-xl bg-maroon text-white font-outfit font-bold text-sm hover:bg-maroon-dark transition-colors shadow-sm cursor-pointer"
                  >
                    + Book Another E-Pass
                  </button>
                </div>
              </div>
            ) : (
              /* The 5-Step Booking Form */
              <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-8 space-y-8">
                {/* Stepper Header */}
                <div>
                  <h2 className="text-xl font-outfit font-black text-ink">
                    New Offline E-Pass Sale
                  </h2>
                  <p className="text-xs text-stone-500 mt-1">
                    Book tickets directly on behalf of a walk-in customer. Inventory will be atomically deducted from your allocated quota.
                  </p>

                  <div className="grid grid-cols-5 gap-2 mt-6">
                    {[
                      { num: 1, label: 'Category' },
                      { num: 2, label: 'Date' },
                      { num: 3, label: 'Quantity' },
                      { num: 4, label: 'Customer' },
                      { num: 5, label: 'Review' },
                    ].map((s) => (
                      <div
                        key={s.num}
                        className={`text-center pb-2 border-b-2 transition-colors ${
                          bookingStep === s.num
                            ? 'border-maroon text-maroon font-bold'
                            : bookingStep > s.num
                            ? 'border-emerald-600 text-emerald-700 font-semibold'
                            : 'border-stone-200 text-stone-400 font-medium'
                        }`}
                      >
                        <div className="text-[11px] uppercase tracking-wider font-outfit">
                          Step {s.num}
                        </div>
                        <div className="text-xs hidden sm:block">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {bookingError && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
                    <span>{bookingError}</span>
                  </div>
                )}

                {/* STEP 1: CATEGORY */}
                {bookingStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-outfit font-bold text-sm text-ink">
                      Step 1: Select E-Pass Category
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {PASS_TYPES.map((pt) => {
                        const alloc = allocations.find((a) => a.passType === pt.code);
                        const avail = alloc?.availableQuantity || 0;
                        const isSelected = selectedPassType === pt.code;

                        return (
                          <div
                            key={pt.code}
                            onClick={() => {
                              setSelectedPassType(pt.code);
                            }}
                            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                              isSelected
                                ? 'border-maroon bg-maroon/5 shadow-xs'
                                : 'border-stone-200 hover:border-stone-300 bg-white'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-outfit font-bold text-sm text-ink">
                                  {pt.name}
                                </h4>
                                <p className="text-xs text-stone-500 mt-0.5">
                                  {pt.description}
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="font-outfit font-black text-sm text-maroon">
                                  ₹{pt.priceInr}
                                </div>
                                <span
                                  className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-1 ${
                                    avail > 0
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {avail > 0 ? `${avail} Available` : '0 Quota'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-4 flex justify-end">
                      <button
                        onClick={() => {
                          if (currentAvailableBalance <= 0) {
                            setBookingError(
                              `You have 0 available allocation for ${currentPassConfig.name}. Please select a category with available quota or request an allocation increase.`,
                            );
                            return;
                          }
                          setBookingError(null);
                          setBookingStep(2);
                        }}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-maroon text-white font-outfit font-bold text-xs hover:bg-maroon-dark transition-colors cursor-pointer"
                      >
                        <span>Continue to Date Selection</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: DATE */}
                {bookingStep === 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-outfit font-bold text-sm text-ink">
                        Step 2: Select Booking Date
                      </h3>
                      <span className="text-xs font-bold text-maroon">
                        {currentPassConfig.name}
                      </span>
                    </div>

                    {currentPassConfig.isSeason ? (
                      <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <Sparkles className="w-5 h-5 text-amber-600" />
                          <span>All 9 Navratri Nights Covered</span>
                        </div>
                        <p className="text-xs text-amber-800">
                          Season Pass authoritatively covers all configured event dates (Oct 11 – Oct 19, 2026). No single date selection is required.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-stone-500">
                          Please select exactly <strong>ONE</strong> event date for this booking:
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                          {EVENT_DATES.map((date) => {
                            const isSelected = selectedDate === date;
                            const d = new Date(date);
                            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                            const dayNum = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

                            return (
                              <button
                                key={date}
                                type="button"
                                onClick={() => setSelectedDate(date)}
                                className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-maroon bg-maroon text-white shadow-xs'
                                    : 'border-stone-200 hover:border-stone-300 bg-white text-ink'
                                }`}
                              >
                                <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                                  {dayName}
                                </div>
                                <div className="text-sm font-outfit font-extrabold mt-0.5">
                                  {dayNum}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="pt-4 flex justify-between">
                      <button
                        onClick={() => setBookingStep(1)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                      </button>

                      <button
                        onClick={() => setBookingStep(3)}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-maroon text-white font-outfit font-bold text-xs hover:bg-maroon-dark transition-colors cursor-pointer"
                      >
                        <span>Continue to Quantity</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: QUANTITY */}
                {bookingStep === 3 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-outfit font-bold text-sm text-ink">
                        Step 3: Select Pass Quantity
                      </h3>
                      <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        {currentAvailableBalance} Available in Allocation
                      </span>
                    </div>

                    <div className="p-5 rounded-2xl bg-cream-soft border border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-bold text-ink">Number of Passes</div>
                        <div className="text-xs text-stone-500">
                          Unit Price: ₹{currentPassConfig.priceInr} per pass
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          className="w-10 h-10 rounded-xl bg-white border border-stone-300 font-bold text-lg flex items-center justify-center hover:bg-stone-100 transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-outfit font-black text-2xl w-10 text-center text-maroon">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.min(10, Math.min(currentAvailableBalance, q + 1)))}
                          disabled={quantity >= currentAvailableBalance || quantity >= 10}
                          className="w-10 h-10 rounded-xl bg-white border border-stone-300 font-bold text-lg flex items-center justify-center hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white border border-stone-200 flex justify-between items-center text-sm font-bold">
                      <span className="text-stone-600">Total Price:</span>
                      <span className="text-xl font-outfit font-black text-maroon">
                        ₹{totalBookingPrice}
                      </span>
                    </div>

                    <div className="pt-4 flex justify-between">
                      <button
                        onClick={() => setBookingStep(2)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                      </button>

                      <button
                        onClick={() => {
                          if (quantity > currentAvailableBalance) {
                            setBookingError(`Quantity (${quantity}) exceeds available allocation (${currentAvailableBalance}).`);
                            return;
                          }
                          setBookingError(null);
                          setBookingStep(4);
                        }}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-maroon text-white font-outfit font-bold text-xs hover:bg-maroon-dark transition-colors cursor-pointer"
                      >
                        <span>Continue to Customer Details</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: CUSTOMER DETAILS */}
                {bookingStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="font-outfit font-bold text-sm text-ink">
                      Step 4: Customer Contact Details
                    </h3>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-ink mb-1">
                          Customer Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="e.g. Suresh Patel"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-ink mb-1">
                          Customer Mobile Number * (10 Digits)
                        </label>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          value={customerMobile}
                          onChange={(e) => setCustomerMobile(e.target.value)}
                          placeholder="e.g. 9876543210"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-ink mb-1">
                          Customer Email Address * (Mandatory for QR Ticket Delivery)
                        </label>
                        <input
                          type="email"
                          required
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="e.g. suresh@example.com"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                        />
                        <p className="text-[11px] text-stone-500 mt-1">
                          Digital QR passes will be dispatched directly to this email via Hostinger Mail Gateway.
                        </p>
                      </div>

                      <div className="pt-2 p-3 rounded-xl bg-stone-50 border border-stone-200">
                        <p className="text-xs text-stone-600">
                          By confirming this offline sale, the customer agrees to the non-refundable event terms, unique QR check-in policy, and event timings.
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-between">
                      <button
                        onClick={() => setBookingStep(3)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                      </button>

                      <button
                        onClick={() => {
                          if (!customerName.trim()) {
                            setBookingError('Customer name is required.');
                            return;
                          }
                          const cleanMobile = customerMobile.replace(/\D/g, '').slice(-10);
                          if (cleanMobile.length !== 10) {
                            setBookingError('Please enter a valid 10-digit Indian mobile number.');
                            return;
                          }
                          if (!customerEmail.trim() || !customerEmail.includes('@')) {
                            setBookingError('A valid email address is required.');
                            return;
                          }
                          setBookingError(null);
                          setBookingStep(5);
                        }}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-maroon text-white font-outfit font-bold text-xs hover:bg-maroon-dark transition-colors cursor-pointer"
                      >
                        <span>Review & Confirm Sale</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 5: REVIEW & CONFIRM */}
                {bookingStep === 5 && (
                  <div className="space-y-4">
                    <h3 className="font-outfit font-bold text-sm text-ink">
                      Step 5: Review & Confirm Direct Offline Sale
                    </h3>

                    <div className="p-5 rounded-2xl bg-cream-soft border border-stone-200 space-y-3 text-xs">
                      <div className="flex justify-between py-1 border-b border-stone-200">
                        <span className="text-stone-500">Pass Category:</span>
                        <span className="font-bold text-maroon text-sm">
                          {currentPassConfig.name}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200">
                        <span className="text-stone-500">Booking Date:</span>
                        <span className="font-bold text-ink">
                          {currentPassConfig.isSeason
                            ? 'All 9 Event Nights (Oct 11 – Oct 19, 2026)'
                            : selectedDate}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200">
                        <span className="text-stone-500">Quantity:</span>
                        <span className="font-bold text-ink">{quantity} Passes</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200">
                        <span className="text-stone-500">Total Price:</span>
                        <span className="font-black text-maroon text-base">₹{totalBookingPrice}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200">
                        <span className="text-stone-500">Customer:</span>
                        <span className="font-bold text-ink">
                          {customerName} ({customerMobile})
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200">
                        <span className="text-stone-500">Email Dispatch:</span>
                        <span className="font-bold text-ink">{customerEmail}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-stone-500">Payment Mode:</span>
                        <span className="font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          OFFLINE (Collected by Agent)
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                      <strong>Important:</strong> Clicking &quot;Confirm Offline Sale&quot; will atomically deduct <strong>{quantity} {currentPassConfig.name}</strong> passes from your allocation, issue permanent QR passes, and deliver the confirmation email to the customer.
                    </div>

                    <div className="pt-4 flex justify-between">
                      <button
                        onClick={() => setBookingStep(4)}
                        disabled={isSubmittingBooking}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-40"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                      </button>

                      <button
                        onClick={handleConfirmOfflineSale}
                        disabled={isSubmittingBooking}
                        className="flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-outfit font-black text-sm transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {isSubmittingBooking ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Processing Sale...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Confirm Offline Sale (₹{totalBookingPrice})</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ALLOCATIONS & INVENTORY */}
        {activeTab === 'allocations' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-outfit font-black text-ink">
                My Allocation Quota & Balances
              </h2>
              <p className="text-xs text-stone-500">
                Critical Rule: Allocation is strictly Agent + Pass Type + Quantity. Passes can be sold across any valid event night.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {allocations.map((alloc) => {
                const total = alloc.allocatedQuantity;
                const booked = alloc.bookedQuantity;
                const subAlloc = alloc.subAllocatedQuantity;
                const available = alloc.availableQuantity;
                const percentUsed = total > 0 ? Math.round(((booked + subAlloc) / total) * 100) : 0;

                return (
                  <div
                    key={alloc.id}
                    className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-outfit font-bold text-sm text-ink">
                          {alloc.passTypeName}
                        </h3>
                        <span className="text-[10px] font-mono text-stone-400">
                          {alloc.passType}
                        </span>
                      </div>

                      <div className="mt-4">
                        <div className="text-3xl font-outfit font-black text-maroon">
                          {available}
                        </div>
                        <div className="text-xs font-bold text-stone-500">
                          Available Passes
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-stone-100 text-xs">
                      <div className="flex justify-between text-stone-600">
                        <span>Total Allocated:</span>
                        <span className="font-bold text-ink">{total}</span>
                      </div>
                      <div className="flex justify-between text-stone-600">
                        <span>Direct Sold:</span>
                        <span className="font-bold text-emerald-700">{booked}</span>
                      </div>
                      <div className="flex justify-between text-stone-600">
                        <span>Sub-Allocated:</span>
                        <span className="font-bold text-amber-700">{subAlloc}</span>
                      </div>

                      <div className="w-full bg-stone-100 rounded-full h-1.5 mt-2">
                        <div
                          className="bg-maroon h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, percentUsed)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-right text-stone-400">
                        {percentUsed}% Utilized
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: BOOKINGS HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-outfit font-black text-ink">
                  Direct Offline Bookings History
                </h2>
                <p className="text-xs text-stone-500">
                  Transactions booked directly under your agent account.
                </p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  placeholder="Search order or customer..."
                  className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-stone-300 w-64 focus:outline-hidden focus:border-maroon"
                />
              </div>
            </div>

            {historyLoading ? (
              <div className="p-8 text-center text-xs text-stone-500">Loading bookings...</div>
            ) : bookings.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs">
                No offline bookings found matching your search.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 font-outfit font-bold text-stone-600">
                      <tr>
                        <th className="px-4 py-3">Order Number</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Pass Type</th>
                        <th className="px-4 py-3">Qty</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Passes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {bookings.map((b) => (
                        <tr key={b.id} className="hover:bg-cream-soft transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-maroon">
                            {b.orderNumber}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-ink">{b.customerName}</div>
                            <div className="text-[11px] text-stone-500">
                              {b.customerMobile} • {b.customerEmail}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-stone-700">
                            {b.ticketType}
                          </td>
                          <td className="px-4 py-3 font-bold text-ink">{b.quantity}</td>
                          <td className="px-4 py-3 font-bold text-ink">₹{b.amountInr}</td>
                          <td className="px-4 py-3 text-stone-500">
                            {new Date(b.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {b.passes?.map((p: any) => (
                                <span
                                  key={p.id}
                                  className="text-[10px] font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-700"
                                >
                                  {p.ticketNumber}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SUB-AGENTS NETWORK */}
        {activeTab === 'subagents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-outfit font-black text-ink">
                  Sub-Agents Network & Oversight
                </h2>
                <p className="text-xs text-stone-500">
                  Manage subordinate agents and sub-allocate from your available balance. Sub-agent sales are strictly tracked for oversight.
                </p>
              </div>

              <button
                onClick={() => setShowAddSubAgentModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-maroon text-white font-outfit font-bold text-xs hover:bg-maroon-dark transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Register Sub-Agent</span>
              </button>
            </div>

            {subAgentsLoading ? (
              <div className="p-8 text-center text-xs text-stone-500">Loading sub-agents...</div>
            ) : subAgents.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs">
                No direct sub-agents registered under your account yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subAgents.map((sa) => (
                  <div
                    key={sa.id}
                    className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-outfit font-bold text-base text-ink">{sa.name}</h3>
                        <p className="text-xs text-stone-500">
                          {sa.phone} • {sa.email}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          {sa.metrics?.totalAvailable || 0} Available
                        </span>
                        <div className="text-[10px] text-stone-400 mt-1">
                          {sa.ordersCount || 0} Orders Sold
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-cream-soft border border-stone-100 grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <div className="text-stone-500 text-[10px]">Allocated</div>
                        <div className="font-bold text-ink">{sa.metrics?.totalAllocated || 0}</div>
                      </div>
                      <div>
                        <div className="text-stone-500 text-[10px]">Sold</div>
                        <div className="font-bold text-emerald-700">{sa.metrics?.totalBooked || 0}</div>
                      </div>
                      <div>
                        <div className="text-stone-500 text-[10px]">Available</div>
                        <div className="font-bold text-maroon">{sa.metrics?.totalAvailable || 0}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        onClick={() => {
                          setSelectedSubAgentForAlloc(sa);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-maroon text-white text-xs font-bold font-outfit hover:bg-maroon-dark transition-colors cursor-pointer"
                      >
                        Allocate Passes
                      </button>

                      <button
                        onClick={() => {
                          setSelectedSubAgentForReclaim(sa);
                          setReclaimPassType(sa.allocations?.[0]?.passType || 'COMMERCIAL_DAILY');
                        }}
                        className="py-2 px-3 rounded-xl border border-stone-300 text-stone-700 text-xs font-bold font-outfit hover:bg-stone-100 transition-colors cursor-pointer"
                      >
                        Reclaim Passes
                      </button>

                      <button
                        onClick={() => handleOpenOversight(sa)}
                        className="py-2 px-3 rounded-xl border border-stone-300 text-ink text-xs font-bold font-outfit hover:bg-stone-100 transition-colors cursor-pointer"
                      >
                        View Oversight
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL: REGISTER SUB-AGENT */}
      {showAddSubAgentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-outfit font-black text-lg text-ink">
              Register New Sub-Agent
            </h3>
            <p className="text-xs text-stone-500">
              Create subordinate agent account under your management.
            </p>

            <form onSubmit={handleCreateSubAgent} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={subAgentForm.name}
                  onChange={(e) => setSubAgentForm({ ...subAgentForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={subAgentForm.email}
                  onChange={(e) => setSubAgentForm({ ...subAgentForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Mobile Phone (10 Digits)</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={subAgentForm.phone}
                  onChange={(e) => setSubAgentForm({ ...subAgentForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Password</label>
                <PasswordInput
                  required
                  minLength={6}
                  value={subAgentForm.password}
                  onChange={(e) => setSubAgentForm({ ...subAgentForm, password: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSubAgentModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={subAgentSubmitting}
                  className="px-5 py-2 rounded-xl bg-maroon text-white font-outfit font-bold text-xs hover:bg-maroon-dark disabled:opacity-50"
                >
                  {subAgentSubmitting ? 'Registering...' : 'Create Sub-Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUB-ALLOCATE PASSES */}
      {selectedSubAgentForAlloc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-outfit font-black text-lg text-ink">
              Sub-Allocate Passes to {selectedSubAgentForAlloc.name}
            </h3>
            <p className="text-xs text-stone-500">
              Passes will be transferred from your available inventory to this sub-agent.
            </p>

            <form onSubmit={handleSubAllocate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Pass Category</label>
                <select
                  value={allocPassType}
                  onChange={(e) => setAllocPassType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                >
                  {PASS_TYPES.map((p) => {
                    const alloc = allocations.find((a) => a.passType === p.code);
                    const avail = alloc?.availableQuantity || 0;
                    return (
                      <option key={p.code} value={p.code}>
                        {p.name} (You have {avail} available)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Quantity to Transfer</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={allocQuantity}
                  onChange={(e) => setAllocQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSubAgentForAlloc(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={allocSubmitting}
                  className="px-5 py-2 rounded-xl bg-maroon text-white font-outfit font-bold text-xs hover:bg-maroon-dark disabled:opacity-50"
                >
                  {allocSubmitting ? 'Transferring...' : 'Transfer Passes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUB-AGENT OVERSIGHT VIEW */}
      {oversightSubAgent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-outfit font-black text-lg text-ink">
                  Sub-Agent Oversight: {oversightSubAgent.name}
                </h3>
                <p className="text-xs text-stone-500">
                  Read-only audit: View inventory balances and sales activity.
                </p>
              </div>
              <button
                onClick={() => setOversightSubAgent(null)}
                className="text-stone-400 hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {oversightLoading ? (
              <div className="p-8 text-center text-xs text-stone-500">Loading oversight data...</div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Allocations Breakdown */}
                <div>
                  <h4 className="font-bold text-ink mb-2">Current Allocations</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {oversightAllocations.map((a) => (
                      <div key={a.id} className="p-3 rounded-xl bg-cream-soft border border-stone-200">
                        <div className="font-bold text-ink">{a.passTypeName || a.passType}</div>
                        <div className="text-lg font-outfit font-black text-maroon mt-1">
                          {a.availableQuantity}
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {a.bookedQuantity} sold / {a.allocatedQuantity} total
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bookings List */}
                <div>
                  <h4 className="font-bold text-ink mb-2">Recent Sales ({oversightBookings.length})</h4>
                  {oversightBookings.length === 0 ? (
                    <div className="p-4 text-center text-stone-400 bg-stone-50 rounded-xl">
                      No sales recorded by this sub-agent yet.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {oversightBookings.map((b) => (
                        <div
                          key={b.id}
                          className="p-2.5 rounded-lg bg-stone-50 flex justify-between items-center"
                        >
                          <div>
                            <span className="font-mono font-bold text-maroon">{b.orderNumber}</span>
                            <span className="ml-2 text-stone-600">{b.customerName}</span>
                          </div>
                          <div className="font-bold text-ink">
                            {b.quantity} passes • ₹{b.amountInr}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: SUB-AGENT RECLAIM */}
      {selectedSubAgentForReclaim && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-outfit font-black text-lg text-ink">
              Reclaim Unused Passes from {selectedSubAgentForReclaim.name}
            </h3>
            <p className="text-xs text-stone-500">
              Reclaim unused quota back to your available balance. Booked passes cannot be reclaimed.
            </p>

            <form onSubmit={handleReclaimFromSubAgent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">Pass Category</label>
                <select
                  value={reclaimPassType}
                  onChange={(e) => setReclaimPassType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                >
                  {PASS_TYPES.map((pt) => {
                    const alloc = selectedSubAgentForReclaim.allocations?.find((a: any) => a.passType === pt.code);
                    const avail = alloc?.availableQuantity || 0;
                    return (
                      <option key={pt.code} value={pt.code}>
                        {pt.name} ({avail} unused available)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Quantity to Reclaim</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={reclaimQuantity}
                  onChange={(e) => setReclaimQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">Reason / Notes (Optional)</label>
                <input
                  type="text"
                  value={reclaimNotes}
                  onChange={(e) => setReclaimNotes(e.target.value)}
                  placeholder="e.g. Allocation adjustment"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-maroon"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSubAgentForReclaim(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reclaimSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-700 text-white font-outfit font-bold text-xs hover:bg-amber-800 disabled:opacity-50"
                >
                  {reclaimSubmitting ? 'Reclaiming...' : 'Reclaim Passes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
