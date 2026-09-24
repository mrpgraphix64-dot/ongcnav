import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

describe('JwtStrategy construction (fail-fast JWT_SECRET behavior)', () => {
  const prisma = {} as PrismaService;

  it('throws during construction when JWT_SECRET is not configured — the app cannot start', () => {
    const config: any = { get: () => undefined };
    expect(() => new JwtStrategy(config, prisma)).toThrow(/JWT_SECRET environment variable is required/);
  });

  it('throws during construction when JWT_SECRET is the old hardcoded fallback value', () => {
    const config: any = { get: () => 'ongc-navratri-jwt-secret-key-2026' };
    expect(() => new JwtStrategy(config, prisma)).toThrow(/known placeholder\/default value/);
  });

  it('constructs successfully with a real, sufficiently long, non-placeholder secret', () => {
    const config: any = { get: () => 'a'.repeat(64) };
    expect(() => new JwtStrategy(config, prisma)).not.toThrow();
  });
});
