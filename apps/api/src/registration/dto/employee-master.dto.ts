import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum, IsBoolean, ValidateNested, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MasterImportMode {
  ADD_UPDATE = 'ADD_UPDATE',
  REPLACE = 'REPLACE',
}

export enum MasterConflictResolution {
  SKIP = 'SKIP',
  OVERWRITE = 'OVERWRITE',
}

export class MasterRowItemDto {
  @ApiProperty({ description: 'ONGC CPF Number (5 or 6 numeric digits)', example: '12345' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{5,6}$/, { message: 'CPF must contain 5 or 6 numeric digits' })
  cpfNo: string;

  @ApiPropertyOptional({ description: 'Optional 10-digit Indian Mobile Number', example: '9876543210', nullable: true })
  @IsOptional()
  mobileNo?: string | null;
}

export class ValidateMasterUploadDto {
  @ApiPropertyOptional({ description: 'Raw CSV text content' })
  @IsString()
  @IsOptional()
  csvContent?: string;
}

export class ImportMasterDto {
  @ApiProperty({ enum: MasterImportMode, default: MasterImportMode.ADD_UPDATE })
  @IsEnum(MasterImportMode)
  mode: MasterImportMode;

  @ApiProperty({ type: [MasterRowItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MasterRowItemDto)
  rows: MasterRowItemDto[];

  @ApiPropertyOptional({ description: 'Explicit confirmation flag required for REPLACE mode' })
  @IsBoolean()
  @IsOptional()
  confirmReplace?: boolean;

  @ApiPropertyOptional({ enum: MasterConflictResolution, default: MasterConflictResolution.SKIP })
  @IsEnum(MasterConflictResolution)
  @IsOptional()
  resolveConflicts?: MasterConflictResolution;
}

export class EmployeeMasterQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search by CPF No. or Mobile No.' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 'updatedAt' })
  @IsOptional()
  @IsString()
  sortBy?: 'cpf' | 'mobile' | 'createdAt' | 'updatedAt' = 'updatedAt';

  @ApiPropertyOptional({ default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
