import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService, DEFAULT_SETTINGS } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { GateStatus } from '@ongc/shared-types';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: any;

  const mockSettings = [
    { id: BigInt(1), key: 'general.event_name', value: 'ONGC Navratri 2026', updatedAt: new Date() },
    { id: BigInt(2), key: 'event.start_date', value: '2026-09-23', updatedAt: new Date() },
    { id: BigInt(3), key: 'scanner.auto_verify_qr', value: '1', updatedAt: new Date() },
  ];

  const mockGates = [
    {
      id: BigInt(1),
      name: 'Gate 1 - Main Entrance',
      gateNumber: 'G1',
      description: 'North perimeter',
      status: GateStatus.ACTIVE,
    },
  ];

  beforeEach(async () => {
    prisma = {
      setting: {
        findMany: jest.fn().mockResolvedValue(mockSettings),
        upsert: jest.fn().mockImplementation(({ where, update }) =>
          Promise.resolve({ id: BigInt(10), key: where.key, value: update.value, updatedAt: new Date() }),
        ),
      },
      gate: {
        findMany: jest.fn().mockResolvedValue(mockGates),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      scanLog: {
        deleteMany: jest.fn().mockResolvedValue({ count: 10 }),
      },
      $transaction: jest.fn().mockImplementation(async (callbackOrArray) => {
        if (typeof callbackOrArray === 'function') {
          return callbackOrArray(prisma);
        }
        return Promise.all(callbackOrArray);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllSettings', () => {
    it('should return merged settings with defaults, groups, and gates', async () => {
      const result = await service.getAllSettings();

      expect(result).toBeDefined();
      expect(result.settings).toBeDefined();
      expect(result.groups).toBeDefined();
      expect(result.groups.general).toBeDefined();
      expect(result.groups.scanner).toBeDefined();
      expect(result.gates).toHaveLength(1);
      expect(result.gates[0].name).toBe('Gate 1 - Main Entrance');
      expect(result.settings['general.event_name']).toBe('ONGC Navratri 2026');
      expect(result.groups.scanner.auto_verify_qr).toBe(true);
    });
  });

  describe('updateGroup', () => {
    it('should save key-value pairs with group prefix and create audit log', async () => {
      const result = await service.updateGroup(
        'scanner',
        { auto_verify_qr: true, timeout_seconds: '15' },
        BigInt(1),
      );

      expect(result.success).toBe(true);
      expect(prisma.setting.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'settings_updated',
            userId: BigInt(1),
          }),
        }),
      );
    });

    it('should throw BadRequestException for unknown group', async () => {
      await expect(
        service.updateGroup('unknown_group', { foo: 'bar' }, BigInt(1)),
      ).rejects.toThrow('Invalid settings group: unknown_group');
    });
  });

  describe('resetEventData', () => {
    it('should delete load test scan logs and record audit log on confirmation', async () => {
      const result = await service.resetEventData('RESET', BigInt(1));

      expect(result.success).toBe(true);
      expect(prisma.scanLog.deleteMany).toHaveBeenCalledWith({ where: { isLoadTest: true } });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'event_data_reset_requested',
            userId: BigInt(1),
          }),
        }),
      );
    });

    it('should throw BadRequestException if confirmation is not RESET', async () => {
      await expect(
        service.resetEventData('CONFIRM', BigInt(1)),
      ).rejects.toThrow('Confirmation phrase must be RESET.');
    });
  });
});
