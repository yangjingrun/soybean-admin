import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trimStringValue } from '../../../shared/dto-transformers';

export const leadSourceModes = ['search', 'maps'] as const;
export type LeadSourceMode = (typeof leadSourceModes)[number];

export class KeywordOptimizeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  @Transform(trimStringValue)
  requirement!: string;

  @IsOptional()
  @IsIn(leadSourceModes)
  leadSourceMode?: LeadSourceMode;
}
