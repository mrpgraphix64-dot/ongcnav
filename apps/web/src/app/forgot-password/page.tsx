'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Clock,
  ShieldCheck,
  Eye,
  EyeOff,
  Check,
  X,
} from 'lucide-react';
import {
  validateEmail,
  validateOtp,
  validatePasswordInputs,
  formatCountdown,
  calculatePasswordStrength,
} from './forgot-password.util';
import { fetchApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const router = useRouter();

  // Wizard Step: 1 = Email, 2 = OTP, 3 = New Password, 4 = Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Fields
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Reset Authorization Token from Step 2
  const [resetToken, setResetToken] = useState<string | null>(null);

  // Status & Messaging
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Resend Cooldown Timer (60s)
  const [resendCooldown, setResendCooldown] = useState(0);

  // OTP Expiration Countdown (600s = 10m)
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(600);

  const otpInputRef = useRef<HTMLInputElement>(null);

  // Resend Cooldown Countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // OTP Expiry Countdown
  useEffect(() => {
    if (step !== 2 || otpExpirySeconds <= 0) return;
    const interval = setInterval(() => {
      setOtpExpirySeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, otpExpirySeconds]);

  // Auto-focus OTP input on Step 2
  useEffect(() => {
    if (step === 2 && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  // Password strength checks
  const { hasMinLength, hasLetter, hasNumberOrSpecial } = calculatePasswordStrength(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // STEP 1: Request OTP
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      setError(emailCheck.error || 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetchApi('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: emailCheck.cleanEmail }),
      });

      setInfoMessage(
        res?.message || 'If an account exists for this email, a password reset OTP has been sent.',
      );
      setStep(2);
      setResendCooldown(60);
      setOtpExpirySeconds(600);
    } catch (err: any) {
      setError(err.message || 'Unable to process reset request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP in Step 2
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetchApi('/auth/resend-reset-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      setInfoMessage(
        res?.message || 'A fresh password reset OTP has been sent to your email.',
      );
      setResendCooldown(60);
      setOtpExpirySeconds(600);
      setOtp('');
    } catch (err: any) {
      setError(err.message || 'Unable to resend OTP. Please wait a moment and try again.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const otpCheck = validateOtp(otp);
    if (!otpCheck.isValid) {
      setError(otpCheck.error || 'Please enter the 6-digit numeric OTP sent to your email.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetchApi('/auth/verify-reset-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otpCheck.cleanOtp,
        }),
      });

      if (!res?.resetToken) {
        throw new Error('Verification failed. Please request a new OTP.');
      }

      setResetToken(res.resetToken);
      setStep(3);
      setError(null);
      setInfoMessage(null);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired OTP. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Reset Password
  const handleResetPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!resetToken) {
      setError('Session expired. Please start the password reset process again.');
      setStep(1);
      return;
    }

    const passCheck = validatePasswordInputs(newPassword, confirmPassword);
    if (!passCheck.isValid) {
      setError(passCheck.error || 'Invalid password provided.');
      return;
    }

    setLoading(true);
    try {
      await fetchApi('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          resetToken,
          newPassword,
          confirmPassword,
        }),
      });

      setStep(4);
      setError(null);
      setInfoMessage(null);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-sans bg-cream text-ink flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative selection:bg-maroon selection:text-white">
      {/* Decorative ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-maroon/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow p-7 sm:p-9 relative overflow-hidden">
          {/* Subtle gold accent top bar */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-maroon via-gold to-maroon" />

          {/* Top Header & Branding */}
          <div className="text-center space-y-3 pb-6 border-b border-stone-100">
            <div className="flex justify-center">
              <img
                src="/images/logo-web.png"
                alt="ONGC Logo"
                className="h-14 w-auto max-w-[200px] object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                  const fallback = (e.target as HTMLElement).nextElementSibling;
                  if (fallback) fallback.classList.remove('hidden');
                }}
              />
              <div className="hidden h-12 w-12 rounded-2xl bg-maroon text-white flex items-center justify-center font-outfit font-black text-lg">
                ONGC
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="font-outfit font-extrabold text-xs tracking-widest uppercase text-maroon">
                ONGC NAVRATRI 2026
              </div>
              <div className="font-outfit font-black text-[15px] tracking-wider uppercase text-ink">
                RESET ACCOUNT PASSWORD
              </div>
            </div>

            {/* Step Indicator Progress */}
            {step < 4 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      step === s
                        ? 'w-8 bg-maroon'
                        : step > s
                        ? 'w-4 bg-emerald-500'
                        : 'w-4 bg-stone-200'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Global Alert Notification */}
          {error && (
            <div className="mt-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mt-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 text-amber-700" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* STEP 1: ENTER REGISTERED EMAIL */}
          {step === 1 && (
            <form onSubmit={handleRequestOtp} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="Enter your registered account email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-stone-200 text-ink placeholder-stone-400 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500">
                  We will send a 6-digit verification OTP to this address if an account is registered.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-maroon text-white font-outfit font-bold text-sm hover:bg-maroon-dark transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer"
                >
                  <span>{loading ? 'SENDING OTP...' : 'SEND OTP'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: ENTER OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-ink-soft">
                    6-Digit Verification OTP
                  </label>
                  <span className="text-[11px] font-medium text-stone-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-stone-400" />
                    <span>Expires in {formatCountdown(otpExpirySeconds)}</span>
                  </span>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-stone-200 text-ink placeholder-stone-400 text-lg tracking-widest font-mono text-center focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500">
                  Sent to <strong className="text-ink font-semibold">{email}</strong>
                </p>
              </div>

              {/* Resend Cooldown Controls */}
              <div className="pt-1 flex items-center justify-between text-xs">
                <span className="text-stone-500">Didn't receive the OTP?</span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading || resendCooldown > 0}
                  className="font-bold text-maroon hover:text-maroon-dark disabled:text-stone-400 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                  </span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-maroon text-white font-outfit font-bold text-sm hover:bg-maroon-dark transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer"
                >
                  <span>{loading ? 'VERIFYING...' : 'VERIFY OTP'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: SET NEW PASSWORD */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-stone-200 text-ink placeholder-stone-400 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-stone-200 text-ink placeholder-stone-400 text-sm focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements UI */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 text-[11px] space-y-1.5">
                <div className="font-semibold text-stone-700">Password Requirements:</div>
                <div className="flex items-center gap-1.5">
                  {hasMinLength ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-stone-400" />
                  )}
                  <span className={hasMinLength ? 'text-emerald-700 font-medium' : 'text-stone-500'}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {hasLetter ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-stone-400" />
                  )}
                  <span className={hasLetter ? 'text-emerald-700 font-medium' : 'text-stone-500'}>
                    Contains letters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {hasNumberOrSpecial ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-stone-400" />
                  )}
                  <span
                    className={
                      hasNumberOrSpecial ? 'text-emerald-700 font-medium' : 'text-stone-500'
                    }
                  >
                    Contains number or symbol
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {passwordsMatch ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-stone-400" />
                  )}
                  <span className={passwordsMatch ? 'text-emerald-700 font-medium' : 'text-stone-500'}>
                    Passwords match
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !hasMinLength || !passwordsMatch}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-maroon text-white font-outfit font-bold text-sm hover:bg-maroon-dark transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer"
                >
                  <span>{loading ? 'RESETTING PASSWORD...' : 'RESET PASSWORD'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 4 && (
            <div className="mt-6 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-outfit font-bold text-ink">
                  Password Reset Successfully
                </h3>
                <p className="text-xs text-ink-soft mt-1.5 leading-relaxed">
                  Your account password has been updated. You can now sign in with your new credentials.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/admin/login"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-maroon text-white font-outfit font-bold text-sm hover:bg-maroon-dark transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer"
                >
                  <span>Back to Login</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          {/* Bottom Back link */}
          {step < 4 && (
            <div className="mt-6 text-center">
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-maroon transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Login</span>
              </Link>
            </div>
          )}
        </div>

        {/* Footer Notice */}
        <p className="mt-6 text-center text-xs text-ink-soft">
          ONGC Navratri 2026 &middot; Entry Control System &middot; Security &amp; Access Control
        </p>
      </div>
    </div>
  );
}
