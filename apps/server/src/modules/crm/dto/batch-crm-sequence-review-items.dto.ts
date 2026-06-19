import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString, MaxLength, MinLength } from 'class-validator';

function trimStringArray({ value }: { value: unknown }) {
  return Array.isArray(value) ? value.map(item => (typeof item === 'string' ? item.trim() : item)) : value;
}

export class BatchCrmSequenceReviewItemsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  @Transform(trimStringArray)
  ids!: string[];
}
