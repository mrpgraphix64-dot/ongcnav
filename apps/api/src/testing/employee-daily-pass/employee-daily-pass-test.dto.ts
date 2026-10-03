import { IsString, IsNotEmpty, IsOptional, IsEmail, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateTestPassDto {
  @ApiPropertyOptional({ description: 'ID of the Attendee (employee or family member) to generate test pass for' })
  @IsOptional()
  attendeeId?: string | number;

  @ApiPropertyOptional({ description: 'Array of attendee IDs to generate test passes for' })
  @IsOptional()
  attendeeIds?: (string | number)[];

  @ApiPropertyOptional({ description: 'Array of employee IDs - automatically includes employee and all family members' })
  @IsOptional()
  employeeIds?: (string | number)[];

  @ApiPropertyOptional({ description: 'Optional simulated event date for backward compatibility', example: '2026-10-11' })
  @IsString()
  @IsOptional()
  eventDate?: string;

  @ApiPropertyOptional({ description: 'Optional unique test session ID', example: 'EMP-TEST-20261001-001' })
  @IsString()
  @IsOptional()
  testSessionId?: string;

  @ApiPropertyOptional({ description: 'Simulated time of day (HH:mm)', example: '18:00' })
  @IsString()
  @IsOptional()
  simulatedTime?: string;

  @ApiPropertyOptional({ description: 'Configured dispatch time override (HH:mm)', example: '18:00' })
  @IsString()
  @IsOptional()
  configuredDispatchTime?: string;

  @ApiPropertyOptional({ description: 'Designated safe test email recipient', example: 'test@example.com' })
  @IsString()
  @IsOptional()
  testRecipientEmail?: string;
}

export class SimulateDeliveryDto {
  @ApiPropertyOptional({ description: 'Array of employee IDs selected' })
  @IsOptional()
  employeeIds?: (string | number)[];

  @ApiPropertyOptional({ description: 'ID of single attendee for backward compatibility' })
  @IsOptional()
  attendeeId?: string | number;

  @ApiProperty({ description: 'Simulated event date (YYYY-MM-DD)', example: '2026-10-11' })
  @IsString()
  @IsNotEmpty()
  simulatedDate: string;

  @ApiProperty({ description: 'Simulated time (HH:mm)', example: '18:00' })
  @IsString()
  @IsNotEmpty()
  simulatedTime: string;

  @ApiPropertyOptional({ description: 'Configured dispatch time override (HH:mm)', example: '18:00' })
  @IsOptional()
  @IsString()
  configuredDispatchTime?: string;

  @ApiPropertyOptional({ description: 'Designated safe test email recipient', example: 'admin@example.com' })
  @IsOptional()
  @IsString()
  testRecipientEmail?: string;

  @ApiPropertyOptional({ description: 'Test session ID' })
  @IsOptional()
  @IsString()
  testSessionId?: string;
}

export class SimulateWindowDto {
  @ApiPropertyOptional({ description: 'Array of employee IDs selected' })
  @IsOptional()
  employeeIds?: (string | number)[];

  @ApiPropertyOptional({ description: 'ID of single attendee for backward compatibility' })
  @IsOptional()
  attendeeId?: string | number;

  @ApiProperty({ description: 'Simulated event date (YYYY-MM-DD)', example: '2026-10-11' })
  @IsString()
  @IsNotEmpty()
  simulatedDate: string;

  @ApiProperty({ description: 'Simulation start time (HH:mm)', example: '15:40' })
  @IsString()
  @IsNotEmpty()
  simulatedStartTime: string;

  @ApiPropertyOptional({ description: 'Designated safe test email recipient', example: 'admin@example.com' })
  @IsOptional()
  @IsString()
  testRecipientEmail?: string;

  @ApiPropertyOptional({ description: 'Test session ID' })
  @IsOptional()
  @IsString()
  testSessionId?: string;

  @ApiPropertyOptional({ description: 'Whether to auto-cleanup test passes after 10-minute window evaluation', example: true })
  @IsOptional()
  @IsBoolean()
  autoCleanup?: boolean;
}

export class SendTestEmailDto {
  @ApiProperty({ description: 'QR Token of the generated test daily pass' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'Target test email recipient address', example: 'test@example.com' })
  @IsEmail()
  @IsNotEmpty()
  recipientEmail: string;
}

export class ScannerTestDto {
  @ApiProperty({ description: 'QR Token of the test pass to scan' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiPropertyOptional({ description: 'Simulated scan date (YYYY-MM-DD)', example: '2026-10-11' })
  @IsString()
  @IsOptional()
  scanDate?: string;

  @ApiPropertyOptional({ description: 'Gate ID to simulate scan at', example: 1 })
  @IsNumber()
  @IsOptional()
  gateId?: number;
}

export class RevokeTestPassDto {
  @ApiProperty({ description: 'QR Token of the test pass to revoke' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class CleanupSessionDto {
  @ApiProperty({ description: 'Session ID to cleanup test records for' })
  @IsString()
  @IsNotEmpty()
  testSessionId: string;
}

export class CleanupAllDto {
  @ApiProperty({ description: 'Explicit confirmation flag to delete all test lab data' })
  @IsBoolean()
  confirm: boolean;
}

export class DispatchScheduleCheckDto {
  @ApiProperty({ description: 'Simulated event date (YYYY-MM-DD)', example: '2026-10-12' })
  @IsString()
  @IsNotEmpty()
  simulatedDate: string;

  @ApiProperty({ description: 'Simulated time of day (HH:mm in 24-hr format)', example: '18:00' })
  @IsString()
  @IsNotEmpty()
  simulatedTime: string;

  @ApiPropertyOptional({ description: 'Attendee ID to run simulated dispatch for' })
  @IsOptional()
  attendeeId?: string | number;

  @ApiPropertyOptional({ description: 'Configured dispatch time for this date (HH:mm)', example: '18:00' })
  @IsOptional()
  @IsString()
  configuredDispatchTime?: string;

  @ApiPropertyOptional({ description: 'Safe test email recipient', example: 'test@example.com' })
  @IsOptional()
  @IsString()
  testRecipientEmail?: string;

  @ApiPropertyOptional({ description: 'Test session ID' })
  @IsOptional()
  @IsString()
  testSessionId?: string;
}

export class ResetScannerDto {
  @ApiProperty({ description: 'QR Token of the test pass to reset to ACTIVE state' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
