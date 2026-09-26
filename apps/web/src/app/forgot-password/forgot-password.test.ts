/// <reference types="jest" />
import fs from 'fs';
import path from 'path';
import {
  validateEmail,
  validateOtp,
  validatePasswordInputs,
  formatCountdown,
  calculatePasswordStrength,
} from './forgot-password.util';

describe('Frontend: Forgot Password & Password Reset Flow', () => {
  describe('Email Input Validation (validateEmail)', () => {
    it('accepts valid email addresses and normalizes to lowercase trimmed format', () => {
      const res = validateEmail('  SuperAdmin@ONGC.co.in  ');
      expect(res.isValid).toBe(true);
      expect(res.cleanEmail).toBe('superadmin@ongc.co.in');
      expect(res.error).toBeUndefined();
    });

    it('rejects empty or whitespace-only email addresses', () => {
      const res1 = validateEmail('');
      expect(res1.isValid).toBe(false);
      expect(res1.error).toContain('Email address is required');

      const res2 = validateEmail('   ');
      expect(res2.isValid).toBe(false);
      expect(res2.error).toContain('Email address is required');
    });

    it('rejects malformed email addresses', () => {
      expect(validateEmail('notanemail').isValid).toBe(false);
      expect(validateEmail('missing@domain').isValid).toBe(false);
      expect(validateEmail('missing.domain@').isValid).toBe(false);
      expect(validateEmail('@missinguser.com').isValid).toBe(false);
    });
  });

  describe('OTP Input Validation (validateOtp)', () => {
    it('accepts valid 6-digit numeric OTP', () => {
      const res = validateOtp('123456');
      expect(res.isValid).toBe(true);
      expect(res.cleanOtp).toBe('123456');
    });

    it('strips whitespace and non-numeric characters', () => {
      const res = validateOtp(' 12 34 56 ');
      expect(res.isValid).toBe(true);
      expect(res.cleanOtp).toBe('123456');
    });

    it('rejects OTPs shorter or longer than 6 digits', () => {
      const short = validateOtp('12345');
      expect(short.isValid).toBe(false);
      expect(short.error).toContain('6-digit numeric OTP');

      const long = validateOtp('1234567');
      expect(long.isValid).toBe(false);
      expect(long.error).toContain('6-digit numeric OTP');
    });

    it('rejects completely non-numeric or empty OTP input', () => {
      expect(validateOtp('').isValid).toBe(false);
      expect(validateOtp('abcdef').isValid).toBe(false);
    });
  });

  describe('Password Validation & Policy (validatePasswordInputs)', () => {
    it('accepts valid password matching confirmation with at least 8 characters', () => {
      const res = validatePasswordInputs('SecurePass@2026', 'SecurePass@2026');
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects passwords shorter than 8 characters', () => {
      const res = validatePasswordInputs('short', 'short');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('at least 8 characters');
    });

    it('rejects passwords with leading or trailing whitespace', () => {
      const res = validatePasswordInputs(' SecurePass@2026 ', ' SecurePass@2026 ');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('whitespace');
    });

    it('rejects password confirmation mismatch', () => {
      const res = validatePasswordInputs('SecurePass@2026', 'DifferentPass@2026');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('do not match');
    });
  });

  describe('Password Strength Calculation (calculatePasswordStrength)', () => {
    it('calculates score based on length, letters, and numbers/symbols', () => {
      const weak = calculatePasswordStrength('short');
      expect(weak.hasMinLength).toBe(false);
      expect(weak.hasLetter).toBe(true);
      expect(weak.hasNumberOrSpecial).toBe(false);
      expect(weak.isStrong).toBe(false);

      const strong = calculatePasswordStrength('StrongPass@2026');
      expect(strong.hasMinLength).toBe(true);
      expect(strong.hasLetter).toBe(true);
      expect(strong.hasNumberOrSpecial).toBe(true);
      expect(strong.score).toBe(3);
      expect(strong.isStrong).toBe(true);
    });
  });

  describe('Countdown Timer Formatter (formatCountdown)', () => {
    it('formats seconds into mm:ss accurately', () => {
      expect(formatCountdown(600)).toBe('10:00');
      expect(formatCountdown(599)).toBe('9:59');
      expect(formatCountdown(60)).toBe('1:00');
      expect(formatCountdown(9)).toBe('0:09');
      expect(formatCountdown(0)).toBe('0:00');
      expect(formatCountdown(-5)).toBe('0:00');
    });
  });

  describe('Forgot Password Links & Unified UI Integration', () => {
    it('admin login page contains "Forgot Password?" link pointing to /forgot-password', () => {
      const loginPagePath = path.resolve(__dirname, '../admin/login/page.tsx');
      const content = fs.readFileSync(loginPagePath, 'utf-8');

      expect(content).toContain('href="/forgot-password"');
      expect(content).toContain('Forgot Password?');
    });

    it('agent portal page contains "Forgot Password?" link pointing to /forgot-password', () => {
      const agentPagePath = path.resolve(__dirname, '../agent/page.tsx');
      const content = fs.readFileSync(agentPagePath, 'utf-8');

      expect(content).toContain('href="/forgot-password"');
      expect(content).toContain('Forgot Password?');
    });

    it('forgot-password page does NOT contain account-existence or role enumeration messages', () => {
      const forgotPagePath = path.resolve(__dirname, './page.tsx');
      const content = fs.readFileSync(forgotPagePath, 'utf-8');

      // Generic success message must be present
      expect(content).toContain(
        'If an account exists for this email, a password reset OTP has been sent.',
      );

      // Must never display role checks or account existence hints to user
      expect(content).not.toContain('User does not exist');
      expect(content).not.toContain('User exists');
      expect(content).not.toContain('Role:');
    });

    it('forgot-password page implements mobile-friendly inputs and responsive layout', () => {
      const forgotPagePath = path.resolve(__dirname, './page.tsx');
      const content = fs.readFileSync(forgotPagePath, 'utf-8');

      // Mobile accessibility and layout checks
      expect(content).toContain('inputMode="numeric"');
      expect(content).toContain('pattern="[0-9]*"');
      expect(content).toContain('autoComplete="one-time-code"');
      expect(content).toContain('sm:max-w-md');
      expect(content).toContain('px-4');
    });
  });
});
