import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { crmAccountStatuses, type CrmAccountStatus } from '../crm.types';

function trimOptionalString({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;

  const normalized = value.trim();
  return normalized || undefined;
}

export class CrmAccountQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  current?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimOptionalString)
  keyword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trimOptionalString)
  contactTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trimOptionalString)
  customerType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimOptionalString)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimOptionalString)
  regionKeywords?: string;

  @IsOptional()
  @IsIn(crmAccountStatuses)
  @Transform(trimOptionalString)
  status?: CrmAccountStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trimOptionalString)
  sourceTaskId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimOptionalString)
  updatedFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimOptionalString)
  updatedTo?: string;
}
