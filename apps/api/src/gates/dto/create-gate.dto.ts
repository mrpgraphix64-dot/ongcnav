import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsBoolean, IsInt, Min } from 'class-validator';
import { GateType, GateStatus } from '@ongc/shared-types';

export class CreateGateDto {
  @ApiProperty({ example: 'Gate 1 (Main Entrance)' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '1' })
  @IsNotEmpty()
  @IsString()
  gateNumber: string;

  @ApiPropertyOptional({ enum: GateType, default: GateType.REGULAR })
  @IsOptional()
  @IsEnum(GateType)
  gateType?: GateType;

  @ApiPropertyOptional({ enum: GateStatus, default: GateStatus.ACTIVE })
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
