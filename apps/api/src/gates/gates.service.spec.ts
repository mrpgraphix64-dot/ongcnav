import { Test, TestingModule } from '@nestjs/testing';
import { GatesService } from './gates.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GateStatus, GateType } from '@prisma/client';

describe('GatesService', () => {
  let service: GatesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      gate: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      dailyCheckin: {
        groupBy: jest.fn(),
        count: jest.fn(),
      },
      scanLog: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      gateUser: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(prisma);
        }
        return Promise.all(cb);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<GatesService>(GatesService);
  });

  describe('findAll', () => {
    it('should return serialized gates with today checkin volume and assigned staff', async () => {
      prisma.gate.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          name: 'Main Gate',
          gateNumber: 'G1',
          gateType: GateType.REGULAR,
          status: GateStatus.ACTIVE,
          location: 'Main Pavilion',
          description: 'Primary public entry',
          capacityPerHour: 500,
          totalCapacity: 5000,
          capacityEnabled: true,
          blockWhenFull: true,
          isOpen: true,
          isScanningPaused: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          gateUsers: [
            {
              id: BigInt(10),
              userId: BigInt(2),
              gateId: BigInt(1),
              user: {
                id: BigInt(2),
                name: 'Operator Bob',
                email: 'bob@ongc.test',
                staffId: 'STF-02',
                role: 'GATE_OPERATOR',
                isActive: true,
              },
            },
          ],
        },
      ]);

      prisma.dailyCheckin.groupBy.mockResolvedValue([
        { gateId: BigInt(1), _count: { id: 42 } },
      ]);

      const result = await service.findAll('2026-09-24');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].code).toBe('G1');
      expect(result[0].name).toBe('Main Gate');
      expect(result[0].type).toBe('General');
      expect(result[0].location).toBe('Main Pavilion');
      expect(result[0].status).toBe('active');
      expect(result[0].todayCheckinCount).toBe(42);
      expect(result[0].today_checkins_count).toBe(42);
      expect(result[0].users).toHaveLength(1);
      expect(result[0].users[0].name).toBe('Operator Bob');
    });
  });

  describe('create', () => {
    it('should reject if name already exists', async () => {
      prisma.gate.findFirst.mockResolvedValueOnce({ id: BigInt(1), name: 'Gate 1' });

      await expect(
        service.create({
          name: 'Gate 1',
          code: 'G1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if code already exists', async () => {
      prisma.gate.findFirst
        .mockResolvedValueOnce(null) // name is unique
        .mockResolvedValueOnce({ id: BigInt(1), gateNumber: 'G1' }); // code exists

      await expect(
        service.create({
          name: 'New Gate',
          code: 'G1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create gate and sync staff IDs', async () => {
      prisma.gate.findFirst.mockResolvedValue(null);
      prisma.gate.create.mockResolvedValue({
        id: BigInt(5),
        name: 'VIP West',
        gateNumber: 'VIP-W',
        gateType: GateType.VIP,
        status: GateStatus.ACTIVE,
        location: 'West Lawn',
        description: 'VIP cars entrance',
      });
      prisma.gate.findUnique.mockResolvedValue({
        id: BigInt(5),
        name: 'VIP West',
        gateNumber: 'VIP-W',
        gateType: GateType.VIP,
        status: GateStatus.ACTIVE,
        location: 'West Lawn',
        description: 'VIP cars entrance',
        gateUsers: [],
      });

      const res = await service.create({
        name: 'VIP West',
        code: 'VIP-W',
        type: 'VIP',
        location: 'West Lawn',
        description: 'VIP cars entrance',
        staff_ids: ['2', '3'],
      });

      expect(res.id).toBe('5');
      expect(res.code).toBe('VIP-W');
      expect(prisma.gateUser.createMany).toHaveBeenCalledWith({
        data: [
          { gateId: BigInt(5), userId: BigInt(2) },
          { gateId: BigInt(5), userId: BigInt(3) },
        ],
      });
    });
  });

  describe('safe deletion (remove)', () => {
    it('should NOT hard-delete gate with historical activity, but deactivate with warning', async () => {
      prisma.gate.findUnique.mockResolvedValue({
        id: BigInt(1),
        name: 'Main Gate',
        _count: {
          dailyCheckins: 50,
          scanLogs: 120,
        },
      });

      prisma.gate.update.mockResolvedValue({
        id: BigInt(1),
        name: 'Main Gate',
        gateNumber: 'MAIN',
        gateType: GateType.REGULAR,
        status: GateStatus.INACTIVE,
        gateUsers: [],
      });

      const res = await service.remove(BigInt(1));
      expect(res.success).toBe(true);
      expect(res.action).toBe('deactivated');
      expect(res.warning).toContain('cannot be permanently deleted');
      expect(prisma.gate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(1) },
          data: { status: GateStatus.INACTIVE },
        }),
      );
      expect(prisma.gate.delete).not.toHaveBeenCalled();
    });

    it('should permanently delete gate if it has zero historical activity', async () => {
      prisma.gate.findUnique.mockResolvedValue({
        id: BigInt(9),
        name: 'Unused Gate',
        _count: {
          dailyCheckins: 0,
          scanLogs: 0,
        },
      });

      const res = await service.remove(BigInt(9));
      expect(res.success).toBe(true);
      expect(res.action).toBe('deleted');
      expect(res.message).toContain('deleted successfully');
      expect(prisma.gateUser.deleteMany).toHaveBeenCalledWith({ where: { gateId: BigInt(9) } });
      expect(prisma.gate.delete).toHaveBeenCalledWith({ where: { id: BigInt(9) } });
    });
  });

  describe('toggleStatus', () => {
    it('should toggle status from ACTIVE to INACTIVE', async () => {
      prisma.gate.findUnique.mockResolvedValue({
        id: BigInt(1),
        name: 'Main Gate',
        status: GateStatus.ACTIVE,
      });

      prisma.gate.update.mockResolvedValue({
        id: BigInt(1),
        name: 'Main Gate',
        gateNumber: 'MAIN',
        gateType: GateType.REGULAR,
        status: GateStatus.INACTIVE,
        gateUsers: [],
      });

      const res = await service.toggleStatus(BigInt(1));
      expect(res.success).toBe(true);
      expect(res.message).toContain('deactivated');
      expect(prisma.gate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: GateStatus.INACTIVE },
        }),
      );
    });

    it('should toggle status from INACTIVE to ACTIVE', async () => {
      prisma.gate.findUnique.mockResolvedValue({
        id: BigInt(1),
        name: 'Main Gate',
        status: GateStatus.INACTIVE,
      });

      prisma.gate.update.mockResolvedValue({
        id: BigInt(1),
        name: 'Main Gate',
        gateNumber: 'MAIN',
        gateType: GateType.REGULAR,
        status: GateStatus.ACTIVE,
        gateUsers: [],
      });

      const res = await service.toggleStatus(BigInt(1));
      expect(res.success).toBe(true);
      expect(res.message).toContain('activated');
    });
  });

  describe('findOne (telemetry and recent activity)', () => {
    it('should return telemetry counts and recent scan logs', async () => {
      prisma.gate.findUnique.mockResolvedValue({
        id: BigInt(1),
        name: 'Main Gate',
        gateNumber: 'MAIN',
        gateType: GateType.REGULAR,
        status: GateStatus.ACTIVE,
        gateUsers: [
          {
            user: {
              id: BigInt(2),
              name: 'Staff Alice',
              staffId: 'STF-01',
              role: 'GATE_OPERATOR',
            },
          },
        ],
      });

      prisma.dailyCheckin.count.mockResolvedValue(150); // todaySuccessful
      prisma.scanLog.count
        .mockResolvedValueOnce(12) // todayDuplicates
        .mockResolvedValueOnce(3) // todayInvalid
        .mockResolvedValueOnce(5); // todayNotBooked

      prisma.scanLog.findMany.mockResolvedValue([
        {
          id: BigInt(101),
          scannedAt: new Date('2026-09-24T18:00:00Z'),
          result: 'approved',
          attendee: {
            id: BigInt(50),
            name: 'John Doe',
            ticketNumber: 'TKT-2026-001',
            mobile: '9876543210',
            category: 'VIP',
          },
          scannedBy: {
            id: BigInt(2),
            name: 'Staff Alice',
            staffId: 'STF-01',
            role: 'GATE_OPERATOR',
          },
        },
      ]);

      const res = await service.findOne(BigInt(1), '2026-09-24');
      expect(res.gate.id).toBe('1');
      expect(res.todaySuccessful).toBe(150);
      expect(res.todayDuplicates).toBe(12);
      expect(res.todayInvalid).toBe(3);
      expect(res.todayNotBooked).toBe(5);
      expect(res.recentLogs).toHaveLength(1);
      expect(res.recentLogs[0].ticketIdScanned).toBe('TKT-2026-001');
      expect(res.recentLogs[0].attendee?.name).toBe('John Doe');
      expect(res.recentLogs[0].staff?.name).toBe('Staff Alice');
    });
  });
});
