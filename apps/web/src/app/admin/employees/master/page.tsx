'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Database,
  UploadCloud,
  FileSpreadsheet,
  Download,
  Search,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  ArrowRight,
  Check,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import AdminModal from '@/components/admin/AdminModal';
import { normalizeCpf } from '@ongc/shared-types';

interface MasterRecord {
  id: string;
  cpfNo: string;
  mobileNo: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ValidationRowPreview {
  row: number;
  cpfNo: string;
  mobileNo: string | null;
  status: 'VALID' | 'INVALID' | 'DUPLICATE' | 'CONFLICT' | 'IDENTICAL';
  mobileState?: 'VALID' | 'MISSING' | 'INVALID';
  reason?: string;
}

interface ValidationResponse {
  success: boolean;
  fileName: string;
  totalRows: number;
  sourceRows: number;
  validCount: number;
  newCount: number;
  identicalCount: number;
  conflictCount: number;
  missingMobileCount: number;
  invalidCpfCount: number;
  invalidMobileCount: number;
  duplicateCount: number;
  blankRowCount: number;
  invalidCount: number;
  currentDatabaseCount: number;
  rows: ValidationRowPreview[];
}

export default function OngcEmployeeMasterPage() {
  const [records, setRecords] = useState<MasterRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal & Upload States
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'ADD_UPDATE' | 'REPLACE'>('ADD_UPDATE');
  const [uploadStep, setUploadStep] = useState<'SELECT' | 'VALIDATING' | 'PREVIEW' | 'IMPORTING'>('SELECT');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationPreview, setValidationPreview] = useState<ValidationResponse | null>(null);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [resolveConflicts, setResolveConflicts] = useState<'SKIP' | 'OVERWRITE'>('SKIP');
  const [dragging, setDragging] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Master Directory
  const loadMasterRecords = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const q = searchQuery.trim();
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (q) params.set('search', q);

      const res = await fetchApi<{
        records: MasterRecord[];
        total: number;
        page: number;
        totalPages: number;
        limit: number;
        lastUpdated: string | null;
      }>(`/admin/employees/master?${params.toString()}`);

      setRecords(res.records || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
      setLastUpdated(res.lastUpdated || null);
    } catch (err: any) {
      setActionError(err.message || 'Failed to load ONGC employee master records.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery]);

  useEffect(() => {
    loadMasterRecords();
  }, [loadMasterRecords]);

  // Open Modal with specific mode
  const openImportModal = (mode: 'ADD_UPDATE' | 'REPLACE') => {
    setModalMode(mode);
    setUploadStep('SELECT');
    setSelectedFile(null);
    setValidationPreview(null);
    setReplaceConfirmed(false);
    setResolveConflicts('SKIP');
    setActionError(null);
    setModalOpen(true);
  };

  // Close Modal
  const closeImportModal = () => {
    setModalOpen(false);
    setSelectedFile(null);
    setValidationPreview(null);
    setReplaceConfirmed(false);
    setUploadStep('SELECT');
  };

  // Handle file selection and initiate validation
  const handleFileChosen = async (file: File) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls') && !lowerName.endsWith('.txt')) {
      setActionError('Unsupported file type. Please upload a .csv, .xlsx, or .xls file.');
      return;
    }

    setSelectedFile(file);
    setUploadStep('VALIDATING');
    setActionError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const uploadRes = await fetch(`${API_BASE}/admin/employees/master/validate`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => null);
        throw new Error(errorData?.message || 'File validation failed.');
      }

      const preview = (await uploadRes.json()) as ValidationResponse;
      setValidationPreview(preview);
      setUploadStep('PREVIEW');
    } catch (err: any) {
      setActionError(err.message || 'Failed to validate uploaded file.');
      setUploadStep('SELECT');
    }
  };

  // Execute Confirmation of Import
  const handleConfirmImport = async () => {
    if (!validationPreview || !validationPreview.rows) return;

    // Filter only valid/importable rows
    const importableRows = validationPreview.rows
      .filter((r) => r.status === 'VALID' || r.status === 'CONFLICT' || r.status === 'IDENTICAL')
      .map((r) => ({
        cpfNo: r.cpfNo,
        mobileNo: r.mobileNo,
      }));

    if (importableRows.length === 0) {
      setActionError('No valid rows available to import.');
      return;
    }

    if (modalMode === 'REPLACE' && !replaceConfirmed) {
      setActionError('Please confirm the replacement warning before proceeding.');
      return;
    }

    setUploadStep('IMPORTING');
    setActionError(null);

    try {
      const res = await fetchApi<{
        success: boolean;
        message: string;
        added?: number;
        unchanged?: number;
        conflicts?: number;
        updated?: number;
        totalReplaced?: number;
      }>('/admin/employees/master/import', {
        method: 'POST',
        body: JSON.stringify({
          mode: modalMode,
          rows: importableRows,
          confirmReplace: modalMode === 'REPLACE' ? replaceConfirmed : undefined,
          resolveConflicts: modalMode === 'ADD_UPDATE' ? resolveConflicts : undefined,
        }),
      });

      setActionSuccess(res.message || 'Master data operation completed successfully.');
      closeImportModal();
      loadMasterRecords();
    } catch (err: any) {
      setActionError(err.message || 'Import execution failed.');
      setUploadStep('PREVIEW');
    }
  };

  // Export to CSV
  const handleExport = async () => {
    setExporting(true);
    setActionError(null);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_BASE}/admin/employees/master/export`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to download master data export.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.download = `ongc_employee_master_export_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setActionSuccess('Master verification data exported successfully.');
    } catch (err: any) {
      setActionError(err.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const formatTimestamp = (iso?: string | null) => {
    if (!iso) return 'Never';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-3 2xl:space-y-4">
      {/* ACTION ERROR BANNER */}
      {actionError && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-stone-400 hover:text-stone-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ACTION SUCCESS BANNER */}
      {actionSuccess && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-stone-400 hover:text-stone-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. COMPACT TOP HEADER & STATS BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 2xl:p-4 rounded-2xl border border-stone-200/80 shadow-2xs">
        {/* LEFT: Title & Subtitle */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-maroon animate-pulse" />
            <span className="text-[10px] font-extrabold text-maroon uppercase tracking-wider">
              Official Verification Database
            </span>
          </div>
          <h1 className="font-outfit font-black text-lg sm:text-xl text-ink tracking-tight uppercase">
            ONGC Employee Master
          </h1>
          <p className="text-[11px] sm:text-xs text-ink-soft">
            Official CPF No. and Mobile No. verification records for public employee registration.
          </p>
        </div>

        {/* RIGHT: Compact Horizontal KPIs (Target 55–65px, number right-aligned) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="bg-stone-50 border border-stone-200/90 rounded-xl px-3.5 py-2 flex items-center justify-between gap-4 min-w-[150px] min-h-[55px]">
            <span className="text-[11px] font-extrabold text-stone-500 uppercase tracking-wider">
              Total Records
            </span>
            <span className="font-outfit font-black text-xl text-ink leading-none text-right">
              {total.toLocaleString()}
            </span>
          </div>

          <div className="bg-stone-50 border border-stone-200/90 rounded-xl px-3.5 py-2 flex items-center justify-between gap-4 min-w-[170px] min-h-[55px]">
            <span className="text-[11px] font-extrabold text-stone-500 uppercase tracking-wider">
              Last Updated
            </span>
            <span className="font-outfit font-bold text-xs text-ink-soft leading-tight text-right">
              {formatTimestamp(lastUpdated)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. COMPACT TOOLBAR ROW */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white p-2.5 2xl:p-3 rounded-2xl border border-stone-200/80 shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by CPF No. or Mobile No..."
            className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-maroon bg-stone-50/50 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action Buttons (Compact, 30-34px height) */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => loadMasterRecords()}
            className="p-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer"
            title="Refresh directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => openImportModal('ADD_UPDATE')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-maroon text-white hover:bg-maroon-dark transition-colors shadow-2xs cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5 text-gold-light" />
            <span>IMPORT DATA</span>
          </button>

          <button
            onClick={() => openImportModal('ADD_UPDATE')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-100 text-ink hover:bg-stone-200 border border-stone-200 transition-colors shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-maroon" />
            <span>UPDATE / ADD DATA</span>
          </button>

          <button
            onClick={() => openImportModal('REPLACE')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 transition-colors shadow-2xs cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>REPLACE MASTER DATA</span>
          </button>

          <button
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>{exporting ? 'EXPORTING...' : 'EXPORT'}</span>
          </button>
        </div>
      </div>

      {/* 3. MASTER RECORDS TABLE OR EMPTY STATE */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
        {loading && records.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-7 h-7 text-maroon animate-spin mb-2" />
            <p className="text-xs text-stone-500 font-medium">Loading official verification records...</p>
          </div>
        ) : records.length === 0 ? (
          /* EMPTY STATE (Section 16) */
          <div className="py-16 px-4 text-center max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-maroon-soft text-maroon flex items-center justify-center mx-auto border border-maroon/20">
              <Database className="w-6 h-6" />
            </div>
            <h2 className="font-outfit font-bold text-base text-ink">ONGC EMPLOYEE MASTER</h2>
            <p className="text-xs text-ink-soft leading-relaxed">
              No official employee verification records have been uploaded yet. Upload the official CPF No. and Mobile No. master file to enable employee registration verification.
            </p>
            <button
              onClick={() => openImportModal('ADD_UPDATE')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-maroon text-white hover:bg-maroon-dark transition-colors shadow-sm cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-gold-light" />
              <span>IMPORT DATA</span>
            </button>
          </div>
        ) : (
          /* TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-200 text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                  <th className="py-2.5 px-4 w-16">#</th>
                  <th className="py-2.5 px-4">CPF NO</th>
                  <th className="py-2.5 px-4">Mobile No</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Added On</th>
                  <th className="py-2.5 px-4">Updated On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {records.map((r, idx) => {
                  const hasMobile = Boolean(r.mobileNo && r.mobileNo.trim() !== '');
                  return (
                    <tr key={r.id || r.cpfNo} className="hover:bg-cream-soft/40 transition-colors">
                      <td className="py-2.5 px-4 text-stone-400 font-mono text-[11px]">
                        {(page - 1) * limit + idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-maroon text-sm">
                        {normalizeCpf(r.cpfNo) || r.cpfNo}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-ink text-sm">
                        {hasMobile ? (
                          r.mobileNo
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            MOBILE NO. MISSING
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {hasMobile ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            NO MOBILE
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-stone-500 text-[11px]">
                        {formatTimestamp(r.createdAt)}
                      </td>
                      <td className="py-2.5 px-4 text-stone-500 text-[11px]">
                        {formatTimestamp(r.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION BAR */}
        {total > 0 && (
          <div className="py-2.5 px-4 bg-stone-50/60 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-500">
            <div>
              Showing <span className="font-bold text-ink">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-bold text-ink">{Math.min(page * limit, total)}</span> of{' '}
              <span className="font-bold text-ink">{total}</span> records
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-white transition-colors disabled:opacity-40 cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 text-xs font-semibold text-ink">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-white transition-colors disabled:opacity-40 cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 4. IMPORT / UPDATE / REPLACE MODAL WITH 2-STEP PREVIEW FLOW   */}
      {/* ============================================================== */}
      <AdminModal
        isOpen={modalOpen}
        onClose={closeImportModal}
        maxWidth="3xl"
        title={
          modalMode === 'REPLACE'
            ? 'Replace ONGC Employee Master Data'
            : 'Import / Update ONGC Employee Master'
        }
        subtitle={
          modalMode === 'REPLACE'
            ? 'Replace the official CPF and Mobile verification records'
            : 'Add new records or update official ONGC verification records'
        }
        icon={
          modalMode === 'REPLACE' ? (
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          ) : (
            <UploadCloud className="w-5 h-5 text-maroon" />
          )
        }
      >
        <div className="space-y-4">
          {/* STEP 1: SELECT FILE */}
          {uploadStep === 'SELECT' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (e.dataTransfer.files?.[0]) {
                    handleFileChosen(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-colors ${
                  dragging
                    ? 'border-maroon bg-cream-soft/60'
                    : 'border-stone-200 hover:border-maroon/50 hover:bg-stone-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileChosen(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-12 h-12 mx-auto rounded-xl bg-maroon-soft text-maroon flex items-center justify-center mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="font-outfit font-bold text-sm text-ink mb-1">
                  Choose file or drag &amp; drop here
                </div>
                <p className="text-xs text-stone-500 mb-3">
                  Accepts Excel (<code className="text-maroon font-bold">.xlsx</code>, <code className="text-maroon font-bold">.xls</code>) or CSV (<code className="text-maroon font-bold">.csv</code>)
                </p>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 text-[11px] font-semibold text-stone-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-maroon" />
                  <span>Required Columns: <strong>CPF NO</strong> &bull; <strong>Mobile No</strong></span>
                </div>
              </div>

              {/* Format guidance note */}
              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200/80 text-[11px] text-stone-600 space-y-1">
                <div className="font-bold text-ink uppercase tracking-wider text-[10px]">
                  Header Format Rules:
                </div>
                <p>&bull; Case-insensitive headers: <code className="bg-white px-1 py-0.5 rounded border border-stone-200">CPF NO</code> and <code className="bg-white px-1 py-0.5 rounded border border-stone-200">Mobile No</code></p>
                <p>&bull; CPF Number must contain 5 or 6 numeric digits (e.g. 29344 or 103506).</p>
                <p>&bull; Mobile Number is optional. If provided, must be a valid 10-digit Indian mobile number.</p>
              </div>
            </div>
          )}

          {/* STEP 2: VALIDATING SPINNER */}
          {uploadStep === 'VALIDATING' && (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-maroon animate-spin mx-auto" />
              <div className="font-outfit font-bold text-sm text-ink">Validating file contents...</div>
              <p className="text-xs text-stone-500">Checking CPF lengths, mobile numbers, and detecting duplicate rows.</p>
            </div>
          )}

          {/* STEP 3: PREVIEW & CONFIRMATION */}
          {uploadStep === 'PREVIEW' && validationPreview && (
            <div className="space-y-4">
              {/* REPLACEMENT WARNING BOX (Section 8 & 12) */}
              {modalMode === 'REPLACE' && (
                <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-xs space-y-2.5">
                  <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Important Master Data Replacement Warning</span>
                  </div>
                  <p className="leading-relaxed">
                    Replace Master Data will replace the official CPF/Mobile verification records currently used for employee registration. Existing employee registrations, family records, passes, QR codes, check-ins and historical data will <strong>NOT</strong> be deleted.
                  </p>

                  <div className="bg-white/80 p-2.5 rounded-lg border border-rose-200 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-stone-500 block">Current records in DB:</span>
                      <strong className="text-ink font-mono">{validationPreview.currentDatabaseCount ?? total}</strong>
                    </div>
                    <div>
                      <span className="text-stone-500 block">Incoming source rows:</span>
                      <strong className="text-ink font-mono">{validationPreview.sourceRows || validationPreview.totalRows}</strong>
                    </div>
                    <div>
                      <span className="text-stone-500 block">Valid unique CPFs to store:</span>
                      <strong className="text-emerald-700 font-mono">{validationPreview.validCount}</strong>
                    </div>
                    <div>
                      <span className="text-stone-500 block">Missing mobile records:</span>
                      <strong className="text-amber-700 font-mono">{validationPreview.missingMobileCount || 0}</strong>
                    </div>
                    <div>
                      <span className="text-stone-500 block">Invalid records (skipped):</span>
                      <strong className="text-rose-700 font-mono">{validationPreview.invalidCount}</strong>
                    </div>
                    <div>
                      <span className="text-stone-500 block">Duplicate records (skipped):</span>
                      <strong className="text-orange-700 font-mono">{validationPreview.duplicateCount}</strong>
                    </div>
                  </div>

                  <label className="flex items-start gap-2 pt-1 font-bold text-rose-950 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={replaceConfirmed}
                      onChange={(e) => setReplaceConfirmed(e.target.checked)}
                      className="mt-0.5 rounded border-rose-400 text-maroon focus:ring-maroon"
                    />
                    <span>I understand and confirm that all master verification records will be replaced with the validated file records. Existing event registrations and operational data remain untouched.</span>
                  </label>
                </div>
              )}

              {/* CONFLICT SETTING FOR ADD_UPDATE (Section 7) */}
              {modalMode === 'ADD_UPDATE' && validationPreview.conflictCount > 0 && (
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-purple-800">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{validationPreview.conflictCount} Conflicting Record(s) Detected</span>
                  </div>
                  <p className="text-[11px] text-purple-700">
                    Some CPFs in the file already exist in the database with a different mobile number.
                  </p>
                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="conflict_res"
                        checked={resolveConflicts === 'SKIP'}
                        onChange={() => setResolveConflicts('SKIP')}
                        className="text-maroon focus:ring-maroon"
                      />
                      <span>Skip conflicts (leave existing records unchanged)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="conflict_res"
                        checked={resolveConflicts === 'OVERWRITE'}
                        onChange={() => setResolveConflicts('OVERWRITE')}
                        className="text-maroon focus:ring-maroon"
                      />
                      <span>Overwrite existing mobile with new file value</span>
                    </label>
                  </div>
                </div>
              )}

              {/* SUMMARY STATS STRIP (9 Audit Metrics) */}
              <div className="grid grid-cols-3 sm:grid-cols-9 gap-2 text-center text-xs">
                <div className="p-2 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="text-[9px] text-stone-500 block uppercase font-bold">Total Rows</span>
                  <span className="font-outfit font-black text-sm text-ink">{validationPreview.sourceRows || validationPreview.totalRows}</span>
                </div>
                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[9px] text-emerald-700 block uppercase font-bold">Valid</span>
                  <span className="font-outfit font-black text-sm text-emerald-800">{validationPreview.validCount}</span>
                </div>
                <div className="p-2 bg-teal-50 rounded-xl border border-teal-200">
                  <span className="text-[9px] text-teal-700 block uppercase font-bold">New</span>
                  <span className="font-outfit font-black text-sm text-teal-800">{validationPreview.newCount || 0}</span>
                </div>
                <div className="p-2 bg-blue-50 rounded-xl border border-blue-200">
                  <span className="text-[9px] text-blue-700 block uppercase font-bold">Identical</span>
                  <span className="font-outfit font-black text-sm text-blue-800">{validationPreview.identicalCount}</span>
                </div>
                <div className="p-2 bg-purple-50 rounded-xl border border-purple-200">
                  <span className="text-[9px] text-purple-700 block uppercase font-bold">Conflicts</span>
                  <span className="font-outfit font-black text-sm text-purple-800">{validationPreview.conflictCount}</span>
                </div>
                <div className="p-2 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-[9px] text-amber-700 block uppercase font-bold">No Mobile</span>
                  <span className="font-outfit font-black text-sm text-amber-800">{validationPreview.missingMobileCount || 0}</span>
                </div>
                <div className="p-2 bg-orange-50 rounded-xl border border-orange-200">
                  <span className="text-[9px] text-orange-700 block uppercase font-bold">Duplicates</span>
                  <span className="font-outfit font-black text-sm text-orange-800">{validationPreview.duplicateCount}</span>
                </div>
                <div className="p-2 bg-rose-50 rounded-xl border border-rose-200">
                  <span className="text-[9px] text-rose-700 block uppercase font-bold">Invalid CPF</span>
                  <span className="font-outfit font-black text-sm text-rose-800">{validationPreview.invalidCpfCount || 0}</span>
                </div>
                <div className="p-2 bg-red-50 rounded-xl border border-red-200">
                  <span className="text-[9px] text-red-700 block uppercase font-bold">Invalid Mob</span>
                  <span className="font-outfit font-black text-sm text-red-800">{validationPreview.invalidMobileCount || 0}</span>
                </div>
              </div>

              {/* PREVIEW TABLE (Scrollable) */}
              <div className="border border-stone-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-stone-100 text-[10px] font-bold text-stone-600 uppercase border-b border-stone-200">
                    <tr>
                      <th className="py-2 px-3">Row</th>
                      <th className="py-2 px-3">CPF NO</th>
                      <th className="py-2 px-3">Mobile No</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Reason / Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-[11px]">
                    {validationPreview.rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="hover:bg-stone-50">
                        <td className="py-1.5 px-3 text-stone-400 font-mono">{r.row}</td>
                        <td className="py-1.5 px-3 font-mono font-bold text-ink">{normalizeCpf(r.cpfNo) || r.cpfNo}</td>
                        <td className="py-1.5 px-3 font-mono text-stone-700">
                          {r.mobileNo ? (
                            r.mobileNo
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              MISSING
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-3">
                          {r.status === 'VALID' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              VALID
                            </span>
                          ) : r.status === 'IDENTICAL' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                              IDENTICAL
                            </span>
                          ) : r.status === 'CONFLICT' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                              CONFLICT
                            </span>
                          ) : r.status === 'DUPLICATE' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              DUPLICATE
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              INVALID
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-stone-500">{r.reason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {validationPreview.rows.length > 100 && (
                <p className="text-[11px] text-stone-400 text-center">
                  Showing first 100 of {validationPreview.rows.length} rows in preview.
                </p>
              )}

              {/* ACTION BUTTONS */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setUploadStep('SELECT')}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  Choose Different File
                </button>
                <button
                  type="button"
                  onClick={closeImportModal}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={
                    modalMode === 'REPLACE'
                      ? !replaceConfirmed
                      : validationPreview.validCount === 0 && validationPreview.conflictCount === 0
                  }
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer disabled:opacity-50 ${
                    modalMode === 'REPLACE' ? 'bg-rose-700 hover:bg-rose-800' : 'bg-maroon hover:bg-maroon-dark'
                  }`}
                >
                  {modalMode === 'REPLACE' ? 'CONFIRM REPLACEMENT' : 'CONFIRM IMPORT'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: IMPORTING SPINNER */}
          {uploadStep === 'IMPORTING' && (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-maroon animate-spin mx-auto" />
              <div className="font-outfit font-bold text-sm text-ink">
                {modalMode === 'REPLACE' ? 'Replacing Master Records...' : 'Importing Master Records...'}
              </div>
              <p className="text-xs text-stone-500">Executing database transaction safely.</p>
            </div>
          )}
        </div>
      </AdminModal>
    </div>
  );
}
