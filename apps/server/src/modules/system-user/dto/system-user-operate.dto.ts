import { IsArray, IsIn, IsISO8601, IsOptional, IsString, Length } from 'class-validator';
import type { SystemUserRole, SystemUserStatus } from '../system-user.types';

const systemUserStatuses: SystemUserStatus[] = ['enabled', 'disabled'];

export class CreateSystemUserDto {
  @IsString()
  @Length(2, 50)
  userName!: string;

  @IsOptional()
  @IsString()
  nickName?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsArray()
  @IsString({ each: true })
  roles!: SystemUserRole[];

  @IsOptional()
  @IsIn(systemUserStatuses)
  status?: SystemUserStatus;

  @IsOptional()
  @IsString()
  companyName?: string | null;

  @IsOptional()
  @IsISO8601()
  expireAt?: string | null;

  @IsOptional()
  @IsString()
  remark?: string | null;
}

export class UpdateSystemUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  userName?: string;

  @IsOptional()
  @IsString()
  nickName?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: SystemUserRole[];

  @IsOptional()
  @IsIn(systemUserStatuses)
  status?: SystemUserStatus;

  @IsOptional()
  @IsString()
  companyName?: string | null;

  @IsOptional()
  @IsISO8601()
  expireAt?: string | null;

  @IsOptional()
  @IsString()
  remark?: string | null;
}

export class UpdateSystemUserStatusDto {
  @IsIn(systemUserStatuses)
  status!: SystemUserStatus;
}
