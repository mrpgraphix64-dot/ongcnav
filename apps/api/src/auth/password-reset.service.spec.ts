import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PasswordResetService } from './password-reset.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let prisma: any;
  let jwt: JwtService;
  let config: any;
  let redis: any;
  let mailService: any;

  const validSecret = 'test-secret-key-that-is-at-least-64-characters-long-for-hmac-sha256-safety';

  const mockUsersByRole: Record<string, any> = {
    SUPER_ADMIN: {
      id: BigInt(1),
      email: 'superadmin@ongc.co.in',
      role: 'SUPER_ADMIN',
      isActive: true,
      password: '',
    },
    COMMERCIAL_ADMIN: {
      id: BigInt(2),
      email: 'commercialadmin@ongc.co.in',
      role: 'COMMERCIAL_ADMIN',
      isActive: true,
      password: '',
    },
    EMPLOYEE_ADMIN: {
      id: BigInt(3),
      email: 'employeeadmin@ongc.co.in',
      role: 'EMPLOYEE_ADMIN',
      isActive: true,
      password: '',
    },
    REGISTRATION_STAFF: {
      id: BigInt(4),
      email: 'regstaff@ongc.co.in',
      role: 'REGISTRATION_STAFF',
      isActive: true,
      password: '',
    },
    EVENT_ADMIN: {
      id: BigInt(5),
      email: 'eventadmin@ongc.co.in',
      role: 'EVENT_ADMIN',
      isActive: true,
      password: '',
    },
    COMMERCIAL_AGENT: {
      id: BigInt(6),
      email: 'agent@partner.com',
      role: 'COMMERCIAL_AGENT',
      isActive: true,
      password: '',
    },
    COMMERCIAL_SUB_AGENT: {
      id: BigInt(7),
      email: 'subagent@partner.com',
      role: 'COMMERCIAL_SUB_AGENT',
      isActive: true,
      password: '',
    },
  };

  beforeEach(async () => {
    // Setup bcrypt hashed password for users
    const defaultHash = await bcrypt.hash('OldPassword@123', 4);
    Object.values(mockUsersByRole).forEach((u) => {
      u.password = defaultHash;
    });

    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      passwordReset: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    config = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return validSecret;
        return undefined;
      }),
    };

    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(true),
      incrementCounter: jest.fn().mockResolvedValue(1),
    };

    mailService = {
      sendPasswordResetOtpEmail: jest.fn().mockResolvedValue({ success: true }),
      maskEmail: jest.fn((e: string) => `m***@${e.split('@')[1] || 'domain.com'}`),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: RedisService, useValue: redis },
        { provide: MailService, useValue: mailService },
        {
          provide: JwtService,
          useValue: new JwtService({
            secret: validSecret,
            signOptions: { expiresIn: '10m' },
          }),
        },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
    jwt = module.get<JwtService>(JwtService);
  });

  describe('A. Forgot password', () => {
    it('returns identical generic success message for valid registered email and sends OTP', async () => {
      const user = mockUsersByRole.SUPER_ADMIN;
      prisma.user.findFirst.mockResolvedValue(user);
      prisma.passwordReset.create.mockResolvedValue({ id: BigInt(1) });

      const res = await service.forgotPassword({ email: user.email });

      expect(res.success).toBe(true);
      expect(res.message).toBe(
        'If an account exists for this email, a password reset OTP has been sent.',
      );
      expect(mailService.sendPasswordResetOtpEmail).toHaveBeenCalledTimes(1);
      expect(mailService.sendPasswordResetOtpEmail).toHaveBeenCalledWith(
        user.email.toLowerCase(),
        expect.stringMatching(/^\d{6}$/),
      );
      expect(prisma.passwordReset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: user.email.toLowerCase(),
            otpHash: expect.any(String),
            attempts: 0,
            maxAttempts: 5,
          }),
        }),
      );
    });

    it('returns identical generic message for unregistered email without sending email or creating OTP', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const res = await service.forgotPassword({ email: 'unregistered@example.com' });

      expect(res.success).toBe(true);
      expect(res.message).toBe(
        'If an account exists for this email, a password reset OTP has been sent.',
      );
      expect(mailService.sendPasswordResetOtpEmail).not.toHaveBeenCalled();
      expect(prisma.passwordReset.create).not.toHaveBeenCalled();
    });

    it('normalizes email (trims and converts to lowercase)', async () => {
      const user = mockUsersByRole.SUPER_ADMIN;
      prisma.user.findFirst.mockResolvedValue(user);

      await service.forgotPassword({ email: '  SuperAdmin@ONGC.co.in  ' });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: { equals: 'superadmin@ongc.co.in', mode: 'insensitive' },
        },
      });
      expect(mailService.sendPasswordResetOtpEmail).toHaveBeenCalledWith(
        'superadmin@ongc.co.in',
        expect.any(String),
      );
    });

    it('rejects invalid email formats with BadRequestException', async () => {
      await expect(service.forgotPassword({ email: 'not-an-email' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.forgotPassword({ email: '' })).rejects.toThrow(BadRequestException);
    });

    it('returns generic message for inactive account without sending email', async () => {
      const inactiveUser = { ...mockUsersByRole.REGISTRATION_STAFF, isActive: false };
      prisma.user.findFirst.mockResolvedValue(inactiveUser);

      const res = await service.forgotPassword({ email: inactiveUser.email });

      expect(res.success).toBe(true);
      expect(res.message).toBe(
        'If an account exists for this email, a password reset OTP has been sent.',
      );
      expect(mailService.sendPasswordResetOtpEmail).not.toHaveBeenCalled();
    });

    it('enforces 60-second cooldown between OTP requests', async () => {
      redis.get.mockImplementation(async (key: string) => {
        if (key.includes('cooldown')) return '1';
        return null;
      });

      await expect(
        service.forgotPassword({ email: 'superadmin@ongc.co.in' }),
      ).rejects.toThrow(HttpException);
    });

    it('enforces 3 requests per 15 minutes rate limit', async () => {
      redis.get.mockImplementation(async (key: string) => {
        if (key.includes('15m')) return '3';
        return null;
      });

      await expect(
        service.forgotPassword({ email: 'superadmin@ongc.co.in' }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('B. OTP verification and security', () => {
    const rawOtp = '789123';
    let otpHash: string;

    beforeEach(() => {
      otpHash = crypto
        .createHmac('sha256', validSecret)
        .update(rawOtp)
        .digest('hex');
    });

    it('verifies correct OTP and issues a scoped reset authorization token', async () => {
      const record = {
        id: BigInt(10),
        email: 'superadmin@ongc.co.in',
        otpHash,
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        verifiedAt: null,
        usedAt: null,
      };
      prisma.passwordReset.findFirst.mockResolvedValue(record);
      prisma.passwordReset.update.mockResolvedValue({ ...record, verifiedAt: new Date() });

      const res = await service.verifyResetOtp({
        email: 'superadmin@ongc.co.in',
        otp: rawOtp,
      });

      expect(res.success).toBe(true);
      expect(res.resetToken).toBeDefined();

      // Verify token is scoped with purpose: password_reset
      const decoded: any = jwt.verify(res.resetToken);
      expect(decoded.purpose).toBe('password_reset');
      expect(decoded.sub).toBe('superadmin@ongc.co.in');
    });

    it('increments attempts on wrong OTP', async () => {
      const record = {
        id: BigInt(10),
        email: 'superadmin@ongc.co.in',
        otpHash,
        attempts: 1,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        verifiedAt: null,
        usedAt: null,
      };
      prisma.passwordReset.findFirst.mockResolvedValue(record);

      await expect(
        service.verifyResetOtp({ email: 'superadmin@ongc.co.in', otp: '000000' }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.passwordReset.update).toHaveBeenCalledWith({
        where: { id: record.id },
        data: { attempts: 2 },
      });
    });

    it('invalidates OTP after 5 failed attempts', async () => {
      const record = {
        id: BigInt(10),
        email: 'superadmin@ongc.co.in',
        otpHash,
        attempts: 4,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        verifiedAt: null,
        usedAt: null,
      };
      prisma.passwordReset.findFirst.mockResolvedValue(record);

      await expect(
        service.verifyResetOtp({ email: 'superadmin@ongc.co.in', otp: '000000' }),
      ).rejects.toThrow(/invalidated/i);

      expect(prisma.passwordReset.update).toHaveBeenCalledWith({
        where: { id: record.id },
        data: expect.objectContaining({
          attempts: 5,
          usedAt: expect.any(Date),
        }),
      });
    });

    it('rejects expired OTP', async () => {
      // prisma.passwordReset.findFirst queries expiresAt: { gt: now }, so expired records return null
      prisma.passwordReset.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyResetOtp({ email: 'superadmin@ongc.co.in', otp: rawOtp }),
      ).rejects.toThrow(/Invalid or expired OTP/i);
    });

    it('never stores plaintext OTP in database — verifies hash was stored', async () => {
      const user = mockUsersByRole.COMMERCIAL_ADMIN;
      prisma.user.findFirst.mockResolvedValue(user);

      await service.forgotPassword({ email: user.email });

      const createCall = prisma.passwordReset.create.mock.calls[0][0];
      const savedHash = createCall.data.otpHash;

      expect(savedHash).toBeDefined();
      expect(savedHash).toHaveLength(64); // SHA256 hex is 64 chars
      expect(savedHash).not.toMatch(/^\d{6}$/); // NOT plaintext 6 digits
    });
  });

  describe('C. Reset token verification and scope', () => {
    it('rejects expired reset token', async () => {
      const expiredToken = jwt.sign(
        { purpose: 'password_reset', sub: 'superadmin@ongc.co.in' },
        { expiresIn: '-1s' },
      );

      await expect(
        service.resetPassword({
          resetToken: expiredToken,
          newPassword: 'BrandNewPassword@2026',
          confirmPassword: 'BrandNewPassword@2026',
        }),
      ).rejects.toThrow(/expired/i);
    });

    it('rejects tokens with incorrect purpose', async () => {
      const wrongPurposeToken = jwt.sign({
        purpose: 'access_token',
        sub: 'superadmin@ongc.co.in',
      });

      await expect(
        service.resetPassword({
          resetToken: wrongPurposeToken,
          newPassword: 'BrandNewPassword@2026',
          confirmPassword: 'BrandNewPassword@2026',
        }),
      ).rejects.toThrow(/Invalid reset token purpose/i);
    });

    it('rejects reused reset tokens', async () => {
      const validToken = jwt.sign({
        purpose: 'password_reset',
        sub: 'superadmin@ongc.co.in',
      });
      const tokenHash = crypto
        .createHmac('sha256', validSecret)
        .update(validToken)
        .digest('hex');

      prisma.passwordReset.findUnique.mockResolvedValue({
        id: BigInt(20),
        email: 'superadmin@ongc.co.in',
        tokenHash,
        verifiedAt: new Date(),
        usedAt: new Date(), // Already used!
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      await expect(
        service.resetPassword({
          resetToken: validToken,
          newPassword: 'BrandNewPassword@2026',
          confirmPassword: 'BrandNewPassword@2026',
        }),
      ).rejects.toThrow(/already been used/i);
    });
  });

  describe('D. Password reset execution', () => {
    let validToken: string;
    let tokenHash: string;
    const user = mockUsersByRole.SUPER_ADMIN;

    beforeEach(() => {
      validToken = jwt.sign({
        purpose: 'password_reset',
        sub: user.email,
      });
      tokenHash = crypto
        .createHmac('sha256', validSecret)
        .update(validToken)
        .digest('hex');
    });

    it('rejects password confirmation mismatch', async () => {
      await expect(
        service.resetPassword({
          resetToken: validToken,
          newPassword: 'Password123!',
          confirmPassword: 'PasswordMismatch999!',
        }),
      ).rejects.toThrow(/Passwords do not match/i);
    });

    it('rejects weak passwords shorter than 8 characters', async () => {
      await expect(
        service.resetPassword({
          resetToken: validToken,
          newPassword: 'short',
          confirmPassword: 'short',
        }),
      ).rejects.toThrow(/at least 8 characters/i);
    });

    it('resets password successfully using bcrypt and marks token used', async () => {
      prisma.passwordReset.findUnique.mockResolvedValue({
        id: BigInt(30),
        email: user.email,
        tokenHash,
        verifiedAt: new Date(),
        usedAt: null,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });
      prisma.user.findFirst.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(user);

      const res = await service.resetPassword({
        resetToken: validToken,
        newPassword: 'BrandNewPassword@2026',
        confirmPassword: 'BrandNewPassword@2026',
      });

      expect(res.success).toBe(true);
      expect(res.message).toBe('Password reset successfully. You can now sign in.');

      // Verify bcrypt was used to hash new password
      const updateCall = prisma.user.update.mock.calls[0][0];
      const savedHash = updateCall.data.password;
      expect(await bcrypt.compare('BrandNewPassword@2026', savedHash)).toBe(true);
      expect(await bcrypt.compare('OldPassword@123', savedHash)).toBe(false);

      // Verify reset token was marked as used
      expect(prisma.passwordReset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(30) },
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      );

      // Verify session revocation recorded in Redis
      expect(redis.set).toHaveBeenCalledWith(
        `auth:password_changed:${user.id}`,
        expect.any(String),
        expect.any(Number),
      );
    });
  });

  describe('E. Operational and Admin roles support', () => {
    const rolesToTest = [
      'SUPER_ADMIN',
      'COMMERCIAL_ADMIN',
      'EMPLOYEE_ADMIN',
      'REGISTRATION_STAFF',
      'EVENT_ADMIN',
      'COMMERCIAL_AGENT',
      'COMMERCIAL_SUB_AGENT',
    ];

    rolesToTest.forEach((role) => {
      it(`supports password reset flow for role: ${role}`, async () => {
        const roleUser = mockUsersByRole[role];
        prisma.user.findFirst.mockResolvedValue(roleUser);

        const res = await service.forgotPassword({ email: roleUser.email });

        expect(res.success).toBe(true);
        expect(mailService.sendPasswordResetOtpEmail).toHaveBeenCalledWith(
          roleUser.email.toLowerCase(),
          expect.stringMatching(/^\d{6}$/),
        );
      });
    });
  });

  describe('F. Security and anti-enumeration', () => {
    it('never reveals whether an email belongs to admin, agent, or unregistered user', async () => {
      // 1. Registered Admin
      prisma.user.findFirst.mockResolvedValue(mockUsersByRole.SUPER_ADMIN);
      const resAdmin = await service.forgotPassword({ email: 'superadmin@ongc.co.in' });

      // 2. Unregistered
      prisma.user.findFirst.mockResolvedValue(null);
      const resUnreg = await service.forgotPassword({ email: 'ghost@nowhere.com' });

      expect(resAdmin.message).toEqual(resUnreg.message);
      expect(resAdmin.success).toEqual(resUnreg.success);
    });

    it('does not accept client-submitted account IDs, roles, or domains', async () => {
      // DTO only accepts { email } for forgotPassword and { resetToken, newPassword, confirmPassword } for resetPassword
      const user = mockUsersByRole.COMMERCIAL_AGENT;
      const validToken = jwt.sign({
        purpose: 'password_reset',
        sub: user.email,
      });
      const tokenHash = crypto
        .createHmac('sha256', validSecret)
        .update(validToken)
        .digest('hex');

      prisma.passwordReset.findUnique.mockResolvedValue({
        id: BigInt(40),
        email: user.email,
        tokenHash,
        verifiedAt: new Date(),
        usedAt: null,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });
      prisma.user.findFirst.mockResolvedValue(user);

      // Account is strictly resolved from resetRecord.email, not any client parameter
      await service.resetPassword({
        resetToken: validToken,
        newPassword: 'AgentSecret@2026',
        confirmPassword: 'AgentSecret@2026',
      } as any);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: user.email, mode: 'insensitive' } },
      });
    });
  });
});
