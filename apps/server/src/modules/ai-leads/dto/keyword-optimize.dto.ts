import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

function trimValue({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class KeywordOptimizeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  @Transform(trimValue)
  requirement!: string;
}
