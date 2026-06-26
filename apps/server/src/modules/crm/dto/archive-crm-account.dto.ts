import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

function trimOptionalString({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;

  const normalized = value.trim();
  return normalized || undefined;
}

export class ArchiveCrmAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trimOptionalString)
  reason?: string;
}
