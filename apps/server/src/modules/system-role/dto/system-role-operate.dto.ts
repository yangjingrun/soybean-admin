import { IsArray, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { crmPermissionCodes, type PermissionCode } from '@soybean/shared';
import type { SystemRoleStatus } from '../system-role.types';

const systemRoleStatuses: SystemRoleStatus[] = ['enabled', 'disabled'];

export class CreateSystemRoleDto {
  @IsString()
  @Length(2, 50)
  roleName!: string;

  @IsString()
  @Matches(/^R_[A-Z0-9_]{2,40}$/)
  roleCode!: string;

  @IsOptional()
  @IsString()
  roleDesc?: string | null;

  @IsOptional()
  @IsArray()
  @IsIn(crmPermissionCodes, { each: true })
  permissions?: PermissionCode[];

  @IsOptional()
  @IsIn(systemRoleStatuses)
  status?: SystemRoleStatus;
}

export class UpdateSystemRoleDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  roleName?: string;

  @IsOptional()
  @IsString()
  roleDesc?: string | null;

  @IsOptional()
  @IsIn(systemRoleStatuses)
  status?: SystemRoleStatus;
}

export class UpdateSystemRolePermissionsDto {
  @IsArray()
  @IsIn(crmPermissionCodes, { each: true })
  permissions!: PermissionCode[];
}
