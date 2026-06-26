import { IsIn } from 'class-validator';
import { crmInboxThreadStatuses } from '../crm.types';

export class UpdateCrmInboxThreadStatusDto {
  @IsIn(crmInboxThreadStatuses)
  status!: (typeof crmInboxThreadStatuses)[number];
}
