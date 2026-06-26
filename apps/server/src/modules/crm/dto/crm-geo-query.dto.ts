import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

function trimOptionalString({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;

  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeCountryCode({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;

  return value.trim().toUpperCase();
}

export class CrmGeoCityQueryDto {
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Transform(normalizeCountryCode)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trimOptionalString)
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}
