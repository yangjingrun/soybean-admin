import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength } from 'class-validator';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class MockAuthorizeCrmMailboxDto {
  @IsString()
  @IsEmail()
  @MaxLength(180)
  @Transform(trimString)
  emailAddress!: string;
}
