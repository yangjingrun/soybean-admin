import { IsIn, IsOptional, IsString } from 'class-validator';
import { crmInboxThreadStatuses } from '../crm.types';

export class CrmInboxThreadQueryDto {
  @IsOptional()
  @IsString()
  current?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(crmInboxThreadStatuses)
  status?: (typeof crmInboxThreadStatuses)[number];

  @IsOptional()
  @IsString()
  mailboxId?: string;
}
