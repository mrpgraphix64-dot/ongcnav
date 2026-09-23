'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Camera,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Wifi,
  WifiOff,
  Battery,
  ShieldAlert,
  ArrowLeft,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { CheckinResult } from '@ongc/shared-types';

export default function ScannerPwaPage() {
  const [gateId, setGateId] = useState('1');
  const [gates, setGates] = useState<any[]>([]);
  const [scannerActive, setScannerActive] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Scanner status & result
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionState, setConnectionState] = useState<'ONLINE' | 'UNSTABLE' | 'OFFLINE'>('ONLINE');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState<string | null>(null);

  const scannerRef = useRef<any>(null);
  const html5QrCodeRef = useRef<any>(null);

  // Audio synthesis helper for instant feedback without external audio files
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
        // High pitched pleasant double chirp (880Hz -> 1760Hz)
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'duplicate') {
        // Low buzzy warning tone (220Hz -> 110Hz)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else {
        // Harsh error buzz
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {}
  };

  // Heartbeat loop every 8 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkHeartbeat = async () => {
      const start = Date.now();
      try {
        const res = await fetchApi('/scanner/heartbeat', {
          method: 'POST',
          body: JSON.stringify({
            gateId,
            deviceId: 'web-scanner-' + (typeof window !== 'undefined' ? window.navigator.userAgent.slice(0, 10) : '01'),
          }),
        });

        const roundTrip = Date.now() - start;
        setLatencyMs(roundTrip);
        setConnectionState(roundTrip > 800 ? 'UNSTABLE' : 'ONLINE');
        setEmergencyStop(!!res.isEmergencyStopped);
      } catch {
        setConnectionState('OFFLINE');
      }
    };

    checkHeartbeat();
    interval = setInterval(checkHeartbeat, 8000);
    return () => clearInterval(interval);
  }, [gateId]);

  // Load available gates
  useEffect(() => {
    async function loadGates() {
      try {
        const data = await fetchApi('/admin/gates');
        setGates(data || []);
        if (data && data.length > 0 && !gateId) {
          setGateId(data[0].id);
        }
      } catch {
        // Fallback default gates
        setGates([
          { id: '1', name: 'Gate 1 (Main Entrance)', gateNumber: '1', isOpen: true },
          { id: '2', name: 'Gate 2 (Officers Entry)', gateNumber: '2', isOpen: true },
          { id: '3', name: 'Gate 3 (Family Turnstile)', gateNumber: '3', isOpen: true },
        ]);
      }
    }
    loadGates();
  }, []);

  // Process a scanned QR token
  const handleScanToken = async (scannedToken: string) => {
    if (isProcessing) return;
    const token = scannedToken.trim();
    if (!token) return;

    setIsProcessing(true);
    const startReq = Date.now();

    try {
      const response = await fetchApi('/scanner/checkin', {
        method: 'POST',
        body: JSON.stringify({
          token,
          gateId,
        }),
      });

      const latency = Date.now() - startReq;
      setLatencyMs(latency);
      setScanResult({ ...response, latency });

      if (response.result === CheckinResult.SUCCESS) {
        playFeedbackAudio('success');
      } else if (response.result === CheckinResult.ALREADY_CHECKED_IN) {
        playFeedbackAudio('duplicate');
      } else {
        playFeedbackAudio('error');
      }
    } catch (err: any) {
      setScanResult({
        success: false,
        result: CheckinResult.ERROR,
        message: err.message || 'Checkin scan failed',
        latency: Date.now() - startReq,
      });
      playFeedbackAudio('error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset scanner for next person
  const resetScanner = () => {
    setScanResult(null);
    setManualToken('');
  };

  // Initialize camera scanner
  const startCamera = async () => {
    setScannerActive(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop().catch(() => {});
      }

      const qrScanner = new Html5Qrcode('qr-reader-target');
      html5QrCodeRef.current = qrScanner;

      await qrScanner.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScanToken(decodedText);
        },
        () => {},
      );
    } catch (e) {
      console.warn('Camera failed to start:', e);
      setScannerActive(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      await html5QrCodeRef.current.stop().catch(() => {});
      html5QrCodeRef.current = null;
    }
    setScannerActive(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-red-600 select-none">
      {/* Top Scanner HUD */}
      <header className="p-4 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight">TURNSTILE SCANNER</span>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  connectionState === 'ONLINE'
                    ? 'bg-emerald-500 animate-pulse'
                    : connectionState === 'UNSTABLE'
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
              />
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>{connectionState}</span>
              {latencyMs !== null && <span>• {latencyMs}ms</span>}
            </div>
          </div>
        </div>

        {/* Gate selector & sound toggle */}
        <div className="flex items-center gap-2">
          <select
            value={gateId}
            onChange={(e) => setGateId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:border-red-500"
          >
            {gates.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            title="Toggle Sound"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>
        </div>
      </header>

      {/* Emergency Stop Banner */}
      {emergencyStop && (
        <div className="bg-red-600 text-white px-4 py-2.5 text-center font-black tracking-wider text-xs uppercase flex items-center justify-center gap-2">
          <ShieldAlert className="w-5 h-5 animate-bounce" />
          <span>ALL GATES EMERGENCY STOP ACTIVATED</span>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* RESULT FULLSCREEN MODAL / OVERLAY */}
        {scanResult && (
          <div
            onClick={resetScanner}
            className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer ${
              scanResult.result === CheckinResult.SUCCESS
                ? 'bg-emerald-600 text-white'
                : scanResult.result === CheckinResult.ALREADY_CHECKED_IN
                ? 'bg-rose-700 text-white'
                : 'bg-amber-600 text-white'
            }`}
          >
            <div className="max-w-md w-full space-y-4">
              {scanResult.result === CheckinResult.SUCCESS ? (
                <CheckCircle className="w-24 h-24 mx-auto animate-bounce text-white" />
              ) : scanResult.result === CheckinResult.ALREADY_CHECKED_IN ? (
                <XCircle className="w-24 h-24 mx-auto animate-shake text-white" />
              ) : (
                <AlertTriangle className="w-24 h-24 mx-auto text-white" />
              )}

              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">
                {scanResult.result === CheckinResult.SUCCESS
                  ? 'ENTRY GRANTED'
                  : scanResult.result === CheckinResult.ALREADY_CHECKED_IN
                  ? 'ALREADY CHECKED IN'
                  : scanResult.result}
              </h1>

              <p className="text-lg font-medium opacity-90">
                {scanResult.message}
              </p>

              {scanResult.data && (
                <div className="p-4 rounded-2xl bg-black/20 backdrop-blur-sm text-left space-y-2 mt-4">
                  <div className="text-xs uppercase tracking-wider opacity-75">
                    {scanResult.data.relation}
                  </div>
                  <div className="text-2xl font-bold">
                    {scanResult.data.attendeeName}
                  </div>
                  <div className="text-sm font-mono opacity-90">
                    CPF: {scanResult.data.employee.cpf} • {scanResult.data.employee.department}
                  </div>
                </div>
              )}

              <div className="pt-6">
                <span className="inline-block px-6 py-3 rounded-full bg-white/20 backdrop-blur-md text-sm font-bold tracking-wide uppercase">
                  TAP ANYWHERE TO SCAN NEXT
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Camera Viewport or Start Trigger */}
        <div className="w-full max-w-sm rounded-3xl overflow-hidden border-2 border-slate-800 bg-slate-900 relative shadow-2xl aspect-square flex flex-col items-center justify-center">
          <div id="qr-reader-target" className="w-full h-full" />

          {!scannerActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-900/90">
              <Camera className="w-16 h-16 text-red-500 animate-pulse" />
              <div>
                <h3 className="text-lg font-bold">Camera Standby</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Point device rear camera at attendee QR ticket
                </p>
              </div>
              <button
                onClick={startCamera}
                className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-900/40"
              >
                Activate Camera
              </button>
            </div>
          )}

          {scannerActive && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-64 h-64 border-2 border-red-500/80 rounded-2xl relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 shadow-[0_0_15px_#ef4444] animate-scan-line" />
              </div>
            </div>
          )}
        </div>

        {/* Manual Code Fallback Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleScanToken(manualToken);
          }}
          className="w-full max-w-sm mt-6 flex gap-2"
        >
          <input
            type="text"
            placeholder="Type QR Token or Ticket #..."
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm font-mono focus:border-red-500"
          />
          <button
            type="submit"
            disabled={isProcessing || !manualToken.trim()}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white disabled:opacity-50"
          >
            Submit
          </button>
        </form>
      </main>

      {/* Bottom Bar */}
      <footer className="p-3 bg-slate-900 border-t border-slate-800 text-center text-xs text-slate-500 flex items-center justify-between px-6">
        <span>ONGC Turnstile Scanner Engine</span>
        {scannerActive ? (
          <button
            onClick={stopCamera}
            className="text-red-400 hover:underline font-medium text-xs"
          >
            Pause Camera
          </button>
        ) : (
          <span className="text-slate-400 font-mono">Standby</span>
        )}
      </footer>
    </div>
  );
}
