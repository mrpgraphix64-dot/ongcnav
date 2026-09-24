import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwt: any;
  let config: any;
  let configValues: Record<string, string | undefined>;

  const realUser = {
    id: BigInt(1),
    staffId: 'STAFF-1',
    email: 'operator@ongc.co.in',
    name: 'Real Operator',
    role: 'GATE_OPERATOR',
    isActive: true,
    password: '', // set per-test with a real bcrypt hash
    gateUsers: [],
  };

  beforeEach(async () => {
    configValues = {};

    prisma = {
      user: { findFirst: jest.fn() },
    };
    jwt = {
      sign: jest.fn().mockReturnValue('signed.jwt.token'),
    };
    config = {
      get: jest.fn((key: string) => configValues[key]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('real user login', () => {
    it('logs in successfully with a correct password', async () => {
      const hash = await bcrypt.hash('correct-password', 4);
      prisma.user.findFirst.mockResolvedValue({ ...realUser, password: hash });

      const result = await service.login({ identifier: 'operator@ongc.co.in', password: 'correct-password' });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.role).toBe('GATE_OPERATOR');
    });

    it('rejects an incorrect password using the secure bcrypt comparison', async () => {
      const hash = await bcrypt.hash('correct-password', 4);
      prisma.user.findFirst.mockResolvedValue({ ...realUser, password: hash });

      await expect(
        service.login({ identifier: 'operator@ongc.co.in', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects login for an inactive account', async () => {
      const hash = await bcrypt.hash('correct-password', 4);
      prisma.user.findFirst.mockResolvedValue({ ...realUser, password: hash, isActive: false });

      await expect(
        service.login({ identifier: 'operator@ongc.co.in', password: 'correct-password' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('emergency fallback admin (no demo bypass)', () => {
    it('fails closed when ADMIN_EMAIL/ADMIN_PASSWORD are not configured, even with the historical default credentials', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      // configValues intentionally left empty — nothing configured

      await expect(
        service.login({ identifier: 'admin@ongc.co.in', password: 'admin123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('authenticates only when both ADMIN_EMAIL and ADMIN_PASSWORD are explicitly configured and match', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      configValues.ADMIN_EMAIL = 'realadmin@ongc.co.in';
      configValues.ADMIN_PASSWORD = 'a-real-configured-password';

      const result = await service.login({ identifier: 'realadmin@ongc.co.in', password: 'a-real-configured-password' });
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.role).toBe('SUPER_ADMIN');
    });

    it('rejects the fallback login if the password does not match the configured value', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      configValues.ADMIN_EMAIL = 'realadmin@ongc.co.in';
      configValues.ADMIN_PASSWORD = 'a-real-configured-password';

      await expect(
        service.login({ identifier: 'realadmin@ongc.co.in', password: 'guessed-wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('has no demoLogin method — the demo/bypass authentication path has been removed entirely', () => {
      expect((service as any).demoLogin).toBeUndefined();
    });
  });

  describe('unknown identifier', () => {
    it('rejects an identifier that matches no real user and no configured fallback admin', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      configValues.ADMIN_EMAIL = 'realadmin@ongc.co.in';
      configValues.ADMIN_PASSWORD = 'a-real-configured-password';

      await expect(
        service.login({ identifier: 'nobody@ongc.co.in', password: 'anything' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
