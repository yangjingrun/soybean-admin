import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class SaveCrmInboxReplyDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(trimString)
  topic!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  @Transform(trimString)
  bodyText!: string;
}
