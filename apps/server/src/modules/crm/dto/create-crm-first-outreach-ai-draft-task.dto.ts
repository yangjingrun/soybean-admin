import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested
} from 'class-validator';

class CreateCrmFirstOutreachAiDraftTaskTargetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  accountId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  contactId!: string;
}

export class CreateCrmFirstOutreachAiDraftTaskDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateCrmFirstOutreachAiDraftTaskTargetDto)
  targets!: CreateCrmFirstOutreachAiDraftTaskTargetDto[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  productLineId?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  mailboxId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  policyId?: string | null;
}
