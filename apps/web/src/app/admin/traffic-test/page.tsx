'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import {
  MIN_GATES,
  MAX_GATES,
  DEFAULT_GATES,
  MIN_SCANNERS_PER_GATE,
  MAX_SCANNERS_PER_GATE,
  DEFAULT_SCANNERS_PER_GATE,
  MIN_SCAN_INTERVAL,
  MAX_SCAN_INTERVAL,
  DEFAULT_SCAN_INTERVAL,
  MIN_DURATION_SECONDS,
  MAX_DURATION_SECONDS,
  DEFAULT_DURATION_SECONDS,
  calculateTotalScanners,
  calculateExpectedScanRate,
  calculateEstimatedRequests,
  buildInitialRunTelemetry,
} from './traffic-test.constants';

export default function AdminTrafficTestPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [gates, setGates] = useState<any[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form Controls (Physical Scanner Setup)
  const [scenario, setScenario] = useState<LoadTestScenario>(LoadTestScenario.NORMAL);
  const [mode, setMode] = useState<LoadTestMode>(LoadTestMode.REAL_HTTP);
  const [testDate, setTestDate] = useState('2026-10-11');
  const [numberOfGates, setNumberOfGates] = useState(DEFAULT_GATES);
  const [scannersPerGate, setScannersPerGate] = useState(DEFAULT_SCANNERS_PER_GATE);
  const [scanInterval, setScanInterval] = useState(DEFAULT_SCAN_INTERVAL);
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [gateId, setGateId] = useState('1');

  const totalScanners = calculateTotalScanners(numberOfGates, scannersPerGate);
  const expectedTraffic = calculateExpectedScanRate(totalScanners, scanInterval);
  const estimatedRequests = calculateEstimatedRequests(totalScanners, durationSeconds, scanInterval);

  const selectedRunRef = useRef<any | null>(selectedRun);
  useEffect(() => {
    selectedRunRef.current = selectedRun;
  }, [selectedRun]);

  const runsRef = useRef<any[]>(runs);
  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);

  const isFetchingRef = useRef(false);

  const loadData = useCallback(async (isManual = false) => {
    // Guard against overlapping concurrent requests
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isManual) {
      setRefreshing(true);
    }

    try {
      const [runsData, gatesData] = await Promise.all([
        fetchApi('/admin/traffic-test/runs'),
        fetchApi('/admin/gates'),
      ]);

      if (Array.isArray(runsData)) {
        // Smooth reconciliation: avoid replacing table state if incoming data is identical
        const prevJson = JSON.stringify(runsRef.current);
        const nextJson = JSON.stringify(runsData);
        if (prevJson !== nextJson) {
          setRuns(runsData);
          runsRef.current = runsData;
        }
      }

      if (Array.isArray(gatesData) && gatesData.length > 0) {
        setGates(gatesData);
        setGateId((prev) => prev || gatesData[0].id?.toString() || '1');
      }

      // If a run is selected or actively running, refresh its live status
      const curSelected = selectedRunRef.current;
      if (curSelected?.id) {
        try {
          const liveStatus = await fetchApi(`/admin/traffic-test/runs/${curSelected.id}/status`);
          if (liveStatus && JSON.stringify(curSelected) !== JSON.stringify(liveStatus)) {
            setSelectedRun(liveStatus);
            selectedRunRef.current = liveStatus;
          }
        } catch {
          // Keep existing telemetry display on transient error
        }
      } else if (Array.isArray(runsData) && runsData.length > 0) {
        const active = runsData.find((r: any) => r.status === LoadTestStatus.RUNNING) || runsData[0];
        if (active?.id) {
          try {
            const liveStatus = await fetchApi(`/admin/traffic-test/runs/${active.id}/status`);
            if (liveStatus) {
              setSelectedRun(liveStatus);
              selectedRunRef.current = liveStatus;
            }
          } catch {
            // Keep existing telemetry display on transient error
          }
        }
      }
    } catch (e: any) {
      console.error('Failed to load traffic test data:', e);
    } finally {
      isFetchingRef.current = false;
      setInitialLoading(false);
      if (isManual) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadData(false);

    // 4s polling interval without clearing/unmounting table or restarting on run selection
    const interval = setInterval(() => {
      if (isMounted) {
        loadData(false);
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [loadData]);

  const handleStartTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setStarting(true);
    setMsg(null);

    const safeGates = Math.max(MIN_GATES, Math.min(MAX_GATES, Math.floor(numberOfGates) || MIN_GATES));
    const safeScanners = Math.max(MIN_SCANNERS_PER_GATE, Math.min(MAX_SCANNERS_PER_GATE, Math.floor(scannersPerGate) || MIN_SCANNERS_PER_GATE));
    const safeInterval = Math.max(MIN_SCAN_INTERVAL, Math.min(MAX_SCAN_INTERVAL, Math.floor(scanInterval) || MIN_SCAN_INTERVAL));
    const safeDuration = Math.max(MIN_DURATION_SECONDS, Math.min(MAX_DURATION_SECONDS, Math.floor(durationSeconds) || MIN_DURATION_SECONDS));
    const effectiveScanners = safeGates * safeScanners;

    try {
      const res = await fetchApi('/admin/traffic-test/start', {
        method: 'POST',
        body: JSON.stringify({
          scenario,
          mode,
          simulatedUsers: effectiveScanners,
          concurrency: effectiveScanners,
          scanIntervalSeconds: safeInterval,
          durationSeconds: safeDuration,
          rampUpSeconds: 0,
          testDate,
          gateId: gateId || (gates[0]?.id?.toString() || '1'),
        }),
      });

      const newRunId = res.runId?.toString();
      if (newRunId) {
        // Immediately switch Active Run Telemetry to the newly started run
        const initialTelemetry = buildInitialRunTelemetry(newRunId, {
          status: res.status || LoadTestStatus.RUNNING,
          scenario: res.scenario || scenario,
          mode: res.mode || mode,
          simulatedUsers: effectiveScanners,
        });
        setSelectedRun(initialTelemetry);
        selectedRunRef.current = initialTelemetry;

        // Try to fetch live status immediately
        try {
          const liveStatus = await fetchApi(`/admin/traffic-test/runs/${newRunId}/status`);
          if (liveStatus) {
            setSelectedRun(liveStatus);
            selectedRunRef.current = liveStatus;
          }
        } catch {
          // initialTelemetry remains displayed
        }
      }

      setMsg({
        text: `Traffic test initiated (Run #${res.runId}). Mode: ${mode}, Scenario: ${scenario} (${effectiveScanners} Scanners)`,
        type: 'success',
      });
      await loadData(true);
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
      await loadData(true);
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
      await loadData(true);
      setMsg({ text: `Run #${runId} and all associated test records purged successfully.`, type: 'success' });
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to purge test run', type: 'error' });
    }
  };

  const handleSelectRun = async (r: any) => {
    setSelectedRun(r);
    selectedRunRef.current = r;
    try {
      const liveStatus = await fetchApi(`/admin/traffic-test/runs/${r.id}/status`);
      if (liveStatus) {
        setSelectedRun(liveStatus);
        selectedRunRef.current = liveStatus;
      }
    } catch (e) {
      console.error('Failed to load run telemetry:', e);
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
            onClick={() => loadData(true)}
            disabled={refreshing || initialLoading}
            className="px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
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

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
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
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Success / Dup / Inv / Err</p>
              <p className="text-xs font-black mt-1 font-mono">
                <span className="text-emerald-400">{selectedRun.successfulRequests ?? 0}</span>
                <span className="text-slate-500"> / </span>
                <span className="text-amber-400">{selectedRun.duplicateRequests ?? 0}</span>
                <span className="text-slate-500"> / </span>
                <span className="text-indigo-400">{selectedRun.invalidRequests ?? 0}</span>
                <span className="text-slate-500"> / </span>
                <span className="text-rose-400">{selectedRun.errorRequests ?? 0}</span>
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Success Rate</p>
              <p className="text-base font-black text-emerald-400 mt-1">
                {selectedRun.successPercentage || '0'}%
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Measured HTTP Payload</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <option value={LoadTestScenario.INVALID_QR}>
                  INVALID QR (Malformed / Unauthorized)
                </option>
                <option value={LoadTestScenario.NOT_BOOKED}>
                  NOT BOOKED (Valid Pass, Wrong Date)
                </option>
                <option value={LoadTestScenario.PEAK_BURST}>
                  PEAK BURST (Concurrency Spike)
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

            {/* Simulation Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Simulation Date
              </label>
              <select
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:border-red-500 focus:outline-none"
              >
                <option value="2026-10-11">2026-10-11 (Day 1 - Inauguration)</option>
                <option value="2026-10-12">2026-10-12 (Day 2)</option>
                <option value="2026-10-13">2026-10-13 (Day 3)</option>
                <option value="2026-10-14">2026-10-14 (Day 4)</option>
                <option value="2026-10-15">2026-10-15 (Day 5)</option>
                <option value="2026-10-16">2026-10-16 (Day 6)</option>
                <option value="2026-10-17">2026-10-17 (Day 7)</option>
                <option value="2026-10-18">2026-10-18 (Day 8)</option>
                <option value="2026-10-19">2026-10-19 (Day 9 - Grand Finale)</option>
              </select>
            </div>
          </div>

          {/* Physical Turnstile & Scanner Configuration */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Number of Gates */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Number of Gates
                </label>
                <input
                  type="number"
                  min={MIN_GATES}
                  max={MAX_GATES}
                  value={numberOfGates}
                  onChange={(e) => setNumberOfGates(Math.max(MIN_GATES, Math.min(MAX_GATES, Number(e.target.value) || MIN_GATES)))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:border-red-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">Active entrance gates (1–3)</p>
              </div>

              {/* Scanners per Gate */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Scanners per Gate
                </label>
                <input
                  type="number"
                  min={MIN_SCANNERS_PER_GATE}
                  max={MAX_SCANNERS_PER_GATE}
                  value={scannersPerGate}
                  onChange={(e) => setScannersPerGate(Math.max(MIN_SCANNERS_PER_GATE, Math.min(MAX_SCANNERS_PER_GATE, Number(e.target.value) || MIN_SCANNERS_PER_GATE)))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:border-red-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">Turnstile scanners per gate (1–10)</p>
              </div>

              {/* Scan Interval */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Scan Interval (s)
                </label>
                <input
                  type="number"
                  min={MIN_SCAN_INTERVAL}
                  max={MAX_SCAN_INTERVAL}
                  value={scanInterval}
                  onChange={(e) => setScanInterval(Math.max(MIN_SCAN_INTERVAL, Math.min(MAX_SCAN_INTERVAL, Number(e.target.value) || MIN_SCAN_INTERVAL)))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:border-red-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">Time between scans from each scanner.</p>
              </div>

              {/* Test Duration */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Test Duration (seconds)
                </label>
                <input
                  type="number"
                  min={MIN_DURATION_SECONDS}
                  max={MAX_DURATION_SECONDS}
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Math.max(MIN_DURATION_SECONDS, Math.min(MAX_DURATION_SECONDS, Number(e.target.value) || MIN_DURATION_SECONDS)))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:border-red-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">How long the scanners should continue scanning.</p>
              </div>
            </div>

            {/* Read-only Scanner Setup Summary */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800/80 text-xs">
              <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center gap-2" aria-label={`Total Scanners: ${totalScanners}`}>
                <span className="text-slate-400 text-[11px] font-medium">Total Scanners:</span>
                <span className="text-amber-400 font-mono font-bold">{totalScanners}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center gap-2" aria-label={`Parallel Scanners: ${totalScanners}`}>
                <span className="text-slate-400 text-[11px] font-medium">Parallel Scanners:</span>
                <span className="text-emerald-400 font-mono font-bold">{totalScanners}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center gap-2" aria-label={`Expected Traffic: ${expectedTraffic}`}>
                <span className="text-slate-400 text-[11px] font-medium">Expected Traffic:</span>
                <span className="text-blue-400 font-mono font-bold">{expectedTraffic}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center gap-2" aria-label={`Estimated Requests: ~${estimatedRequests}`}>
                <span className="text-slate-400 text-[11px] font-medium">Estimated Requests:</span>
                <span className="text-purple-400 font-mono font-bold">~{estimatedRequests}</span>
              </div>
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
                <th className="px-5 py-3">Success / Dup / Inv / Err</th>
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
                    key={`run-${r.id}`}
                    onClick={() => handleSelectRun(r)}
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
                      <span className="text-indigo-400">{r.invalidRequests || 0}</span> /{' '}
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

              {runs.length === 0 && !initialLoading && (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-slate-500">
                    No traffic test runs recorded yet. Start one above.
                  </td>
                </tr>
              )}

              {runs.length === 0 && initialLoading && (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-red-500" />
                      <span>Loading test runs...</span>
                    </div>
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
