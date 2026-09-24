import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, Min, IsArray } from 'class-validator';
import { GateType, GateStatus } from '@ongc/shared-types';

export class UpdateGateDto {
  @ApiPropertyOptional({ example: 'Gate 1 (Main Entrance)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'G1' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  gateNumber?: string;

  @ApiPropertyOptional({ example: 'General' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ enum: GateType })
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

  @ApiPropertyOptional({ example: 'active' })
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
