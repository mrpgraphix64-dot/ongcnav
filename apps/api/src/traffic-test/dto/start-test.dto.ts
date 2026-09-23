import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoadTestMode, LoadTestScenario } from '@ongc/shared-types';

export class StartLoadTestDto {
  @ApiProperty({ enum: LoadTestScenario, default: LoadTestScenario.NORMAL })
  @IsEnum(LoadTestScenario)
  scenario: LoadTestScenario;

  @ApiProperty({ enum: LoadTestMode, default: LoadTestMode.REAL_HTTP })
  @IsEnum(LoadTestMode)
  mode: LoadTestMode;

  @ApiProperty({ example: 100, description: 'Number of simulated users (1 - 1000)' })
  @IsInt()
  @Min(1)
  @Max(1000)
  simulatedUsers: number;

  @ApiPropertyOptional({ example: 10, description: 'Ramp-up duration in seconds' })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(60)
  rampUpSeconds?: number;

  @ApiProperty({ example: '1', description: 'Target gate ID' })
  @IsString()
  @IsNotEmpty()
  gateId: string;
}
