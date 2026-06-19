import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CompleteCrmGmailOAuthDto {
  @IsString()
  @MaxLength(2048)
  @Transform(trimString)
  code!: string;

  @IsString()
  @MaxLength(4096)
  @Transform(trimString)
  state!: string;
}
