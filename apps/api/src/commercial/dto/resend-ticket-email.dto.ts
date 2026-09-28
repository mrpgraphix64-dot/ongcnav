import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ResendTicketEmailDto {
  @ApiPropertyOptional({
    example: 'test@example.com',
    description: 'Registered customer email address used during pass booking',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid registered email address.' })
  email?: string;

  @ApiPropertyOptional({
    example: '9876543210',
    description: 'Registered customer mobile number used during pass booking (legacy fallback)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;
}
