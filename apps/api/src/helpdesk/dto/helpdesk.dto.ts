import { IsNotEmpty, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ManualCheckinDto {
  @ApiPropertyOptional({ example: '1', description: 'Attendee ID' })
  @IsOptional()
  @IsString()
  attendeeId?: string;

  @ApiPropertyOptional({ example: 'NR2026-000001', description: 'Ticket ID / Ticket Number' })
  @IsOptional()
  @IsString()
  ticketId?: string;

  @ApiPropertyOptional({ example: 'NR2026-000001', description: 'Ticket ID (Laravel alias)' })
  @IsOptional()
  @IsString()
  ticket_id?: string;

  @ApiPropertyOptional({ example: '1', description: 'Gate ID' })
  @IsOptional()
  @IsString()
  gateId?: string;

  @ApiPropertyOptional({ example: '1', description: 'Gate ID (Laravel alias)' })
  @IsOptional()
  @IsString()
  gate_id?: string;

  @ApiPropertyOptional({
    example: 'Damaged phone screen, verified physical ONGC Employee ID Card',
    description: 'Mandatory justification for manual check-in override',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason?: string;

  @ApiPropertyOptional({
    example: 'Damaged phone screen, verified physical ONGC Employee ID Card',
    description: 'Mandatory justification (Laravel alias)',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  manual_reason?: string;
}

export class VoidCheckinDto {
  @ApiPropertyOptional({ example: '1', description: 'Daily Checkin ID to void' })
  @IsOptional()
  @IsString()
  checkinId?: string;

  @ApiPropertyOptional({
    example: 'Scanned wrong family pass by operator mistake',
    description: 'Mandatory reason for voiding check-in',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    example: 'Scanned wrong family pass by operator mistake',
    description: 'Mandatory reason for voiding check-in (Laravel alias)',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  void_reason?: string;
}
