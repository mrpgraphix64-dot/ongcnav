import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Single-use, scoped reset authorization token received upon OTP verification',
  })
  @IsNotEmpty({ message: 'Reset token is required.' })
  @IsString()
  resetToken!: string;

  @ApiProperty({
    example: 'NewSecurePassword@2026',
    description: 'New password meeting minimum security policy',
  })
  @IsNotEmpty({ message: 'New password is required.' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  newPassword!: string;

  @ApiProperty({
    example: 'NewSecurePassword@2026',
    description: 'Confirmation matching new password',
  })
  @IsNotEmpty({ message: 'Confirm password is required.' })
  @IsString()
  @MinLength(8, { message: 'Confirm password must be at least 8 characters long.' })
  confirmPassword!: string;
}
