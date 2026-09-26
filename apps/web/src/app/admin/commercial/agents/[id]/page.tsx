'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Shield,
  ArrowLeft,
  Mail,
  Phone,
  Ticket,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function CommercialAgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAgent = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchApi(`/commercial/agents/admin/agents`);
      const agents = Array.isArray(res) ? res : res?.agents || [];
      const found = agents.find((a: any) => String(a.id) === String(agentId));
      if (!found) {
        setError(`Agent #${agentId} not found.`);
      } else {
        setAgent(found);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load agent details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (agentId) {
      loadAgent();
    }
  }, [agentId]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/admin/commercial/agents"
          className="inline-flex items-center gap-2 text-xs font-bold text-ink-soft hover:text-maroon transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Agents Directory
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-sm text-ink-soft flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-maroon" />
          Loading agent details...
        </div>
      ) : agent ? (
        <div className="space-y-6">
          {/* Agent Overview Card */}
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-maroon/10 text-maroon flex items-center justify-center font-bold text-lg font-outfit">
                  {agent.name?.slice(0, 2).toUpperCase() || 'AG'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold font-outfit text-ink">{agent.name}</h1>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 uppercase">
                      {agent.role === 'COMMERCIAL_SUB_AGENT' ? 'Sub Agent' : 'Master Agent'}
                    </span>
                  </div>
                  <div className="text-xs text-ink-soft mt-0.5">
                    Agent Code: <span className="font-mono font-bold text-ink">{agent.agentCode || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  agent.status === 'ACTIVE' || !agent.status
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${agent.status === 'ACTIVE' || !agent.status ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {agent.status || 'ACTIVE'}
                </span>
              </div>
            </div>

            {/* Contact Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-stone-400 shrink-0" />
                <span className="text-ink font-medium">{agent.email || 'No email registered'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-stone-400 shrink-0" />
                <span className="text-ink font-medium">{agent.phone || 'No phone registered'}</span>
              </div>
            </div>
          </div>

          {/* Allocation & Quota Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
              <div className="text-xs font-bold text-ink-soft uppercase tracking-wider">Allocated Quota</div>
              <div className="text-2xl font-black font-outfit text-ink mt-2">
                {(agent.totalAllocatedQuota ?? agent.allocatedCount ?? 0).toLocaleString()}
              </div>
              <div className="text-xs text-ink-soft mt-1">Total commercial tickets authorized</div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
              <div className="text-xs font-bold text-ink-soft uppercase tracking-wider">Passes Sold</div>
              <div className="text-2xl font-black font-outfit text-emerald-700 mt-2">
                {(agent.totalSold ?? agent.soldCount ?? 0).toLocaleString()}
              </div>
              <div className="text-xs text-ink-soft mt-1">Confirmed offline sales</div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
              <div className="text-xs font-bold text-ink-soft uppercase tracking-wider">Available Balance</div>
              <div className="text-2xl font-black font-outfit text-amber-700 mt-2">
                {Math.max(0, (agent.totalAllocatedQuota ?? agent.allocatedCount ?? 0) - (agent.totalSold ?? agent.soldCount ?? 0)).toLocaleString()}
              </div>
              <div className="text-xs text-ink-soft mt-1">Passes remaining in inventory</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
