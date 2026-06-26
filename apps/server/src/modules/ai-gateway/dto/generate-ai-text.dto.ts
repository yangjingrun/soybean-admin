import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { trimStringValue } from '../../../shared/dto-transformers';
import { aiPromptKeys, defaultAiModelConfigKey } from '../ai-gateway.constants';

export class GenerateAiTextDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimStringValue)
  providerName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(trimStringValue)
  apiBase?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @Transform(trimStringValue)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Transform(trimStringValue)
  model?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  @Transform(trimStringValue)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  @Transform(trimStringValue)
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  @IsIn(aiPromptKeys, { message: 'promptKey 不在固定提示词列表中' })
  @MaxLength(60)
  @Transform(trimStringValue)
  promptKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trimStringValue)
  modelConfigKey?: string = defaultAiModelConfigKey;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(8000)
  maxOutputTokens?: number;
}
