import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  Max,
  Min,
  ValidateNested
} from 'class-validator';
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

class SaveCrmSendWindowDto {
  @IsInt()
  @Min(0)
  @Max(24 * 60 - 1)
  @Type(() => Number)
  startMinute!: number;

  @IsInt()
  @Min(1)
  @Max(24 * 60)
  @Type(() => Number)
  endMinute!: number;
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

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @Type(() => Number)
  sendWorkdays?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => SaveCrmSendWindowDto)
  sendWindows?: SaveCrmSendWindowDto[];
}
