import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ReclaimPassesDto {
  @ApiProperty({ example: 'COMMERCIAL_DAILY', description: 'Pass type code to reclaim' })
  @IsString()
  @IsNotEmpty({ message: 'Pass type is required.' })
  passType: string;

  @ApiProperty({ example: 10, description: 'Number of unused passes to reclaim' })
  @IsInt({ message: 'Quantity must be an integer.' })
  @Min(1, { message: 'Reclaim quantity must be at least 1.' })
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional({ example: 'Reclaiming unallocated quota', description: 'Reason or notes for reclaim' })
  @IsOptional()
  @IsString()
  notes?: string;
}
