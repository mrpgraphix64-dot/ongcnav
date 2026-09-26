import {
  isRoutePermittedForRole,
  UserRole,
  getDefaultPermissionsForRole,
  validatePermissionsForRole,
  E_PASS_ADMIN_PAGE_KEYS,
  EMPLOYEE_ADMIN_PAGE_KEYS,
} from '@ongc/shared-types';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DashboardService } from '../dashboard/dashboard.service';
import { AttendeesService } from '../registration/attendees.service';
import { HelpDeskService } from '../helpdesk/helpdesk.service';
import { StaffService } from '../staff/staff.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { PAGE_PERMISSION_KEY } from '../common/decorators/page-permission.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('Admin Domain Separation & Page Access Control', () => {
  describe('1. Centralized Route Authorization Matrix & Scanner Access Decision', () => {
    const commercialRoutes = [
      '/admin/commercial/orders',
      '/admin/commercial/agents',
      '/admin/commercial/agents/42',
      '/admin/commercial/inventory',
      '/admin/commercial/allocations',
      '/admin/commercial/bookings',
      '/admin/commercial/customers',
      '/admin/commercial/reports',
      '/admin/commercial/tickets',
    ];

    const employeeRoutes = [
      '/admin/attendees',
      '/admin/attendees/123',
      '/admin/bulk-upload',
      '/admin/helpdesk',
      '/admin/daily-closing',
      '/admin/reports',
    ];

    const globalAdminRoutes = [
      '/admin/event-control',
      '/admin/gates',
      '/admin/gates/5',
      '/admin/staff',
      '/admin/staff/10/activity',
      '/admin/settings',
      '/admin/traffic-test',
    ];

    describe('COMMERCIAL_ADMIN (E-Pass Admin)', () => {
      it('allows root dashboard and commercial routes by default', () => {
        expect(isRoutePermittedForRole('/admin', UserRole.COMMERCIAL_ADMIN)).toBe(true);
        for (const route of commercialRoutes) {
          expect(isRoutePermittedForRole(route, UserRole.COMMERCIAL_ADMIN)).toBe(true);
        }
      });

      it('strictly forbids /scanner access (desk role, turnstiles excluded)', () => {
        expect(isRoutePermittedForRole('/scanner', UserRole.COMMERCIAL_ADMIN)).toBe(false);
        expect(isRoutePermittedForRole('/scanner/lane-1', UserRole.COMMERCIAL_ADMIN)).toBe(false);
      });

      it('strictly forbids all employee domain routes', () => {
        for (const route of employeeRoutes) {
          expect(isRoutePermittedForRole(route, UserRole.COMMERCIAL_ADMIN)).toBe(false);
        }
      });

      it('strictly forbids all global administrative routes', () => {
        for (const route of globalAdminRoutes) {
          expect(isRoutePermittedForRole(route, UserRole.COMMERCIAL_ADMIN)).toBe(false);
        }
      });
    });

    describe('EMPLOYEE_ADMIN (Employee Admin)', () => {
      it('allows root dashboard and employee routes by default', () => {
        expect(isRoutePermittedForRole('/admin', UserRole.EMPLOYEE_ADMIN)).toBe(true);
        for (const route of employeeRoutes) {
          expect(isRoutePermittedForRole(route, UserRole.EMPLOYEE_ADMIN)).toBe(true);
        }
      });

      it('strictly forbids /scanner access (desk role, turnstiles excluded)', () => {
        expect(isRoutePermittedForRole('/scanner', UserRole.EMPLOYEE_ADMIN)).toBe(false);
        expect(isRoutePermittedForRole('/scanner/lane-2', UserRole.EMPLOYEE_ADMIN)).toBe(false);
      });

      it('strictly forbids all commercial domain routes', () => {
        for (const route of commercialRoutes) {
          expect(isRoutePermittedForRole(route, UserRole.EMPLOYEE_ADMIN)).toBe(false);
        }
      });

      it('strictly forbids all global administrative routes', () => {
        for (const route of globalAdminRoutes) {
          expect(isRoutePermittedForRole(route, UserRole.EMPLOYEE_ADMIN)).toBe(false);
        }
      });
    });

    describe('Operational Roles Scanner Access', () => {
      it('allows operational scanner roles to access /scanner', () => {
        expect(isRoutePermittedForRole('/scanner', UserRole.SCANNER_STAFF)).toBe(true);
        expect(isRoutePermittedForRole('/scanner', UserRole.GATE_MANAGER)).toBe(true);
        expect(isRoutePermittedForRole('/scanner', UserRole.EVENT_ADMIN)).toBe(true);
        expect(isRoutePermittedForRole('/scanner', UserRole.SUPER_ADMIN)).toBe(true);
      });
    });

    describe('SUPER_ADMIN (Global Admin)', () => {
      it('has unrestricted access to all routes without exception', () => {
        expect(isRoutePermittedForRole('/admin', UserRole.SUPER_ADMIN)).toBe(true);
        expect(isRoutePermittedForRole('/scanner', UserRole.SUPER_ADMIN)).toBe(true);
        for (const route of commercialRoutes) {
          expect(isRoutePermittedForRole(route, UserRole.SUPER_ADMIN)).toBe(true);
        }
        for (const route of employeeRoutes) {
          expect(isRoutePermittedForRole(route, UserRole.SUPER_ADMIN)).toBe(true);
        }
        for (const route of globalAdminRoutes) {
          expect(isRoutePermittedForRole(route, UserRole.SUPER_ADMIN)).toBe(true);
        }
      });
    });
  });

  describe('2. Granular Page Permission Definitions & Evaluation', () => {
    it('returns default E-Pass permissions containing all commercial keys', () => {
      const defaults = getDefaultPermissionsForRole(UserRole.COMMERCIAL_ADMIN);
      expect(defaults).toEqual(E_PASS_ADMIN_PAGE_KEYS);
      expect(defaults).toContain('commercial.dashboard');
      expect(defaults).toContain('commercial.orders');
      expect(defaults).toContain('commercial.customers');
      expect(defaults).toContain('commercial.agents');
      expect(defaults).toContain('commercial.inventory');
      expect(defaults).toContain('commercial.allocations');
      expect(defaults).toContain('commercial.reports');
      expect(defaults).toContain('commercial.tickets');
      expect(defaults.length).toBe(8);
    });

    it('returns default Employee permissions containing all employee keys', () => {
      const defaults = getDefaultPermissionsForRole(UserRole.EMPLOYEE_ADMIN);
      expect(defaults).toEqual(EMPLOYEE_ADMIN_PAGE_KEYS);
      expect(defaults).toContain('employee.dashboard');
      expect(defaults).toContain('employee.attendees');
      expect(defaults).toContain('employee.family_passes');
      expect(defaults).toContain('employee.bulk_upload');
      expect(defaults).toContain('employee.reports');
      expect(defaults).toContain('employee.operations');
      expect(defaults.length).toBe(6);
    });

    it('allows access to specific page when permission is granted', () => {
      const permissions = ['commercial.dashboard', 'commercial.orders'];
      expect(isRoutePermittedForRole('/admin/commercial/orders', UserRole.COMMERCIAL_ADMIN, permissions)).toBe(true);
    });

    it('blocks access to specific page (direct URL) when permission is revoked', () => {
      const permissions = ['commercial.dashboard']; // commercial.orders revoked
      expect(isRoutePermittedForRole('/admin/commercial/orders', UserRole.COMMERCIAL_ADMIN, permissions)).toBe(false);
    });

    it('blocks Employee page even if an employee permission is erroneously in E-Pass permissions array', () => {
      const permissions = ['commercial.dashboard', 'employee.attendees'];
      expect(isRoutePermittedForRole('/admin/attendees', UserRole.COMMERCIAL_ADMIN, permissions)).toBe(false);
    });

    it('blocks Commercial page even if a commercial permission is erroneously in Employee permissions array', () => {
      const permissions = ['employee.dashboard', 'commercial.orders'];
      expect(isRoutePermittedForRole('/admin/commercial/orders', UserRole.EMPLOYEE_ADMIN, permissions)).toBe(false);
    });

    it('validates permissions strictly against domain role', () => {
      const validCommercial = validatePermissionsForRole(UserRole.COMMERCIAL_ADMIN, [
        'commercial.orders',
        'commercial.inventory',
      ]);
      expect(validCommercial.valid).toBe(true);
      expect(validCommercial.invalidKeys).toEqual([]);

      const invalidCommercial = validatePermissionsForRole(UserRole.COMMERCIAL_ADMIN, [
        'commercial.orders',
        'employee.attendees',
      ]);
      expect(invalidCommercial.valid).toBe(false);
      expect(invalidCommercial.invalidKeys).toEqual(['employee.attendees']);

      const invalidEmployee = validatePermissionsForRole(UserRole.EMPLOYEE_ADMIN, [
        'employee.attendees',
        'commercial.orders',
      ]);
      expect(invalidEmployee.valid).toBe(false);
      expect(invalidEmployee.invalidKeys).toEqual(['commercial.orders']);
    });
  });

  describe('3. StaffService SUPER_ADMIN Page Permission Management', () => {
    let staffService: StaffService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        user: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        setting: {
          findUnique: jest.fn(),
          upsert: jest.fn(),
        },
      };
      staffService = new StaffService(mockPrisma);
    });

    it('loads safe defaults when user has no stored permissions', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: BigInt(45),
        name: 'E-Pass Officer',
        email: 'epass@ongc.internal',
        role: UserRole.COMMERCIAL_ADMIN,
      });
      mockPrisma.setting.findUnique.mockResolvedValue(null);

      const result = await staffService.getPagePermissions(BigInt(45));
      expect(result.userId).toBe('45');
      expect(result.domain).toBe('commercial');
      expect(result.isDefault).toBe(true);
      expect(result.assignedPermissions).toEqual(E_PASS_ADMIN_PAGE_KEYS);
    });

    it('allows SUPER_ADMIN to assign and persist customized permissions', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: BigInt(45),
        name: 'E-Pass Officer',
        email: 'epass@ongc.internal',
        role: UserRole.COMMERCIAL_ADMIN,
      });
      mockPrisma.setting.upsert.mockResolvedValue({});

      const customPerms = ['commercial.dashboard', 'commercial.inventory'];
      const result = await staffService.updatePagePermissions(
        BigInt(45),
        customPerms,
        { role: UserRole.SUPER_ADMIN },
      );

      expect(result.success).toBe(true);
      expect(result.assignedPermissions).toEqual(customPerms);
      expect(mockPrisma.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'page_permissions:user:45' },
          create: expect.objectContaining({
            value: JSON.stringify(customPerms),
          }),
        }),
      );
    });

    it('rejects cross-domain permission assignment with BadRequestException', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: BigInt(45),
        name: 'E-Pass Officer',
        email: 'epass@ongc.internal',
        role: UserRole.COMMERCIAL_ADMIN,
      });

      await expect(
        staffService.updatePagePermissions(
          BigInt(45),
          ['commercial.orders', 'employee.attendees'],
          { role: UserRole.SUPER_ADMIN },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('forbids non-SUPER_ADMIN users from managing page permissions', async () => {
      await expect(
        staffService.updatePagePermissions(
          BigInt(45),
          ['commercial.orders'],
          { role: UserRole.COMMERCIAL_ADMIN },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4. Backend API Enforcement via RolesGuard & Decorators', () => {
    let reflector: Reflector;
    let rolesGuard: RolesGuard;

    beforeEach(() => {
      reflector = new Reflector();
      rolesGuard = new RolesGuard(reflector);
    });

    function createMockContext(user: any, requiredRoles?: UserRole[], requiredPermissions?: string[]): any {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
        if (key === ROLES_KEY) return requiredRoles;
        if (key === PAGE_PERMISSION_KEY) return requiredPermissions;
        return undefined;
      });

      return {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
      };
    }

    it('allows COMMERCIAL_ADMIN through when required page permission is present (200)', () => {
      const context = createMockContext(
        {
          id: BigInt(10),
          role: UserRole.COMMERCIAL_ADMIN,
          pagePermissions: ['commercial.orders', 'commercial.dashboard'],
        },
        [UserRole.SUPER_ADMIN, UserRole.COMMERCIAL_ADMIN],
        ['commercial.orders'],
      );

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('throws ForbiddenException (403) when COMMERCIAL_ADMIN lacks required page permission', () => {
      const context = createMockContext(
        {
          id: BigInt(10),
          role: UserRole.COMMERCIAL_ADMIN,
          pagePermissions: ['commercial.dashboard'], // commercial.orders revoked
        },
        [UserRole.SUPER_ADMIN, UserRole.COMMERCIAL_ADMIN],
        ['commercial.orders'],
      );

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('allows EMPLOYEE_ADMIN through when required page permission is present (200)', () => {
      const context = createMockContext(
        {
          id: BigInt(20),
          role: UserRole.EMPLOYEE_ADMIN,
          pagePermissions: ['employee.attendees', 'employee.dashboard'],
        },
        [UserRole.SUPER_ADMIN, UserRole.EMPLOYEE_ADMIN],
        ['employee.attendees', 'employee.family_passes'],
      );

      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('throws ForbiddenException (403) when EMPLOYEE_ADMIN lacks required page permission', () => {
      const context = createMockContext(
        {
          id: BigInt(20),
          role: UserRole.EMPLOYEE_ADMIN,
          pagePermissions: ['employee.dashboard'], // employee.bulk_upload revoked
        },
        [UserRole.SUPER_ADMIN, UserRole.EMPLOYEE_ADMIN],
        ['employee.bulk_upload'],
      );

      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('allows SUPER_ADMIN unconditionally without restriction', () => {
      const context = createMockContext(
        {
          id: BigInt(1),
          role: UserRole.SUPER_ADMIN,
          pagePermissions: [], // even if empty
        },
        [UserRole.COMMERCIAL_ADMIN],
        ['commercial.orders'],
      );

      expect(rolesGuard.canActivate(context)).toBe(true);
    });
  });

  describe('5. AttendeesService Domain Scoping', () => {
    let service: AttendeesService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        attendee: {
          count: jest.fn().mockResolvedValue(10),
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn().mockResolvedValue(null),
          groupBy: jest.fn().mockResolvedValue([]),
        },
        employee: {
          count: jest.fn().mockResolvedValue(5),
        },
        commercialOrder: {
          count: jest.fn().mockResolvedValue(0),
        },
        setting: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      service = new AttendeesService(mockPrisma);
    });

    it('throws ForbiddenException when COMMERCIAL_ADMIN attempts to search attendees', async () => {
      await expect(service.index({}, UserRole.COMMERCIAL_ADMIN)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when COMMERCIAL_ADMIN attempts to bulk export attendees', async () => {
      await expect(service.bulkExport({}, UserRole.COMMERCIAL_ADMIN)).rejects.toThrow(ForbiddenException);
    });

    it('constrains EMPLOYEE_ADMIN to registrationType = EMPLOYEE and orderId = null', async () => {
      await service.index({}, UserRole.EMPLOYEE_ADMIN);
      expect(mockPrisma.attendee.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderId: null,
            employeeId: { not: null },
          }),
        }),
      );
    });

    it('throws ForbiddenException when COMMERCIAL_ADMIN attempts findOne', async () => {
      await expect(service.findOne(BigInt(101), UserRole.COMMERCIAL_ADMIN)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('6. HelpDeskService Domain Separation', () => {
    let service: HelpDeskService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        attendee: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        gate: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        setting: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      service = new HelpDeskService(mockPrisma);
    });

    it('throws ForbiddenException when COMMERCIAL_ADMIN attempts to search help desk', async () => {
      await expect(service.search('test query', UserRole.COMMERCIAL_ADMIN)).rejects.toThrow(ForbiddenException);
    });

    it('restricts search to registrationType = EMPLOYEE when called by EMPLOYEE_ADMIN', async () => {
      await service.search('query', UserRole.EMPLOYEE_ADMIN);
      expect(mockPrisma.attendee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            registrationType: 'EMPLOYEE',
          }),
        }),
      );
    });
  });

  describe('7. DashboardService Live Stats Domain Separation', () => {
    let service: DashboardService;
    let mockPrisma: any;
    let mockEventControlService: any;

    beforeEach(() => {
      mockPrisma = {
        attendee: {
          count: jest.fn().mockResolvedValue(50),
          findMany: jest.fn().mockResolvedValue([]),
        },
        employee: {
          count: jest.fn().mockResolvedValue(25),
        },
        familyMember: {
          count: jest.fn().mockResolvedValue(25),
        },
        commercialOrder: {
          count: jest.fn().mockResolvedValue(15),
          findMany: jest.fn().mockResolvedValue([]),
          aggregate: jest.fn().mockResolvedValue({ _sum: { amountPaise: 4500000 } }),
        },
        agentAllocation: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { allocatedQuantity: 100, bookedQuantity: 40 } }),
        },
        dailyCheckin: {
          count: jest.fn().mockResolvedValue(20),
          findMany: jest.fn().mockResolvedValue([]),
          groupBy: jest.fn().mockResolvedValue([]),
        },
        scanLog: {
          count: jest.fn().mockResolvedValue(2),
        },
        gate: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        setting: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };

      mockEventControlService = {
        getStatus: jest.fn().mockResolvedValue({
          eventStatus: 'open',
          scanningEnabled: true,
          emergencyStopped: false,
        }),
        getActiveEventDate: jest.fn().mockResolvedValue('2026-10-15'),
      };

      service = new DashboardService(mockPrisma, mockEventControlService);
    });

    it('provides commercial sales and omits employee counts for COMMERCIAL_ADMIN', async () => {
      const stats = await service.getLiveStats({ role: UserRole.COMMERCIAL_ADMIN });
      expect(stats.domain).toBe('commercial');
      expect(stats.commercialStats).toBeDefined();
      expect(stats.commercialStats?.commercialSalesInr).toBe(45000);
      expect(stats.commercialStats?.paidOrdersCount).toBe(15);
      expect(stats.employeeStats).toBeUndefined();
    });

    it('provides employee counts and omits commercial sales for EMPLOYEE_ADMIN', async () => {
      const stats = await service.getLiveStats({ role: UserRole.EMPLOYEE_ADMIN });
      expect(stats.domain).toBe('employee');
      expect(stats.employeeStats).toBeDefined();
      expect(stats.employeeStats?.totalEmployees).toBe(25);
      expect(stats.employeeStats?.totalFamilyMembers).toBe(25);
      expect(stats.commercialStats).toBeUndefined();
    });

    it('provides both domains for SUPER_ADMIN', async () => {
      const stats = await service.getLiveStats({ role: UserRole.SUPER_ADMIN });
      expect(stats.domain).toBe('global');
      expect(stats.commercialStats).toBeDefined();
      expect(stats.commercialStats?.commercialSalesInr).toBe(45000);
      expect(stats.employeeStats).toBeDefined();
      expect(stats.employeeStats?.totalEmployees).toBe(25);
      expect(stats.employeeStats?.totalFamilyMembers).toBe(25);
    });
  });
});
