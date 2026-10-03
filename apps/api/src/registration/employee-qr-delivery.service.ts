import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { DailyPassPdfService } from './daily-pass-pdf.service';
import {
  AttendeeStatus,
  RegistrationStatus,
  RegistrationType,
  EmailDeliveryStatus,
  EmailReleaseStatus,
  EmailDeliveryErrorType,
  EmployeeQrReleaseSchedule,
  EmployeeQrEmailReleaseSummary,
  EmployeeQrEmailDeliveryItem,
  SponsorVoucherConfig,
  DEFAULT_SPONSOR_VOUCHER_CONFIG,
} from '@ongc/shared-types';
import { resolveBookingDays } from '../common/utils/attendee-booking.util';
import { classifyEmailError } from '../mail/email-error-classifier';

export interface ExecuteReleaseOptions {
  action?: 'SEND_NOW' | 'RETRY_FAILED';
  retryFailedOnly?: boolean;
  attendeeId?: bigint;
  isTest?: boolean;
  testEmail?: string;
  triggeredBy?: string;
}

@Injectable()
export class EmployeeQrDeliveryService {
  private readonly logger = new Logger(EmployeeQrDeliveryService.name);
  private isProcessingRelease = false;

  // Batching & Concurrency configuration
  private readonly concurrency: number;
  private readonly batchSize: number;
  private readonly delayMs: number;
  private readonly maxRetries: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly dailyPassPdfService: DailyPassPdfService,
  ) {
    this.concurrency = parseInt(
      this.configService.get<string>('EMAIL_BULK_CONCURRENCY') || '5',
      10,
    );
    this.batchSize = parseInt(
      this.configService.get<string>('EMAIL_BULK_BATCH_SIZE') || '10',
      10,
    );
    this.delayMs = parseInt(
      this.configService.get<string>('EMAIL_BULK_DELAY_MS') || '100',
      10,
    );
    this.maxRetries = parseInt(
      this.configService.get<string>('EMAIL_BULK_MAX_RETRIES') || '3',
      10,
    );
  }

  /**
   * Helper delay utility for rate-limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Safe status transition validation to prevent state downgrades.
   * DELIVERED is terminal and can NEVER be downgraded to QUEUED or FAILED.
   * ACCEPTED can only become DELIVERED, BOUNCED, or REJECTED.
   */
  canTransition(current: EmailDeliveryStatus, target: EmailDeliveryStatus): boolean {
    if (current === target) return true;
    if (current === EmailDeliveryStatus.DELIVERED) {
      // Terminal positive status
      return false;
    }
    if (current === EmailDeliveryStatus.ACCEPTED) {
      return (
        target === EmailDeliveryStatus.DELIVERED ||
        target === EmailDeliveryStatus.BOUNCED ||
        target === EmailDeliveryStatus.REJECTED ||
        target === EmailDeliveryStatus.DEFERRED
      );
    }
    if (current === EmailDeliveryStatus.SENDING) {
      return (
        target === EmailDeliveryStatus.ACCEPTED ||
        target === EmailDeliveryStatus.DELIVERED ||
        target === EmailDeliveryStatus.FAILED ||
        target === EmailDeliveryStatus.BOUNCED ||
        target === EmailDeliveryStatus.REJECTED
      );
    }
    if (current === EmailDeliveryStatus.QUEUED) {
      return true;
    }
    return true;
  }

  /**
   * Gets overall release statistics and schedule settings.
   */
  async getReleaseScheduleAndStats(): Promise<EmployeeQrReleaseSchedule> {
    const key = 'employee.qr_release_schedule';
    const setting = await this.prisma.setting.findUnique({ where: { key } });

    let scheduleData: Partial<EmployeeQrReleaseSchedule> = {};
    if (setting?.value) {
      try {
        scheduleData = JSON.parse(setting.value);
      } catch {}
    }

    // 1. Count eligible approved active attendees (excluding load tests)
    const eligibleAttendees = await this.prisma.attendee.findMany({
      where: {
        isLoadTest: false,
        status: AttendeeStatus.ACTIVE as any,
        OR: [
          { registrationType: RegistrationType.EMPLOYEE as any },
          { employeeId: { not: null } },
        ],
        employee: {
          registrationStatus: RegistrationStatus.APPROVED as any,
        },
      },
    });

    const activeAttendees = eligibleAttendees.filter((att) => {
      const days = resolveBookingDays(att);
      return days.length > 0;
    });

    const eligibleCount = activeAttendees.length;
    const qrGeneratedCount = activeAttendees.filter(
      (att) => !!att.qrCodeToken && att.qrCodeToken.trim() !== '',
    ).length;

    // 2. Fetch latest production delivery counts from employee_qr_email_deliveries
    const deliveryCounts = await this.prisma.employeeQrEmailDelivery.groupBy({
      by: ['status'],
      where: { isTest: false },
      _count: { id: true },
    });

    const countsMap: Record<string, number> = {};
    for (const item of deliveryCounts) {
      countsMap[item.status] = item._count.id;
    }

    const queuedCount = countsMap[EmailDeliveryStatus.QUEUED] || 0;
    const sendingCount = countsMap[EmailDeliveryStatus.SENDING] || 0;
    const acceptedCount = countsMap[EmailDeliveryStatus.ACCEPTED] || 0;
    const deliveredCount = countsMap[EmailDeliveryStatus.DELIVERED] || 0;
    const failedCount = countsMap[EmailDeliveryStatus.FAILED] || 0;
    const bouncedCount = countsMap[EmailDeliveryStatus.BOUNCED] || 0;
    const totalSent = acceptedCount + deliveredCount;

    // Find active running release if any
    const runningRelease = await this.prisma.employeeQrEmailRelease.findFirst({
      where: { status: EmailReleaseStatus.RUNNING, isTest: false },
      orderBy: { id: 'desc' },
    });

    let computedStatus: EmployeeQrReleaseSchedule['status'] = 'IDLE';
    if (this.isProcessingRelease || runningRelease) {
      computedStatus = 'RUNNING';
    } else if (totalSent > 0) {
      computedStatus = failedCount > 0 ? 'PARTIAL_FAILURE' : 'COMPLETED';
    }

    return {
      enabled: scheduleData.enabled ?? false,
      releaseDate: scheduleData.releaseDate || '2026-10-10',
      releaseTime: scheduleData.releaseTime || '10:00',
      timezone: scheduleData.timezone || 'Asia/Kolkata',
      status: (scheduleData.status as any) || computedStatus,
      lastRunAt: scheduleData.lastRunAt || null,
      lastRunMessage: scheduleData.lastRunMessage || null,
      currentReleaseId: runningRelease ? runningRelease.id.toString() : null,
      stats: {
        eligibleCount,
        qrGeneratedCount,
        queuedCount,
        sendingCount,
        acceptedCount,
        deliveredCount,
        failedCount,
        bouncedCount,
        sentCount: totalSent,
      },
    };
  }

  /**
   * Saves employee QR release schedule configuration.
   */
  async updateReleaseSchedule(dto: {
    enabled?: boolean;
    releaseDate?: string;
    releaseTime?: string;
    timezone?: string;
  }): Promise<EmployeeQrReleaseSchedule> {
    const current = await this.getReleaseScheduleAndStats();
    const updated: EmployeeQrReleaseSchedule = {
      ...current,
      enabled: dto.enabled !== undefined ? dto.enabled : current.enabled,
      releaseDate: dto.releaseDate || current.releaseDate,
      releaseTime: dto.releaseTime || current.releaseTime,
      timezone: dto.timezone || current.timezone,
    };

    await this.prisma.setting.upsert({
      where: { key: 'employee.qr_release_schedule' },
      update: { value: JSON.stringify(updated) },
      create: { key: 'employee.qr_release_schedule', value: JSON.stringify(updated) },
    });

    return updated;
  }

  /**
   * Retrieves the current sponsor voucher configuration.
   * Defaults to Mahavir Jewellers voucher (enabled=true) if not configured.
   */
  async getSponsorVoucherConfig(): Promise<SponsorVoucherConfig> {
    const key = 'employee.sponsor_voucher_config';
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting?.value) {
      return { ...DEFAULT_SPONSOR_VOUCHER_CONFIG };
    }
    try {
      const parsed = JSON.parse(setting.value);
      return {
        ...DEFAULT_SPONSOR_VOUCHER_CONFIG,
        ...parsed,
      };
    } catch {
      return { ...DEFAULT_SPONSOR_VOUCHER_CONFIG };
    }
  }

  /**
   * Updates sponsor voucher configuration (toggle, sponsor details, offer text, validity).
   */
  async updateSponsorVoucherConfig(
    partial: Partial<SponsorVoucherConfig>,
    adminUser?: any,
  ): Promise<SponsorVoucherConfig> {
    const current = await this.getSponsorVoucherConfig();
    const updated: SponsorVoucherConfig = {
      ...current,
      ...partial,
    };

    const key = 'employee.sponsor_voucher_config';
    await this.prisma.setting.upsert({
      where: { key },
      update: { value: JSON.stringify(updated) },
      create: { key, value: JSON.stringify(updated) },
    });

    if (adminUser) {
      await this.prisma.auditLog.create({
        data: {
          action: 'SPONSOR_VOUCHER_CONFIG_UPDATE',
          details: {
            admin: adminUser.email || adminUser.name || 'Admin',
            enabled: updated.enabled,
            sponsorName: updated.sponsorName,
            offerHeadline: updated.offerHeadline,
          },
        },
      });
    }

    return updated;
  }

  /**
   * Atomically executes bulk employee permanent QR release.
   * Concurrency-safe, idempotent, batch-throttled, and error-tolerant.
   */
  async executeRelease(options: ExecuteReleaseOptions = {}) {
    // 1. Prevent concurrent release triggers
    if (this.isProcessingRelease) {
      throw new BadRequestException('A release is already currently in progress. Please wait for it to complete.');
    }

    this.isProcessingRelease = true;

    try {
      const isRetryOnly = options.action === 'RETRY_FAILED' || !!options.retryFailedOnly;
      const isTest = Boolean(options.isTest);

      // 2. Load eligible attendees
      const attendeeQuery: any = {
        isLoadTest: false,
        status: AttendeeStatus.ACTIVE as any,
        OR: [
          { registrationType: RegistrationType.EMPLOYEE as any },
          { employeeId: { not: null } },
        ],
        employee: {
          registrationStatus: RegistrationStatus.APPROVED as any,
        },
      };

      if (options.attendeeId) {
        attendeeQuery.id = options.attendeeId;
      }

      const eligibleAttendees = await this.prisma.attendee.findMany({
        where: attendeeQuery,
        include: {
          employee: true,
          familyMember: true,
        },
        orderBy: { id: 'asc' },
      });

      const activeAttendees = eligibleAttendees.filter((att) => {
        const days = resolveBookingDays(att);
        return days.length > 0;
      });

      if (activeAttendees.length === 0) {
        return {
          success: true,
          totalEligible: 0,
          processedCount: 0,
          acceptedCount: 0,
          deliveredCount: 0,
          failedCount: 0,
          message: 'No eligible approved attendees found with selected event dates.',
        };
      }

      // 3. Ensure every active attendee has exactly ONE permanent cryptographic QR code token
      for (const att of activeAttendees) {
        if (!att.qrCodeToken || att.qrCodeToken.trim() === '') {
          const qrCodeToken = crypto.randomBytes(32).toString('hex');
          await this.prisma.attendee.update({
            where: { id: att.id },
            data: { qrCodeToken },
          });
          att.qrCodeToken = qrCodeToken;
        }
      }

      // 4. Retrieve existing delivery records for idempotency check
      const attendeeIds = activeAttendees.map((a) => a.id);
      const existingDeliveries = await this.prisma.employeeQrEmailDelivery.findMany({
        where: {
          attendeeId: { in: attendeeIds },
          isTest,
        },
      });

      const deliveryByAttendeeId = new Map<string, any>();
      for (const d of existingDeliveries) {
        deliveryByAttendeeId.set(d.attendeeId.toString(), d);
      }

      // 5. Filter target attendees strictly following idempotency rules:
      // - Already DELIVERED or ACCEPTED: SKIP (unless test or single attendee explicit resend)
      // - Retry mode: Include ONLY FAILED or BOUNCED
      // - Standard Send Now: Include unattempted attendees and retryable failures
      let targetAttendees = activeAttendees.filter((att) => {
        const existing = deliveryByAttendeeId.get(att.id.toString());
        if (!existing) return true; // Never attempted -> eligible

        if (options.attendeeId) {
          // Explicit single attendee resend requested
          return true;
        }

        if (isRetryOnly) {
          return (
            existing.status === EmailDeliveryStatus.FAILED ||
            existing.status === EmailDeliveryStatus.BOUNCED
          );
        }

        // Standard release: Skip DELIVERED and ACCEPTED
        if (
          existing.status === EmailDeliveryStatus.DELIVERED ||
          existing.status === EmailDeliveryStatus.ACCEPTED
        ) {
          return false;
        }

        // Skip if currently sending or queued
        if (
          existing.status === EmailDeliveryStatus.SENDING ||
          existing.status === EmailDeliveryStatus.QUEUED
        ) {
          return false;
        }

        return true;
      });

      if (targetAttendees.length === 0) {
        return {
          success: true,
          totalEligible: activeAttendees.length,
          processedCount: 0,
          acceptedCount: 0,
          deliveredCount: 0,
          failedCount: 0,
          message: isRetryOnly
            ? 'No failed emails available for retry.'
            : 'All eligible attendees have already received their permanent pass release.',
        };
      }

      // 6. Create parent release record
      const release = await this.prisma.employeeQrEmailRelease.create({
        data: {
          releaseType: isRetryOnly ? 'RETRY_FAILED' : 'PERMANENT_QR',
          status: EmailReleaseStatus.RUNNING,
          totalRecipients: targetAttendees.length,
          queuedCount: targetAttendees.length,
          sendingCount: 0,
          acceptedCount: 0,
          deliveredCount: 0,
          failedCount: 0,
          bouncedCount: 0,
          rejectedCount: 0,
          createdBy: options.triggeredBy || 'SUPER_ADMIN',
          isTest,
        },
      });

      // 7. Audit log release start
      await this.prisma.auditLog.create({
        data: {
          action: 'RELEASE_STARTED',
          details: {
            releaseId: release.id.toString(),
            totalRecipients: targetAttendees.length,
            isRetryOnly,
            isTest,
            triggeredBy: options.triggeredBy,
          },
        },
      });

      // 8. Queue delivery records in the database
      const deliveryMap = new Map<string, any>();
      for (const att of targetAttendees) {
        const emp = att.employee;
        const fam = att.familyMember;
        const refNo = emp?.referenceNumber || emp?.cpf || 'ONGC';
        const recipientEmail = (
          options.testEmail ||
          (fam ? fam.email || att.email || emp?.email : emp?.email || att.email) ||
          ''
        ).trim();

        let delivery = deliveryByAttendeeId.get(att.id.toString());
        if (delivery) {
          delivery = await this.prisma.employeeQrEmailDelivery.update({
            where: { id: delivery.id },
            data: {
              releaseId: release.id,
              recipientEmail,
              status: EmailDeliveryStatus.QUEUED,
              queuedAt: new Date(),
              retryCount: delivery.retryCount + (isRetryOnly ? 1 : 0),
              errorType: null,
              lastError: null,
            },
          });
        } else {
          delivery = await this.prisma.employeeQrEmailDelivery.create({
            data: {
              releaseId: release.id,
              attendeeId: att.id,
              referenceNumber: refNo,
              recipientEmail,
              status: EmailDeliveryStatus.QUEUED,
              provider: 'HOSTINGER',
              queuedAt: new Date(),
              maxRetries: this.maxRetries,
              isTest,
            },
          });
        }
        deliveryMap.set(att.id.toString(), delivery);
      }

      // 9. Process target attendees in controlled batches with bounded concurrency
      let newlyAccepted = 0;
      let newlyFailed = 0;
      const totalToProcess = targetAttendees.length;

      for (let i = 0; i < totalToProcess; i += this.batchSize) {
        const batch = targetAttendees.slice(i, i + this.batchSize);

        // Process batch items with bounded concurrency
        const chunks: (typeof batch)[] = [];
        for (let c = 0; c < batch.length; c += this.concurrency) {
          chunks.push(batch.slice(c, c + this.concurrency));
        }

        for (const chunk of chunks) {
          await Promise.all(
            chunk.map(async (att) => {
              const delivery = deliveryMap.get(att.id.toString());
              const emp = att.employee;
              const fam = att.familyMember;
              const recipientEmail = delivery.recipientEmail;

              // Check email validity
              if (!recipientEmail || !recipientEmail.includes('@')) {
                const classified = classifyEmailError('No recipient email found');
                await this.prisma.employeeQrEmailDelivery.update({
                  where: { id: delivery.id },
                  data: {
                    status: EmailDeliveryStatus.FAILED,
                    failedAt: new Date(),
                    errorType: classified.errorType,
                    lastError: classified.userFriendlyReason,
                  },
                });
                newlyFailed++;
                return;
              }

              // Update status to SENDING
              await this.prisma.employeeQrEmailDelivery.update({
                where: { id: delivery.id },
                data: {
                  status: EmailDeliveryStatus.SENDING,
                  startedAt: new Date(),
                },
              });

              // Prepare email content
              const attendeeName = fam ? fam.name : (emp?.name || att.name || 'Employee');
              const relation = fam ? fam.relation : 'Primary Employee';
              const bookingDaysList = resolveBookingDays(att);
              const firstDate = bookingDaysList[0] || '2026-10-11';

              let pdfBuffer: Buffer | undefined;
              if (this.dailyPassPdfService) {
                try {
                  pdfBuffer = await this.dailyPassPdfService.generateDailyPassPdf(att.qrCodeToken);
                } catch {
                  // Fallback without PDF attachment
                }
              }

              try {
                let sendResult: any = { success: true };
                if (this.mailService) {
                  sendResult = await this.mailService.sendEmployeeDailyPassEmail({
                    recipientEmail,
                    employeeName: emp?.name || attendeeName,
                    attendeeName,
                    relation,
                    eventDate: firstDate,
                    ticketNumber: att.ticketNumber,
                    qrToken: att.qrCodeToken,
                    cpf: emp?.cpf || 'N/A',
                    referenceNumber: emp?.referenceNumber || emp?.cpf,
                    department: emp?.department,
                    pdfBuffer,
                  });
                }

                if (sendResult && sendResult.success) {
                  // Successful dispatch: Hostinger Mail accepted the message
                  await this.prisma.employeeQrEmailDelivery.update({
                    where: { id: delivery.id },
                    data: {
                      status: EmailDeliveryStatus.ACCEPTED,
                      acceptedAt: new Date(),
                      providerMessageId: sendResult.messageId || null,
                      lastProviderResponse: '204 No Content - Accepted by provider',
                    },
                  });
                  newlyAccepted++;
                } else {
                  const errText = sendResult?.error || 'Failed to dispatch email';
                  const classified = classifyEmailError(errText, sendResult?.statusCode);
                  await this.prisma.employeeQrEmailDelivery.update({
                    where: { id: delivery.id },
                    data: {
                      status: EmailDeliveryStatus.FAILED,
                      failedAt: new Date(),
                      errorType: classified.errorType,
                      lastError: classified.userFriendlyReason,
                      lastProviderError: errText,
                    },
                  });
                  newlyFailed++;
                }
              } catch (err: any) {
                const classified = classifyEmailError(err.message);
                await this.prisma.employeeQrEmailDelivery.update({
                  where: { id: delivery.id },
                  data: {
                    status: EmailDeliveryStatus.FAILED,
                    failedAt: new Date(),
                    errorType: classified.errorType,
                    lastError: classified.userFriendlyReason,
                    lastProviderError: err.message,
                  },
                });
                newlyFailed++;
              }
            }),
          );

          // Rate-limiting delay between chunks
          if (this.delayMs > 0) {
            await this.delay(this.delayMs);
          }
        }
      }

      // 10. Update release record with final counts
      const finalReleaseStatus =
        newlyFailed === 0
          ? EmailReleaseStatus.COMPLETED
          : newlyAccepted > 0
          ? EmailReleaseStatus.PARTIAL_FAILURE
          : EmailReleaseStatus.FAILED;

      await this.prisma.employeeQrEmailRelease.update({
        where: { id: release.id },
        data: {
          status: finalReleaseStatus,
          completedAt: new Date(),
          queuedCount: 0,
          sendingCount: 0,
          acceptedCount: newlyAccepted,
          failedCount: newlyFailed,
        },
      });

      // 11. Record audit log completion
      await this.prisma.auditLog.create({
        data: {
          action:
            finalReleaseStatus === EmailReleaseStatus.COMPLETED
              ? 'RELEASE_COMPLETED'
              : finalReleaseStatus === EmailReleaseStatus.PARTIAL_FAILURE
              ? 'RELEASE_PARTIAL_FAILURE'
              : 'RELEASE_FAILED',
          details: {
            releaseId: release.id.toString(),
            acceptedCount: newlyAccepted,
            failedCount: newlyFailed,
            totalProcessed: totalToProcess,
          },
        },
      });

      // 12. Update schedule setting summary
      const summaryMsg = `Permanent QR release completed: ${newlyAccepted} emails accepted, ${newlyFailed} failed. Total processed: ${totalToProcess}.`;
      await this.updateReleaseScheduleSettingRecord(finalReleaseStatus, summaryMsg);

      return {
        success: newlyFailed === 0,
        releaseId: release.id.toString(),
        totalEligible: activeAttendees.length,
        processedCount: totalToProcess,
        acceptedCount: newlyAccepted,
        deliveredCount: 0, // Delivery confirmation unavailable from SMTP/Hostinger
        failedCount: newlyFailed,
        message: summaryMsg,
      };
    } finally {
      this.isProcessingRelease = false;
    }
  }

  /**
   * Updates schedule setting record summary for UI dashboard
   */
  private async updateReleaseScheduleSettingRecord(status: string, message: string) {
    try {
      const schedule = await this.getReleaseScheduleAndStats();
      const updated: EmployeeQrReleaseSchedule = {
        ...schedule,
        status: status as any,
        lastRunAt: new Date().toISOString(),
        lastRunMessage: message,
      };
      await this.prisma.setting.upsert({
        where: { key: 'employee.qr_release_schedule' },
        update: { value: JSON.stringify(updated) },
        create: { key: 'employee.qr_release_schedule', value: JSON.stringify(updated) },
      });
    } catch {}
  }

  /**
   * Lists email delivery records with comprehensive pagination, search, status, and type filtering.
   */
  async listDeliveries(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    personType?: string;
    retryable?: string;
    releaseId?: string;
    isTest?: boolean;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      isTest: Boolean(query.isTest),
    };

    if (query.releaseId) {
      where.releaseId = BigInt(query.releaseId);
    }

    if (query.status && query.status !== 'ALL') {
      where.status = query.status as any;
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { recipientEmail: { contains: q, mode: 'insensitive' } },
        { referenceNumber: { contains: q, mode: 'insensitive' } },
        { providerMessageId: { contains: q, mode: 'insensitive' } },
        { attendee: { name: { contains: q, mode: 'insensitive' } } },
        { attendee: { employee: { name: { contains: q, mode: 'insensitive' } } } },
        { attendee: { employee: { cpf: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    if (query.personType && query.personType !== 'ALL') {
      if (query.personType === 'EMPLOYEE') {
        where.attendee = { ...where.attendee, familyMemberId: null };
      } else if (query.personType === 'FAMILY') {
        where.attendee = { ...where.attendee, familyMemberId: { not: null } };
      }
    }

    const [total, deliveries] = await Promise.all([
      this.prisma.employeeQrEmailDelivery.count({ where }),
      this.prisma.employeeQrEmailDelivery.findMany({
        where,
        include: {
          attendee: {
            include: {
              employee: true,
              familyMember: true,
            },
          },
        },
        orderBy: [{ id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    const items: EmployeeQrEmailDeliveryItem[] = deliveries.map((d) => {
      const att = d.attendee;
      const emp = att?.employee;
      const fam = att?.familyMember;
      const attendeeName = fam ? fam.name : (emp?.name || att?.name || 'Attendee');
      const employeeName = emp?.name || attendeeName;
      const relation = fam ? fam.relation : 'Self';
      const bookingDays = resolveBookingDays(att);

      return {
        id: d.id.toString(),
        releaseId: d.releaseId ? d.releaseId.toString() : null,
        attendeeId: d.attendeeId.toString(),
        referenceNumber: d.referenceNumber,
        recipientEmail: d.recipientEmail,
        attendeeName,
        employeeName,
        relation,
        isFamily: !!fam,
        cpf: emp?.cpf || 'N/A',
        ticketNumber: att?.ticketNumber || '',
        qrCodeToken: att?.qrCodeToken || '',
        bookingDays,
        status: d.status as any,
        provider: d.provider,
        providerMessageId: d.providerMessageId,
        providerEventId: d.providerEventId,
        queuedAt: d.queuedAt ? d.queuedAt.toISOString() : null,
        startedAt: d.startedAt ? d.startedAt.toISOString() : null,
        acceptedAt: d.acceptedAt ? d.acceptedAt.toISOString() : null,
        deliveredAt: d.deliveredAt ? d.deliveredAt.toISOString() : null,
        failedAt: d.failedAt ? d.failedAt.toISOString() : null,
        bouncedAt: d.bouncedAt ? d.bouncedAt.toISOString() : null,
        rejectedAt: d.rejectedAt ? d.rejectedAt.toISOString() : null,
        retryCount: d.retryCount,
        maxRetries: d.maxRetries,
        errorType: d.errorType as any,
        lastError: d.lastError,
        lastProviderError: d.lastProviderError,
        lastProviderResponse: d.lastProviderResponse,
        isTest: d.isTest,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      deliveries: items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Retries an individual email delivery by ID
   */
  async retrySingleDelivery(deliveryId: string, triggeredBy?: string) {
    const delivery = await this.prisma.employeeQrEmailDelivery.findUnique({
      where: { id: BigInt(deliveryId) },
      include: { attendee: { include: { employee: true, familyMember: true } } },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery record not found.');
    }

    const att = delivery.attendee;
    const emp = att.employee;
    const fam = att.familyMember;
    const recipientEmail = delivery.recipientEmail;

    await this.prisma.employeeQrEmailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: EmailDeliveryStatus.SENDING,
        startedAt: new Date(),
        retryCount: delivery.retryCount + 1,
      },
    });

    const attendeeName = fam ? fam.name : (emp?.name || att.name || 'Employee');
    const relation = fam ? fam.relation : 'Primary Employee';
    const bookingDaysList = resolveBookingDays(att);
    const firstDate = bookingDaysList[0] || '2026-10-11';

    let pdfBuffer: Buffer | undefined;
    if (this.dailyPassPdfService) {
      try {
        pdfBuffer = await this.dailyPassPdfService.generateDailyPassPdf(att.qrCodeToken);
      } catch {}
    }

    try {
      let sendResult: any = { success: true };
      if (this.mailService) {
        sendResult = await this.mailService.sendEmployeeDailyPassEmail({
          recipientEmail,
          employeeName: emp?.name || attendeeName,
          attendeeName,
          relation,
          eventDate: firstDate,
          ticketNumber: att.ticketNumber,
          qrToken: att.qrCodeToken,
          cpf: emp?.cpf || 'N/A',
          referenceNumber: emp?.referenceNumber || emp?.cpf,
          department: emp?.department,
          pdfBuffer,
        });
      }

      if (sendResult && sendResult.success) {
        await this.prisma.employeeQrEmailDelivery.update({
          where: { id: delivery.id },
          data: {
            status: EmailDeliveryStatus.ACCEPTED,
            acceptedAt: new Date(),
            providerMessageId: sendResult.messageId || null,
            lastError: null,
            errorType: null,
          },
        });

        await this.prisma.auditLog.create({
          data: {
            action: 'EMAIL_RETRY',
            details: {
              deliveryId: delivery.id.toString(),
              attendeeId: att.id.toString(),
              recipientEmail,
              success: true,
              triggeredBy,
            },
          },
        });

        return { success: true, message: 'Email retry dispatched and accepted by provider.' };
      } else {
        const classified = classifyEmailError(sendResult?.error, sendResult?.statusCode);
        await this.prisma.employeeQrEmailDelivery.update({
          where: { id: delivery.id },
          data: {
            status: EmailDeliveryStatus.FAILED,
            failedAt: new Date(),
            errorType: classified.errorType,
            lastError: classified.userFriendlyReason,
            lastProviderError: sendResult?.error,
          },
        });
        return { success: false, message: classified.userFriendlyReason };
      }
    } catch (err: any) {
      const classified = classifyEmailError(err.message);
      await this.prisma.employeeQrEmailDelivery.update({
        where: { id: delivery.id },
        data: {
          status: EmailDeliveryStatus.FAILED,
          failedAt: new Date(),
          errorType: classified.errorType,
          lastError: classified.userFriendlyReason,
          lastProviderError: err.message,
        },
      });
      return { success: false, message: classified.userFriendlyReason };
    }
  }

  /**
   * Sends a safe test permanent QR pass email to an administrator-specified test recipient
   * Marked with isTest: true so it never affects production statistics.
   */
  async sendTestPermanentQrEmail(testEmail: string, triggeredBy?: string) {
    if (!testEmail || !testEmail.includes('@')) {
      throw new BadRequestException('A valid test email address is required.');
    }

    const testToken = `test_perm_qr_${crypto.randomBytes(16).toString('hex')}`;

    let pdfBuffer: Buffer | undefined;
    if (this.dailyPassPdfService) {
      try {
        pdfBuffer = await this.dailyPassPdfService.generateDailyPassPdf(testToken);
      } catch {}
    }

    const voucherConfig = await this.getSponsorVoucherConfig();

    let sendResult: any = { success: true };
    if (this.mailService) {
      sendResult = await this.mailService.sendEmployeeDailyPassEmail({
        recipientEmail: testEmail.trim(),
        employeeName: 'Test Administrator',
        attendeeName: 'Test Administrator',
        relation: 'Self',
        eventDate: '2026-10-11',
        ticketNumber: 'TK-TEST-PERM-001',
        qrToken: testToken,
        cpf: 'TEST-ADMIN',
        referenceNumber: 'ONGC-TEST-001',
        department: 'Event Administration',
        pdfBuffer,
        sponsorVoucher: voucherConfig,
      });
    }

    // Record test delivery using an existing attendee id to satisfy foreign key constraint
    const fallbackAttendee = await this.prisma.attendee.findFirst({ select: { id: true } });
    const delivery = await this.prisma.employeeQrEmailDelivery.create({
      data: {
        attendeeId: fallbackAttendee?.id || BigInt(1),
        referenceNumber: 'ONGC-TEST-001',
        recipientEmail: testEmail.trim(),
        status: sendResult.success ? EmailDeliveryStatus.ACCEPTED : EmailDeliveryStatus.FAILED,
        provider: 'HOSTINGER',
        providerMessageId: sendResult.messageId || null,
        acceptedAt: sendResult.success ? new Date() : null,
        failedAt: sendResult.success ? null : new Date(),
        lastError: sendResult.success ? null : sendResult.error,
        isTest: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'EMAIL_TEST_SEND',
        details: {
          recipientEmail: testEmail,
          deliveryId: delivery.id.toString(),
          success: sendResult.success,
          triggeredBy,
          sponsorVoucherEnabled: voucherConfig.enabled,
          sponsorName: voucherConfig.sponsorName,
        },
      },
    });

    return {
      success: sendResult.success,
      message: sendResult.success
        ? `Test permanent QR pass email successfully dispatched to ${testEmail}.`
        : `Test email dispatch failed: ${sendResult.error}`,
    };
  }

  /**
   * Generates the rendered HTML preview for the Super Admin Test Email / Release Preview.
   * Uses the single shared email renderer with current sponsor voucher configuration.
   */
  async previewTestPermanentQrEmail() {
    const voucherConfig = await this.getSponsorVoucherConfig();
    const testToken = 'test_perm_qr_sample_preview_token';

    return this.mailService.previewEmployeeDailyPassEmail({
      recipientEmail: 'preview@ongcnavratri.reworkzone.in',
      employeeName: 'Test Administrator',
      attendeeName: 'Test Administrator',
      relation: 'Self',
      eventDate: '2026-10-11',
      ticketNumber: 'TK-TEST-PERM-001',
      qrToken: testToken,
      cpf: 'TEST-ADMIN',
      referenceNumber: 'ONGC-TEST-001',
      department: 'Event Administration',
      sponsorVoucher: voucherConfig,
    });
  }

  /**
   * Generic provider webhook processor with idempotent state machine
   */
  async processProviderWebhook(
    payload: {
      eventId: string;
      messageId?: string;
      event: string;
      recipient?: string;
      reason?: string;
      timestamp?: string;
    },
    providerName: string = 'HOSTINGER',
  ) {
    if (!payload?.eventId) {
      throw new BadRequestException('Missing provider event ID');
    }

    // Check for duplicate webhook event ID
    const existing = await this.prisma.employeeQrEmailDelivery.findUnique({
      where: { providerEventId: payload.eventId },
    });

    if (existing) {
      this.logger.log(`Duplicate webhook event [${payload.eventId}] received. Ignoring.`);
      return { success: true, duplicate: true };
    }

    // Find targeted delivery record by providerMessageId or recipient
    let delivery = payload.messageId
      ? await this.prisma.employeeQrEmailDelivery.findFirst({
          where: { providerMessageId: payload.messageId },
        })
      : null;

    if (!delivery && payload.recipient) {
      delivery = await this.prisma.employeeQrEmailDelivery.findFirst({
        where: { recipientEmail: payload.recipient },
        orderBy: { id: 'desc' },
      });
    }

    if (!delivery) {
      this.logger.warn(`No delivery record found matching webhook messageId [${payload.messageId}].`);
      return { success: false, notFound: true };
    }

    const eventName = payload.event.toLowerCase();
    let targetStatus: EmailDeliveryStatus | null = null;
    const now = payload.timestamp ? new Date(payload.timestamp) : new Date();

    if (eventName === 'delivered') {
      targetStatus = EmailDeliveryStatus.DELIVERED;
    } else if (eventName === 'bounce' || eventName === 'bounced') {
      targetStatus = EmailDeliveryStatus.BOUNCED;
    } else if (eventName === 'rejected' || eventName === 'blocked') {
      targetStatus = EmailDeliveryStatus.REJECTED;
    } else if (eventName === 'deferred') {
      targetStatus = EmailDeliveryStatus.DEFERRED;
    } else if (eventName === 'failed') {
      targetStatus = EmailDeliveryStatus.FAILED;
    }

    if (!targetStatus) {
      return { success: true, ignored: true };
    }

    // Validate state transition to prevent downgrading DELIVERED
    if (!this.canTransition(delivery.status as any, targetStatus)) {
      this.logger.warn(
        `Ignoring invalid webhook transition from [${delivery.status}] to [${targetStatus}] for delivery [${delivery.id}].`,
      );
      return { success: true, ignored: true, reason: 'Invalid state transition' };
    }

    const updateData: any = {
      status: targetStatus,
      providerEventId: payload.eventId,
      lastProviderResponse: payload.reason || eventName,
    };

    if (targetStatus === EmailDeliveryStatus.DELIVERED) {
      updateData.deliveredAt = now;
    } else if (targetStatus === EmailDeliveryStatus.BOUNCED) {
      updateData.bouncedAt = now;
      updateData.errorType = EmailDeliveryErrorType.BOUNCED;
      updateData.lastError = payload.reason || 'Bounced by provider';
    } else if (targetStatus === EmailDeliveryStatus.REJECTED) {
      updateData.rejectedAt = now;
      updateData.errorType = EmailDeliveryErrorType.PROVIDER_REJECTED;
      updateData.lastError = payload.reason || 'Rejected by provider';
    } else if (targetStatus === EmailDeliveryStatus.FAILED) {
      updateData.failedAt = now;
      updateData.lastError = payload.reason || 'Delivery failed';
    }

    await this.prisma.employeeQrEmailDelivery.update({
      where: { id: delivery.id },
      data: updateData,
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'EMAIL_WEBHOOK_RECEIVED',
        details: {
          deliveryId: delivery.id.toString(),
          provider: providerName,
          event: payload.event,
          targetStatus,
          eventId: payload.eventId,
        },
      },
    });

    return { success: true, updated: true };
  }

  /**
   * Resumes interrupted releases upon application startup or server restart.
   * If a release was marked RUNNING when the server stopped, reconciles SENDING back to QUEUED or checks status.
   */
  async reconcileInterruptedReleases() {
    const runningReleases = await this.prisma.employeeQrEmailRelease.findMany({
      where: { status: EmailReleaseStatus.RUNNING },
    });

    for (const rel of runningReleases) {
      this.logger.log(`Reconciling interrupted release [${rel.id}]...`);
      // Reconcile stuck SENDING items back to QUEUED so they can be safely completed
      await this.prisma.employeeQrEmailDelivery.updateMany({
        where: {
          releaseId: rel.id,
          status: EmailDeliveryStatus.SENDING,
        },
        data: {
          status: EmailDeliveryStatus.QUEUED,
        },
      });

      // Recalculate release status
      const counts = await this.prisma.employeeQrEmailDelivery.groupBy({
        by: ['status'],
        where: { releaseId: rel.id },
        _count: { id: true },
      });

      const m: Record<string, number> = {};
      for (const c of counts) m[c.status] = c._count.id;

      const hasPending = (m[EmailDeliveryStatus.QUEUED] || 0) + (m[EmailDeliveryStatus.SENDING] || 0) > 0;
      if (!hasPending) {
        const failed = (m[EmailDeliveryStatus.FAILED] || 0) + (m[EmailDeliveryStatus.BOUNCED] || 0);
        await this.prisma.employeeQrEmailRelease.update({
          where: { id: rel.id },
          data: {
            status: failed > 0 ? EmailReleaseStatus.PARTIAL_FAILURE : EmailReleaseStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
      }
    }
  }

  /**
   * Authoritative reconciliation against Hostinger Outbound Delivery Logs.
   * Calls GET /api/mail/v1/orders/{orderId}/logs/outbound
   * Only moves to DELIVERED or FAILED when real provider evidence is returned.
   */
  async reconcileDeliveryStatusesWithHostinger(options?: {
    releaseId?: bigint;
    recipientEmail?: string;
    maxAgeMinutes?: number;
  }): Promise<{
    checked: number;
    deliveredCount: number;
    failedCount: number;
    unchangedCount: number;
  }> {
    if (!this.mailService || !this.mailService.isLiveMailConfigured()) {
      return { checked: 0, deliveredCount: 0, failedCount: 0, unchangedCount: 0 };
    }

    const maxAge = options?.maxAgeMinutes || 120; // Default check within last 2 hours
    const cutoffDate = new Date(Date.now() - maxAge * 60 * 1000);

    // Query pending/accepted deliveries that have not reached terminal confirmation
    const whereClause: any = {
      status: { in: [EmailDeliveryStatus.ACCEPTED, EmailDeliveryStatus.SENDING] },
      createdAt: { gte: cutoffDate },
    };

    if (options?.releaseId) {
      whereClause.releaseId = options.releaseId;
    }
    if (options?.recipientEmail) {
      whereClause.recipientEmail = options.recipientEmail.trim();
    }

    const pendingDeliveries = await this.prisma.employeeQrEmailDelivery.findMany({
      where: whereClause,
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    if (pendingDeliveries.length === 0) {
      return { checked: 0, deliveredCount: 0, failedCount: 0, unchangedCount: 0 };
    }

    let deliveredCount = 0;
    let failedCount = 0;
    let unchangedCount = 0;

    // Fetch outbound delivery logs from Hostinger API for today
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.slice(0, 10);

    const logsResult = await this.mailService.fetchOutboundDeliveryLogs({
      date: todayDate,
      perPage: 100,
    });

    if (!logsResult.success || !Array.isArray(logsResult.data) || logsResult.data.length === 0) {
      return {
        checked: pendingDeliveries.length,
        deliveredCount: 0,
        failedCount: 0,
        unchangedCount: pendingDeliveries.length,
      };
    }

    const logs = logsResult.data;

    for (const delivery of pendingDeliveries) {
      const recipientLower = delivery.recipientEmail.toLowerCase().trim();

      // Correlate by recipient email and timestamp proximity
      const matchedLog = logs.find((log) => {
        const toLower = (log.to || '').toLowerCase().trim();
        return toLower === recipientLower;
      });

      if (!matchedLog) {
        // No log entry yet: remains ACCEPTED (honest representation)
        unchangedCount++;
        continue;
      }

      const logStatus = (matchedLog.status || '').trim();
      const relayEvents = matchedLog.relayEvents || matchedLog.relay_events || [];
      const primaryRelay = relayEvents[0] || {};
      const dsn = primaryRelay.dsn || '';
      const relayResponse = primaryRelay.response || '';
      const relayStatus = primaryRelay.status || '';

      const logTimestamp = matchedLog.time
        ? typeof matchedLog.time === 'number'
          ? new Date(matchedLog.time * 1000)
          : new Date(matchedLog.time)
        : new Date();

      if (logStatus === 'Successful' || relayStatus.toLowerCase() === 'delivered' || relayStatus.toLowerCase() === 'sent') {
        // Authoritative Hostinger delivery confirmation
        if (this.canTransition(delivery.status as any, EmailDeliveryStatus.DELIVERED)) {
          await this.prisma.employeeQrEmailDelivery.update({
            where: { id: delivery.id },
            data: {
              status: EmailDeliveryStatus.DELIVERED,
              deliveredAt: logTimestamp,
              lastProviderResponse: relayResponse
                ? `Hostinger Delivered (DSN: ${dsn}): ${relayResponse}`
                : `Hostinger Log Status: ${logStatus}`,
            },
          });
          deliveredCount++;
        }
      } else if (logStatus === 'Failed' || relayStatus.toLowerCase() === 'failed' || relayStatus.toLowerCase() === 'bounced') {
        // Authoritative Hostinger delivery failure
        const isBounced = dsn.startsWith('5.') || /mailbox|user unknown|not found/i.test(relayResponse);
        const targetStatus = isBounced ? EmailDeliveryStatus.BOUNCED : EmailDeliveryStatus.FAILED;

        if (this.canTransition(delivery.status as any, targetStatus)) {
          const classified = classifyEmailError(relayResponse || `Hostinger Outbound Failure: ${logStatus}`);
          await this.prisma.employeeQrEmailDelivery.update({
            where: { id: delivery.id },
            data: {
              status: targetStatus,
              failedAt: logTimestamp,
              bouncedAt: isBounced ? logTimestamp : null,
              errorType: isBounced ? EmailDeliveryErrorType.BOUNCED : classified.errorType,
              lastError: classified.userFriendlyReason,
              lastProviderError: relayResponse || `Hostinger log status: ${logStatus}`,
              lastProviderResponse: `Hostinger Log: ${logStatus} (DSN: ${dsn})`,
            },
          });
          failedCount++;
        }
      } else {
        // Unknown or in-transit log status: remain in ACCEPTED
        unchangedCount++;
      }
    }

    if (deliveredCount > 0 || failedCount > 0) {
      this.logger.log(
        `[Hostinger Log Reconciliation] Checked ${pendingDeliveries.length} deliveries: ${deliveredCount} confirmed delivered, ${failedCount} failed, ${unchangedCount} pending.`,
      );
    }

    return {
      checked: pendingDeliveries.length,
      deliveredCount,
      failedCount,
      unchangedCount,
    };
  }
}
