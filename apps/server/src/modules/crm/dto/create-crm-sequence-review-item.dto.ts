import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptionalString({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;

  const normalized = value.trim();
  return normalized || undefined;
}

export class CreateCrmSequenceReviewItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(trimString)
  accountId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(trimString)
  contactId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trimOptionalString)
  productLineId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trimOptionalString)
  mailboxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trimOptionalString)
  policyId?: string;
}
