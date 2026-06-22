import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

function trimOptionalString({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;

  const normalized = value.trim();
  return normalized || undefined;
}

export class CreateCrmContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimOptionalString)
  fullName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimOptionalString)
  title?: string | null;

  @IsString()
  @MaxLength(180)
  @Transform(trimOptionalString)
  email!: string;
}
