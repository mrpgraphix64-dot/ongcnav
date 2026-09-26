import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordResetService } from './password-reset.service';

describe('JwtStrategy construction (fail-fast JWT_SECRET behavior)', () => {
  const prisma = {} as PrismaService;
  const passwordResetService = {
    isTokenRevoked: jest.fn().mockResolvedValue(false),
  } as unknown as PasswordResetService;

  it('throws during construction when JWT_SECRET is not configured — the app cannot start', () => {
    const config: any = { get: () => undefined };
    expect(() => new JwtStrategy(config, prisma, passwordResetService)).toThrow(
      /JWT_SECRET environment variable is required/,
    );
  });

  it('throws during construction when JWT_SECRET is the old hardcoded fallback value', () => {
    const config: any = { get: () => 'ongc-navratri-jwt-secret-key-2026' };
    expect(() => new JwtStrategy(config, prisma, passwordResetService)).toThrow(
      /known placeholder\/default value/,
    );
  });

  it('constructs successfully with a real, sufficiently long, non-placeholder secret', () => {
    const config: any = { get: () => 'a'.repeat(64) };
    expect(() => new JwtStrategy(config, prisma, passwordResetService)).not.toThrow();
  });

  it('explicitly rejects reset authorization tokens from accessing authenticated APIs', async () => {
    const config: any = { get: () => 'a'.repeat(64) };
    const strategy = new JwtStrategy(config, prisma, passwordResetService);

    await expect(
      strategy.validate({ sub: '123', purpose: 'password_reset' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects tokens issued prior to a password reset (session revocation)', async () => {
    const config: any = { get: () => 'a'.repeat(64) };
    const customResetService = {
      isTokenRevoked: jest.fn().mockResolvedValue(true),
    } as unknown as PasswordResetService;

    const strategy = new JwtStrategy(config, prisma, customResetService);

    await expect(
      strategy.validate({ sub: '123', iat: 1000 }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
