import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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

export class SaveAiPromptDraftDto extends SaveAiPromptDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  @Transform(trimStringValue)
  changeNote?: string;
}

export class ValidateAiPromptDraftDto extends AiPromptKeyParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  @Transform(trimStringValue)
  systemPrompt!: string;
}

export class TestAiPromptDraftDto extends ValidateAiPromptDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  @Transform(trimStringValue)
  inputPrompt!: string;
}

export class PublishAiPromptVersionDto extends SaveAiPromptDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  @Transform(trimStringValue)
  changeNote?: string;
}

export class RollbackAiPromptVersionDto extends AiPromptKeyParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(trimStringValue)
  versionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  @Transform(trimStringValue)
  changeNote?: string;
}
