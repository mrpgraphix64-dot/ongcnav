import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  async getAllSettings() {
    const dbSettings = await this.prisma.setting.findMany();
    const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS };

    for (const s of dbSettings) {
      settingsMap[s.key] = s.value;
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
}
