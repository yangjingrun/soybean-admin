import { IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  userName!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  captchaId?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  captchaCode?: string;
}
