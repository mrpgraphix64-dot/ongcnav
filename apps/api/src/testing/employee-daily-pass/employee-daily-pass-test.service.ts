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
  RegistrationStatus,
  DEFAULT_DISPATCH_SCHEDULE,
  buildDailyEmployeePassPresentation,
  DailyEmployeePassPresentation,
} from '@ongc/shared-types';
import { resolveBookingDays } from '../../common/utils/attendee-booking.util';
import * as crypto from 'crypto';
import {
  GenerateTestPassDto,
  SendTestEmailDto,
  ScannerTestDto,
  DispatchScheduleCheckDto,
  SimulateDeliveryDto,
  SimulateWindowDto,
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
   * Resolves the configured dispatch schedule from the production system configuration.
   * Checks database settings first ('employee.dispatch_schedule', 'qr.dispatch_schedule', 'dispatch_schedule');
   * falls back to DEFAULT_DISPATCH_SCHEDULE.
   */
  async getEffectiveDispatchSchedule(): Promise<Record<string, string>> {
    let scheduleMap: Record<string, string> = { ...DEFAULT_DISPATCH_SCHEDULE };

    try {
      const setting = await this.prisma.setting.findFirst({
        where: {
          key: {
            in: [
              'employee.dispatch_schedule',
              'qr.dispatch_schedule',
              'dispatch_schedule',
            ],
          },
        },
      });

      if (setting?.value) {
        const parsed = JSON.parse(setting.value);
        if (typeof parsed === 'object' && parsed !== null) {
          scheduleMap = { ...scheduleMap, ...parsed };
        }
      }

      // Also check any individual per-date schedule settings
      const perDateSettings = await this.prisma.setting.findMany({
        where: {
          key: {
            startsWith: 'employee.dispatch_schedule.',
          },
        },
      });

      for (const p of perDateSettings) {
        try {
          const parsed = JSON.parse(p.value);
          if (parsed?.eventDate && parsed?.dispatchTime) {
            scheduleMap[parsed.eventDate] = parsed.dispatchTime;
          }
        } catch {}
      }
    } catch {
      // In case of error, gracefully fallback
    }

    return scheduleMap;
  }

  /**
   * Search existing real employees for test selection.
   * Strictly reads from existing records; never allows creating fake employees.
   * Only returns APPROVED employee registrations.
   */
  async searchEmployees(search?: string) {
    const where: any = {
      registrationStatus: RegistrationStatus.APPROVED,
    };

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

    // Auto-generate test session ID if not provided
    const sessionId =
      dto.testSessionId?.trim() ||
      `EMP-TEST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto
        .randomBytes(3)
        .toString('hex')
        .toUpperCase()}`;

    // 1. Single attendee mode (full backward compatibility with existing tests and flows)
    if (
      dto.attendeeId &&
      (!dto.employeeIds || dto.employeeIds.length === 0) &&
      (!dto.attendeeIds || dto.attendeeIds.length === 0)
    ) {
      const attendeeIdBigInt = BigInt(dto.attendeeId);
      const attendee = await this.prisma.attendee.findUnique({
        where: { id: attendeeIdBigInt },
        include: {
          employee: true,
          familyMember: {
            include: {
              employee: true,
            },
          },
        },
      });

      if (!attendee) {
        throw new NotFoundException(`Attendee with ID ${dto.attendeeId} not found`);
      }

      const bookingDays = resolveBookingDays(attendee);
      if (!bookingDays.includes(dto.eventDate)) {
        throw new BadRequestException(
          `Attendee ${attendee.id} did not select event date ${dto.eventDate}.`,
        );
      }

      // Clean up any prior test pass for this exact attendee, date, and isTest: true
      await this.prisma.dailyEmployeePass.deleteMany({
        where: {
          attendeeId: attendee.id,
          eventDate: dto.eventDate,
          isTest: true,
        },
      });

      // Also clean up any prior test checkin so scanner starts fresh in ACTIVE state
      await this.prisma.dailyCheckin.deleteMany({
        where: {
          attendeeId: attendee.id,
          eventDate: dto.eventDate,
          isLoadTest: true,
        },
      });

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

      const primaryEmployee = attendee.familyMember?.employee || attendee.employee;
      const attendeeName =
        attendee.familyMember?.name || primaryEmployee?.name || attendee.name || 'Attendee';
      const isFamily = !!attendee.familyMember;
      const relation = attendee.familyMember?.relation || 'Self';
      const employeeName = primaryEmployee?.name || attendeeName;
      const employeeCpf = primaryEmployee?.cpf || 'N/A';
      const department = primaryEmployee?.department || 'EWC Ahmedabad';
      const passType = isFamily
        ? (relation && relation.toLowerCase() !== 'family member' ? `Family Member Pass (${relation})` : 'Family Member Pass')
        : 'ONGC Employee Pass';
      const dayTheme = getEventDayTheme(dto.eventDate);

      const presentation: DailyEmployeePassPresentation = buildDailyEmployeePassPresentation({
        eventDate: pass.eventDate,
        ticketNumber: attendee.ticketNumber,
        qrToken: pass.qrToken,
        status: pass.status,
        attendeeName,
        isFamily,
        relation,
        employeeName,
        employeeCpf,
        department,
      });

      const singlePass = {
        testPassId: pass.id.toString(),
        testSessionId: sessionId,
        qrToken: pass.qrToken,
        attendeeId: attendee.id.toString(),
        attendeeName,
        isFamily,
        relation,
        employeeName,
        employeeCpf,
        department,
        passType,
        ticketNumber: attendee.ticketNumber,
        eventDate: pass.eventDate,
        status: pass.status,
        emailStatus: pass.emailStatus,
        dayTheme,
        presentation,
        createdAt: pass.createdAt,
      };

      return {
        ...singlePass,
        passes: [singlePass],
        ineligible: [],
        totalEmployees: 1,
        totalSelectedPeople: 1,
        totalEligible: 1,
        totalPasses: 1,
        newlyGeneratedCount: 1,
        existingCount: 0,
        testSessionId: sessionId,
      };
    }

    // 2. Multi-Employee / Batch Attendee Mode
    let targetAttendees: any[] = [];
    let totalEmployees = 1;

    if (dto.employeeIds && dto.employeeIds.length > 0) {
      const empIds = dto.employeeIds.map((id) => BigInt(id));
      const employees = await this.prisma.employee.findMany({
        where: { id: { in: empIds } },
        include: {
          familyMembers: true,
          attendees: {
            include: {
              employee: true,
              familyMember: {
                include: {
                  employee: true,
                },
              },
            },
          },
        },
      });

      totalEmployees = employees.length;
      for (const emp of employees) {
        for (const att of emp.attendees) {
          targetAttendees.push(att);
        }
      }
    } else if (dto.attendeeIds && dto.attendeeIds.length > 0) {
      const attIds = dto.attendeeIds.map((id) => BigInt(id));
      targetAttendees = await this.prisma.attendee.findMany({
        where: { id: { in: attIds } },
        include: {
          employee: true,
          familyMember: {
            include: {
              employee: true,
            },
          },
        },
      });
    } else {
      throw new BadRequestException('Either employeeIds, attendeeIds, or attendeeId must be provided.');
    }

    if (targetAttendees.length === 0) {
      throw new NotFoundException('No attendees found for the specified selection.');
    }

    // Filter attendees into eligible and ineligible for this specific event date
    const eligibleAttendees: any[] = [];
    const ineligibleAttendees: any[] = [];

    for (const att of targetAttendees) {
      const bookingDays = resolveBookingDays(att);
      const primaryEmployee = att.familyMember?.employee || att.employee;
      const attendeeName =
        att.familyMember?.name || primaryEmployee?.name || att.name || 'Attendee';
      const isFamily = !!att.familyMember;
      const relation = att.familyMember?.relation || 'Self';
      const employeeName = primaryEmployee?.name || attendeeName;
      const employeeCpf = primaryEmployee?.cpf || 'N/A';
      const department = primaryEmployee?.department || 'EWC Ahmedabad';

      if (bookingDays.includes(dto.eventDate)) {
        eligibleAttendees.push(att);
      } else {
        ineligibleAttendees.push({
          attendeeId: att.id.toString(),
          attendeeName,
          isFamily,
          relation,
          employeeName,
          employeeCpf,
          department,
          reason: 'Did not select this date',
          selectedDates: bookingDays,
        });
      }
    }

    const resultPasses: any[] = [];
    let newlyGeneratedCount = 0;
    let existingCount = 0;

    for (const attendee of eligibleAttendees) {
      // Idempotency check: Reuse existing test pass if already generated for this attendee, date, and isTest: true
      const existingPass = await this.prisma.dailyEmployeePass.findFirst({
        where: {
          attendeeId: attendee.id,
          eventDate: dto.eventDate,
          isTest: true,
        },
      });

      let pass = existingPass;
      if (pass) {
        // Reset pass to ACTIVE and clear checkedInAt if it was scanned in a previous test run
        if (pass.status !== DailyPassStatus.ACTIVE || pass.checkedInAt) {
          pass = await this.prisma.dailyEmployeePass.update({
            where: { id: pass.id },
            data: {
              status: DailyPassStatus.ACTIVE as any,
              checkedInAt: null,
              testSessionId: sessionId,
            },
          });
          // Clean up prior test checkin for this test pass so scanner starts fresh
          await this.prisma.dailyCheckin.deleteMany({
            where: {
              attendeeId: attendee.id,
              eventDate: dto.eventDate,
              isLoadTest: true,
            },
          });
        }
        existingCount++;
      } else {
        const qrToken = crypto.randomBytes(32).toString('hex');
        pass = await this.prisma.dailyEmployeePass.create({
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
        newlyGeneratedCount++;
      }

      const primaryEmployee = attendee.familyMember?.employee || attendee.employee;
      const attendeeName =
        attendee.familyMember?.name || primaryEmployee?.name || attendee.name || 'Attendee';
      const isFamily = !!attendee.familyMember;
      const relation = attendee.familyMember?.relation || 'Self';
      const employeeName = primaryEmployee?.name || attendeeName;
      const employeeCpf = primaryEmployee?.cpf || 'N/A';
      const department = primaryEmployee?.department || 'EWC Ahmedabad';
      const passType = isFamily
        ? (relation && relation.toLowerCase() !== 'family member' ? `Family Member Pass (${relation})` : 'Family Member Pass')
        : 'ONGC Employee Pass';
      const dayTheme = getEventDayTheme(dto.eventDate);

      const presentation: DailyEmployeePassPresentation = buildDailyEmployeePassPresentation({
        eventDate: pass.eventDate,
        ticketNumber: attendee.ticketNumber,
        qrToken: pass.qrToken,
        status: pass.status,
        attendeeName,
        isFamily,
        relation,
        employeeName,
        employeeCpf,
        department,
      });

      resultPasses.push({
        testPassId: pass.id.toString(),
        testSessionId: sessionId,
        qrToken: pass.qrToken,
        attendeeId: attendee.id.toString(),
        attendeeName,
        isFamily,
        relation,
        employeeName,
        employeeCpf,
        department,
        passType,
        ticketNumber: attendee.ticketNumber,
        eventDate: pass.eventDate,
        status: pass.status,
        emailStatus: pass.emailStatus,
        dayTheme,
        presentation,
        createdAt: pass.createdAt,
      });
    }

    this.logger.log(
      `[TEST_LAB] Processed ${resultPasses.length} eligible test passes for session ${sessionId} (${newlyGeneratedCount} new, ${existingCount} reused, ${ineligibleAttendees.length} not registered) on ${dto.eventDate}`,
    );

    const firstPass = resultPasses[0] || {};
    return {
      ...firstPass,
      passes: resultPasses,
      ineligible: ineligibleAttendees,
      totalEmployees,
      totalSelectedPeople: targetAttendees.length,
      totalEligible: eligibleAttendees.length,
      totalPasses: resultPasses.length,
      newlyGeneratedCount,
      existingCount,
      testSessionId: sessionId,
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
            familyMember: {
              include: {
                employee: true,
              },
            },
          },
        },
      },
    });

    if (!pass) {
      throw new NotFoundException('Daily pass not found');
    }

    const attendee = pass.attendee;
    const primaryEmployee = attendee.familyMember?.employee || attendee.employee;
    const attendeeName =
      attendee.familyMember?.name || primaryEmployee?.name || attendee.name || 'Attendee';
    const relation = attendee.familyMember ? attendee.familyMember.relation : 'Self';
    const employeeName = primaryEmployee?.name || attendeeName;

    return this.mailService.previewEmployeeDailyPassEmail({
      recipientEmail: 'preview@ongcnavratri.reworkzone.in',
      employeeName,
      attendeeName,
      relation,
      eventDate: pass.eventDate,
      ticketNumber: attendee.ticketNumber,
      qrToken: pass.qrToken,
      cpf: primaryEmployee?.cpf,
      department: primaryEmployee?.department,
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
            familyMember: {
              include: {
                employee: true,
              },
            },
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
    const primaryEmployee = attendee.familyMember?.employee || attendee.employee;
    const attendeeName =
      attendee.familyMember?.name || primaryEmployee?.name || attendee.name || 'Attendee';
    const relation = attendee.familyMember ? attendee.familyMember.relation : 'Self';
    const employeeName = primaryEmployee?.name || attendeeName;
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
      cpf: primaryEmployee?.cpf,
      department: primaryEmployee?.department,
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
   * Resets a test pass and its simulated scanner checkin state back to ACTIVE.
   * Cleans up any test checkin or test scan logs for this test pass.
   * Operates strictly on isTest: true passes.
   */
  async resetScannerState(token: string, adminUser: any) {
    if (adminUser?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can reset test scanner state.');
    }

    if (!token || !token.trim()) {
      throw new BadRequestException('QR token is required to reset scanner state.');
    }

    const pass = await this.prisma.dailyEmployeePass.findUnique({
      where: { qrToken: token.trim() },
    });

    if (!pass) {
      throw new NotFoundException('Test pass not found');
    }

    if (!pass.isTest) {
      throw new BadRequestException('Cannot reset an operational pass via Test Lab.');
    }

    // 1. Reset pass status to ACTIVE and nullify checkedInAt
    const updated = await this.prisma.dailyEmployeePass.update({
      where: { id: pass.id },
      data: {
        status: DailyPassStatus.ACTIVE as any,
        checkedInAt: null,
      },
    });

    // 2. Remove test checkins and test scan logs for this attendee on this date
    const checkinDel = await this.prisma.dailyCheckin.deleteMany({
      where: {
        attendeeId: pass.attendeeId,
        eventDate: pass.eventDate,
        isLoadTest: true,
      },
    });

    const scanLogDel = await this.prisma.scanLog.deleteMany({
      where: {
        attendeeId: pass.attendeeId,
        isLoadTest: true,
      },
    });

    this.logger.log(
      `[TEST_LAB] Reset scanner state for test pass ${pass.id} (${pass.qrToken}): status ACTIVE, ${checkinDel.count} checkins deleted, ${scanLogDel.count} scan logs deleted.`,
    );

    return {
      success: true,
      status: updated.status,
      checkedInAt: updated.checkedInAt,
      token: updated.qrToken,
      deletedCheckinsCount: checkinDel.count,
      deletedScanLogsCount: scanLogDel.count,
      message: 'Test pass and scanner state reset to ACTIVE (test data only).',
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
   * If testSessionId is provided, restricts results strictly to the specified session.
   */
  async getRecentTestPasses(adminUser: any, testSessionId?: string) {
    if (adminUser?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can view test lab passes.');
    }

    const where: any = { isTest: true };
    if (testSessionId && testSessionId.trim()) {
      where.testSessionId = testSessionId.trim();
    }

    const passes = await this.prisma.dailyEmployeePass.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        attendee: {
          include: {
            employee: true,
            familyMember: {
              include: {
                employee: true,
              },
            },
          },
        },
      },
    });

    return passes.map((p) => {
      const attendee = p.attendee;
      const primaryEmployee = attendee.familyMember?.employee || attendee.employee;
      const attendeeName =
        attendee.familyMember?.name || primaryEmployee?.name || attendee.name || 'Attendee';
      const isFamily = !!attendee.familyMember;
      const relation = attendee.familyMember ? attendee.familyMember.relation : 'Self';
      const employeeName = primaryEmployee?.name || attendeeName;
      const employeeCpf = primaryEmployee?.cpf || 'N/A';
      const department = primaryEmployee?.department || 'EWC Ahmedabad';
      const passType = isFamily
        ? (relation && relation.toLowerCase() !== 'family member' ? `Family Member Pass (${relation})` : 'Family Member Pass')
        : 'ONGC Employee Pass';
      const dayTheme = getEventDayTheme(p.eventDate);

      const presentation: DailyEmployeePassPresentation = buildDailyEmployeePassPresentation({
        eventDate: p.eventDate,
        ticketNumber: attendee.ticketNumber,
        qrToken: p.qrToken,
        status: p.status,
        attendeeName,
        isFamily,
        relation,
        employeeName,
        employeeCpf,
        department,
      });

      return {
        id: p.id.toString(),
        testSessionId: p.testSessionId,
        qrToken: p.qrToken,
        attendeeName,
        isFamily,
        relation,
        employeeName,
        employeeCpf,
        department,
        passType,
        ticketNumber: attendee.ticketNumber,
        eventDate: p.eventDate,
        status: p.status,
        emailStatus: p.emailStatus,
        checkedInAt: p.checkedInAt,
        dayTheme,
        presentation,
        createdAt: p.createdAt,
      };
    });
  }

  /**
   * Evaluates simulated clock against configured daily dispatch schedule.
   * Super Admin only.
   * If simulatedDateTime >= configuredDispatchTime:
   *   Generates isolated test DailyEmployeePass (idempotently).
   *   Optionally sends test email to safe recipient (idempotently).
   */
  async checkAndRunSimulatedDispatch(dto: DispatchScheduleCheckDto, adminUser: any) {
    if (adminUser?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can run dispatch checks.');
    }

    if (!dto.simulatedDate || !isOfficialEventDate(dto.simulatedDate)) {
      throw new BadRequestException(
        `Invalid simulated date: "${dto.simulatedDate}". Allowed dates: ${OFFICIAL_EVENT_DATES.join(', ')}`,
      );
    }

    const simulatedTime = (dto.simulatedTime || '18:00').trim();
    const effectiveSchedule = await this.getEffectiveDispatchSchedule();
    const configuredDispatchTime = (
      dto.configuredDispatchTime?.trim() ||
      effectiveSchedule[dto.simulatedDate] ||
      DEFAULT_DISPATCH_SCHEDULE[dto.simulatedDate] ||
      '18:00'
    ).trim();

    // Parse HH:mm to minutes for comparison
    const [simH, simM] = simulatedTime.split(':').map((v) => parseInt(v, 10) || 0);
    const [cfgH, cfgM] = configuredDispatchTime.split(':').map((v) => parseInt(v, 10) || 0);

    const simTotalMinutes = simH * 60 + simM;
    const cfgTotalMinutes = cfgH * 60 + cfgM;

    const isDue = simTotalMinutes >= cfgTotalMinutes;

    if (!isDue) {
      return {
        success: true,
        isDue: false,
        status: 'NOT_DUE',
        simulatedDate: dto.simulatedDate,
        simulatedTime,
        configuredDispatchTime,
        message: `NOT DUE: Configured dispatch time is ${configuredDispatchTime}, but simulated time is ${simulatedTime}. Delivery check does not trigger pass generation.`,
      };
    }

    // It IS DUE!
    let generatedPass: any = null;
    let alreadyDispatched = false;
    let emailStatus: string = 'PENDING';
    let message = `DUE: Simulated time ${simulatedTime} has reached or exceeded configured dispatch time ${configuredDispatchTime}.`;

    if (dto.attendeeId) {
      const attendeeIdBigInt = BigInt(dto.attendeeId);
      const attendee = await this.prisma.attendee.findUnique({
        where: { id: attendeeIdBigInt },
        include: {
          employee: true,
          familyMember: {
            include: {
              employee: true,
            },
          },
        },
      });

      if (!attendee) {
        throw new NotFoundException(`Attendee ${dto.attendeeId} not found`);
      }

      // Check if test pass already exists for this attendee and this eventDate
      const existingPass = await this.prisma.dailyEmployeePass.findFirst({
        where: {
          attendeeId: attendee.id,
          eventDate: dto.simulatedDate,
          isTest: true,
        },
      });

      const sessionId =
        dto.testSessionId?.trim() ||
        `EMP-SIM-${dto.simulatedDate.replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      if (existingPass) {
        // Idempotency: Do NOT recreate DailyEmployeePass record
        alreadyDispatched = existingPass.emailStatus === DailyPassEmailStatus.SENT;
        emailStatus = existingPass.emailStatus;

        if (alreadyDispatched) {
          message += ` Pass was already generated (${existingPass.qrToken.substring(0, 10)}...) and email was already sent. Idempotency preserved (0 duplicate passes created).`;
        } else if (dto.testRecipientEmail) {
          const emailRes = await this.sendTestEmail(
            { token: existingPass.qrToken, recipientEmail: dto.testRecipientEmail },
            adminUser,
          );
          emailStatus = emailRes.emailStatus;
          message += ` Existing pass reused. Test email dispatched to ${dto.testRecipientEmail}.`;
        } else {
          message += ` Existing pass reused.`;
        }

        const primaryEmployee = attendee.familyMember?.employee || attendee.employee;
        const attendeeName =
          attendee.familyMember?.name || primaryEmployee?.name || attendee.name || 'Attendee';
        const isFamily = !!attendee.familyMember;
        const relation = attendee.familyMember?.relation || 'Self';
        const employeeName = primaryEmployee?.name || attendeeName;
        const employeeCpf = primaryEmployee?.cpf || 'N/A';
        const department = primaryEmployee?.department || 'EWC Ahmedabad';
        const passType = isFamily
          ? (relation && relation.toLowerCase() !== 'family member' ? `Family Member Pass (${relation})` : 'Family Member Pass')
          : 'ONGC Employee Pass';
        const dayTheme = getEventDayTheme(dto.simulatedDate);
        const presentation = buildDailyEmployeePassPresentation({
          eventDate: existingPass.eventDate,
          ticketNumber: attendee.ticketNumber,
          qrToken: existingPass.qrToken,
          status: existingPass.status,
          attendeeName,
          isFamily,
          relation,
          employeeName,
          employeeCpf,
          department,
        });

        generatedPass = {
          testPassId: existingPass.id.toString(),
          testSessionId: existingPass.testSessionId || sessionId,
          qrToken: existingPass.qrToken,
          attendeeId: attendee.id.toString(),
          attendeeName,
          isFamily,
          relation,
          employeeName,
          employeeCpf,
          department,
          passType,
          ticketNumber: attendee.ticketNumber,
          eventDate: existingPass.eventDate,
          status: existingPass.status,
          emailStatus,
          dayTheme,
          presentation,
          createdAt: existingPass.createdAt,
        };
      } else {
        // Generate new isolated test pass
        const qrToken = crypto.randomBytes(32).toString('hex');
        const newPass = await this.prisma.dailyEmployeePass.create({
          data: {
            attendeeId: attendee.id,
            eventDate: dto.simulatedDate,
            qrToken,
            status: DailyPassStatus.ACTIVE as any,
            emailStatus: DailyPassEmailStatus.PENDING as any,
            isTest: true,
            testSessionId: sessionId,
          },
        });

        const primaryEmployee = attendee.familyMember?.employee || attendee.employee;
        const attendeeName =
          attendee.familyMember?.name || primaryEmployee?.name || attendee.name || 'Attendee';
        const isFamily = !!attendee.familyMember;
        const relation = attendee.familyMember?.relation || 'Self';
        const employeeName = primaryEmployee?.name || attendeeName;
        const employeeCpf = primaryEmployee?.cpf || 'N/A';
        const department = primaryEmployee?.department || 'EWC Ahmedabad';
        const passType = isFamily
          ? (relation && relation.toLowerCase() !== 'family member' ? `Family Member Pass (${relation})` : 'Family Member Pass')
          : 'ONGC Employee Pass';
        const dayTheme = getEventDayTheme(dto.simulatedDate);
        const presentation = buildDailyEmployeePassPresentation({
          eventDate: newPass.eventDate,
          ticketNumber: attendee.ticketNumber,
          qrToken: newPass.qrToken,
          status: newPass.status,
          attendeeName,
          isFamily,
          relation,
          employeeName,
          employeeCpf,
          department,
        });

        if (dto.testRecipientEmail) {
          const emailRes = await this.sendTestEmail(
            { token: newPass.qrToken, recipientEmail: dto.testRecipientEmail },
            adminUser,
          );
          emailStatus = emailRes.emailStatus;
          message += ` Generated test pass and dispatched test email to ${dto.testRecipientEmail}.`;
        } else {
          message += ` Generated date-specific pass for ${attendeeName}.`;
        }

        generatedPass = {
          testPassId: newPass.id.toString(),
          testSessionId: sessionId,
          qrToken: newPass.qrToken,
          attendeeId: attendee.id.toString(),
          attendeeName,
          isFamily,
          relation,
          employeeName,
          employeeCpf,
          department,
          passType,
          ticketNumber: attendee.ticketNumber,
          eventDate: newPass.eventDate,
          status: newPass.status,
          emailStatus,
          dayTheme,
          presentation,
          createdAt: newPass.createdAt,
        };
      }
    }

    return {
      success: true,
      isDue: true,
      status: 'DUE',
      simulatedDate: dto.simulatedDate,
      simulatedTime,
      configuredDispatchTime,
      pass: generatedPass,
      message,
      alreadyDispatched,
    };
  }

  /**
   * Evaluates simulated clock against configured daily dispatch schedule for selected employee(s).
   * Generates date-specific test passes for eligible attendees and automatically sends test emails if due.
   * If simulated time < configured dispatch time: passes are created in PENDING status, emails NOT sent.
   * If simulated time >= configured dispatch time: passes are generated and test emails dispatched to safe recipient.
   * Fully idempotent (no duplicate passes, no re-sending to already SENT passes).
   */
  async simulateDelivery(dto: SimulateDeliveryDto, adminUser: any) {
    if (adminUser?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can run simulated delivery.');
    }

    if (!dto.simulatedDate || !isOfficialEventDate(dto.simulatedDate)) {
      throw new BadRequestException(
        `Invalid simulated date: "${dto.simulatedDate}". Allowed dates: ${OFFICIAL_EVENT_DATES.join(', ')}`,
      );
    }

    const effectiveSchedule = await this.getEffectiveDispatchSchedule();
    const configuredDispatchTime = (
      dto.configuredDispatchTime?.trim() ||
      effectiveSchedule[dto.simulatedDate] ||
      DEFAULT_DISPATCH_SCHEDULE[dto.simulatedDate] ||
      '18:00'
    ).trim();

    const simulatedTime = (dto.simulatedTime || '18:00').trim();

    // Parse HH:mm to minutes for comparison
    const [simH, simM] = simulatedTime.split(':').map((v) => parseInt(v, 10) || 0);
    const [cfgH, cfgM] = configuredDispatchTime.split(':').map((v) => parseInt(v, 10) || 0);

    const isDue = simH * 60 + simM >= cfgH * 60 + cfgM;

    // Resolve target attendees
    let targetAttendees: any[] = [];
    let totalEmployees = 0;

    if (dto.employeeIds && dto.employeeIds.length > 0) {
      const empIds = dto.employeeIds.map((id) => BigInt(id));
      const employees = await this.prisma.employee.findMany({
        where: { id: { in: empIds } },
        include: {
          familyMembers: true,
          attendees: {
            include: {
              employee: true,
              familyMember: {
                include: {
                  employee: true,
                },
              },
            },
          },
        },
      });

      totalEmployees = employees.length;
      for (const emp of employees) {
        for (const att of emp.attendees) {
          targetAttendees.push(att);
        }
      }
    } else if (dto.attendeeId) {
      const attendeeIdBigInt = BigInt(dto.attendeeId);
      const attendee = await this.prisma.attendee.findUnique({
        where: { id: attendeeIdBigInt },
        include: {
          employee: true,
          familyMember: {
            include: {
              employee: true,
            },
          },
        },
      });

      if (!attendee) {
        throw new NotFoundException(`Attendee with ID ${dto.attendeeId} not found`);
      }
      targetAttendees.push(attendee);
      totalEmployees = 1;
    } else {
      throw new BadRequestException('Either employeeIds or attendeeId must be provided.');
    }

    if (targetAttendees.length === 0) {
      throw new NotFoundException('No attendees found for the specified selection.');
    }

    // Filter attendees into eligible and ineligible for this specific event date
    const eligibleAttendees: any[] = [];
    const ineligibleAttendees: any[] = [];

    for (const att of targetAttendees) {
      const bookingDays = resolveBookingDays(att);
      const primaryEmployee = att.familyMember?.employee || att.employee;
      const attendeeName =
        att.familyMember?.name || primaryEmployee?.name || att.name || 'Attendee';
      const isFamily = !!att.familyMember;
      const relation = att.familyMember?.relation || 'Self';
      const employeeName = primaryEmployee?.name || attendeeName;
      const employeeCpf = primaryEmployee?.cpf || 'N/A';
      const department = primaryEmployee?.department || 'EWC Ahmedabad';

      if (bookingDays.includes(dto.simulatedDate)) {
        eligibleAttendees.push(att);
      } else {
        ineligibleAttendees.push({
          attendeeId: att.id.toString(),
          attendeeName,
          isFamily,
          relation,
          employeeName,
          employeeCpf,
          department,
          reason: 'Did not select this date',
          selectedDates: bookingDays,
        });
      }
    }

    const sessionId =
      dto.testSessionId?.trim() ||
      `EMP-SIM-${dto.simulatedDate.replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Session isolation: purge stale test passes from prior sessions for these attendees on this date
    // so older timestamps and older SENT statuses never leak into the new session.
    const eligibleAttendeeIds = eligibleAttendees.map((a) => a.id);
    if (eligibleAttendeeIds.length > 0) {
      await this.prisma.dailyEmployeePass.deleteMany({
        where: {
          attendeeId: { in: eligibleAttendeeIds },
          eventDate: dto.simulatedDate,
          isTest: true,
          testSessionId: { not: sessionId },
        },
      });
    }

    const resultPasses: any[] = [];
    let newlyGeneratedCount = 0;
    let existingCount = 0;
    let emailsSentCount = 0;
    let emailsSkippedCount = 0;

    for (const attendee of eligibleAttendees) {
      // Reuse pass if already generated in THIS specific test session (idempotency within current session)
      const existingPass = await this.prisma.dailyEmployeePass.findFirst({
        where: {
          attendeeId: attendee.id,
          eventDate: dto.simulatedDate,
          isTest: true,
          testSessionId: sessionId,
        },
      });

      let pass = existingPass;
      if (pass) {
        // Reset pass to ACTIVE and clear checkedInAt if previously scanned
        if (pass.status !== DailyPassStatus.ACTIVE || pass.checkedInAt) {
          pass = await this.prisma.dailyEmployeePass.update({
            where: { id: pass.id },
            data: {
              status: DailyPassStatus.ACTIVE as any,
              checkedInAt: null,
              testSessionId: sessionId,
            },
          });
          await this.prisma.dailyCheckin.deleteMany({
            where: {
              attendeeId: attendee.id,
              eventDate: dto.simulatedDate,
              isLoadTest: true,
            },
          });
        }
        existingCount++;
      } else {
        const qrToken = crypto.randomBytes(32).toString('hex');
        pass = await this.prisma.dailyEmployeePass.create({
          data: {
            attendeeId: attendee.id,
            eventDate: dto.simulatedDate,
            qrToken,
            status: DailyPassStatus.ACTIVE as any,
            emailStatus: DailyPassEmailStatus.PENDING as any,
            isTest: true,
            testSessionId: sessionId,
          },
        });
        newlyGeneratedCount++;
      }

      // Check if automatic email dispatch should occur
      let emailStatus: string = pass.emailStatus;
      if (isDue && dto.testRecipientEmail?.trim()) {
        if (pass.emailStatus === DailyPassEmailStatus.SENT) {
          emailsSkippedCount++;
        } else {
          try {
            const emailRes = await this.sendTestEmail(
              { token: pass.qrToken, recipientEmail: dto.testRecipientEmail.trim() },
              adminUser,
            );
            emailStatus = emailRes.emailStatus;
            if (emailRes.success) {
              emailsSentCount++;
            }
          } catch (err: any) {
            this.logger.error(`Error auto-dispatching test email for pass ${pass.id}: ${err.message}`);
            emailStatus = 'FAILED';
          }
        }
      }

      const primaryEmployee = attendee.familyMember?.employee || attendee.employee;
      const attendeeName =
        attendee.familyMember?.name || primaryEmployee?.name || attendee.name || 'Attendee';
      const isFamily = !!attendee.familyMember;
      const relation = attendee.familyMember?.relation || 'Self';
      const employeeName = primaryEmployee?.name || attendeeName;
      const employeeCpf = primaryEmployee?.cpf || 'N/A';
      const department = primaryEmployee?.department || 'EWC Ahmedabad';
      const passType = isFamily
        ? (relation && relation.toLowerCase() !== 'family member' ? `Family Member Pass (${relation})` : 'Family Member Pass')
        : 'ONGC Employee Pass';
      const dayTheme = getEventDayTheme(dto.simulatedDate);

      const presentation: DailyEmployeePassPresentation = buildDailyEmployeePassPresentation({
        eventDate: pass.eventDate,
        ticketNumber: attendee.ticketNumber,
        qrToken: pass.qrToken,
        status: pass.status,
        attendeeName,
        isFamily,
        relation,
        employeeName,
        employeeCpf,
        department,
      });

      resultPasses.push({
        testPassId: pass.id.toString(),
        testSessionId: sessionId,
        qrToken: pass.qrToken,
        attendeeId: attendee.id.toString(),
        attendeeName,
        isFamily,
        relation,
        employeeName,
        employeeCpf,
        department,
        passType,
        ticketNumber: attendee.ticketNumber,
        eventDate: pass.eventDate,
        status: pass.status,
        emailStatus,
        dayTheme,
        presentation,
        simulatedDispatchTime: isDue ? configuredDispatchTime : null,
        simulatedEventTime: simulatedTime,
        realCreatedAt: pass.createdAt,
        realEmailSentAt: pass.emailSentAt,
        createdAt: pass.createdAt,
      });
    }

    const dayTheme = getEventDayTheme(dto.simulatedDate);

    let message: string;
    if (isDue) {
      message = `QR Delivery Condition Satisfied: Simulated time (${simulatedTime}) has reached or exceeded configured dispatch time (${configuredDispatchTime}) for ${dayTheme.fullDateLabel}. ${resultPasses.length} eligible pass(es) ready.`;
      if (dto.testRecipientEmail?.trim()) {
        message += ` ${emailsSentCount} test email(s) dispatched to ${dto.testRecipientEmail.trim()}${emailsSkippedCount > 0 ? ` (${emailsSkippedCount} previously sent skipped for idempotency)` : ''}.`;
      }
    } else {
      message = `Waiting for QR delivery time: Configured dispatch time is ${configuredDispatchTime}, but simulated time is ${simulatedTime} for ${dayTheme.fullDateLabel}. Test passes generated in PENDING email status. Test emails were not sent.`;
    }

    this.logger.log(
      `[TEST_LAB] Simulate delivery for ${dto.simulatedDate}: isDue=${isDue}, ${resultPasses.length} passes, ${emailsSentCount} emails sent`,
    );

    const firstPass = resultPasses[0] || {};
    return {
      ...firstPass,
      success: true,
      isDue,
      status: isDue ? 'DUE' : 'WAITING',
      simulatedDate: dto.simulatedDate,
      simulatedTime,
      configuredDispatchTime,
      simulatedDispatchTime: isDue ? configuredDispatchTime : null,
      passes: resultPasses,
      ineligible: ineligibleAttendees,
      totalEmployees,
      totalSelectedPeople: targetAttendees.length,
      totalEligible: eligibleAttendees.length,
      totalPasses: resultPasses.length,
      newlyGeneratedCount,
      existingCount,
      emailsSentCount,
      emailsSkippedCount,
      message,
      testSessionId: sessionId,
    };
  }

  /**
   * Automatically evaluates the 10-minute simulation test window from simulatedStartTime to simulatedStartTime + 10 mins.
   * Progresses simulated time minute-by-minute against the official production dispatch schedule.
   * When simulatedTime reaches or exceeds production dispatch time, generates passes and sends test emails to safe recipient.
   * When window completes, optionally auto-cleans up test passes.
   */
  async simulateWindow(dto: SimulateWindowDto, adminUser: any) {
    if (adminUser?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can run simulated window.');
    }

    if (!dto.simulatedDate || !isOfficialEventDate(dto.simulatedDate)) {
      throw new BadRequestException(
        `Invalid simulated date: "${dto.simulatedDate}". Allowed dates: ${OFFICIAL_EVENT_DATES.join(', ')}`,
      );
    }

    const effectiveSchedule = await this.getEffectiveDispatchSchedule();
    const productionDispatchTime = (
      effectiveSchedule[dto.simulatedDate] ||
      DEFAULT_DISPATCH_SCHEDULE[dto.simulatedDate] ||
      '18:00'
    ).trim();

    const startTimeStr = (dto.simulatedStartTime || '15:40').trim();
    const [startH, startM] = startTimeStr.split(':').map((v) => parseInt(v, 10) || 0);
    const [dispH, dispM] = productionDispatchTime.split(':').map((v) => parseInt(v, 10) || 0);

    const startTotalMinutes = startH * 60 + startM;
    const dispTotalMinutes = dispH * 60 + dispM;

    const sessionId =
      dto.testSessionId?.trim() ||
      `EMP-WIN-${dto.simulatedDate.replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Helper to format minutes back to HH:mm
    const formatMinutes = (totalMins: number) => {
      const normalized = ((totalMins % 1440) + 1440) % 1440;
      const h = Math.floor(normalized / 60);
      const m = normalized % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // Construct 10-minute timeline (minutes 0 through 10)
    const timeline: Array<{
      minute: number;
      time: string;
      isDue: boolean;
      status: string;
    }> = [];

    let dispatchSatisfiedMinute: number | null = null;
    let dispatchSatisfiedTime: string | null = null;

    for (let m = 0; m <= 10; m++) {
      const stepMinutes = startTotalMinutes + m;
      const timeStr = formatMinutes(stepMinutes);
      const isDue = stepMinutes >= dispTotalMinutes;

      if (isDue && dispatchSatisfiedMinute === null) {
        dispatchSatisfiedMinute = m;
        dispatchSatisfiedTime = timeStr;
      }

      timeline.push({
        minute: m,
        time: timeStr,
        isDue,
        status: isDue ? 'DISPATCH_CONDITION_SATISFIED' : 'WAITING_FOR_DISPATCH',
      });
    }

    // Execute delivery simulation at the dispatch time if condition was satisfied,
    // or at start time in WAITING status if condition was not satisfied.
    const evaluationTime = dispatchSatisfiedTime || startTimeStr;
    const deliveryResult = await this.simulateDelivery(
      {
        employeeIds: dto.employeeIds,
        attendeeId: dto.attendeeId,
        simulatedDate: dto.simulatedDate,
        simulatedTime: evaluationTime,
        configuredDispatchTime: productionDispatchTime,
        testRecipientEmail: dto.testRecipientEmail,
        testSessionId: sessionId,
      },
      adminUser,
    );

    let cleanedUp = false;
    if (dto.autoCleanup) {
      await this.cleanupTestSession(sessionId, adminUser);
      cleanedUp = true;
    }

    const dayTheme = getEventDayTheme(dto.simulatedDate);
    const endTimeStr = timeline[10].time;

    let message: string;
    if (dispatchSatisfiedMinute !== null) {
      message = `Automatic 10-minute simulation window (${startTimeStr} → ${endTimeStr}) complete for ${dayTheme.fullDateLabel}. Production dispatch condition satisfied at ${dispatchSatisfiedTime} (production: ${productionDispatchTime}). ${deliveryResult.emailsSentCount || 0} test email(s) dispatched to safe recipient.`;
    } else {
      message = `Automatic 10-minute simulation window (${startTimeStr} → ${endTimeStr}) complete for ${dayTheme.fullDateLabel}. Production dispatch time (${productionDispatchTime}) was not reached. 0 passes dispatched.`;
    }

    return {
      success: true,
      testSessionId: sessionId,
      eventDate: dto.simulatedDate,
      productionDispatchTime,
      simulatedStartTime: startTimeStr,
      simulatedEndTime: endTimeStr,
      dispatchSatisfiedMinute,
      dispatchSatisfiedTime,
      isDue: dispatchSatisfiedMinute !== null,
      timeline,
      passes: deliveryResult.passes || [],
      emailsSentCount: deliveryResult.emailsSentCount || 0,
      totalEligible: deliveryResult.totalEligible || 0,
      totalPasses: deliveryResult.totalPasses || 0,
      message,
      cleanedUp,
    };
  }
}
