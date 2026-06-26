import { Transform } from 'class-transformer';
import { IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { crmProductLineStatuses, type CrmProductLineStatus } from '../crm.types';

function trimOptionalString({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;

  const normalized = value.trim();
  return normalized || undefined;
}

export class UpdateCrmProductLineDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Transform(trimOptionalString)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimOptionalString)
  targetCustomerType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(trimOptionalString)
  coreSellingPoints?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimOptionalString)
  moq?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimOptionalString)
  leadTime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trimOptionalString)
  paymentTerms?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimOptionalString)
  certifications?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimOptionalString)
  catalogUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimOptionalString)
  websiteUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trimOptionalString)
  commonModelsText?: string | null;

  @IsOptional()
  @IsObject()
  aiWritingConfig?: unknown;

  @IsOptional()
  @IsIn(crmProductLineStatuses)
  @Transform(trimOptionalString)
  status?: CrmProductLineStatus;
}
