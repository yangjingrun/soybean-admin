import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { maxOwnerDailySendLimitMax } from '../crm-global-config';

export class SaveCrmSendPreferenceDto {
  @IsInt()
  @Min(1)
  @Max(maxOwnerDailySendLimitMax)
  @Type(() => Number)
  dailySendLimit!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  followUpSharePercent!: number;
}
