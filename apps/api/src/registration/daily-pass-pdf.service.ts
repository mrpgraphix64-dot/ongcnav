import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  getEventDayTheme,
  EventDayTheme,
  buildDailyEmployeePassPresentation,
  DailyEmployeePassPresentation,
} from '@ongc/shared-types';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { resolveBookingDays } from '../common/utils/attendee-booking.util';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

function getAssetPath(filename: string): string | null {
  const candidates = [
    path.join(__dirname, '../mail/assets', filename),
    path.join(__dirname, '../../src/mail/assets', filename),
    path.join(process.cwd(), 'apps/api/src/mail/assets', filename),
    path.join(process.cwd(), 'src/mail/assets', filename),
    path.join(process.cwd(), 'apps/web/public/images', filename),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

@Injectable()
export class DailyPassPdfService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a high-quality A4 PDF ticket for an employee or family entry pass.
   * Uses the EXACT same permanent qrToken without generating a new token.
   */
  async generateDailyPassPdf(qrToken: string): Promise<Buffer> {
    if (!qrToken || typeof qrToken !== 'string') {
      throw new NotFoundException('Invalid pass token');
    }

    const cleanToken = qrToken.trim();

    // 1. Look up the DailyEmployeePass by qrToken or fallback to Attendee permanent token
    let pass: any = null;
    try {
      pass = await this.prisma.dailyEmployeePass.findUnique({
        where: { qrToken: cleanToken },
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
    } catch {}

    let attendee: any = null;
    let eventDate = '2026-10-11';
    let passStatus = 'ACTIVE';

    if (pass) {
      attendee = pass.attendee;
      eventDate = pass.eventDate;
      passStatus = pass.status;
    } else if (this.prisma.attendee && typeof this.prisma.attendee.findFirst === 'function') {
      attendee = await this.prisma.attendee.findFirst({
        where: {
          OR: [{ qrCodeToken: cleanToken }, { ticketNumber: cleanToken }],
        },
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
        throw new NotFoundException('Daily pass not found');
      }

      const days = resolveBookingDays(attendee);
      eventDate = days[0] || '2026-10-11';
      passStatus = attendee.status || 'ACTIVE';
    } else {
      throw new NotFoundException('Daily pass not found');
    }

    const familyMember = attendee.familyMember;
    const primaryEmployee = familyMember?.employee || attendee.employee;

    const attendeeName = familyMember ? familyMember.name : (primaryEmployee?.name || attendee.name || 'Attendee');
    const isFamily = !!familyMember;
    const relation = familyMember ? familyMember.relation : 'Self';
    const employeeName = primaryEmployee?.name || attendeeName;
    const employeeCpf = primaryEmployee?.cpf || 'N/A';
    const referenceNumber = primaryEmployee?.referenceNumber || employeeCpf;
    const department = primaryEmployee?.department || 'EWC Ahmedabad';
    const ticketNumber = attendee.ticketNumber || `TK-${cleanToken.substring(0, 10).toUpperCase()}`;

    const presentation: DailyEmployeePassPresentation = buildDailyEmployeePassPresentation({
      eventDate,
      ticketNumber,
      qrToken: cleanToken,
      status: passStatus,
      attendeeName,
      isFamily,
      relation,
      employeeName,
      employeeCpf,
      referenceNumber,
      department,
    });
    const dayTheme: EventDayTheme = presentation.theme;

    // 2. Generate clean QR code PNG buffer from the EXACT existing qrToken
    const qrBuffer = await QRCode.toBuffer(cleanToken, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#1A1A1A',
        light: '#FFFFFF',
      },
    });

    // 3. Render PDF document via PDFKit
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 0,
          info: {
            Title: `ONGC Navratri 2026 - Night ${presentation.nightNumber} Pass (${presentation.themeTitle})`,
            Author: 'ONGC Navratri Festival & Digant Art',
            Subject: `Official Entry Pass for ${presentation.attendeeName} - ${presentation.eventDateFormatted}`,
            Keywords: 'ONGC, Navratri, Garba, Employee Pass, Entry Ticket',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        // Dimensions
        const pageWidth = 595.28;
        const pageHeight = 841.89;

        // Page Background: Soft Ivory
        doc.rect(0, 0, pageWidth, pageHeight).fill('#FBF8F3');

        // Outer Ticket Container (Margins: 30pt horizontal, 30pt vertical)
        const cardX = 30;
        const cardY = 30;
        const cardW = pageWidth - 60;
        const cardH = pageHeight - 60;

        // Card Base: Pure white body, no dark gradient block
        doc.roundedRect(cardX, cardY, cardW, cardH, 16).fill('#FFFFFF');

        // Outer Accent Border in Day Theme Secondary (Antique Gold)
        doc.roundedRect(cardX, cardY, cardW, cardH, 16).lineWidth(2).stroke(dayTheme.secondaryColor);

        // Inner Border in Day Theme Primary Color
        doc.roundedRect(cardX + 6, cardY + 6, cardW - 12, cardH - 12, 12).lineWidth(1).stroke(dayTheme.primaryColor);

        // ==================== TOP BRAND HEADER ====================
        const headerH = 105;
        doc.roundedRect(cardX + 7, cardY + 7, cardW - 14, headerH, 10).fill('#FFFFFF');
        doc.roundedRect(cardX + 7, cardY + 7, cardW - 14, headerH, 10).lineWidth(1.5).stroke(dayTheme.secondaryColor);

        // 1. Primary Event Emblem: Official ONGC Navratri 2026 Festival Emblem
        const emblemPath = getAssetPath('ongc-navratri-2026-festival-emblem.png');
        if (emblemPath) {
          try {
            doc.image(emblemPath, cardX + (cardW - 160) / 2, cardY + 12, {
              fit: [160, 52],
              align: 'center',
            });
          } catch {}
        } else {
          doc.fillColor(dayTheme.primaryColor)
            .fontSize(16)
            .font('Helvetica-Bold')
            .text('ONGC NAVRATRI 2026', cardX + 7, cardY + 20, {
              width: cardW - 14,
              align: 'center',
              characterSpacing: 2,
            });
        }

        // 2. Title Sponsor Logo below emblem
        doc.fillColor('#C49A45')
          .fontSize(7)
          .font('Helvetica-Bold')
          .text('TITLE SPONSOR', cardX + 7, cardY + 68, {
            width: cardW - 14,
            align: 'center',
            characterSpacing: 1.5,
          });

        const sponsorPath = getAssetPath('zaira-diamond-logo.png');
        if (sponsorPath) {
          try {
            doc.image(sponsorPath, cardX + (cardW - 90) / 2, cardY + 76, {
              fit: [90, 20],
              align: 'center',
            });
          } catch {}
        }

        doc.fillColor(dayTheme.primaryColor)
          .fontSize(8.5)
          .font('Helvetica-Bold')
          .text('PERMANENT EMPLOYEE & FAMILY ENTRY E-PASS', cardX + 7, cardY + 98, {
            width: cardW - 14,
            align: 'center',
            characterSpacing: 1,
          });

        // ==================== HERO DAY & THEME BANNER ====================
        const bannerY = cardY + headerH + 12;
        const bannerH = 100;

        // Background box for Day Theme
        doc.roundedRect(cardX + 18, bannerY, cardW - 36, bannerH, 12).fill(dayTheme.bgColor);
        doc.roundedRect(cardX + 18, bannerY, cardW - 36, bannerH, 12).lineWidth(1).stroke(dayTheme.secondaryColor);

        // Left: Big Day Number
        doc.fillColor(dayTheme.primaryColor)
          .fontSize(52)
          .font('Helvetica-Bold')
          .text(dayTheme.dayLabel, cardX + 32, bannerY + 14, {
            width: 90,
            align: 'center',
          });

        doc.fillColor(dayTheme.secondaryColor)
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(dayTheme.monthLabel, cardX + 32, bannerY + 72, {
            width: 90,
            align: 'center',
            characterSpacing: 1,
          });

        // Vertical Divider line
        doc.moveTo(cardX + 130, bannerY + 14)
          .lineTo(cardX + 130, bannerY + bannerH - 14)
          .lineWidth(1)
          .stroke(dayTheme.secondaryColor);

        // Right: Day Theme & Motif
        const themeTextX = cardX + 145;
        const themeTextW = cardW - 175;

        doc.fillColor(dayTheme.primaryColor)
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(`NIGHT ${presentation.nightNumber} OF 9  •  ${dayTheme.dayOfWeek.toUpperCase()}`, themeTextX, bannerY + 18, {
            characterSpacing: 1,
          });

        doc.fillColor(dayTheme.primaryColor)
          .fontSize(22)
          .font('Helvetica-Bold')
          .text(presentation.themeTitle, themeTextX, bannerY + 34, {
            width: themeTextW,
            characterSpacing: 1,
          });

        doc.fillColor('#5A4A42')
          .fontSize(10)
          .font('Helvetica')
          .text(`Visual Motif: ${presentation.motifName}`, themeTextX, bannerY + 64);

        doc.fillColor(dayTheme.primaryColor)
          .fontSize(10.5)
          .font('Helvetica-Bold')
          .text(`VALID STRICTLY ON: ${presentation.eventDateFormatted.toUpperCase()}`, themeTextX, bannerY + 82);

        // ==================== ATTENDEE DETAILS CARD ====================
        const detailsY = bannerY + bannerH + 16;
        const detailsH = 120;

        doc.roundedRect(cardX + 18, detailsY, cardW - 36, detailsH, 10).fill('#FBF9F6');
        doc.roundedRect(cardX + 18, detailsY, cardW - 36, detailsH, 10).lineWidth(1).stroke('#E5DDD3');

        // Attendee Name in primary color
        doc.fillColor(dayTheme.primaryColor)
          .fontSize(18)
          .font('Helvetica-Bold')
          .text(presentation.attendeeName, cardX + 34, detailsY + 14, { width: cardW - 68 });

        // Pass Type Badge
        doc.fillColor(dayTheme.secondaryColor)
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(`PASS HOLDER: ${presentation.passHolderLabel.toUpperCase()}`, cardX + 34, detailsY + 36, {
            characterSpacing: 0.5,
          });

        // 2-column metadata
        const col1X = cardX + 34;
        const col2X = cardX + 280;

        if (presentation.isFamily) {
          doc.fillColor('#66584F').fontSize(9).font('Helvetica').text('Primary Employee:', col1X, detailsY + 54);
          doc.fillColor('#1A1A1A').fontSize(10).font('Helvetica-Bold').text(presentation.primaryEmployeeName, col1X, detailsY + 65);

          doc.fillColor('#66584F').fontSize(9).font('Helvetica').text('Ref No.:', col1X, detailsY + 80);
          doc.fillColor('#1A1A1A').fontSize(10).font('Helvetica-Bold').text(presentation.referenceNumber || presentation.employeeCpf, col1X, detailsY + 91);
        } else {
          doc.fillColor('#66584F').fontSize(9).font('Helvetica').text('Ref No.:', col1X, detailsY + 54);
          doc.fillColor('#1A1A1A').fontSize(10).font('Helvetica-Bold').text(presentation.referenceNumber || presentation.employeeCpf, col1X, detailsY + 65);

          doc.fillColor('#66584F').fontSize(9).font('Helvetica').text('Department / Unit:', col1X, detailsY + 80);
          doc.fillColor('#1A1A1A').fontSize(10).font('Helvetica').text(presentation.department, col1X, detailsY + 91);
        }

        doc.fillColor('#66584F').fontSize(9).font('Helvetica').text('Pass Status:', col2X, detailsY + 54);
        doc.fillColor('#1A1A1A').fontSize(10).font('Helvetica-Bold').text(presentation.status || 'ACTIVE', col2X, detailsY + 65);

        doc.fillColor('#66584F').fontSize(9).font('Helvetica').text('Event Date:', col2X, detailsY + 80);
        doc.fillColor(dayTheme.primaryColor).fontSize(10).font('Helvetica-Bold').text(presentation.eventDateFormatted, col2X, detailsY + 91);

        // Bottom sub-row
        doc.fillColor('#66584F').fontSize(8.5).font('Helvetica')
          .text(`Venue: ${presentation.venue.name}  •  Entry Timing: ${presentation.entryTiming}`, col1X, detailsY + 106, { width: cardW - 68 });

        // ==================== CENTERED QR CODE AREA ====================
        const qrContainerY = detailsY + detailsH + 16;
        const qrContainerH = 235;

        // Clean White Container for QR
        doc.roundedRect(cardX + 18, qrContainerY, cardW - 36, qrContainerH, 12).fill('#FFFFFF');
        doc.roundedRect(cardX + 18, qrContainerY, cardW - 36, qrContainerH, 12).lineWidth(1.5).stroke(dayTheme.secondaryColor);

        // Embedded QR image
        const qrSize = 175;
        const qrX = cardX + (cardW - qrSize) / 2;
        const qrY = qrContainerY + 14;

        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

        // Instruction badge under QR
        const warningY = qrY + qrSize + 10;
        doc.roundedRect(cardX + 40, warningY, cardW - 80, 26, 6).fill(dayTheme.bgColor);
        doc.roundedRect(cardX + 40, warningY, cardW - 80, 26, 6).lineWidth(1).stroke(dayTheme.primaryColor);

        doc.fillColor(dayTheme.primaryColor)
          .fontSize(9.5)
          .font('Helvetica-Bold')
          .text(
            `VALID STRICTLY ON ${dayTheme.fullDateLabel.toUpperCase()}  •  ONE ENTRY SCAN ONLY`,
            cardX + 40,
            warningY + 8,
            { width: cardW - 80, align: 'center', characterSpacing: 0.5 },
          );

        // ==================== VENUE & ENTRY INSTRUCTIONS ====================
        const venueY = qrContainerY + qrContainerH + 10;
        const venueH = 68;

        doc.roundedRect(cardX + 18, venueY, cardW - 36, venueH, 10).fill('#FAF7F2');
        doc.roundedRect(cardX + 18, venueY, cardW - 36, venueH, 10).lineWidth(1).stroke('#E5DDD3');

        doc.fillColor(dayTheme.primaryColor)
          .fontSize(9.5)
          .font('Helvetica-Bold')
          .text('VENUE & ENTRY INSTRUCTIONS', cardX + 26, venueY + 10, { characterSpacing: 1 });

        doc.fillColor('#2A1810')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text('Malaviya Cricket Ground ONGC, Mahavirnagar, ONGC Colony, Chandkheda, Ahmedabad', cardX + 26, venueY + 24);

        doc.fillColor('#66584F')
          .fontSize(8.5)
          .font('Helvetica')
          .text('Gates Open: 7:00 PM  •  Show this permanent QR code at designated employee turnstiles on your registered dates.', cardX + 26, venueY + 38);

        doc.fillColor('#8A2846')
          .fontSize(8)
          .font('Helvetica-Bold')
          .text('Notice: Pass is non-transferable. One entry allowed per person per registered day.', cardX + 26, venueY + 52);

        // ==================== ORGANISED BY (BOTTOM CENTER) ====================
        const orgY = venueY + venueH + 8;
        const digantPath = getAssetPath('digant-art-logo.png');

        doc.fillColor('#8A7B70')
          .fontSize(7)
          .font('Helvetica-Bold')
          .text('ORGANISED BY', cardX + 18, orgY, { width: cardW - 36, align: 'center', characterSpacing: 1.5 });

        if (digantPath) {
          try {
            doc.image(digantPath, cardX + (cardW - 40) / 2, orgY + 10, { width: 40, fit: [40, 24], align: 'center' });
          } catch {}
        }

        doc.fillColor('#7A1930')
          .fontSize(8.5)
          .font('Helvetica-Bold')
          .text('Organised by Digant Art', cardX + 18, orgY + 38, { width: cardW - 36, align: 'center' });

        doc.fillColor('#8A7B70')
          .fontSize(7.5)
          .font('Helvetica')
          .text('E-Ticketing & E-Pass System by Reworkzone.com', cardX + 18, orgY + 49, { width: cardW - 36, align: 'center' });

        // ==================== BOTTOM SECURITY FOOTER ====================
        const footerY = cardY + cardH - 22;

        doc.fillColor('#887B72')
          .fontSize(7.5)
          .font('Helvetica')
          .text(
            `Secure Token ID: ${cleanToken.substring(0, 16)}...  •  Official ONGC Entry Pass  •  Do not duplicate or share.`,
            cardX + 18,
            footerY,
            { width: cardW - 36, align: 'center' },
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
