import { IsIn, IsOptional, IsString } from 'class-validator';
import type { SystemRoleStatus } from '../system-role.types';

const systemRoleStatuses: SystemRoleStatus[] = ['enabled', 'disabled'];

export class SystemRoleQueryDto {
  @IsOptional()
  current?: number;

  @IsOptional()
  size?: number;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(systemRoleStatuses)
  status?: SystemRoleStatus;
}
