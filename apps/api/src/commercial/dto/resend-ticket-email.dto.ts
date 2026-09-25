import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendTicketEmailDto {
  @ApiProperty({
    example: '9876543210',
    description: 'Registered customer mobile number used during pass booking',
  })
  @IsString()
  @IsNotEmpty({ message: 'Customer mobile number is required to verify identity.' })
  @MaxLength(20)
  mobile: string;
}
