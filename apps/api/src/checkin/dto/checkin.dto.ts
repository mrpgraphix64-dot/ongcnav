import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessCheckinDto {
  @ApiProperty({
    example: 'd9b1e9c5f8a2...',
    description: '32-byte cryptographic QR code token or ticket number',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: '1',
    description: 'ID of the gate where the scan occurred',
  })
  @IsString()
  @IsNotEmpty()
  gateId: string;

  @ApiPropertyOptional({
    example: 'scanner-device-01',
    description: 'Scanner device or terminal identifier',
  })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether this is a load test execution request',
  })
  @IsOptional()
  isLoadTest?: boolean;

  @ApiPropertyOptional({
    example: '1',
    description: 'Load test run ID if part of a load test',
  })
  @IsString()
  @IsOptional()
  loadTestRunId?: string;

  @ApiPropertyOptional({
    example: '2026-10-11',
    description: 'Optional scanner test/simulation event date (YYYY-MM-DD). Allowed strictly for SUPER_ADMIN only.',
  })
  @IsString()
  @IsOptional()
  testDate?: string;

  @ApiPropertyOptional({
    example: '2026-10-11',
    description: 'Alias for testDate (YYYY-MM-DD). Allowed strictly for SUPER_ADMIN only.',
  })
  @IsString()
  @IsOptional()
  simulationDate?: string;
}

export class ScannerHeartbeatDto {
  @ApiProperty({ example: '1' })
  @IsString()
  @IsNotEmpty()
  gateId: string;

  @ApiPropertyOptional({ example: 'scanner-01' })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiPropertyOptional({ example: 85 })
  @IsOptional()
  batteryLevel?: number;

  @ApiPropertyOptional({ example: 'wifi' })
  @IsString()
  @IsOptional()
  networkType?: string;
}
