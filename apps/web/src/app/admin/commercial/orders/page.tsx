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
  source: 'PUBLIC' | 'AGENT';
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
  agentOrdersCount: number;
}

export default function CommercialOrdersAuditPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [agentGroups, setAgentGroups] = useState<AgentGroup[]>([]);
  const [summary, setSummary] = useState<OrdersSummary>({
    totalOrders: 0,
    totalSalesInr: 0,
    totalPasses: 0,
    publicOrdersCount: 0,
    agentOrdersCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tabs & Filters
  const [channelTab, setChannelTab] = useState<'ALL' | 'PUBLIC' | 'AGENT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [ticketTypeFilter, setTicketTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);

  // Agent Expansion state (agentId -> boolean)
  const [expandedAgentIds, setExpandedAgentIds] = useState<Record<string, boolean>>({});
  // Agent Orders cache (agentId -> OrderRecord[])
  const [agentOrdersMap, setAgentOrdersMap] = useState<Record<string, OrderRecord[]>>({});
  const [agentOrdersLoading, setAgentOrdersLoading] = useState<Record<string, boolean>>({});

  // Expanded attendee passes in table (orderId -> boolean)
  const [expandedOrderPasses, setExpandedOrderPasses] = useState<Record<string, boolean>>({});

  // Copied feedback
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOrderId(id);
    setTimeout(() => setCopiedOrderId(null), 1800);
  };

  // Load Main Data
  const loadOrders = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      params.set('groupBy', 'agent');

      if (channelTab === 'PUBLIC') params.set('source', 'PUBLIC');
      if (channelTab === 'AGENT') params.set('source', 'AGENT');

      if (ticketTypeFilter !== 'ALL') params.set('ticketType', ticketTypeFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetchApi<any>(`/admin/commercial/orders?${params.toString()}`);
      setOrders(res.orders || []);
      setTotalOrdersCount(res.total || 0);
      if (res.summary) setSummary(res.summary);
      if (res.agentGroups) setAgentGroups(res.agentGroups);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load E-Pass orders audit.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, channelTab, ticketTypeFilter, statusFilter, searchQuery]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Load Orders for a specific Agent
  const toggleAgentExpand = async (agentId: string) => {
    const isCurrentlyExpanded = !!expandedAgentIds[agentId];
    setExpandedAgentIds((prev) => ({ ...prev, [agentId]: !isCurrentlyExpanded }));

    // If opening and not yet loaded, fetch orders for this agent
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

  // Toggle order passes expansion
  const toggleOrderPasses = (orderId: string) => {
    setExpandedOrderPasses((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const totalPages = Math.ceil(totalOrdersCount / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200/70 shadow-sm">
        <div>
          <h2 className="text-xl font-outfit font-black text-[#7A1113] flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-amber-500" />
            <span>E-Pass Orders & Transactions Audit</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Authoritative financial audit of Online Public checkout bookings and Offline Agent transactions.
          </p>
        </div>

        <button
          onClick={loadOrders}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 font-semibold text-xs transition-colors self-start md:self-auto"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Top Authoritative Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Orders */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200/70 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-[#7A1113]" />
          </div>
          <div className="font-outfit font-black text-2xl text-stone-900">
            {summary.totalOrders.toLocaleString()}
          </div>
          <div className="text-[11px] text-stone-400">All channels combined</div>
        </div>

        {/* Total Sales */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200/70 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-outfit font-black text-2xl text-emerald-600">
            ₹{summary.totalSalesInr.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-700/80 font-medium">Authoritative paid sales</div>
        </div>

        {/* Total Passes */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200/70 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Passes Sold</span>
            <Ticket className="w-4 h-4 text-amber-500" />
          </div>
          <div className="font-outfit font-black text-2xl text-stone-900">
            {summary.totalPasses.toLocaleString()}
          </div>
          <div className="text-[11px] text-stone-400">Daily & Season entries</div>
        </div>

        {/* Public Orders */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200/70 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Public Online</span>
            <CreditCard className="w-4 h-4 text-blue-500" />
          </div>
          <div className="font-outfit font-black text-2xl text-blue-600">
            {summary.publicOrdersCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-stone-400">Online checkout gateway</div>
        </div>

        {/* Agent Orders */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200/70 shadow-sm space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Agent Orders</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-outfit font-black text-2xl text-amber-600">
            {summary.agentOrdersCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-stone-400">Direct agent offline desk</div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-stone-400 hover:text-stone-700">
            ✕
          </button>
        </div>
      )}

      {/* Channel Tabs & Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/70 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          {/* Segmented Channel Tabs */}
          <div className="flex items-center p-1 bg-stone-100 rounded-xl text-xs font-bold self-start">
            <button
              onClick={() => {
                setChannelTab('ALL');
                setPage(1);
              }}
              className={`px-4 py-1.5 rounded-lg transition-all ${
                channelTab === 'ALL'
                  ? 'bg-white text-[#7A1113] shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All Orders ({summary.totalOrders})
            </button>
            <button
              onClick={() => {
                setChannelTab('PUBLIC');
                setPage(1);
              }}
              className={`px-4 py-1.5 rounded-lg transition-all ${
                channelTab === 'PUBLIC'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Online Public ({summary.publicOrdersCount})
            </button>
            <button
              onClick={() => {
                setChannelTab('AGENT');
                setPage(1);
              }}
              className={`px-4 py-1.5 rounded-lg transition-all ${
                channelTab === 'AGENT'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Agent Orders ({summary.agentOrdersCount})
            </button>
          </div>

          <div className="text-xs text-stone-500 font-medium">
            {channelTab === 'AGENT'
              ? `${agentGroups.length} Active Agent Sales Accounts`
              : `Showing ${orders.length} of ${totalOrdersCount} records`}
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
                  ? 'Search agent by name, staff ID, phone, or customer order under agent...'
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
            {/* Ticket Type Filter */}
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

            {/* Status Filter */}
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
          </div>
        </div>
      </div>

      {/* VIEW 1: AGENT-WISE GROUPED VIEW (When [Agent Orders] Tab is Selected) */}
      {channelTab === 'AGENT' ? (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-xs text-stone-500 bg-white rounded-2xl border border-stone-200">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#7A1113] mb-2" />
              <span>Loading agent sales groups...</span>
            </div>
          ) : agentGroups.length === 0 ? (
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
            agentGroups.map((group) => {
              const { agent } = group;
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
                  {/* Agent Group Card Header */}
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
                          {agent.isSubAgent ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              Sub-Agent
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#7A1113]/10 text-[#7A1113] border border-[#7A1113]/20">
                              Master Agent
                            </span>
                          )}
                          {agent.staffId && (
                            <span className="font-mono text-xs font-bold text-[#7A1113] bg-white px-2 py-0.5 rounded border border-stone-200">
                              {agent.staffId}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 mt-1">
                          <span>{agent.email}</span>
                          {agent.phone && <span>• {agent.phone}</span>}
                          {agent.isSubAgent && agent.parentAgent && (
                            <span className="text-amber-800 font-medium">
                              • Parent: <strong className="font-bold">{agent.parentAgent.name}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Agent Metrics & Expand Action */}
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
                            Passes Sold
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

                  {/* Expanded Agent Orders Drill-Down */}
                  {isExpanded && (
                    <div className="p-4 bg-stone-50/70 border-t border-stone-100 space-y-3">
                      {isLoadingOrders ? (
                        <div className="p-6 text-center text-xs text-stone-500">
                          <RefreshCw className="w-4 h-4 animate-spin mx-auto text-[#7A1113] mb-1" />
                          <span>Fetching orders placed by {agent.name}...</span>
                        </div>
                      ) : agentOrders.length === 0 ? (
                        <div className="p-6 text-center bg-white rounded-xl border border-stone-200 text-xs text-stone-500">
                          No orders placed by this agent match the current filter criteria.
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-[#FAF7F2] border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                                <tr>
                                  <th className="px-4 py-3">Order Number</th>
                                  <th className="px-4 py-3">Customer Details</th>
                                  <th className="px-4 py-3">Pass Type & Dates</th>
                                  <th className="px-4 py-3 text-center">Qty</th>
                                  <th className="px-4 py-3 text-right">Amount</th>
                                  <th className="px-4 py-3">Payment Mode</th>
                                  <th className="px-4 py-3">Order Date</th>
                                  <th className="px-4 py-3 text-center">Passes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100 text-stone-900">
                                {agentOrders.map((ord) => {
                                  const showPasses = !!expandedOrderPasses[ord.id];

                                  return (
                                    <React.Fragment key={ord.id}>
                                      <tr className="hover:bg-[#FAF7F2]/40 transition-colors">
                                        <td className="px-4 py-3">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-mono font-bold text-[#7A1113]">
                                              {ord.orderNumber}
                                            </span>
                                            <button
                                              onClick={() =>
                                                copyToClipboard(ord.orderNumber, ord.id)
                                              }
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
                                          <div className="font-bold text-stone-900">
                                            {ord.customerName}
                                          </div>
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
                                      </tr>

                                      {/* Nested Attendee Passes View */}
                                      {showPasses && (
                                        <tr>
                                          <td colSpan={8} className="p-3 bg-stone-50 border-y border-stone-200">
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
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* VIEW 2: FLAT / FILTERED ORDERS TABLE (For [All Orders] and [Online Public]) */
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF7F2] border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3.5">Order Number</th>
                  <th className="px-4 py-3.5">Channel / Context</th>
                  <th className="px-4 py-3.5">Customer Information</th>
                  <th className="px-4 py-3.5">Pass Details</th>
                  <th className="px-4 py-3.5 text-center">Qty</th>
                  <th className="px-4 py-3.5 text-right">Amount (₹)</th>
                  <th className="px-4 py-3.5">Payment</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5 text-center">Passes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-900">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-stone-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#7A1113] mb-2" />
                      <span>Loading orders...</span>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-stone-400">
                      <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                      <p className="font-semibold text-stone-600">No E-Pass orders found.</p>
                      <p className="text-stone-400 text-xs mt-1">
                        Try adjusting your search query or filter settings.
                      </p>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const showPasses = !!expandedOrderPasses[order.id];

                    return (
                      <React.Fragment key={order.id}>
                        <tr className="hover:bg-[#FAF7F2]/40 transition-colors">
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

                          {/* Channel / Context */}
                          <td className="px-4 py-3.5">
                            {order.source === 'AGENT' ? (
                              <div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200">
                                  AGENT OFFLINE
                                </span>
                                {order.agent && (
                                  <div className="text-[11px] font-bold text-stone-800 mt-0.5">
                                    {order.agent.name}{' '}
                                    <span className="font-mono text-stone-400 font-normal">
                                      ({order.agent.staffId || 'ID'})
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-900 border border-blue-200">
                                ONLINE PUBLIC
                              </span>
                            )}
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
                              {order.ticketType === 'COMMERCIAL_SEASON'
                                ? 'Season Pass'
                                : 'Daily Pass'}
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
                        </tr>

                        {/* Nested Passes Row */}
                        {showPasses && (
                          <tr>
                            <td colSpan={9} className="p-3 bg-stone-50 border-y border-stone-200">
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
    </div>
  );
}
