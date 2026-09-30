import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UserRole,
  SETTING_SUPER_ADMIN_FULL_POWER,
  SETTING_MAINTENANCE_MODE,
  SETTING_PAYMENT_RAZORPAY_ENABLED,
  SETTING_BOOK_PASS_AVAILABILITY,
  BookPassAvailability,
  CONFIRMATION_ENABLE_FULL_POWER,
  CONFIRMATION_ENABLE_MAINTENANCE,
  AUDIT_SUPER_ADMIN_FULL_POWER_ENABLED,
  AUDIT_SUPER_ADMIN_FULL_POWER_DISABLED,
  AUDIT_MAINTENANCE_MODE_ENABLED,
  AUDIT_MAINTENANCE_MODE_DISABLED,
  AUDIT_PAYMENT_GATEWAY_ENABLED,
  AUDIT_PAYMENT_GATEWAY_DISABLED,
  AUDIT_BOOK_PASS_AVAILABILITY_UPDATED,
  isSuperAdminFullPowerActive,
  isMaintenanceModeActive,
  isBookPassOpen,
} from '@ongc/shared-types';
import { isAdminTestDataDeleteEnabled } from '../commercial/commercial-test-payment.util';

export const DEFAULT_SETTINGS: Record<string, string> = {
  // general
  'general.event_name': 'ONGC Navratri Mahotsav 2026',
  'general.organization': 'Oil and Natural Gas Corporation Ltd.',
  'general.venue': 'ONGC Community Grounds & Stadium, Ankleshwar',
  'general.description': 'Official ONGC Navratri Cultural Celebration and Entry Control Portal',

  // event
  'event.start_date': '2026-09-23',
  'event.end_date': '2026-10-01',
  'event.opening_time': '18:00',
  'event.closing_time': '23:30',
  'event.max_capacity': '5000',
  'event.status': 'active',

  // qr
  'qr.ticket_prefix': 'NR2026',
  'qr.starting_number': '1000',
  'qr.code_size': '300',
  'qr.error_correction': 'M',
  'qr.expiry': '2026-10-02',
  'qr.auto_generate_qr': '1',
  'qr.auto_generate_ticket': '1',

  // scanner
  'scanner.default_gate': '1',
  'scanner.auto_start_camera': '1',
  'scanner.auto_verify_qr': '1',
  'scanner.auto_checkin_valid': '1',
  'scanner.prevent_duplicate_checkin': '1',
  'scanner.timeout_seconds': '10',
  'scanner.auto_reset_seconds': '3',

  // notifications
  'notifications.email_ticket': '1',
  'notifications.whatsapp_ticket': '0',
  'notifications.checkin_confirmation': '0',
  'notifications.duplicate_scan_alert': '1',
  'notifications.invalid_qr_alert': '1',
  'notifications.daily_attendance_report': '1',

  // security
  'security.require_admin_login': '1',
  'security.require_otp': '0',
  'security.allow_manual_checkin': '1',
  'security.allow_qr_regeneration': '1',
  'security.log_scan_attempts': '1',
  'security.audit_log_days': '90',

  // system control center defaults
  'system.super_admin_full_power': '0',
  'system.maintenance_mode': '0',

  // payment settings
  'payment.razorpay_enabled': '0',

  // commercial / book pass availability
  'commercial.book_pass_availability': 'OPEN',
};

export const FIELDS_BY_GROUP: Record<string, string[]> = {
  general: ['event_name', 'organization', 'venue', 'description'],
  event: ['start_date', 'end_date', 'opening_time', 'closing_time', 'max_capacity', 'status'],
  qr: ['ticket_prefix', 'starting_number', 'code_size', 'error_correction', 'expiry', 'auto_generate_qr', 'auto_generate_ticket'],
  scanner: ['default_gate', 'auto_start_camera', 'auto_verify_qr', 'auto_checkin_valid', 'prevent_duplicate_checkin', 'timeout_seconds', 'auto_reset_seconds'],
  notifications: ['email_ticket', 'whatsapp_ticket', 'checkin_confirmation', 'duplicate_scan_alert', 'invalid_qr_alert', 'daily_attendance_report'],
  security: ['require_admin_login', 'require_otp', 'allow_manual_checkin', 'allow_qr_regeneration', 'log_scan_attempts', 'audit_log_days'],
};

export const TOGGLE_FIELDS: Record<string, string[]> = {
  qr: ['auto_generate_qr', 'auto_generate_ticket'],
  scanner: ['auto_start_camera', 'auto_verify_qr', 'auto_checkin_valid', 'prevent_duplicate_checkin'],
  notifications: ['email_ticket', 'whatsapp_ticket', 'checkin_confirmation', 'duplicate_scan_alert', 'invalid_qr_alert', 'daily_attendance_report'],
  security: ['require_admin_login', 'require_otp', 'allow_manual_checkin', 'allow_qr_regeneration', 'log_scan_attempts'],
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllSettings(userRole?: string | null) {
    const isSuperAdmin = (userRole || '').toUpperCase().trim() === UserRole.SUPER_ADMIN;
    const dbSettings = await this.prisma.setting.findMany();
    const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS };

    for (const s of dbSettings) {
      settingsMap[s.key] = s.value;
    }

    // Never leak SUPER_ADMIN_FULL_POWER in general settings for non-SUPER_ADMIN users
    if (!isSuperAdmin) {
      delete settingsMap[SETTING_SUPER_ADMIN_FULL_POWER];
    }

    const gates = await this.prisma.gate.findMany({
      orderBy: { gateNumber: 'asc' },
    });

    // Group the flat settings into group objects for frontend ease
    const groups: Record<string, Record<string, any>> = {};
    for (const [groupName, fields] of Object.entries(FIELDS_BY_GROUP)) {
      groups[groupName] = {};
      const toggles = TOGGLE_FIELDS[groupName] || [];
      for (const field of fields) {
        const fullKey = `${groupName}.${field}`;
        const rawVal = settingsMap[fullKey] ?? DEFAULT_SETTINGS[fullKey] ?? '';
        if (toggles.includes(field)) {
          groups[groupName][field] = rawVal === '1' || rawVal === 'true';
        } else {
          groups[groupName][field] = rawVal;
        }
      }
    }

    return {
      settings: settingsMap,
      groups,
      gates: gates.map((g) => ({
        id: g.id.toString(),
        name: g.name,
        code: g.gateNumber,
        location: g.description,
        status: g.status,
      })),
    };
  }

  async updateGroup(group: string, values: Record<string, any>, userId?: bigint) {
    const validGroups = Object.keys(FIELDS_BY_GROUP);
    if (!validGroups.includes(group)) {
      throw new BadRequestException(`Invalid settings group: ${group}. Valid groups are: ${validGroups.join(', ')}`);
    }

    const fields = FIELDS_BY_GROUP[group];
    const toggles = TOGGLE_FIELDS[group] || [];

    await this.prisma.$transaction(async (tx) => {
      for (const field of fields) {
        if (values[field] !== undefined) {
          const fullKey = `${group}.${field}`;
          let valStr: string;
          if (toggles.includes(field)) {
            valStr = values[field] ? '1' : '0';
          } else {
            valStr = String(values[field] ?? '').trim();
          }

          await tx.setting.upsert({
            where: { key: fullKey },
            update: { value: valStr },
            create: { key: fullKey, value: valStr },
          });
        }
      }

      if (userId) {
        await tx.auditLog.create({
          data: {
            userId,
            action: 'settings_updated',
            details: {
              group,
              updatedFields: Object.keys(values),
            },
          },
        });
      }
    });

    return { success: true, message: `Settings for group ${group} saved successfully.` };
  }

  async resetEventData(confirmation: string, userId?: bigint) {
    if (confirmation.trim().toUpperCase() !== 'RESET') {
      throw new BadRequestException('Confirmation phrase must be RESET.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Clean scan logs and attendees safely
      await tx.scanLog.deleteMany({ where: { isLoadTest: true } });
      if (userId) {
        await tx.auditLog.create({
          data: {
            userId,
            action: 'event_data_reset_requested',
            details: {
              timestamp: new Date().toISOString(),
            },
          },
        });
      }
    });

    return { success: true, message: 'Event data reset completed.' };
  }

  /**
   * Determine if SUPER_ADMIN Full Power is currently active for the requesting user.
   */
  async isFullPowerActive(userRole?: string | null): Promise<boolean> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: SETTING_SUPER_ADMIN_FULL_POWER },
      });
      return isSuperAdminFullPowerActive(userRole, setting?.value, process.env.NODE_ENV);
    } catch {
      return false;
    }
  }

  /**
   * Determine if global maintenance mode is currently active.
   */
  async isMaintenanceModeActive(): Promise<boolean> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: SETTING_MAINTENANCE_MODE },
      });
      return isMaintenanceModeActive(setting?.value);
    } catch {
      return false;
    }
  }

  /**
   * Authoritative retrieval of SUPER_ADMIN control center settings.
   */
  async getSuperAdminSettings(userRole?: string | null) {
    const role = (userRole || '').toUpperCase().trim();
    if (role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can access Super Admin control center settings.');
    }

    const [fullPowerSetting, maintenanceSetting] = await Promise.all([
      this.prisma.setting.findUnique({ where: { key: SETTING_SUPER_ADMIN_FULL_POWER } }),
      this.prisma.setting.findUnique({ where: { key: SETTING_MAINTENANCE_MODE } }),
    ]);

    const isFullPowerEnabled = fullPowerSetting?.value === '1' || fullPowerSetting?.value === 'true';
    const isMaintenanceEnabled = maintenanceSetting?.value === '1' || maintenanceSetting?.value === 'true';
    const fullPowerActive = isSuperAdminFullPowerActive(role, fullPowerSetting?.value, process.env.NODE_ENV);
    const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase().trim();

    return {
      superAdminFullPower: isFullPowerEnabled,
      fullPowerActive,
      isProduction: nodeEnv === 'production',
      nodeEnv: process.env.NODE_ENV || 'development',
      maintenanceMode: isMaintenanceEnabled,
      adminTestDataDeleteEnabled: isAdminTestDataDeleteEnabled(),
    };
  }

  /**
   * Authoritative activation or deactivation of SUPER_ADMIN Full Power mode.
   */
  async toggleFullPower(
    enabled: boolean,
    confirmation?: string,
    user?: { id?: bigint | string; role?: string } | string,
  ) {
    const userRole = typeof user === 'string' ? user : user?.role;
    const userId = typeof user === 'object' && user !== null ? user.id : undefined;

    if ((userRole || '').toUpperCase().trim() !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can modify Super Admin Full Power setting.');
    }

    if (typeof enabled !== 'boolean') {
      throw new BadRequestException('The enabled property must be an explicit boolean.');
    }

    const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase().trim();

    if (enabled) {
      // 1. Strict production fail-closed check
      if (nodeEnv === 'production') {
        throw new BadRequestException('Full Power is strictly unavailable in Production environment.');
      }

      // 2. Strict confirmation requirement
      if ((confirmation || '').trim() !== CONFIRMATION_ENABLE_FULL_POWER) {
        throw new BadRequestException(
          `Confirmation phrase must be exactly '${CONFIRMATION_ENABLE_FULL_POWER}' to activate Full Power.`,
        );
      }
    }

    const valStr = enabled ? '1' : '0';

    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: SETTING_SUPER_ADMIN_FULL_POWER },
        update: { value: valStr },
        create: { key: SETTING_SUPER_ADMIN_FULL_POWER, value: valStr },
      });

      await tx.auditLog.create({
        data: {
          userId: userId ? BigInt(userId) : null,
          action: enabled ? AUDIT_SUPER_ADMIN_FULL_POWER_ENABLED : AUDIT_SUPER_ADMIN_FULL_POWER_DISABLED,
          details: {
            action: enabled ? 'ENABLE_FULL_POWER' : 'DISABLE_FULL_POWER',
            enabled,
            nodeEnv: process.env.NODE_ENV || 'development',
            reason: enabled
              ? 'SUPER_ADMIN Full Power activated by authorized administrator'
              : 'SUPER_ADMIN Full Power deactivated by administrator',
            timestamp: new Date().toISOString(),
          },
        },
      });
    });

    return {
      success: true,
      enabled,
      fullPowerActive: enabled && nodeEnv !== 'production',
      message: enabled
        ? 'SUPER_ADMIN Full Power mode activated. Destructive operations are enabled in this non-production environment.'
        : 'SUPER_ADMIN Full Power mode deactivated. Normal safe deletion safeguards restored.',
    };
  }

  /**
   * Authoritative activation or deactivation of global maintenance mode.
   */
  async toggleMaintenanceMode(
    enabled: boolean,
    confirmation?: string,
    user?: { id?: bigint | string; role?: string } | string,
  ) {
    const userRole = typeof user === 'string' ? user : user?.role;
    const userId = typeof user === 'object' && user !== null ? user.id : undefined;

    if ((userRole || '').toUpperCase().trim() !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can modify Maintenance Mode setting.');
    }

    if (typeof enabled !== 'boolean') {
      throw new BadRequestException('The enabled property must be an explicit boolean.');
    }

    if (enabled) {
      if ((confirmation || '').trim() !== CONFIRMATION_ENABLE_MAINTENANCE) {
        throw new BadRequestException(
          `Confirmation phrase must be exactly '${CONFIRMATION_ENABLE_MAINTENANCE}' to activate Maintenance Mode.`,
        );
      }
    }

    const valStr = enabled ? '1' : '0';

    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: SETTING_MAINTENANCE_MODE },
        update: { value: valStr },
        create: { key: SETTING_MAINTENANCE_MODE, value: valStr },
      });

      await tx.auditLog.create({
        data: {
          userId: userId ? BigInt(userId) : null,
          action: enabled ? AUDIT_MAINTENANCE_MODE_ENABLED : AUDIT_MAINTENANCE_MODE_DISABLED,
          details: {
            action: enabled ? 'ENABLE_MAINTENANCE' : 'DISABLE_MAINTENANCE',
            enabled,
            reason: enabled
              ? 'Maintenance mode activated by SUPER_ADMIN. Public registrations and ticket purchases suspended.'
              : 'Maintenance mode deactivated by SUPER_ADMIN. Public operations restored.',
            timestamp: new Date().toISOString(),
          },
        },
      });
    });

    return {
      success: true,
      enabled,
      message: enabled
        ? 'Maintenance mode activated. Public registration and ticket booking are suspended.'
        : 'Maintenance mode deactivated. Normal public operations restored.',
    };
  }

  /**
   * Authoritative check whether Razorpay online payments are enabled.
   */
  async isPaymentEnabled(): Promise<boolean> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: SETTING_PAYMENT_RAZORPAY_ENABLED },
      });
      if (!setting) return false;
      return setting.value === '1' || setting.value === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Authoritative retrieval of Razorpay payment gateway settings.
   * Available ONLY to SUPER_ADMIN.
   * Strictly avoids exposing the Razorpay secret key.
   */
  async getPaymentSettings(userRole?: string | null) {
    const role = (userRole || '').toUpperCase().trim();
    if (role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can access Payment Settings.');
    }

    const enabled = await this.isPaymentEnabled();
    const rawKeyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const rawKeySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    const isConfigured = Boolean(rawKeyId && rawKeySecret);

    let environment = 'TEST';
    if (rawKeyId.startsWith('rzp_live')) {
      environment = 'LIVE';
    } else if (rawKeyId.startsWith('rzp_test')) {
      environment = 'TEST';
    } else if (!isConfigured) {
      environment = 'TEST / SANDBOX (Mock)';
    }

    return {
      enabled,
      environment,
      gateway: 'Razorpay',
      keyId: rawKeyId || 'rzp_test_placeholder',
      isConfigured,
    };
  }

  /**
   * Update Razorpay payment gateway status (ON / OFF).
   * Available ONLY to SUPER_ADMIN.
   * Strictly writes to database Setting table and records an audit log.
   */
  async updatePaymentSettings(
    enabled: boolean,
    user?: { id?: bigint | string; role?: string } | string,
  ) {
    const userRole = typeof user === 'string' ? user : user?.role;
    const userId = typeof user === 'object' && user !== null ? user.id : undefined;

    if ((userRole || '').toUpperCase().trim() !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can modify Payment Settings.');
    }

    if (typeof enabled !== 'boolean') {
      throw new BadRequestException('The enabled property must be an explicit boolean.');
    }

    const previousEnabled = await this.isPaymentEnabled();
    const valStr = enabled ? '1' : '0';

    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: SETTING_PAYMENT_RAZORPAY_ENABLED },
        update: { value: valStr },
        create: { key: SETTING_PAYMENT_RAZORPAY_ENABLED, value: valStr },
      });

      await tx.auditLog.create({
        data: {
          userId: userId ? BigInt(userId) : null,
          action: enabled ? AUDIT_PAYMENT_GATEWAY_ENABLED : AUDIT_PAYMENT_GATEWAY_DISABLED,
          details: {
            gateway: 'Razorpay',
            enabled,
            previousState: previousEnabled,
            updatedByRole: userRole,
            timestamp: new Date().toISOString(),
            reason: enabled
              ? 'Razorpay online payments enabled by SUPER_ADMIN.'
              : 'Razorpay online payments disabled by SUPER_ADMIN. New order initiation blocked.',
          },
        },
      });
    });

    return {
      success: true,
      enabled,
      message: enabled
        ? 'Razorpay online payments enabled. Customers can initiate pass bookings.'
        : 'Razorpay online payments disabled. New online payment initiations are blocked.',
    };
  }

  /**
   * Determine if Book Pass availability is OPEN for public bookings.
   * Defaults to true (OPEN) if not explicitly set.
   */
  async isBookPassAvailable(): Promise<boolean> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: SETTING_BOOK_PASS_AVAILABILITY },
      });
      return isBookPassOpen(setting?.value);
    } catch {
      return true;
    }
  }

  /**
   * Authoritative retrieval of Book Pass availability settings.
   * Accessible to authorized roles: SUPER_ADMIN, EVENT_ADMIN, ADMIN.
   */
  async getBookPassSettings(userRole?: string | null) {
    const role = (userRole || '').toUpperCase().trim();
    if (
      role !== UserRole.SUPER_ADMIN &&
      role !== UserRole.EVENT_ADMIN &&
      role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Only authorized admins can access Book Pass Settings.');
    }

    const setting = await this.prisma.setting.findUnique({
      where: { key: SETTING_BOOK_PASS_AVAILABILITY },
    });
    const isOpen = isBookPassOpen(setting?.value);

    return {
      success: true,
      enabled: isOpen,
      availability: isOpen ? 'OPEN' : 'COMING_SOON',
      updatedAt: setting?.updatedAt || null,
    };
  }

  /**
   * Updates Book Pass availability setting.
   * Strictly writes to database Setting table and records an audit log.
   * Accessible to authorized roles: SUPER_ADMIN, EVENT_ADMIN, ADMIN.
   */
  async updateBookPassSettings(
    availabilityOrEnabled: string | boolean,
    user?: { id?: bigint | string; role?: string; email?: string; name?: string },
  ) {
    const userRole = typeof user === 'string' ? user : user?.role;
    const userId = typeof user === 'object' && user !== null ? user.id : undefined;
    const role = (userRole || '').toUpperCase().trim();

    if (
      role !== UserRole.SUPER_ADMIN &&
      role !== UserRole.EVENT_ADMIN &&
      role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Only authorized admins can modify Book Pass Settings.');
    }

    const isOpen = isBookPassOpen(availabilityOrEnabled);
    const valStr = isOpen ? 'OPEN' : 'COMING_SOON';

    const previousSetting = await this.prisma.setting.findUnique({
      where: { key: SETTING_BOOK_PASS_AVAILABILITY },
    });
    const previousState = isBookPassOpen(previousSetting?.value) ? 'OPEN' : 'COMING_SOON';

    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: SETTING_BOOK_PASS_AVAILABILITY },
        update: { value: valStr },
        create: { key: SETTING_BOOK_PASS_AVAILABILITY, value: valStr },
      });

      await tx.auditLog.create({
        data: {
          userId: userId ? BigInt(userId) : null,
          action: AUDIT_BOOK_PASS_AVAILABILITY_UPDATED,
          details: {
            setting: SETTING_BOOK_PASS_AVAILABILITY,
            oldState: previousState,
            newState: valStr,
            enabled: isOpen,
            updatedByRole: userRole,
            changedBy: user?.email || user?.name || (userId ? `user_${userId}` : 'unknown'),
            timestamp: new Date().toISOString(),
          },
        },
      });
    });

    return {
      success: true,
      enabled: isOpen,
      availability: valStr,
      message: isOpen
        ? 'Book Pass availability updated to OPEN. Customers can book passes.'
        : 'Book Pass availability updated to COMING SOON. Customers see the Coming Soon page.',
    };
  }
}
