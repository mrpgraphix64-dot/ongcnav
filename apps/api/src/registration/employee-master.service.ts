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

export type MobileState = 'VALID' | 'MISSING' | 'INVALID';

export interface MobileInspectionResult {
  state: MobileState;
  value: string | null;
  rawValue?: string;
  reason?: string;
}

export interface MasterRowValidationPreview {
  row: number;
  cpfNo: string;
  mobileNo: string | null;
  status: 'VALID' | 'INVALID' | 'DUPLICATE' | 'CONFLICT' | 'IDENTICAL';
  mobileState?: MobileState;
  reason?: string;
}

export interface MasterValidationResponse {
  success: boolean;
  fileName: string;
  totalRows: number;
  sourceRows: number;
  validCount: number;
  newCount: number;
  identicalCount: number;
  conflictCount: number;
  missingMobileCount: number;
  invalidCpfCount: number;
  invalidMobileCount: number;
  duplicateCount: number;
  blankRowCount: number;
  invalidCount: number;
  currentDatabaseCount: number;
  rows: MasterRowValidationPreview[];
}

import { formatCpfString, normalizeCpf } from '@ongc/shared-types';
export { formatCpfString, normalizeCpf };

/**
 * Evaluates mobile number into 3 distinct states:
 * 1. VALID: 10-digit Indian mobile starting with 6-9
 * 2. MISSING: empty / blank / null
 * 3. INVALID: present but cannot be normalized to a valid 10-digit mobile
 */
export function inspectMobile(raw: unknown): MobileInspectionResult {
  if (raw === undefined || raw === null) {
    return { state: 'MISSING', value: null };
  }
  const str = String(raw).trim();
  if (str === '' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'n/a') {
    return { state: 'MISSING', value: null };
  }

  // Strip all non-digit characters (+91, spaces, hyphens, parentheses, etc.)
  const digits = str.replace(/\D/g, '');
  const tenDigits = digits.slice(-10);

  if (/^[6-9][0-9]{9}$/.test(tenDigits) && digits.length <= 13) {
    return { state: 'VALID', value: tenDigits };
  }

  return {
    state: 'INVALID',
    value: null,
    rawValue: str,
    reason: `Invalid mobile number: "${str}" cannot be normalized to a 10-digit Indian mobile starting with 6-9`,
  };
}

export function normalizeMobile(raw: unknown): string | null {
  const result = inspectMobile(raw);
  return result.state === 'VALID' ? result.value : null;
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
    const seenCpfInFile = new Map<string, { rowNum: number; mobileNo: string | null }>();
    const validCandidateCpfs = new Set<string>();

    let blankRowCount = 0;
    let invalidCpfCount = 0;
    let invalidMobileCount = 0;
    let duplicateCount = 0;
    let conflictCount = 0;
    let missingMobileCount = 0;

    // Step 1: Row-level syntactic validation & in-file duplicate detection
    for (let i = 0; i < dataRows.length; i++) {
      const rowNum = i + 2; // Row 1 is header
      const rawCpf = String(dataRows[i][cpfIndex] ?? '').trim();
      const rawMobile = dataRows[i][mobileIndex];

      // Empty row check
      if (!rawCpf && (rawMobile === undefined || rawMobile === null || String(rawMobile).trim() === '')) {
        blankRowCount++;
        continue;
      }

      const cleanCpf = normalizeCpf(rawCpf);
      const mobileRes = inspectMobile(rawMobile);

      // Check CPF validity (must be 5 or 6 numeric digits)
      if (!cleanCpf) {
        invalidCpfCount++;
        previewRows.push({
          row: rowNum,
          cpfNo: rawCpf || '(empty)',
          mobileNo: mobileRes.value,
          status: 'INVALID',
          mobileState: mobileRes.state,
          reason: 'CPF must contain 5 or 6 numeric digits',
        });
        continue;
      }

      // Check Mobile validity: MISSING is allowed (valid master record), INVALID is rejected
      if (mobileRes.state === 'INVALID') {
        invalidMobileCount++;
        previewRows.push({
          row: rowNum,
          cpfNo: cleanCpf,
          mobileNo: mobileRes.rawValue || '(invalid)',
          status: 'INVALID',
          mobileState: 'INVALID',
          reason: mobileRes.reason || 'Invalid 10-digit mobile number',
        });
        continue;
      }

      if (mobileRes.state === 'MISSING') {
        missingMobileCount++;
      }

      // In-file duplicate check
      if (seenCpfInFile.has(cleanCpf)) {
        const firstSeen = seenCpfInFile.get(cleanCpf)!;
        if (firstSeen.mobileNo === mobileRes.value) {
          duplicateCount++;
          previewRows.push({
            row: rowNum,
            cpfNo: cleanCpf,
            mobileNo: mobileRes.value,
            status: 'DUPLICATE',
            mobileState: mobileRes.state,
            reason: `Duplicate CPF in file (first seen at row ${firstSeen.rowNum})`,
          });
        } else {
          conflictCount++;
          previewRows.push({
            row: rowNum,
            cpfNo: cleanCpf,
            mobileNo: mobileRes.value,
            status: 'CONFLICT',
            mobileState: mobileRes.state,
            reason: `Conflicting mobile numbers in file for CPF ${cleanCpf} (Row ${firstSeen.rowNum}: ${firstSeen.mobileNo || 'MISSING'} vs Row ${rowNum}: ${mobileRes.value || 'MISSING'})`,
          });
        }
        continue;
      }

      seenCpfInFile.set(cleanCpf, { rowNum, mobileNo: mobileRes.value });
      validCandidateCpfs.add(cleanCpf);

      previewRows.push({
        row: rowNum,
        cpfNo: cleanCpf,
        mobileNo: mobileRes.value,
        status: 'VALID',
        mobileState: mobileRes.state,
        reason: mobileRes.state === 'MISSING' ? 'Mobile number missing (record valid with null mobile)' : '-',
      });
    }

    // Step 2: Cross-check valid candidates against existing database master records
    let newCount = 0;
    let identicalCount = 0;

    if (validCandidateCpfs.size > 0) {
      const existingRecords = await this.prisma.ongcEmployeeMaster.findMany({
        where: { cpf: { in: Array.from(validCandidateCpfs) } },
        select: { cpf: true, mobile: true },
      });

      const existingMap = new Map<string, string | null>();
      for (const rec of existingRecords) {
        existingMap.set(rec.cpf, rec.mobile);
      }

      for (const item of previewRows) {
        if (item.status === 'VALID') {
          if (existingMap.has(item.cpfNo)) {
            const dbMobile = existingMap.get(item.cpfNo);
            const isMatch =
              (dbMobile === null && item.mobileNo === null) ||
              (dbMobile !== null && item.mobileNo !== null && dbMobile === item.mobileNo);

            if (isMatch) {
              item.status = 'IDENTICAL';
              item.reason = 'CPF already exists with matching mobile number';
              identicalCount++;
            } else {
              item.status = 'CONFLICT';
              item.reason = `CPF already exists with different mobile (${dbMobile || 'MISSING'})`;
              conflictCount++;
            }
          } else {
            newCount++;
          }
        }
      }
    }

    const currentDatabaseCount = await this.prisma.ongcEmployeeMaster.count();
    const validCount = newCount + identicalCount + conflictCount;
    const invalidCount = invalidCpfCount + invalidMobileCount;
    const sourceRows = dataRows.length;

    return {
      success: true,
      fileName: originalName || 'master_data.csv',
      totalRows: sourceRows,
      sourceRows,
      validCount,
      newCount,
      identicalCount,
      conflictCount,
      missingMobileCount,
      invalidCpfCount,
      invalidMobileCount,
      duplicateCount,
      blankRowCount,
      invalidCount,
      currentDatabaseCount,
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
    const validRows: Array<{ cpfNo: string; mobileNo: string | null }> = [];
    let invalidCount = 0;

    for (const r of dto.rows) {
      const cCpf = normalizeCpf(r.cpfNo);
      const mRes = inspectMobile(r.mobileNo);

      if (cCpf && mRes.state !== 'INVALID' && !seenCpf.has(cCpf)) {
        seenCpf.add(cCpf);
        validRows.push({ cpfNo: cCpf, mobileNo: mRes.value });
      } else {
        invalidCount++;
      }
    }

    if (validRows.length === 0) {
      throw new BadRequestException('None of the submitted rows passed CPF validation.');
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
              mobile: c.mobileNo,
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

      const existingMap = new Map<string, string | null>();
      for (const rec of existingRecords) {
        existingMap.set(rec.cpf, rec.mobile);
      }

      const toInsert: Array<{ cpf: string; mobile: string | null; name: string }> = [];

      for (const row of validRows) {
        if (!existingMap.has(row.cpfNo)) {
          toInsert.push({
            cpf: row.cpfNo,
            mobile: row.mobileNo,
            name: '',
          });
          addedCount++;
        } else {
          const existingMobile = existingMap.get(row.cpfNo);
          const isIdentical =
            (existingMobile === null && row.mobileNo === null) ||
            (existingMobile !== null && row.mobileNo !== null && existingMobile === row.mobileNo);

          if (isIdentical) {
            unchangedCount++;
          } else if (existingMobile !== null && row.mobileNo === null) {
            // Existing CPF has valid mobile, incoming has missing mobile:
            // DEFAULT RULE: Keep existing mobile! Do NOT erase with null!
            unchangedCount++;
          } else if (existingMobile === null && row.mobileNo !== null) {
            // Existing had no mobile, incoming has valid mobile: update with new mobile
            await tx.ongcEmployeeMaster.update({
              where: { cpf: row.cpfNo },
              data: { mobile: row.mobileNo },
            });
            updatedCount++;
          } else {
            // Both are different valid mobile numbers -> Conflict
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
      `[EMPLOYEE_MASTER] Master update: +${addedCount} added, ${unchangedCount} unchanged, ${updatedCount} updated, ${conflictCount} conflicts by user ${adminUser?.id || 'admin'}.`,
    );

    return {
      success: true,
      mode: MasterImportMode.ADD_UPDATE,
      added: addedCount,
      unchanged: unchangedCount,
      conflicts: conflictCount,
      updated: updatedCount,
      invalid: invalidCount,
      message: `Master update complete: ${addedCount} added, ${updatedCount} updated, ${unchangedCount} unchanged, ${conflictCount} conflicts skipped.`,
    };
  }

  /**
   * Export all ONGC Employee Master records to clean CSV.
   * Columns: CPF NO,Mobile No
   * For missing mobile: 12346,
   */
  async exportMasterToCsv(): Promise<string> {
    const records = await this.prisma.ongcEmployeeMaster.findMany({
      orderBy: { cpf: 'asc' },
      select: { cpf: true, mobile: true },
    });

    let csv = 'CPF NO,Mobile No\r\n';
    for (const r of records) {
      csv += `${r.cpf},${r.mobile || ''}\r\n`;
    }
    return csv;
  }

  // --- PRIVATE UTILITIES ---

  private extractRowsFromFile(fileBufferOrText: Buffer | string): any[][] {
    try {
      const workbook =
        typeof fileBufferOrText === 'string'
          ? XLSX.read(fileBufferOrText, { type: 'string', raw: false, cellText: true })
          : XLSX.read(fileBufferOrText, { type: 'buffer', raw: false, cellText: true });

      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) return [];
      const sheet = workbook.Sheets[firstSheetName];
      return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as any[][];
    } catch {
      // Fallback simple CSV parsing if XLSX parser fails
      const text =
        typeof fileBufferOrText === 'string'
          ? fileBufferOrText
          : fileBufferOrText.toString('utf-8');

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      return lines.map((line) => {
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
