import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeeMasterService } from './employee-master.service';
import { EmployeeMasterQueryDto, ImportMasterDto } from './dto/employee-master.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePagePermission } from '../common/decorators/page-permission.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Admin ONGC Employee Master')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.EMPLOYEE_ADMIN)
@RequirePagePermission('employee.master')
@Controller('admin/employees/master')
export class EmployeeMasterController {
  constructor(private readonly masterService: EmployeeMasterService) {}

  @Get()
  @ApiOperation({ summary: 'List paginated ONGC employee master verification records' })
  async list(@Query() query: EmployeeMasterQueryDto) {
    return this.masterService.listMasterRecords(query);
  }

  @Post('validate')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Validate uploaded Excel/CSV master file and return preview' })
  async validate(
    @UploadedFile() file?: Express.Multer.File,
    @Body('csvContent') csvContentBody?: string,
    @Body('csv_content') csv_content?: string,
  ) {
    const content = file ? file.buffer : csvContentBody || csv_content;
    if (!content || (typeof content === 'string' && content.trim() === '')) {
      throw new BadRequestException('Excel or CSV file/content is required.');
    }

    return this.masterService.validateFile(content, file?.originalname);
  }

  @Post('import')
  @ApiOperation({ summary: 'Execute import (ADD_UPDATE or REPLACE mode)' })
  async importData(@Req() req: any, @Body() dto: ImportMasterDto) {
    return this.masterService.executeImport(req.user, dto);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export current ONGC Employee Master records to CSV' })
  async export(@Res() res: Response) {
    const csv = await this.masterService.exportMasterToCsv();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ongc_employee_master_export_${dateStr}.csv"`,
    );
    res.send(csv);
  }
}
