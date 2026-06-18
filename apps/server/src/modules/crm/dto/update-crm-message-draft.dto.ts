import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateCrmMessageDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(trimString)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  @Transform(trimString)
  bodyText!: string;
}
