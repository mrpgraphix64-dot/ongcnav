import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { RegistrationService } from './registration.service';
import { RegisterEmployeeDto } from './dto/register-employee.dto';

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
  constructor(private readonly registrationService: RegistrationService) {}

  @Post(['register', 'register/employee', 'employee/register'])
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
  @ApiOperation({ summary: 'Lookup ticket/pass by QR token or ticket number' })
  async getTicket(@Param('token') token: string) {
    return this.registrationService.findTicketByToken(token);
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
