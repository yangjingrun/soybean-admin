import { IsString, Length, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @Length(6, 18)
  @Matches(/^\w+$/)
  oldPassword!: string;

  @IsString()
  @Length(6, 18)
  @Matches(/^\w+$/)
  newPassword!: string;
}
