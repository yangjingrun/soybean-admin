import { Transform, Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { trimStringValue } from '../../../shared/dto-transformers';

export class KeywordHistoryQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  size?: number;
}

export class UpdateKeywordHistoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  @Transform(trimStringValue)
  requirement!: string;

  @IsObject()
  keywordPlan!: Record<string, unknown>;
}
