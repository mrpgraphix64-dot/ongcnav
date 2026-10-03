import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService, LockStatus, LockAcquisitionResult } from '../redis/redis.service';
import { resolveBookingDays } from '../common/utils/attendee-booking.util';
import { ProcessCheckinDto, ScannerHeartbeatDto } from './dto/checkin.dto';
import {
  CheckinResult,
  CheckinStatus,
  AttendeeStatus,
  RegistrationType,
  GateType,
  UserRole,
  isOfficialEventDate,
  OFFICIAL_EVENT_DATES,
} from '@ongc/shared-types';

export const CHECKIN_LOCK_TTL_SECONDS = 5;
const DEFAULT_SCANNER_RATE_LIMIT_PER_MINUTE = 120; // 2/sec sustained, well above the 1/sec/gate baseline, with burst headroom

@Injectable()
export class CheckinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {}

  private getTodayIst(): string {
    const now = new Date();
    const istString = now.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    }); // returns YYYY-MM-DD
    return istString;
  }

  private getScannerRateLimitPerMinute(): number {
    const raw = this.configService.get<string>('SCANNER_RATE_LIMIT_PER_MINUTE');
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SCANNER_RATE_LIMIT_PER_MINUTE;
  }

  private async getSetting(key: string, altKey?: string): Promise<string | null> {
    const s = await this.prisma.setting.findUnique({ where: { key } });
    if (s?.value) return s.value;
    if (altKey) {
      const alt = await this.prisma.setting.findUnique({ where: { key: altKey } });
      if (alt?.value) return alt.value;
    }
    return null;
  }

  async processCheckin(
    dto: ProcessCheckinDto,
    scannedByUser?: { id: string; role: UserRole },
    reqMeta?: { ip?: string; userAgent?: string },
  ) {
    const startTime = Date.now();
    const token = dto.token.trim();
    const gateId = BigInt(dto.gateId);
    let isLoadTest = !!dto.isLoadTest;
    const loadTestRunId = dto.loadTestRunId ? BigInt(dto.loadTestRunId) : null;

    // 0. Test Date Resolution & Strict RBAC Enforcement
    const rawTestDate = (dto.testDate || (dto as any).simulationDate)?.trim();
    if (rawTestDate) {
      if (!isLoadTest && scannedByUser?.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Only SUPER_ADMIN is authorized to use scanner test-date simulation.');
      }
      if (!isOfficialEventDate(rawTestDate)) {
        throw new BadRequestException(
          `Invalid scanner test date: "${rawTestDate}". Allowed official event dates are: ${OFFICIAL_EVENT_DATES.join(', ')}`
        );
      }
    }

    const isSuperAdminTest = scannedByUser?.role === UserRole.SUPER_ADMIN && !!rawTestDate;
    const isTestDateActive = (isSuperAdminTest || isLoadTest) && !!rawTestDate;

    // 3. Active Event Date Resolution
    const activeDateVal = await this.getSetting('event_control.active_event_date', 'active_event_date');
    const configuredDate = activeDateVal && activeDateVal.trim() !== '' ? activeDateVal.trim() : this.getTodayIst();
    const activeDate = isTestDateActive ? rawTestDate : configuredDate;

    const effectiveReqMeta = {
      ip: reqMeta?.ip,
      userAgent: isSuperAdminTest
        ? `[TEST_MODE:${activeDate}] ${reqMeta?.userAgent || ''}`.trim().slice(0, 255)
        : reqMeta?.userAgent,
    };

    // 0b. Rate limiting — checked before database work
    if (scannedByUser && !isLoadTest) {
      const rateLimitPerMinute = this.getScannerRateLimitPerMinute();
      const rateLimitKey = `rl:scanner:${scannedByUser.id}`;
      const requestCount = await this.redis.incrementCounter(rateLimitKey, 60);
      if (requestCount !== null && requestCount > rateLimitPerMinute) {
        await this.recordScanLog({
          gateId,
          scannedById: BigInt(scannedByUser.id),
          result: CheckinResult.RATE_LIMITED,
          responseTimeMs: Date.now() - startTime,
          isLoadTest,
          loadTestRunId,
          ipAddress: effectiveReqMeta.ip,
          userAgent: effectiveReqMeta.userAgent,
        });

        return {
          success: false,
          result: CheckinResult.RATE_LIMITED,
          message: 'Too many scan requests. Please slow down.',
          statusCode: 429,
        };
      }
    }

    // 1. Master Event Status Check (Laravel parity)
    const eventStatus = await this.getSetting('event_control.event_status', 'event_status');
    if (eventStatus === 'closed' && !isLoadTest) {
      await this.recordScanLog({
        gateId,
        scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
        result: CheckinResult.EVENT_CLOSED,
        responseTimeMs: Date.now() - startTime,
        isLoadTest,
        loadTestRunId,
        ipAddress: effectiveReqMeta.ip,
        userAgent: effectiveReqMeta.userAgent,
      });

      return {
        success: false,
        result: CheckinResult.EVENT_CLOSED,
        message: 'EVENT CLOSED: Entry scanning is not open at this time.',
        statusCode: 403,
      };
    }

    // 2. Emergency Stop & System Scanning Enabled Check
    const emergencyVal = await this.getSetting('event_control.emergency_stopped', 'emergency_stop');
    const isEmergency = emergencyVal === '1' || emergencyVal === 'true';

    const scanningVal = await this.getSetting('event_control.scanning_enabled', 'scanning_enabled');
    const isScanningDisabled = scanningVal === '0' || scanningVal === 'false';

    if (isEmergency || isScanningDisabled) {
      const reasonVal = await this.getSetting('emergency_stop_reason', 'event_control.emergency_stop_reason');
      const message = isEmergency
        ? (reasonVal || 'EMERGENCY STOP ACTIVATED: All entry scanning is immediately halted.')
        : 'SCANNING SUSPENDED: Entry scanning is temporarily stopped.';

      await this.recordScanLog({
        gateId,
        scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
        result: CheckinResult.EVENT_CLOSED,
        responseTimeMs: Date.now() - startTime,
        isLoadTest,
        loadTestRunId,
        ipAddress: effectiveReqMeta.ip,
        userAgent: effectiveReqMeta.userAgent,
      });

      return {
        success: false,
        result: CheckinResult.EVENT_CLOSED,
        message,
        statusCode: 403,
      };
    }

    // 4. Gate Verification & Operational Status
    const gate = await this.prisma.gate.findUnique({ where: { id: gateId } });
    if (!gate) {
      await this.recordScanLog({
        gateId,
        scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
        result: CheckinResult.GATE_CLOSED,
        responseTimeMs: Date.now() - startTime,
        isLoadTest,
        loadTestRunId,
        ipAddress: effectiveReqMeta.ip,
        userAgent: effectiveReqMeta.userAgent,
      });

      return {
        success: false,
        result: CheckinResult.GATE_CLOSED,
        message: `Gate with ID ${dto.gateId} not found`,
        statusCode: 404,
      };
    }

    if (!gate.isOpen) {
      await this.recordScanLog({
        gateId,
        scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
        result: CheckinResult.GATE_CLOSED,
        responseTimeMs: Date.now() - startTime,
        isLoadTest,
        loadTestRunId,
        ipAddress: effectiveReqMeta.ip,
        userAgent: effectiveReqMeta.userAgent,
      });

      return {
        success: false,
        result: CheckinResult.GATE_CLOSED,
        message: `GATE CLOSED: Gate ${gate.name} is currently closed for entry`,
        statusCode: 403,
      };
    }

    if (gate.isScanningPaused) {
      await this.recordScanLog({
        gateId,
        scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
        result: CheckinResult.SCANNING_PAUSED,
        responseTimeMs: Date.now() - startTime,
        isLoadTest,
        loadTestRunId,
        ipAddress: effectiveReqMeta.ip,
        userAgent: effectiveReqMeta.userAgent,
      });

      return {
        success: false,
        result: CheckinResult.SCANNING_PAUSED,
        message: `Scanning at Gate ${gate.name} is currently paused`,
        statusCode: 403,
      };
    }

    // 5. Operator Gate Authorization Check — the gate the request claims to
    // scan at is never trusted on its own: for anyone other than a
    // SUPER_ADMIN/ADMIN, it must match a real GateUser assignment row for
    // this authenticated staff member, looked up server-side.
    if (
      scannedByUser &&
      scannedByUser.role !== UserRole.SUPER_ADMIN &&
      scannedByUser.role !== UserRole.ADMIN
    ) {
      const isAssigned = await this.prisma.gateUser.findFirst({
        where: {
          userId: BigInt(scannedByUser.id),
          gateId: gate.id,
        },
      });

      if (!isAssigned) {
        await this.recordScanLog({
          gateId,
          scannedById: BigInt(scannedByUser.id),
          result: CheckinResult.UNAUTHORIZED_GATE,
          responseTimeMs: Date.now() - startTime,
          isLoadTest,
          loadTestRunId,
          ipAddress: reqMeta?.ip,
          userAgent: reqMeta?.userAgent,
        });

        return {
          success: false,
          result: CheckinResult.UNAUTHORIZED_GATE,
          message: `You are not assigned to operate Gate ${gate.name}`,
          statusCode: 403,
        };
      }
    }

    // 6. Gate Capacity & Block-when-full Check
    const isCapacityRuleActive =
      gate.capacityEnabled &&
      gate.blockWhenFull &&
      gate.totalCapacity !== null &&
      gate.totalCapacity !== undefined &&
      gate.totalCapacity >= 0;

    if (isCapacityRuleActive) {
      const todayTotal = await this.prisma.dailyCheckin.count({
        where: {
          gateId: gate.id,
          eventDate: activeDate,
          status: 'SUCCESS' as any,
          isLoadTest: false,
        },
      });

      if (todayTotal >= gate.totalCapacity!) {
        await this.recordScanLog({
          gateId,
          scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
          result: CheckinResult.GATE_FULL,
          responseTimeMs: Date.now() - startTime,
          isLoadTest,
          loadTestRunId,
          ipAddress: reqMeta?.ip,
          userAgent: reqMeta?.userAgent,
        });

        return {
          success: false,
          result: CheckinResult.GATE_FULL,
          message: `GATE CAPACITY REACHED: Gate ${gate.name} has reached maximum capacity (${gate.totalCapacity})`,
          statusCode: 403,
        };
      }
    }

    // 6. Token Lookup (DailyEmployeePass first, then Attendee)
    let dailyEmployeePass: any = null;
    if (this.prisma.dailyEmployeePass) {
      dailyEmployeePass = await this.prisma.dailyEmployeePass.findUnique({
        where: { qrToken: token },
        include: {
          attendee: {
            include: {
              employee: true,
              familyMember: true,
              order: true,
            },
          },
        },
      });
    }

    let attendee: any = null;

    if (dailyEmployeePass) {
      attendee = dailyEmployeePass.attendee;

      if (dailyEmployeePass.isTest) {
        isLoadTest = true;
      }

      // Validate daily pass status
      if (dailyEmployeePass.status === 'REVOKED') {
        await this.recordScanLog({
          attendeeId: attendee.id,
          gateId,
          scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
          result: CheckinResult.ATTENDEE_INACTIVE,
          responseTimeMs: Date.now() - startTime,
          isLoadTest,
          loadTestRunId,
          ipAddress: effectiveReqMeta.ip,
          userAgent: effectiveReqMeta.userAgent,
        });

        return {
          success: false,
          result: CheckinResult.ATTENDEE_INACTIVE,
          message: 'This daily pass has been revoked',
          statusCode: 403,
        };
      }

      // Validate attendee bookingDays against active event date (permanent QR architecture)
      const attendeeBookingDays = resolveBookingDays(attendee);
      const isDateValid = attendeeBookingDays.length > 0
        ? attendeeBookingDays.includes(activeDate)
        : dailyEmployeePass.eventDate === activeDate;

      if (!isDateValid) {
        await this.recordScanLog({
          attendeeId: attendee.id,
          gateId,
          scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
          result: CheckinResult.NOT_BOOKED_TODAY,
          responseTimeMs: Date.now() - startTime,
          isLoadTest,
          loadTestRunId,
          ipAddress: effectiveReqMeta.ip,
          userAgent: effectiveReqMeta.userAgent,
        });

        const attendeeName = attendee.familyMember
          ? attendee.familyMember.name
          : (attendee.employee?.name || attendee.name || 'Attendee');

        return {
          success: false,
          result: CheckinResult.NOT_BOOKED_TODAY,
          message: `Attendee is not registered for today (${activeDate}).`,
          statusCode: 403,
          attendeeName,
        };
      }
    } else {
      // Lookup attendee by permanent qrCodeToken or ticketNumber
      attendee = await this.prisma.attendee.findFirst({
        where: {
          OR: [{ qrCodeToken: token }, { ticketNumber: token }],
        },
        include: {
          employee: true,
          familyMember: true,
          order: true,
        },
      });

      if (!attendee) {
        await this.recordScanLog({
          gateId,
          scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
          result: CheckinResult.INVALID_QR,
          responseTimeMs: Date.now() - startTime,
          isLoadTest,
          loadTestRunId,
          ipAddress: effectiveReqMeta.ip,
          userAgent: effectiveReqMeta.userAgent,
        });

        return {
          success: false,
          result: CheckinResult.INVALID_QR,
          message: 'Invalid or unrecognized QR Code ticket',
          statusCode: 400,
        };
      }

      const isEmployeeAttendee =
        attendee.registrationType === RegistrationType.EMPLOYEE ||
        attendee.employeeId !== null ||
        attendee.category === 'ONGC STAFF' ||
        attendee.category === 'FAMILY MEMBER';

      // Under the permanent QR architecture, the attendee permanent QR token is accepted directly at all gates.
      // If a daily employee pass record exists for today, link to it for legacy audit status tracking.
      if (isEmployeeAttendee && !dailyEmployeePass && !isLoadTest && this.prisma.dailyEmployeePass) {
        dailyEmployeePass = (await this.prisma.dailyEmployeePass.findUnique({
          where: {
            unique_attendee_daily_pass: {
              attendeeId: attendee.id,
              eventDate: activeDate,
              isTest: false,
            },
          },
          include: {
            attendee: {
              include: {
                employee: true,
                familyMember: true,
                order: true,
              },
            },
          },
        })) as any;
      }
    }

    // 7. Attendee Status Check
    if (String(attendee.status).toUpperCase() !== 'ACTIVE') {
      await this.recordScanLog({
        attendeeId: attendee.id,
        gateId,
        scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
        result: CheckinResult.ATTENDEE_INACTIVE,
        responseTimeMs: Date.now() - startTime,
        isLoadTest,
        loadTestRunId,
        ipAddress: effectiveReqMeta.ip,
        userAgent: effectiveReqMeta.userAgent,
      });

      return {
        success: false,
        result: CheckinResult.ATTENDEE_INACTIVE,
        message: `This pass is currently ${attendee.status}`,
        statusCode: 403,
      };
    }

    // Determine if this is an Any Day Pass (flexible single-night entry pass)
    const isAnyDayPass =
      (attendee as any).order?.ticketType === 'COMMERCIAL_ANY_DAY' ||
      attendee.category === 'COMMERCIAL_ANY_DAY' ||
      attendee.category === 'Any Day Pass';

    // 8. Event Date Booking Check — this person's OWN dates, independent of
    // the employee they're linked to and any other family member.
    // For Any Day Pass: valid for ONE entry on ANY ONE official event night (11-19 Oct 2026).
    if (isAnyDayPass) {
      if (!OFFICIAL_EVENT_DATES.includes(activeDate)) {
        await this.recordScanLog({
          attendeeId: attendee.id,
          gateId,
          scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
          result: CheckinResult.NOT_BOOKED_TODAY,
          responseTimeMs: Date.now() - startTime,
          isLoadTest,
          loadTestRunId,
          ipAddress: effectiveReqMeta.ip,
          userAgent: effectiveReqMeta.userAgent,
        });

        if (isSuperAdminTest && scannedByUser?.id) {
          await this.recordSimulationAudit({
            userId: scannedByUser.id,
            testEventDate: activeDate,
            gateId: gate.id.toString(),
            token,
            result: CheckinResult.NOT_BOOKED_TODAY,
            attendeeId: attendee.id.toString(),
          });
        }

        return {
          success: false,
          result: CheckinResult.NOT_BOOKED_TODAY,
          message: `Pass is not valid for date (${activeDate}). Any Day Pass is valid for one entry on any official event night (11 Oct – 19 Oct 2026).`,
          statusCode: 403,
          attendeeName: attendee.familyMember
            ? attendee.familyMember.name
            : (attendee.employee?.name || attendee.name || 'Attendee'),
        };
      }
    } else {
      const bookingDays = resolveBookingDays(attendee);
      if (bookingDays.length > 0 && !bookingDays.includes(activeDate)) {
        await this.recordScanLog({
          attendeeId: attendee.id,
          gateId,
          scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
          result: CheckinResult.NOT_BOOKED_TODAY,
          responseTimeMs: Date.now() - startTime,
          isLoadTest,
          loadTestRunId,
          ipAddress: effectiveReqMeta.ip,
          userAgent: effectiveReqMeta.userAgent,
        });

        if (isSuperAdminTest && scannedByUser?.id) {
          await this.recordSimulationAudit({
            userId: scannedByUser.id,
            testEventDate: activeDate,
            gateId: gate.id.toString(),
            token,
            result: CheckinResult.NOT_BOOKED_TODAY,
            attendeeId: attendee.id.toString(),
          });
        }

        return {
          success: false,
          result: CheckinResult.NOT_BOOKED_TODAY,
          message: `Pass is not registered for today (${activeDate}). Registered for: ${bookingDays.join(', ')}`,
          statusCode: 403,
          attendeeName: attendee.familyMember
            ? attendee.familyMember.name
            : (attendee.employee?.name || attendee.name || 'Attendee'),
        };
      }
    }

    // 9. Gate Type Privilege Check
    const des = (attendee.employee?.designation || attendee.category || '').toLowerCase();
    if (gate.gateType === GateType.VIP && attendee.category !== 'VIP' && attendee.category !== 'VVIP' && attendee.employee?.designation !== 'VIP') {
      // Allow if designation contains Executive / Director / GM or special VIP pass
      const isVipEligible = des.includes('director') || des.includes('ed') || des.includes('gm') || des.includes('vip');
      if (!isVipEligible) {
        return {
          success: false,
          result: CheckinResult.UNAUTHORIZED_GATE,
          message: `Gate ${gate.name} is designated for VIPs only`,
          statusCode: 403,
        };
      }
    }

    // 10. ATOMIC CONCURRENCY LOCK (Redis + DB Transaction)
    // For Any Day Pass, lock across all event dates because it can only be redeemed once in total
    const lockKey = isAnyDayPass
      ? `lock:checkin:${attendee.id.toString()}`
      : `lock:checkin:${attendee.id.toString()}:${activeDate}`;

    let lockResult: LockAcquisitionResult;
    if (typeof (this.redis as any).acquireLockDetailed === 'function') {
      lockResult = await this.redis.acquireLockDetailed(lockKey, CHECKIN_LOCK_TTL_SECONDS);
    } else {
      const raw = await this.redis.acquireLock(lockKey, CHECKIN_LOCK_TTL_SECONDS);
      if (typeof raw === 'string') {
        lockResult = { status: LockStatus.ACQUIRED, token: raw };
      } else if (raw === true) {
        lockResult = { status: LockStatus.ACQUIRED, token: 'mock-token' };
      } else if (raw === false || raw === null) {
        lockResult = { status: LockStatus.HELD, token: null };
      } else {
        lockResult = { status: LockStatus.UNAVAILABLE, token: null };
      }
    }

    if (lockResult.status === LockStatus.HELD) {
      // Another concurrent scan for the exact same attendee is in progress right now
      return {
        success: false,
        result: CheckinResult.ALREADY_CHECKED_IN,
        message: 'Concurrent scan detected. Already processed.',
        statusCode: 409,
      };
    }

    try {
      // Execute within PostgreSQL Transaction
      const checkinResult = await this.prisma.$transaction(
        async (tx) => {
          // Lock attendee row or check for existing daily_checkin
          // For Any Day Pass: verify no prior check-in on ANY event date
          const existingCheckin = isAnyDayPass
            ? await tx.dailyCheckin.findFirst({
                where: {
                  attendeeId: attendee.id,
                  status: CheckinStatus.SUCCESS as any,
                },
                include: {
                  gate: true,
                },
              })
            : await tx.dailyCheckin.findFirst({
                where: {
                  attendeeId: attendee.id,
                  eventDate: activeDate,
                  status: CheckinStatus.SUCCESS as any,
                },
                include: {
                  gate: true,
                },
              });

          if (existingCheckin) {
            return {
              isDuplicate: true,
              existingCheckin,
            };
          }

          // Check if a voided check-in record already exists for today
          const existingRecordToday = await tx.dailyCheckin.findFirst({
            where: {
              attendeeId: attendee.id,
              eventDate: activeDate,
            },
          });

          // If a voided checkin exists for today, update it to SUCCESS (rescan after void)
          // otherwise create a new checkin record
          const newCheckin = existingRecordToday
            ? await tx.dailyCheckin.update({
                where: { id: existingRecordToday.id },
                data: {
                  gateId: gate.id,
                  scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
                  checkinTime: new Date(),
                  status: CheckinStatus.SUCCESS as any,
                  isManual: false,
                  manualReason: null,
                  voidedAt: null,
                  voidedById: null,
                  voidReason: null,
                  isLoadTest,
                  loadTestRunId,
                },
              })
            : await tx.dailyCheckin.create({
                data: {
                  attendeeId: attendee.id,
                  gateId: gate.id,
                  scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
                  eventDate: activeDate,
                  checkinTime: new Date(),
                  status: CheckinStatus.SUCCESS as any,
                  isLoadTest,
                  loadTestRunId,
                },
              });

          if (dailyEmployeePass && (tx as any).dailyEmployeePass) {
            await (tx as any).dailyEmployeePass.update({
              where: { id: dailyEmployeePass.id },
              data: {
                status: 'USED' as any,
                checkedInAt: new Date(),
              },
            });
          }

          return {
            isDuplicate: false,
            newCheckin,
          };
        },
        {
          isolationLevel: 'ReadCommitted',
        },
      );

      if (checkinResult.isDuplicate && checkinResult.existingCheckin) {
        const prev = checkinResult.existingCheckin;
        await this.recordScanLog({
          attendeeId: attendee.id,
          gateId,
          scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
          result: CheckinResult.ALREADY_CHECKED_IN,
          responseTimeMs: Date.now() - startTime,
          isLoadTest,
          loadTestRunId,
          ipAddress: effectiveReqMeta.ip,
          userAgent: effectiveReqMeta.userAgent,
        });

        if (isSuperAdminTest && scannedByUser?.id) {
          await this.recordSimulationAudit({
            userId: scannedByUser.id,
            testEventDate: activeDate,
            gateId: gate.id.toString(),
            token,
            result: CheckinResult.ALREADY_CHECKED_IN,
            attendeeId: attendee.id.toString(),
          });
        }

        const timeStr = new Date(prev.checkinTime).toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        const duplicateMsg =
          isAnyDayPass && prev.eventDate !== activeDate
            ? `Already checked in on ${prev.eventDate} at ${timeStr} (Gate: ${prev.gate?.name || 'Gate ' + prev.gateId}). Any Day Pass has already been used.`
            : `Already checked in at ${timeStr} (Gate: ${prev.gate?.name || 'Gate ' + prev.gateId})`;

        return {
          success: false,
          result: CheckinResult.ALREADY_CHECKED_IN,
          message: duplicateMsg,
          statusCode: 409,
          checkedInAt: prev.checkinTime,
          gateName: prev.gate?.name,
          attendeeName: attendee.familyMember ? attendee.familyMember.name : (attendee.employee?.name || attendee.name || 'Attendee'),
          ticketNumber: attendee.ticketNumber,
        };
      }

      // Success!
      await this.recordScanLog({
        attendeeId: attendee.id,
        gateId,
        scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
        result: CheckinResult.SUCCESS,
        responseTimeMs: Date.now() - startTime,
        isLoadTest,
        loadTestRunId,
        ipAddress: effectiveReqMeta.ip,
        userAgent: effectiveReqMeta.userAgent,
      });

      if (isSuperAdminTest && scannedByUser?.id) {
        await this.recordSimulationAudit({
          userId: scannedByUser.id,
          testEventDate: activeDate,
          gateId: gate.id.toString(),
          token,
          result: CheckinResult.SUCCESS,
          attendeeId: attendee.id.toString(),
        });
      }

      const isFamily = !!attendee.familyMemberId;
      const attendeeName = isFamily ? attendee.familyMember?.name : (attendee.employee?.name || attendee.name || 'Attendee');

      return {
        success: true,
        result: CheckinResult.SUCCESS,
        message: isSuperAdminTest ? `Check-in successful [TEST MODE: ${activeDate}]` : 'Check-in successful',
        statusCode: 200,
        data: {
          checkinId: checkinResult.newCheckin?.id.toString(),
          ticketNumber: attendee.ticketNumber,
          referenceNumber: attendee.employee?.referenceNumber || attendee.employee?.cpf || null,
          attendeeName,
          isFamily,
          relation: attendee.familyMember?.relation || (attendee.employee ? 'Primary Employee' : 'Standalone Attendee'),
          employee: attendee.employee
            ? {
                id: attendee.employee.id.toString(),
                cpf: attendee.employee.cpf,
                referenceNumber: attendee.employee.referenceNumber || attendee.employee.cpf,
                name: attendee.employee.name,
                designation: attendee.employee.designation,
                department: attendee.employee.department,
                hasPhoto: !!attendee.employee.photoPath,
              }
            : null,
          gate: {
            id: gate.id.toString(),
            name: gate.name,
            gateNumber: gate.gateNumber,
          },
          checkinTime: checkinResult.newCheckin?.checkinTime,
          activeDate,
          isTestScan: isSuperAdminTest,
          testDate: isSuperAdminTest ? activeDate : undefined,
        },
      };
    } catch (err: any) {
      // Check for PostgreSQL unique constraint violation (code 23505)
      if (err.code === 'P2002' || err.message?.includes('unique_attendee_event_date')) {
        await this.recordScanLog({
          attendeeId: attendee.id,
          gateId,
          scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
          result: CheckinResult.ALREADY_CHECKED_IN,
          responseTimeMs: Date.now() - startTime,
          isLoadTest,
          loadTestRunId,
          ipAddress: effectiveReqMeta.ip,
          userAgent: effectiveReqMeta.userAgent,
        });

        if (isSuperAdminTest && scannedByUser?.id) {
          await this.recordSimulationAudit({
            userId: scannedByUser.id,
            testEventDate: activeDate,
            gateId: gate.id.toString(),
            token,
            result: CheckinResult.ALREADY_CHECKED_IN,
            attendeeId: attendee.id.toString(),
          });
        }

        return {
          success: false,
          result: CheckinResult.ALREADY_CHECKED_IN,
          message: 'Already checked in for today',
          statusCode: 409,
        };
      }

      throw err;
    } finally {
      if (lockResult && lockResult.status === LockStatus.ACQUIRED && lockResult.token) {
        await this.redis.releaseLock(lockKey, lockResult.token);
      }
    }
  }

  async heartbeat(dto: ScannerHeartbeatDto) {
    const gateId = BigInt(dto.gateId);
    const gate = await this.prisma.gate.findUnique({ where: { id: gateId } });

    const emergencyStopSetting = await this.prisma.setting.findUnique({
      where: { key: 'emergency_stop' },
    });
    const isEmergencyStopped = emergencyStopSetting?.value === 'true';

    const activeDateSetting = await this.prisma.setting.findUnique({
      where: { key: 'active_event_date' },
    });
    const activeDate = activeDateSetting?.value || this.getTodayIst();

    // Cache scanner last seen in Redis with 15s TTL
    if (dto.deviceId) {
      await this.redis.set(`scanner:heartbeat:${dto.deviceId}`, Date.now().toString(), 15);
    }

    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      activeDate,
      isEmergencyStopped,
      gate: gate
        ? {
            id: gate.id.toString(),
            name: gate.name,
            isOpen: gate.isOpen,
            isScanningPaused: gate.isScanningPaused,
          }
        : null,
    };
  }

  private async recordScanLog(params: {
    attendeeId?: bigint;
    gateId?: bigint;
    scannedById?: bigint | null;
    result: CheckinResult;
    responseTimeMs?: number;
    isLoadTest?: boolean;
    loadTestRunId?: bigint | null;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      await this.prisma.scanLog.create({
        data: {
          attendeeId: params.attendeeId || null,
          gateId: params.gateId || null,
          scannedById: params.scannedById || null,
          result: params.result,
          responseTimeMs: params.responseTimeMs || 0,
          isLoadTest: params.isLoadTest || false,
          loadTestRunId: params.loadTestRunId || null,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
        },
      });
    } catch (e) {
      // Non-blocking log failure
      console.error('Failed to write scan log:', e);
    }
  }

  private async recordSimulationAudit(params: {
    userId?: string | null;
    testEventDate: string;
    gateId: string;
    token: string;
    result: CheckinResult;
    attendeeId?: string | null;
  }) {
    if (!params.userId) return;
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: BigInt(params.userId),
          action: 'SCANNER_TEST_MODE_SCAN',
          details: {
            isSimulation: true,
            testEventDate: params.testEventDate,
            gateId: params.gateId,
            tokenPreview: params.token.length > 8 ? `${params.token.slice(0, 4)}...${params.token.slice(-4)}` : '***',
            result: params.result,
            attendeeId: params.attendeeId || null,
          },
        },
      });
    } catch (e) {
      console.error('Failed to write simulation audit log:', e);
    }
  }
}
