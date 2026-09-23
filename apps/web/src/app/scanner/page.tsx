'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Camera,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Wifi,
  WifiOff,
  Flashlight,
  RefreshCw,
  History,
  Settings,
  UserCheck,
  DoorOpen,
  ScanLine,
  ArrowLeft,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { CheckinResult } from '@ongc/shared-types';

export default function ScannerPage() {
  const [gateId, setGateId] = useState('1');
  const [gates, setGates] = useState<any[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  // Status & states
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'unstable' | 'offline'>('online');
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'success' | 'duplicate' | 'error'>('idle');
  const [lastResult, setLastResult] = useState<any | null>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [cameraErrorMessage, setCameraErrorMessage] = useState('');
  const [showRecentModal, setShowRecentModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Audio synthesis feedback
  const playFeedbackAudio = (type: 'success' | 'duplicate' | 'error') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'duplicate') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {}
  };

  const triggerVibration = (type: 'success' | 'duplicate' | 'error') => {
    if (!vibrationEnabled || typeof window === 'undefined' || !navigator.vibrate) return;
    try {
      if (type === 'success') navigator.vibrate(80);
      else if (type === 'duplicate') navigator.vibrate([100, 50, 100]);
      else navigator.vibrate([200, 100, 200]);
    } catch {}
  };

  // Heartbeat ping loop
  const checkPing = async () => {
    const start = Date.now();
    try {
      await fetchApi('/scanner/heartbeat', {
        method: 'POST',
        body: JSON.stringify({
          gateId,
          deviceId: 'web-scanner-' + (typeof window !== 'undefined' ? window.navigator.userAgent.slice(0, 8) : '01'),
        }),
      });
      const latency = Date.now() - start;
      setPingLatency(latency);
      setConnectionStatus(latency > 800 ? 'unstable' : 'online');
    } catch {
      setConnectionStatus('offline');
    }
  };

  useEffect(() => {
    checkPing();
    const interval = setInterval(checkPing, 8000);
    return () => clearInterval(interval);
  }, [gateId]);

  // Load available gates
  useEffect(() => {
    async function loadGates() {
      try {
        const data = await fetchApi('/admin/gates');
        setGates(data || []);
        if (data && data.length > 0) {
          setGateId(data[0].id);
        }
      } catch {
        setGates([
          { id: '1', name: 'Main Gate', code: 'MAIN' },
          { id: '2', name: 'Gate 2 (Officers Entry)', code: 'GATE-2' },
          { id: '3', name: 'Gate 3 (Family Turnstile)', code: 'GATE-3' },
        ]);
      }
    }
    loadGates();
  }, []);

  // Process a scanned or manual token
  const processToken = async (rawToken: string) => {
    const token = rawToken.trim();
    if (!token) return;

    const start = Date.now();

    try {
      const res = await fetchApi('/scanner/checkin', {
        method: 'POST',
        body: JSON.stringify({
          token,
          gateId,
        }),
      });

      const latency = Date.now() - start;
      setPingLatency(latency);

      if (res.result === CheckinResult.SUCCESS) {
        setScanState('success');
        playFeedbackAudio('success');
        triggerVibration('success');
      } else if (res.result === CheckinResult.ALREADY_CHECKED_IN) {
        setScanState('duplicate');
        playFeedbackAudio('duplicate');
        triggerVibration('duplicate');
      } else {
        setScanState('error');
        playFeedbackAudio('error');
        triggerVibration('error');
      }

      setLastResult(res);

      // Add to recent scans
      setRecentScans((prev) => [
        {
          key: Date.now() + Math.random(),
          ok: res.result === CheckinResult.SUCCESS,
          name: res.attendeeName || 'Unknown Attendee',
          line2: `${res.result} • ${res.ticketNumber || token.slice(0, 10)}`,
        },
        ...prev.slice(0, 19),
      ]);
    } catch (err: any) {
      setScanState('error');
      playFeedbackAudio('error');
      triggerVibration('error');
      setLastResult({
        result: CheckinResult.INVALID_QR,
        message: err.message || 'Verification rejected',
      });
    }
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processToken(manualInput);
    setManualInput('');
  };

  // Mock Camera activation for Browser
  useEffect(() => {
    setCameraReady(true);
  }, []);

  const activeGateObj = gates.find((g) => g.id === gateId) || { name: 'Main Gate', code: 'MAIN' };

  return (
    <div className="min-h-screen bg-cream text-ink font-sans p-4 sm:p-6 selection:bg-maroon selection:text-white">
      <div className="max-w-5xl mx-auto space-y-4">
        
        {/* Top Header Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-maroon hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Admin Portal</span>
          </Link>

          <span className="text-xs font-bold font-cinzel text-maroon">
            ONGC NAVRATRI &bull; LIVE SCANNER
          </span>
        </div>

        {/* Operator & Active Gate Banner */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 card-shadow flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-maroon-soft border border-maroon/20 flex items-center justify-center text-maroon font-bold text-sm shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-ink-soft">Operator:</span>
                <span className="text-xs font-bold text-ink">Turnstile Staff</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cream-soft border border-stone-200 text-ink-soft">
                  GATE OPERATOR
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-ink-soft">Assigned Gate:</span>
                <select
                  value={gateId}
                  onChange={(e) => setGateId(e.target.value)}
                  className="text-xs font-bold text-maroon bg-cream-soft border border-stone-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-maroon"
                >
                  {gates.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.code || g.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                connectionStatus === 'online'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : connectionStatus === 'unstable'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'online'
                    ? 'bg-emerald-500 animate-pulse'
                    : connectionStatus === 'unstable'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-rose-500'
                }`}
              />
              <span>
                {connectionStatus === 'online'
                  ? `Online${pingLatency ? ` · ${pingLatency}ms` : ''}`
                  : connectionStatus === 'unstable'
                  ? 'Unstable Signal'
                  : 'Offline'}
              </span>
            </span>
          </div>
        </div>

        {/* Scanner & Result Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
          {/* LEFT: Camera Viewport & Manual Fallback */}
          <div className="lg:col-span-3 space-y-4">
            {/* Camera Card */}
            <div className="bg-white rounded-3xl p-4 border border-stone-200/80 card-shadow">
              <div className="flex items-center justify-between px-1.5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-outfit font-bold text-ink text-sm">
                    {activeGateObj.name}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Camera Active</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-1.5 rounded-lg bg-cream-soft border border-stone-200 text-ink hover:border-maroon/40 transition-colors"
                    title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-maroon" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-stone-400" />
                    )}
                  </button>
                  <button
                    onClick={() => setShowRecentModal(true)}
                    type="button"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cream-soft border border-stone-200 text-xs font-semibold text-ink hover:border-maroon/40 transition-colors"
                  >
                    <History className="w-3.5 h-3.5 text-maroon" />
                    <span className="hidden sm:inline">Scans</span>
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-maroon text-white text-[10px] font-bold inline-flex items-center justify-center">
                      {recentScans.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Viewport Box with Gold Corner Brackets */}
              <div className="relative w-full aspect-square max-h-[min(46vh,400px)] bg-black rounded-2xl overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-[70%] aspect-square">
                    <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-gold rounded-tl-xl" />
                    <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-gold rounded-tr-xl" />
                    <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-gold rounded-bl-xl" />
                    <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-gold rounded-br-xl" />
                    <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-white/70 text-xs font-bold uppercase tracking-[0.2em]">
                      Scan QR
                    </span>
                  </div>
                </div>

                <div className="text-center space-y-2 p-6 z-10">
                  <ScanLine className="w-12 h-12 text-gold animate-bounce mx-auto opacity-70" />
                  <p className="text-xs text-white/60">Position QR code within frame</p>
                </div>
              </div>

              <p className="text-center text-xs text-ink-soft mt-3">
                Point the attendee's QR code inside the frame.
              </p>
            </div>

            {/* Manual Fallback Card */}
            <div className="bg-white rounded-3xl p-5 border border-stone-200/80 card-shadow space-y-2">
              <p className="text-xs font-bold text-ink">Can&rsquo;t scan the QR?</p>
              <label className="block text-[11px] text-ink-soft">
                Enter Ticket ID or QR Token manually
              </label>
              <form onSubmit={submitManual} className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="e.g. NR2026-000001"
                  className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-ink font-mono text-xs uppercase tracking-wide placeholder-stone-400 focus:outline-none focus:border-maroon focus:bg-white"
                />
                <button
                  type="submit"
                  className="shrink-0 px-5 py-2.5 rounded-xl bg-maroon text-white text-xs font-bold hover:bg-maroon-dark transition-all border border-gold/30"
                >
                  Verify Ticket
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT: Scan Result & Recent Scans */}
          <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-6">
            <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow p-6 min-h-[300px] flex flex-col justify-center">
              {scanState === 'idle' && (
                <div className="text-center text-ink-soft space-y-3 py-10">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-cream-soft flex items-center justify-center text-stone-300">
                    <ScanLine className="w-7 h-7" />
                  </div>
                  <p className="text-xs font-semibold">Scan results will appear here instantly.</p>
                </div>
              )}

              {scanState === 'success' && lastResult && (
                <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 space-y-4 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-cinzel font-bold text-xs uppercase tracking-wider text-emerald-800 block">
                        ENTRY APPROVED
                      </span>
                      <h3 className="font-outfit font-extrabold text-xl text-emerald-950">
                        {lastResult.attendeeName || 'Authorized Attendee'}
                      </h3>
                    </div>
                  </div>

                  <div className="bg-white/80 p-3 rounded-xl border border-emerald-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Ticket:</span>
                      <span className="font-mono font-bold text-emerald-900">{lastResult.ticketNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Category:</span>
                      <span className="font-semibold text-stone-800">{lastResult.relation || 'Staff / Family'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Gate:</span>
                      <span className="font-semibold text-stone-800">{activeGateObj.name}</span>
                    </div>
                  </div>
                </div>
              )}

              {scanState === 'duplicate' && lastResult && (
                <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-500 space-y-4 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-cinzel font-bold text-xs uppercase tracking-wider text-amber-800 block">
                        DUPLICATE ENTRY ALERT
                      </span>
                      <h3 className="font-outfit font-extrabold text-lg text-amber-950">
                        Already Checked In Today
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs text-amber-900 bg-white/80 p-3 rounded-xl border border-amber-200">
                    {lastResult.message || 'Pass has already been verified at turnstile.'}
                  </p>
                </div>
              )}

              {scanState === 'error' && lastResult && (
                <div className="p-5 rounded-2xl bg-rose-50 border-2 border-rose-500 space-y-4 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-8 h-8 text-rose-600 shrink-0" />
                    <div>
                      <span className="font-cinzel font-bold text-xs uppercase tracking-wider text-rose-800 block">
                        ENTRY REJECTED
                      </span>
                      <h3 className="font-outfit font-extrabold text-lg text-rose-950">
                        Invalid Pass
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs text-rose-900 bg-white/80 p-3 rounded-xl border border-rose-200">
                    {lastResult.message || 'Pass token is invalid or inactive.'}
                  </p>
                </div>
              )}
            </div>

            {/* Recent Scans Box */}
            <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow p-5">
              <h3 className="font-outfit font-bold text-ink text-sm mb-3">Recent Session Scans</h3>
              <div className="space-y-2">
                {recentScans.map((scan) => (
                  <div key={scan.key} className="flex items-start gap-2.5 py-1.5 border-b border-stone-100 last:border-0">
                    {scan.ok ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-ink truncate">{scan.name}</div>
                      <div className="text-[11px] text-ink-soft truncate">{scan.line2}</div>
                    </div>
                  </div>
                ))}
                {recentScans.length === 0 && (
                  <p className="text-xs text-ink-soft text-center py-4">No scans yet this session.</p>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
