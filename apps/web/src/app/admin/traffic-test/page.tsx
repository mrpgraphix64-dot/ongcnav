'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  Play,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Zap,
  Globe,
  HardDrive,
  BarChart,
  ShieldAlert,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { LoadTestMode, LoadTestScenario, LoadTestStatus } from '@ongc/shared-types';

export default function AdminTrafficTestPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [gates, setGates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form Controls
  const [scenario, setScenario] = useState<LoadTestScenario>(LoadTestScenario.NORMAL);
  const [mode, setMode] = useState<LoadTestMode>(LoadTestMode.REAL_HTTP);
  const [simulatedUsers, setSimulatedUsers] = useState(100);
  const [gateId, setGateId] = useState('1');

  const loadData = async () => {
    try {
      setLoading(true);
      const [runsData, gatesData] = await Promise.all([
        fetchApi('/admin/traffic-test/runs'),
        fetchApi('/admin/gates'),
      ]);
      setRuns(runsData || []);
      setGates(gatesData || []);
      if (gatesData && gatesData.length > 0 && !gateId) {
        setGateId(gatesData[0].id);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // 5s poll while viewing test lab
    return () => clearInterval(interval);
  }, []);

  const handleStartTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setStarting(true);
    setMsg(null);

    try {
      const res = await fetchApi('/admin/traffic-test/start', {
        method: 'POST',
        body: JSON.stringify({
          scenario,
          mode,
          simulatedUsers: Number(simulatedUsers),
          gateId,
        }),
      });

      setMsg({
        text: `Traffic test initiated (Run ID: ${res.runId}). Mode: ${mode}, Scenario: ${scenario}`,
        type: 'success',
      });
      loadData();
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to start load test', type: 'error' });
    } finally {
      setStarting(false);
    }
  };

  const handleCleanupRun = async (runId: string) => {
    if (!window.confirm(`Purge all isolated load test data for Run #${runId}?`)) return;
    try {
      await fetchApi(`/admin/traffic-test/runs/${runId}`, {
        method: 'DELETE',
      });
      loadData();
      setMsg({ text: `Run #${runId} and all associated test records purged`, type: 'success' });
    } catch (e: any) {
      alert(e.message || 'Failed to purge test run');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-red-500" />
            Traffic & Load Test Laboratory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Simulate real-time turnstile surges, measure network RPS and latency with strictly isolated test data.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {msg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
            msg.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/60 border-red-500/40 text-red-200'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Control Configuration Form */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
        <h3 className="font-extrabold text-base text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Configure Traffic Test Parameters
        </h3>

        <form onSubmit={handleStartTest} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Scenario */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Scenario
              </label>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as LoadTestScenario)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold"
              >
                <option value={LoadTestScenario.NORMAL}>
                  NORMAL (1 User → 1 Check-in)
                </option>
                <option value={LoadTestScenario.DUPLICATE}>
                  DUPLICATE (1 User → 2 Requests)
                </option>
                <option value={LoadTestScenario.PEAK_BURST}>
                  PEAK BURST (Concurrency Spike)
                </option>
                <option value={LoadTestScenario.INVALID_QR}>
                  INVALID QR (Malformed / Unauthorized)
                </option>
                <option value={LoadTestScenario.MIXED}>
                  MIXED (70% Norm, 20% Dup, 10% Inv)
                </option>
              </select>
            </div>

            {/* Mode */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Execution Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as LoadTestMode)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold"
              >
                <option value={LoadTestMode.REAL_HTTP}>
                  🌐 REAL HTTP (Network Traffic + Latency)
                </option>
                <option value={LoadTestMode.DRY_RUN}>
                  ⚡ DRY RUN (In-Memory Simulation, 0 MB)
                </option>
              </select>
            </div>

            {/* Simulated Users */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Simulated Users ({simulatedUsers})
              </label>
              <input
                type="range"
                min={10}
                max={500}
                step={10}
                value={simulatedUsers}
                onChange={(e) => setSimulatedUsers(Number(e.target.value))}
                className="w-full accent-red-600 mt-2"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>10</span>
                <span>100</span>
                <span>250</span>
                <span>500</span>
              </div>
            </div>

            {/* Target Gate */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Target Gate
              </label>
              <select
                value={gateId}
                onChange={(e) => setGateId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold"
              >
                {gates.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <span className="text-xs text-slate-400">
              {mode === LoadTestMode.REAL_HTTP ? (
                <span className="text-amber-400 font-medium">
                  Real HTTP mode sends actual POST requests and measures socket byte transfer.
                </span>
              ) : (
                <span className="text-slate-500">
                  Dry Run mode evaluates logic without outbound HTTP sockets (0 MB traffic).
                </span>
              )}
            </span>

            <button
              type="submit"
              disabled={starting}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-900/40 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{starting ? 'Starting Test...' : 'Start Load Test'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Test Runs History */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">
            Load Test Run History
          </span>
          <span>Data Isolated (Flagged isLoadTest=true)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 uppercase text-[10px] text-slate-400 font-bold tracking-wider">
              <tr>
                <th className="px-5 py-3">Run ID</th>
                <th className="px-5 py-3">Scenario</th>
                <th className="px-5 py-3">Mode</th>
                <th className="px-5 py-3">Users / Reqs</th>
                <th className="px-5 py-3">RPS</th>
                <th className="px-5 py-3">Avg Latency</th>
                <th className="px-5 py-3">HTTP Traffic</th>
                <th className="px-5 py-3">Success / Dup / Err</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {runs.map((r) => {
                const mbTransferred = (Number(r.bytesTransferred || 0) / (1024 * 1024)).toFixed(2);
                return (
                  <tr key={r.id} className="hover:bg-slate-800/30">
                    <td className="px-5 py-3 font-mono text-amber-400 font-bold">
                      #{r.id}
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300">
                        {r.scenario}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.mode === LoadTestMode.REAL_HTTP
                            ? 'bg-blue-950 text-blue-300 border border-blue-500/40'
                            : 'bg-purple-950 text-purple-300 border border-purple-500/40'
                        }`}
                      >
                        {r.mode}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono">
                      {r.simulatedUsers} / {r.totalRequests}
                    </td>
                    <td className="px-5 py-3 font-mono font-bold text-white">
                      {r.requestsPerSecond ? `${r.requestsPerSecond} req/s` : '—'}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-300">
                      {r.avgResponseTimeMs ? `${r.avgResponseTimeMs} ms` : '—'}
                    </td>
                    <td className="px-5 py-3 font-mono text-emerald-400 font-bold">
                      {r.mode === LoadTestMode.REAL_HTTP ? `${mbTransferred} MB` : '0 MB (DRY RUN)'}
                    </td>
                    <td className="px-5 py-3 font-mono text-[11px]">
                      <span className="text-emerald-400">{r.successfulRequests}</span> /{' '}
                      <span className="text-amber-400">{r.duplicateRequests}</span> /{' '}
                      <span className="text-rose-400">{r.errorRequests}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === LoadTestStatus.COMPLETED
                            ? 'bg-emerald-950/80 text-emerald-300'
                            : r.status === LoadTestStatus.RUNNING
                            ? 'bg-amber-950/80 text-amber-300 animate-pulse'
                            : 'bg-red-950/80 text-red-300'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleCleanupRun(r.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                        title="Purge load test records"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {runs.length === 0 && !loading && (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-slate-500">
                    No traffic test runs recorded yet. Start one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
