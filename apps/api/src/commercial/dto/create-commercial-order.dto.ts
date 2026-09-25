import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ArrayMinSize,
  Equals,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommercialOrderDto {
  @ApiProperty({ example: 'Suresh Trivedi', description: 'Customer full name' })
  @IsString()
  @IsNotEmpty({ message: 'Customer name is required.' })
  @MinLength(2, { message: 'Customer name must be at least 2 characters.' })
  @MaxLength(100, { message: 'Customer name cannot exceed 100 characters.' })
  customerName: string;

  @ApiProperty({
    example: '9876543210',
    description: 'Customer 10-digit Indian mobile number',
  })
  @IsString()
  @IsNotEmpty({ message: 'Mobile number is required.' })
  @Matches(/^[6-9][0-9]{9}$/, {
    message: 'Mobile number must be exactly 10 digits and start with 6, 7, 8 or 9.',
  })
  customerMobile: string;

  @ApiProperty({ example: 'suresh@example.com', description: 'Customer email address' })
  @IsEmail({}, { message: 'A valid email address is required for ticket delivery.' })
  @IsNotEmpty({ message: 'Email address is required.' })
  customerEmail: string;

  @ApiPropertyOptional({
    example: 'COMMERCIAL_DAILY',
    description: 'Ticket type: COMMERCIAL_DAILY or COMMERCIAL_SEASON',
  })
  @IsOptional()
  @IsString()
  ticketType?: string;

  @ApiProperty({
    example: ['2026-10-11', '2026-10-12'],
    description: 'Selected event date(s) (YYYY-MM-DD)',
  })
  @IsArray({ message: 'Selected dates must be provided as an array.' })
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'Please select at least one event date.' })
  selectedDates: string[];

  @ApiProperty({ example: 1, description: 'Number of passes (1 to 10)' })
  @IsInt({ message: 'Quantity must be an integer.' })
  @Min(1, { message: 'Quantity must be at least 1.' })
  @Max(10, { message: 'Maximum 10 tickets can be purchased per order.' })
  @Type(() => Number)
  quantity: number;

  @ApiProperty({
    example: true,
    description: 'Agreement to ticket terms and conditions',
  })
  @IsNotEmpty({ message: 'Please accept the ticket terms & conditions to continue.' })
  @IsBoolean({ message: 'Terms acceptance must be a boolean value.' })
  @Equals(true, { message: 'Please accept the ticket terms & conditions to continue.' })
  @Type(() => Boolean)
  termsAccepted: boolean;
}
