import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { DailyPassPdfService } from '../../registration/daily-pass-pdf.service';
import { CheckinService } from '../../checkin/checkin.service';
import {
  isOfficialEventDate,
  OFFICIAL_EVENT_DATES,
  getEventDayTheme,
  UserRole,
  DailyPassStatus,
  DailyPassEmailStatus,
} from '@ongc/shared-types';
import { resolveBookingDays } from '../../common/utils/attendee-booking.util';
import * as crypto from 'crypto';
import {
  GenerateTestPassDto,
  SendTestEmailDto,
  ScannerTestDto,
} from './employee-daily-pass-test.dto';

@Injectable()
export class EmployeeDailyPassTestService {
  private readonly logger = new Logger(EmployeeDailyPassTestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly dailyPassPdfService: DailyPassPdfService,
    private readonly checkinService: CheckinService,
  ) {}

  /**
   * Search existing real employees for test selection.
   * Strictly reads from existing records; never allows creating fake employees.
   */
  async searchEmployees(search?: string) {
    const where: any = {};

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { cpf: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const employees = await this.prisma.employee.findMany({
      where,
      orderBy: { id: 'desc' },
      take: 25,
      include: {
        familyMembers: true,
        attendees: {
          include: {
            familyMember: true,
          },
        },
      },
    });

    return employees.map((emp) => {
      const empAttendee = emp.attendees.find((a) => a.familyMemberId === null);

      return {
        id: emp.id.toString(),
        cpf: emp.cpf,
        name: emp.name,
        designation: emp.designation,
        department: emp.department,
        email: emp.email,
        phone: emp.phone,
        registrationStatus: emp.registrationStatus,
        bookingDays: resolveBookingDays(empAttendee || emp),
        attendeeId: empAttendee?.id ? empAttendee.id.toString() : null,
        ticketNumber: empAttendee?.ticketNumber || null,
        familyMembers: emp.familyMembers.map((fm) => {
          const fmAttendee = emp.attendees.find((a) => a.familyMemberId === fm.id);
          return {
            id: fm.id.toString(),
            name: fm.name,
            relation: fm.relation,
            attendeeId: fmAttendee?.id ? fmAttendee.id.toString() : null,
            ticketNumber: fmAttendee?.ticketNumber || null,
            bookingDays: fmAttendee ? resolveBookingDays(fmAttendee) : [],
          };
        }),
      };
    });
  }

  /**
   * Generates an isolated test DailyEmployeePass for SUPER_ADMIN testing.
   * Marked with `isTest: true` and an explicit testSessionId.
   */
  async generateTestPass(dto: GenerateTestPassDto, adminUser: any) {
    if (adminUser?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can generate test daily passes.');
    }

    if (!dto.eventDate || !isOfficialEventDate(dto.eventDate)) {
      throw new BadRequestException(
        `Invalid event date: "${dto.eventDate}". Allowed dates: ${OFFICIAL_EVENT_DATES.join(', ')}`,
      );
    }

    const attendeeIdBigInt = BigInt(dto.attendeeId);
    const attendee = await this.prisma.attendee.findUnique({
      where: { id: attendeeIdBigInt },
      include: {
        employee: true,
        familyMember: true,
      },
    });

    if (!attendee) {
      throw new NotFoundException(`Attendee with ID ${dto.attendeeId} not found`);
    }

    // Auto-generate test session ID if not provided
    const sessionId =
      dto.testSessionId?.trim() ||
      `EMP-TEST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto
        .randomBytes(3)
        .toString('hex')
        .toUpperCase()}`;

    // Clean up any prior test pass for this exact attendee, date, and isTest: true
    await this.prisma.dailyEmployeePass.deleteMany({
      where: {
        attendeeId: attendee.id,
        eventDate: dto.eventDate,
        isTest: true,
      },
    });

    // Generate standard 32-byte hex QR token matching production architecture
    const qrToken = crypto.randomBytes(32).toString('hex');

    const pass = await this.prisma.dailyEmployeePass.create({
      data: {
        attendeeId: attendee.id,
        eventDate: dto.eventDate,
        qrToken,
        status: DailyPassStatus.ACTIVE as any,
        emailStatus: DailyPassEmailStatus.PENDING as any,
        isTest: true,
        testSessionId: sessionId,
      },
    });

    const attendeeName =
      attendee.familyMember?.name || attendee.employee?.name || attendee.name || 'Attendee';
    const isFamily = !!attendee.familyMember;
    const passType = isFamily
      ? `Family Member Pass (${attendee.familyMember ? attendee.familyMember.relation : 'Family'})`
      : 'ONGC Employee Pass';
    const dayTheme = getEventDayTheme(dto.eventDate);

    this.logger.log(
      `[TEST_LAB] Generated isolated test pass ${pass.id} for session ${sessionId} (${attendeeName}, ${dto.eventDate})`,
    );

    return {
      testPassId: pass.id.toString(),
      testSessionId: sessionId,
      qrToken: pass.qrToken,
      attendeeId: attendee.id.toString(),
      attendeeName,
      isFamily,
      relation: attendee.familyMember?.relation || 'Self',
      employeeName: attendee.employee?.name || attendeeName,
      employeeCpf: attendee.employee?.cpf || 'N/A',
      department: attendee.employee?.department || 'EWC Ahmedabad',
      passType,
      ticketNumber: attendee.ticketNumber,
      eventDate: pass.eventDate,
      status: pass.status,
      emailStatus: pass.emailStatus,
      dayTheme,
      createdAt: pass.createdAt,
    };
  }

  /**
   * Renders the real email template without sending it.
   */
  async previewEmail(token: string) {
    const pass = await this.prisma.dailyEmployeePass.findUnique({
      where: { qrToken: token.trim() },
      include: {
        attendee: {
          include: {
            employee: true,
            familyMember: true,
          },
        },
      },
    });

    if (!pass) {
      throw new NotFoundException('Daily pass not found');
    }

    const attendee = pass.attendee;
    const attendeeName =
      attendee.familyMember?.name || attendee.employee?.name || attendee.name || 'Attendee';
    const relation = attendee.familyMember ? attendee.familyMember.relation : 'Self';
    const employeeName = attendee.employee?.name || attendeeName;

    return this.mailService.previewEmployeeDailyPassEmail({
      recipientEmail: 'preview@ongcnavratri.reworkzone.in',
      employeeName,
      attendeeName,
      relation,
      eventDate: pass.eventDate,
      ticketNumber: attendee.ticketNumber,
      qrToken: pass.qrToken,
      cpf: attendee.employee?.cpf,
      department: attendee.employee?.department,
    });
  }

  /**
   * Dispatches a test email containing the official ticket preview and PDF attachment
   * strictly to the explicitly provided test recipient address.
   */
  async sendTestEmail(dto: SendTestEmailDto, adminUser: any) {
    if (adminUser?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can send test daily pass emails.');
    }

    const recipient = dto.recipientEmail?.trim();
    if (!recipient || !recipient.includes('@')) {
      throw new BadRequestException('A valid test recipient email address is required.');
    }

    const pass = await this.prisma.dailyEmployeePass.findUnique({
      where: { qrToken: dto.token.trim() },
      include: {
        attendee: {
          include: {
            employee: true,
            familyMember: true,
          },
        },
      },
    });

    if (!pass) {
      throw new NotFoundException('Test pass not found');
    }

    if (!pass.isTest) {
      throw new BadRequestException('Cannot use test email dispatcher on operational passes.');
    }

    const attendee = pass.attendee;
    const attendeeName =
      attendee.familyMember?.name || attendee.employee?.name || attendee.name || 'Attendee';
    const relation = attendee.familyMember ? attendee.familyMember.relation : 'Self';
    const employeeName = attendee.employee?.name || attendeeName;
    const dayTheme = getEventDayTheme(pass.eventDate);

    // Generate exact PDF ticket for attachment using same qrToken
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await this.dailyPassPdfService.generateDailyPassPdf(pass.qrToken);
    } catch (err: any) {
      this.logger.error(`Failed to generate PDF for test pass email: ${err.message}`);
    }

    const testSubject = `[TEST] ONGC Navratri 2026 — Employee Daily Pass — ${dayTheme.fullDateLabel} (${attendeeName})`;

    const result = await this.mailService.sendEmployeeDailyPassEmail({
      recipientEmail: recipient,
      employeeName,
      attendeeName,
      relation,
      eventDate: pass.eventDate,
      ticketNumber: attendee.ticketNumber,
      qrToken: pass.qrToken,
      cpf: attendee.employee?.cpf,
      department: attendee.employee?.department,
      pdfBuffer,
      subjectOverride: testSubject,
    });

    if (result.success) {
      await this.prisma.dailyEmployeePass.update({
        where: { id: pass.id },
        data: {
          emailStatus: DailyPassEmailStatus.SENT as any,
          emailSentAt: new Date(),
          emailError: null,
        },
      });
    } else {
      await this.prisma.dailyEmployeePass.update({
        where: { id: pass.id },
        data: {
          emailStatus: DailyPassEmailStatus.FAILED as any,
          emailError: result.error || 'Test email delivery failed',
        },
      });
    }

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      emailStatus: result.success ? 'SENT' : 'FAILED',
      sentTo: recipient,
      subject: testSubject,
    };
  }

  /**
   * Retries sending the test email.
   */
  async retryTestEmail(dto: SendTestEmailDto, adminUser: any) {
    return this.sendTestEmail(dto, adminUser);
  }

  /**
   * Executes scanner validation using the real CheckinService checkin pipeline.
   * Exercises valid scan, duplicate scan, and wrong-date scan.
   */
  async testScan(
    dto: ScannerTestDto,
    adminUser: any,
    reqMeta?: { ip?: string; userAgent?: string },
  ) {
    if (adminUser?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can run scanner test validations.');
    }

    const pass = await this.prisma.dailyEmployeePass.findUnique({
      where: { qrToken: dto.token.trim() },
      include: {
        attendee: true,
      },
    });

    if (!pass) {
      throw new NotFoundException('Test pass not found');
    }

    // Resolve Gate ID (use provided or fallback to first gate)
    let gateId = dto.gateId;
    if (!gateId) {
      const firstGate = await this.prisma.gate.findFirst({
        where: { isOpen: true },
        orderBy: { id: 'asc' },
      });
      gateId = firstGate ? Number(firstGate.id) : 1;
    }

    const scanDate = dto.scanDate?.trim() || pass.eventDate;

    this.logger.log(
      `[TEST_LAB] Simulating scanner check-in for test pass ${pass.id} on simulated date ${scanDate} at Gate ${gateId}`,
    );

    // Call real CheckinService processCheckin pipeline with SUPER_ADMIN context and isLoadTest: true
    const checkinResponse = await this.checkinService.processCheckin(
      {
        token: pass.qrToken,
        gateId: String(gateId),
        testDate: scanDate,
        isLoadTest: true,
      },
      {
        id: String(adminUser.id),
        role: UserRole.SUPER_ADMIN,
      },
      {
        ip: reqMeta?.ip || '127.0.0.1',
        userAgent: `[TEST_LAB_SIMULATION] ${reqMeta?.userAgent || 'Antigravity'}`,
      },
    );

    // Refresh pass to get updated status after scan
    const updatedPass = await this.prisma.dailyEmployeePass.findUnique({
      where: { id: pass.id },
    });

    return {
      scannerResponse: checkinResponse,
      passStatus: updatedPass?.status,
      checkedInAt: updatedPass?.checkedInAt,
      simulatedScanDate: scanDate,
      passEventDate: pass.eventDate,
      gateId,
    };
  }

  /**
   * Revokes a test pass to allow testing REVOKED scanner validation.
   */
  async revokeTestPass(token: string, adminUser: any) {
    if (adminUser?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can revoke test passes.');
    }

    const pass = await this.prisma.dailyEmployeePass.findUnique({
      where: { qrToken: token.trim() },
    });

    if (!pass) {
      throw new NotFoundException('Test pass not found');
    }

    if (!pass.isTest) {
      throw new BadRequestException('Cannot revoke an operational pass via Test Lab.');
    }

    const updated = await this.prisma.dailyEmployeePass.update({
      where: { id: pass.id },
      data: { status: DailyPassStatus.REVOKED as any },
    });

    return {
      success: true,
      status: updated.status,
      token: updated.qrToken,
    };
  }

  /**
   * Cleans up all test data belonging to a specific test session.
   * Deletes only records where `isTest: true` / `isLoadTest: true`.
   */
  async cleanupTestSession(sessionId: string, adminUser: any) {
    if (adminUser?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can cleanup test sessions.');
    }

    if (!sessionId || !sessionId.trim()) {
      throw new BadRequestException('Test session ID is required.');
    }

    const cleanSessionId = sessionId.trim();

    // 1. Find all test passes for this session
    const testPasses = await this.prisma.dailyEmployeePass.findMany({
      where: {
        testSessionId: cleanSessionId,
        isTest: true,
      },
    });

    const attendeeIds = testPasses.map((p) => p.attendeeId);

    // 2. Delete test scan logs and daily checkins for these attendees
    let deletedLogs = 0;
    let deletedCheckins = 0;
    if (attendeeIds.length > 0) {
      const logsResult = await this.prisma.scanLog.deleteMany({
        where: {
          attendeeId: { in: attendeeIds },
          isLoadTest: true,
        },
      });
      deletedLogs = logsResult.count;

      const checkinsResult = await this.prisma.dailyCheckin.deleteMany({
        where: {
          attendeeId: { in: attendeeIds },
          isLoadTest: true,
        },
      });
      deletedCheckins = checkinsResult.count;
    }

    // 3. Delete the test daily employee passes
    const passesResult = await this.prisma.dailyEmployeePass.deleteMany({
      where: {
        testSessionId: cleanSessionId,
        isTest: true,
      },
    });

    this.logger.log(
      `[TEST_LAB] Cleaned up session ${cleanSessionId}: ${passesResult.count} passes, ${deletedCheckins} checkins, ${deletedLogs} scan logs.`,
    );

    return {
      success: true,
      sessionId: cleanSessionId,
      deletedPassesCount: passesResult.count,
      deletedCheckinsCount: deletedCheckins,
      deletedLogsCount: deletedLogs,
    };
  }

  /**
   * Cleans up ALL test lab passes and simulated checkins.
   * SUPER_ADMIN only. Requires explicit confirmation.
   * Never deletes real employee records or real operational passes.
   */
  async cleanupAllTestData(confirm: boolean, adminUser: any) {
    if (adminUser?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can cleanup all test data.');
    }

    if (!confirm) {
      throw new BadRequestException('Explicit confirmation is required to delete all test lab data.');
    }

    // 1. Delete all test daily passes
    const passesResult = await this.prisma.dailyEmployeePass.deleteMany({
      where: { isTest: true },
    });

    // 2. Delete simulated checkins and scan logs
    const checkinsResult = await this.prisma.dailyCheckin.deleteMany({
      where: { isLoadTest: true },
    });

    const logsResult = await this.prisma.scanLog.deleteMany({
      where: { isLoadTest: true },
    });

    this.logger.log(
      `[TEST_LAB] Cleaned up ALL test data: ${passesResult.count} test passes, ${checkinsResult.count} test checkins, ${logsResult.count} test scan logs.`,
    );

    return {
      success: true,
      deletedPassesCount: passesResult.count,
      deletedCheckinsCount: checkinsResult.count,
      deletedLogsCount: logsResult.count,
    };
  }

  /**
   * Retrieves active test passes generated in the test lab.
   */
  async getRecentTestPasses(adminUser: any) {
    if (adminUser?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can view test lab passes.');
    }

    const passes = await this.prisma.dailyEmployeePass.findMany({
      where: { isTest: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        attendee: {
          include: {
            employee: true,
            familyMember: true,
          },
        },
      },
    });

    return passes.map((p) => {
      const attendee = p.attendee;
      const attendeeName =
        attendee.familyMember?.name || attendee.employee?.name || attendee.name || 'Attendee';
      const isFamily = !!attendee.familyMember;
      const passType = isFamily
        ? `Family Member Pass (${attendee.familyMember ? attendee.familyMember.relation : 'Family'})`
        : 'ONGC Employee Pass';
      const dayTheme = getEventDayTheme(p.eventDate);

      return {
        id: p.id.toString(),
        testSessionId: p.testSessionId,
        qrToken: p.qrToken,
        attendeeName,
        isFamily,
        relation: attendee.familyMember?.relation || 'Self',
        employeeName: attendee.employee?.name || attendeeName,
        employeeCpf: attendee.employee?.cpf || 'N/A',
        passType,
        ticketNumber: attendee.ticketNumber,
        eventDate: p.eventDate,
        status: p.status,
        emailStatus: p.emailStatus,
        checkedInAt: p.checkedInAt,
        dayTheme,
        createdAt: p.createdAt,
      };
    });
  }
}
