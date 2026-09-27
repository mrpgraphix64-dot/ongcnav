'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Download,
  RefreshCw,
  TrendingUp,
  Ticket,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function CommercialReportsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchApi('/admin/commercial/orders?limit=1');
      setSummary({
        totalRevenue: res?.summary?.totalSalesInr ?? 0,
        totalPassesIssued: res?.summary?.totalPasses ?? 0,
        paidOrdersCount: res?.summary?.totalOrders ?? res?.total ?? 0,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load commercial report summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportOrdersCsv = async () => {
    try {
      setExporting(true);
      setError(null);
      const res = await fetchApi('/admin/commercial/orders?limit=1000');
      const orders = res?.orders || [];
      const headers = ['Order Number', 'Date', 'Customer Name', 'Mobile', 'Email', 'Source', 'Ticket Type', 'Quantity', 'Amount (INR)', 'Status'];
      const rows = orders.map((o: any) => [
        `"${o.orderNumber || ''}"`,
        `"${o.createdAt || ''}"`,
        `"${(o.customerName || '').replace(/"/g, '""')}"`,
        `"${o.customerMobile || o.customerPhone || ''}"`,
        `"${(o.customerEmail || '').replace(/"/g, '""')}"`,
        `"${o.source || ''}"`,
        `"${o.ticketType || ''}"`,
        o.quantity ?? o.passesCount ?? 1,
        o.amountInr ?? 0,
        `"${o.orderStatus || o.status || ''}"`,
      ]);
      const csvContent = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `commercial_orders_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Failed to export commercial orders CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-maroon" />
            <h1 className="text-2xl font-bold font-outfit text-ink">Commercial E-Pass Reports</h1>
          </div>
          <p className="text-sm text-ink-soft mt-1">
            Revenue audits, pass issuance breakdowns, and operational admissions reporting.
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
          <button
            onClick={handleExportOrdersCsv}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-maroon text-white hover:bg-maroon-dark transition-colors shadow-xs disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {exporting ? 'Exporting...' : 'Export Orders CSV'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
          <div className="text-xs font-bold text-ink-soft uppercase tracking-wider">Gross Commercial Sales</div>
          <div className="text-2xl font-black font-outfit text-emerald-700 mt-2">
            ₹{loading ? '...' : (summary?.totalRevenue ?? 0).toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-ink-soft mt-1">From captured Razorpay & agent offline sales</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
          <div className="text-xs font-bold text-ink-soft uppercase tracking-wider">Total Passes Issued</div>
          <div className="text-2xl font-black font-outfit text-ink mt-2">
            {loading ? '...' : (summary?.totalPassesIssued ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-ink-soft mt-1">Tickets generated with valid QR codes</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
          <div className="text-xs font-bold text-ink-soft uppercase tracking-wider">Paid Commercial Orders</div>
          <div className="text-2xl font-black font-outfit text-ink mt-2">
            {loading ? '...' : (summary?.paidOrdersCount ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-ink-soft mt-1">Fulfilled order transactions</div>
        </div>
      </div>

      {/* Available Downloads & Audits */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs p-6 space-y-4">
        <h2 className="text-base font-bold text-ink font-outfit">Official Commercial Data Exports</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-stone-200/80 hover:border-maroon/40 transition-colors flex items-center justify-between">
            <div>
              <div className="font-semibold text-ink text-sm">Commercial Orders Export</div>
              <div className="text-xs text-ink-soft">Full order roster with payment IDs and customer data</div>
            </div>
            <Link
              href="/admin/commercial/orders"
              className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-maroon hover:text-white text-xs font-bold text-ink transition-colors"
            >
              Go to Orders
            </Link>
          </div>

          <div className="p-4 rounded-xl border border-stone-200/80 hover:border-maroon/40 transition-colors flex items-center justify-between">
            <div>
              <div className="font-semibold text-ink text-sm">Agent Allocation Summary</div>
              <div className="text-xs text-ink-soft">Inventory quotas, sold passes, and sub-agent balances</div>
            </div>
            <Link
              href="/admin/commercial/allocations"
              className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-maroon hover:text-white text-xs font-bold text-ink transition-colors"
            >
              Go to Allocations
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
