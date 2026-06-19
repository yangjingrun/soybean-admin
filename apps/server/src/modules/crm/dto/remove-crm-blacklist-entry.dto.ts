import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class RemoveCrmBlacklistEntryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  @Transform(trimString)
  reason!: string;
}
