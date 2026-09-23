import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@ongc/shared-types';

export class CreateStaffDto {
  @ApiProperty({ example: 'Ramesh Patel' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'ramesh@ongcnavratri.in' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'STF-012' })
  @IsString()
  @IsOptional()
  staffId?: string;

  @ApiProperty({ enum: UserRole, default: UserRole.GATE_OPERATOR })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ example: 'SecretPassword123!' })
  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsString()
  @IsOptional()
  gateId?: string;
}

export class UpdateStaffDto {
  @ApiPropertyOptional({ example: 'Ramesh Patel' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'ramesh@ongcnavratri.in' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'NewSecret123!' })
  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;
}
