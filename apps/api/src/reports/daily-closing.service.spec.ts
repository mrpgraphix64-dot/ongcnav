import { Test, TestingModule } from '@nestjs/testing';
import { DailyClosingService, sanitizeCsvValue } from './daily-closing.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DailyClosingService', () => {
  let service: DailyClosingService;
  let prisma: any;

  const mockPrisma = {
    setting: {
      findFirst: jest.fn().mockResolvedValue({ value: '2026-09-24' }),
    },
    attendee: {
      count: jest.fn().mockResolvedValue(150),
      findMany: jest.fn().mockResolvedValue([
        { id: 1n, employee: { bookingDays: ['2026-09-24'] } },
        { id: 2n, employee: { bookingDays: [] } },
      ]),
    },
    dailyCheckin: {
      count: jest.fn().mockResolvedValue(45),
      findMany: jest.fn().mockResolvedValue([
        {
          checkinTime: new Date('2026-09-24T18:30:00.000Z'),
          attendee: { ticketNumber: 'NR2026-0001', name: 'Test Attendee' },
          gate: { name: 'Gate 1' },
          scannedBy: { name: 'Operator 1' },
          status: 'SUCCESS',
          isManual: false,
        },
      ]),
    },
    gate: {
      findMany: jest.fn().mockResolvedValue([
        { id: 1n, name: 'Gate 1', gateNumber: 'G1', description: 'Main', isOpen: true, capacityPerHour: 500 },
      ]),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([
        { id: 10n, name: 'Staff Operator', email: 'op@ongc.co.in', staffId: 'OP01', role: 'SCANNER_STAFF', gateUsers: [] },
      ]),
    },
    scanLog: {
      count: jest.fn().mockResolvedValue(3),
      findFirst: jest.fn().mockResolvedValue({ scannedAt: new Date() }),
    },
    incident: {
      count: jest.fn().mockResolvedValue(2),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyClosingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DailyClosingService>(DailyClosingService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sanitizeCsvValue', () => {
    it('should escape quotes and formula injection characters', () => {
      expect(sanitizeCsvValue('=1+2')).toBe("'=1+2");
      expect(sanitizeCsvValue('+12345')).toBe("'+12345");
      expect(sanitizeCsvValue('@alert')).toBe("'@alert");
      expect(sanitizeCsvValue('Standard Name')).toBe('Standard Name');
      expect(sanitizeCsvValue('He said "Hello"')).toBe('He said ""Hello""');
    });
  });

  describe('generateDailyClosingReport', () => {
    it('should aggregate daily operational metrics matching Laravel parity', async () => {
      const res = await service.generateDailyClosingReport('2026-09-24');

      expect(res.selectedDate).toBe('2026-09-24');
      expect(res.totalRegistered).toBe(150);
      expect(res.bookedForDate).toBe(2);
      expect(res.checkedInCount).toBe(45);
      expect(res.gates).toHaveLength(1);
      expect(res.gates[0].gate.name).toBe('Gate 1');
      expect(res.staffMembers).toHaveLength(1);
    });
  });

  describe('exportDailyClosingCsv', () => {
    it('should return valid CSV string with headers and escaped values', async () => {
      const csv = await service.exportDailyClosingCsv('2026-09-24');

      expect(csv).toContain('Event Date,Ticket ID,Attendee Name,Category,CPF Number,Gate,Checked In At (IST)');
      expect(csv).toContain('"NR2026-0001"');
      expect(csv).toContain('"Gate 1"');
    });
  });
});
