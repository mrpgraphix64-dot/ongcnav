'use client';

import { useState, useEffect } from 'react';
import {
  Radio,
  Calendar,
  ShieldAlert,
  Power,
  Lock,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

const FESTIVAL_DATES = [
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
  '2026-09-27',
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
];

export default function EventControlPage() {
  const [activeDate, setActiveDate] = useState('2026-09-23');
  const [emergencyStopped, setEmergencyStopped] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [scanningPaused, setScanningPaused] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await fetchApi('/admin/event-control/status');
      setActiveDate(res.activeEventDate);
      setEmergencyStopped(res.isEmergencyStopped);
      setEmergencyReason(res.emergencyReason || '');
      setScanningPaused(res.isScanningPaused);
      setRegistrationOpen(res.isRegistrationOpen);
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to fetch event control status', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleDateChange = async (newDate: string) => {
    try {
      await fetchApi('/admin/event-control/active-date', {
        method: 'POST',
        body: JSON.stringify({ activeEventDate: newDate }),
      });
      setActiveDate(newDate);
      setMsg({ text: `Active event date changed to ${newDate}`, type: 'success' });
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to change date', type: 'error' });
    }
  };

  const handleEmergencyStop = async () => {
    if (!emergencyStopped) {
      if (!emergencyReason.trim()) {
        alert('Please enter a mandatory justification / reason for emergency stop');
        return;
      }

      const confirmed = window.confirm(
        'WARNING: This will immediately block ALL scanning across all turnstiles and gates. Are you sure?',
      );
      if (!confirmed) return;

      try {
        await fetchApi('/admin/event-control/emergency-stop', {
          method: 'POST',
          body: JSON.stringify({ emergencyStop: true, reason: emergencyReason.trim() }),
        });
        setEmergencyStopped(true);
        setMsg({ text: 'EMERGENCY STOP ACTIVATED ACROSS ALL GATES', type: 'error' });
      } catch (e: any) {
        setMsg({ text: e.message || 'Failed to activate emergency stop', type: 'error' });
      }
    } else {
      // Deactivate
      try {
        await fetchApi('/admin/event-control/emergency-stop', {
          method: 'POST',
          body: JSON.stringify({ emergencyStop: false }),
        });
        setEmergencyStopped(false);
        setEmergencyReason('');
        setMsg({ text: 'Emergency stop cleared. Gates resumed normal scanning.', type: 'success' });
      } catch (e: any) {
        setMsg({ text: e.message || 'Failed to deactivate emergency stop', type: 'error' });
      }
    }
  };

  const toggleScanning = async () => {
    try {
      const nextVal = !scanningPaused;
      await fetchApi('/admin/event-control/toggle-scanning', {
        method: 'POST',
        body: JSON.stringify({ paused: nextVal }),
      });
      setScanningPaused(nextVal);
      setMsg({
        text: nextVal ? 'All turnstile scanning paused' : 'Turnstile scanning resumed',
        type: 'success',
      });
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to toggle scanning', type: 'error' });
    }
  };

  const toggleRegistration = async () => {
    try {
      const nextVal = !registrationOpen;
      await fetchApi('/admin/event-control/toggle-registration', {
        method: 'POST',
        body: JSON.stringify({ open: nextVal }),
      });
      setRegistrationOpen(nextVal);
      setMsg({
        text: nextVal ? 'Public registration opened' : 'Public registration closed',
        type: 'success',
      });
    } catch (e: any) {
      setMsg({ text: e.message || 'Failed to toggle registration', type: 'error' });
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white flex items-center gap-2">
          <Radio className="w-6 h-6 text-red-500" />
          Event Command & Safety Controls
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Control active festival night date (Asia/Kolkata), manage emergency lockdowns, and turnstile availability.
        </p>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-semibold ${
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

      {/* EMERGENCY STOP CARD */}
      <div
        className={`p-6 rounded-3xl border-2 transition-all ${
          emergencyStopped
            ? 'bg-red-950/90 border-red-500 shadow-2xl shadow-red-900/60'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldAlert
                className={`w-6 h-6 ${emergencyStopped ? 'text-white animate-bounce' : 'text-red-500'}`}
              />
              <h3 className="font-extrabold text-lg text-white">
                ALL-GATES EMERGENCY STOP (KILL SWITCH)
              </h3>
            </div>
            <p className="text-xs text-slate-300 max-w-xl">
              When activated, immediately halts check-ins at every gate across the grounds. Requires a mandatory audit log reason.
            </p>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              emergencyStopped
                ? 'bg-white text-red-700 animate-pulse'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {emergencyStopped ? 'ACTIVE LOCKDOWN' : 'STANDBY'}
          </span>
        </div>

        {!emergencyStopped && (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Reason / Emergency Justification (Required to trigger)
            </label>
            <input
              type="text"
              placeholder="e.g. Inclement weather conditions / Law enforcement directive"
              value={emergencyReason}
              onChange={(e) => setEmergencyReason(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-red-500"
            />
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {emergencyStopped
              ? `Reason: "${emergencyReason}"`
              : 'All turnstiles operating normally.'}
          </span>

          <button
            onClick={handleEmergencyStop}
            className={`px-6 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all ${
              emergencyStopped
                ? 'bg-white text-red-700 hover:bg-slate-200'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/50'
            }`}
          >
            {emergencyStopped ? 'Deactivate Emergency Stop' : 'TRIGGER EMERGENCY STOP'}
          </button>
        </div>
      </div>

      {/* ACTIVE EVENT DATE SELECTOR */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-400" />
          <h3 className="font-extrabold text-base text-white">
            Active Event Night (Asia/Kolkata IST)
          </h3>
        </div>
        <p className="text-xs text-slate-400">
          The selected date determines which attendee passes are valid for entry tonight. Duplicate check-in constraints are strictly keyed against this active date.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
          {FESTIVAL_DATES.map((date, idx) => {
            const isActive = activeDate === date;
            return (
              <button
                key={date}
                onClick={() => handleDateChange(date)}
                className={`p-3.5 rounded-xl border text-left text-xs font-semibold transition-all flex items-center justify-between ${
                  isActive
                    ? 'bg-amber-950/60 border-amber-500/80 text-amber-200 ring-2 ring-amber-500/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <span className="text-[10px] text-amber-400/80 uppercase block">
                    Night {idx + 1}
                  </span>
                  <span>{date}</span>
                </div>
                {isActive && (
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* MASTER TOGGLES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-white">Global Scanning Engine</h4>
            <span className="text-xs text-slate-400">
              {scanningPaused ? 'All scanning paused' : 'Scanning active across gates'}
            </span>
          </div>
          <button
            onClick={toggleScanning}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${
              scanningPaused
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {scanningPaused ? 'Resume Scanning' : 'Pause Scanning'}
          </button>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-white">Public Pass Registration</h4>
            <span className="text-xs text-slate-400">
              {registrationOpen ? 'Registration portal open' : 'Registration portal closed'}
            </span>
          </div>
          <button
            onClick={toggleRegistration}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${
              registrationOpen
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {registrationOpen ? 'Close Registration' : 'Open Registration'}
          </button>
        </div>
      </div>
    </div>
  );
}
