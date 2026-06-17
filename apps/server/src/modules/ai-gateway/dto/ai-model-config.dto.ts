import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { defaultAiModelConfigKey } from '../ai-gateway.constants';

function trimValue({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class AiModelConfigKeyParamDto {
  @IsString()
  @MaxLength(60)
  @Transform(trimValue)
  configKey = defaultAiModelConfigKey;
}

export class SaveAiModelConfigDto extends AiModelConfigKeyParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(trimValue)
  title = '默认模型';

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @Transform(trimValue)
  providerName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(trimValue)
  apiBase!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @Transform(trimValue)
  apiKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Transform(trimValue)
  model!: string;

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
