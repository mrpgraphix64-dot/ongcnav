import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
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
