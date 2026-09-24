import { IsArray, IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@ongc/shared-types';

export class CreateStaffDto {
  @ApiProperty({ example: 'Rahul Sharma' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'rahul@ongc.co.in' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsString()
  @IsOptional()
  mobile?: string;

  @ApiPropertyOptional({ example: 'STF-101' })
  @IsString()
  @IsOptional()
  staffId?: string;

  @ApiPropertyOptional({ example: 'STF-101' })
  @IsString()
  @IsOptional()
  staff_id?: string;

  @ApiProperty({ enum: UserRole, default: UserRole.SCANNER_STAFF })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ example: 'active' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'SecretPassword123!' })
  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsString()
  @IsOptional()
  gateId?: string;

  @ApiPropertyOptional({ example: ['1', '2'] })
  @IsArray()
  @IsOptional()
  gate_ids?: (string | number)[];

  @ApiPropertyOptional({ example: ['1', '2'] })
  @IsArray()
  @IsOptional()
  gates?: (string | number)[];
}

export class UpdateStaffDto {
  @ApiPropertyOptional({ example: 'Rahul Sharma' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'rahul@ongc.co.in' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsString()
  @IsOptional()
  mobile?: string;

  @ApiPropertyOptional({ example: 'STF-101' })
  @IsString()
  @IsOptional()
  staffId?: string;

  @ApiPropertyOptional({ example: 'STF-101' })
  @IsString()
  @IsOptional()
  staff_id?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({ example: 'active' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'NewSecret123!' })
  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: ['1', '2'] })
  @IsArray()
  @IsOptional()
  gate_ids?: (string | number)[];

  @ApiPropertyOptional({ example: ['1', '2'] })
  @IsArray()
  @IsOptional()
  gates?: (string | number)[];
}
