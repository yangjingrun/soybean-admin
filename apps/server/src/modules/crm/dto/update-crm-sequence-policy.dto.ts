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
import {
  sequencePolicyLinkPolicies,
  sequencePolicyStatuses,
  sequencePolicySameCompanyStrategies,
  type CrmSequencePolicyLinkPolicy,
  type CrmSequencePolicySameCompanyStrategy,
  type CrmSequencePolicyStatus
} from '../crm-sequence-policy';
import { CrmSequencePolicyStepDto } from './create-crm-sequence-policy.dto';

export class UpdateCrmSequencePolicyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsIn(sequencePolicyStatuses)
  status?: CrmSequencePolicyStatus;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(5)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => CrmSequencePolicyStepDto)
  steps?: CrmSequencePolicyStepDto[];

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
