import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class MockCrmReplyDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @MaxLength(10000)
  bodyText!: string;

  @IsOptional()
  @IsISO8601()
  receivedAt?: string;
}
