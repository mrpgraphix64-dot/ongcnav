import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeMasterService, normalizeCpf, normalizeMobile } from './employee-master.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { MasterConflictResolution, MasterImportMode } from './dto/employee-master.dto';
import * as XLSX from 'xlsx';

describe('EmployeeMasterService', () => {
  let service: EmployeeMasterService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      ongcEmployeeMaster: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      employee: {
        count: jest.fn().mockResolvedValue(52), // existing registrations exist
        deleteMany: jest.fn(),
      },
      dailyEmployeePass: {
        count: jest.fn().mockResolvedValue(100),
        deleteMany: jest.fn(),
      },
      dailyCheckin: {
        count: jest.fn().mockResolvedValue(30),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback: any) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeMasterService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EmployeeMasterService>(EmployeeMasterService);
  });

  describe('CPF and Mobile Normalization Rules', () => {
    it('normalizes valid 5-digit and 6-digit CPF with whitespace trimming', () => {
      expect(normalizeCpf('12345')).toBe('12345');
      expect(normalizeCpf('  65432  ')).toBe('65432');
      expect(normalizeCpf('103506')).toBe('103506');
    });

    it('ensures CPF 12345 remains string "12345" across types', () => {
      expect(normalizeCpf('12345')).toBe('12345');
      expect(typeof normalizeCpf('12345')).toBe('string');
      expect(normalizeCpf(12345)).toBe('12345');
      expect(typeof normalizeCpf(12345)).toBe('string');
      expect(normalizeCpf(103506)).toBe('103506');
      expect(typeof normalizeCpf(103506)).toBe('string');
    });

    it('preserves leading zero for CPF 01234 as string "01234"', () => {
      expect(normalizeCpf('01234')).toBe('01234');
      expect(typeof normalizeCpf('01234')).toBe('string');
    });

    it('rejects 4-digit CPF 1234 rather than automatically padding with a zero', () => {
      expect(normalizeCpf('1234')).toBeNull();
      expect(normalizeCpf(1234)).toBeNull();
    });

    it('rejects 7-digit numbers', () => {
      expect(normalizeCpf('1234567')).toBeNull();
    });

    it('rejects CPF containing letters or special characters', () => {
      expect(normalizeCpf('12A45')).toBeNull();
      expect(normalizeCpf('ABCDE')).toBeNull();
      expect(normalizeCpf('12 45')).toBeNull();
      expect(normalizeCpf('12-45')).toBeNull();
    });

    it('handles bigint input safely as string and never passes CPF through BigInt internally', () => {
      // BigInt value 12345n should convert safely to string "12345"
      const bigintCpf = BigInt(12345);
      expect(normalizeCpf(bigintCpf)).toBe('12345');
      expect(typeof normalizeCpf(bigintCpf)).toBe('string');
    });

    it('rejects invalid CPF (less than 5 digits, more than 6 digits, non-numeric)', () => {
      expect(normalizeCpf('1234')).toBeNull();
      expect(normalizeCpf('1234567')).toBeNull();
      expect(normalizeCpf('12A45')).toBeNull();
      expect(normalizeCpf('')).toBeNull();
      expect(normalizeCpf(null)).toBeNull();
      expect(normalizeCpf(undefined)).toBeNull();
    });

    it('normalizes valid Indian 10-digit mobile numbers with prefixes/spaces/hyphens', () => {
      expect(normalizeMobile('9876543210')).toBe('9876543210');
      expect(normalizeMobile('+91 98765 43210')).toBe('9876543210');
      expect(normalizeMobile('098765-43210')).toBe('9876543210');
      expect(normalizeMobile('919876543210')).toBe('9876543210');
    });

    it('rejects invalid mobile numbers (too short, starting with invalid digit)', () => {
      expect(normalizeMobile('12345')).toBeNull();
      expect(normalizeMobile('5876543210')).toBeNull(); // Indian mobiles start with 6-9
      expect(normalizeMobile('abcdefghij')).toBeNull();
      expect(normalizeMobile('')).toBeNull();
      expect(normalizeMobile(null)).toBeNull();
    });
  });

  describe('validateFile (Preview)', () => {
    it('throws error when file is empty or missing content', async () => {
      await expect(service.validateFile('')).rejects.toThrow(BadRequestException);
      await expect(service.validateFile('   ')).rejects.toThrow(BadRequestException);
    });

    it('throws error when required CPF or Mobile column headers are missing', async () => {
      const invalidCsv = 'Name,Department\nJohn,IT\n';
      await expect(service.validateFile(invalidCsv)).rejects.toThrow(
        'Missing required columns: file must contain "CPF NO" and "Mobile No" headers',
      );
    });

    it('throws error when headers exist but no data rows are present', async () => {
      const emptyDataCsv = 'CPF NO,Mobile No\n';
      await expect(service.validateFile(emptyDataCsv)).rejects.toThrow(
        'The uploaded file contains headers but no data rows',
      );
    });

    it('tolerates case-insensitive and whitespace header variants', async () => {
      const csv = '  cpf no  ,  mobile no  \n12345,9876543210\n';
      const result = await service.validateFile(csv);
      expect(result.success).toBe(true);
      expect(result.validCount).toBe(1);
      expect(result.rows[0].cpfNo).toBe('12345');
      expect(result.rows[0].mobileNo).toBe('9876543210');
      expect(result.rows[0].status).toBe('VALID');
    });

    it('parses Excel (.xlsx) file buffer and preserves leading zeros and 6-digit CPFs', async () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['CPF NO', 'Mobile No'],
        ['01234', '9876543210'],
        ['12345', '9876543211'],
        ['103506', ''],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Master');
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const result = await service.validateFile(excelBuffer, 'master.xlsx');
      expect(result.success).toBe(true);
      expect(result.validCount).toBe(3);
      expect(result.rows[0].cpfNo).toBe('01234');
      expect(result.rows[0].mobileNo).toBe('9876543210');
      expect(result.rows[1].cpfNo).toBe('12345');
      expect(result.rows[2].cpfNo).toBe('103506');
      expect(result.rows[2].mobileNo).toBeNull();
      expect(result.missingMobileCount).toBe(1);
    });

    it('flags invalid CPF and invalid Mobile rows with appropriate reasons', async () => {
      const csv = `CPF NO,Mobile No
1234,9876543210
12345,12345
12346,9876543211`;
      const result = await service.validateFile(csv);
      expect(result.totalRows).toBe(3);
      expect(result.invalidCount).toBe(2);
      expect(result.validCount).toBe(1);

      expect(result.rows[0].status).toBe('INVALID');
      expect(result.rows[0].reason).toContain('5 or 6 numeric digits');

      expect(result.rows[1].status).toBe('INVALID');
      expect(result.rows[1].reason).toContain('Invalid mobile number');

      expect(result.rows[2].status).toBe('VALID');
    });

    it('detects duplicate CPFs inside the uploaded file', async () => {
      const csv = `CPF NO,Mobile No
12345,9876543210
12345,9876543210
12346,9876543211`;
      const result = await service.validateFile(csv);
      expect(result.totalRows).toBe(3);
      expect(result.duplicateCount).toBe(1);
      expect(result.validCount).toBe(2);
      expect(result.rows[1].status).toBe('DUPLICATE');
      expect(result.rows[1].reason).toContain('Duplicate CPF in file');
    });

    it('detects existing identical vs conflicting records in database', async () => {
      prisma.ongcEmployeeMaster.findMany.mockResolvedValueOnce([
        { cpf: '12345', mobile: '9876543210' }, // identical
        { cpf: '12346', mobile: '9999999999' }, // conflict (different mobile)
      ]);

      const csv = `CPF NO,Mobile No
12345,9876543210
12346,9876543211
12347,9876543212`;

      const result = await service.validateFile(csv);
      expect(result.identicalCount).toBe(1);
      expect(result.conflictCount).toBe(1);
      expect(result.newCount).toBe(1);
      expect(result.validCount).toBe(3);

      expect(result.rows[0].status).toBe('IDENTICAL');
      expect(result.rows[1].status).toBe('CONFLICT');
      expect(result.rows[1].reason).toContain('different mobile');
      expect(result.rows[2].status).toBe('VALID');
    });
  });

  describe('executeImport: ADD_UPDATE mode', () => {
    it('inserts new rows, skips unchanged rows, and tracks conflicts', async () => {
      prisma.ongcEmployeeMaster.findMany.mockResolvedValueOnce([
        { cpf: '12345', mobile: '9876543210' }, // existing identical
        { cpf: '12346', mobile: '9111111111' }, // existing conflict
      ]);

      const res = await service.executeImport(
        { id: '1', name: 'Admin User', email: 'admin@ongc.in' },
        {
          mode: MasterImportMode.ADD_UPDATE,
          rows: [
            { cpfNo: '12345', mobileNo: '9876543210' }, // unchanged
            { cpfNo: '12346', mobileNo: '9876543211' }, // conflict
            { cpfNo: '12347', mobileNo: '9876543212' }, // new
          ],
          resolveConflicts: MasterConflictResolution.SKIP,
        },
      );

      expect(res.success).toBe(true);
      expect(res.added).toBe(1);
      expect(res.unchanged).toBe(1);
      expect(res.conflicts).toBe(1);

      // AuditLog recorded
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'EMPLOYEE_MASTER_ADD_UPDATE',
          }),
        }),
      );
    });

    it('overwrites conflicting rows when resolveConflicts is OVERWRITE', async () => {
      prisma.ongcEmployeeMaster.findMany.mockResolvedValueOnce([
        { cpf: '12346', mobile: '9111111111' },
      ]);

      const res = await service.executeImport(
        { id: '1', name: 'Admin User' },
        {
          mode: MasterImportMode.ADD_UPDATE,
          rows: [{ cpfNo: '12346', mobileNo: '9876543211' }],
          resolveConflicts: MasterConflictResolution.OVERWRITE,
        },
      );

      expect(res.updated).toBe(1);
      expect(prisma.ongcEmployeeMaster.update).toHaveBeenCalledWith({
        where: { cpf: '12346' },
        data: { mobile: '9876543211' },
      });
    });
  });

  describe('executeImport: REPLACE mode', () => {
    it('requires explicit confirmation (confirmReplace: true)', async () => {
      await expect(
        service.executeImport(
          { id: '1' },
          {
            mode: MasterImportMode.REPLACE,
            rows: [{ cpfNo: '12345', mobileNo: '9876543210' }],
            confirmReplace: false,
          },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('replaces only master data and NEVER deletes employee registrations, passes, or check-ins', async () => {
      const res = await service.executeImport(
        { id: '1', name: 'Super Admin', email: 'super@ongc.in' },
        {
          mode: MasterImportMode.REPLACE,
          rows: [
            { cpfNo: '12345', mobileNo: '9876543210' },
            { cpfNo: '12346', mobileNo: '9876543211' },
          ],
          confirmReplace: true,
        },
      );

      expect(res.success).toBe(true);
      expect(res.totalReplaced).toBe(2);

      // Master table is cleared and recreated
      expect(prisma.ongcEmployeeMaster.deleteMany).toHaveBeenCalled();
      expect(prisma.ongcEmployeeMaster.createMany).toHaveBeenCalledWith({
        data: [
          { cpf: '12345', mobile: '9876543210', name: '' },
          { cpf: '12346', mobile: '9876543211', name: '' },
        ],
      });

      // Employee registrations, passes, check-ins MUST NOT be deleted
      expect(prisma.employee.deleteMany).not.toHaveBeenCalled();
      expect(prisma.dailyEmployeePass.deleteMany).not.toHaveBeenCalled();
      expect(prisma.dailyCheckin.deleteMany).not.toHaveBeenCalled();

      // AuditLog recorded
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'EMPLOYEE_MASTER_REPLACE',
          }),
        }),
      );
    });

    it('rolls back completely if database transaction encounters an error', async () => {
      prisma.ongcEmployeeMaster.createMany.mockRejectedValueOnce(
        new Error('Simulated DB Write Error'),
      );

      await expect(
        service.executeImport(
          { id: '1' },
          {
            mode: MasterImportMode.REPLACE,
            rows: [{ cpfNo: '12345', mobileNo: '9876543210' }],
            confirmReplace: true,
          },
        ),
      ).rejects.toThrow('Simulated DB Write Error');
    });
  });

  describe('listMasterRecords', () => {
    it('supports search by CPF or Mobile and returns formatted items with metadata', async () => {
      prisma.ongcEmployeeMaster.count.mockResolvedValueOnce(1);
      prisma.ongcEmployeeMaster.findMany.mockResolvedValueOnce([
        {
          cpf: '12345',
          mobile: '9876543210',
          createdAt: new Date('2026-10-01T10:00:00Z'),
          updatedAt: new Date('2026-10-02T12:00:00Z'),
        },
      ]);
      prisma.ongcEmployeeMaster.findFirst.mockResolvedValueOnce({
        updatedAt: new Date('2026-10-02T12:00:00Z'),
      });

      const res = await service.listMasterRecords({ search: '12345', page: 1, limit: 10 });
      expect(res.total).toBe(1);
      expect(res.records[0].cpfNo).toBe('12345');
      expect(res.records[0].mobileNo).toBe('9876543210');
      expect(res.lastUpdated).toBe('2026-10-02T12:00:00.000Z');
    });

    it('returns empty records array when no master records exist', async () => {
      prisma.ongcEmployeeMaster.count.mockResolvedValueOnce(0);
      prisma.ongcEmployeeMaster.findMany.mockResolvedValueOnce([]);
      prisma.ongcEmployeeMaster.findFirst.mockResolvedValueOnce(null);

      const res = await service.listMasterRecords({ page: 1, limit: 10 });
      expect(res.total).toBe(0);
      expect(res.records).toEqual([]);
      expect(res.lastUpdated).toBeNull();
    });
  });

  describe('exportMasterToCsv', () => {
    it('generates clean CSV containing CPF NO and Mobile No columns only', async () => {
      prisma.ongcEmployeeMaster.findMany.mockResolvedValueOnce([
        { cpf: '12345', mobile: '9876543210' },
        { cpf: '12346', mobile: '9898989898' },
      ]);

      const csv = await service.exportMasterToCsv();
      expect(csv).toContain('CPF NO,Mobile No');
      expect(csv).toContain('12345,9876543210');
      expect(csv).toContain('12346,9898989898');
      expect(csv).not.toContain('dob');
      expect(csv).not.toContain('doj');
      expect(csv).not.toContain('email');
    });
  });
});
