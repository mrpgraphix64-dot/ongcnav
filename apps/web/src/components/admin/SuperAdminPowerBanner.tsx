'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap, ShieldAlert, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  SuperAdminState,
  fetchSuperAdminSettings,
  disableSuperAdminFullPower,
  disableSuperAdminMaintenanceMode,
  subscribeToSuperAdminSync,
} from '@/lib/super-admin-state';
import { fetchApi } from '@/lib/api';

interface SuperAdminPowerBannerProps {
  userRole?: string | null;
}

export function SuperAdminPowerBanner({ userRole }: SuperAdminPowerBannerProps) {
  const [state, setState] = useState<SuperAdminState | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [environmentName, setEnvironmentName] = useState('staging');

  // Modals state
  const [showDisableFullPowerModal, setShowDisableFullPowerModal] = useState(false);
  const [showDisableMaintenanceModal, setShowDisableMaintenanceModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Success Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const roleNormalized = (userRole || '').toUpperCase();
    setIsSuperAdmin(roleNormalized === 'SUPER_ADMIN');
  }, [userRole]);

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      const roleNormalized = (userRole || '').toUpperCase();
      if (roleNormalized === 'SUPER_ADMIN') {
        const data = await fetchSuperAdminSettings();
        if (isMounted && data) {
          setState(data);
          if (data.nodeEnv || data.environment) {
            setEnvironmentName(data.nodeEnv || data.environment || 'staging');
          }
        }
      } else {
        // Fallback check for public maintenance mode
        try {
          const pub = await fetchApi<any>('/public/maintenance-status');
          if (isMounted && pub) {
            setState((prev) => ({
              superAdminFullPower: false,
              fullPowerActive: false,
              maintenanceMode: Boolean(pub.maintenance),
              maintenanceModeActive: Boolean(pub.maintenance),
              isProduction: false,
              ...(prev || {}),
            }));
          }
        } catch {}
      }
    }

    loadStatus();
    const interval = setInterval(loadStatus, 15000);

    const unsubscribe = subscribeToSuperAdminSync((syncedState) => {
      if (syncedState) {
        setState(syncedState);
        if (syncedState.nodeEnv || syncedState.environment) {
          setEnvironmentName(syncedState.nodeEnv || syncedState.environment || 'staging');
        }
      } else {
        loadStatus();
      }
    });

    return () => {
      isMounted = false;
      clearInterval(interval);
      unsubscribe();
    };
  }, [userRole]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleTurnOffFullPower = async () => {
    setIsSubmitting(true);
    setModalError(null);
    try {
      const res = await disableSuperAdminFullPower();
      setShowDisableFullPowerModal(false);
      setToastMessage(res.message || 'SUPER_ADMIN Full Power has been turned OFF.');
    } catch (err: any) {
      setModalError(err.message || 'Failed to disable Full Power.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTurnOffMaintenance = async () => {
    setIsSubmitting(true);
    setModalError(null);
    try {
      const res = await disableSuperAdminMaintenanceMode();
      setShowDisableMaintenanceModal(false);
      setToastMessage(res.message || 'Maintenance Mode has been turned OFF.');
    } catch (err: any) {
      setModalError(err.message || 'Failed to disable Maintenance Mode.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFullPowerActive = Boolean(state?.fullPowerActive);
  const isMaintenanceActive = Boolean(state?.maintenanceModeActive || state?.maintenanceMode);

  if (!isFullPowerActive && !isMaintenanceActive && !toastMessage) {
    return null;
  }

  return (
    <>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-md shrink-0 z-40 border-b border-emerald-700 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-100 hover:text-white p-0.5 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* BANNER 1: SUPER_ADMIN FULL POWER */}
      {isFullPowerActive && (
        <div
          id="global-full-power-banner"
          className="bg-rose-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-md shrink-0 z-40 border-b border-rose-700"
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-3">
            <Zap className="w-4 h-4 shrink-0 text-amber-300 animate-pulse" />
            <span className="truncate">
              <span className="uppercase tracking-wider font-black">
                SUPER_ADMIN FULL POWER ACTIVE:
              </span>{' '}
              Deletion protections are bypassed in {environmentName}. All records can be permanently deleted.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  setModalError(null);
                  setShowDisableFullPowerModal(true);
                }}
                className="px-2.5 py-1 rounded-md bg-white text-rose-700 hover:bg-rose-50 font-black text-[11px] transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Turn Off Full Power</span>
              </button>
            )}
            <Link
              href="/admin/settings"
              className="px-2.5 py-1 rounded-md bg-rose-700/80 hover:bg-rose-800 text-white font-bold text-[11px] transition"
            >
              Settings &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* BANNER 2: MAINTENANCE MODE */}
      {isMaintenanceActive && (
        <div
          id="global-maintenance-banner"
          className="bg-amber-500 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-md shrink-0 z-40 border-b border-amber-600"
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-3">
            <ShieldAlert className="w-4 h-4 shrink-0 text-white animate-pulse" />
            <span className="truncate">
              <span className="uppercase tracking-wider font-black">
                MAINTENANCE MODE ACTIVE:
              </span>{' '}
              Public registrations and pass bookings are paused. Turnstile scanning operations continue normally.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  setModalError(null);
                  setShowDisableMaintenanceModal(true);
                }}
                className="px-2.5 py-1 rounded-md bg-white text-amber-800 hover:bg-amber-50 font-black text-[11px] transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Turn Off</span>
              </button>
            )}
            <Link
              href="/admin/settings"
              className="px-2.5 py-1 rounded-md bg-amber-600/80 hover:bg-amber-700 text-white font-bold text-[11px] transition"
            >
              Settings &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: DISABLE FULL POWER */}
      {showDisableFullPowerModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-rose-300 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-outfit font-black text-lg text-rose-950">
                  Disable SUPER ADMIN Full Power?
                </h3>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  This will immediately restore all safety checks and deletion protections across the application.
                  Protected passes and orders will no longer be eligible for destructive deletion.
                </p>
              </div>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {modalError}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDisableFullPowerModal(false);
                  setModalError(null);
                }}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTurnOffFullPower}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Disabling...' : 'Disable Full Power'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: DISABLE MAINTENANCE MODE */}
      {showDisableMaintenanceModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-amber-300 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-outfit font-black text-lg text-amber-950">
                  Disable Maintenance Mode?
                </h3>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  This will immediately resume public registrations and pass bookings. Users will be able to book passes and register freely.
                </p>
              </div>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {modalError}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDisableMaintenanceModal(false);
                  setModalError(null);
                }}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTurnOffMaintenance}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Disabling...' : 'Disable Maintenance Mode'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export default SuperAdminPowerBanner;
