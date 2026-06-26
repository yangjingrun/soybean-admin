import { Type } from 'class-transformer';
import { IsNumber, IsObject, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

class ImportCrmLeadContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  email?: string | null;
}

export class ImportCrmLeadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  websiteUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @IsNumber()
  latitude?: number | null;

  @IsOptional()
  @IsNumber()
  longitude?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  timeZone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sourceTaskId?: string | null;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ImportCrmLeadContactDto)
  contact?: ImportCrmLeadContactDto | null;
}
