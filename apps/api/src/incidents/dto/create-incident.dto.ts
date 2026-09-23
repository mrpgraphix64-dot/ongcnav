import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentCategory, IncidentSeverity, IncidentStatus } from '@ongc/shared-types';

export class CreateIncidentDto {
  @ApiProperty({ example: '1' })
  @IsString()
  @IsNotEmpty()
  gateId: string;

  @ApiProperty({ enum: IncidentCategory, default: IncidentCategory.SECURITY })
  @IsEnum(IncidentCategory)
  category: IncidentCategory;

  @ApiProperty({ enum: IncidentSeverity, default: IncidentSeverity.MEDIUM })
  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;

  @ApiProperty({ example: 'Crowd surge at turnstile 2' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title: string;

  @ApiProperty({ example: 'Large group attempted to enter without passes. Additional security requested.' })
  @IsString()
  @IsNotEmpty()
  description: string;
}

export class UpdateIncidentDto {
  @ApiPropertyOptional({ enum: IncidentStatus })
  @IsEnum(IncidentStatus)
  @IsOptional()
  status?: IncidentStatus;

  @ApiPropertyOptional({ enum: IncidentSeverity })
  @IsEnum(IncidentSeverity)
  @IsOptional()
  severity?: IncidentSeverity;

  @ApiPropertyOptional({ example: 'Security team deployed additional barriers. Situation cleared.' })
  @IsString()
  @IsOptional()
  resolutionNotes?: string;
}
