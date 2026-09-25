import { Reflector } from '@nestjs/core';
import { AttendeesController } from './attendees.controller';
import { AttendeesService } from './attendees.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole, AttendeeStatus } from '@ongc/shared-types';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { ForbiddenException } from '@nestjs/common';

describe('AttendeesController & RBAC Parity Tests', () => {
  let controller: AttendeesController;
  let service: jest.Mocked<AttendeesService>;
  let reflector: Reflector;
  let rolesGuard: RolesGuard;

  beforeEach(() => {
    service = {
      index: jest.fn(),
      search: jest.fn(),
      findOne: jest.fn(),
      createQuickAttendee: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      regenerateQr: jest.fn(),
      bulkRegenerateQr: jest.fn(),
      destroy: jest.fn(),
      bulkDestroy: jest.fn(),
      bulkExport: jest.fn(),
      bulkTickets: jest.fn(),
      statusSync: jest.fn(),
      getQrImageBuffer: jest.fn(),
      analyzeCsv: jest.fn(),
      importCsv: jest.fn(),
      getPhotoPath: jest.fn(),
    } as any;

    controller = new AttendeesController(service);
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  describe('RBAC Authorization Matrix', () => {
    it('has @Roles metadata matching domain isolation (SUPER_ADMIN, EMPLOYEE_ADMIN, REGISTRATION_STAFF)', () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, AttendeesController);
      expect(roles).toBeDefined();
      expect(roles).toEqual([
        UserRole.SUPER_ADMIN,
        UserRole.EMPLOYEE_ADMIN,
        UserRole.REGISTRATION_STAFF,
      ]);
      expect(roles).not.toContain(UserRole.EVENT_ADMIN);
      expect(roles).not.toContain(UserRole.COMMERCIAL_ADMIN);
      expect(roles).not.toContain(UserRole.COMMERCIAL_AGENT);
      expect(roles).not.toContain(UserRole.COMMERCIAL_SUB_AGENT);
      expect(roles).not.toContain(UserRole.GATE_MANAGER);
      expect(roles).not.toContain(UserRole.SCANNER_STAFF);
      expect(roles).not.toContain(UserRole.REPORT_VIEWER);
    });

    const createMockExecutionContext = (role?: UserRole) => {
      const req = { user: role ? { role, id: '1' } : undefined };
      return {
        getHandler: () => controller.index,
        getClass: () => AttendeesController,
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as any;
    };

    it('allows SUPER_ADMIN access via RolesGuard', () => {
      const context = createMockExecutionContext(UserRole.SUPER_ADMIN);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('allows EMPLOYEE_ADMIN access via RolesGuard', () => {
      const context = createMockExecutionContext(UserRole.EMPLOYEE_ADMIN);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('allows REGISTRATION_STAFF access via RolesGuard', () => {
      const context = createMockExecutionContext(UserRole.REGISTRATION_STAFF);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('throws ForbiddenException for EVENT_ADMIN (domain isolation: operational only, no employee PII)', () => {
      const context = createMockExecutionContext(UserRole.EVENT_ADMIN);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for COMMERCIAL_ADMIN (domain isolation: commercial only, no employee domain)', () => {
      const context = createMockExecutionContext(UserRole.COMMERCIAL_ADMIN);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for COMMERCIAL_AGENT and COMMERCIAL_SUB_AGENT', () => {
      const agentCtx = createMockExecutionContext(UserRole.COMMERCIAL_AGENT);
      expect(() => rolesGuard.canActivate(agentCtx)).toThrow(ForbiddenException);

      const subAgentCtx = createMockExecutionContext(UserRole.COMMERCIAL_SUB_AGENT);
      expect(() => rolesGuard.canActivate(subAgentCtx)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for GATE_MANAGER', () => {
      const context = createMockExecutionContext(UserRole.GATE_MANAGER);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for GATE_SUPERVISOR', () => {
      const context = createMockExecutionContext(UserRole.GATE_SUPERVISOR);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for SCANNER_STAFF', () => {
      const context = createMockExecutionContext(UserRole.SCANNER_STAFF);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for REPORT_VIEWER', () => {
      const context = createMockExecutionContext(UserRole.REPORT_VIEWER);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('Controller delegation', () => {
    it('index delegates with query parameters', async () => {
      service.index.mockResolvedValueOnce({
        metrics: {} as any,
        primaryAttendees: [],
        attendees: [],
        pagination: {} as any,
      });

      const mockReq = { user: { role: UserRole.REGISTRATION_STAFF } } as any;
      await controller.index(mockReq, '2', '15', 'Rahul', 'active', 'General');
      expect(service.index).toHaveBeenCalledWith(
        {
          page: 2,
          limit: 15,
          search: 'Rahul',
          status: 'active',
          category: 'General',
        },
        UserRole.REGISTRATION_STAFF,
      );
    });

    it('create delegates to createQuickAttendee', async () => {
      const payload = { name: 'Priya', mobile: '9876543210', email: 'priya@example.com' };
      service.createQuickAttendee.mockResolvedValueOnce({ success: true } as any);

      await controller.create(payload);
      expect(service.createQuickAttendee).toHaveBeenCalledWith(payload);
    });

    it('statusSync parses comma-separated IDs to BigInt array', async () => {
      service.statusSync.mockResolvedValueOnce({ statuses: {}, counts: {} as any });

      await controller.statusSync('1,2,3');
      expect(service.statusSync).toHaveBeenCalledWith([BigInt(1), BigInt(2), BigInt(3)]);
    });

    it('bulkDestroy converts IDs and calls bulkDestroy', async () => {
      service.bulkDestroy.mockResolvedValueOnce({ success: true, message: 'Deleted' });

      await controller.bulkDestroy(['10', '20']);
      expect(service.bulkDestroy).toHaveBeenCalledWith([BigInt(10), BigInt(20)]);
    });

    it('bulkRegenerateQr converts IDs and calls bulkRegenerateQr', async () => {
      service.bulkRegenerateQr.mockResolvedValueOnce({ success: true, message: 'Regenerated' });

      await controller.bulkRegenerateQr(['10', '20']);
      expect(service.bulkRegenerateQr).toHaveBeenCalledWith([BigInt(10), BigInt(20)]);
    });
  });
});
