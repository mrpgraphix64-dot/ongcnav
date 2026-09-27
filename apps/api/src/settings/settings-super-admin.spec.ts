import { ForbiddenException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SettingsService } from './settings.service';
import { PublicMaintenanceGuard } from '../common/guards/public-maintenance.guard';
import { ToggleFullPowerDto, ToggleMaintenanceModeDto } from './dto/update-settings.dto';
import {
  UserRole,
  SETTING_SUPER_ADMIN_FULL_POWER,
  SETTING_MAINTENANCE_MODE,
  CONFIRMATION_ENABLE_FULL_POWER,
  CONFIRMATION_ENABLE_MAINTENANCE,
  AUDIT_SUPER_ADMIN_FULL_POWER_ENABLED,
  AUDIT_SUPER_ADMIN_FULL_POWER_DISABLED,
  AUDIT_MAINTENANCE_MODE_ENABLED,
  AUDIT_MAINTENANCE_MODE_DISABLED,
} from '@ongc/shared-types';

describe('SUPER_ADMIN Control Center & Settings Safety', () => {
  let service: SettingsService;
  let prisma: any;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'staging';

    prisma = {
      setting: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      $transaction: jest.fn().mockImplementation(async (callback: any) => {
        return callback(prisma);
      }),
    };

    service = new SettingsService(prisma);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('getSuperAdminSettings', () => {
    it('returns full power and maintenance status for SUPER_ADMIN', async () => {
      prisma.setting.findUnique
        .mockResolvedValueOnce({ key: SETTING_SUPER_ADMIN_FULL_POWER, value: 'true' })
        .mockResolvedValueOnce({ key: SETTING_MAINTENANCE_MODE, value: 'false' });

      const res = await service.getSuperAdminSettings(UserRole.SUPER_ADMIN);
      expect(res.fullPowerActive).toBe(true);
      expect(res.maintenanceMode).toBe(false);
      expect(res.isProduction).toBe(false);
      expect(res.nodeEnv).toBe('staging');
    });

    it('rejects non-SUPER_ADMIN with ForbiddenException', async () => {
      await expect(service.getSuperAdminSettings(UserRole.COMMERCIAL_ADMIN)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getSuperAdminSettings(UserRole.EMPLOYEE_ADMIN)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('reports fullPowerActive as false in production even if DB setting is true', async () => {
      process.env.NODE_ENV = 'production';
      prisma.setting.findUnique
        .mockResolvedValueOnce({ key: SETTING_SUPER_ADMIN_FULL_POWER, value: 'true' })
        .mockResolvedValueOnce({ key: SETTING_MAINTENANCE_MODE, value: 'false' });

      const res = await service.getSuperAdminSettings(UserRole.SUPER_ADMIN);
      expect(res.fullPowerActive).toBe(false);
      expect(res.isProduction).toBe(true);
      expect(res.nodeEnv).toBe('production');
    });
  });

  describe('toggleFullPower', () => {
    it('enables Full Power when exact confirmation phrase is provided', async () => {
      prisma.setting.upsert.mockResolvedValueOnce({ key: SETTING_SUPER_ADMIN_FULL_POWER, value: '1' });

      const res = await service.toggleFullPower(
        true,
        CONFIRMATION_ENABLE_FULL_POWER,
        { id: BigInt(1), role: UserRole.SUPER_ADMIN },
      );

      expect(res.success).toBe(true);
      expect(res.enabled).toBe(true);
      expect(res.fullPowerActive).toBe(true);
      expect(prisma.setting.upsert).toHaveBeenCalledWith({
        where: { key: SETTING_SUPER_ADMIN_FULL_POWER },
        update: { value: '1' },
        create: {
          key: SETTING_SUPER_ADMIN_FULL_POWER,
          value: '1',
        },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: BigInt(1),
          action: AUDIT_SUPER_ADMIN_FULL_POWER_ENABLED,
        }),
      });
    });

    it('rejects enabling Full Power with incorrect confirmation phrase', async () => {
      await expect(
        service.toggleFullPower(true, 'WRONG PHRASE', { id: BigInt(1), role: UserRole.SUPER_ADMIN }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.setting.upsert).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('strictly forbids enabling Full Power in production environment', async () => {
      process.env.NODE_ENV = 'production';

      await expect(
        service.toggleFullPower(
          true,
          CONFIRMATION_ENABLE_FULL_POWER,
          { id: BigInt(1), role: UserRole.SUPER_ADMIN },
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.setting.upsert).not.toHaveBeenCalled();
    });

    it('rejects non-SUPER_ADMIN users from modifying Full Power', async () => {
      await expect(
        service.toggleFullPower(
          true,
          CONFIRMATION_ENABLE_FULL_POWER,
          { id: BigInt(2), role: UserRole.COMMERCIAL_ADMIN },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows disabling Full Power without confirmation phrase and audits deactivation', async () => {
      prisma.setting.upsert.mockResolvedValueOnce({ key: SETTING_SUPER_ADMIN_FULL_POWER, value: '0' });

      const res = await service.toggleFullPower(false, undefined, { id: BigInt(1), role: UserRole.SUPER_ADMIN });

      expect(res.success).toBe(true);
      expect(res.enabled).toBe(false);
      expect(res.fullPowerActive).toBe(false);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: BigInt(1),
          action: AUDIT_SUPER_ADMIN_FULL_POWER_DISABLED,
        }),
      });
    });

    it('rejects modifying Full Power when enabled is not a boolean', async () => {
      await expect(
        service.toggleFullPower(undefined as any, undefined, { id: BigInt(1), role: UserRole.SUPER_ADMIN }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('toggleMaintenanceMode', () => {
    it('enables Maintenance Mode when exact confirmation phrase is provided', async () => {
      prisma.setting.upsert.mockResolvedValueOnce({ key: SETTING_MAINTENANCE_MODE, value: '1' });

      const res = await service.toggleMaintenanceMode(
        true,
        CONFIRMATION_ENABLE_MAINTENANCE,
        { id: BigInt(1), role: UserRole.SUPER_ADMIN },
      );

      expect(res.success).toBe(true);
      expect(res.enabled).toBe(true);
      expect(prisma.setting.upsert).toHaveBeenCalledWith({
        where: { key: SETTING_MAINTENANCE_MODE },
        update: { value: '1' },
        create: {
          key: SETTING_MAINTENANCE_MODE,
          value: '1',
        },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: BigInt(1),
          action: AUDIT_MAINTENANCE_MODE_ENABLED,
        }),
      });
    });

    it('rejects enabling Maintenance Mode with incorrect confirmation phrase', async () => {
      await expect(
        service.toggleMaintenanceMode(true, 'INCORRECT', { id: BigInt(1), role: UserRole.SUPER_ADMIN }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.setting.upsert).not.toHaveBeenCalled();
    });

    it('rejects non-SUPER_ADMIN users from modifying Maintenance Mode', async () => {
      await expect(
        service.toggleMaintenanceMode(
          true,
          CONFIRMATION_ENABLE_MAINTENANCE,
          { id: BigInt(2), role: UserRole.EMPLOYEE_ADMIN },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows disabling Maintenance Mode without confirmation phrase and audits deactivation', async () => {
      prisma.setting.upsert.mockResolvedValueOnce({ key: SETTING_MAINTENANCE_MODE, value: '0' });

      const res = await service.toggleMaintenanceMode(false, undefined, { id: BigInt(1), role: UserRole.SUPER_ADMIN });

      expect(res.success).toBe(true);
      expect(res.enabled).toBe(false);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: BigInt(1),
          action: AUDIT_MAINTENANCE_MODE_DISABLED,
        }),
      });
    });

    it('rejects modifying Maintenance Mode when enabled is not a boolean', async () => {
      await expect(
        service.toggleMaintenanceMode(undefined as any, undefined, { id: BigInt(1), role: UserRole.SUPER_ADMIN }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('ToggleFullPowerDto & ToggleMaintenanceModeDto validation', () => {
    it('validates ToggleFullPowerDto with boolean enabled and optional confirmation', async () => {
      const validDto = plainToInstance(ToggleFullPowerDto, {
        enabled: true,
        confirmation: CONFIRMATION_ENABLE_FULL_POWER,
      });
      const errors = await validate(validDto);
      expect(errors.length).toBe(0);

      const invalidDto = plainToInstance(ToggleFullPowerDto, {
        enabled: 'not-a-bool',
      });
      const invalidErrors = await validate(invalidDto);
      expect(invalidErrors.length).toBeGreaterThan(0);
      expect(invalidErrors.some((e) => e.property === 'enabled')).toBe(true);
    });

    it('validates ToggleMaintenanceModeDto with boolean enabled', async () => {
      const validDto = plainToInstance(ToggleMaintenanceModeDto, {
        enabled: true,
        confirmation: CONFIRMATION_ENABLE_MAINTENANCE,
      });
      const errors = await validate(validDto);
      expect(errors.length).toBe(0);

      const invalidDto = plainToInstance(ToggleMaintenanceModeDto, {
        enabled: 123,
      });
      const invalidErrors = await validate(invalidDto);
      expect(invalidErrors.length).toBeGreaterThan(0);
      expect(invalidErrors.some((e) => e.property === 'enabled')).toBe(true);
    });
  });

  describe('PublicMaintenanceGuard', () => {
    let guard: PublicMaintenanceGuard;

    beforeEach(() => {
      guard = new PublicMaintenanceGuard(prisma);
    });

    it('throws ServiceUnavailableException (HTTP 503) when maintenance_mode is enabled', async () => {
      prisma.setting.findUnique.mockResolvedValueOnce({ key: SETTING_MAINTENANCE_MODE, value: 'true' });

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ path: '/api/public/register' }),
        }),
      } as any;

      await expect(guard.canActivate(context)).rejects.toThrow(ServiceUnavailableException);
    });

    it('allows access when maintenance_mode is disabled or not set', async () => {
      prisma.setting.findUnique.mockResolvedValueOnce({ key: SETTING_MAINTENANCE_MODE, value: 'false' });

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ path: '/api/public/register' }),
        }),
      } as any;

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });
});
