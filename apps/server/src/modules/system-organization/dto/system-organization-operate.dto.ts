import { IsIn, IsOptional, IsString } from 'class-validator';
import type { SystemOrganizationStatus } from '../system-organization.types';

const systemOrganizationStatuses: SystemOrganizationStatus[] = ['enabled', 'disabled'];

export class CreateSystemOrganizationDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsIn(systemOrganizationStatuses)
  status?: SystemOrganizationStatus;
}

export class UpdateSystemOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(systemOrganizationStatuses)
  status?: SystemOrganizationStatus;
}

export class UpdateSystemOrganizationStatusDto {
  @IsIn(systemOrganizationStatuses)
  status!: SystemOrganizationStatus;
}
