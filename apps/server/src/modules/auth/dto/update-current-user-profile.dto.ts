import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCurrentUserProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  email?: string | null;
}
