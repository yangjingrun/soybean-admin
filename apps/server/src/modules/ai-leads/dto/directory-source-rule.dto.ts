import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trimStringValue } from '../../../shared/dto-transformers';
import { aiLeadDirectorySourceRuleMatchModes } from '../ai-lead-source-url';
import type { AiLeadDirectorySourceRuleMatchMode } from '../ai-lead-source-url';

export class SaveDirectorySourceRuleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  @Transform(trimStringValue)
  value!: string;

  @IsIn(aiLeadDirectorySourceRuleMatchModes)
  matchMode!: AiLeadDirectorySourceRuleMatchMode;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  @Transform(trimStringValue)
  description?: string;
}
