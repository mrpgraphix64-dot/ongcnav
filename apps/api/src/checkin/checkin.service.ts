import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ProcessCheckinDto, ScannerHeartbeatDto } from './dto/checkin.dto';
import {
  CheckinResult,
  CheckinStatus,
  AttendeeStatus,
  GateType,
  UserRole,
} from '@ongc/shared-types';

@Injectable()
export class CheckinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private getTodayIst(): string {
    const now = new Date();
    const istString = now.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    }); // returns YYYY-MM-DD
    return istString;
  }

  async processCheckin(
    dto: ProcessCheckinDto,
    scannedByUser?: { id: string; role: UserRole },
    reqMeta?: { ip?: string; userAgent?: string },
  ) {
    const startTime = Date.now();
    const token = dto.token.trim();
    const gateId = BigInt(dto.gateId);
    const isLoadTest = !!dto.isLoadTest;
    const loadTestRunId = dto.loadTestRunId ? BigInt(dto.loadTestRunId) : null;

    // 1. Emergency Stop Check
    const emergencyStopSetting = await this.prisma.setting.findUnique({
      where: { key: 'emergency_stop' },
    });
    if (emergencyStopSetting && emergencyStopSetting.value === 'true') {
      const reasonSetting = await this.prisma.setting.findUnique({
        where: { key: 'emergency_stop_reason' },
      });
      const reason = reasonSetting?.value || 'Emergency stop is active across all gates';

      await this.recordScanLog({
        gateId,
        scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
        result: CheckinResult.EVENT_CLOSED,
        responseTimeMs: Date.now() - startTime,
        isLoadTest,
        loadTestRunId,
        ipAddress: reqMeta?.ip,
        userAgent: reqMeta?.userAgent,
      });

      return {
        success: false,
        result: CheckinResult.EVENT_CLOSED,
        message: reason,
        statusCode: 403,
      };
    }

    // 2. Active Event Date
    const activeDateSetting = await this.prisma.setting.findUnique({
      where: { key: 'active_event_date' },
    });
    const activeDate = activeDateSetting?.value || this.getTodayIst();

    // 3. Gate Verification
    const gate = await this.prisma.gate.findUnique({ where: { id: gateId } });
    if (!gate) {
      return {
        success: false,
        result: CheckinResult.GATE_CLOSED,
        message: `Gate with ID ${dto.gateId} not found`,
        statusCode: 404,
      };
    }

    if (!gate.isOpen) {
      return {
        success: false,
        result: CheckinResult.GATE_CLOSED,
        message: `Gate ${gate.name} is currently closed`,
        statusCode: 403,
      };
    }

    if (gate.isScanningPaused) {
      return {
        success: false,
        result: CheckinResult.SCANNING_PAUSED,
        message: `Scanning at Gate ${gate.name} is currently paused`,
        statusCode: 403,
      };
    }

    // 4. Operator Gate Authorization Check
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
        return {
          success: false,
          result: CheckinResult.UNAUTHORIZED_GATE,
          message: `You are not assigned to operate Gate ${gate.name}`,
          statusCode: 403,
        };
      }
    }

    // 5. Gate Capacity Check
    if (gate.totalCapacity) {
      const todayTotal = await this.prisma.dailyCheckin.count({
        where: {
          gateId: gate.id,
          eventDate: activeDate,
          isLoadTest: false,
        },
      });

      if (todayTotal >= gate.totalCapacity) {
        return {
          success: false,
          result: CheckinResult.GATE_FULL,
          message: `Gate ${gate.name} has reached its total capacity for today (${gate.totalCapacity})`,
          statusCode: 403,
        };
      }
    }

    // 6. Token Lookup
    const attendee = await this.prisma.attendee.findFirst({
      where: {
        OR: [{ qrCodeToken: token }, { ticketNumber: token }],
      },
      include: {
        employee: true,
        familyMember: true,
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
        ipAddress: reqMeta?.ip,
        userAgent: reqMeta?.userAgent,
      });

      return {
        success: false,
        result: CheckinResult.INVALID_QR,
        message: 'Invalid or unrecognized QR Code ticket',
        statusCode: 400,
      };
    }

    // 7. Attendee Status Check
    if (String(attendee.status).toUpperCase() !== 'ACTIVE') {
      return {
        success: false,
        result: CheckinResult.INVALID_QR,
        message: `This pass is currently ${attendee.status}`,
        statusCode: 403,
      };
    }

    // 8. Event Date Booking Check (for Employee-linked passes)
    if (attendee.employee) {
      const bookingDays = Array.isArray(attendee.employee.bookingDays)
        ? (attendee.employee.bookingDays as string[])
        : [];
      if (!bookingDays.includes(activeDate)) {
        await this.recordScanLog({
          attendeeId: attendee.id,
          gateId,
          scannedById: scannedByUser ? BigInt(scannedByUser.id) : null,
          result: CheckinResult.NOT_BOOKED_TODAY,
          responseTimeMs: Date.now() - startTime,
          isLoadTest,
          loadTestRunId,
          ipAddress: reqMeta?.ip,
          userAgent: reqMeta?.userAgent,
        });

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
    const lockKey = `lock:checkin:${attendee.id.toString()}:${activeDate}`;
    const lockAcquired = await this.redis.acquireLock(lockKey, 5000);

    if (!lockAcquired) {
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
          const existingCheckin = await tx.dailyCheckin.findFirst({
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

          // Create the Checkin
          const newCheckin = await tx.dailyCheckin.create({
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
          ipAddress: reqMeta?.ip,
          userAgent: reqMeta?.userAgent,
        });

        const timeStr = new Date(prev.checkinTime).toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        return {
          success: false,
          result: CheckinResult.ALREADY_CHECKED_IN,
          message: `Already checked in at ${timeStr} (Gate: ${prev.gate?.name || 'Gate ' + prev.gateId})`,
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
        ipAddress: reqMeta?.ip,
        userAgent: reqMeta?.userAgent,
      });

      const isFamily = !!attendee.familyMemberId;
      const attendeeName = isFamily ? attendee.familyMember?.name : (attendee.employee?.name || attendee.name || 'Attendee');

      return {
        success: true,
        result: CheckinResult.SUCCESS,
        message: 'Check-in successful',
        statusCode: 200,
        data: {
          checkinId: checkinResult.newCheckin?.id.toString(),
          ticketNumber: attendee.ticketNumber,
          attendeeName,
          isFamily,
          relation: attendee.familyMember?.relation || (attendee.employee ? 'Primary Employee' : 'Standalone Attendee'),
          employee: attendee.employee
            ? {
                id: attendee.employee.id.toString(),
                cpf: attendee.employee.cpf,
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
          ipAddress: reqMeta?.ip,
          userAgent: reqMeta?.userAgent,
        });

        return {
          success: false,
          result: CheckinResult.ALREADY_CHECKED_IN,
          message: 'Already checked in for today',
          statusCode: 409,
        };
      }

      throw err;
    } finally {
      await this.redis.releaseLock(lockKey);
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
}
