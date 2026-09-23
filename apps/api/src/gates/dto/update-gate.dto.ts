import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, Min } from 'class-validator';
import { GateType, GateStatus } from '@ongc/shared-types';

export class UpdateGateDto {
  @ApiPropertyOptional({ example: 'Gate 1 (Main Entrance)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  gateNumber?: string;

  @ApiPropertyOptional({ enum: GateType })
  @IsOptional()
  @IsEnum(GateType)
  gateType?: GateType;

  @ApiPropertyOptional({ enum: GateStatus })
  @IsOptional()
  @IsEnum(GateStatus)
  status?: GateStatus;

  @ApiPropertyOptional({ example: 800 })
  @IsOptional()
  @IsInt()
  @Min(0)
  capacityPerHour?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalCapacity?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isScanningPaused?: boolean;
}
