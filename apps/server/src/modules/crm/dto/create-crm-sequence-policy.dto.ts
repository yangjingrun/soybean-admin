import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
import {
  sequencePolicyLinkPolicies,
  sequencePolicySameCompanyStrategies,
  type CrmSequencePolicyLinkPolicy,
  type CrmSequencePolicySameCompanyStrategy
} from '../crm-sequence-policy';

export class CrmSequencePolicyStepDto {
  @IsInt()
  @Min(1)
  @Max(5)
  stepIndex!: number;

  @IsInt()
  @Min(0)
  @Max(90)
  delayDays!: number;

  @IsIn(crmMessageThreadModes)
  threadMode!: CrmMessageThreadMode;
}

export class CreateCrmSequencePolicyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsArray()
  @ArrayMinSize(5)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => CrmSequencePolicyStepDto)
  steps!: CrmSequencePolicyStepDto[];

  @IsOptional()
  @IsIn(sequencePolicyLinkPolicies)
  linkPolicy?: CrmSequencePolicyLinkPolicy;

  @IsOptional()
  @IsBoolean()
  allowLowRiskAutoSend?: boolean;

  @IsOptional()
  @IsIn(sequencePolicySameCompanyStrategies)
  sameCompanyContactStrategy?: CrmSequencePolicySameCompanyStrategy;
}
