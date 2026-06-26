import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  crmMessageStatuses,
  crmSequenceEnrollmentStatuses,
  crmSequenceReviewTodoTypes,
  type CrmMessageStatus,
  type CrmSequenceEnrollmentStatus,
  type CrmSequenceReviewTodoType
} from '../crm.types';

const crmSequenceReviewDateScopes = ['today'] as const;
type CrmSequenceReviewDateScope = (typeof crmSequenceReviewDateScopes)[number];
const crmSequenceReviewCreatedAtScopes = ['today', 'yesterday', 'last_3_days', 'last_7_days', 'last_30_days'] as const;
type CrmSequenceReviewCreatedAtScope = (typeof crmSequenceReviewCreatedAtScopes)[number];

function trimOptionalString({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;

  const normalized = value.trim();
  return normalized || undefined;
}

export class CrmSequenceReviewQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  current?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimOptionalString)
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  currentStep?: number;

  @IsOptional()
  @IsIn(crmSequenceEnrollmentStatuses)
  @Transform(trimOptionalString)
  status?: CrmSequenceEnrollmentStatus;

  @IsOptional()
  @IsIn(crmSequenceReviewTodoTypes)
  @Transform(trimOptionalString)
  todoType?: CrmSequenceReviewTodoType;

  @IsOptional()
  @IsIn(crmMessageStatuses)
  @Transform(trimOptionalString)
  messageStatus?: CrmMessageStatus;

  @IsOptional()
  @IsIn(crmSequenceReviewDateScopes)
  @Transform(trimOptionalString)
  dateScope?: CrmSequenceReviewDateScope;

  @IsOptional()
  @IsIn(crmSequenceReviewCreatedAtScopes)
  @Transform(trimOptionalString)
  createdAtScope?: CrmSequenceReviewCreatedAtScope;
}
