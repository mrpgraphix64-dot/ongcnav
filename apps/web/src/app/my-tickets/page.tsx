'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Ticket,
  User,
  Users,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

function MyTicketsContent() {
  const searchParams = useSearchParams();
  const initialCpf = searchParams.get('cpf') || '';

  const [cpf, setCpf] = useState(initialCpf);
  const [phoneLast4, setPhoneLast4] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setResult(null);

    const cleanCpf = cpf.trim().toUpperCase();
    if (!cleanCpf) {
      setError('Please enter your ONGC CPF number');
      return;
    }

    setLoading(true);

    try {
      const url = `/public/my-registration/${cleanCpf}${
        phoneLast4.trim() ? `?phoneLast4=${phoneLast4.trim()}` : ''
      }`;
      const data = await fetchApi(url);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'No active passes found for this CPF');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCpf) {
      handleSearch();
    }
  }, [initialCpf]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 w-full flex-1">
      <div className="text-center max-w-xl mx-auto mb-8">
        <div className="inline-flex p-3 rounded-2xl bg-red-950/60 border border-red-500/30 text-red-400 mb-3">
          <Ticket className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-white">Find Your Festival Passes</h1>
        <p className="text-slate-400 text-sm mt-1">
          Enter your ONGC CPF number to retrieve all digital passes issued for you and your family.
        </p>
      </div>

      {/* Search Box */}
      <form
        onSubmit={handleSearch}
        className="max-w-xl mx-auto p-6 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-4 mb-8"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            ONGC CPF Number
          </label>
          <input
            type="text"
            required
            placeholder="e.g. 123456"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-lg focus:border-red-500 focus:ring-1 focus:ring-red-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Phone Number (Last 4 Digits for Security Verification)
          </label>
          <input
            type="password"
            maxLength={4}
            placeholder="e.g. 3210"
            value={phoneLast4}
            onChange={(e) => setPhoneLast4(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:border-red-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 transition-all disabled:opacity-50"
        >
          {loading ? (
            <span>Locating Passes...</span>
          ) : (
            <>
              <Search className="w-5 h-5" />
              <span>Retrieve Digital Passes</span>
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="max-w-xl mx-auto p-4 rounded-xl bg-red-950/60 border border-red-500/50 flex items-center gap-3 text-red-200 text-sm mb-8">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="space-y-6 animate-fadeIn">
          {/* Employee summary card */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block">
                Primary Employee
              </span>
              <h2 className="text-2xl font-black text-white mt-0.5">
                {result.employee.name}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-2">
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  CPF: {result.employee.cpf}
                </span>
                <span>{result.employee.designation}</span>
                <span>•</span>
                <span>{result.employee.department}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400 block">Total Issued Passes</span>
              <span className="text-2xl font-black text-emerald-400">
                {result.passes.length} Passes
              </span>
            </div>
          </div>

          {/* Pass Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.passes.map((pass: any) => (
              <div
                key={pass.attendeeId}
                className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      {pass.relation}
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                      {pass.ticketNumber}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mt-2">
                    {pass.attendeeName}
                  </h3>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="text-xs text-emerald-300 font-medium">
                      Status: {pass.status}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-mono">
                    Token: {pass.qrCodeToken.slice(0, 10)}...
                  </span>

                  <Link
                    href={`/ticket/${pass.qrCodeToken}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors"
                  >
                    <span>View Pass & QR</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyTicketsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-white text-lg">
            <span className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-black text-sm">
              ओ
            </span>
            <span>ONGC Navratri Pass Portal</span>
          </Link>
          <Link
            href="/register"
            className="text-xs sm:text-sm font-semibold text-amber-400 hover:text-amber-300"
          >
            New Registration
          </Link>
        </div>
      </header>

      <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading...</div>}>
        <MyTicketsContent />
      </Suspense>

      <footer className="border-t border-slate-800 bg-slate-950 py-6 text-center text-xs text-slate-500">
        © 2026 ONGC Cultural Committee • Contact Gate Help Desk for assistance.
      </footer>
    </div>
  );
}
