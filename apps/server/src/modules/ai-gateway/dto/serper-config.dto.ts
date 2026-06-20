import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trimStringValue } from '../../../shared/dto-transformers';

export class SerperConfigKeyParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Transform(trimStringValue)
  configKey!: string;
}

export class SaveSerperConfigDto extends SerperConfigKeyParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(trimStringValue)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(trimStringValue)
  apiBase!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @Transform(trimStringValue)
  apiKey!: string;
}
