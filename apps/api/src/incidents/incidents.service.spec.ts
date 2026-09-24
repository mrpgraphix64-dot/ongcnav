import { IncidentsService } from './incidents.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('IncidentsService', () => {
  let service: IncidentsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      setting: {
        findFirst: jest.fn(),
      },
      incident: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      gate: {
        findMany: jest.fn(),
      },
      attendee: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    service = new IncidentsService(prisma);
  });

  describe('findAll', () => {
    it('returns filtered incidents, metrics, and categories', async () => {
      prisma.setting.findFirst.mockResolvedValue({ key: 'active_event_date', value: '2026-09-24' });
      prisma.incident.count.mockResolvedValue(1);
      prisma.incident.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          incidentNumber: 'INC-20260924-0001',
          category: 'SECURITY',
          severity: 'HIGH',
          status: 'OPEN',
          title: 'Gate barrier issue',
          description: 'Crowd pushed through barrier',
          ticketId: null,
          incidentDate: '2026-09-24',
          incidentTime: '18:30:00',
          resolutionNotes: null,
          resolvedAt: null,
          createdAt: new Date(),
          gate: { id: BigInt(1), name: 'Gate 1', gateNumber: 'G1' },
          reportedBy: { id: BigInt(2), name: 'Staff User', role: 'GATE_OPERATOR', staffId: 'STF-001' },
          resolvedBy: null,
          attendee: null,
        },
      ]);
      prisma.gate.findMany.mockResolvedValue([]);

      const res = await service.findAll({ status: 'OPEN' });
      expect(res.incidents.length).toBe(1);
      expect(res.incidents[0].incidentNumber).toBe('INC-20260924-0001');
      expect(res.categories).toBeDefined();
      expect(res.metrics).toBeDefined();
    });
  });

  describe('create', () => {
    it('generates sequential INC-YYYYMMDD-0001 and records audit log', async () => {
      prisma.setting.findFirst.mockResolvedValue({ key: 'active_event_date', value: '2026-09-24' });
      prisma.incident.findFirst.mockResolvedValue(null); // First incident of the day
      prisma.incident.create.mockResolvedValue({
        id: BigInt(10),
        incidentNumber: 'INC-20260924-0001',
      });
      prisma.incident.findUnique.mockResolvedValue({
        id: BigInt(10),
        incidentNumber: 'INC-20260924-0001',
        category: 'TICKET_ISSUE',
        severity: 'MEDIUM',
        status: 'OPEN',
        title: 'Ticket / QR Issue - 2026-09-24',
        description: 'QR code unreadable due to cracked phone screen',
        ticketId: 'NR2026-000042',
        incidentDate: '2026-09-24',
        incidentTime: '19:15:00',
        resolutionNotes: null,
        resolvedAt: null,
        createdAt: new Date(),
        gate: null,
        reportedBy: null,
        resolvedBy: null,
        attendee: null,
      });

      const res = await service.create(
        {
          category: 'TICKET_ISSUE',
          description: 'QR code unreadable due to cracked phone screen',
          ticket_id: 'NR2026-000042',
        },
        BigInt(5),
      );

      expect(res.incidentNumber).toBe('INC-20260924-0001');
      expect(prisma.incident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            incidentNumber: 'INC-20260924-0001',
            category: 'TICKET_ISSUE',
            ticketId: 'NR2026-000042',
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: BigInt(5),
            action: 'incident_created',
          }),
        }),
      );
    });
  });

  describe('resolve', () => {
    it('throws BadRequestException if resolution notes are too short', async () => {
      await expect(service.resolve(BigInt(1), 'done', BigInt(2))).rejects.toThrow(BadRequestException);
    });

    it('resolves incident, updates status and records audit log', async () => {
      prisma.incident.findUnique.mockResolvedValue({
        id: BigInt(1),
        incidentNumber: 'INC-20260924-0001',
        category: 'SECURITY',
        severity: 'MEDIUM',
        status: 'RESOLVED',
        title: 'Security',
        description: 'Minor issue',
        ticketId: null,
        incidentDate: '2026-09-24',
        incidentTime: '19:00:00',
        resolutionNotes: 'Security supervisor addressed situation and cleared entrance',
        resolvedAt: new Date(),
        createdAt: new Date(),
        gate: null,
        reportedBy: null,
        resolvedBy: null,
        attendee: null,
      });

      const res = await service.resolve(
        BigInt(1),
        'Security supervisor addressed situation and cleared entrance',
        BigInt(2),
      );

      expect(res.status).toBe('RESOLVED');
      expect(prisma.incident.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(1) },
          data: expect.objectContaining({
            status: 'RESOLVED',
            resolutionNotes: 'Security supervisor addressed situation and cleared entrance',
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: BigInt(2),
            action: 'incident_resolved',
          }),
        }),
      );
    });
  });
});
