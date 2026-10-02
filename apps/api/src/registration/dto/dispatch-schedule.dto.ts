import { IsString, IsNotEmpty, IsBoolean, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertDispatchScheduleDto {
  @ApiProperty({ description: 'Official event date (YYYY-MM-DD)', example: '2026-10-11' })
  @IsString()
  @IsNotEmpty()
  eventDate: string;

  @ApiProperty({ description: 'Dispatch time in 24-hr HH:mm format', example: '17:00' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'dispatchTime must be in HH:mm 24-hour format (e.g. 17:00)',
  })
  dispatchTime: string;

  @ApiProperty({ description: 'Whether automatic dispatch is enabled for this event date', example: true })
  @IsBoolean()
  enabled: boolean;
}
