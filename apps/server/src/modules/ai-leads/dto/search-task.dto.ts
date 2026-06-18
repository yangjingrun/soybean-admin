import { Type } from 'class-transformer';
import { IsInt, IsObject, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateSearchTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  requirement!: string;

  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  targetLeadCount!: number;

  @IsObject()
  keywordPlan!: Record<string, unknown>;
}

export class SaveAiLeadQueueConfigDto {
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  workerConcurrency!: number;
}
