import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { SystemUserExpirationStatus, SystemUserRole, SystemUserStatus } from '../system-user.types';

export class SystemUserQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  current?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  role?: SystemUserRole;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  status?: SystemUserStatus;

  @IsOptional()
  @IsString()
  expirationStatus?: SystemUserExpirationStatus;
}
