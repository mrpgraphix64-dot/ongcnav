import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentCategory, IncidentSeverity, IncidentStatus } from '@ongc/shared-types';

export class CreateIncidentDto {
  @ApiPropertyOptional({ example: '1', description: 'Gate ID (Optional)' })
  @IsString()
  @IsOptional()
  gateId?: string;

  @ApiPropertyOptional({ example: '1', description: 'Gate ID (Laravel alias)' })
  @IsString()
  @IsOptional()
  gate_id?: string;

  @ApiProperty({ enum: IncidentCategory, default: IncidentCategory.SECURITY })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({ enum: IncidentSeverity, default: IncidentSeverity.MEDIUM })
  @IsEnum(IncidentSeverity)
  @IsOptional()
  severity?: IncidentSeverity;

  @ApiPropertyOptional({ example: 'NR2026-000042', description: 'Optional Ticket ID involved' })
  @IsString()
  @IsOptional()
  ticketId?: string;

  @ApiPropertyOptional({ example: 'NR2026-000042', description: 'Optional Ticket ID (Laravel alias)' })
  @IsString()
  @IsOptional()
  ticket_id?: string;

  @ApiPropertyOptional({ example: 'Crowd surge at turnstile 2' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ example: 'Large group attempted to enter without passes. Additional security requested.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(1000)
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

  @ApiPropertyOptional({ example: 'Security team deployed additional barriers (Laravel alias)' })
  @IsString()
  @IsOptional()
  resolution_notes?: string;
}

export class ResolveIncidentDto {
  @ApiProperty({ example: 'Addressed crowd backlog and verified guest wristbands' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(1000)
  resolution_notes?: string;

  @ApiPropertyOptional({ example: 'Addressed crowd backlog' })
  @IsString()
  @IsOptional()
  @MinLength(5)
  @MaxLength(1000)
  resolutionNotes?: string;
}
