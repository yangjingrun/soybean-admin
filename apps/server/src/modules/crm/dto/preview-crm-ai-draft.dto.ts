import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class PreviewCrmAiDraftPreviousMessageDto {
  @IsInt()
  @Min(1)
  @Max(5)
  stepIndex!: number;

  @IsString()
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  bodyText!: string;
}

export class PreviewCrmAiDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  accountId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  contactId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  productLineId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  stepIndex!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  enrollmentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  messageId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewCrmAiDraftPreviousMessageDto)
  previousMessages?: PreviewCrmAiDraftPreviousMessageDto[];
}
