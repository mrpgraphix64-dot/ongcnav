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

const SCANNER_ELEMENT_ID = 'qr-scanner-viewport';
export const DUPLICATE_DECODE_SUPPRESS_MS = 4500;
export const SUCCESS_BANNER_DURATION_MS = 3000;
export const ERROR_BANNER_DURATION_MS = 4000;

export function shouldProcessScan(
  lastDecode: { text: string; at: number } | null,
  newText: string,
  now: number = Date.now(),
  suppressMs: number = DUPLICATE_DECODE_SUPPRESS_MS,
): boolean {
  if (!newText || !newText.trim()) return false;
  if (!lastDecode) return true;
  if (lastDecode.text === newText.trim() && now - lastDecode.at < suppressMs) {
    return false;
  }
  return true;
}

interface StaffIdentity {
  id: string;
  staffId: string;
  name: string;
  role: string;
  assignedGates: { id: string; name: string; gateNumber?: string }[];
}

const ADMIN_TIER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'EVENT_ADMIN'];

export default function ScannerPage() {
  const [gateId, setGateId] = useState('');
  const [gates, setGates] = useState<any[]>([]);
  const [gatesLoading, setGatesLoading] = useState(true);
  const [manualInput, setManualInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  // Authenticated scanner staff identity — never assumed, always fetched
  // from the server (/auth/me), which derives it from the session cookie.
  const [staff, setStaff] = useState<StaffIdentity | null>(null);
  const [staffLoadFailed, setStaffLoadFailed] = useState(false);

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

  const html5QrCodeRef = useRef<any>(null);
  const processingRef = useRef(false);
  const lastDecodeRef = useRef<{ text: string; at: number } | null>(null);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const gateIdRef = useRef(gateId);
  useEffect(() => {
    gateIdRef.current = gateId;
  }, [gateId]);

  // Keep refs synchronized with state to prevent stale closures in camera callbacks
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const vibrationEnabledRef = useRef(vibrationEnabled);
  useEffect(() => {
    vibrationEnabledRef.current = vibrationEnabled;
  }, [vibrationEnabled]);

  const scanStateRef = useRef(scanState);
  useEffect(() => {
    scanStateRef.current = scanState;
  }, [scanState]);

  const lastSuccessTokenRef = useRef<string | null>(null);
  const processTokenRef = useRef<(rawToken: string) => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };
  }, []);

  // Audio synthesis feedback — always reads latest setting via ref to avoid stale closures
  const playFeedbackAudio = (type: 'success' | 'duplicate' | 'error') => {
    if (!soundEnabledRef.current || typeof window === 'undefined') return;
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
    if (!vibrationEnabledRef.current || typeof window === 'undefined' || !navigator.vibrate) return;
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

  // Fetch the authenticated scanner's real identity from the server — never
  // assumed or hardcoded. Gate access is then scoped from THIS response
  // (assignedGates), not from a client-editable value: a non-admin scanner
  // only ever sees the gate(s) they are actually assigned to. Admin-tier
  // roles (who aren't restricted to specific gate assignments) fall back to
  // the full gate list.
  useEffect(() => {
    async function loadStaffAndGates() {
      try {
        const me = await fetchApi('/auth/me');
        if (!me?.user) throw new Error('Not authenticated');

        const identity: StaffIdentity = {
          id: me.user.id,
          staffId: me.user.staffId,
          name: me.user.name,
          role: me.user.role,
          assignedGates: me.user.assignedGates || [],
        };
        setStaff(identity);

        if (identity.assignedGates.length > 0) {
          setGates(identity.assignedGates);
          setGateId(identity.assignedGates[0].id);
        } else if (ADMIN_TIER_ROLES.includes(identity.role)) {
          try {
            const allGates = await fetchApi('/admin/gates');
            setGates(allGates || []);
            if (allGates && allGates.length > 0) setGateId(allGates[0].id);
          } catch {
            setGates([]);
          }
        } else {
          setGates([]);
        }
      } catch {
        setStaffLoadFailed(true);
        setGates([]);
      } finally {
        setGatesLoading(false);
      }
    }
    loadStaffAndGates();
  }, []);

  // Process a scanned or manual token. Guarded by processingRef so a
  // second scan/submit can never overlap an in-flight one (double-tap,
  // camera re-decoding the same frame, etc.).
  const processToken = async (rawToken: string) => {
    const token = rawToken.trim();
    if (!token || processingRef.current) return;
    if (!gateIdRef.current) {
      setScanState('error');
      setLastResult({ result: CheckinResult.INVALID_QR, message: 'No gate selected. Cannot process scan.' });
      return;
    }

    // Redundant decode protection: while success banner is actively showing
    // for this token, ignore redundant camera frames to prevent banner flip
    if (scanStateRef.current === 'success' && lastSuccessTokenRef.current === token) {
      return;
    }

    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }

    processingRef.current = true;
    const start = Date.now();

    try {
      const res = await fetchApi('/scanner/checkin', {
        method: 'POST',
        body: JSON.stringify({
          token,
          gateId: gateIdRef.current,
        }),
      });

      if (!isMountedRef.current) return;

      const latency = Date.now() - start;
      setPingLatency(latency);

      // checkin.service.ts nests attendee/ticket/gate details under `.data`
      // for a SUCCESS result but returns them flat for other results (e.g.
      // ALREADY_CHECKED_IN, NOT_BOOKED_TODAY) — normalize both shapes here
      // so the UI below only ever needs one consistent set of fields.
      const normalized = {
        ...res,
        attendeeName: res.attendeeName || res.data?.attendeeName,
        ticketNumber: res.ticketNumber || res.data?.ticketNumber,
        relation: res.relation || res.data?.relation,
        gateName: res.gateName || res.data?.gate?.name,
      };

      if (res.result === CheckinResult.SUCCESS) {
        lastSuccessTokenRef.current = token;
        setScanState('success');
        playFeedbackAudio('success');
        triggerVibration('success');
        resetTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            lastSuccessTokenRef.current = null;
            setScanState('scanning');
          }
        }, SUCCESS_BANNER_DURATION_MS);
      } else if (res.result === CheckinResult.ALREADY_CHECKED_IN) {
        lastSuccessTokenRef.current = null;
        setScanState('duplicate');
        playFeedbackAudio('duplicate');
        triggerVibration('duplicate');
        resetTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setScanState('scanning');
          }
        }, ERROR_BANNER_DURATION_MS);
      } else {
        lastSuccessTokenRef.current = null;
        setScanState('error');
        playFeedbackAudio('error');
        triggerVibration('error');
        resetTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setScanState('scanning');
          }
        }, ERROR_BANNER_DURATION_MS);
      }

      setLastResult(normalized);

      // Add to recent scans
      setRecentScans((prev) => [
        {
          key: Date.now() + Math.random(),
          ok: res.result === CheckinResult.SUCCESS,
          name: normalized.attendeeName || 'Unknown Attendee',
          line2: `${res.result} • ${normalized.ticketNumber || token.slice(0, 10)}`,
        },
        ...prev.slice(0, 19),
      ]);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      lastSuccessTokenRef.current = null;
      setScanState('error');
      playFeedbackAudio('error');
      triggerVibration('error');
      resetTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setScanState('scanning');
        }
      }, ERROR_BANNER_DURATION_MS);
      setLastResult({
        result: CheckinResult.INVALID_QR,
        message: err.message || 'Verification rejected',
      });
    } finally {
      processingRef.current = false;
    }
  };

  // Synchronize processTokenRef on every render so startCamera callbacks never run stale closures
  useEffect(() => {
    processTokenRef.current = processToken;
  });

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processToken(manualInput);
    setManualInput('');
  };

  // Real camera QR scanning via html5-qrcode dependency with hardened
  // async lifecycle management against unmount races.
  useEffect(() => {
    let unmounted = false;
    let isStarting = false;
    let createdInstance: any = null;

    async function startCamera() {
      try {
        isStarting = true;
        const { Html5Qrcode } = await import('html5-qrcode');
        if (unmounted) return;

        const instance = new Html5Qrcode(SCANNER_ELEMENT_ID);
        createdInstance = instance;
        html5QrCodeRef.current = instance;

        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            const now = Date.now();
            if (!shouldProcessScan(lastDecodeRef.current, decodedText, now)) {
              return;
            }
            lastDecodeRef.current = { text: decodedText.trim(), at: now };
            processTokenRef.current(decodedText);
          },
          () => {
            // Per-frame "no QR found" callback — expected continuously
            // while nothing is in frame, intentionally ignored.
          },
        );

        isStarting = false;

        // If unmount occurred while instance.start() was resolving,
        // safely stop and release the newly-running instance.
        if (unmounted) {
          try {
            if (instance.isScanning) {
              await instance.stop();
            }
            instance.clear();
          } catch {}
          return;
        }

        setCameraReady(true);
        setCameraError(false);
        setScanState('scanning');
      } catch (err: any) {
        isStarting = false;
        if (!unmounted) {
          setCameraError(true);
          setCameraErrorMessage(
            err?.message || 'Could not access the camera. Check permissions or use manual entry below.',
          );
        }
      }
    }

    startCamera();

    return () => {
      unmounted = true;
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
      const instance = createdInstance || html5QrCodeRef.current;
      // If start() is not currently in flight and the instance is active, stop it safely.
      if (instance && !isStarting) {
        try {
          if (instance.isScanning) {
            instance
              .stop()
              .then(() => instance.clear())
              .catch(() => {});
          } else {
            instance.clear();
          }
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                <span className="text-xs font-bold text-ink">
                  {staffLoadFailed ? 'Not signed in' : staff?.name || 'Loading…'}
                </span>
                {staff && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cream-soft border border-stone-200 text-ink-soft">
                    {staff.role.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-ink-soft">Assigned Gate:</span>
                {gatesLoading ? (
                  <span className="text-xs text-ink-soft">Loading gates…</span>
                ) : gates.length === 0 ? (
                  <span className="text-xs font-bold text-rose-700">No gate assigned — contact admin</span>
                ) : (
                  <select
                    value={gateId}
                    onChange={(e) => setGateId(e.target.value)}
                    className="text-xs font-bold text-maroon bg-cream-soft border border-stone-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-maroon"
                  >
                    {gates.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.gateNumber || g.code || g.id})
                      </option>
                    ))}
                  </select>
                )}
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
                  {cameraReady && !cameraError ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Camera Active</span>
                    </span>
                  ) : cameraError ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span>Camera Unavailable</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span>Starting Camera…</span>
                    </span>
                  )}
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

              {/* Viewport Box — html5-qrcode renders the live camera feed
                  directly into #qr-scanner-viewport; the gold corner
                  brackets are a purely decorative overlay on top of it. */}
              <div className="relative w-full aspect-square max-h-[min(46vh,400px)] bg-black rounded-2xl overflow-hidden flex items-center justify-center">
                <div id={SCANNER_ELEMENT_ID} className="absolute inset-0 w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />

                {!cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative w-[70%] aspect-square">
                      <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-gold rounded-tl-xl" />
                      <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-gold rounded-tr-xl" />
                      <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-gold rounded-bl-xl" />
                      <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-gold rounded-br-xl" />
                    </div>
                  </div>
                )}

                {!cameraReady && !cameraError && (
                  <div className="text-center space-y-2 p-6 z-10 pointer-events-none">
                    <ScanLine className="w-12 h-12 text-gold animate-bounce mx-auto opacity-70" />
                    <p className="text-xs text-white/60">Starting camera…</p>
                  </div>
                )}

                {cameraError && (
                  <div className="text-center space-y-2 p-6 z-10 max-w-xs">
                    <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
                    <p className="text-xs text-white/80">{cameraErrorMessage}</p>
                    <p className="text-[11px] text-white/50">Use the manual entry field below instead.</p>
                  </div>
                )}
              </div>

              <p className="text-center text-xs text-ink-soft mt-3">
                {cameraReady && !cameraError
                  ? "Point the attendee's QR code inside the frame."
                  : 'Camera unavailable — use manual ticket entry below.'}
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
              {(scanState === 'idle' || scanState === 'scanning') && (
                <div className="text-center text-ink-soft space-y-3 py-10">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-cream-soft flex items-center justify-center text-stone-300">
                    <ScanLine className={`w-7 h-7 ${scanState === 'scanning' ? 'text-maroon animate-pulse' : 'text-stone-300'}`} />
                  </div>
                  <p className="text-xs font-semibold">
                    {scanState === 'scanning'
                      ? 'Ready for scan. Align QR code in camera view.'
                      : 'Scan results will appear here instantly.'}
                  </p>
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
                lastResult.result === CheckinResult.NOT_BOOKED_TODAY ? (
                  <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-500 space-y-4 animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0" />
                      <div>
                        <span className="font-cinzel font-bold text-xs uppercase tracking-wider text-amber-800 block">
                          WRONG DATE
                        </span>
                        <h3 className="font-outfit font-extrabold text-lg text-amber-950">
                          Not Booked For Today
                        </h3>
                      </div>
                    </div>
                    {lastResult.attendeeName && (
                      <p className="text-xs font-bold text-amber-950">
                        Attendee: {lastResult.attendeeName}
                      </p>
                    )}
                    <p className="text-xs text-amber-900 bg-white/80 p-3 rounded-xl border border-amber-200">
                      {lastResult.message || 'Pass is not registered for today.'}
                    </p>
                  </div>
                ) : lastResult.result === CheckinResult.ATTENDEE_INACTIVE ? (
                  <div className="p-5 rounded-2xl bg-purple-50 border-2 border-purple-500 space-y-4 animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <XCircle className="w-8 h-8 text-purple-600 shrink-0" />
                      <div>
                        <span className="font-cinzel font-bold text-xs uppercase tracking-wider text-purple-800 block">
                          PASS INACTIVE
                        </span>
                        <h3 className="font-outfit font-extrabold text-lg text-purple-950">
                          Pass Revoked / Suspended
                        </h3>
                      </div>
                    </div>
                    <p className="text-xs text-purple-900 bg-white/80 p-3 rounded-xl border border-purple-200">
                      {lastResult.message || 'This pass is inactive or cancelled.'}
                    </p>
                  </div>
                ) : lastResult.result === CheckinResult.RATE_LIMITED ? (
                  <div className="p-5 rounded-2xl bg-yellow-50 border-2 border-yellow-500 space-y-4 animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-8 h-8 text-yellow-600 shrink-0" />
                      <div>
                        <span className="font-cinzel font-bold text-xs uppercase tracking-wider text-yellow-800 block">
                          RATE LIMITED
                        </span>
                        <h3 className="font-outfit font-extrabold text-lg text-yellow-950">
                          Slow Down Scanning
                        </h3>
                      </div>
                    </div>
                    <p className="text-xs text-yellow-900 bg-white/80 p-3 rounded-xl border border-yellow-200">
                      {lastResult.message || 'Too many scans in a short period. Please wait a moment.'}
                    </p>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-rose-50 border-2 border-rose-500 space-y-4 animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <XCircle className="w-8 h-8 text-rose-600 shrink-0" />
                      <div>
                        <span className="font-cinzel font-bold text-xs uppercase tracking-wider text-rose-800 block">
                          ENTRY REJECTED
                        </span>
                        <h3 className="font-outfit font-extrabold text-lg text-rose-950">
                          {lastResult.result === CheckinResult.UNAUTHORIZED_GATE ? 'Unauthorized Gate' : 'Invalid Pass'}
                        </h3>
                      </div>
                    </div>
                    <p className="text-xs text-rose-900 bg-white/80 p-3 rounded-xl border border-rose-200">
                      {lastResult.message || 'Pass token is invalid or unrecognized.'}
                    </p>
                  </div>
                )
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
