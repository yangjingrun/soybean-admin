import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { crmPersonaProfileStatuses, type CrmPersonaProfileStatus } from '../crm.types';

function trimOptionalString({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;

  const normalized = value.trim();
  return normalized || undefined;
}

export class UpdateCrmPersonaProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Transform(trimOptionalString)
  name?: string;

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

  @IsOptional()
  @IsIn(crmPersonaProfileStatuses)
  @Transform(trimOptionalString)
  status?: CrmPersonaProfileStatus;
}
