import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { trimStringValue } from '../../../shared/dto-transformers';
import { aiPromptKeys } from '../ai-gateway.constants';

export class AiPromptKeyParamDto {
  @IsString()
  @IsIn(aiPromptKeys, { message: 'promptKey 不在固定提示词列表中' })
  @MaxLength(60)
  @Transform(trimStringValue)
  promptKey!: string;
}

export class SaveAiPromptDto extends AiPromptKeyParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(trimStringValue)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  @Transform(trimStringValue)
  systemPrompt!: string;
}
