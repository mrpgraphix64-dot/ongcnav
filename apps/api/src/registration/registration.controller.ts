import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { RegistrationService } from './registration.service';
import { RegisterEmployeeDto } from './dto/register-employee.dto';

const uploadDir = path.resolve(process.cwd(), 'storage/private/employee_photos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

@ApiTags('Public Registration')
@Controller('public')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register employee with optional family members and photo' })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `photo-${uniqueSuffix}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
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
    @UploadedFile() file?: Express.Multer.File,
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
      bookingDays: bookingDays || [],
      familyMembers,
    };

    const photoPath = file ? `storage/private/employee_photos/${file.filename}` : undefined;
    return this.registrationService.register(dto, photoPath);
  }

  @Get('ticket/:token')
  @ApiOperation({ summary: 'Lookup ticket/pass by QR token or ticket number' })
  async getTicket(@Param('token') token: string) {
    return this.registrationService.findTicketByToken(token);
  }

  @Get('my-registration/:cpf')
  @ApiOperation({ summary: 'Lookup all registered passes by CPF' })
  async getMyRegistration(
    @Param('cpf') cpf: string,
    @Query('phoneLast4') phoneLast4?: string,
  ) {
    return this.registrationService.findByCpf(cpf, phoneLast4);
  }
}
