import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ManualCheckinDto {
  @ApiProperty({ example: '1', description: 'Attendee ID' })
  @IsString()
  @IsNotEmpty()
  attendeeId: string;

  @ApiProperty({ example: '1', description: 'Gate ID' })
  @IsString()
  @IsNotEmpty()
  gateId: string;

  @ApiProperty({
    example: 'Damaged phone screen, verified physical ONGC Employee ID Card',
    description: 'Mandatory justification for manual check-in override',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  reason: string;
}

export class VoidCheckinDto {
  @ApiProperty({ example: '1', description: 'Daily Checkin ID to void' })
  @IsString()
  @IsNotEmpty()
  checkinId: string;

  @ApiProperty({
    example: 'Scanned wrong family pass by operator mistake',
    description: 'Mandatory reason for voiding check-in',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  reason: string;
}
