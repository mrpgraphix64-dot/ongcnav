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
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface AttendeePass {
  id: string;
  ticketNumber: string;
  status: string;
  category: string;
  bookingDays?: string[] | null;
}

interface OrderRecord {
  id: string;
  orderNumber: string;
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

function isOrderProtected(order: OrderRecord): { isProtected: boolean; reason?: string } {
  if (order.orderStatus === 'PAID') {
    return { isProtected: true, reason: 'Order is fully PAID' };
  }
  if (order.paymentStatus === 'CAPTURED') {
    return { isProtected: true, reason: 'Payment is CAPTURED' };
  }
  if (order.razorpayPaymentId) {
    return { isProtected: true, reason: 'Razorpay payment ID exists' };
  }
  if (order.attendees && order.attendees.some((a) => a.status === 'CHECKED_IN')) {
    return { isProtected: true, reason: 'Passes are already CHECKED IN' };
  }
  return { isProtected: false };
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

  // Channel Tabs: ONLINE PASSES, AGENT PASSES, FREE PASSES
  const [channelTab, setChannelTab] = useState<'PUBLIC' | 'AGENT' | 'FREE'>('PUBLIC');
  const [searchQuery, setSearchQuery] = useState('');
  const [ticketTypeFilter, setTicketTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

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
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetchApi<any>(`/admin/commercial/orders?${params.toString()}`);
      setOrders(res.orders || []);
      setTotalOrdersCount(res.total || 0);
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
      if (res.agentGroups) setAgentGroups(res.agentGroups);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load E-Pass orders audit.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, channelTab, ticketTypeFilter, statusFilter, searchQuery]);

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

      setActionSuccessMsg(
        res.message ||
          `Successfully processed deletion. ${res.deletedCount || 0} deleted, ${
            res.skippedProtectedCount || 0
          } protected orders preserved.`
      );

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
    const protectedReasons: string[] = [];

    ordersToDelete.forEach((ord) => {
      const check = isOrderProtected(ord);
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
      safeCount,
      protectedCount,
      protectedReasons,
    };
  }, [ordersToDelete]);

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
                <th className="px-4 py-3">Order Number</th>
                <th className="px-4 py-3">Customer Details</th>
                <th className="px-4 py-3">Pass Type & Dates</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Payment Mode</th>
                <th className="px-4 py-3">Order Date</th>
                <th className="px-4 py-3 text-center">Passes</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-900">
              {agentOrders.map((ord) => {
                const showPasses = !!expandedOrderPasses[ord.id];
                const isSelected = selectedOrderIds.has(ord.id);
                const protCheck = isOrderProtected(ord);

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

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#7A1113]">
                            {ord.orderNumber}
                          </span>
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

                      <td className="px-4 py-3">
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

                      <td className="px-4 py-3 font-bold text-center">
                        {ord.quantity}
                      </td>

                      <td className="px-4 py-3 font-outfit font-black text-right text-stone-900">
                        ₹{ord.amountInr.toLocaleString('en-IN')}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {ord.paymentMode || 'AGENT OFFLINE'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                        {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="px-4 py-3 text-center">
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

                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenSingleDeleteModal(ord)}
                          className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title={protCheck.isProtected ? `Protected: ${protCheck.reason}` : 'Delete Order'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>

                    {/* Nested Attendee Passes View */}
                    {showPasses && (
                      <tr>
                        <td colSpan={10} className="p-3 bg-stone-50 border-y border-stone-200">
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
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
            E-Pass Management
          </span>
          <span className="text-stone-300">•</span>
          <span className="text-xs font-semibold text-stone-700">
            {channelTab === 'PUBLIC' && 'Online Sales Channel'}
            {channelTab === 'AGENT' && 'Agent Distribution Channel'}
            {channelTab === 'FREE' && 'Free & Complimentary Passes'}
          </span>
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

      {/* Top 3 Compact Channel Summary Cards (Clicking activates section/filter) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Card 1: ONLINE PASSES */}
        <button
          type="button"
          onClick={() => {
            setChannelTab('PUBLIC');
            setPage(1);
          }}
          className={`text-left p-4 rounded-2xl border transition-all shadow-xs flex flex-col justify-between ${
            channelTab === 'PUBLIC'
              ? 'bg-blue-50/60 border-blue-400 ring-2 ring-blue-400/20'
              : 'bg-white border-stone-200/80 hover:border-blue-200 hover:bg-blue-50/20'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-blue-600" />
              ONLINE PASSES ({summary.publicPassesCount} Tickets)
            </span>
            {channelTab === 'PUBLIC' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                Active
              </span>
            )}
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <div className="font-outfit font-black text-2xl text-blue-950">
                {summary.publicOrdersCount.toLocaleString()}
              </div>
              <div className="text-[11px] text-blue-700/80 font-medium">Orders Placed</div>
            </div>
            <div className="text-right">
              <div className="font-outfit font-extrabold text-base text-blue-900">
                ₹{summary.publicSalesInr.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-blue-700/80 font-medium">
                {summary.publicPassesCount.toLocaleString()} tickets sold
              </div>
            </div>
          </div>
        </button>

        {/* Card 2: AGENT PASSES */}
        <button
          type="button"
          onClick={() => {
            setChannelTab('AGENT');
            setPage(1);
          }}
          className={`text-left p-4 rounded-2xl border transition-all shadow-xs flex flex-col justify-between ${
            channelTab === 'AGENT'
              ? 'bg-amber-50/60 border-amber-400 ring-2 ring-amber-400/20'
              : 'bg-white border-stone-200/80 hover:border-amber-200 hover:bg-amber-50/20'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-600" />
              AGENT PASSES ({summary.agentPassesCount} Tickets)
            </span>
            {channelTab === 'AGENT' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-600 text-white">
                Active
              </span>
            )}
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <div className="font-outfit font-black text-2xl text-amber-950">
                {summary.agentOrdersCount.toLocaleString()}
              </div>
              <div className="text-[11px] text-amber-700/80 font-medium">Orders Placed</div>
            </div>
            <div className="text-right">
              <div className="font-outfit font-extrabold text-base text-amber-900">
                ₹{summary.agentSalesInr.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-amber-700/80 font-medium">
                {summary.agentPassesCount.toLocaleString()} tickets sold
              </div>
            </div>
          </div>
        </button>

        {/* Card 3: FREE PASSES */}
        <button
          type="button"
          onClick={() => {
            setChannelTab('FREE');
            setPage(1);
          }}
          className={`text-left p-4 rounded-2xl border transition-all shadow-xs flex flex-col justify-between ${
            channelTab === 'FREE'
              ? 'bg-emerald-50/60 border-emerald-400 ring-2 ring-emerald-400/20'
              : 'bg-white border-stone-200/80 hover:border-emerald-200 hover:bg-emerald-50/20'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-emerald-600" />
              FREE PASSES ({summary.freePassesCount} Tickets)
            </span>
            {channelTab === 'FREE' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                Active
              </span>
            )}
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <div className="font-outfit font-black text-2xl text-emerald-950">
                {summary.freePassesCount.toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-700/80 font-medium">Total Issued</div>
            </div>
            <div className="text-right">
              <div className="font-outfit font-extrabold text-base text-emerald-900">
                {summary.freeCheckedInCount.toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-700/80 font-medium">
                Checked In • {summary.freeAvailableCount.toLocaleString()} unused
              </div>
            </div>
          </div>
        </button>
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
          {/* Segmented Channel Tabs with EXACT Labels */}
          <div className="flex items-center p-1 bg-stone-100 rounded-xl text-xs font-bold self-start">
            <button
              onClick={() => {
                setChannelTab('PUBLIC');
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg transition-all ${
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
              className={`px-4 py-2 rounded-lg transition-all ${
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
              className={`px-4 py-2 rounded-lg transition-all ${
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
                  : `Showing ${orders.length} of ${totalOrdersCount} records`}
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
                  : 'Search by order number, customer name, mobile, or email...'
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-[#7A1113] focus:ring-1 focus:ring-[#7A1113]"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
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

      {/* SECTION 2: ONLINE PASSES TABLE */}
      {channelTab === 'PUBLIC' && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
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
                  <th className="px-4 py-3.5">Order Number</th>
                  <th className="px-4 py-3.5">Customer Information</th>
                  <th className="px-4 py-3.5">Pass Details</th>
                  <th className="px-4 py-3.5 text-center">Qty</th>
                  <th className="px-4 py-3.5 text-right">Amount (₹)</th>
                  <th className="px-4 py-3.5">Payment</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5 text-center">Passes</th>
                  <th className="px-4 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-900">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-stone-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#7A1113] mb-2" />
                      <span>Loading online passes...</span>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-stone-400">
                      <CreditCard className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                      <p className="font-semibold text-stone-600">No Online Public orders found.</p>
                      <p className="text-stone-400 text-xs mt-1">
                        Try adjusting your search query or filter settings.
                      </p>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const showPasses = !!expandedOrderPasses[order.id];
                    const isSelected = selectedOrderIds.has(order.id);
                    const protCheck = isOrderProtected(order);

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

                          {/* Order Number */}
                          <td className="px-4 py-3.5 font-mono font-bold text-[#7A1113] whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{order.orderNumber}</span>
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

                          {/* Customer */}
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-stone-900">{order.customerName}</div>
                            <div className="text-[11px] text-stone-500">
                              {order.customerMobile} • {order.customerEmail}
                            </div>
                          </td>

                          {/* Pass Type & Dates */}
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-stone-800">
                              {order.ticketType === 'COMMERCIAL_SEASON' ? 'Season Pass' : 'Daily Pass'}
                            </div>
                            {order.selectedDates && order.selectedDates.length > 0 && (
                              <div className="text-[10px] text-stone-400 mt-0.5 truncate max-w-xs">
                                {order.selectedDates.join(', ')}
                              </div>
                            )}
                          </td>

                          {/* Qty */}
                          <td className="px-4 py-3.5 font-bold text-center">{order.quantity}</td>

                          {/* Amount */}
                          <td className="px-4 py-3.5 font-outfit font-black text-right text-stone-900">
                            ₹{order.amountInr.toLocaleString('en-IN')}
                          </td>

                          {/* Payment */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
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

                          {/* Date */}
                          <td className="px-4 py-3.5 text-stone-500 whitespace-nowrap">
                            {new Date(order.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          {/* Attendee Passes Drilldown Toggle */}
                          <td className="px-4 py-3.5 text-center">
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
                          <td className="px-4 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenSingleDeleteModal(order)}
                              className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title={protCheck.isProtected ? `Protected: ${protCheck.reason}` : 'Delete Order'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>

                        {/* Nested Passes Row */}
                        {showPasses && (
                          <tr>
                            <td colSpan={10} className="p-3 bg-stone-50 border-y border-stone-200">
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
                      const protCheck = isOrderProtected(ord);

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
                              title={protCheck.isProtected ? `Protected: ${protCheck.reason}` : 'Delete Free Pass'}
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

      {/* DELETE CONFIRMATION MODAL (NO window.confirm()) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-stone-100 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-outfit font-bold text-base text-stone-900">
                  Confirm Order Deletion
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Verify order dependency safety before proceeding.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2 text-xs">
                <div className="flex justify-between items-center text-stone-600">
                  <span>Total Selected for Deletion:</span>
                  <span className="font-bold font-mono text-stone-900">{deleteAnalysis.total}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-700">
                  <span className="font-semibold">Safe to Delete:</span>
                  <span className="font-bold font-mono">{deleteAnalysis.safeCount}</span>
                </div>
                <div className="flex justify-between items-center text-rose-700">
                  <span className="font-semibold">Protected (Cannot be deleted):</span>
                  <span className="font-bold font-mono">{deleteAnalysis.protectedCount}</span>
                </div>
              </div>

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

              {deleteAnalysis.safeCount === 0 ? (
                <div className="p-3 rounded-xl bg-stone-100 text-stone-600 text-xs text-center font-medium">
                  None of the selected orders can be deleted because all are protected.
                </div>
              ) : (
                <p className="text-xs text-stone-600 leading-relaxed">
                  Proceeding will permanently remove{' '}
                  <strong className="text-stone-900 font-bold">{deleteAnalysis.safeCount}</strong> unfulfilled/pending order(s). This action cannot be reversed.
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#FAF7F2] border-t border-stone-100 flex items-center justify-end gap-2.5">
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
                      {deleteAnalysis.safeCount === 1
                        ? 'Delete 1 Order'
                        : `Delete ${deleteAnalysis.safeCount} Orders`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
