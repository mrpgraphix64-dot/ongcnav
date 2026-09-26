import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AttendeesService } from './attendees.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, AttendeeStatus } from '@ongc/shared-types';
import * as path from 'path';
import * as fs from 'fs';

@ApiTags('Admin Attendees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.EMPLOYEE_ADMIN, UserRole.REGISTRATION_STAFF)
@Controller('admin/attendees')
export class AttendeesController {
  constructor(private readonly attendeesService: AttendeesService) {}

  @Get()
  @ApiOperation({ summary: 'List primary attendees with metrics and family passes' })
  async index(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    const userRole = (req as any).user?.role;
    return this.attendeesService.index(
      {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        search,
        status,
        category,
      },
      userRole,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Quick add attendee & issue digital ticket pass' })
  async create(@Body() body: { name: string; mobile: string; email: string; category?: string }) {
    return this.attendeesService.createQuickAttendee(body);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search attendees by name, phone, ticket number or CPF' })
  async search(
    @Query('q') q: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.attendeesService.search(
      q || '',
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('status-sync')
  @ApiOperation({ summary: 'Real-time check-in status sync for attendee list' })
  async statusSync(@Query('ids') idsParam?: string | string[]) {
    const rawIds = Array.isArray(idsParam)
      ? idsParam
      : (idsParam || '').split(',').map((s) => s.trim()).filter(Boolean);
    const ids = rawIds.map((id) => BigInt(id));
    return this.attendeesService.statusSync(ids);
  }

  @Get('bulk/export')
  @ApiOperation({ summary: 'Export selected or filtered attendees to CSV' })
  async bulkExport(
    @Query('ids') idsParam: string | string[],
    @Query('search') search: string,
    @Query('status') status: string,
    @Query('category') category: string,
    @Res() res: Response,
  ) {
    const rawIds = Array.isArray(idsParam)
      ? idsParam
      : idsParam
      ? idsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const ids = rawIds.map((id) => BigInt(id));

    const result = await this.attendeesService.bulkExport({
      ids: ids.length > 0 ? ids : undefined,
      search,
      status,
      category,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.csv);
  }

  @Get('bulk/tickets')
  @ApiOperation({ summary: 'Batch printable pass cards for selected attendees' })
  async bulkTickets(@Query('ids') idsParam?: string | string[]) {
    const rawIds = Array.isArray(idsParam)
      ? idsParam
      : (idsParam || '').split(',').map((s) => s.trim()).filter(Boolean);
    const ids = rawIds.map((id) => BigInt(id));
    return this.attendeesService.bulkTickets(ids);
  }

  @Post('bulk/regenerate-qr')
  @ApiOperation({ summary: 'Regenerate QR code tokens for selected attendees' })
  async bulkRegenerateQr(@Body('ids') rawIds: (string | number)[]) {
    const ids = (rawIds || []).map((id) => BigInt(id));
    return this.attendeesService.bulkRegenerateQr(ids);
  }

  @Delete('bulk')
  @ApiOperation({ summary: 'Batch delete selected attendees' })
  async bulkDestroy(@Body('ids') rawIds: (string | number)[], @Req() req?: Request) {
    const user = req ? (req as any).user : undefined;
    const ids = (rawIds || []).map((id) => BigInt(id));
    return this.attendeesService.bulkDestroy(ids, user?.role);
  }

  @Post('bulk/validate')
  @UseInterceptors(FileInterceptor('csv_file'))
  @ApiOperation({ summary: 'Dry-run validation pass for bulk attendee CSV upload' })
  async validateBulkCsv(
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

  @Post('bulk/import')
  @UseInterceptors(FileInterceptor('csv_file'))
  @ApiOperation({ summary: 'Import validated CSV rows and issue tickets' })
  async importBulkCsv(
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

  @Get(':id')
  @ApiOperation({ summary: 'Get attendee details by ID' })
  async findOne(@Param('id') id: string) {
    return this.attendeesService.findOne(BigInt(id));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update attendee details' })
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; mobile?: string; email?: string; category?: string; status?: string },
  ) {
    return this.attendeesService.update(BigInt(id), body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update attendee status (ACTIVE, SUSPENDED, REVOKED)' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: AttendeeStatus,
  ) {
    return this.attendeesService.updateStatus(BigInt(id), status);
  }

  @Post(':id/regenerate-qr')
  @ApiOperation({ summary: 'Regenerate QR token for single attendee' })
  async regenerateQr(@Param('id') id: string) {
    return this.attendeesService.regenerateQr(BigInt(id));
  }

  @Get(':id/qr-download')
  @ApiOperation({ summary: 'Download high-resolution QR PNG for attendee' })
  async downloadQr(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.attendeesService.getQrImageBuffer(BigInt(id));
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a single attendee' })
  async destroy(@Param('id') id: string, @Req() req?: Request) {
    const user = req ? (req as any).user : undefined;
    return this.attendeesService.destroy(BigInt(id), user?.role);
  }

  @Get('employees/:id/photo')
  @ApiOperation({ summary: 'Securely stream employee photo' })
  async employeePhoto(@Param('id') id: string, @Res() res: Response) {
    const relativePath = await this.attendeesService.getPhotoPath(BigInt(id));
    const fullPath = path.resolve(process.cwd(), relativePath);

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Photo file does not exist on disk');
    }

    res.sendFile(fullPath);
  }
}
