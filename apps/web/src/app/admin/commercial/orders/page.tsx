'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  Search,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Filter,
  Users,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function CommercialOrdersAuditPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'PUBLIC' | 'AGENT'>('ALL');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchApi(`/admin/commercial/orders?page=${page}&limit=${limit}`);
      setOrders(res.orders || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load commercial orders audit.');
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = orders.filter((o) => {
    if (sourceFilter === 'ALL') return true;
    return (o.source || 'PUBLIC') === sourceFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-outfit font-black text-ink">
            Commercial Orders & Transactions Audit
          </h2>
          <p className="text-xs text-stone-500">
            Audit public checkout transactions (Razorpay / Test) and direct offline agent sales.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setSourceFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                sourceFilter === 'ALL' ? 'bg-white text-ink shadow-xs' : 'text-stone-500'
              }`}
            >
              All Channels
            </button>
            <button
              onClick={() => setSourceFilter('PUBLIC')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                sourceFilter === 'PUBLIC' ? 'bg-white text-ink shadow-xs' : 'text-stone-500'
              }`}
            >
              Online Public
            </button>
            <button
              onClick={() => setSourceFilter('AGENT')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                sourceFilter === 'AGENT' ? 'bg-white text-ink shadow-xs' : 'text-stone-500'
              }`}
            >
              Agent Offline
            </button>
          </div>

          <button
            onClick={() => loadOrders()}
            className="p-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Orders Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-stone-500">Loading orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs">
          No commercial orders found.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 font-outfit font-bold text-stone-600">
                <tr>
                  <th className="px-4 py-3">Order Number</th>
                  <th className="px-4 py-3">Channel / Source</th>
                  <th className="px-4 py-3">Customer Info</th>
                  <th className="px-4 py-3">Pass Type</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-cream-soft transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-maroon">
                      {o.orderNumber}
                    </td>

                    <td className="px-4 py-3">
                      {o.source === 'AGENT' ? (
                        <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                          AGENT OFFLINE
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold bg-blue-100 text-blue-900 px-2 py-0.5 rounded border border-blue-200">
                          PUBLIC ONLINE
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-bold text-ink">{o.customerName}</div>
                      <div className="text-[11px] text-stone-500">
                        {o.customerMobile} • {o.customerEmail}
                      </div>
                    </td>

                    <td className="px-4 py-3 font-semibold text-stone-700">
                      {o.ticketType}
                    </td>

                    <td className="px-4 py-3 font-bold text-ink">{o.quantity}</td>

                    <td className="px-4 py-3 font-outfit font-black text-ink">
                      ₹{o.amountInr}
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        {o.paymentStatus}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-stone-500">
                      {new Date(o.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
