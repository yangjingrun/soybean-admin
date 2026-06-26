import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { crmAccountStatuses, type CrmAccountStatus } from '../crm.types';

function trimOptionalString({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;

  const normalized = value.trim();
  return normalized || undefined;
}

export class UpdateCrmAccountStatusDto {
  @IsIn(crmAccountStatuses)
  status!: CrmAccountStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trimOptionalString)
  remark?: string;
}
