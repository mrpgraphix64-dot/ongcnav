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
