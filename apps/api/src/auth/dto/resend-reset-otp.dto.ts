import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendResetOtpDto {
  @ApiProperty({
    example: 'admin@ongc.co.in',
    description: 'Registered account email address for resending OTP',
  })
  @IsNotEmpty({ message: 'Email address is required.' })
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  email!: string;
}
