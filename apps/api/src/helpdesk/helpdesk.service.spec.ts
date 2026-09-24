import { HelpDeskService } from './helpdesk.service';
import { BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CheckinStatus } from '@ongc/shared-types';

describe('HelpDeskService', () => {
  let service: HelpDeskService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      setting: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      attendee: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      gate: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      dailyCheckin: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      scanLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    service = new HelpDeskService(prisma);
  });

  describe('search', () => {
    it('returns empty array when query is blank', async () => {
      const res = await service.search('   ');
      expect(res.attendees).toEqual([]);
      expect(res.gates).toEqual([]);
    });

    it('masks CPF for unauthorized roles (e.g. SCANNER_STAFF, GATE_MANAGER)', async () => {
      prisma.setting.findFirst.mockResolvedValue({ key: 'active_event_date', value: '2026-09-24' });
      prisma.attendee.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          ticketNumber: 'NR2026-000001',
          name: 'Ramesh Patel',
          mobile: '9876543210',
          category: 'EMPLOYEE',
          status: 'ACTIVE',
          employee: { cpf: 'CPF123456', name: 'Ramesh Patel', phone: '9876543210', bookingDays: ['2026-09-24'] },
          familyMember: null,
          dailyCheckins: [],
        },
      ]);
      prisma.gate.findMany.mockResolvedValue([]);

      const res = await service.search('Ramesh', 'SCANNER_STAFF');
      expect(res.canViewCpf).toBe(false);
      expect(res.attendees[0].cpf).toBeNull();
    });

    it('displays CPF for authorized roles (e.g. SUPER_ADMIN, EVENT_ADMIN, REGISTRATION_STAFF)', async () => {
      prisma.setting.findFirst.mockResolvedValue({ key: 'active_event_date', value: '2026-09-24' });
      prisma.attendee.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          ticketNumber: 'NR2026-000001',
          name: 'Ramesh Patel',
          mobile: '9876543210',
          category: 'EMPLOYEE',
          status: 'ACTIVE',
          employee: { cpf: 'CPF123456', name: 'Ramesh Patel', phone: '9876543210', bookingDays: ['2026-09-24'] },
          familyMember: null,
          dailyCheckins: [],
        },
      ]);
      prisma.gate.findMany.mockResolvedValue([]);

      const res = await service.search('Ramesh', 'SUPER_ADMIN');
      expect(res.canViewCpf).toBe(true);
      expect(res.attendees[0].cpf).toBe('CPF123456');
    });
  });

  describe('manualCheckin', () => {
    it('throws BadRequestException if manual reason is too short or missing', async () => {
      await expect(
        service.manualCheckin({ attendeeId: '1', reason: 'ok' }, BigInt(10)),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException if event is closed', async () => {
      prisma.attendee.findUnique.mockResolvedValue({
        id: BigInt(1),
        ticketNumber: 'NR2026-000001',
        status: 'ACTIVE',
      });
      prisma.setting.findFirst.mockImplementation(({ where }: any) => {
        if (where.OR?.some((o: any) => o.key?.includes('event_status'))) {
          return Promise.resolve({ key: 'event_control.event_status', value: 'closed' });
        }
        return Promise.resolve(null);
      });

      await expect(
        service.manualCheckin(
          { attendeeId: '1', gateId: '1', reason: 'Valid override reason here' },
          BigInt(10),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException if attendee is already checked in for today', async () => {
      prisma.attendee.findUnique.mockResolvedValue({
        id: BigInt(1),
        ticketNumber: 'NR2026-000001',
        status: 'ACTIVE',
        employee: null,
        familyMember: null,
      });
      prisma.setting.findFirst.mockResolvedValue(null);
      prisma.gate.findUnique.mockResolvedValue({
        id: BigInt(1),
        name: 'Gate 1',
        isOpen: true,
        status: 'ACTIVE',
      });
      prisma.dailyCheckin.findFirst.mockResolvedValue({
        id: BigInt(100),
        checkinTime: new Date(),
        gate: { name: 'Gate 1' },
      });

      await expect(
        service.manualCheckin(
          { attendeeId: '1', gateId: '1', reason: 'Screen damaged by rain' },
          BigInt(10),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('successfully creates manual check-in with audit log and scan log', async () => {
      prisma.attendee.findUnique.mockResolvedValue({
        id: BigInt(1),
        ticketNumber: 'NR2026-000001',
        name: 'Pooja Bhatt',
        status: 'ACTIVE',
        employee: null,
        familyMember: null,
      });
      prisma.setting.findFirst.mockResolvedValue(null);
      prisma.gate.findUnique.mockResolvedValue({
        id: BigInt(1),
        name: 'Gate 1',
        isOpen: true,
        status: 'ACTIVE',
        capacityEnabled: false,
      });
      prisma.dailyCheckin.findFirst.mockResolvedValue(null);
      prisma.dailyCheckin.create.mockResolvedValue({
        id: BigInt(105),
        checkinTime: new Date(),
      });

      const res = await service.manualCheckin(
        { attendeeId: '1', gateId: '1', reason: 'Phone battery died, physical ID verified' },
        BigInt(10),
      );

      expect(res.success).toBe(true);
      expect(res.isManual).toBe(true);
      expect(prisma.dailyCheckin.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: BigInt(10),
            action: 'MANUAL_CHECKIN_OVERRIDE',
          }),
        }),
      );
    });
  });

  describe('voidCheckin', () => {
    it('throws BadRequestException if check-in is already voided', async () => {
      prisma.dailyCheckin.findUnique.mockResolvedValue({
        id: BigInt(10),
        status: CheckinStatus.VOIDED,
        attendee: { ticketNumber: 'NR2026-000001' },
      });

      await expect(
        service.voidCheckin(BigInt(10), 'Wrong person was scanned earlier', BigInt(1)),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully voids check-in, restores attendee status, and logs audit', async () => {
      prisma.dailyCheckin.findUnique.mockResolvedValue({
        id: BigInt(10),
        status: CheckinStatus.SUCCESS,
        eventDate: '2026-09-24',
        attendee: { id: BigInt(5), ticketNumber: 'NR2026-000001', name: 'Aarav' },
        gate: { name: 'Gate A' },
      });
      prisma.dailyCheckin.findFirst.mockResolvedValue(null); // No remaining checkin today

      const res = await service.voidCheckin(
        BigInt(10),
        'Scanned wrong family badge by operator error',
        BigInt(1),
      );

      expect(res.success).toBe(true);
      expect(prisma.dailyCheckin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(10) },
          data: expect.objectContaining({
            status: CheckinStatus.VOIDED,
            voidReason: 'Scanned wrong family badge by operator error',
          }),
        }),
      );
      expect(prisma.attendee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(5) },
          data: { status: 'ACTIVE' },
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: BigInt(1),
            action: 'checkin_reversed',
          }),
        }),
      );
    });
  });
});
