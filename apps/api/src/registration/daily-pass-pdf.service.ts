import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  getEventDayTheme,
  EventDayTheme,
  buildDailyEmployeePassPresentation,
  DailyEmployeePassPresentation,
} from '@ongc/shared-types';
import * as QRCode from 'qrcode';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

@Injectable()
export class DailyPassPdfService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a high-quality, date-specific A4 PDF ticket for a DailyEmployeePass.
   * Uses the EXACT same existing qrToken as the DailyEmployeePass without generating a new token.
   */
  async generateDailyPassPdf(qrToken: string): Promise<Buffer> {
    if (!qrToken || typeof qrToken !== 'string') {
      throw new NotFoundException('Invalid pass token');
    }

    const cleanToken = qrToken.trim();

    // 1. Look up the DailyEmployeePass by qrToken with full relations
    const pass = await this.prisma.dailyEmployeePass.findUnique({
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

    if (!pass) {
      throw new NotFoundException('Daily pass not found');
    }

    const attendee = pass.attendee;
    const familyMember = attendee.familyMember;
    const primaryEmployee = familyMember?.employee || attendee.employee;

    const attendeeName = familyMember ? familyMember.name : (primaryEmployee?.name || attendee.name || 'Attendee');
    const isFamily = !!familyMember;
    const relation = familyMember ? familyMember.relation : 'Self';
    const employeeName = primaryEmployee?.name || attendeeName;
    const employeeCpf = primaryEmployee?.cpf || 'N/A';
    const department = primaryEmployee?.department || 'EWC Ahmedabad';
    const ticketNumber = attendee.ticketNumber || `TK-${cleanToken.substring(0, 10).toUpperCase()}`;

    const presentation: DailyEmployeePassPresentation = buildDailyEmployeePassPresentation({
      eventDate: pass.eventDate,
      ticketNumber,
      qrToken: pass.qrToken,
      status: pass.status,
      attendeeName,
      isFamily,
      relation,
      employeeName,
      employeeCpf,
      department,
    });
    const dayTheme: EventDayTheme = presentation.theme;

    // 2. Generate clean QR code PNG buffer from the EXACT existing qrToken
    const qrBuffer = await QRCode.toBuffer(pass.qrToken, {
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
        const headerH = 75;
        doc.roundedRect(cardX + 7, cardY + 7, cardW - 14, headerH, 10).fill(dayTheme.primaryColor);

        doc.fillColor('#FFFFFF')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text('ONGC NAVRATRI 2026', cardX + 7, cardY + 20, {
            width: cardW - 14,
            align: 'center',
            characterSpacing: 2,
          });

        doc.fillColor(dayTheme.secondaryColor)
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('OFFICIAL EMPLOYEE & FAMILY ENTRY E-PASS', cardX + 7, cardY + 44, {
            width: cardW - 14,
            align: 'center',
            characterSpacing: 1.5,
          });

        // ==================== HERO DAY & THEME BANNER ====================
        const bannerY = cardY + headerH + 16;
        const bannerH = 110;

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

          doc.fillColor('#66584F').fontSize(9).font('Helvetica').text('Employee CPF:', col1X, detailsY + 80);
          doc.fillColor('#1A1A1A').fontSize(10).font('Helvetica-Bold').text(presentation.employeeCpf, col1X, detailsY + 91);
        } else {
          doc.fillColor('#66584F').fontSize(9).font('Helvetica').text('Employee CPF:', col1X, detailsY + 54);
          doc.fillColor('#1A1A1A').fontSize(10).font('Helvetica-Bold').text(presentation.employeeCpf, col1X, detailsY + 65);

          doc.fillColor('#66584F').fontSize(9).font('Helvetica').text('Department / Unit:', col1X, detailsY + 80);
          doc.fillColor('#1A1A1A').fontSize(10).font('Helvetica').text(presentation.department, col1X, detailsY + 91);
        }

        doc.fillColor('#66584F').fontSize(9).font('Helvetica').text('Ticket Number:', col2X, detailsY + 54);
        doc.fillColor('#1A1A1A').fontSize(10).font('Helvetica-Bold').text(presentation.ticketNumber, col2X, detailsY + 65);

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

        // ==================== VENUE & ORGANIZER DETAILS ====================
        const venueY = qrContainerY + qrContainerH + 14;
        const venueH = 80;

        doc.roundedRect(cardX + 18, venueY, cardW - 36, venueH, 10).fill('#FAF7F2');
        doc.roundedRect(cardX + 18, venueY, cardW - 36, venueH, 10).lineWidth(1).stroke('#E5DDD3');

        doc.fillColor(dayTheme.primaryColor)
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('VENUE & ENTRY INSTRUCTIONS', cardX + 30, venueY + 12, { characterSpacing: 1 });

        doc.fillColor('#2A1810')
          .fontSize(9.5)
          .font('Helvetica-Bold')
          .text('Malaviya Cricket Ground ONGC, Mahavirnagar, ONGC Colony, Chandkheda, Ahmedabad', cardX + 30, venueY + 28);

        doc.fillColor('#66584F')
          .fontSize(9)
          .font('Helvetica')
          .text('Gates Open: From 7:00 PM  •  Organizer: Digant Art  •  Show this QR at designated employee turnstiles.', cardX + 30, venueY + 44);

        doc.fillColor('#8A2846')
          .fontSize(8.5)
          .font('Helvetica-Bold')
          .text('Notice: Pass is non-transferable. Second scan on same date will be rejected by turnstile.', cardX + 30, venueY + 60);

        // ==================== BOTTOM SECURITY FOOTER ====================
        const footerY = cardY + cardH - 30;

        doc.fillColor('#887B72')
          .fontSize(8)
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
