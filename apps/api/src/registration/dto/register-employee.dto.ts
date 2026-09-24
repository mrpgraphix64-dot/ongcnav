import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeCategory, RegistrationType } from '@ongc/shared-types';

export class FamilyMemberInputDto {
  @ApiProperty({ example: 'Sunita Sharma' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Spouse' })
  @IsString()
  @IsNotEmpty()
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
  @ApiProperty({ example: '123456', description: 'ONGC Employee CPF Number' })
  @IsString()
  @IsNotEmpty()
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

  @ApiProperty({ example: '+919876543210' })
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
  @ValidateNested({ each: true })
  @Type(() => FamilyMemberInputDto)
  familyMembers?: FamilyMemberInputDto[];

  @ApiPropertyOptional({ enum: RegistrationType, example: RegistrationType.EMPLOYEE })
  @IsOptional()
  @IsEnum(RegistrationType)
  registrationType?: RegistrationType;
}
