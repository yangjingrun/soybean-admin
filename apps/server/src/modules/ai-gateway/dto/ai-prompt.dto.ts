import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { aiPromptKeys } from '../ai-gateway.constants';

function trimValue({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class AiPromptKeyParamDto {
  @IsString()
  @IsIn(aiPromptKeys, { message: 'promptKey 不在固定提示词列表中' })
  @MaxLength(60)
  @Transform(trimValue)
  promptKey!: string;
}

export class SaveAiPromptDto extends AiPromptKeyParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(trimValue)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  @Transform(trimValue)
  systemPrompt!: string;
}
