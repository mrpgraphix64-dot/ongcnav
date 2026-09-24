'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  Play,
  Square,
  RefreshCw,
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Zap,
  Globe,
  HardDrive,
  BarChart3,
  ShieldCheck,
  Server,
  Layers,
  ChevronRight,
  Clock,
  Wifi,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { LoadTestMode, LoadTestScenario, LoadTestStatus } from '@ongc/shared-types';

export default function AdminTrafficTestPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [gates, setGates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
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

      // If a run is selected or actively running, refresh its live status
      if (selectedRun) {
        const liveStatus = await fetchApi(`/admin/traffic-test/runs/${selectedRun.id}/status`);
        setSelectedRun(liveStatus);
      } else if (runsData && runsData.length > 0) {
        const active = runsData.find((r: any) => r.status === 'RUNNING') || runsData[0];
        if (active) {
          const liveStatus = await fetchApi(`/admin/traffic-test/runs/${active.id}/status`);
          setSelectedRun(liveStatus);
        }
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000); // 4s poll while viewing test lab
    return () => clearInterval(interval);
  }, [selectedRun?.id]);

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
        text: `Traffic test initiated (Run #${res.runId}). Mode: ${mode}, Scenario: ${scenario}`,
        type: 'success',
      });
      await loadData();
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to start load test', type: 'error' });
    } finally {
      setStarting(false);
    }
  };

  const handleStopRun = async (runId: string) => {
    try {
      await fetchApi(`/admin/traffic-test/runs/${runId}/stop`, { method: 'POST' });
      setMsg({ text: `Run #${runId} execution stopped.`, type: 'success' });
      loadData();
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to stop run', type: 'error' });
    }
  };

  const handleCleanupRun = async (runId: string) => {
    if (!window.confirm(`Purge all isolated load test data for Run #${runId}? This will remove all test checkins and scan logs.`)) return;
    try {
      await fetchApi(`/admin/traffic-test/runs/${runId}`, {
        method: 'DELETE',
      });
      if (selectedRun?.id === runId) setSelectedRun(null);
      loadData();
      setMsg({ text: `Run #${runId} and all associated test records purged successfully.`, type: 'success' });
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to purge test run', type: 'error' });
    }
  };

  const handleExportCsv = (runId: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    window.open(`${apiUrl}/admin/traffic-test/runs/${runId}/export`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* ONGC Official Header Banner */}
      <div className="bg-gradient-to-r from-red-950/80 via-slate-900 to-amber-950/40 p-6 rounded-2xl border border-red-900/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] uppercase font-black tracking-widest text-amber-400 bg-amber-950/60 border border-amber-800/40 px-2 py-0.5 rounded">
              Verification Lab
            </span>
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Isolated Test Data (is_load_test=true)
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-red-500" />
            Scanner Verification & Traffic Test Lab
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Execute high-concurrency turnstile load simulations, benchmark scanner pipeline throughput, and verify gate capacity limits without contaminating real attendee check-in records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
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

      {/* Real-time Telemetry Card if Run is selected */}
      {selectedRun && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-red-950/80 border border-red-800/40 text-red-400">
                <BarChart3 className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-extrabold text-white text-sm">
                  Active Run Telemetry — #{selectedRun.id}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Scenario: <span className="font-mono text-amber-400">{selectedRun.scenario}</span> | Mode: <span className="font-mono text-blue-400">{selectedRun.mode}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedRun.isRunning && (
                <button
                  onClick={() => handleStopRun(selectedRun.id)}
                  className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-800/50 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Square className="w-3.5 h-3.5" />
                  Stop Test
                </button>
              )}
              <button
                onClick={() => handleExportCsv(selectedRun.id)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</p>
              <p className={`text-base font-black mt-1 ${selectedRun.status === 'RUNNING' ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
                {selectedRun.status}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Throughput</p>
              <p className="text-base font-black text-white mt-1">
                {selectedRun.requestsPerSecond ? `${selectedRun.requestsPerSecond} req/s` : '—'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Avg Latency</p>
              <p className="text-base font-black text-amber-300 mt-1">
                {selectedRun.avgResponseTimeMs ? `${selectedRun.avgResponseTimeMs} ms` : '—'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Requests Total</p>
              <p className="text-base font-black text-white mt-1">
                {selectedRun.totalRequests}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Success Rate</p>
              <p className="text-base font-black text-emerald-400 mt-1">
                {selectedRun.successPercentage || '0'}%
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Network Traffic</p>
              <p className="text-base font-black text-blue-400 mt-1">
                {selectedRun.bytesTransferredMb || '0'} MB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Control Configuration Form */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Configure New Traffic Test Run
        </h3>

        <form onSubmit={handleStartTest} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Scenario */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Scenario
              </label>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as LoadTestScenario)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:border-red-500 focus:outline-none"
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
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Execution Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as LoadTestMode)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:border-red-500 focus:outline-none"
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
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
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
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Target Gate
              </label>
              <select
                value={gateId}
                onChange={(e) => setGateId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:border-red-500 focus:outline-none"
              >
                {gates.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-slate-800">
            <span className="text-xs text-slate-400">
              {mode === LoadTestMode.REAL_HTTP ? (
                <span className="text-amber-400 font-medium flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5" />
                  Real HTTP mode sends actual HTTP requests and measures live network transfer.
                </span>
              ) : (
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  Dry Run mode evaluates logic directly without network overhead.
                </span>
              )}
            </span>

            <button
              type="submit"
              disabled={starting}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-900/40 disabled:opacity-50 transition"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{starting ? 'Starting Test...' : 'Start Load Test'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Test Runs History */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400" />
            Execution Runs History
          </span>
          <span className="text-[11px] text-slate-500">Auto-refreshes every 4s</span>
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
                const isCurrent = selectedRun?.id === r.id;

                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedRun(r)}
                    className={`cursor-pointer transition-colors ${
                      isCurrent ? 'bg-red-950/20' : 'hover:bg-slate-800/30'
                    }`}
                  >
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
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleExportCsv(r.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          title="Export CSV"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCleanupRun(r.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                          title="Purge load test records"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
