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
  Cpu,
  Network,
  Database,
  Users,
  ChevronDown,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { LoadTestMode, LoadTestScenario, LoadTestStatus, LoadTestCleanupStatus } from '@ongc/shared-types';
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
  BURST_LEVELS,
  DEFAULT_BURST_LEVEL,
  SCENARIO_DETAILS,
  getLoadWarning,
  MAX_SAFE_CONCURRENCY,
  calculateTotalScanners,
  calculateExpectedScanRate,
  calculateBaseScanActions,
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
  const [runTestData, setRunTestData] = useState<any | null>(null);
  const [loadingTestData, setLoadingTestData] = useState(false);
  const [cleaningUpData, setCleaningUpData] = useState(false);
  const [showAttendeesList, setShowAttendeesList] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form Controls (Physical Scanner Setup)
  const [scenario, setScenario] = useState<LoadTestScenario>(LoadTestScenario.NORMAL);
  const [mode, setMode] = useState<LoadTestMode>(LoadTestMode.REAL_HTTP);
  const [testDate, setTestDate] = useState('2026-10-11');
  const [numberOfGates, setNumberOfGates] = useState(DEFAULT_GATES);
  const [scannersPerGate, setScannersPerGate] = useState(DEFAULT_SCANNERS_PER_GATE);
  const [scanInterval, setScanInterval] = useState(DEFAULT_SCAN_INTERVAL);
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [burstLevel, setBurstLevel] = useState<number>(DEFAULT_BURST_LEVEL);
  const [gateId, setGateId] = useState('1');

  // Live VPS Status
  const [vpsStatus, setVpsStatus] = useState<any | null>(null);
  const [vpsError, setVpsError] = useState<string | null>(null);
  const [vpsBaseline, setVpsBaseline] = useState<{ cpu: number; rxMb: number } | null>(null);

  const isPeakBurst = scenario === LoadTestScenario.PEAK_BURST;
  const totalScanners = calculateTotalScanners(numberOfGates, scannersPerGate);
  const effectiveWorkers = isPeakBurst ? burstLevel : totalScanners;
  const expectedTraffic = calculateExpectedScanRate(totalScanners, scanInterval);
  const baseScanActions = calculateBaseScanActions(totalScanners, durationSeconds, scanInterval);
  const estimatedRequests = isPeakBurst ? burstLevel : calculateEstimatedRequests(scenario, totalScanners, durationSeconds, scanInterval);
  const loadWarning = getLoadWarning(effectiveWorkers);
  const isExceedingLimit = effectiveWorkers > MAX_SAFE_CONCURRENCY;

  const selectedRunRef = useRef<any | null>(selectedRun);
  useEffect(() => {
    selectedRunRef.current = selectedRun;
  }, [selectedRun]);

  const runsRef = useRef<any[]>(runs);
  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);

  const isFetchingRef = useRef(false);
  const isVpsFetchingRef = useRef(false);

  const isAnyTestRunning =
    starting ||
    selectedRun?.status === LoadTestStatus.RUNNING ||
    selectedRun?.isRunning === true ||
    runs.some((r) => r.status === LoadTestStatus.RUNNING);

  const loadVpsStatus = useCallback(async () => {
    if (isVpsFetchingRef.current) return;
    isVpsFetchingRef.current = true;
    try {
      const data = await fetchApi('/admin/traffic-test/vps-status');
      if (data && data.cpu) {
        setVpsStatus(data);
        setVpsError(null);
      }
    } catch (err: any) {
      console.warn('Failed to load VPS status:', err);
      setVpsError(err.message || 'VPS metrics temporarily unavailable');
    } finally {
      isVpsFetchingRef.current = false;
    }
  }, []);

  // Live VPS polling: 3s during active test, 10s when idle
  useEffect(() => {
    let isMounted = true;
    loadVpsStatus();

    const intervalMs = isAnyTestRunning ? 3000 : 10000;
    const interval = setInterval(() => {
      if (isMounted) {
        loadVpsStatus();
      }
    }, intervalMs);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [loadVpsStatus, isAnyTestRunning]);

  // Baseline tracking during active run
  useEffect(() => {
    if (isAnyTestRunning) {
      if (!vpsBaseline && vpsStatus?.cpu?.usagePercent != null) {
        setVpsBaseline({
          cpu: vpsStatus.cpu.usagePercent,
          rxMb: vpsStatus.network?.rxMb || 0,
        });
      }
    } else {
      if (vpsBaseline) {
        setVpsBaseline(null);
      }
    }
  }, [isAnyTestRunning, vpsStatus, vpsBaseline]);

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
    if (isExceedingLimit) {
      setMsg({
        text: `Cannot start test: Total workers (${effectiveWorkers}) exceeds maximum safe limit of ${MAX_SAFE_CONCURRENCY}.`,
        type: 'error',
      });
      return;
    }
    setStarting(true);
    setMsg(null);

    // If currently available, store immediate baseline
    if (vpsStatus?.cpu?.usagePercent != null) {
      setVpsBaseline({
        cpu: vpsStatus.cpu.usagePercent,
        rxMb: vpsStatus.network?.rxMb || 0,
      });
    }

    const safeGates = Math.max(MIN_GATES, Math.min(MAX_GATES, Math.floor(numberOfGates) || MIN_GATES));
    const safeScanners = Math.max(MIN_SCANNERS_PER_GATE, Math.min(MAX_SCANNERS_PER_GATE, Math.floor(scannersPerGate) || MIN_SCANNERS_PER_GATE));
    const safeInterval = isPeakBurst ? 0 : Math.max(MIN_SCAN_INTERVAL, Math.min(MAX_SCAN_INTERVAL, Math.floor(scanInterval) || MIN_SCAN_INTERVAL));
    const safeDuration = isPeakBurst ? 0 : Math.max(MIN_DURATION_SECONDS, Math.min(MAX_DURATION_SECONDS, Math.floor(durationSeconds) || MIN_DURATION_SECONDS));
    const finalWorkers = isPeakBurst ? burstLevel : (safeGates * safeScanners);

    try {
      const res = await fetchApi('/admin/traffic-test/start', {
        method: 'POST',
        body: JSON.stringify({
          scenario,
          mode,
          simulatedUsers: finalWorkers,
          concurrency: finalWorkers,
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
          simulatedUsers: finalWorkers,
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
        text: `Traffic test initiated (Run #${res.runId}). Mode: ${mode}, Scenario: ${scenario} (${finalWorkers} Workers)`,
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

  const loadRunTestData = useCallback(async (runId: string) => {
    try {
      setLoadingTestData(true);
      const data = await fetchApi(`/admin/traffic-test/runs/${runId}/test-data`);
      setRunTestData(data);
    } catch (err: any) {
      console.warn('Failed to load run test data:', err);
    } finally {
      setLoadingTestData(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRun?.id) {
      loadRunTestData(selectedRun.id);
    } else {
      setRunTestData(null);
    }
  }, [selectedRun?.id, loadRunTestData]);

  const handleCleanupTestData = async (runId: string) => {
    if (
      !window.confirm(
        `Clean up synthetic test attendees, check-ins, and scan logs for Run #${runId}?\n\nThis will remove temporary load test records from the database while preserving all run telemetry, metrics, and CSV request logs.`,
      )
    )
      return;

    try {
      setCleaningUpData(true);
      const res = await fetchApi(`/admin/traffic-test/runs/${runId}/cleanup-data`, {
        method: 'POST',
      });
      setMsg({
        text: `Test data for Run #${runId} cleaned up successfully (${res.deletedAttendees || 0} attendees removed). Run telemetry preserved.`,
        type: 'success',
      });
      await loadRunTestData(runId);
      const liveStatus = await fetchApi(`/admin/traffic-test/runs/${runId}/status`);
      if (liveStatus) {
        setSelectedRun(liveStatus);
      }
      await loadData(true);
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to clean up test data', type: 'error' });
    } finally {
      setCleaningUpData(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* ONGC Official Header Banner */}
      <div className="bg-gradient-to-r from-red-950/80 via-slate-900 to-amber-950/40 p-3.5 sm:p-4 rounded-xl border border-red-900/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-black tracking-widest text-amber-400 bg-amber-950/60 border border-amber-800/40 px-2 py-0.5 rounded">
              Verification Lab
            </span>
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Isolated Test Data (is_load_test=true)
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-500" />
            Scanner Verification &amp; Traffic Test Lab
          </h1>
          <p className="text-[11px] text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
            Execute high-concurrency turnstile load simulations, benchmark scanner pipeline throughput, and verify gate capacity limits without contaminating real attendee check-in records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || initialLoading}
            className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
            msg.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/60 border-red-500/40 text-red-200'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Real-time Telemetry Card if Run is selected */}
      {selectedRun && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-xl space-y-2.5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-red-950/80 border border-red-800/40 text-red-400">
                <BarChart3 className="w-3.5 h-3.5" />
              </span>
              <div>
                <h3 className="font-extrabold text-white text-xs">
                  Active Run Telemetry — #{selectedRun.id}
                </h3>
                <p className="text-[10px] text-slate-400">
                  Scenario: <span className="font-mono text-amber-400">{selectedRun.scenario}</span> | Mode: <span className="font-mono text-blue-400">{selectedRun.mode}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedRun.isRunning && (
                <button
                  onClick={() => handleStopRun(selectedRun.id)}
                  className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-800/50 text-rose-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Square className="w-3 h-3" />
                  Stop Test
                </button>
              )}
              <button
                onClick={() => handleExportCsv(selectedRun.id)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <Download className="w-3 h-3" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            <div className="py-2 px-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</p>
              <p className={`text-sm font-black mt-0.5 ${selectedRun.status === 'RUNNING' ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
                {selectedRun.status}
              </p>
            </div>
            <div className="py-2 px-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Throughput</p>
              <p className="text-sm font-black text-white mt-0.5">
                {selectedRun.requestsPerSecond ? `${selectedRun.requestsPerSecond} req/s` : '—'}
              </p>
            </div>
            <div className="py-2 px-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Avg Latency</p>
              <p className="text-sm font-black text-amber-300 mt-0.5">
                {selectedRun.avgResponseTimeMs ? `${selectedRun.avgResponseTimeMs} ms` : '—'}
              </p>
            </div>
            <div className="py-2 px-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Requests Total</p>
              <p className="text-sm font-black text-white mt-0.5">
                {selectedRun.totalRequests}
              </p>
            </div>
            <div className="py-2 px-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Success/Dup/Inv/Err</p>
              <p className="text-[11px] font-black mt-0.5 font-mono">
                <span className="text-emerald-400">{selectedRun.successfulRequests ?? 0}</span>
                <span className="text-slate-500">/</span>
                <span className="text-amber-400">{selectedRun.duplicateRequests ?? 0}</span>
                <span className="text-slate-500">/</span>
                <span className="text-indigo-400">{selectedRun.invalidRequests ?? 0}</span>
                <span className="text-slate-500">/</span>
                <span className="text-rose-400">{selectedRun.errorRequests ?? 0}</span>
              </p>
            </div>
            <div className="py-2 px-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Success Rate</p>
              <p className="text-sm font-black text-emerald-400 mt-0.5">
                {selectedRun.successPercentage || '0'}%
              </p>
            </div>
            <div className="py-2 px-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">HTTP Payload</p>
              <p className="text-sm font-black text-blue-400 mt-0.5">
                {selectedRun.bytesTransferredMb || '0'} MB
              </p>
            </div>
          </div>

          {/* VPS Resource Correlation during Active Test */}
          {vpsStatus && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-slate-300 text-[11px]">Server Correlation:</span>
                <span className="text-slate-400">
                  VPS CPU: <span className="text-white font-mono font-bold">{vpsStatus?.cpu?.usagePercent != null ? `${vpsStatus.cpu.usagePercent}%` : '—'}</span>
                  {vpsBaseline && vpsStatus?.cpu?.usagePercent != null && (
                    <span className="text-amber-400 font-bold ml-1">
                      (↑ from {vpsBaseline.cpu}% baseline)
                    </span>
                  )}
                  {' • '}
                  Memory: <span className="text-white font-mono font-bold">{vpsStatus?.memory?.usedMb} MB ({vpsStatus?.memory?.usedPercent}%)</span>
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {selectedRun.isRunning ? 'Active load monitoring' : 'Completed test snapshot'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Test Data & Synthetic Attendees Isolation Card */}
      {selectedRun && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-indigo-950/80 border border-indigo-800/40 text-indigo-400">
                <Database className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-white text-sm">
                    Test Data & Synthetic Attendees — Run #{selectedRun.id}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      (runTestData?.cleanupStatus || selectedRun.cleanupStatus) === 'COMPLETED'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                        : (runTestData?.cleanupStatus || selectedRun.cleanupStatus) === 'IN_PROGRESS'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800/50 animate-pulse'
                        : (runTestData?.cleanupStatus || selectedRun.cleanupStatus) === 'FAILED'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800/50'
                        : 'bg-yellow-950 text-yellow-300 border border-yellow-800/50'
                    }`}
                  >
                    {(runTestData?.cleanupStatus || selectedRun.cleanupStatus) === 'COMPLETED'
                      ? 'Cleaned Up'
                      : (runTestData?.cleanupStatus || selectedRun.cleanupStatus) === 'IN_PROGRESS'
                      ? 'Cleaning Up...'
                      : (runTestData?.cleanupStatus || selectedRun.cleanupStatus) === 'FAILED'
                      ? 'Cleanup Failed'
                      : 'Pending Cleanup'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Strictly isolated database records tagged with <code className="text-amber-400 font-mono">is_load_test: true</code>
                  {runTestData?.cleanedAt && (
                    <span className="text-slate-500 ml-2">
                      • Cleaned at {new Date(runTestData.cleanedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCleanupTestData(selectedRun.id)}
                disabled={selectedRun.isRunning || cleaningUpData || (runTestData?.counts?.totalTestAttendees === 0 && runTestData?.cleanupStatus === 'COMPLETED')}
                className="px-3 py-1.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/50 text-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                title="Purge synthetic attendees, check-ins, and scan logs while keeping telemetry"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {cleaningUpData ? 'Cleaning Up...' : 'Clean Up Test Data'}
              </button>
            </div>
          </div>

          {/* Test Data Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Test Attendees in DB</p>
              <p className="text-xl font-black text-white mt-1 font-mono">
                {loadingTestData ? '...' : runTestData?.counts?.totalTestAttendees ?? 0}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {runTestData?.counts?.totalTestAttendees === 0
                  ? 'All synthetic attendees cleared'
                  : 'Isolated test records present'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Simulated Check-ins</p>
              <p className="text-xl font-black text-emerald-400 mt-1 font-mono">
                {loadingTestData ? '...' : runTestData?.counts?.checkedIn ?? 0}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Recorded in DailyCheckin table</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pending Test Tokens</p>
              <p className="text-xl font-black text-amber-300 mt-1 font-mono">
                {loadingTestData ? '...' : runTestData?.counts?.pending ?? 0}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Unused synthetic passes</p>
            </div>
          </div>

          {/* Security & Isolation Notice */}
          <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-900/40 flex items-start gap-2.5 text-xs text-blue-200">
            <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-blue-300 text-[11px]">Strict Operational Data Isolation</p>
              <p className="text-[11px] text-blue-200/80 leading-relaxed mt-0.5">
                Synthetic attendees are strictly locked to <span className="font-mono text-amber-300">load_test_run_id = {selectedRun.id}</span> and excluded from the <strong>Attendees & Passes</strong> table, registration counts, staff metrics, commercial totals, reports, and gate turnstiles. Automated cleanup removes them after test completion.
              </p>
            </div>
          </div>

          {/* Expandable Sample Test Attendees Table */}
          {runTestData?.sampleAttendees && runTestData.sampleAttendees.length > 0 && (
            <div className="border border-slate-800/80 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAttendeesList((prev) => !prev)}
                className="w-full px-4 py-2.5 bg-slate-950/60 hover:bg-slate-950 text-left text-xs font-bold text-slate-300 flex items-center justify-between transition"
              >
                <span className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  Inspect Synthetic Test Tokens ({runTestData.sampleAttendees.length} records shown)
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showAttendeesList ? 'rotate-180' : ''}`} />
              </button>

              {showAttendeesList && (
                <div className="max-h-60 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-950/90 border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase">
                      <tr>
                        <th className="px-3 py-2">Ticket #</th>
                        <th className="px-3 py-2">Synthetic Attendee</th>
                        <th className="px-3 py-2">QR Token (Prefix)</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Booking Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 font-mono">
                      {runTestData.sampleAttendees.map((att: any) => (
                        <tr key={att.id} className="hover:bg-slate-800/20">
                          <td className="px-3 py-1.5 text-slate-300 font-sans">{att.ticketNumber}</td>
                          <td className="px-3 py-1.5 text-amber-300 font-sans">{att.name}</td>
                          <td className="px-3 py-1.5 text-slate-400 text-[10px]">{att.qrCodeToken ? att.qrCodeToken.slice(0, 24) + '...' : '—'}</td>
                          <td className="px-3 py-1.5 text-indigo-300 font-sans">{att.category}</td>
                          <td className="px-3 py-1.5 text-slate-400">{Array.isArray(att.bookingDays) ? att.bookingDays.join(', ') : att.bookingDays || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Live VPS Resource Monitoring Card */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-xl space-y-2.5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/40 text-emerald-400">
              <Server className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-sm">
                  LIVE VPS STATUS
                </h3>
                <span className="flex h-2 w-2 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isAnyTestRunning ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isAnyTestRunning ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {isAnyTestRunning ? 'Active test polling (3s)' : 'Idle polling (10s)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Real-time node telemetry & platform health diagnostics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadVpsStatus()}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh Metrics
            </button>
          </div>
        </div>

        {vpsError && (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>VPS metrics temporarily unavailable ({vpsError}) — displaying last known metrics.</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CPU Usage */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                CPU Usage
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {vpsStatus?.cpu?.cores ?? '—'} cores
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-white">
                {vpsStatus?.cpu?.usagePercent != null ? `${vpsStatus.cpu.usagePercent}%` : '—'}
              </span>
              {vpsBaseline && vpsStatus?.cpu?.usagePercent != null && (
                <span className={`text-[11px] font-bold ${vpsStatus.cpu.usagePercent >= vpsBaseline.cpu ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {vpsStatus.cpu.usagePercent >= vpsBaseline.cpu ? `↑ from ${vpsBaseline.cpu}%` : `↓ from ${vpsBaseline.cpu}%`}
                </span>
              )}
            </div>
            {/* CPU Bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  (vpsStatus?.cpu?.usagePercent || 0) > 80
                    ? 'bg-rose-500'
                    : (vpsStatus?.cpu?.usagePercent || 0) > 50
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, vpsStatus?.cpu?.usagePercent || 0))}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Load: {vpsStatus?.cpu?.loadAvg ? vpsStatus.cpu.loadAvg.map((l: number) => l.toFixed(2)).join(', ') : '—'}
            </p>
          </div>

          {/* Memory Usage */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                Memory Usage
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {vpsStatus?.memory?.usedPercent != null ? `${vpsStatus.memory.usedPercent}%` : '—'}
              </span>
            </div>
            <div className="text-xl font-black text-white">
              {vpsStatus?.memory ? (
                <>
                  {vpsStatus.memory.usedMb} <span className="text-xs text-slate-400 font-normal">/ {vpsStatus.memory.totalMb} MB</span>
                </>
              ) : '—'}
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  (vpsStatus?.memory?.usedPercent || 0) > 85
                    ? 'bg-rose-500'
                    : (vpsStatus?.memory?.usedPercent || 0) > 65
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, vpsStatus?.memory?.usedPercent || 0))}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Free: {vpsStatus?.memory?.freeMb != null ? `${vpsStatus.memory.freeMb} MB` : '—'}
            </p>
          </div>

          {/* Disk Usage */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                Disk Usage
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {vpsStatus?.disk?.usedPercent != null ? `${vpsStatus.disk.usedPercent}%` : '—'}
              </span>
            </div>
            <div className="text-xl font-black text-white">
              {vpsStatus?.disk ? (
                <>
                  {vpsStatus.disk.usedGb} <span className="text-xs text-slate-400 font-normal">/ {vpsStatus.disk.totalGb} GB</span>
                </>
              ) : '—'}
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  (vpsStatus?.disk?.usedPercent || 0) > 85
                    ? 'bg-rose-500'
                    : 'bg-purple-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, vpsStatus?.disk?.usedPercent || 0))}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Free: {vpsStatus?.disk?.freeGb != null ? `${vpsStatus.disk.freeGb} GB` : '—'}
            </p>
          </div>

          {/* Network I/O */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5 text-cyan-400" />
                Network Traffic
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">Live</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Network In (RX):</span>
                <span className="text-white font-mono font-bold">
                  {vpsStatus?.network?.rxMb != null ? `${vpsStatus.network.rxMb} MB` : '—'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Network Out (TX):</span>
                <span className="text-white font-mono font-bold">
                  {vpsStatus?.network?.txMb != null ? `${vpsStatus.network.txMb} MB` : '—'}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Measured interface traffic
            </p>
          </div>
        </div>

        {/* Services Status Row */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Services:</span>
          {/* API */}
          <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${vpsStatus?.services?.api === 'healthy' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span className="text-slate-300 font-semibold text-[11px]">API:</span>
            <span className={`font-mono text-[11px] font-bold ${vpsStatus?.services?.api === 'healthy' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {vpsStatus?.services?.api === 'healthy' ? 'Healthy' : 'Unhealthy'}
            </span>
          </div>

          {/* Database */}
          <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${vpsStatus?.services?.database === 'connected' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span className="text-slate-300 font-semibold text-[11px]">Database:</span>
            <span className={`font-mono text-[11px] font-bold ${vpsStatus?.services?.database === 'connected' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {vpsStatus?.services?.database === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Redis */}
          <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${vpsStatus?.services?.redis === 'connected' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span className="text-slate-300 font-semibold text-[11px]">Redis:</span>
            <span className={`font-mono text-[11px] font-bold ${vpsStatus?.services?.redis === 'connected' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {vpsStatus?.services?.redis === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Nginx */}
          <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${vpsStatus?.services?.nginx === 'running' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-slate-300 font-semibold text-[11px]">Nginx:</span>
            <span className={`font-mono text-[11px] font-bold ${vpsStatus?.services?.nginx === 'running' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {vpsStatus?.services?.nginx === 'running' ? 'Running' : 'Stopped'}
            </span>
          </div>
        </div>
      </div>

      {/* Control Configuration Form */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-xl space-y-3.5">
        <h3 className="font-extrabold text-xs text-white flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          Configure New Traffic Test Run
        </h3>

        <form onSubmit={handleStartTest} className="space-y-3.5">
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
                  NORMAL — 100% Success
                </option>
                <option value={LoadTestScenario.DUPLICATE}>
                  DUPLICATE — Success + Duplicate
                </option>
                <option value={LoadTestScenario.INVALID_QR}>
                  INVALID QR — 100% Invalid
                </option>
                <option value={LoadTestScenario.NOT_BOOKED}>
                  NOT BOOKED — 100% Not Booked
                </option>
                <option value={LoadTestScenario.PEAK_BURST}>
                  PEAK BURST — Maximum Concurrent Load
                </option>
                <option value={LoadTestScenario.MIXED}>
                  MIXED — 70% Normal / 20% Duplicate / 10% Invalid
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

          {/* Scenario description helper banner */}
          {SCENARIO_DETAILS[scenario] && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
              <span className="p-1 rounded bg-amber-950/80 border border-amber-800/40 text-amber-400 mt-0.5 shrink-0">
                <ChevronRight className="w-3 h-3" />
              </span>
              <div>
                <p className="font-bold text-amber-400 text-[11px]">
                  {SCENARIO_DETAILS[scenario].subLabel}
                </p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  {SCENARIO_DETAILS[scenario].description}
                </p>
              </div>
            </div>
          )}

          {/* Conditional Control: Peak Burst vs Physical Turnstile */}
          {isPeakBurst ? (
            <div className="p-5 rounded-xl bg-slate-950/70 border border-amber-900/40 space-y-4">
              <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-200 text-xs flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Peak Burst sends the selected number of requests as quickly as possible to test sudden traffic spikes.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Burst Level
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {BURST_LEVELS.map((level) => {
                    const isSelected = burstLevel === level.concurrency;
                    return (
                      <button
                        key={level.key}
                        type="button"
                        onClick={() => setBurstLevel(level.concurrency)}
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-950/60 border-amber-500 text-white shadow-lg shadow-amber-950/40'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="font-bold text-xs">{level.label}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {level.concurrency} reqs
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {level.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  Maximum concurrent requests sent immediately.
                </p>
              </div>

              {/* Peak Burst Summary */}
              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800/80 text-xs">
                <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center gap-2">
                  <span className="text-slate-400 text-[11px] font-medium">Total Concurrent Requests:</span>
                  <span className="text-amber-400 font-mono font-bold">{burstLevel}</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center gap-2">
                  <span className="text-slate-400 text-[11px] font-medium">Pacing:</span>
                  <span className="text-rose-400 font-mono font-bold">Instant Concurrent Spike (0s delay)</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center gap-2">
                  <span className="text-slate-400 text-[11px] font-medium">Target Concurrency:</span>
                  <span className="text-emerald-400 font-mono font-bold">{burstLevel} workers</span>
                </div>
              </div>
            </div>
          ) : (
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
                  <p className="text-[10px] text-slate-500 mt-1">Number of entrance gates to simulate.</p>
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
                <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center gap-2" aria-label={`Base Scan Actions: ~${baseScanActions}`}>
                  <span className="text-slate-400 text-[11px] font-medium">Base Scan Actions:</span>
                  <span className="text-cyan-400 font-mono font-bold">~{baseScanActions}</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center gap-2" aria-label={`Estimated HTTP Requests: ~${estimatedRequests}`}>
                  <span className="text-slate-400 text-[11px] font-medium">Estimated HTTP Requests:</span>
                  <span className="text-purple-400 font-mono font-bold">~{estimatedRequests}</span>
                </div>
              </div>
            </div>
          )}

          {/* High-Load Warning Banner */}
          {loadWarning && !isExceedingLimit && (
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
                loadWarning.level === 'critical' || loadWarning.level === 'danger'
                  ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                  : loadWarning.level === 'warning'
                  ? 'bg-amber-950/60 border-amber-500/40 text-amber-200'
                  : 'bg-blue-950/60 border-blue-500/40 text-blue-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                <strong className="uppercase font-bold tracking-wide mr-1.5">[{loadWarning.level}]</strong>
                {loadWarning.message} ({effectiveWorkers} concurrent workers)
              </span>
            </div>
          )}

          {/* Hard Concurrency Limit Exceeded Warning */}
          {isExceedingLimit && (
            <div className="p-3.5 rounded-xl border bg-red-950/80 border-red-500/60 text-red-200 flex items-center gap-2.5 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>
                Safety limit exceeded: Configured total workers ({effectiveWorkers}) exceeds maximum safe concurrency limit of {MAX_SAFE_CONCURRENCY}. Please reduce the number of gates or scanners per gate.
              </span>
            </div>
          )}

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
              disabled={starting || isExceedingLimit}
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
                      <div className="flex flex-col gap-1 items-start">
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
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                            r.cleanupStatus === 'COMPLETED'
                              ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40'
                              : r.cleanupStatus === 'IN_PROGRESS'
                              ? 'text-amber-400 bg-amber-950/40 border border-amber-800/40'
                              : r.cleanupStatus === 'FAILED'
                              ? 'text-rose-400 bg-rose-950/40 border border-rose-800/40'
                              : 'text-slate-400 bg-slate-800/40'
                          }`}
                        >
                          {r.cleanupStatus === 'COMPLETED'
                            ? 'Cleaned'
                            : r.cleanupStatus === 'IN_PROGRESS'
                            ? 'Cleaning...'
                            : r.cleanupStatus === 'FAILED'
                            ? 'Cleanup Err'
                            : 'Pending'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {r.cleanupStatus !== 'COMPLETED' && r.status !== LoadTestStatus.RUNNING && (
                          <button
                            onClick={() => handleCleanupTestData(r.id)}
                            className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-200 hover:bg-slate-800 transition"
                            title="Clean up synthetic attendees (keep telemetry)"
                          >
                            <Database className="w-3.5 h-3.5" />
                          </button>
                        )}
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
