import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trimStringValue } from '../../../shared/dto-transformers';

export class KeywordOptimizeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  @Transform(trimStringValue)
  requirement!: string;
}
