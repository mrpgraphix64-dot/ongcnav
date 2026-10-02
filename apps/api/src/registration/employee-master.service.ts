import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EmployeeMasterQueryDto,
  ImportMasterDto,
  MasterConflictResolution,
  MasterImportMode,
  MasterRowItemDto,
} from './dto/employee-master.dto';
import * as XLSX from 'xlsx';

export interface MasterRowValidationPreview {
  row: number;
  cpfNo: string;
  mobileNo: string;
  status: 'VALID' | 'INVALID' | 'DUPLICATE' | 'CONFLICT' | 'IDENTICAL';
  reason?: string;
}

export interface MasterValidationResponse {
  success: boolean;
  fileName: string;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  conflictCount: number;
  identicalCount: number;
  rows: MasterRowValidationPreview[];
}

export function normalizeCpf(raw: any): string | null {
  if (raw === undefined || raw === null) return null;
  const clean = String(raw).trim();
  if (/^[0-9]{5}$/.test(clean)) {
    return clean;
  }
  return null;
}

export function normalizeMobile(raw: any): string | null {
  if (raw === undefined || raw === null) return null;
  const digits = String(raw).replace(/\D/g, '');
  const tenDigits = digits.slice(-10);
  if (/^[6-9][0-9]{9}$/.test(tenDigits)) {
    return tenDigits;
  }
  return null;
}

@Injectable()
export class EmployeeMasterService {
  private readonly logger = new Logger(EmployeeMasterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List paginated ONGC Employee Master records for the admin directory.
   */
  async listMasterRecords(query: EmployeeMasterQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { cpf: { contains: q, mode: 'insensitive' } },
        { mobile: { contains: q, mode: 'insensitive' } },
      ];
    }

    const sortField = query.sortBy || 'updatedAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy: any = { [sortField]: sortOrder };

    const [total, rawRecords, latestRecord] = await Promise.all([
      this.prisma.ongcEmployeeMaster.count({ where }),
      this.prisma.ongcEmployeeMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.ongcEmployeeMaster.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);

    const records = rawRecords.map((r) => ({
      id: r.cpf,
      cpfNo: r.cpf,
      mobileNo: r.mobile,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      records,
      total,
      page,
      totalPages,
      limit,
      lastUpdated: latestRecord?.updatedAt ? latestRecord.updatedAt.toISOString() : null,
    };
  }

  /**
   * Parse uploaded Excel or CSV file and return pre-import validation preview.
   * Does NOT alter the database.
   */
  async validateFile(
    fileBufferOrText: Buffer | string,
    originalName?: string,
  ): Promise<MasterValidationResponse> {
    const rawRows = this.extractRowsFromFile(fileBufferOrText);
    if (!rawRows || rawRows.length === 0) {
      throw new BadRequestException('The uploaded file is empty or contains no data.');
    }

    const headerRow = rawRows[0].map((h: any) => String(h || '').trim());
    const cpfIndex = this.findHeaderIndex(headerRow, [
      'cpfno',
      'cpf',
      'cpfnumber',
      'cpfnum',
      'empcpf',
      'employeecpf',
    ]);
    const mobileIndex = this.findHeaderIndex(headerRow, [
      'mobileno',
      'mobile',
      'mobilenumber',
      'phoneno',
      'phone',
      'contactno',
      'contact',
    ]);

    if (cpfIndex === -1 || mobileIndex === -1) {
      throw new BadRequestException(
        'Missing required columns: file must contain "CPF NO" and "Mobile No" headers.',
      );
    }

    const dataRows = rawRows.slice(1);
    if (dataRows.length === 0) {
      throw new BadRequestException('The uploaded file contains headers but no data rows.');
    }

    const previewRows: MasterRowValidationPreview[] = [];
    const seenCpfInFile = new Set<string>();
    const validCandidateCpfs = new Set<string>();

    // Step 1: Client/row-level syntactic validation & in-file duplicate detection
    for (let i = 0; i < dataRows.length; i++) {
      const rowNum = i + 2; // Row 1 is header
      const rawCpf = String(dataRows[i][cpfIndex] ?? '').trim();
      const rawMobile = String(dataRows[i][mobileIndex] ?? '').trim();

      // Empty row check
      if (!rawCpf && !rawMobile) {
        continue;
      }

      const cleanCpf = normalizeCpf(rawCpf);
      const cleanMobile = normalizeMobile(rawMobile);

      if (!cleanCpf) {
        previewRows.push({
          row: rowNum,
          cpfNo: rawCpf || '(empty)',
          mobileNo: rawMobile || '(empty)',
          status: 'INVALID',
          reason: 'CPF must contain exactly 5 numeric digits',
        });
        continue;
      }

      if (!cleanMobile) {
        previewRows.push({
          row: rowNum,
          cpfNo: cleanCpf,
          mobileNo: rawMobile || '(empty)',
          status: 'INVALID',
          reason: 'Mobile must be a valid 10-digit Indian mobile number',
        });
        continue;
      }

      if (seenCpfInFile.has(cleanCpf)) {
        previewRows.push({
          row: rowNum,
          cpfNo: cleanCpf,
          mobileNo: cleanMobile,
          status: 'DUPLICATE',
          reason: 'CPF already exists in file',
        });
        continue;
      }

      seenCpfInFile.add(cleanCpf);
      validCandidateCpfs.add(cleanCpf);

      previewRows.push({
        row: rowNum,
        cpfNo: cleanCpf,
        mobileNo: cleanMobile,
        status: 'VALID',
        reason: '-',
      });
    }

    // Step 2: Cross-check valid candidates against existing database master records
    if (validCandidateCpfs.size > 0) {
      const existingRecords = await this.prisma.ongcEmployeeMaster.findMany({
        where: { cpf: { in: Array.from(validCandidateCpfs) } },
        select: { cpf: true, mobile: true },
      });

      const existingMap = new Map<string, string>();
      for (const rec of existingRecords) {
        existingMap.set(rec.cpf, rec.mobile);
      }

      for (const item of previewRows) {
        if (item.status === 'VALID' && existingMap.has(item.cpfNo)) {
          const dbMobile = existingMap.get(item.cpfNo)!;
          if (dbMobile === item.mobileNo) {
            item.status = 'IDENTICAL';
            item.reason = 'CPF already exists with matching mobile number';
          } else {
            item.status = 'CONFLICT';
            item.reason = `CPF already exists with different mobile (${dbMobile})`;
          }
        }
      }
    }

    const validCount = previewRows.filter((r) => r.status === 'VALID').length;
    const invalidCount = previewRows.filter((r) => r.status === 'INVALID').length;
    const duplicateCount = previewRows.filter((r) => r.status === 'DUPLICATE').length;
    const conflictCount = previewRows.filter((r) => r.status === 'CONFLICT').length;
    const identicalCount = previewRows.filter((r) => r.status === 'IDENTICAL').length;

    return {
      success: true,
      fileName: originalName || 'master_data.csv',
      totalRows: previewRows.length,
      validCount,
      invalidCount,
      duplicateCount,
      conflictCount,
      identicalCount,
      rows: previewRows,
    };
  }

  /**
   * Execute actual import into the database.
   * Mode: ADD_UPDATE or REPLACE.
   */
  async executeImport(adminUser: any, dto: ImportMasterDto) {
    if (!dto.rows || dto.rows.length === 0) {
      throw new BadRequestException('No rows provided for import.');
    }

    // Sanitize and filter valid rows
    const seenCpf = new Set<string>();
    const validRows: Array<{ cpfNo: string; mobileNo: string }> = [];
    let invalidCount = 0;

    for (const r of dto.rows) {
      const cCpf = normalizeCpf(r.cpfNo);
      const cMobile = normalizeMobile(r.mobileNo);
      if (cCpf && cMobile && !seenCpf.has(cCpf)) {
        seenCpf.add(cCpf);
        validRows.push({ cpfNo: cCpf, mobileNo: cMobile });
      } else {
        invalidCount++;
      }
    }

    if (validRows.length === 0) {
      throw new BadRequestException('None of the submitted rows passed CPF and Mobile validation.');
    }

    if (dto.mode === MasterImportMode.REPLACE) {
      if (dto.confirmReplace !== true) {
        throw new BadRequestException(
          'Replace Master Data requires explicit confirmation. Please acknowledge the replacement warning.',
        );
      }

      // TRANSACTIONAL REPLACEMENT: Only replaces ongc_employee_masters table.
      // NEVER touches employees, attendees, daily_passes, daily_checkins, or historical data.
      await this.prisma.$transaction(async (tx) => {
        await tx.ongcEmployeeMaster.deleteMany({});

        // Batch insert in chunks of 500
        const chunkSize = 500;
        for (let i = 0; i < validRows.length; i += chunkSize) {
          const chunk = validRows.slice(i, i + chunkSize);
          await tx.ongcEmployeeMaster.createMany({
            data: chunk.map((c) => ({
              cpf: c.cpfNo,
              mobile: cMobileOrRaw(c.mobileNo),
              name: '',
            })),
          });
        }

        // Record AuditLog
        const adminId = adminUser?.id ? BigInt(adminUser.id) : null;
        await tx.auditLog.create({
          data: {
            userId: adminId,
            action: 'EMPLOYEE_MASTER_REPLACE',
            details: {
              action: 'REPLACE',
              adminName: adminUser?.name || 'Administrator',
              adminEmail: adminUser?.email || '',
              totalReplaced: validRows.length,
              invalidCount,
              timestamp: new Date().toISOString(),
            },
          },
        });
      });

      this.logger.log(
        `[EMPLOYEE_MASTER] Master database replaced with ${validRows.length} records by user ${adminUser?.id || 'admin'}.`,
      );

      return {
        success: true,
        mode: MasterImportMode.REPLACE,
        totalReplaced: validRows.length,
        invalid: invalidCount,
        message: `Successfully replaced master verification data with ${validRows.length} records.`,
      };
    }

    // Mode: ADD_UPDATE
    let addedCount = 0;
    let unchangedCount = 0;
    let conflictCount = 0;
    let updatedCount = 0;

    await this.prisma.$transaction(async (tx) => {
      const allCpfs = validRows.map((r) => r.cpfNo);
      const existingRecords = await tx.ongcEmployeeMaster.findMany({
        where: { cpf: { in: allCpfs } },
        select: { cpf: true, mobile: true },
      });

      const existingMap = new Map<string, string>();
      for (const rec of existingRecords) {
        existingMap.set(rec.cpf, rec.mobile);
      }

      const toInsert: Array<{ cpf: string; mobile: string; name: string }> = [];

      for (const row of validRows) {
        const existingMobile = existingMap.get(row.cpfNo);
        if (!existingMobile) {
          toInsert.push({
            cpf: row.cpfNo,
            mobile: row.mobileNo,
            name: '',
          });
          addedCount++;
        } else if (existingMobile === row.mobileNo) {
          unchangedCount++;
        } else {
          // Conflict
          if (dto.resolveConflicts === MasterConflictResolution.OVERWRITE) {
            await tx.ongcEmployeeMaster.update({
              where: { cpf: row.cpfNo },
              data: { mobile: row.mobileNo },
            });
            updatedCount++;
          } else {
            conflictCount++;
          }
        }
      }

      if (toInsert.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < toInsert.length; i += chunkSize) {
          const chunk = toInsert.slice(i, i + chunkSize);
          await tx.ongcEmployeeMaster.createMany({ data: chunk });
        }
      }

      // Record AuditLog
      const adminId = adminUser?.id ? BigInt(adminUser.id) : null;
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'EMPLOYEE_MASTER_ADD_UPDATE',
          details: {
            action: 'ADD_UPDATE',
            adminName: adminUser?.name || 'Administrator',
            adminEmail: adminUser?.email || '',
            added: addedCount,
            unchanged: unchangedCount,
            conflicts: conflictCount,
            updated: updatedCount,
            invalid: invalidCount,
            timestamp: new Date().toISOString(),
          },
        },
      });
    });

    this.logger.log(
      `[EMPLOYEE_MASTER] Master update: +${addedCount} added, ${unchangedCount} unchanged, ${conflictCount} conflicts by user ${adminUser?.id || 'admin'}.`,
    );

    return {
      success: true,
      mode: MasterImportMode.ADD_UPDATE,
      added: addedCount,
      unchanged: unchangedCount,
      conflicts: conflictCount,
      updated: updatedCount,
      invalid: invalidCount,
      message: `Master update complete: ${addedCount} added, ${unchangedCount} unchanged, ${conflictCount} conflicts skipped.`,
    };
  }

  /**
   * Export all ONGC Employee Master records to clean CSV.
   * Columns: CPF NO,Mobile No
   */
  async exportMasterToCsv(): Promise<string> {
    const records = await this.prisma.ongcEmployeeMaster.findMany({
      orderBy: { cpf: 'asc' },
      select: { cpf: true, mobile: true },
    });

    let csv = 'CPF NO,Mobile No\r\n';
    for (const r of records) {
      csv += `${r.cpf},${r.mobile}\r\n`;
    }
    return csv;
  }

  // --- PRIVATE UTILITIES ---

  private extractRowsFromFile(fileBufferOrText: Buffer | string): any[][] {
    try {
      const workbook =
        typeof fileBufferOrText === 'string'
          ? XLSX.read(fileBufferOrText, { type: 'string' })
          : XLSX.read(fileBufferOrText, { type: 'buffer' });

      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) return [];
      const sheet = workbook.Sheets[firstSheetName];
      return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
    } catch {
      // Fallback simple CSV parsing if XLSX parser fails
      const text =
        typeof fileBufferOrText === 'string'
          ? fileBufferOrText
          : fileBufferOrText.toString('utf-8');

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      return lines.map((line) => {
        // Handles comma or tab separated
        const separator = line.includes('\t') ? '\t' : ',';
        return line.split(separator).map((cell) => cell.replace(/^["']|["']$/g, '').trim());
      });
    }
  }

  private findHeaderIndex(headers: string[], matchCandidates: string[]): number {
    return headers.findIndex((h) => {
      const normalized = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return matchCandidates.some(
        (cand) => normalized === cand.toLowerCase().replace(/[^a-z0-9]/g, ''),
      );
    });
  }
}

function cMobileOrRaw(m: string): string {
  return m;
}
