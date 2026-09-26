import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@ongc/shared-types';
import { DashboardController } from '../dashboard/dashboard.controller';
import { EventControlController } from '../event-control/event-control.controller';
import { AttendeesController } from '../registration/attendees.controller';
import { CommercialAdminController } from '../commercial/commercial.controller';

describe('Authentication Session Isolation & RBAC Protection', () => {
  let authController: AuthController;
  let authService: any;
  let passwordResetService: any;
  let prismaService: any;
  let jwtStrategy: JwtStrategy;

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockImplementation((dto) => {
        if (dto.identifier === 'agent@example.com') {
          return Promise.resolve({
            accessToken: 'mock-agent-jwt',
            user: { id: '10', name: 'Agent User', email: 'agent@example.com', role: UserRole.COMMERCIAL_AGENT },
          });
        }
        return Promise.resolve({
          accessToken: 'mock-admin-jwt',
          user: { id: '1', name: 'Admin User', email: 'admin@ongc.co.in', role: UserRole.SUPER_ADMIN },
        });
      }),
    };

    passwordResetService = {
      isTokenRevoked: jest.fn().mockResolvedValue(false),
      forgotPassword: jest.fn().mockResolvedValue({ success: true }),
      verifyResetOtp: jest.fn().mockResolvedValue({ success: true, resetToken: 'tok' }),
      resetPassword: jest.fn().mockResolvedValue({ success: true }),
    };

    prismaService = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === BigInt(1)) {
            return Promise.resolve({
              id: BigInt(1),
              name: 'Admin User',
              email: 'admin@ongc.co.in',
              role: UserRole.SUPER_ADMIN,
              isActive: true,
              gateUsers: [],
            });
          }
          if (where.id === BigInt(10)) {
            return Promise.resolve({
              id: BigInt(10),
              name: 'Agent User',
              email: 'agent@example.com',
              role: UserRole.COMMERCIAL_AGENT,
              isActive: true,
              gateUsers: [],
            });
          }
          return Promise.resolve(null);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: PasswordResetService, useValue: passwordResetService },
        { provide: PrismaService, useValue: prismaService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => (key === 'JWT_SECRET' ? 'test-secret-at-least-32-chars-long' : null)),
          },
        },
        JwtStrategy,
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('Single Unified Auth Session Cookie', () => {
    it('login sets the unified ongc_auth_session cookie and backward-compatible admin_token', async () => {
      const res = { cookie: jest.fn() } as any;
      const result = await authController.login({ identifier: 'admin@ongc.co.in', password: 'password123' }, res);

      expect(result.accessToken).toBe('mock-admin-jwt');
      expect(res.cookie).toHaveBeenCalledWith(
        'ongc_auth_session',
        'mock-admin-jwt',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'admin_token',
        'mock-admin-jwt',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      );
    });

    it('logging in as an agent overwrites the unified ongc_auth_session cookie', async () => {
      const res = { cookie: jest.fn() } as any;
      const result = await authController.login({ identifier: 'agent@example.com', password: 'password123' }, res);

      expect(result.accessToken).toBe('mock-agent-jwt');
      expect(result.user.role).toBe(UserRole.COMMERCIAL_AGENT);
      expect(res.cookie).toHaveBeenCalledWith(
        'ongc_auth_session',
        'mock-agent-jwt',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      );
    });

    it('logout clears both ongc_auth_session and admin_token cookies', async () => {
      const res = { clearCookie: jest.fn() } as any;
      const result = await authController.logout(res);

      expect(res.clearCookie).toHaveBeenCalledWith('ongc_auth_session');
      expect(res.clearCookie).toHaveBeenCalledWith('admin_token');
      expect(result.success).toBe(true);
    });
  });

  describe('JWT Strategy Extraction & Validation', () => {
    it('authenticates active user payload via JwtStrategy', async () => {
      const user = await jwtStrategy.validate({ sub: '1', iat: Math.floor(Date.now() / 1000) });
      expect(user).toBeDefined();
      expect(user.email).toBe('admin@ongc.co.in');
      expect(user.role).toBe(UserRole.SUPER_ADMIN);
    });

    it('rejects password reset temporary tokens from authenticating API routes', async () => {
      await expect(
        jwtStrategy.validate({ sub: '1', purpose: 'password_reset', iat: Math.floor(Date.now() / 1000) }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects authentication if token was revoked due to password reset', async () => {
      passwordResetService.isTokenRevoked.mockResolvedValueOnce(true);
      await expect(
        jwtStrategy.validate({ sub: '1', iat: Math.floor(Date.now() / 1000) - 100 }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects authentication for inactive or nonexistent users', async () => {
      await expect(
        jwtStrategy.validate({ sub: '999', iat: Math.floor(Date.now() / 1000) }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Role-Based Access Control & Domain Isolation Matrix', () => {
    const getRoles = (target: any): UserRole[] => {
      return Reflect.getMetadata('roles', target) || [];
    };

    it('DashboardController.getLiveStats allows both COMMERCIAL_ADMIN and EMPLOYEE_ADMIN alongside SUPER_ADMIN', () => {
      const roles = getRoles(DashboardController.prototype.getLiveStats);
      expect(roles).toContain(UserRole.SUPER_ADMIN);
      expect(roles).toContain(UserRole.COMMERCIAL_ADMIN);
      expect(roles).toContain(UserRole.EMPLOYEE_ADMIN);
    });

    it('EventControlController.getStatus allows both COMMERCIAL_ADMIN and EMPLOYEE_ADMIN alongside SUPER_ADMIN', () => {
      const roles = getRoles(EventControlController.prototype.getStatus);
      expect(roles).toContain(UserRole.SUPER_ADMIN);
      expect(roles).toContain(UserRole.COMMERCIAL_ADMIN);
      expect(roles).toContain(UserRole.EMPLOYEE_ADMIN);
    });

    it('Commercial domain endpoints strictly permit COMMERCIAL_ADMIN and SUPER_ADMIN, blocking EMPLOYEE_ADMIN', () => {
      const listOrdersRoles = getRoles(CommercialAdminController.prototype.listOrders);
      expect(listOrdersRoles).toContain(UserRole.SUPER_ADMIN);
      expect(listOrdersRoles).toContain(UserRole.COMMERCIAL_ADMIN);
      expect(listOrdersRoles).not.toContain(UserRole.EMPLOYEE_ADMIN);

      const bulkDeleteRoles = getRoles(CommercialAdminController.prototype.bulkDeleteOrders);
      expect(bulkDeleteRoles).toContain(UserRole.SUPER_ADMIN);
      expect(bulkDeleteRoles).toContain(UserRole.COMMERCIAL_ADMIN);
      expect(bulkDeleteRoles).not.toContain(UserRole.EMPLOYEE_ADMIN);
    });

    it('Employee attendees domain strictly permits EMPLOYEE_ADMIN and SUPER_ADMIN, blocking COMMERCIAL_ADMIN', () => {
      const attendeesRoles = getRoles(AttendeesController);
      expect(attendeesRoles).toContain(UserRole.SUPER_ADMIN);
      expect(attendeesRoles).toContain(UserRole.EMPLOYEE_ADMIN);
      expect(attendeesRoles).not.toContain(UserRole.COMMERCIAL_ADMIN);
    });
  });
});
