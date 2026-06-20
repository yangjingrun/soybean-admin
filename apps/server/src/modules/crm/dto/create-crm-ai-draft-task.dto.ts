import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString, MaxLength, MinLength } from 'class-validator';

function normalizeEnrollmentIds({ value }: { value: unknown }) {
  if (!Array.isArray(value)) return value;

  const ids = value.map(item => (typeof item === 'string' ? item.trim() : item));

  return [...new Set(ids)];
}

export class CreateCrmAiDraftTaskDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  @Transform(normalizeEnrollmentIds)
  enrollmentIds!: string[];
}
