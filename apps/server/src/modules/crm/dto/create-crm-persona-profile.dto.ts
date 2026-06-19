import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptionalString({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;

  const normalized = value.trim();
  return normalized || undefined;
}

export class CreateCrmPersonaProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Transform(trimString)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimOptionalString)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimOptionalString)
  titleKeywordsText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimOptionalString)
  customerTypeKeywordsText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(trimOptionalString)
  painPoints?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(trimOptionalString)
  focusText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(trimOptionalString)
  avoidText?: string | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
