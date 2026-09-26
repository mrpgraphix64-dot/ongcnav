/**
 * Utility functions for Forgot Password / Password Reset UI flow
 */

export function validateEmail(email: string): {
  isValid: boolean;
  error?: string;
  cleanEmail: string;
} {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    return { isValid: false, error: 'Email address is required.', cleanEmail };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return { isValid: false, error: 'Please enter a valid email address.', cleanEmail };
  }

  return { isValid: true, cleanEmail };
}

export function validateOtp(otp: string): {
  isValid: boolean;
  error?: string;
  cleanOtp: string;
} {
  const cleanOtp = (otp || '').trim().replace(/\D/g, '');
  if (!cleanOtp) {
    return { isValid: false, error: 'OTP is required.', cleanOtp };
  }

  if (cleanOtp.length !== 6) {
    return {
      isValid: false,
      error: 'Please enter the 6-digit numeric OTP sent to your email.',
      cleanOtp,
    };
  }

  return { isValid: true, cleanOtp };
}

export function validatePasswordInputs(
  newPass: string,
  confirmPass: string,
): { isValid: boolean; error?: string } {
  if (!newPass) {
    return { isValid: false, error: 'New password is required.' };
  }

  if (newPass.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long.' };
  }

  if (newPass.startsWith(' ') || newPass.endsWith(' ')) {
    return { isValid: false, error: 'Password cannot begin or end with whitespace.' };
  }

  if (newPass !== confirmPass) {
    return { isValid: false, error: 'Passwords do not match. Please verify your confirmation.' };
  }

  return { isValid: true };
}

export function formatCountdown(seconds: number): string {
  const safeSecs = Math.max(0, seconds);
  const mins = Math.floor(safeSecs / 60);
  const secs = safeSecs % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function calculatePasswordStrength(password: string): {
  score: number;
  hasMinLength: boolean;
  hasLetter: boolean;
  hasNumberOrSpecial: boolean;
  isStrong: boolean;
} {
  const pass = password || '';
  const hasMinLength = pass.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(pass);
  const hasNumberOrSpecial = /[0-9!@#$%^&*(),.?":{}|<>]/.test(pass);

  const score = [hasMinLength, hasLetter, hasNumberOrSpecial].filter(Boolean).length;
  const isStrong = score >= 3;

  return {
    score,
    hasMinLength,
    hasLetter,
    hasNumberOrSpecial,
    isStrong,
  };
}
