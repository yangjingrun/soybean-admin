import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { trimStringValue } from '../../../shared/dto-transformers';
import { defaultAiModelConfigKey } from '../ai-gateway.constants';

export class AiModelConfigKeyParamDto {
  @IsString()
  @MaxLength(60)
  @Transform(trimStringValue)
  configKey = defaultAiModelConfigKey;
}

export class SaveAiModelConfigDto extends AiModelConfigKeyParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(trimStringValue)
  title = '默认模型';

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @Transform(trimStringValue)
  providerName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(trimStringValue)
  apiBase!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @Transform(trimStringValue)
  apiKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Transform(trimStringValue)
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
