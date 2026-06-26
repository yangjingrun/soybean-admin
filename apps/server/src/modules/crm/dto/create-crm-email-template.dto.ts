import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';
import { crmMessageThreadModes, type CrmMessageThreadMode } from '../crm.types';

export class CrmEmailTemplateStepDto {
  @IsInt()
  @Min(1)
  @Max(5)
  stepIndex!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsIn(crmMessageThreadModes)
  threadMode!: CrmMessageThreadMode;

  @IsInt()
  @Min(0)
  @Max(90)
  delayDays!: number;

  @IsString()
  @MaxLength(300)
  subjectTemplate!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  bodyTemplate!: string;
}

export class CreateCrmEmailTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsArray()
  @ArrayMinSize(5)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => CrmEmailTemplateStepDto)
  steps!: CrmEmailTemplateStepDto[];
}
