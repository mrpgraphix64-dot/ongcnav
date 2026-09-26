import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyResetOtpDto {
  @ApiProperty({
    example: 'admin@ongc.co.in',
    description: 'Registered account email address',
  })
  @IsNotEmpty({ message: 'Email address is required.' })
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  email!: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit numeric OTP received via email',
  })
  @IsNotEmpty({ message: 'OTP is required.' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits.' })
  @Matches(/^\d{6}$/, { message: 'OTP must contain exactly 6 digits (numbers only).' })
  otp!: string;
}
