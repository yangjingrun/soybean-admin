import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const logLevels = ['info', 'warn', 'error'] as const;
const logStatuses = ['success', 'failed'] as const;

export class SystemLogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  current?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number = 20;

  @IsOptional()
  @IsIn(logLevels)
  level?: string;

  @IsOptional()
  @IsIn(logStatuses)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  module?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  userName?: string;

  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @IsOptional()
  @IsISO8601()
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  keyword?: string;
}

export class SystemLogIdParamDto {
  @IsString()
  @MaxLength(80)
  id!: string;
}
