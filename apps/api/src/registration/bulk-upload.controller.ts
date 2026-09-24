import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AttendeesService } from './attendees.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin Bulk Upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.REGISTRATION_STAFF)
@Controller('admin/bulk-upload')
export class BulkUploadController {
  constructor(private readonly attendeesService: AttendeesService) {}

  @Post('validate')
  @UseInterceptors(FileInterceptor('csv_file'))
  @ApiOperation({ summary: 'Validate CSV attendee upload (Laravel canonical)' })
  async validateCsv(
    @UploadedFile() file?: Express.Multer.File,
    @Body('csv_content') csvContentBody?: string,
    @Body('csvText') csvTextBody?: string,
  ) {
    const csvContent = file
      ? file.buffer.toString('utf-8')
      : csvContentBody || csvTextBody;

    if (!csvContent || csvContent.trim() === '') {
      throw new BadRequestException('CSV file or content is required.');
    }

    const analysis = await this.attendeesService.analyzeCsv(csvContent);
    const { validRows, ...summary } = analysis;

    return {
      success: true,
      fileName: file?.originalname || 'attendees_upload.csv',
      ...summary,
    };
  }

  @Post()
  @UseInterceptors(FileInterceptor('csv_file'))
  @ApiOperation({ summary: 'Execute CSV attendee import (Laravel canonical)' })
  async store(
    @UploadedFile() file?: Express.Multer.File,
    @Body('csv_content') csvContentBody?: string,
    @Body('csvText') csvTextBody?: string,
    @Body('corrected_rows') correctedRowsRaw?: any,
  ) {
    const csvContent = file
      ? file.buffer.toString('utf-8')
      : csvContentBody || csvTextBody;

    if (!csvContent || csvContent.trim() === '') {
      throw new BadRequestException('CSV file or content is required.');
    }

    let correctedRows: any[] = [];
    if (typeof correctedRowsRaw === 'string') {
      try {
        correctedRows = JSON.parse(correctedRowsRaw);
      } catch {
        correctedRows = [];
      }
    } else if (Array.isArray(correctedRowsRaw)) {
      correctedRows = correctedRowsRaw;
    }

    return this.attendeesService.importCsv(csvContent, correctedRows);
  }
}
