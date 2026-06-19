import { IsBoolean } from 'class-validator';

export class SaveCrmOrganizationConfigDto {
  @IsBoolean()
  allowAdminViewMemberEmailBody!: boolean;
}
