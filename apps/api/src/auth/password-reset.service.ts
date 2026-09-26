import {
  Injectable,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { getRequiredJwtSecret } from '../common/security/jwt-secret.util';
import { validatePasswordPolicy } from '../common/security/password-policy.util';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendResetOtpDto } from './dto/resend-reset-otp.dto';

interface InMemoryRateLimitRecord {
  requests: number[];
  lastRequestAt: number;
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly secret: string;

  // In-memory rate limiting fallback (ensures Redis failure cannot create an unlimited path)
  private readonly emailRateLimits = new Map<string, InMemoryRateLimitRecord>();
  private readonly ipRateLimits = new Map<string, number[]>();

  // In-memory revocation tracking for password changes
  private readonly passwordChangedTimestamps = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly mailService: MailService,
  ) {
    this.secret = getRequiredJwtSecret(this.configService);
  }

  /**
   * Generic success message returned for all forgot-password and resend-otp requests.
   * Completely avoids internal account enumeration.
   */
  private readonly genericSuccessMessage =
    'If an account exists for this email, a password reset OTP has been sent.';

  /**
   * Normalizes an email address (trims and converts to lowercase).
   */
  normalizeEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  /**
   * Generates a keyed HMAC-SHA256 hex digest for an OTP or token.
   */
  private hashKeyed(value: string): string {
    return crypto.createHmac('sha256', this.secret).update(value).digest('hex');
  }

  /**
   * Timing-safe comparison of two hex hashes.
   */
  private timingSafeHashCompare(hashA: string, hashB: string): boolean {
    if (!hashA || !hashB || hashA.length !== hashB.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(hashA, 'utf-8'), Buffer.from(hashB, 'utf-8'));
  }

  /**
   * Enforces 60-second resend cooldown and 3-requests-per-15-minute rate limit.
   * Applied identically to both existing and non-existing email accounts to prevent enumeration.
   */
  async checkRateLimits(normalizedEmail: string, ipAddress?: string): Promise<void> {
    const now = Date.now();
    const fifteenMinutesAgo = now - 15 * 60 * 1000;

    // 1. IP Rate Limiting (max 10 requests per 15 minutes)
    if (ipAddress) {
      const ipKey = `rl:pwd_reset:ip:${ipAddress}`;
      const redisIpCount = await this.redis.incrementCounter(ipKey, 15 * 60);
      if (redisIpCount !== null && redisIpCount > 10) {
        throw new HttpException(
          'Too many password reset requests from this IP address. Please try again after 15 minutes.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // In-memory IP tracking fallback
      let ipTimestamps = this.ipRateLimits.get(ipAddress) || [];
      ipTimestamps = ipTimestamps.filter((ts) => ts > fifteenMinutesAgo);
      if (ipTimestamps.length >= 10) {
        throw new HttpException(
          'Too many password reset requests from this IP address. Please try again after 15 minutes.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // 2. Email Resend Cooldown (minimum 60 seconds between sends)
    const emailCooldownKey = `rl:pwd_reset:cooldown:${normalizedEmail}`;
    const inCooldown = await this.redis.get(emailCooldownKey);
    if (inCooldown) {
      throw new HttpException(
        'Please wait 60 seconds before requesting another OTP.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 3. Email 15-Minute Limit (maximum 3 requests per 15 minutes)
    const emailLimitKey = `rl:pwd_reset:15m:${normalizedEmail}`;
    const currentEmailCount = await this.redis.get(emailLimitKey);
    if (currentEmailCount && parseInt(currentEmailCount, 10) >= 3) {
      throw new HttpException(
        'Too many password reset attempts for this email. Please try again after 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // In-memory fallback check
    const memRecord = this.emailRateLimits.get(normalizedEmail);
    if (memRecord) {
      if (now - memRecord.lastRequestAt < 60 * 1000) {
        throw new HttpException(
          'Please wait 60 seconds before requesting another OTP.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const recentRequests = memRecord.requests.filter((ts) => ts > fifteenMinutesAgo);
      if (recentRequests.length >= 3) {
        throw new HttpException(
          'Too many password reset attempts for this email. Please try again after 15 minutes.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Database check fallback (ensures Redis reboot or bypass can never exceed 3 in 15 min)
    try {
      const dbRecentCount = await this.prisma.passwordReset.count({
        where: {
          email: normalizedEmail,
          createdAt: { gte: new Date(fifteenMinutesAgo) },
        },
      });
      if (dbRecentCount >= 3) {
        throw new HttpException(
          'Too many password reset attempts for this email. Please try again after 15 minutes.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      // If DB error, proceed with caution
    }
  }

  /**
   * Records a successfully accepted rate-limit slot.
   */
  async recordRateLimitAttempt(normalizedEmail: string, ipAddress?: string): Promise<void> {
    const now = Date.now();
    const fifteenMinutesAgo = now - 15 * 60 * 1000;

    // Redis
    const emailCooldownKey = `rl:pwd_reset:cooldown:${normalizedEmail}`;
    await this.redis.set(emailCooldownKey, '1', 60);

    const emailLimitKey = `rl:pwd_reset:15m:${normalizedEmail}`;
    await this.redis.incrementCounter(emailLimitKey, 15 * 60);

    // In-Memory
    const memRecord = this.emailRateLimits.get(normalizedEmail) || {
      requests: [],
      lastRequestAt: 0,
    };
    memRecord.requests = memRecord.requests.filter((ts) => ts > fifteenMinutesAgo);
    memRecord.requests.push(now);
    memRecord.lastRequestAt = now;
    this.emailRateLimits.set(normalizedEmail, memRecord);

    if (ipAddress) {
      let ipTimestamps = this.ipRateLimits.get(ipAddress) || [];
      ipTimestamps = ipTimestamps.filter((ts) => ts > fifteenMinutesAgo);
      ipTimestamps.push(now);
      this.ipRateLimits.set(ipAddress, ipTimestamps);
    }
  }

  /**
   * POST /auth/forgot-password
   */
  async forgotPassword(dto: ForgotPasswordDto, ipAddress?: string) {
    const normalizedEmail = this.normalizeEmail(dto.email);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new BadRequestException('Please enter a valid email address.');
    }

    // Rate limiting
    await this.checkRateLimits(normalizedEmail, ipAddress);
    await this.recordRateLimitAttempt(normalizedEmail, ipAddress);

    // Query active operational / admin / agent user
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
    });

    const isEligible = user && user.isActive;

    if (isEligible) {
      // Invalidate any previously active unverified OTPs for this account
      await this.prisma.passwordReset.updateMany({
        where: {
          email: normalizedEmail,
          verifiedAt: null,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      // Generate cryptographically secure random 6-digit numeric OTP (100000 - 999999)
      const otpNumber = crypto.randomInt(100000, 1000000);
      const otp = otpNumber.toString();

      // Keyed HMAC hash of OTP (never store plaintext OTP)
      const otpHash = this.hashKeyed(otp);

      // OTP expires in 10 minutes (600 seconds)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const targetEmail = user.email.toLowerCase().trim();

      await this.prisma.passwordReset.create({
        data: {
          email: targetEmail,
          otpHash,
          attempts: 0,
          maxAttempts: 5,
          expiresAt,
          ipAddress: ipAddress || null,
        },
      });

      // Send OTP via Hostinger MailService (strictly to account's stored email, never logs OTP)
      try {
        await this.mailService.sendPasswordResetOtpEmail(targetEmail, otp);
      } catch (err: any) {
        this.logger.error(
          `Failed to dispatch password reset OTP email to ${this.mailService.maskEmail(targetEmail)}: ${err.message}`,
        );
      }

      this.logger.log(
        `Password reset OTP dispatched to ${this.mailService.maskEmail(targetEmail)}.`,
      );
    } else {
      // Constant-time execution pad against timing-attack user enumeration
      this.hashKeyed('000000');
      this.logger.log(
        `Password reset requested for unmapped or inactive address: ${this.mailService.maskEmail(normalizedEmail)}.`,
      );
    }

    return {
      success: true,
      message: this.genericSuccessMessage,
    };
  }

  /**
   * POST /auth/resend-reset-otp
   */
  async resendResetOtp(dto: ResendResetOtpDto, ipAddress?: string) {
    // Reuses the exact same rate-limited, timing-safe dispatch flow
    return this.forgotPassword({ email: dto.email }, ipAddress);
  }

  /**
   * POST /auth/verify-reset-otp
   */
  async verifyResetOtp(dto: VerifyResetOtpDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const cleanOtp = (dto.otp || '').trim();

    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      throw new BadRequestException('OTP must be exactly 6 numeric digits.');
    }

    const now = new Date();

    // Find the latest active, unverified, and unused reset request for this email
    const record = await this.prisma.passwordReset.findFirst({
      where: {
        email: normalizedEmail,
        verifiedAt: null,
        usedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired OTP. Please request a new code.');
    }

    // Check maximum attempts
    if (record.attempts >= record.maxAttempts) {
      // Invalidate record
      await this.prisma.passwordReset.update({
        where: { id: record.id },
        data: { usedAt: now },
      });
      throw new BadRequestException(
        'Too many incorrect attempts. This OTP has been invalidated. Please request a new code.',
      );
    }

    // Compare HMAC hash using timing-safe comparison
    const submittedHash = this.hashKeyed(cleanOtp);
    const isValid = this.timingSafeHashCompare(record.otpHash, submittedHash);

    if (!isValid) {
      const updatedAttempts = record.attempts + 1;
      const willInvalidate = updatedAttempts >= record.maxAttempts;

      await this.prisma.passwordReset.update({
        where: { id: record.id },
        data: {
          attempts: updatedAttempts,
          ...(willInvalidate ? { usedAt: now } : {}),
        },
      });

      if (willInvalidate) {
        throw new BadRequestException(
          'Too many incorrect attempts. This OTP has been invalidated. Please request a new code.',
        );
      }

      const remaining = record.maxAttempts - updatedAttempts;
      throw new BadRequestException(
        `Invalid OTP. You have ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      );
    }

    // OTP is valid! Mark as verified and issue a short-lived (10m), single-purpose reset authorization token.
    const rawResetSecret = crypto.randomBytes(32).toString('hex');
    const resetToken = this.jwtService.sign(
      {
        purpose: 'password_reset',
        sub: normalizedEmail,
        jti: record.id.toString(),
        entropy: rawResetSecret,
      },
      { expiresIn: '10m' },
    );

    // Hash the resetToken before saving in database
    const tokenHash = this.hashKeyed(resetToken);

    await this.prisma.passwordReset.update({
      where: { id: record.id },
      data: {
        verifiedAt: now,
        tokenHash,
      },
    });

    this.logger.log(
      `Password reset OTP verified successfully for ${this.mailService.maskEmail(normalizedEmail)}.`,
    );

    return {
      success: true,
      resetToken,
      message: 'OTP verified successfully. You may now set your new password.',
    };
  }

  /**
   * POST /auth/reset-password
   */
  async resetPassword(dto: ResetPasswordDto) {
    const { resetToken, newPassword, confirmPassword } = dto;

    if (!resetToken || typeof resetToken !== 'string') {
      throw new BadRequestException('Reset token is required.');
    }

    // Validate password policy and confirmation match
    validatePasswordPolicy(newPassword, confirmPassword);

    // Verify reset token signature and purpose
    let payload: any;
    try {
      payload = this.jwtService.verify(resetToken);
    } catch {
      throw new BadRequestException('Invalid or expired reset token. Please restart the process.');
    }

    if (!payload || payload.purpose !== 'password_reset' || !payload.sub) {
      throw new BadRequestException('Invalid reset token purpose.');
    }

    const normalizedEmail = this.normalizeEmail(payload.sub);
    const tokenHash = this.hashKeyed(resetToken);
    const now = new Date();

    // Verify tokenHash state in database
    const resetRecord = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
    });

    if (!resetRecord) {
      throw new BadRequestException('Invalid or unrecognized reset token.');
    }

    if (resetRecord.usedAt !== null) {
      throw new BadRequestException(
        'This reset token has already been used. Please request a new OTP.',
      );
    }

    if (resetRecord.expiresAt < now) {
      throw new BadRequestException(
        'Reset token has expired. Please request a new OTP.',
      );
    }

    if (resetRecord.verifiedAt === null) {
      throw new BadRequestException('Reset session was not verified.');
    }

    // Account resolution strictly from the verified reset record's email
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: resetRecord.email, mode: 'insensitive' },
      },
    });

    if (!user) {
      throw new BadRequestException('Associated user account was not found.');
    }

    // Hash the new password using the existing bcrypt implementation
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Mark current reset record as used
    await this.prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { usedAt: now },
    });

    // Invalidate all pending OTPs/tokens for this account
    await this.prisma.passwordReset.updateMany({
      where: {
        email: resetRecord.email,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    // Revoke previous sessions by recording password changed timestamp
    const changedTimestamp = Date.now();
    await this.redis.set(
      `auth:password_changed:${user.id}`,
      changedTimestamp.toString(),
      7 * 24 * 60 * 60, // 7 days
    );
    this.passwordChangedTimestamps.set(user.id.toString(), changedTimestamp);

    this.logger.log(
      `Password successfully reset for account ${this.mailService.maskEmail(user.email)}.`,
    );

    return {
      success: true,
      message: 'Password reset successfully. You can now sign in.',
    };
  }

  /**
   * Helper used by JwtStrategy to check if an access token was issued prior to password reset
   */
  async isTokenRevoked(userId: string, tokenIssuedAtSeconds?: number): Promise<boolean> {
    if (!tokenIssuedAtSeconds) return false;

    // Check Redis
    const redisTimestamp = await this.redis.get(`auth:password_changed:${userId}`);
    if (redisTimestamp) {
      const changedMs = parseInt(redisTimestamp, 10);
      if (tokenIssuedAtSeconds * 1000 < changedMs) {
        return true;
      }
    }

    // Check In-Memory fallback
    const memTimestamp = this.passwordChangedTimestamps.get(userId);
    if (memTimestamp && tokenIssuedAtSeconds * 1000 < memTimestamp) {
      return true;
    }

    return false;
  }
}
