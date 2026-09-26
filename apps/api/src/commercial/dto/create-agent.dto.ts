import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAgentDto {
  @ApiProperty({ example: 'Vipul Shah', description: 'Agent full name' })
  @IsString()
  @IsNotEmpty({ message: 'Agent name is required.' })
  @MinLength(2, { message: 'Agent name must be at least 2 characters.' })
  name: string;

  @ApiProperty({ example: 'vipul.agent@example.com', description: 'Agent email address' })
  @IsEmail({}, { message: 'A valid email address is required.' })
  @IsNotEmpty({ message: 'Email address is required.' })
  email: string;

  @ApiProperty({ example: '9876543210', description: 'Agent 10-digit mobile number' })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required.' })
  @Matches(/^[6-9][0-9]{9}$/, {
    message: 'Mobile number must be a valid 10-digit Indian number starting with 6, 7, 8, or 9.',
  })
  phone: string;

  @ApiProperty({ example: 'SecurePass123!', description: 'Agent initial password' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters.' })
  password: string;
}
