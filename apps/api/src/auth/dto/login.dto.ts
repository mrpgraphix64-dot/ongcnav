import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@ongc.co.in', description: 'Staff Email or Staff ID' })
  @IsNotEmpty()
  @IsString()
  identifier!: string;

  @ApiProperty({ example: 'secret123', description: 'User password' })
  @IsNotEmpty()
  @IsString()
  @MinLength(4)
  password!: string;
}
