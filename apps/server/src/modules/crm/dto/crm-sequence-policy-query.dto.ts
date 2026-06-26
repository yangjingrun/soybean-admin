import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { sequencePolicyStatuses, type CrmSequencePolicyStatus } from '../crm-sequence-policy';

function trimOptionalString({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;

  const normalized = value.trim();
  return normalized || undefined;
}

export class CrmSequencePolicyQueryDto {
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
  @IsIn(sequencePolicyStatuses)
  @Transform(trimOptionalString)
  status?: CrmSequencePolicyStatus;
}
