import { Reflector } from '@nestjs/core';
import { GatesController } from './gates.controller';
import { GatesService } from './gates.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '@ongc/shared-types';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('GatesController RBAC Parity Verification', () => {
  let controller: GatesController;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
    const mockGatesService = {} as GatesService;
    controller = new GatesController(mockGatesService);
  });

  function createMockContext(handler: Function, role: string): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => GatesController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  const operations = [
    { name: 'findAll (GET /admin/gates)', handler: GatesController.prototype.findAll },
    { name: 'getAvailableStaff (GET /admin/gates/available-staff)', handler: GatesController.prototype.getAvailableStaff },
    { name: 'findOne (GET /admin/gates/:id)', handler: GatesController.prototype.findOne },
    { name: 'create (POST /admin/gates)', handler: GatesController.prototype.create },
    { name: 'update (PUT /admin/gates/:id)', handler: GatesController.prototype.update },
    { name: 'toggleStatus (POST /admin/gates/:id/toggle-status)', handler: GatesController.prototype.toggleStatus },
    { name: 'toggle (POST /admin/gates/:id/toggle)', handler: GatesController.prototype.toggle },
    { name: 'remove (DELETE /admin/gates/:id)', handler: GatesController.prototype.remove },
  ];

  const allowedRoles = [
    'SUPER_ADMIN',
    'EVENT_ADMIN',
    'GATE_MANAGER',
  ];

  const forbiddenRoles = [
    'GATE_SUPERVISOR',
    'HELP_DESK',
    'REGISTRATION_STAFF',
    'REPORT_VIEWER',
    'SCANNER_STAFF',
    'ADMIN', // Only SUPER_ADMIN, EVENT_ADMIN, GATE_MANAGER are authorized for Gate Management
  ];

  describe('Authorized Roles (SUPER_ADMIN, EVENT_ADMIN, GATE_MANAGER)', () => {
    for (const op of operations) {
      for (const role of allowedRoles) {
        it(`should ALLOW role "${role}" on ${op.name}`, () => {
          const ctx = createMockContext(op.handler, role);
          expect(rolesGuard.canActivate(ctx)).toBe(true);
        });
      }
    }
  });

  describe('Forbidden Roles (Must receive 403 Forbidden)', () => {
    for (const op of operations) {
      for (const role of forbiddenRoles) {
        it(`should REJECT role "${role}" with 403 Forbidden on ${op.name}`, () => {
          const ctx = createMockContext(op.handler, role);
          expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
        });
      }
    }
  });
});
