import { Transform, Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

function trimValue({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

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
  @Transform(trimValue)
  requirement!: string;

  @IsObject()
  keywordPlan!: Record<string, unknown>;
}
