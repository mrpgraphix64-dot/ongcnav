import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: any;

  const mockPrisma = {
    attendee: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 1n,
          name: 'Jane Doe',
          ticketNumber: 'NR2026-0001',
          category: 'VIP',
          createdAt: new Date('2026-09-24T10:00:00.000Z'),
          dailyCheckins: [
            {
              id: 10n,
              eventDate: '2026-09-24',
              checkinTime: new Date('2026-09-24T18:00:00.000Z'),
              gate: { name: 'Gate 1' },
            },
          ],
        },
      ]),
    },
    gate: {
      findMany: jest.fn().mockResolvedValue([
        { id: 1n, name: 'Gate 1', gateNumber: 'G1', description: 'Main' },
      ]),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([
        { id: 1n, name: 'Staff A', role: 'SCANNER_STAFF', staffId: 'ST01' },
      ]),
    },
    scanLog: {
      findMany: jest.fn().mockResolvedValue([
        {
          scannedAt: new Date('2026-09-24T18:00:00.000Z'),
          result: 'approved',
          attendee: { name: 'Jane Doe', ticketNumber: 'NR2026-0001', category: 'VIP' },
          gate: { name: 'Gate 1' },
          scannedBy: { name: 'Staff A' },
        },
      ]),
      count: jest.fn().mockResolvedValue(1),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildReport', () => {
    it('should aggregate attendees, gates, and scan logs correctly', async () => {
      const res = await service.buildReport({ event_date: '2026-09-24' });

      expect(res.totalAttendees).toBe(1);
      expect(res.checkedInCount).toBe(1);
      expect(res.checkInPct).toBe(100);
      expect(res.gatePerformance).toHaveLength(1);
      expect(res.categoryBreakdown).toHaveLength(1);
      expect(res.recentActivity).toHaveLength(1);
    });
  });

  describe('exportCsv', () => {
    it('should generate CSV with valid headers and data sections', async () => {
      const csv = await service.exportCsv({ event_date: '2026-09-24' });

      expect(csv).toContain('ONGC Navratri — Event Gate & Entry Audit Report');
      expect(csv).toContain('CATEGORY BREAKDOWN');
      expect(csv).toContain('ATTENDEE LIST');
      expect(csv).toContain('CHECK-IN HISTORY');
      expect(csv).toContain('GATE PERFORMANCE');
    });
  });
});
