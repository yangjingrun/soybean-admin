import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateCrmAiDraftQueueConfigDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  itemConcurrency?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  maxItemConcurrency?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxActiveTasksPerUser?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxActiveTasksPerOrg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  retryBackoffSeconds?: number[];
}
