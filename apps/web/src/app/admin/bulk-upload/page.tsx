'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Download,
  Check,
  X,
  Edit2,
  RotateCcw,
  QrCode,
  Users,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface IssueRecord {
  row: number;
  name: string;
  mobile: string;
  email?: string;
  category?: string;
  issue: string;
  severity: 'error' | 'info';
}

interface ValidationResponse {
  success: boolean;
  fileName: string;
  totalRecords: number;
  validRecords: number;
  duplicateRecords: number;
  missingFieldsRecords: number;
  issues: IssueRecord[];
  errorBreakdown: {
    missing_name: number;
    invalid_mobile: number;
    duplicate_mobile: number;
    duplicate_email: number;
    missing_category: number;
  };
}

interface ImportResponse {
  success: boolean;
  totalProcessed: number;
  imported: number;
  qr: number;
  duplicatesSkipped: number;
  missingFieldsSkipped: number;
}

const FLOW_STEPS = [
  'Upload CSV',
  'Preview',
  'Review & Correct',
  'Complete',
];

export default function BulkUploadPage() {
  const [step, setStep] = useState<'select' | 'preview' | 'validating' | 'review' | 'importing' | 'complete'>('select');
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [recordEstimate, setRecordEstimate] = useState<number | null>(null);

  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [correctedRows, setCorrectedRows] = useState<Record<number, { name: string; mobile: string; email?: string; category?: string }>>({});
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', mobile: '', email: '', category: 'General' });

  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const flowIndex =
    step === 'select'
      ? 0
      : step === 'preview' || step === 'validating'
      ? 1
      : step === 'review' || step === 'importing'
      ? 2
      : 3;

  // Handle file drop / select
  const handleFile = (selectedFile?: File | null) => {
    if (!selectedFile) return;
    setErrorMsg(null);
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      setFileContent(text);
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      setRecordEstimate(Math.max(0, lines.length - 1));
      setStep('preview');
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read file on disk.');
    };
    reader.readAsText(selectedFile);
  };

  // Validate File
  const handleValidate = async () => {
    if (!fileContent) return;
    try {
      setStep('validating');
      setErrorMsg(null);

      const res = await fetchApi<ValidationResponse>('/admin/bulk-upload/validate', {
        method: 'POST',
        body: JSON.stringify({ csv_content: fileContent }),
      });

      setValidation(res);
      setCorrectedRows({});
      setEditingRow(null);
      setStep('review');
    } catch (e: any) {
      setErrorMsg(e.message || 'Validation failed');
      setStep('preview');
    }
  };

  // Inline correction handlers
  const startEdit = (issue: IssueRecord) => {
    setEditingRow(issue.row);
    setEditForm({
      name: issue.name === '(blank)' ? '' : issue.name,
      mobile: issue.mobile,
      email: issue.email || '',
      category: issue.category || 'General',
    });
  };

  const saveEdit = (row: number) => {
    if (!editForm.name.trim() || !/^\d{10}$/.test(editForm.mobile.replace(/[^0-9]/g, ''))) {
      alert('Please enter a valid Name and 10-digit Mobile Number.');
      return;
    }
    setCorrectedRows((prev) => ({
      ...prev,
      [row]: {
        name: editForm.name.trim(),
        mobile: editForm.mobile.replace(/[^0-9]/g, ''),
        email: editForm.email.trim() || undefined,
        category: editForm.category,
      },
    }));
    setEditingRow(null);
  };

  const undoCorrection = (row: number) => {
    setCorrectedRows((prev) => {
      const next = { ...prev };
      delete next[row];
      return next;
    });
  };

  // Import Action
  const handleImport = async () => {
    if (!fileContent) return;
    try {
      setStep('importing');
      setErrorMsg(null);

      const correctedArray = Object.entries(correctedRows).map(([rowStr, data]) => ({
        row: parseInt(rowStr, 10),
        ...data,
      }));

      const res = await fetchApi<ImportResponse>('/admin/bulk-upload', {
        method: 'POST',
        body: JSON.stringify({
          csv_content: fileContent,
          corrected_rows: correctedArray,
        }),
      });

      setImportResult(res);
      setStep('complete');
    } catch (e: any) {
      setErrorMsg(e.message || 'Import failed');
      setStep('review');
    }
  };

  // Download error report CSV
  const downloadErrorReport = () => {
    if (!validation || !validation.issues) return;
    const rows = ['Row,Name,Mobile,Email,Category,Issue'];
    for (const issue of validation.issues) {
      rows.push(
        [
          issue.row,
          `"${(issue.name || '').replace(/"/g, '""')}"`,
          `"${issue.mobile}"`,
          `"${issue.email || ''}"`,
          `"${issue.category || ''}"`,
          `"${issue.issue}"`,
        ].join(','),
      );
    }
    const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `error_report_${validation.fileName || 'bulk'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setStep('select');
    setFile(null);
    setFileContent('');
    setRecordEstimate(null);
    setValidation(null);
    setCorrectedRows({});
    setEditingRow(null);
    setImportResult(null);
    setErrorMsg(null);
  };

  const errorIssues = validation?.issues?.filter((i) => i.severity === 'error') || [];
  const correctedCount = Object.keys(correctedRows).length;
  const attendeesToImport = (validation?.validRecords || 0) + correctedCount;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title & Description */}
      <div>
        <h2 className="text-2xl font-black font-outfit text-stone-900 flex items-center gap-2.5">
          <UploadCloud className="w-7 h-7 text-[#7A1113]" />
          <span>Bulk Upload & Pass Generation</span>
        </h2>
        <p className="text-xs text-stone-500 mt-1">
          Import batches of attendees via CSV file. The system will validate data, enforce uniqueness, and generate secure QR tickets automatically.
        </p>
      </div>

      {/* Flow Indicator */}
      <div className="bg-white rounded-2xl border border-stone-200/70 p-4 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-3 min-w-max text-xs font-semibold">
          {FLOW_STEPS.map((label, idx) => {
            const isCompleted = idx < flowIndex;
            const isCurrent = idx === flowIndex;

            return (
              <div key={label} className="flex items-center gap-3">
                <span
                  className={`flex items-center gap-2 ${
                    idx <= flowIndex ? 'text-[#7A1113]' : 'text-stone-300'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      isCompleted
                        ? 'bg-[#7A1113] text-white'
                        : isCurrent
                        ? 'bg-[#7A1113]/10 text-[#7A1113] border border-[#7A1113]'
                        : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </span>
                  <span>{label}</span>
                </span>
                {idx < FLOW_STEPS.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-stone-300" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl border bg-rose-50 border-rose-200 text-rose-800 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* STEP 1: SELECT / DROP CSV */}
      {step === 'select' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Upload card */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200/70 shadow-sm space-y-5">
            <div>
              <h3 className="font-outfit font-bold text-stone-900 text-base">
                Upload Attendees CSV
              </h3>
            </div>

            <div
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors relative cursor-pointer ${
                dragging ? 'border-[#7A1113] bg-[#7A1113]/5' : 'border-stone-300 bg-[#FAF7F2]'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0]);
                }}
              />
              <div className="space-y-3">
                <UploadCloud className="w-10 h-10 text-[#7A1113] mx-auto" />
                <div className="text-sm font-bold text-stone-800">
                  Drag &amp; drop your CSV file here
                </div>
                <div className="text-xs text-stone-400">or</div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#7A1113] text-white text-xs font-bold hover:bg-[#8F1417] shadow-sm"
                >
                  Browse Files
                </button>
              </div>
            </div>

            <div className="text-xs text-stone-500 space-y-0.5">
              <div>Supported format: CSV (.csv, .txt)</div>
              <div>Maximum file size: 10 MB</div>
            </div>

            <a
              href="data:text/csv;charset=utf-8,Name%2CMobile%2CEmail%2CCategory%0ARahul%20Patel%2C9876543210%2Crahul%40email.com%2CGeneral%0APriya%20Shah%2C9988776655%2Cpriya%40email.com%2CVIP"
              download="attendee_template.csv"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7A1113] hover:underline"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Official CSV Template</span>
            </a>
          </div>

          {/* CSV format reference */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200/70 shadow-sm space-y-4">
            <h3 className="font-outfit font-bold text-stone-900 text-sm">
              Required CSV Column Headers
            </h3>

            <div className="flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-[#7A1113]/10 text-[#7A1113] text-xs font-bold">
                Name *
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#7A1113]/10 text-[#7A1113] text-xs font-bold">
                Mobile * (10 Digits)
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-semibold">
                Email (Optional)
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-semibold">
                Category (General / VIP / VVIP)
              </span>
            </div>

            <div className="bg-[#FAF7F2] rounded-xl p-3.5 overflow-x-auto border border-stone-200/70">
              <table className="text-[11px] text-stone-800 w-full whitespace-nowrap">
                <thead>
                  <tr className="text-stone-400 font-bold uppercase text-[9px]">
                    <td className="pr-4 pb-2">Name</td>
                    <td className="pr-4 pb-2">Mobile</td>
                    <td className="pr-4 pb-2">Email</td>
                    <td className="pb-2">Category</td>
                  </tr>
                </thead>
                <tbody className="font-mono divide-y divide-stone-100">
                  <tr>
                    <td className="pr-4 py-1 font-semibold text-stone-900">Rahul Patel</td>
                    <td className="pr-4 py-1">9876543210</td>
                    <td className="pr-4 py-1">rahul@email.com</td>
                    <td className="py-1">General</td>
                  </tr>
                  <tr>
                    <td className="pr-4 py-1 font-semibold text-stone-900">Priya Shah</td>
                    <td className="pr-4 py-1">9988776655</td>
                    <td className="pr-4 py-1">priya@email.com</td>
                    <td className="py-1">VIP</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-stone-500">
              Note: Duplicate mobile numbers will be rejected. Blank category defaults to General.
            </p>
          </div>
        </div>
      )}

      {/* STEP 2: PREVIEW */}
      {step === 'preview' && file && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200/70 shadow-sm space-y-5 max-w-lg mx-auto">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#7A1113]/10 text-[#7A1113] flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-outfit font-bold text-stone-900 text-base truncate">
                {file.name}
              </div>
              <div className="text-xs text-stone-500 mt-0.5">
                <span>{recordEstimate !== null ? `${recordEstimate} records found` : 'Analyzing...'}</span>
                &nbsp;&bull;&nbsp;
                <span>{(file.size / 1024).toFixed(1)} KB</span>
              </div>
              <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Ready for Validation
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={resetAll}
              className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-xs font-bold hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleValidate}
              className="flex-1 py-2.5 rounded-xl bg-[#7A1113] hover:bg-[#8F1417] text-white text-xs font-bold shadow-sm transition-all"
            >
              Validate File
            </button>
          </div>
        </div>
      )}

      {/* STEP: VALIDATING */}
      {step === 'validating' && (
        <div className="bg-white rounded-2xl p-10 border border-stone-200/70 shadow-sm text-center space-y-3 max-w-lg mx-auto">
          <RefreshCw className="w-8 h-8 animate-spin text-[#7A1113] mx-auto" />
          <h4 className="font-outfit font-bold text-stone-800">Validating Attendee Records</h4>
          <p className="text-xs text-stone-500">Checking mobile formats, duplicates, and category fields...</p>
        </div>
      )}

      {/* STEP 3: REVIEW & CORRECT */}
      {step === 'review' && validation && (
        <div className="space-y-5">
          {/* Summary stats */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200/70 shadow-sm space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-3xl font-outfit font-black text-stone-900">
                  {validation.totalRecords}
                </div>
                <div className="text-xs text-stone-500">Total Records Processed</div>
              </div>

              {errorIssues.length > 0 && (
                <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                  {errorIssues.length} Records Require Attention
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                <div className="text-2xl font-outfit font-black text-emerald-700">
                  {validation.validRecords}
                </div>
                <div className="text-[11px] font-bold text-emerald-800 mt-0.5">Valid Records</div>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
                <div className="text-2xl font-outfit font-black text-amber-700">
                  {validation.duplicateRecords}
                </div>
                <div className="text-[11px] font-bold text-amber-800 mt-0.5">Duplicates</div>
              </div>
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-center">
                <div className="text-2xl font-outfit font-black text-rose-700">
                  {validation.missingFieldsRecords}
                </div>
                <div className="text-[11px] font-bold text-rose-800 mt-0.5">Errors</div>
              </div>
            </div>
          </div>

          {/* Problem records table */}
          {errorIssues.length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <h3 className="font-outfit font-bold text-stone-900 text-sm">
                  Records Requiring Attention ({errorIssues.length})
                </h3>
                <button
                  type="button"
                  onClick={downloadErrorReport}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#7A1113] hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Error Report</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF7F2] text-[10px] font-bold uppercase tracking-wide text-stone-500 border-b border-stone-200/70">
                    <tr>
                      <th className="px-5 py-3 w-16">Row</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Mobile / Email</th>
                      <th className="px-4 py-3">Validation Issue</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {errorIssues.map((issue) => {
                      const isFixed = !!correctedRows[issue.row];
                      const isEditing = editingRow === issue.row;

                      if (isFixed) {
                        const fixed = correctedRows[issue.row];
                        return (
                          <tr key={issue.row} className="bg-emerald-50/50">
                            <td className="px-5 py-3 font-mono text-stone-500 font-bold">{issue.row}</td>
                            <td className="px-4 py-3 font-bold text-stone-900">{fixed.name}</td>
                            <td className="px-4 py-3 font-mono text-stone-600">{fixed.mobile}</td>
                            <td className="px-4 py-3 text-emerald-700 font-bold">Fixed &amp; Included</td>
                            <td className="px-5 py-3 text-right">
                              <button
                                onClick={() => undoCorrection(issue.row)}
                                className="text-xs text-stone-500 hover:text-stone-800 font-semibold"
                              >
                                Undo
                              </button>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={issue.row} className="hover:bg-stone-50">
                          <td className="px-5 py-3 font-mono text-stone-500">{issue.row}</td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                placeholder="Full Name"
                                className="px-2 py-1 rounded border border-stone-200 text-xs w-full"
                              />
                            ) : (
                              <span className="font-semibold text-stone-900">{issue.name}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editForm.mobile}
                                  onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                                  placeholder="10-digit mobile"
                                  className="px-2 py-1 rounded border border-stone-200 text-xs font-mono w-28"
                                />
                                <input
                                  type="email"
                                  value={editForm.email}
                                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                  placeholder="Email"
                                  className="px-2 py-1 rounded border border-stone-200 text-xs"
                                />
                              </div>
                            ) : (
                              <div className="font-mono text-stone-600">
                                <span>{issue.mobile}</span>
                                {issue.email && <span className="text-stone-400 ml-1">({issue.email})</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-rose-600 font-semibold">
                            {issue.issue}
                          </td>
                          <td className="px-5 py-3 text-right whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(issue.row)}
                                  className="text-xs font-bold text-emerald-700 hover:underline"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingRow(null)}
                                  className="text-xs text-stone-500 hover:underline"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEdit(issue)}
                                className="text-xs font-bold text-[#7A1113] hover:underline"
                              >
                                Edit &amp; Fix
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ready to Import Card */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200/70 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-outfit font-bold text-stone-900 text-base">
                  Ready to Import
                </h3>
                <p className="text-xs text-stone-500">
                  {attendeesToImport} attendees will be imported and issued encrypted QR tokens.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-[#FAF7F2] p-4 border border-stone-200/70">
                <div className="text-xl font-outfit font-black text-stone-900">
                  {attendeesToImport}
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">Attendees to Import</div>
              </div>
              <div className="rounded-xl bg-[#FAF7F2] p-4 border border-stone-200/70">
                <div className="text-xl font-outfit font-black text-stone-900">
                  {attendeesToImport}
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">QR Passes to Generate</div>
              </div>
              <div className="rounded-xl bg-[#FAF7F2] p-4 border border-stone-200/70">
                <div className="text-xl font-outfit font-black text-stone-900">
                  {Math.max(0, errorIssues.length - correctedCount)}
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">Skipped Problem Rows</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={resetAll}
                className="py-3 px-5 rounded-xl border border-stone-200 text-stone-600 text-xs font-bold hover:bg-stone-50"
              >
                Start Over
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={attendeesToImport === 0}
                className="flex-1 py-3 px-5 rounded-xl bg-[#7A1113] hover:bg-[#8F1417] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <QrCode className="w-4 h-4 text-amber-300" />
                <span>Import Attendees &amp; Generate QR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP: IMPORTING */}
      {step === 'importing' && (
        <div className="bg-white rounded-2xl p-10 border border-stone-200/70 shadow-sm text-center space-y-3 max-w-lg mx-auto">
          <RefreshCw className="w-8 h-8 animate-spin text-[#7A1113] mx-auto" />
          <h4 className="font-outfit font-bold text-stone-800">Importing in Database Transaction</h4>
          <p className="text-xs text-stone-500">Generating unique ticket passes and cryptographically secure QR tokens...</p>
        </div>
      )}

      {/* STEP 4: COMPLETE */}
      {step === 'complete' && importResult && (
        <div className="bg-white rounded-2xl p-8 border border-stone-200/70 shadow-sm text-center space-y-6 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h3 className="font-outfit font-black text-2xl text-stone-900">
              Bulk Import Completed!
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Successfully imported {importResult.imported} attendees and issued passes.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="p-3 bg-[#FAF7F2] rounded-xl border border-stone-200">
              <div className="text-xs text-stone-500">Imported Attendees</div>
              <div className="font-outfit font-bold text-lg text-emerald-700">
                {importResult.imported}
              </div>
            </div>
            <div className="p-3 bg-[#FAF7F2] rounded-xl border border-stone-200">
              <div className="text-xs text-stone-500">QR Passes Issued</div>
              <div className="font-outfit font-bold text-lg text-emerald-700">
                {importResult.qr}
              </div>
            </div>
            <div className="p-3 bg-[#FAF7F2] rounded-xl border border-stone-200">
              <div className="text-xs text-stone-500">Duplicates Skipped</div>
              <div className="font-outfit font-bold text-lg text-amber-700">
                {importResult.duplicatesSkipped}
              </div>
            </div>
            <div className="p-3 bg-[#FAF7F2] rounded-xl border border-stone-200">
              <div className="text-xs text-stone-500">Errors Skipped</div>
              <div className="font-outfit font-bold text-lg text-rose-700">
                {importResult.missingFieldsSkipped}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={resetAll}
              className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50"
            >
              Upload Another CSV
            </button>
            <Link
              href="/admin/attendees"
              className="flex-1 py-2.5 rounded-xl bg-[#7A1113] hover:bg-[#8F1417] text-white text-xs font-bold transition-all shadow-sm inline-flex items-center justify-center gap-1.5"
            >
              <span>View Attendee Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
