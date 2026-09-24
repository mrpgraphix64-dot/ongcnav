import { Reflector } from '@nestjs/core';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { UserRole } from '@ongc/shared-types';

describe('IncidentsController RBAC and Endpoints', () => {
  let controller: IncidentsController;
  let service: jest.Mocked<IncidentsService>;
  const reflector = new Reflector();

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      resolve: jest.fn(),
      update: jest.fn(),
    } as any;

    controller = new IncidentsController(service);
  });

  describe('RBAC Authorization Parity', () => {
    it('allows SUPER_ADMIN, EVENT_ADMIN, GATE_MANAGER, SCANNER_STAFF on list, create, and resolve', () => {
      const listRoles = reflector.get<UserRole[]>('roles', controller.findAll);
      const createRoles = reflector.get<UserRole[]>('roles', controller.create);
      const resolveRoles = reflector.get<UserRole[]>('roles', controller.resolve);

      for (const roles of [listRoles, createRoles, resolveRoles]) {
        expect(roles).toBeDefined();
        expect(roles).toContain(UserRole.SUPER_ADMIN);
        expect(roles).toContain(UserRole.EVENT_ADMIN);
        expect(roles).toContain(UserRole.GATE_MANAGER);
        expect(roles).toContain(UserRole.SCANNER_STAFF);

        // Denied roles
        expect(roles).not.toContain(UserRole.REGISTRATION_STAFF);
        expect(roles).not.toContain(UserRole.REPORT_VIEWER);
        expect(roles).not.toContain(UserRole.VOLUNTEER);
      }
    });
  });

  describe('Endpoint Delegation', () => {
    it('delegates findAll with filters and pagination', async () => {
      service.findAll.mockResolvedValue({
        incidents: [],
        metrics: { totalCount: 0, openCount: 0, inReviewCount: 0, resolvedCount: 0 },
        totalCount: 0,
        openCount: 0,
        inReviewCount: 0,
        resolvedCount: 0,
        categories: {},
        gates: [],
        selectedDate: '2026-09-24',
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      });

      const res = await controller.findAll('2026-09-24', '1', 'OPEN', 'SECURITY', '1', '20');
      expect(service.findAll).toHaveBeenCalledWith({
        date: '2026-09-24',
        gateId: '1',
        status: 'OPEN',
        category: 'SECURITY',
        page: 1,
        limit: 20,
      });
      expect(res.incidents).toEqual([]);
    });

    it('delegates create with reporter user ID', async () => {
      service.create.mockResolvedValue({
        id: '1',
        incident_id: 'INC-20260924-0001',
        incidentNumber: 'INC-20260924-0001',
        category: 'SECURITY',
        severity: 'HIGH',
        status: 'OPEN',
        title: 'Barrier breach',
        description: 'Crowd pushed through barrier',
      } as any);

      const req = { user: { id: '7' } } as any;
      const dto = {
        category: 'SECURITY',
        description: 'Crowd pushed through barrier',
        gateId: '2',
      };

      const res = await controller.create(dto as any, req);
      expect(service.create).toHaveBeenCalledWith(dto, BigInt(7));
      expect(res.incidentNumber).toBe('INC-20260924-0001');
    });

    it('delegates resolve with resolver user ID and resolution notes', async () => {
      service.resolve.mockResolvedValue({
        id: '1',
        incident_id: 'INC-20260924-0001',
        incidentNumber: 'INC-20260924-0001',
        status: 'RESOLVED',
        resolutionNotes: 'Additional security posted and barriers locked',
      } as any);

      const req = { user: { id: '3' } } as any;
      const res = await controller.resolve('1', { resolution_notes: 'Additional security posted and barriers locked' }, req);
      expect(service.resolve).toHaveBeenCalledWith(BigInt(1), 'Additional security posted and barriers locked', BigInt(3));
      expect(res.status).toBe('RESOLVED');
    });
  });
});
