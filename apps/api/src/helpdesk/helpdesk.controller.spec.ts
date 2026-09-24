import { Reflector } from '@nestjs/core';
import { HelpDeskController } from './helpdesk.controller';
import { CheckinCorrectionController } from './checkin-correction.controller';
import { HelpDeskService } from './helpdesk.service';
import { UserRole } from '@ongc/shared-types';

describe('HelpDeskController RBAC and Endpoints', () => {
  let controller: HelpDeskController;
  let voidController: CheckinCorrectionController;
  let service: jest.Mocked<HelpDeskService>;
  const reflector = new Reflector();

  beforeEach(() => {
    service = {
      search: jest.fn(),
      manualCheckin: jest.fn(),
      voidCheckin: jest.fn(),
    } as any;

    controller = new HelpDeskController(service);
    voidController = new CheckinCorrectionController(service);
  });

  describe('RBAC Authorization Parity', () => {
    it('allows SUPER_ADMIN, EVENT_ADMIN, GATE_MANAGER, REGISTRATION_STAFF, SCANNER_STAFF on search', () => {
      const roles = reflector.get<UserRole[]>('roles', controller.search);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.SUPER_ADMIN);
      expect(roles).toContain(UserRole.EVENT_ADMIN);
      expect(roles).toContain(UserRole.GATE_MANAGER);
      expect(roles).toContain(UserRole.REGISTRATION_STAFF);
      expect(roles).toContain(UserRole.SCANNER_STAFF);
      // Denied roles
      expect(roles).not.toContain(UserRole.REPORT_VIEWER);
      expect(roles).not.toContain(UserRole.VOLUNTEER);
    });

    it('allows SUPER_ADMIN, EVENT_ADMIN, GATE_MANAGER, REGISTRATION_STAFF, SCANNER_STAFF on manual checkin', () => {
      const roles = reflector.get<UserRole[]>('roles', controller.manualCheckin);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.SUPER_ADMIN);
      expect(roles).toContain(UserRole.EVENT_ADMIN);
      expect(roles).toContain(UserRole.GATE_MANAGER);
      expect(roles).toContain(UserRole.REGISTRATION_STAFF);
      expect(roles).toContain(UserRole.SCANNER_STAFF);
      // Denied roles
      expect(roles).not.toContain(UserRole.REPORT_VIEWER);
      expect(roles).not.toContain(UserRole.VOLUNTEER);
    });

    it('strictly restricts voiding check-ins to SUPER_ADMIN and EVENT_ADMIN', () => {
      const roles = reflector.get<UserRole[]>('roles', controller.voidCheckin);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.SUPER_ADMIN);
      expect(roles).toContain(UserRole.EVENT_ADMIN);
      // Gate managers, scanner staff, and registration staff MUST NOT void check-ins
      expect(roles).not.toContain(UserRole.GATE_MANAGER);
      expect(roles).not.toContain(UserRole.REGISTRATION_STAFF);
      expect(roles).not.toContain(UserRole.SCANNER_STAFF);
      expect(roles).not.toContain(UserRole.REPORT_VIEWER);
    });

    it('strictly restricts canonical /admin/checkin/:id/void to SUPER_ADMIN and EVENT_ADMIN', () => {
      const roles = reflector.get<UserRole[]>('roles', voidController.void);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.SUPER_ADMIN);
      expect(roles).toContain(UserRole.EVENT_ADMIN);
      expect(roles).not.toContain(UserRole.GATE_MANAGER);
      expect(roles).not.toContain(UserRole.REGISTRATION_STAFF);
      expect(roles).not.toContain(UserRole.SCANNER_STAFF);
    });
  });

  describe('Endpoint Delegation', () => {
    it('delegates search with query and user role', async () => {
      service.search.mockResolvedValue({ attendees: [], gates: [], activeDate: '2026-09-24', canViewCpf: true });
      const req = { user: { id: '1', role: 'SUPER_ADMIN' } } as any;

      const res = await controller.search('NR2026', req);
      expect(service.search).toHaveBeenCalledWith('NR2026', 'SUPER_ADMIN');
      expect(res.canViewCpf).toBe(true);
    });

    it('delegates manualCheckin with user ID', async () => {
      service.manualCheckin.mockResolvedValue({
        success: true,
        message: 'Approved',
        checkinId: '10',
        ticketNumber: 'NR2026-000001',
        ticket_id: 'NR2026-000001',
        attendeeName: 'Test Attendee',
        gateName: 'Gate 1',
        checkedInAt: new Date().toISOString(),
        isManual: true,
        manualReason: 'Screen broken',
      });

      const req = { user: { id: '42' } } as any;
      const dto = { attendeeId: '5', gateId: '1', reason: 'Screen broken' };

      const res = await controller.manualCheckin(dto, req);
      expect(service.manualCheckin).toHaveBeenCalledWith(dto, BigInt(42));
      expect(res.success).toBe(true);
    });

    it('delegates voidCheckin with checkin ID and reason', async () => {
      service.voidCheckin.mockResolvedValue({
        success: true,
        message: 'Voided successfully',
        checkinId: '10',
        ticketNumber: 'NR2026-000001',
        attendeeName: 'Test Attendee',
      });

      const req = { user: { id: '1' } } as any;
      const res = await controller.voidCheckin('10', { reason: 'Wrong pass scanned by accident' }, req);
      expect(service.voidCheckin).toHaveBeenCalledWith(BigInt(10), 'Wrong pass scanned by accident', BigInt(1));
      expect(res.success).toBe(true);
    });
  });
});
