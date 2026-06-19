import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import {
  maxEmailVerificationCooldownDays,
  maxFollowUpDelayDays,
  maxOwnerConcurrentSendLimit,
  maxOwnerDailySendLimitMax
} from '../crm-global-config';

class SaveCrmFollowUpDelayDaysDto {
  @IsInt()
  @Min(1)
  @Max(maxFollowUpDelayDays)
  @Type(() => Number)
  step2Days!: number;

  @IsInt()
  @Min(1)
  @Max(maxFollowUpDelayDays)
  @Type(() => Number)
  step3Days!: number;

  @IsInt()
  @Min(1)
  @Max(maxFollowUpDelayDays)
  @Type(() => Number)
  step4Days!: number;

  @IsInt()
  @Min(1)
  @Max(maxFollowUpDelayDays)
  @Type(() => Number)
  step5Days!: number;
}

export class SaveCrmGlobalConfigDto {
  @IsInt()
  @Min(1)
  @Max(maxEmailVerificationCooldownDays)
  @Type(() => Number)
  emailVerificationCooldownDays!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(maxOwnerConcurrentSendLimit)
  @Type(() => Number)
  ownerConcurrentSendLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(maxOwnerDailySendLimitMax)
  @Type(() => Number)
  ownerDailySendLimitMax?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SaveCrmFollowUpDelayDaysDto)
  followUpDelayDays?: SaveCrmFollowUpDelayDaysDto;
}
