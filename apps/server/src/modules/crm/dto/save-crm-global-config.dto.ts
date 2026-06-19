import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { maxEmailVerificationCooldownDays } from '../crm-global-config';

export class SaveCrmGlobalConfigDto {
  @IsInt()
  @Min(1)
  @Max(maxEmailVerificationCooldownDays)
  @Type(() => Number)
  emailVerificationCooldownDays!: number;
}
