import { Test, TestingModule } from '@nestjs/testing';
import { DailyPassPdfService } from './daily-pass-pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('DailyPassPdfService', () => {
  let service: DailyPassPdfService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      dailyEmployeePass: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyPassPdfService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DailyPassPdfService>(DailyPassPdfService);
  });

  const mockPass = {
    id: BigInt(1),
    attendeeId: BigInt(10),
    eventDate: '2026-10-11',
    qrToken: 'valid-test-qr-token-1234567890',
    status: 'ISSUED',
    attendee: {
      name: 'Amit Sharma',
      ticketNumber: 'TK-EMP-001',
      category: 'ONGC STAFF',
      employee: {
        name: 'Amit Sharma',
        cpf: '123456',
        department: 'EWC Ahmedabad',
      },
      familyMember: null,
    },
  };

  it('generates a valid A4 PDF buffer starting with %PDF- for an employee pass', async () => {
    prisma.dailyEmployeePass.findUnique.mockResolvedValue(mockPass);

    const pdfBuffer = await service.generateDailyPassPdf('valid-test-qr-token-1234567890');

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // PDF signature check
    expect(pdfBuffer.toString('utf8', 0, 5)).toBe('%PDF-');
    expect(prisma.dailyEmployeePass.findUnique).toHaveBeenCalledWith({
      where: { qrToken: 'valid-test-qr-token-1234567890' },
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
  });

  it('generates a valid A4 PDF buffer for a family member pass', async () => {
    const mockFamilyPass = {
      ...mockPass,
      attendee: {
        ...mockPass.attendee,
        name: 'Sunita Sharma',
        ticketNumber: 'TK-EMP-F1-002',
        familyMember: {
          name: 'Sunita Sharma',
          relation: 'Spouse',
        },
      },
    };
    prisma.dailyEmployeePass.findUnique.mockResolvedValue(mockFamilyPass);

    const pdfBuffer = await service.generateDailyPassPdf('valid-test-qr-token-1234567890');

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.toString('utf8', 0, 5)).toBe('%PDF-');
  });

  it('throws NotFoundException when token is empty or invalid', async () => {
    await expect(service.generateDailyPassPdf('')).rejects.toThrow(NotFoundException);
    await expect(service.generateDailyPassPdf(null as any)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when daily pass is not found in database', async () => {
    prisma.dailyEmployeePass.findUnique.mockResolvedValue(null);

    await expect(service.generateDailyPassPdf('non-existent-token')).rejects.toThrow(
      NotFoundException,
    );
  });
});
