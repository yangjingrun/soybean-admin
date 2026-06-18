import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { crmSequenceEnrollmentStatuses, type CrmSequenceEnrollmentStatus } from '../crm.types';

function trimOptionalString({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;

  const normalized = value.trim();
  return normalized || undefined;
}

export class CrmSequenceReviewQueryDto {
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
  @IsIn(crmSequenceEnrollmentStatuses)
  @Transform(trimOptionalString)
  status?: CrmSequenceEnrollmentStatus;
}
