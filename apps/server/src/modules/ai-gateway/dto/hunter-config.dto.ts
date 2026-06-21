import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trimStringValue } from '../../../shared/dto-transformers';

export class HunterConfigKeyParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @Transform(trimStringValue)
  configKey!: string;
}

export class SaveHunterConfigDto extends HunterConfigKeyParamDto {
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

export class SaveMyHunterConfigDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(trimStringValue)
  title = 'Hunter 邮箱补全';

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(trimStringValue)
  apiBase!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(trimStringValue)
  apiKey?: string;
}
