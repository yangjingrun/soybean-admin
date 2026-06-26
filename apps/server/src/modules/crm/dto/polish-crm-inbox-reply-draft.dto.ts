import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class PolishCrmInboxReplyDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(trimString)
  topic!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(trimString)
  productLineId?: string;
}
