import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { RegistrationService } from './registration.service';
import { RegisterEmployeeDto, VerifyEmployeeDto } from './dto/register-employee.dto';
import { DailyPassPdfService } from './daily-pass-pdf.service';
import { PublicMaintenanceGuard } from '../common/guards/public-maintenance.guard';

// Same private, non-web-served storage model as before — just two
// directories now (employee vs. family) so filenames can never collide
// and it's obvious at a glance which photo belongs to which kind of
// person on disk.
const employeePhotoDir = path.resolve(process.cwd(), 'storage/private/employee_photos');
const familyPhotoDir = path.resolve(process.cwd(), 'storage/private/family_photos');
for (const dir of [employeePhotoDir, familyPhotoDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Matches the existing frontend cap of 6 family members. FileFieldsInterceptor
// requires a static field list, so indices are declared up front — a
// request simply won't populate the ones it doesn't use.
const MAX_FAMILY_MEMBERS = 6;
const FAMILY_PHOTO_FIELDS = Array.from({ length: MAX_FAMILY_MEMBERS }, (_, i) => ({
  name: `familyPhoto_${i}`,
  maxCount: 1,
}));

function photoDestination(req: any, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
  cb(null, file.fieldname === 'photo' ? employeePhotoDir : familyPhotoDir);
}

function photoFilename(req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = path.extname(file.originalname).toLowerCase();
  const prefix = file.fieldname === 'photo' ? 'photo' : file.fieldname; // e.g. familyPhoto_2
  cb(null, `${prefix}-${uniqueSuffix}${ext}`);
}

@ApiTags('Public Registration')
@Controller('public')
export class RegistrationController {
  constructor(
    private readonly registrationService: RegistrationService,
    private readonly dailyPassPdfService: DailyPassPdfService,
  ) {}

  @Get('maintenance-status')
  @ApiOperation({ summary: 'Get current event public maintenance mode status' })
  async getMaintenanceStatus() {
    return this.registrationService.getMaintenanceStatus();
  }

  @Get('website-mode')
  @ApiOperation({ summary: 'Get current public website mode (COMING_SOON, EMPLOYEE_REGISTRATION_ONLY, FULL_WEBSITE)' })
  async getWebsiteMode() {
    return this.registrationService.getWebsiteMode();
  }

  @Get('employee-types')
  @ApiOperation({ summary: 'Get enabled employee categories (regular, retired, contract)' })
  async getEmployeeTypeSettings() {
    return this.registrationService.getEmployeeTypeSettings();
  }

  @Post(['employee/verify', 'verify-employee'])
  @UseGuards(PublicMaintenanceGuard)
  @ApiOperation({ summary: 'Verify employee CPF and Mobile against official ONGC master data' })
  async verifyEmployee(@Body() body: VerifyEmployeeDto) {
    return this.registrationService.verifyEmployee(body.cpf, body.mobile);
  }

  @Post(['register', 'register/employee', 'employee/register'])
  @UseGuards(PublicMaintenanceGuard)
  @ApiOperation({ summary: 'Register employee with optional family members, each with their own dates and photo' })
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'photo', maxCount: 1 }, ...FAMILY_PHOTO_FIELDS], {
      storage: diskStorage({
        destination: photoDestination,
        filename: photoFilename,
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max, same as before, applies per file
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return cb(new Error('Only image files (JPG, PNG, WEBP) are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async register(
    @Body() body: any,
    @UploadedFiles() files?: { [fieldname: string]: Express.Multer.File[] },
  ) {
    // If familyMembers is sent as JSON string in multipart form-data:
    let familyMembers = body.familyMembers;
    if (typeof familyMembers === 'string') {
      try {
        familyMembers = JSON.parse(familyMembers);
      } catch {
        familyMembers = [];
      }
    }
    familyMembers = Array.isArray(familyMembers) ? familyMembers : [];

    let bookingDays = body.bookingDays;
    if (typeof bookingDays === 'string') {
      try {
        bookingDays = JSON.parse(bookingDays);
      } catch {
        bookingDays = [bookingDays];
      }
    }

    const dto: RegisterEmployeeDto = {
      cpf: body.cpf,
      name: body.name,
      designation: body.designation,
      department: body.department,
      phone: body.phone,
      email: body.email,
      employeeCategory: body.employeeCategory,
      dateOfBirth: body.dateOfBirth,
      dateOfJoining: body.dateOfJoining,
      guidelinesAccepted: body.guidelinesAccepted === true || body.guidelinesAccepted === 'true',
      guidelinesAcceptedAt: body.guidelinesAcceptedAt,
      guidelinesVersion: body.guidelinesVersion,
      bookingDays: bookingDays || [],
      familyMembers,
      registrationType: body.registrationType,
    };

    const employeePhotoFile = files?.['photo']?.[0];
    const photoPath = employeePhotoFile ? `storage/private/employee_photos/${employeePhotoFile.filename}` : undefined;

    // Indexed so a missing photo for member N never shifts anyone else's —
    // familyPhotoPaths[i] always corresponds to familyMembers[i], or
    // undefined if that person has no photo.
    const familyPhotoPaths: (string | undefined)[] = familyMembers.map((_: unknown, i: number) => {
      const f = files?.[`familyPhoto_${i}`]?.[0];
      return f ? `storage/private/family_photos/${f.filename}` : undefined;
    });

    return this.registrationService.register(dto, photoPath, familyPhotoPaths);
  }

  // NOTE: There is intentionally no direct commercial registration endpoint
  // here. Commercial passes are ONLY issued after verified Razorpay payment
  // via CommercialController (POST /commercial/orders -> Razorpay Checkout ->
  // POST /commercial/orders/verify). Do not add a route that creates an
  // active commercial attendee/QR without payment verification.

  @Get('ticket/:token')
  @ApiOperation({ summary: 'Lookup ticket/pass by secure QR token' })
  async getTicket(@Param('token') token: string, @Req() req?: Request) {
    const ip = req
      ? ((req.headers?.['x-forwarded-for'] as string) || req.socket?.remoteAddress || '127.0.0.1')
      : undefined;
    return ip !== undefined
      ? this.registrationService.findTicketByToken(token, ip)
      : this.registrationService.findTicketByToken(token);
  }

  @Get(['employee/daily-pass/:token', 'daily-pass/:token'])
  @ApiOperation({ summary: 'Lookup Daily Employee Pass by secure token' })
  async getDailyPass(@Param('token') token: string, @Req() req?: Request) {
    const ip = req
      ? ((req.headers?.['x-forwarded-for'] as string) || req.socket?.remoteAddress || '127.0.0.1')
      : undefined;
    return ip !== undefined
      ? this.registrationService.findDailyPassByToken(token, ip)
      : this.registrationService.findDailyPassByToken(token);
  }

  @Get(['employee/daily-pass/:token/pdf', 'daily-pass/:token/pdf'])
  @ApiOperation({ summary: 'Download A4 PDF of Daily Employee Pass by secure token' })
  async downloadDailyPassPdf(@Param('token') token: string, @Res() res: Response) {
    const pdfBuffer = await this.dailyPassPdfService.generateDailyPassPdf(token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="ONGC-Pass-${token.substring(0, 8)}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  }

  @Get('my-registration/:cpf')
  @ApiOperation({ summary: 'Lookup all registered passes by CPF with phone last 4 digits verification' })
  async getMyRegistration(
    @Param('cpf') cpf: string,
    @Query('phoneLast4') phoneLast4: string,
  ) {
    return this.registrationService.findByCpf(cpf, phoneLast4);
  }
}
