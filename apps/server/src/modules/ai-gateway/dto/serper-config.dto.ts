import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

function trimValue({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class SerperConfigKeyParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Transform(trimValue)
  configKey!: string;
}

export class SaveSerperConfigDto extends SerperConfigKeyParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(trimValue)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(trimValue)
  apiBase!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @Transform(trimValue)
  apiKey!: string;
}
