import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AllocatePassesDto {
  @ApiProperty({ example: 'COMMERCIAL_DAILY', description: 'Pass type code' })
  @IsString()
  @IsNotEmpty({ message: 'Pass type is required.' })
  passType: string;

  @ApiProperty({ example: 50, description: 'Number of passes to allocate' })
  @IsInt({ message: 'Quantity must be an integer.' })
  @Min(1, { message: 'Allocation quantity must be at least 1.' })
  @Type(() => Number)
  quantity: number;
}
