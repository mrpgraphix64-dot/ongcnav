import { IsString, IsOptional, IsNotEmpty, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateGroupSettingsDto {
  [key: string]: any;
}

export class ResetEventDataDto {
  @ApiProperty({ description: 'Confirmation phrase must be RESET', example: 'RESET' })
  @IsString()
  @IsNotEmpty()
  confirmation!: string;
}

export class ToggleFullPowerDto {
  @ApiProperty({ description: 'Whether to enable or disable SUPER_ADMIN Full Power', example: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({
    description: "Required confirmation phrase ('ENABLE FULL POWER') when activating",
    example: 'ENABLE FULL POWER',
    required: false,
  })
  @IsString()
  @IsOptional()
  confirmation?: string;
}

export class ToggleMaintenanceModeDto {
  @ApiProperty({ description: 'Whether to enable or disable global maintenance mode', example: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({
    description: "Required confirmation phrase ('ENABLE MAINTENANCE') when activating",
    example: 'ENABLE MAINTENANCE',
    required: false,
  })
  @IsString()
  @IsOptional()
  confirmation?: string;
}

export class UpdatePaymentSettingsDto {
  @ApiProperty({ description: 'Whether Razorpay online payments are enabled', example: true })
  @IsBoolean()
  enabled!: boolean;
}

export class UpdateBookPassSettingsDto {
  @ApiProperty({
    description: 'Book Pass availability state (OPEN or COMING_SOON)',
    example: 'OPEN',
    required: false,
  })
  @IsString()
  @IsOptional()
  availability?: string;

  @ApiProperty({
    description: 'Whether Book Pass is enabled (true = OPEN, false = COMING_SOON)',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class UpdateWebsiteModeDto {
  @ApiProperty({
    description: 'Website public access mode: COMING_SOON, EMPLOYEE_REGISTRATION_ONLY, FULL_WEBSITE',
    example: 'EMPLOYEE_REGISTRATION_ONLY',
  })
  @IsString()
  @IsNotEmpty()
  mode!: 'COMING_SOON' | 'EMPLOYEE_REGISTRATION_ONLY' | 'FULL_WEBSITE';
}

export class UpdateEmployeeTypesDto {
  @ApiProperty({ description: 'Whether regular employees can register', example: true })
  @IsBoolean()
  regular!: boolean;

  @ApiProperty({ description: 'Whether retired employees can register', example: false })
  @IsBoolean()
  retired!: boolean;

  @ApiProperty({ description: 'Whether contract employees can register', example: false })
  @IsBoolean()
  contract!: boolean;
}

export class UpdateEmployeeQrReleaseScheduleDto {
  @ApiProperty({ description: 'Automatic release switch', example: false, required: false })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiProperty({ description: 'Release date (YYYY-MM-DD)', example: '2026-10-10', required: false })
  @IsString()
  @IsOptional()
  releaseDate?: string;

  @ApiProperty({ description: 'Release time (HH:mm)', example: '10:00', required: false })
  @IsString()
  @IsOptional()
  releaseTime?: string;

  @ApiProperty({ description: 'Timezone', example: 'Asia/Kolkata', required: false })
  @IsString()
  @IsOptional()
  timezone?: string;
}

export class ExecuteEmployeeQrReleaseDto {
  @ApiProperty({ description: 'Release execution action: SEND_NOW or RETRY_FAILED', example: 'SEND_NOW', required: false })
  @IsString()
  @IsOptional()
  action?: 'SEND_NOW' | 'RETRY_FAILED';

  @ApiProperty({ description: 'Retry sending only failed emails', example: false, required: false })
  @IsBoolean()
  @IsOptional()
  retryFailedOnly?: boolean;
}
