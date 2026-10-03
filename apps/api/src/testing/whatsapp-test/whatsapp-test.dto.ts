import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsArray,
  IsBoolean,
  Matches,
} from 'class-validator';
import { EmployeeCategory } from '@ongc/shared-types';

export class WhatsAppTestFamilyMemberDto {
  @ApiProperty({ example: 'Pooja Patel' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Spouse' })
  @IsString()
  @IsOptional()
  relation?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsString()
  @IsOptional()
  mobileNo?: string;

  @ApiPropertyOptional({ example: 'pooja@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '1992-06-15' })
  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiProperty({ example: ['2026-10-11', '2026-10-12'] })
  @IsArray()
  bookingDays: string[];
}

export class SubmitWhatsAppTestPassDto {
  @ApiProperty({ example: 'Chintan Patel' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9][0-9]{9}$/, {
    message: 'Mobile number must be a valid 10-digit Indian number.',
  })
  mobile: string;

  @ApiProperty({ example: '99999' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{5,6}$/, {
    message: 'CPF number must be 5 or 6 digits.',
  })
  cpf: string;

  @ApiProperty({ example: 'chintan@ongc.co.in' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    enum: ['REGULAR', 'RETIRED', 'CONTRACT'],
    default: 'REGULAR',
  })
  @IsOptional()
  category?: EmployeeCategory;

  @ApiPropertyOptional({ example: '1988-04-12' })
  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: '2015-08-01' })
  @IsString()
  @IsOptional()
  dateOfJoining?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  guidelinesAccepted?: boolean;

  @ApiProperty({ example: ['2026-10-11', '2026-10-12', '2026-10-13'] })
  @IsArray()
  bookingDays: string[];

  @ApiPropertyOptional({ type: [WhatsAppTestFamilyMemberDto] })
  @IsArray()
  @IsOptional()
  familyMembers?: WhatsAppTestFamilyMemberDto[];
}

export class SendWhatsAppTestMessageDto {
  @ApiProperty({ example: 'ONGC-TEST-99999' })
  @IsString()
  @IsNotEmpty()
  referenceNumber: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsString()
  @IsOptional()
  safeRecipientOverride?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  includeVoucherImage?: boolean;

  @ApiPropertyOptional({ example: 'ongc_employee_pass_test' })
  @IsString()
  @IsOptional()
  templateOverride?: string;
}
