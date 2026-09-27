'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  RefreshCw,
  Ticket,
  Mail,
  Phone,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function CommercialCustomersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchApi('/admin/commercial/orders?limit=100');
      setOrders(res?.orders || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load commercial customer records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Aggregate unique customers from commercial orders
  const customersMap = new Map<string, any>();
  for (const o of orders) {
    const phone = o.customerMobile || o.customerPhone;
    const key = phone || o.customerEmail || o.customerName || `order-${o.id}`;
    if (!customersMap.has(key)) {
      customersMap.set(key, {
        name: o.customerName,
        phone: phone,
        email: o.customerEmail,
        city: o.customerCity,
        ordersCount: 0,
        totalPasses: 0,
        totalSpend: 0,
        lastOrderDate: o.createdAt,
        lastOrderId: o.id,
        lastOrderNumber: o.orderNumber,
      });
    }
    const c = customersMap.get(key);
    c.ordersCount += 1;
    const passesInOrder =
      o.passesCount ??
      o.quantity ??
      (o.attendees?.length || 0) ??
      o.items?.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0) ??
      (o.passes?.length || 0);
    c.totalPasses += passesInOrder;
    if (o.orderStatus === 'PAID' || o.status === 'PAID') {
      c.totalSpend += Number(o.amountInr ?? o.totalAmount ?? 0);
    }
  }

  const customers = Array.from(customersMap.values());
  const filteredCustomers = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-maroon" />
            <h1 className="text-2xl font-bold font-outfit text-ink">Commercial Customers & Passes</h1>
          </div>
          <p className="text-sm text-ink-soft mt-1">
            Directory of buyers, ticket recipients, and pass allocations from commercial sales.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-stone-200 text-ink hover:bg-stone-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/admin/commercial/orders"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-maroon text-white hover:bg-maroon-dark transition-colors shadow-xs"
          >
            <Ticket className="w-3.5 h-3.5" />
            View Orders
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer name, phone number, email, or city..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm text-ink placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-maroon/20 focus:border-maroon"
        />
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <span className="text-xs font-bold text-ink-soft uppercase tracking-wider">
            {filteredCustomers.length} Unique Customers
          </span>
          <span className="text-xs text-ink-soft">
            Aggregated from recent commercial orders
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50/70 border-b border-stone-100 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3 text-right">Orders</th>
                <th className="px-5 py-3 text-right">Passes</th>
                <th className="px-5 py-3 text-right">Total Paid</th>
                <th className="px-5 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-ink-soft">
                    Loading customers...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-ink-soft">
                    No commercial customers found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c, i) => (
                  <tr key={i} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-ink">{c.name || 'Anonymous Customer'}</div>
                      <div className="text-xs text-ink-soft">{c.city ? `City: ${c.city}` : 'No city provided'}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-ink">
                        <Phone className="w-3 h-3 text-stone-400" />
                        <span>{c.phone || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-ink-soft mt-0.5">
                        <Mail className="w-3 h-3 text-stone-400" />
                        <span>{c.email || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-ink">
                      {c.ordersCount}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-maroon">
                      {c.totalPasses}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-emerald-700">
                      ₹{c.totalSpend.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Link
                        href={`/admin/commercial/orders?search=${encodeURIComponent(c.phone || c.email || c.name || '')}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-maroon hover:underline"
                      >
                        Orders <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
