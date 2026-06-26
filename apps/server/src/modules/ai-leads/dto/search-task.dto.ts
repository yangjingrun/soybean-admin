import { Transform, Type } from 'class-transformer';
import { IsInt, IsObject, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { trimStringValue } from '../../../shared/dto-transformers';

export class CreateSearchTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  @Transform(trimStringValue)
  requirement!: string;

  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  targetLeadCount!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(trimStringValue)
  productLineId!: string;

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
