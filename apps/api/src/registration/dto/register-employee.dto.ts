import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  Equals,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeCategory, RegistrationType, ALLOWED_FAMILY_RELATIONS } from '@ongc/shared-types';

export class VerifyEmployeeDto {
  @ApiProperty({ example: '12345', description: 'ONGC Employee CPF Number (exactly 5 numeric digits)' })
  @IsString()
  @IsNotEmpty({ message: 'Employee CPF No. is required.' })
  @Matches(/^[0-9]{5}$/, { message: 'Employee CPF No. must accept ONLY 5 numeric digits.' })
  cpf: string;

  @ApiProperty({ example: '9876543210', description: 'Employee 10-digit mobile number' })
  @IsString()
  @IsNotEmpty({ message: 'Employee mobile number is required.' })
  @Matches(/^[6-9][0-9]{9}$/, {
    message: 'Employee mobile number must be exactly 10 digits and start with 6, 7, 8 or 9.',
  })
  mobile: string;
}

export class FamilyMemberInputDto {
  @ApiProperty({ example: 'Sunita Sharma' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Spouse', enum: ALLOWED_FAMILY_RELATIONS })
  @IsString()
  @IsNotEmpty({ message: 'Family member relationship is required.' })
  @IsIn(ALLOWED_FAMILY_RELATIONS, {
    message: 'Relationship must be one of: Parents, Spouse, Child.',
  })
  relation: string;

  @ApiProperty({
    example: '9876543210',
    description: 'Family member mobile number — required, exactly 10 digits, must start with 6-9 (Indian mobile format).',
  })
  @IsString()
  @IsNotEmpty({ message: 'Family member mobile number is required.' })
  @Matches(/^[6-9][0-9]{9}$/, {
    message: 'Family member mobile number must be exactly 10 digits and start with 6, 7, 8 or 9.',
  })
  phone: string;

  @ApiProperty({
    example: 'sunita.sharma@example.com',
    description: 'Family member email — required. Their ticket will be shared through email for this member.',
  })
  @IsEmail({}, { message: 'Please provide a valid email address for the family member.' })
  @IsNotEmpty({ message: 'Family member email is required.' })
  email: string;

  @ApiProperty({ example: '1995-05-20', description: 'Family member Date of Birth (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty({ message: 'Family member Date of Birth is required.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Family member Date of Birth must be in YYYY-MM-DD format.' })
  dateOfBirth: string;

  @ApiPropertyOptional({ example: 38 })
  @IsOptional()
  age?: number;

  @ApiPropertyOptional({ example: 'Female' })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({
    example: ['2026-10-11', '2026-10-13'],
    description: "This family member's own selected event dates (YYYY-MM-DD), independent of the employee and any other family member.",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bookingDays?: string[];
}

export class RegisterEmployeeDto {
  @ApiProperty({ example: '12345', description: 'ONGC Employee CPF Number (exactly 5 numeric digits)' })
  @IsString()
  @IsNotEmpty({ message: 'Employee CPF No. is required.' })
  @Matches(/^[0-9]{5}$/, { message: 'Employee CPF No. must accept ONLY 5 numeric digits.' })
  cpf: string;

  @ApiProperty({ example: 'Amit Sharma' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Chief Engineer' })
  @IsString()
  @IsNotEmpty()
  designation: string;

  @ApiProperty({ example: 'Drilling & Subsurface' })
  @IsString()
  @IsNotEmpty()
  department: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'amit.sharma@ongc.co.in' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ enum: EmployeeCategory, example: EmployeeCategory.REGULAR })
  @IsEnum(EmployeeCategory)
  @IsNotEmpty()
  employeeCategory: EmployeeCategory;

  @ApiProperty({ example: '1985-06-15', description: 'Employee Date of Birth (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty({ message: 'Employee Date of Birth is required.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Employee Date of Birth must be in YYYY-MM-DD format.' })
  dateOfBirth: string;

  @ApiProperty({ example: '2010-09-01', description: 'Employee Date of Joining (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty({ message: 'Employee Date of Joining is required.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Employee Date of Joining must be in YYYY-MM-DD format.' })
  dateOfJoining: string;

  @ApiProperty({ example: true, description: 'Acknowledgement of registration guidelines' })
  @IsNotEmpty({ message: 'You must acknowledge and accept the registration guidelines to proceed.' })
  @Equals(true, { message: 'You must acknowledge and accept the registration guidelines to proceed.' })
  guidelinesAccepted: boolean;

  @ApiPropertyOptional({ example: '2026-10-03T12:00:00.000Z' })
  @IsOptional()
  @IsString()
  guidelinesAcceptedAt?: string;

  @ApiPropertyOptional({ example: '2026-employee-registration-v1' })
  @IsOptional()
  @IsString()
  guidelinesVersion?: string;

  @ApiProperty({
    example: ['2026-10-11', '2026-10-12'],
    description: "The employee's own selected event dates (YYYY-MM-DD). Family members carry their own bookingDays independently — see FamilyMemberInputDto.",
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  bookingDays: string[];

  @ApiPropertyOptional({ type: [FamilyMemberInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3, { message: 'Maximum 3 family members are allowed per employee.' })
  @ValidateNested({ each: true })
  @Type(() => FamilyMemberInputDto)
  familyMembers?: FamilyMemberInputDto[];

  @ApiPropertyOptional({ enum: RegistrationType, example: RegistrationType.EMPLOYEE })
  @IsOptional()
  @IsEnum(RegistrationType)
  registrationType?: RegistrationType;
}
