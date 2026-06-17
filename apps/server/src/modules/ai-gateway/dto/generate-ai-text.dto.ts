import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { aiPromptKeys, defaultAiModelConfigKey } from '../ai-gateway.constants';

function trimValue({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class GenerateAiTextDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimValue)
  providerName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(trimValue)
  apiBase?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @Transform(trimValue)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Transform(trimValue)
  model?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  @Transform(trimValue)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  @Transform(trimValue)
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  @IsIn(aiPromptKeys, { message: 'promptKey 不在固定提示词列表中' })
  @MaxLength(60)
  @Transform(trimValue)
  promptKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trimValue)
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
