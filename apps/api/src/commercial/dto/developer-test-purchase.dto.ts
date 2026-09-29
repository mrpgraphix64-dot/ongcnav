import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeveloperTestPurchaseDto {
  @ApiProperty({
    example: 'COMMERCIAL_DAILY',
    description: 'Ticket type: COMMERCIAL_DAILY, COMMERCIAL_SEASON, COMMERCIAL_MANDLI, or COMMERCIAL_ANY_DAY',
  })
  @IsString()
  @IsNotEmpty({ message: 'Ticket type is required.' })
  ticketType: string;

  @ApiProperty({
    example: 1,
    description: 'Quantity of passes to issue (1 to 10)',
    minimum: 1,
    maximum: 10,
  })
  @Type(() => Number)
  @IsInt({ message: 'Quantity must be an integer.' })
  @Min(1, { message: 'Quantity must be at least 1.' })
  @Max(10, { message: 'Quantity cannot exceed 10 per order.' })
  quantity: number;

  @ApiPropertyOptional({
    example: ['2026-10-11'],
    description: 'Selected event date(s) (YYYY-MM-DD). Optional for Season/Any Day Pass.',
  })
  @IsOptional()
  @IsArray({ message: 'Selected dates must be an array.' })
  @IsString({ each: true })
  selectedDates?: string[];

  @ApiPropertyOptional({
    example: 'Developer Test',
    description: 'Optional test customer name',
  })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({
    example: '9876543210',
    description: 'Optional 10-digit mobile number',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[6-9][0-9]{9}$/, {
    message: 'Mobile number must be a valid 10-digit Indian number.',
  })
  customerMobile?: string;

  @ApiPropertyOptional({
    example: 'developer@ongc.co.in',
    description: 'Optional test customer email address (defaults to authenticated Super Admin)',
  })
  @IsOptional()
  @IsString()
  customerEmail?: string;

  @ApiPropertyOptional({
    example: ['Guest 1', 'Guest 2'],
    description: 'Optional attendee names for multiple passes',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attendeeNames?: string[];

  @ApiPropertyOptional({
    example: 'Developer test order notes',
    description: 'Optional test order notes',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
