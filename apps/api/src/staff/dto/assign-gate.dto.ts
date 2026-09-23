import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignGateDto {
  @ApiProperty({ example: '1', description: 'Gate ID to assign the staff member to' })
  @IsString()
  @IsNotEmpty()
  gateId: string;
}
