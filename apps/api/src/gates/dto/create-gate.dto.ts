import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsBoolean, IsInt, Min, IsArray } from 'class-validator';
import { GateType, GateStatus } from '@ongc/shared-types';

export class CreateGateDto {
  @ApiProperty({ example: 'Gate 1 (Main Entrance)' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'G1', description: 'Unique uppercase gate code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: '1', description: 'Legacy alias for code' })
  @IsOptional()
  @IsString()
  gateNumber?: string;

  @ApiPropertyOptional({ example: 'General', description: 'Gate type (General, Staff, Family, VIP, VVIP, Other or enum)' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ enum: GateType, default: GateType.REGULAR })
  @IsOptional()
  @IsEnum(GateType)
  gateType?: GateType;

  @ApiPropertyOptional({ example: 'Near West Parking, Main Pavilion' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'Operational instructions or notes for scanning operators' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'active', enum: ['active', 'inactive', 'ACTIVE', 'INACTIVE'] })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ type: [String], description: 'Assigned staff user IDs' })
  @IsOptional()
  @IsArray()
  staff_ids?: (string | number)[];

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  capacityPerHour?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalCapacity?: number;

  @ApiPropertyOptional({ example: 5000, description: 'Laravel alias for totalCapacity' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maximum_capacity?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  capacityEnabled?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  blockWhenFull?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isScanningPaused?: boolean;
}
