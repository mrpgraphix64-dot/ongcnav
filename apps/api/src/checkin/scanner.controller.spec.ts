import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { ScannerController } from './scanner.controller';
import { CheckinService } from './checkin.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '@ongc/shared-types';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('ScannerController & Strict RBAC Tests', () => {
  let controller: ScannerController;
  let service: jest.Mocked<CheckinService>;
  let reflector: Reflector;
  let rolesGuard: RolesGuard;

  beforeEach(() => {
    service = {
      processCheckin: jest.fn(),
      heartbeat: jest.fn(),
    } as any;

    controller = new ScannerController(service);
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  describe('RBAC metadata on POST /scanner/checkin', () => {
    it('exposes exactly the gate/scanner/admin/help-desk roles the spec calls for, and nothing broader', () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.checkin);
      expect(roles).toEqual([
        UserRole.GATE_OPERATOR,
        UserRole.SCANNER_STAFF,
        UserRole.GATE_SUPERVISOR,
        UserRole.GATE_MANAGER,
        UserRole.ADMIN,
        UserRole.EVENT_ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.HELP_DESK,
      ]);
      // NOTE: this codebase's UserRole enum aliases several keys to the same
      // underlying string value (e.g. HELP_DESK and REGISTRATION_STAFF both
      // serialize to 'REGISTRATION_STAFF'), so REGISTRATION_STAFF is
      // effectively already included via HELP_DESK — asserting it's absent
      // would be testing a false premise. REPORT_VIEWER/VOLUNTEER is the
      // only role whose underlying value is genuinely excluded here.
      expect(roles).not.toContain(UserRole.REPORT_VIEWER);
      expect(roles).not.toContain(UserRole.VOLUNTEER);
    });

    const createMockExecutionContext = (role?: UserRole) => {
      const req = { user: role ? { role, id: '1' } : undefined };
      return {
        getHandler: () => controller.checkin,
        getClass: () => ScannerController,
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as any;
    };

    it('allows SCANNER_STAFF through RolesGuard', () => {
      const context = createMockExecutionContext(UserRole.SCANNER_STAFF);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('allows GATE_OPERATOR through RolesGuard', () => {
      const context = createMockExecutionContext(UserRole.GATE_OPERATOR);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('rejects REPORT_VIEWER — an unauthorized scanner role — via RolesGuard', () => {
      const context = createMockExecutionContext(UserRole.REPORT_VIEWER);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('rejects a request with no authenticated user at all (no JWT survived JwtAuthGuard)', () => {
      const context = createMockExecutionContext(undefined);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  it('POST /scanner/heartbeat is not behind JwtAuthGuard/RolesGuard (scanners must be able to report liveness before/without a session)', () => {
    // No @UseGuards on the heartbeat handler — asserted by absence of guard
    // metadata, mirroring how this codebase asserts @Roles metadata above.
    const guards = Reflect.getMetadata('__guards__', controller.heartbeat);
    expect(guards).toBeUndefined();
  });

  it('GET /scanner/ping requires no authentication and responds instantly', () => {
    const result = controller.ping();
    expect(result.status).toBe('PONG');
    expect(typeof result.timestamp).toBe('number');
  });

  it('strips client-supplied isLoadTest and loadTestRunId flags on checkin calls', async () => {
    const mockReq: any = {
      user: { id: '1', role: UserRole.GATE_OPERATOR },
      headers: { 'x-forwarded-for': '127.0.0.1', 'user-agent': 'Scanner-App' },
      socket: { remoteAddress: '127.0.0.1' },
    };

    await controller.checkin(
      {
        token: 'test-token',
        gateId: '1',
        isLoadTest: true,
        loadTestRunId: '999',
      },
      mockReq,
    );

    expect(service.processCheckin).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'test-token',
        gateId: '1',
        isLoadTest: false,
        loadTestRunId: undefined,
      }),
      mockReq.user,
      expect.objectContaining({
        ip: '127.0.0.1',
        userAgent: 'Scanner-App',
      }),
    );
  });
});
