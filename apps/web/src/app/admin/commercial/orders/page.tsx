'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  AlertCircle,
  Filter,
  Users,
  ShoppingBag,
  TrendingUp,
  Ticket,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  UserCheck,
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Check,
  Tag,
  Shield,
  QrCode,
  DollarSign,
  Trash2,
  CheckSquare,
  Square,
  Gift,
  AlertTriangle,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { getStoredAuthUser } from '@/lib/auth-session';
import { fetchSuperAdminSettings, subscribeToSuperAdminSync } from '@/lib/super-admin-state';
import { AdminModal } from '@/components/admin/AdminModal';

interface AttendeePass {
  id: string;
  ticketNumber: string;
  status: string;
  category: string;
  bookingDays?: string[] | null;
  isCheckedIn?: boolean;
  latestCheckin?: { gateName: string; checkinTime: string } | null;
}

interface OrderRecord {
  id: string;
  orderNumber: string;
  ticketNumber?: string;
  source: 'PUBLIC' | 'AGENT' | 'FREE';
  paymentMode?: string | null;
  agentId?: string | null;
  agent?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    staffId?: string | null;
    role: string;
    isSubAgent: boolean;
    parentAgent?: { id: string; name: string } | null;
  } | null;
  customerName: string;
  customerMobile: string;
  customerEmail: string;
  ticketType: string;
  selectedDates?: string[] | null;
  quantity: number;
  amountInr: number;
  currency: string;
  orderStatus: string;
  paymentStatus: string;
  isTestPayment?: boolean;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  passesCount: number;
  attendees: AttendeePass[];
  checkedInCount?: number;
  isCheckedIn?: boolean;
  createdAt: string;
  paidAt?: string | null;
}

interface AgentGroup {
  agent: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    staffId?: string | null;
    role: string;
    isSubAgent: boolean;
    parentAgentId?: string | null;
    parentAgent?: { id: string; name: string } | null;
  };
  ordersCount: number;
  passesSold: number;
  totalSalesInr: number;
  availableAllocation: number;
  checkedInPasses: number;
}

interface OrdersSummary {
  totalOrders: number;
  totalSalesInr: number;
  totalPasses: number;
  publicOrdersCount: number;
  publicPassesCount: number;
  publicSalesInr: number;
  agentOrdersCount: number;
  agentPassesCount: number;
  agentSalesInr: number;
  freeOrdersCount: number;
  freePassesCount: number;
  freeCheckedInCount: number;
  freeAvailableCount: number;
}

function isOrderProtected(
  order: OrderRecord,
  isTestDeleteActive: boolean = false,
  isFullPowerActive: boolean = false,
): { isProtected: boolean; isTestOrder: boolean; reason?: string } {
  if (isFullPowerActive) {
    return { isProtected: false, isTestOrder: false };
  }

  const isTest = Boolean(
    order.isTestPayment ||
      order.razorpayOrderId?.startsWith('TEST_ORD_') ||
      order.razorpayPaymentId?.startsWith('TEST_PAY_'),
  );

  if (isTest && isTestDeleteActive) {
    return { isProtected: false, isTestOrder: true };
  }

  if (order.orderStatus === 'PAID') {
    return { isProtected: true, isTestOrder: isTest, reason: 'Order is fully PAID' };
  }
  if (order.paymentStatus === 'CAPTURED') {
    return { isProtected: true, isTestOrder: isTest, reason: 'Payment is CAPTURED' };
  }
  if (order.razorpayPaymentId) {
    return { isProtected: true, isTestOrder: isTest, reason: 'Razorpay payment ID exists' };
  }
  if (order.attendees && order.attendees.some((a) => a.status === 'CHECKED_IN')) {
    return { isProtected: true, isTestOrder: isTest, reason: 'Passes are already CHECKED IN' };
  }
  return { isProtected: false, isTestOrder: isTest };
}

export default function CommercialOrdersAuditPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [agentGroups, setAgentGroups] = useState<AgentGroup[]>([]);
  const [summary, setSummary] = useState<OrdersSummary>({
    totalOrders: 0,
    totalSalesInr: 0,
    totalPasses: 0,
    publicOrdersCount: 0,
    publicPassesCount: 0,
    publicSalesInr: 0,
    agentOrdersCount: 0,
    agentPassesCount: 0,
    agentSalesInr: 0,
    freeOrdersCount: 0,
    freePassesCount: 0,
    freeCheckedInCount: 0,
    freeAvailableCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Channel Tabs: ALL PASSES, ONLINE PASSES, AGENT PASSES, FREE PASSES
  const [channelTab, setChannelTab] = useState<'ALL' | 'PUBLIC' | 'AGENT' | 'FREE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [ticketTypeFilter, setTicketTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [checkinFilter, setCheckinFilter] = useState<'ALL' | 'CHECKED_IN' | 'NOT_CHECKED_IN'>('ALL');

  // Overall pass summary counters (TOTAL, WEBSITE, AGENT, EMPLOYEE, CHECKED IN, NOT CHECKED IN)
  const [passSummary, setPassSummary] = useState<{
    total: number;
    website: number;
    agent: number;
    employee: number;
    free?: number;
    admin?: number;
    checkedIn: number;
    notCheckedIn: number;
  } | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);

  // Agent Expansion state (agentId -> boolean)
  const [expandedAgentIds, setExpandedAgentIds] = useState<Record<string, boolean>>({});
  const [agentOrdersMap, setAgentOrdersMap] = useState<Record<string, OrderRecord[]>>({});
  const [agentOrdersLoading, setAgentOrdersLoading] = useState<Record<string, boolean>>({});

  // Expanded attendee passes in table (orderId -> boolean)
  const [expandedOrderPasses, setExpandedOrderPasses] = useState<Record<string, boolean>>({});

  // Order selection for Bulk Delete
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [ordersToDelete, setOrdersToDelete] = useState<OrderRecord[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Staging Test Data Delete Mode State
  const [testDataDeleteEnabled, setTestDataDeleteEnabled] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [fullPowerActive, setFullPowerActive] = useState(false);

  useEffect(() => {
    setCurrentUser(getStoredAuthUser());

    let isMounted = true;
    async function checkFullPower() {
      try {
        const state = await fetchSuperAdminSettings();
        if (isMounted) {
          setFullPowerActive(Boolean(state?.fullPowerActive));
        }
      } catch {
        if (isMounted) setFullPowerActive(false);
      }
    }
    checkFullPower();

    const unsubscribe = subscribeToSuperAdminSync((synced) => {
      if (synced) {
        setFullPowerActive(Boolean(synced.fullPowerActive));
      } else {
        checkFullPower();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const isStagingTestCleanupActive = Boolean(
    (testDataDeleteEnabled || fullPowerActive) && currentUser?.role === 'SUPER_ADMIN',
  );

  // Copied feedback
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOrderId(id);
    setTimeout(() => setCopiedOrderId(null), 1800);
  };

  interface AgentGroupWithSubs extends AgentGroup {
    subGroups: AgentGroup[];
  }

  const hierarchicalAgentGroups = useMemo<AgentGroupWithSubs[]>(() => {
    const masterMap = new Map<string, AgentGroupWithSubs>();
    const subGroups: AgentGroup[] = [];

    for (const group of agentGroups) {
      const isSub =
        group.agent.isSubAgent ||
        group.agent.role === 'COMMERCIAL_SUB_AGENT' ||
        !!group.agent.parentAgent?.id ||
        !!group.agent.parentAgentId;

      if (isSub) {
        subGroups.push(group);
      } else {
        masterMap.set(group.agent.id, { ...group, subGroups: [] });
      }
    }

    for (const sub of subGroups) {
      const parentId =
        sub.agent.parentAgent?.id || sub.agent.parentAgentId;
      if (parentId && masterMap.has(parentId)) {
        masterMap.get(parentId)!.subGroups.push(sub);
      } else {
        masterMap.set(sub.agent.id, { ...sub, subGroups: [] });
      }
    }

    return Array.from(masterMap.values());
  }, [agentGroups]);

  // Load Main Data
  const loadOrders = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      params.set('groupBy', 'agent');
      params.set('source', channelTab);

      if (ticketTypeFilter !== 'ALL') params.set('ticketType', ticketTypeFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (checkinFilter !== 'ALL') params.set('checkinStatus', checkinFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const [res, summaryData] = await Promise.all([
        fetchApi<any>(`/admin/commercial/orders?${params.toString()}`),
        fetchApi<any>('/admin/pass-summary').catch(() => null),
      ]);

      setOrders(res.orders || []);
      setTotalOrdersCount(res.total || 0);
      setTestDataDeleteEnabled(Boolean(res.testDataDeleteEnabled));
      if (res.summary) {
        setSummary({
          totalOrders: res.summary.totalOrders ?? 0,
          totalSalesInr: res.summary.totalSalesInr ?? 0,
          totalPasses: res.summary.totalPasses ?? 0,
          publicOrdersCount: res.summary.publicOrdersCount ?? 0,
          publicPassesCount: res.summary.publicPassesCount ?? 0,
          publicSalesInr: res.summary.publicSalesInr ?? 0,
          agentOrdersCount: res.summary.agentOrdersCount ?? 0,
          agentPassesCount: res.summary.agentPassesCount ?? 0,
          agentSalesInr: res.summary.agentSalesInr ?? 0,
          freeOrdersCount: res.summary.freeOrdersCount ?? 0,
          freePassesCount: res.summary.freePassesCount ?? 0,
          freeCheckedInCount: res.summary.freeCheckedInCount ?? 0,
          freeAvailableCount: res.summary.freeAvailableCount ?? 0,
        });
      }
      if (summaryData) {
        setPassSummary({
          total: summaryData.total ?? summaryData.totalPasses ?? 0,
          website: summaryData.website ?? summaryData.websitePasses ?? 0,
          agent: summaryData.agent ?? summaryData.agentPasses ?? 0,
          employee: summaryData.employee ?? summaryData.employeePasses ?? 0,
          free: summaryData.free ?? summaryData.freePasses ?? 0,
          admin: summaryData.admin ?? summaryData.adminPasses ?? 0,
          checkedIn: summaryData.checkedIn ?? summaryData.checkedInPasses ?? 0,
          notCheckedIn: summaryData.notCheckedIn ?? summaryData.notCheckedInPasses ?? 0,
        });
      }
      if (res.agentGroups) setAgentGroups(res.agentGroups);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load E-Pass orders audit.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, channelTab, ticketTypeFilter, statusFilter, checkinFilter, searchQuery]);

  useEffect(() => {
    loadOrders();
    // Clear selection on tab change
    setSelectedOrderIds(new Set());
  }, [loadOrders]);

  // Load Orders for a specific Agent
  const toggleAgentExpand = async (agentId: string) => {
    const isCurrentlyExpanded = !!expandedAgentIds[agentId];
    setExpandedAgentIds((prev) => ({ ...prev, [agentId]: !isCurrentlyExpanded }));

    if (!isCurrentlyExpanded && !agentOrdersMap[agentId]) {
      try {
        setAgentOrdersLoading((prev) => ({ ...prev, [agentId]: true }));
        const params = new URLSearchParams();
        params.set('agentId', agentId);
        params.set('source', 'AGENT');
        params.set('limit', '50');
        if (ticketTypeFilter !== 'ALL') params.set('ticketType', ticketTypeFilter);
        if (statusFilter !== 'ALL') params.set('status', statusFilter);
        if (searchQuery.trim()) params.set('search', searchQuery.trim());

        const res = await fetchApi<any>(`/admin/commercial/orders?${params.toString()}`);
        setAgentOrdersMap((prev) => ({ ...prev, [agentId]: res.orders || [] }));
        if (res.testDataDeleteEnabled !== undefined) {
          setTestDataDeleteEnabled(Boolean(res.testDataDeleteEnabled));
        }
      } catch (err: any) {
        console.error(`Failed to load orders for agent ${agentId}:`, err);
      } finally {
        setAgentOrdersLoading((prev) => ({ ...prev, [agentId]: false }));
      }
    }
  };

  const toggleOrderPasses = (orderId: string) => {
    setExpandedOrderPasses((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Selection Logic
  const handleToggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleSelectAllCurrentPage = () => {
    const currentPageOrderIds = orders.map((o) => o.id);
    const allSelected = currentPageOrderIds.every((id) => selectedOrderIds.has(id));

    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        currentPageOrderIds.forEach((id) => next.delete(id));
      } else {
        currentPageOrderIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const isAllCurrentPageSelected =
    orders.length > 0 && orders.every((o) => selectedOrderIds.has(o.id));

  // Open Delete Modal for Bulk Selection
  const handleOpenBulkDeleteModal = () => {
    if (selectedOrderIds.size === 0) return;
    // Map selected IDs to orders from either current page or agent maps
    const allOrdersPool: OrderRecord[] = [
      ...orders,
      ...Object.values(agentOrdersMap).flat(),
    ];
    const targetOrders = Array.from(selectedOrderIds).map((id) => {
      const found = allOrdersPool.find((o) => o.id === id);
      return (
        found || {
          id,
          orderNumber: `ORD-${id}`,
          source: 'PUBLIC' as const,
          customerName: 'Unknown',
          customerMobile: '',
          customerEmail: '',
          ticketType: 'COMMERCIAL_DAILY',
          quantity: 1,
          amountInr: 0,
          currency: 'INR',
          orderStatus: 'PENDING',
          paymentStatus: 'PENDING',
          passesCount: 1,
          attendees: [],
          createdAt: new Date().toISOString(),
        }
      );
    });

    setOrdersToDelete(targetOrders);
    setShowDeleteModal(true);
  };

  // Open Delete Modal for Single Order
  const handleOpenSingleDeleteModal = (order: OrderRecord) => {
    setOrdersToDelete([order]);
    setShowDeleteModal(true);
  };

  // Execute Deletion
  const handleConfirmDelete = async () => {
    if (ordersToDelete.length === 0) return;
    setIsDeleting(true);
    setActionSuccessMsg(null);
    setErrorMsg(null);

    try {
      const orderIds = ordersToDelete.map((o) => o.id);
      const res = await fetchApi<any>('/admin/commercial/orders/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ orderIds }),
      });

      setShowDeleteModal(false);
      setSelectedOrderIds(new Set());
      setOrdersToDelete([]);

      if (fullPowerActive) {
        setActionSuccessMsg(
          `Successfully deleted ${res.deletedCount || orderIds.length} order(s) under SUPER_ADMIN Full Power.`
        );
      } else {
        setActionSuccessMsg(
          res.message ||
            `Successfully processed deletion. ${res.deletedCount || 0} deleted, ${
              res.skippedProtectedCount || 0
            } protected orders preserved.`
        );
      }

      // Reload fresh data
      loadOrders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete orders.');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalPages = Math.ceil(totalOrdersCount / limit) || 1;

  // Analysis of orders to delete (for modal display)
  const deleteAnalysis = useMemo(() => {
    let safeCount = 0;
    let protectedCount = 0;
    let testCount = 0;
    const protectedReasons: string[] = [];

    ordersToDelete.forEach((ord) => {
      const check = isOrderProtected(ord, isStagingTestCleanupActive, fullPowerActive);
      if (check.isTestOrder && isStagingTestCleanupActive) {
        testCount++;
      }
      if (check.isProtected) {
        protectedCount++;
        if (check.reason && !protectedReasons.includes(check.reason)) {
          protectedReasons.push(check.reason);
        }
      } else {
        safeCount++;
      }
    });

    return {
      total: ordersToDelete.length,
      safeCount: fullPowerActive ? ordersToDelete.length : safeCount,
      protectedCount: fullPowerActive ? 0 : protectedCount,
      testCount,
      protectedReasons,
      isAllTestOrders: testCount > 0 && testCount === ordersToDelete.length,
      hasTestOrders: testCount > 0,
      isFullPower: fullPowerActive,
    };
  }, [ordersToDelete, isStagingTestCleanupActive, fullPowerActive]);

  const renderOrdersTable = (agentOrders: OrderRecord[], agentName: string) => {
    if (agentOrders.length === 0) {
      return (
        <div className="p-6 text-center bg-white rounded-xl border border-stone-200 text-xs text-stone-500">
          No orders placed by {agentName} match the current filter criteria.
        </div>
      );
    }
    return (
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF7F2] border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-3 w-8 text-center">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-3 py-3">Pass / Ticket ID</th>
                <th className="px-3 py-3">Order #</th>
                <th className="px-4 py-3">Pass Holder</th>
                <th className="px-3 py-3">Pass Type & Dates</th>
                <th className="px-3 py-3 text-center">Source</th>
                <th className="px-3 py-3">Agent</th>
                <th className="px-3 py-3 text-center">Qty</th>
                <th className="px-3 py-3 text-right">Amount</th>
                <th className="px-3 py-3">Payment</th>
                <th className="px-3 py-3">Check-in Status</th>
                <th className="px-3 py-3">Order Date</th>
                <th className="px-3 py-3 text-center">Passes</th>
                <th className="px-3 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-900">
              {agentOrders.map((ord) => {
                const showPasses = !!expandedOrderPasses[ord.id];
                const isSelected = selectedOrderIds.has(ord.id);
                const protCheck = isOrderProtected(ord, isStagingTestCleanupActive);
                const ticketId = ord.ticketNumber || (ord.attendees?.[0]?.ticketNumber) || ord.orderNumber;
                const isCheckedIn = ord.isCheckedIn || (ord.attendees || []).some(a => a.status === 'CHECKED_IN' || a.isCheckedIn);

                return (
                  <React.Fragment key={ord.id}>
                    <tr className={`transition-colors ${isSelected ? 'bg-rose-50/40' : 'hover:bg-[#FAF7F2]/40'}`}>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectOrder(ord.id)}
                          className="text-stone-400 hover:text-stone-700"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-rose-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Pass / Ticket ID */}
                      <td className="px-3 py-3 font-mono font-bold text-amber-900 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span>{ticketId}</span>
                          <button
                            onClick={() => copyToClipboard(ticketId, `tk-${ord.id}`)}
                            className="text-stone-400 hover:text-stone-700 p-0.5"
                            title="Copy Ticket ID"
                          >
                            {copiedOrderId === `tk-${ord.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Order # */}
                      <td className="px-3 py-3 font-mono text-stone-700 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className="font-semibold">{ord.orderNumber}</span>
                          <button
                            onClick={() => copyToClipboard(ord.orderNumber, ord.id)}
                            className="text-stone-400 hover:text-stone-700 p-0.5"
                            title="Copy Order Number"
                          >
                            {copiedOrderId === ord.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-bold text-stone-900">{ord.customerName}</div>
                        <div className="text-[11px] text-stone-500">
                          {ord.customerMobile} • {ord.customerEmail}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-semibold text-stone-800">
                          {ord.ticketType === 'COMMERCIAL_SEASON'
                            ? 'Season Pass (All 9 Days)'
                            : 'Daily Pass'}
                        </div>
                        {ord.selectedDates && ord.selectedDates.length > 0 && (
                          <div className="text-[10px] text-stone-500 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-stone-400 shrink-0" />
                            <span>{ord.selectedDates.join(', ')}</span>
                          </div>
                        )}
                      </td>

                      {/* Source */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          AGENT
                        </span>
                      </td>

                      {/* Agent */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="font-bold text-stone-900">{agentName}</div>
                        {ord.agent?.staffId && (
                          <div className="text-[10px] font-mono text-stone-500">ID: {ord.agent.staffId}</div>
                        )}
                      </td>

                      <td className="px-3 py-3 font-bold text-center">
                        {ord.quantity}
                      </td>

                      <td className="px-3 py-3 font-outfit font-black text-right text-stone-900">
                        ₹{ord.amountInr.toLocaleString('en-IN')}
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {ord.paymentMode || 'AGENT OFFLINE'}
                        </span>
                      </td>

                      {/* Check-in Status */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {isCheckedIn ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Checked In
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                            Not Checked In
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-stone-500 whitespace-nowrap">
                        {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleOrderPasses(ord.id)}
                          className="p-1 rounded text-stone-500 hover:text-[#7A1113] hover:bg-stone-100 transition-colors"
                          title="View Attendee Passes"
                        >
                          {showPasses ? (
                            <ChevronUp className="w-4 h-4 text-[#7A1113]" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenSingleDeleteModal(ord)}
                          className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title={
                            protCheck.isProtected
                              ? `Protected: ${protCheck.reason}`
                              : (protCheck.isTestOrder && isStagingTestCleanupActive
                                ? 'Delete Staging Test Order'
                                : 'Delete Order')
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>

                    {/* Nested Attendee Passes View */}
                    {showPasses && (
                      <tr>
                        <td colSpan={14} className="p-3 bg-stone-50 border-y border-stone-200">
                          <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                              <span className="flex items-center gap-1.5 text-[#7A1113]">
                                <Ticket className="w-3.5 h-3.5" />
                                Attendee Passes for Order #{ord.orderNumber} ({ord.attendees.length})
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {ord.attendees.map((att, idx) => (
                                <div
                                  key={att.id}
                                  className="p-2.5 rounded-lg border border-stone-200 bg-[#FAF7F2] text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono font-bold text-[#7A1113]">
                                      {att.ticketNumber}
                                    </span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-stone-200 text-stone-700">
                                      Pass #{idx + 1}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-stone-600 font-medium">
                                    Type: {att.category || 'E-Pass'}
                                  </div>
                                  <div className="text-[10px] text-stone-500">
                                    Status: <span className="font-semibold text-emerald-700">{att.status}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Compact Actions Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
            E-Pass Management
          </span>
          <span className="text-stone-300">•</span>
          <span className="text-xs font-semibold text-stone-700">
            {channelTab === 'PUBLIC' && 'Online Sales Channel'}
            {channelTab === 'AGENT' && 'Agent Distribution Channel'}
            {channelTab === 'FREE' && 'Free & Complimentary Passes'}
          </span>
          {isStagingTestCleanupActive && (
            <>
              <span className="text-stone-300">•</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-500/10 text-amber-700 border border-amber-500/20 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                STAGING TEST DATA CLEANUP ENABLED
              </span>
            </>
          )}
        </div>

        <button
          onClick={loadOrders}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200/80 bg-white text-stone-700 hover:bg-stone-50 font-semibold text-xs transition-colors shadow-2xs"
          title="Refresh Channel Data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Top 6 Compact Channel & Pass Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: TOTAL PASSES */}
        <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
            <Ticket className="w-3.5 h-3.5 text-[#7A1113]" />
            TOTAL PASSES
          </div>
          <div className="font-outfit font-black text-2xl text-stone-900 mt-2">
            {(passSummary?.total ?? summary.totalPasses).toLocaleString()}
          </div>
          <div className="text-[10px] text-stone-400 font-medium mt-0.5">All issued passes</div>
        </div>

        {/* Card 2: WEBSITE PASSES */}
        <button
          type="button"
          onClick={() => {
            setChannelTab('PUBLIC');
            setPage(1);
          }}
          className={`text-left p-3.5 rounded-2xl border transition-all shadow-xs ${
            channelTab === 'PUBLIC'
              ? 'bg-blue-50/60 border-blue-400 ring-2 ring-blue-400/20'
              : 'bg-white border-stone-200/80 hover:border-blue-200'
          }`}
        >
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
            WEBSITE
          </div>
          <div className="font-outfit font-black text-2xl text-blue-950 mt-2">
            {(passSummary?.website ?? summary.publicPassesCount).toLocaleString()}
          </div>
          <div className="text-[10px] text-blue-700/80 font-medium mt-0.5">
            ₹{summary.publicSalesInr.toLocaleString('en-IN')} online
          </div>
        </button>

        {/* Card 3: AGENT PASSES */}
        <button
          type="button"
          onClick={() => {
            setChannelTab('AGENT');
            setPage(1);
          }}
          className={`text-left p-3.5 rounded-2xl border transition-all shadow-xs ${
            channelTab === 'AGENT'
              ? 'bg-amber-50/60 border-amber-400 ring-2 ring-amber-400/20'
              : 'bg-white border-stone-200/80 hover:border-amber-200'
          }`}
        >
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-600" />
            AGENT
          </div>
          <div className="font-outfit font-black text-2xl text-amber-950 mt-2">
            {(passSummary?.agent ?? summary.agentPassesCount).toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-700/80 font-medium mt-0.5">
            ₹{summary.agentSalesInr.toLocaleString('en-IN')} agent
          </div>
        </button>

        {/* Card 4: EMPLOYEE PASSES */}
        <Link
          href="/admin/employees"
          className="bg-white p-3.5 rounded-2xl border border-stone-200/80 hover:border-purple-300 hover:bg-purple-50/20 transition-all shadow-xs block"
        >
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-purple-600" />
              EMPLOYEE
            </span>
            <span className="text-[9px] font-bold text-purple-600 underline">View</span>
          </div>
          <div className="font-outfit font-black text-2xl text-purple-950 mt-2">
            {(passSummary?.employee ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-purple-700/80 font-medium mt-0.5">ONGC Staff & Family</div>
        </Link>

        {/* Card 5: CHECKED IN */}
        <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            CHECKED IN
          </div>
          <div className="font-outfit font-black text-2xl text-emerald-950 mt-2">
            {(passSummary?.checkedIn ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-700/80 font-medium mt-0.5">Scanned at gates</div>
        </div>

        {/* Card 6: NOT CHECKED IN */}
        <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-xs">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-stone-500" />
            NOT CHECKED IN
          </div>
          <div className="font-outfit font-black text-2xl text-stone-900 mt-2">
            {(passSummary?.notCheckedIn ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-stone-500 font-medium mt-0.5">Pending check-in</div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {actionSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-stone-400 hover:text-stone-700 p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-stone-400 hover:text-stone-700 p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Channel Tabs & Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          {/* Segmented Channel Tabs */}
          <div className="flex items-center p-1 bg-stone-100 rounded-xl text-xs font-bold self-start overflow-x-auto max-w-full">
            <button
              onClick={() => {
                setChannelTab('ALL');
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
                channelTab === 'ALL'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              ALL PASSES ({passSummary?.total ?? summary.totalPasses})
            </button>
            <button
              onClick={() => {
                setChannelTab('PUBLIC');
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
                channelTab === 'PUBLIC'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              ONLINE PASSES ({summary.publicPassesCount} Tickets)
            </button>
            <button
              onClick={() => {
                setChannelTab('AGENT');
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
                channelTab === 'AGENT'
                  ? 'bg-white text-amber-800 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              AGENT PASSES ({summary.agentPassesCount} Tickets)
            </button>
            <button
              onClick={() => {
                setChannelTab('FREE');
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
                channelTab === 'FREE'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              FREE PASSES ({summary.freePassesCount} Tickets)
            </button>
          </div>

          {/* Records Counter or Selected Actions */}
          <div className="flex items-center gap-3">
            {selectedOrderIds.size > 0 ? (
              <div className="flex items-center gap-2.5 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                <span className="text-xs font-bold text-rose-800">
                  {selectedOrderIds.size} selected
                </span>
                <button
                  type="button"
                  onClick={handleOpenBulkDeleteModal}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrderIds(new Set())}
                  className="text-xs text-rose-700 hover:underline font-semibold"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="text-xs text-stone-500 font-medium">
                {channelTab === 'AGENT'
                  ? `${hierarchicalAgentGroups.length} Active Agent Groups`
                  : channelTab === 'FREE' && orders.length > 0 && orders[0]?.orderNumber?.startsWith('FREE-')
                  ? `Showing ${orders.length} of ${totalOrdersCount} complimentary passes`
                  : `Showing ${orders.length} of ${totalOrdersCount} orders`}
              </div>
            )}
          </div>
        </div>

        {/* Search & Filter Dropdowns */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder={
                channelTab === 'AGENT'
                  ? 'Search agent by name, phone, or customer order under agent...'
                  : channelTab === 'FREE'
                  ? 'Search by ticket number, recipient name, mobile, or email...'
                  : 'Search by ticket number, order number, customer name, mobile, or agent...'
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
            {channelTab !== 'FREE' && (
              <>
                <select
                  value={ticketTypeFilter}
                  onChange={(e) => {
                    setTicketTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 bg-white focus:outline-none focus:border-[#7A1113]"
                >
                  <option value="ALL">All Pass Types</option>
                  <option value="COMMERCIAL_DAILY">Daily Pass</option>
                  <option value="COMMERCIAL_SEASON">Season Pass</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 bg-white focus:outline-none focus:border-[#7A1113]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PAID">Paid / Confirmed</option>
                  <option value="PENDING">Pending</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="FAILED">Failed</option>
                </select>

                <select
                  value={checkinFilter}
                  onChange={(e) => {
                    setCheckinFilter(e.target.value as any);
                    setPage(1);
                  }}
                  className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 bg-white focus:outline-none focus:border-[#7A1113]"
                >
                  <option value="ALL">All Check-in Status</option>
                  <option value="CHECKED_IN">Checked In</option>
                  <option value="NOT_CHECKED_IN">Not Checked In</option>
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 1: AGENT PASSES (Expandable Agent Groups) */}
      {channelTab === 'AGENT' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-xs text-stone-500 bg-white rounded-2xl border border-stone-200">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#7A1113] mb-2" />
              <span>Loading agent pass groups...</span>
            </div>
          ) : hierarchicalAgentGroups.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs">
              <Users className="w-10 h-10 text-stone-300 mx-auto mb-2" />
              <p className="font-semibold text-stone-700">No agent orders or sales found</p>
              <p className="text-stone-400 mt-1">
                {searchQuery
                  ? 'No agents or orders match the search criteria.'
                  : 'No E-Pass agents have placed offline orders yet.'}
              </p>
            </div>
          ) : (
            hierarchicalAgentGroups.map((group) => {
              const { agent, subGroups } = group;
              const isExpanded = !!expandedAgentIds[agent.id];
              const isLoadingOrders = !!agentOrdersLoading[agent.id];
              const agentOrders = agentOrdersMap[agent.id] || [];

              const initials = (agent.name || 'AG')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <div
                  key={agent.id}
                  className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden transition-all"
                >
                  {/* Master Agent Group Card Header */}
                  <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#FAF7F2]/50 border-b border-stone-100">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[#7A1113] text-white font-outfit font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                        {initials}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-outfit font-bold text-base text-stone-900 truncate">
                            {agent.name}
                          </h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#7A1113]/10 text-[#7A1113] border border-[#7A1113]/20">
                            Master Agent
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 mt-1">
                          <span>{agent.email}</span>
                          {agent.phone && <span>• {agent.phone}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Master Agent Metrics & Expand Action */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 pt-2 lg:pt-0 border-t lg:border-t-0 border-stone-200/60">
                      <div className="grid grid-cols-5 gap-3 text-center sm:text-right">
                        <div>
                          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                            Orders
                          </div>
                          <div className="font-outfit font-black text-sm text-stone-800">
                            {group.ordersCount}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                            Tickets Sold
                          </div>
                          <div className="font-outfit font-black text-sm text-amber-700">
                            {group.passesSold}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                            Total Sales
                          </div>
                          <div className="font-outfit font-black text-sm text-emerald-600">
                            ₹{group.totalSalesInr.toLocaleString('en-IN')}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                            Quota Left
                          </div>
                          <div className="font-outfit font-black text-sm text-stone-700">
                            {group.availableAllocation}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                            Checked In
                          </div>
                          <div className="font-outfit font-black text-sm text-blue-600">
                            {group.checkedInPasses}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleAgentExpand(agent.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs transition-all shadow-xs shrink-0 ${
                          isExpanded
                            ? 'bg-[#7A1113] text-white hover:bg-[#8F1417]'
                            : 'bg-white text-stone-700 border border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <span>{isExpanded ? 'Hide Orders' : 'View Orders'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Master Agent Direct Orders */}
                  {isExpanded && (
                    <div className="p-4 bg-stone-50/70 border-b border-stone-100 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-stone-600">
                        Direct Orders Placed by {agent.name}
                      </div>
                      {isLoadingOrders ? (
                        <div className="p-6 text-center text-xs text-stone-500">
                          <RefreshCw className="w-4 h-4 animate-spin mx-auto text-[#7A1113] mb-1" />
                          <span>Fetching orders placed by {agent.name}...</span>
                        </div>
                      ) : (
                        renderOrdersTable(agentOrders, agent.name)
                      )}
                    </div>
                  )}

                  {/* Nested Sub-Agents Section */}
                  {subGroups && subGroups.length > 0 && (
                    <div className="p-4 sm:p-5 bg-amber-50/20 border-t border-stone-100 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-2">
                        <Users className="w-4 h-4 text-amber-700" />
                        <span>Sub-Agents Assigned ({subGroups.length})</span>
                      </div>

                      <div className="space-y-3 pl-2 sm:pl-3 border-l-2 border-amber-300">
                        {subGroups.map((subGroup) => {
                          const subAgent = subGroup.agent;
                          const isSubExpanded = !!expandedAgentIds[subAgent.id];
                          const isSubLoading = !!agentOrdersLoading[subAgent.id];
                          const subOrders = agentOrdersMap[subAgent.id] || [];

                          return (
                            <div
                              key={subAgent.id}
                              className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden"
                            >
                              <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-outfit font-bold text-sm text-stone-900">
                                      {subAgent.name}
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                      Sub-Agent
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-stone-500 mt-0.5 flex flex-wrap gap-x-2">
                                    <span>{subAgent.email}</span>
                                    {subAgent.phone && <span>• {subAgent.phone}</span>}
                                  </div>
                                </div>

                                <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 text-right">
                                  <div className="grid grid-cols-5 gap-3 text-center sm:text-right">
                                    <div>
                                      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                        Orders
                                      </div>
                                      <div className="font-outfit font-black text-xs text-stone-800">
                                        {subGroup.ordersCount}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                        Tickets Sold
                                      </div>
                                      <div className="font-outfit font-black text-xs text-amber-700">
                                        {subGroup.passesSold}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                        Total Sales
                                      </div>
                                      <div className="font-outfit font-black text-xs text-emerald-600">
                                        ₹{subGroup.totalSalesInr.toLocaleString('en-IN')}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                        Quota Left
                                      </div>
                                      <div className="font-outfit font-black text-xs text-stone-700">
                                        {subGroup.availableAllocation}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                        Checked In
                                      </div>
                                      <div className="font-outfit font-black text-xs text-blue-600">
                                        {subGroup.checkedInPasses}
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => toggleAgentExpand(subAgent.id)}
                                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-xs transition-all shadow-xs shrink-0 ${
                                      isSubExpanded
                                        ? 'bg-[#7A1113] text-white hover:bg-[#8F1417]'
                                        : 'bg-white text-stone-700 border border-stone-200 hover:border-stone-300'
                                    }`}
                                  >
                                    <span>{isSubExpanded ? 'Hide Orders' : 'View Orders'}</span>
                                    {isSubExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Sub-Agent Orders */}
                              {isSubExpanded && (
                                <div className="p-3.5 bg-stone-50 border-t border-stone-100">
                                  {isSubLoading ? (
                                    <div className="p-4 text-center text-xs text-stone-500">
                                      <RefreshCw className="w-4 h-4 animate-spin mx-auto text-[#7A1113] mb-1" />
                                      <span>Fetching orders placed by {subAgent.name}...</span>
                                    </div>
                                  ) : (
                                    renderOrdersTable(subOrders, subAgent.name)
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SECTION 2: E-PASS REGISTRY TABLE (ALL & ONLINE CHANNELS) */}
      {(channelTab === 'ALL' || channelTab === 'PUBLIC') && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[1300px]">
              <thead className="bg-[#FAF7F2] border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3 py-3.5 w-8 text-center">
                    <button
                      type="button"
                      onClick={handleSelectAllCurrentPage}
                      className="text-stone-400 hover:text-stone-700"
                      title="Select all on this page"
                    >
                      {isAllCurrentPageSelected ? (
                        <CheckSquare className="w-4 h-4 text-rose-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3.5">Pass / Ticket ID</th>
                  <th className="px-3 py-3.5">Order #</th>
                  <th className="px-4 py-3.5">Pass Holder</th>
                  <th className="px-4 py-3.5">Contact</th>
                  <th className="px-3 py-3.5">Pass Type</th>
                  <th className="px-3 py-3.5 text-center">Source</th>
                  <th className="px-3 py-3.5">Agent</th>
                  <th className="px-3 py-3.5 text-center">Qty</th>
                  <th className="px-3 py-3.5 text-right">Amount</th>
                  <th className="px-3 py-3.5">Payment</th>
                  <th className="px-3 py-3.5">Pass Status</th>
                  <th className="px-3 py-3.5">Valid Dates</th>
                  <th className="px-3 py-3.5">Check-in Status</th>
                  <th className="px-3 py-3.5">Created At</th>
                  <th className="px-3 py-3.5 text-center">Passes</th>
                  <th className="px-3 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-900">
                {loading ? (
                  <tr>
                    <td colSpan={17} className="px-4 py-12 text-center text-stone-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#7A1113] mb-2" />
                      <span>Loading passes and orders...</span>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="px-4 py-12 text-center text-stone-400">
                      <CreditCard className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                      <p className="font-semibold text-stone-600">
                        {channelTab === 'ALL'
                          ? 'No pass orders found matching current filter criteria.'
                          : 'No Online Public orders found.'}
                      </p>
                      <p className="text-stone-400 text-xs mt-1">
                        Try adjusting your search query or filter settings.
                      </p>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const showPasses = !!expandedOrderPasses[order.id];
                    const isSelected = selectedOrderIds.has(order.id);
                    const protCheck = isOrderProtected(order, isStagingTestCleanupActive);
                    const ticketId = order.ticketNumber || (order.attendees?.[0]?.ticketNumber) || order.orderNumber;
                    const isOrderCheckedIn = order.isCheckedIn || (order.attendees || []).some(a => a.status === 'CHECKED_IN' || a.isCheckedIn);

                    return (
                      <React.Fragment key={order.id}>
                        <tr className={`transition-colors ${isSelected ? 'bg-rose-50/40' : 'hover:bg-[#FAF7F2]/40'}`}>
                          {/* Row Select Checkbox */}
                          <td className="px-3 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSelectOrder(order.id)}
                              className="text-stone-400 hover:text-stone-700"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-rose-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          {/* Pass / Ticket ID */}
                          <td className="px-3 py-3.5 font-mono font-bold text-[#7A1113] whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span>{ticketId}</span>
                              <button
                                onClick={() => copyToClipboard(ticketId, `tk-${order.id}`)}
                                className="text-stone-400 hover:text-stone-700 p-0.5"
                                title="Copy Ticket ID"
                              >
                                {copiedOrderId === `tk-${order.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Order Number */}
                          <td className="px-3 py-3.5 font-mono text-stone-700 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span className="font-semibold">{order.orderNumber}</span>
                              <button
                                onClick={() => copyToClipboard(order.orderNumber, order.id)}
                                className="text-stone-400 hover:text-stone-700 p-0.5"
                                title="Copy Order Number"
                              >
                                {copiedOrderId === order.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Pass Holder */}
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-stone-900">{order.customerName}</div>
                          </td>

                          {/* Contact */}
                          <td className="px-4 py-3.5">
                            <div className="font-medium text-stone-800">{order.customerMobile}</div>
                            <div className="text-[11px] text-stone-500 truncate max-w-[160px]">{order.customerEmail}</div>
                          </td>

                          {/* Pass Type */}
                          <td className="px-3 py-3.5">
                            <div className="font-semibold text-stone-800">
                              {order.ticketType === 'COMMERCIAL_SEASON'
                                ? 'Season Pass'
                                : order.ticketType === 'FREE_PASS'
                                ? 'Free Pass'
                                : 'Daily Pass'}
                            </div>
                          </td>

                          {/* Source Badge */}
                          <td className="px-3 py-3.5 text-center whitespace-nowrap">
                            {order.source === 'PUBLIC' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                WEBSITE
                              </span>
                            ) : order.source === 'AGENT' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                AGENT
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                FREE
                              </span>
                            )}
                          </td>

                          {/* Agent */}
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            {order.agent ? (
                              <div>
                                <div className="font-bold text-stone-900">{order.agent.name}</div>
                                {order.agent.staffId && (
                                  <div className="text-[10px] font-mono text-stone-500">ID: {order.agent.staffId}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-stone-400">—</span>
                            )}
                          </td>

                          {/* Qty */}
                          <td className="px-3 py-3.5 font-bold text-center">{order.quantity}</td>

                          {/* Amount */}
                          <td className="px-3 py-3.5 font-outfit font-black text-right text-stone-900 whitespace-nowrap">
                            ₹{order.amountInr.toLocaleString('en-IN')}
                          </td>

                          {/* Payment */}
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            {order.isTestPayment ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                TEST PAID
                              </span>
                            ) : order.paymentStatus === 'CAPTURED' || order.orderStatus === 'PAID' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                PAID
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                {order.paymentStatus || order.orderStatus}
                              </span>
                            )}
                          </td>

                          {/* Pass Status */}
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                              {order.orderStatus || 'ACTIVE'}
                            </span>
                          </td>

                          {/* Valid Dates */}
                          <td className="px-3 py-3.5 text-stone-600 whitespace-nowrap text-[11px]">
                            {order.selectedDates && order.selectedDates.length > 0 ? (
                              <span title={order.selectedDates.join(', ')}>
                                {order.selectedDates.length === 9 ? 'All 9 Days' : `${order.selectedDates.length} Days Selected`}
                              </span>
                            ) : (
                              'All 9 Days'
                            )}
                          </td>

                          {/* Check-in Status */}
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            {isOrderCheckedIn ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Checked In
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                                Not Checked In
                              </span>
                            )}
                          </td>

                          {/* Created At Date */}
                          <td className="px-3 py-3.5 text-stone-500 whitespace-nowrap">
                            {new Date(order.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          {/* Attendee Passes Drilldown Toggle */}
                          <td className="px-3 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => toggleOrderPasses(order.id)}
                              className="p-1 rounded text-stone-500 hover:text-[#7A1113] hover:bg-stone-100 transition-colors"
                              title="Toggle Passes List"
                            >
                              {showPasses ? (
                                <ChevronUp className="w-4 h-4 text-[#7A1113]" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          {/* Action (Delete) */}
                          <td className="px-3 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenSingleDeleteModal(order)}
                              className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title={
                                protCheck.isProtected
                                  ? `Protected: ${protCheck.reason}`
                                  : (protCheck.isTestOrder && isStagingTestCleanupActive
                                    ? 'Delete Staging Test Order'
                                    : 'Delete Order')
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>

                        {/* Nested Passes Row */}
                        {showPasses && (
                          <tr>
                            <td colSpan={17} className="p-3 bg-stone-50 border-y border-stone-200">
                              <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                                  <span className="flex items-center gap-1.5 text-[#7A1113]">
                                    <Ticket className="w-3.5 h-3.5" />
                                    Attendee Passes for Order #{order.orderNumber} ({order.attendees.length})
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {order.attendees.map((att, idx) => (
                                    <div
                                      key={att.id}
                                      className="p-2.5 rounded-lg border border-stone-200 bg-[#FAF7F2] text-xs space-y-1"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-mono font-bold text-[#7A1113]">
                                          {att.ticketNumber}
                                        </span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-stone-200 text-stone-700">
                                          Pass #{idx + 1}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-stone-600 font-medium">
                                        Type: {att.category || 'E-Pass'}
                                      </div>
                                      <div className="text-[10px] text-stone-500 flex items-center justify-between">
                                        <span>Status: <strong className="text-stone-700">{att.status}</strong></span>
                                        {att.isCheckedIn || att.status === 'CHECKED_IN' ? (
                                          <span className="text-emerald-700 font-bold">Checked In</span>
                                        ) : (
                                          <span className="text-stone-400">Not Checked In</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          <div className="p-4 border-t border-stone-200 flex items-center justify-between bg-stone-50 text-xs">
            <span className="text-stone-500">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalOrdersCount} Total Orders)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white font-semibold text-stone-700 disabled:opacity-40 hover:bg-stone-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white font-semibold text-stone-700 disabled:opacity-40 hover:bg-stone-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: FREE PASSES DEDICATED SECTION */}
      {channelTab === 'FREE' && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-stone-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
              <span>Loading free passes registry...</span>
            </div>
          ) : orders.length === 0 && summary.freePassesCount === 0 ? (
            /* EXACT REQUIRED EMPTY STATE */
            <div className="p-16 text-center text-stone-500 max-w-md mx-auto space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs border border-emerald-100">
                <Gift className="w-7 h-7" />
              </div>
              <h3 className="font-outfit font-bold text-base text-stone-800">
                No free passes issued yet.
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Free passes and complimentary entries will appear here once allocated or registered by authorized administrators.
              </p>
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF7F2] border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-3.5 w-8 text-center">
                        <button
                          type="button"
                          onClick={handleSelectAllCurrentPage}
                          className="text-stone-400 hover:text-stone-700"
                        >
                          {isAllCurrentPageSelected ? (
                            <CheckSquare className="w-4 h-4 text-rose-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3.5">Ticket / Identifier</th>
                      <th className="px-4 py-3.5">Recipient Details</th>
                      <th className="px-4 py-3.5">Pass Category</th>
                      <th className="px-4 py-3.5 text-center">Qty</th>
                      <th className="px-4 py-3.5">Check-in Status</th>
                      <th className="px-4 py-3.5">Issued At</th>
                      <th className="px-4 py-3.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-900">
                    {orders.map((ord) => {
                      const isSelected = selectedOrderIds.has(ord.id);
                      const protCheck = isOrderProtected(ord, isStagingTestCleanupActive);

                      return (
                        <tr
                          key={ord.id}
                          className={`transition-colors ${isSelected ? 'bg-rose-50/40' : 'hover:bg-[#FAF7F2]/40'}`}
                        >
                          <td className="px-3 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSelectOrder(ord.id)}
                              className="text-stone-400 hover:text-stone-700"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-rose-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          <td className="px-4 py-3.5 font-mono font-bold text-emerald-800 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{ord.orderNumber}</span>
                              <button
                                onClick={() => copyToClipboard(ord.orderNumber, ord.id)}
                                className="text-stone-400 hover:text-stone-700 p-0.5"
                                title="Copy Identifier"
                              >
                                {copiedOrderId === ord.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="font-bold text-stone-900">{ord.customerName}</div>
                            <div className="text-[11px] text-stone-500">
                              {ord.customerMobile} {ord.customerEmail && `• ${ord.customerEmail}`}
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {ord.ticketType || 'FREE COMPLIMENTARY'}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 font-bold text-center">{ord.quantity || 1}</td>

                          <td className="px-4 py-3.5">
                            {ord.orderStatus === 'CHECKED_IN' ||
                            (ord.attendees && ord.attendees.some((a) => a.status === 'CHECKED_IN')) ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                CHECKED IN
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                AVAILABLE / UNUSED
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-stone-500 whitespace-nowrap">
                            {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenSingleDeleteModal(ord)}
                              className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title={
                                protCheck.isProtected
                                  ? `Protected: ${protCheck.reason}`
                                  : (protCheck.isTestOrder && isStagingTestCleanupActive
                                    ? 'Delete Staging Test Order'
                                    : 'Delete Free Pass')
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-stone-200 flex items-center justify-between bg-stone-50 text-xs">
                <span className="text-stone-500">
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalOrdersCount} Total Records)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white font-semibold text-stone-700 disabled:opacity-40 hover:bg-stone-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white font-semibold text-stone-700 disabled:opacity-40 hover:bg-stone-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL (AdminModal portal eliminates top white line) */}
      <AdminModal
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
        title={fullPowerActive ? '⚡ Full Power Order Deletion' : 'Confirm Order Deletion'}
        subtitle={
          fullPowerActive
            ? 'SUPER_ADMIN Full Power is active. All safeguards are bypassed.'
            : 'Verify order dependency safety before proceeding.'
        }
        icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
        maxWidth="md"
        showCloseButton={!isDeleting}
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2 text-xs">
            <div className="flex justify-between items-center text-stone-600">
              <span>Total Selected for Deletion:</span>
              <span className="font-bold font-mono text-stone-900">{deleteAnalysis.total}</span>
            </div>
            <div className="flex justify-between items-center text-rose-700">
              <span className="font-semibold">{fullPowerActive ? 'Will Permanently Delete:' : 'Safe to Delete:'}</span>
              <span className="font-bold font-mono text-rose-900">{deleteAnalysis.safeCount}</span>
            </div>
            <div className="flex justify-between items-center text-stone-500">
              <span className="font-medium">{fullPowerActive ? 'Protected Records:' : 'Protected (Cannot be deleted):'}</span>
              <span className="font-bold font-mono text-stone-700">{deleteAnalysis.protectedCount}</span>
            </div>
          </div>

          {/* Full Power Special Notice */}
          {fullPowerActive ? (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs space-y-1">
              <div className="font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 text-rose-800">
                <Zap className="w-3.5 h-3.5 text-rose-600 fill-rose-600 shrink-0" />
                <span>SUPER_ADMIN FULL POWER IS ACTIVE:</span>
              </div>
              <p className="text-[11px] text-rose-900 leading-relaxed font-medium">
                Deletion protections are bypassed for this operation. All {deleteAnalysis.total} selected order(s) will be permanently and irreversibly purged from the database, including attendee passes, daily check-in records, scan logs, payment webhooks, and agent allocations. This action is permanent and cannot be undone.
              </p>
            </div>
          ) : (
            <>
              {/* Staging Test Order Special Notice */}
              {isStagingTestCleanupActive && deleteAnalysis.hasTestOrders && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-600 text-white">
                      {deleteAnalysis.testCount === 1 ? 'STAGING TEST ORDER' : 'STAGING TEST ORDERS'}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    {deleteAnalysis.testCount === 1
                      ? 'This order is marked as a staging test transaction and can be permanently deleted by SUPER_ADMIN.'
                      : `${deleteAnalysis.testCount} selected order(s) are marked as staging test transactions and can be permanently deleted by SUPER_ADMIN.`}
                  </p>
                </div>
              )}

              {deleteAnalysis.protectedCount > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-700" />
                    <span>Protected orders will not be deleted</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {deleteAnalysis.protectedCount} order(s) are locked because they have captured payments, confirmed paid status, or active check-ins. The system will preserve them automatically.
                  </p>
                </div>
              )}
            </>
          )}

          {deleteAnalysis.safeCount === 0 ? (
            <div className="p-3 rounded-xl bg-stone-100 text-stone-600 text-xs text-center font-medium">
              None of the selected orders can be deleted because all are protected.
            </div>
          ) : (
            <p className="text-xs text-stone-600 leading-relaxed">
              Proceeding will permanently remove{' '}
              <strong className="text-stone-900 font-bold">{deleteAnalysis.safeCount}</strong>{' '}
              {fullPowerActive ? 'order(s) under Full Power mode' : deleteAnalysis.isAllTestOrders ? 'test order(s)' : 'unfulfilled/pending order(s)'}. This action cannot be reversed.
            </p>
          )}

          {/* Modal Actions */}
          <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting || deleteAnalysis.safeCount === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 disabled:opacity-40 transition-colors shadow-xs"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {fullPowerActive
                      ? `⚡ Permanently Delete ${deleteAnalysis.total} Order(s)`
                      : deleteAnalysis.isAllTestOrders
                      ? (deleteAnalysis.testCount === 1 ? 'Delete Test Order' : `Delete ${deleteAnalysis.testCount} Test Orders`)
                      : (deleteAnalysis.safeCount === 1 ? 'Delete 1 Order' : `Delete ${deleteAnalysis.safeCount} Orders`)}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
