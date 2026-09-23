import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FamilyMemberInputDto {
  @ApiProperty({ example: 'Sunita Sharma' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Spouse' })
  @IsString()
  @IsNotEmpty()
  relation: string;

  @ApiPropertyOptional({ example: 38 })
  @IsOptional()
  age?: number;

  @ApiPropertyOptional({ example: 'Female' })
  @IsString()
  @IsOptional()
  gender?: string;
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

  @ApiProperty({
    example: ['2026-09-23', '2026-09-24', '2026-09-25'],
    description: 'Selected event dates (YYYY-MM-DD)',
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
}
