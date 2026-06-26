import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested
} from 'class-validator';
import { crmEmailTemplateStatuses, type CrmEmailTemplateStatus } from '../crm.types';
import { CrmEmailTemplateStepDto } from './create-crm-email-template.dto';

export class UpdateCrmEmailTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsIn(crmEmailTemplateStatuses)
  status?: CrmEmailTemplateStatus;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(5)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => CrmEmailTemplateStepDto)
  steps?: CrmEmailTemplateStepDto[];
}
