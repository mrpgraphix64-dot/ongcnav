import { Reflector } from '@nestjs/core';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '@ongc/shared-types';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { ForbiddenException } from '@nestjs/common';

describe('StaffController & Strict RBAC Tests', () => {
  let controller: StaffController;
  let service: jest.Mocked<StaffService>;
  let reflector: Reflector;
  let rolesGuard: RolesGuard;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      toggleStatus: jest.fn(),
      getActivity: jest.fn(),
      assignGate: jest.fn(),
      unassignGate: jest.fn(),
    } as any;

    controller = new StaffController(service);
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  describe('RBAC Metadata Verification', () => {
    it('should have @Roles metadata with ONLY SUPER_ADMIN and EVENT_ADMIN', () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, StaffController);
      expect(roles).toBeDefined();
      expect(roles).toEqual([UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN]);
      expect(roles).not.toContain(UserRole.GATE_MANAGER);
      expect(roles).not.toContain(UserRole.SCANNER_STAFF);
      expect(roles).not.toContain(UserRole.REGISTRATION_STAFF);
      expect(roles).not.toContain(UserRole.REPORT_VIEWER);
    });

    const createMockExecutionContext = (role?: UserRole) => {
      const req = { user: role ? { role, id: '1' } : undefined };
      return {
        getHandler: () => controller.findAll,
        getClass: () => StaffController,
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as any;
    };

    it('should allow SUPER_ADMIN access via RolesGuard', () => {
      const context = createMockExecutionContext(UserRole.SUPER_ADMIN);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('should allow EVENT_ADMIN access via RolesGuard', () => {
      const context = createMockExecutionContext(UserRole.EVENT_ADMIN);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('should throw ForbiddenException for GATE_MANAGER', () => {
      const context = createMockExecutionContext(UserRole.GATE_MANAGER);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for GATE_SUPERVISOR', () => {
      const context = createMockExecutionContext(UserRole.GATE_SUPERVISOR);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for SCANNER_STAFF', () => {
      const context = createMockExecutionContext(UserRole.SCANNER_STAFF);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for REGISTRATION_STAFF', () => {
      const context = createMockExecutionContext(UserRole.REGISTRATION_STAFF);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for REPORT_VIEWER', () => {
      const context = createMockExecutionContext(UserRole.REPORT_VIEWER);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('Controller delegation', () => {
    it('findAll delegates with query filters', async () => {
      service.findAll.mockResolvedValueOnce([{ id: '1', name: 'Rahul' } as any]);
      const res = await controller.findAll('SCANNER_STAFF', 'active', 'Rahul');
      expect(service.findAll).toHaveBeenCalledWith('SCANNER_STAFF', 'active', 'Rahul');
      expect(res).toEqual([{ id: '1', name: 'Rahul' }]);
    });

    it('findOne delegates to service with BigInt', async () => {
      service.findOne.mockResolvedValueOnce({ id: '2', name: 'Pooja' } as any);
      const res = await controller.findOne('2');
      expect(service.findOne).toHaveBeenCalledWith(BigInt(2));
      expect(res.name).toBe('Pooja');
    });

    it('create delegates to service', async () => {
      const dto = { name: 'Amit', email: 'amit@ongc.co.in', role: UserRole.SCANNER_STAFF };
      service.create.mockResolvedValueOnce({ id: '3', ...dto } as any);
      const res = await controller.create(dto as any);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(res.id).toBe('3');
    });

    it('update delegates to service with BigInt', async () => {
      const dto = { name: 'Amit K' };
      service.update.mockResolvedValueOnce({ id: '3', name: 'Amit K' } as any);
      const res = await controller.update('3', dto as any);
      expect(service.update).toHaveBeenCalledWith(BigInt(3), dto);
      expect(res.name).toBe('Amit K');
    });

    it('toggle & toggleStatus delegate to service.toggleStatus', async () => {
      service.toggleStatus.mockResolvedValue({ id: '4', isActive: false } as any);
      await controller.toggle('4');
      await controller.toggleStatus('4');
      expect(service.toggleStatus).toHaveBeenCalledTimes(2);
      expect(service.toggleStatus).toHaveBeenCalledWith(BigInt(4), undefined);
    });

    it('getActivity delegates to service.getActivity with pagination', async () => {
      service.getActivity.mockResolvedValueOnce({ user: {}, logs: { data: [], total: 0 } } as any);
      await controller.getActivity('5', '2', '10');
      expect(service.getActivity).toHaveBeenCalledWith(BigInt(5), 2, 10);
    });
  });
});
