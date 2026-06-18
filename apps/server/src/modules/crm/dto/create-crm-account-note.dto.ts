import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateCrmAccountNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(trimString)
  content!: string;
}
