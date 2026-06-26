import { BadRequestException } from '@nestjs/common';
import type { CrmSequencePolicyRecord, CrmUserContext } from '../crm.types';
import {
  defaultSequencePolicySteps,
  normalizeSequencePolicyLinkPolicy,
  normalizeSequencePolicySameCompanyStrategy,
  normalizeSequencePolicyStatus,
  normalizeSequencePolicySteps
} from '../crm-sequence-policy';
import { normalizeNullableString } from '../shared/crm-normalizers';

const defaultSequenceStepCount = 5;

export interface SequencePolicyWriteInput {
  name?: string;
  description?: string | null;
  status?: unknown;
  isDefault?: boolean;
  steps?: unknown;
  linkPolicy?: unknown;
  allowLowRiskAutoSend?: boolean;
  sameCompanyContactStrategy?: unknown;
}

/** Convert one sequence policy record into the API view shape. */
export function toSequencePolicyView(record: CrmSequencePolicyRecord) {
  return {
    ...record,
    steps: record.steps.map(step => ({ ...step })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

/** Normalize create input and attach organization/editor metadata. */
export function normalizeSequencePolicyCreateInput(input: SequencePolicyWriteInput, context: CrmUserContext) {
  const status = normalizeSequencePolicyStatus(input.status);
  const isDefault = Boolean(input.isDefault);

  if (isDefault && status !== 'active') {
    throw new BadRequestException('只能将启用策略设为默认');
  }

  return {
    organizationId: context.organizationId,
    name: normalizeRequiredString(input.name ?? '', '序列策略名称不能为空'),
    description: normalizeNullableString(input.description),
    status,
    isDefault,
    steps: normalizeSequencePolicyWriteSteps(input.steps),
    linkPolicy: normalizeSequencePolicyLinkPolicy(input.linkPolicy),
    allowLowRiskAutoSend: Boolean(input.allowLowRiskAutoSend),
    sameCompanyContactStrategy: normalizeSequencePolicySameCompanyStrategy(input.sameCompanyContactStrategy),
    createdById: context.userId,
    createdByName: context.userName
  };
}

/** Normalize patch-like update input while preserving omitted fields. */
export function normalizeSequencePolicyUpdateInput(input: SequencePolicyWriteInput) {
  const data: {
    name?: string;
    description?: string | null;
    status?: ReturnType<typeof normalizeSequencePolicyStatus>;
    isDefault?: boolean;
    steps?: ReturnType<typeof normalizeSequencePolicyWriteSteps>;
    linkPolicy?: ReturnType<typeof normalizeSequencePolicyLinkPolicy>;
    allowLowRiskAutoSend?: boolean;
    sameCompanyContactStrategy?: ReturnType<typeof normalizeSequencePolicySameCompanyStrategy>;
  } = {};

  if (hasOwn(input, 'name')) data.name = normalizeRequiredString(input.name ?? '', '序列策略名称不能为空');
  if (hasOwn(input, 'description')) data.description = normalizeNullableString(input.description);
  if (hasOwn(input, 'status')) data.status = normalizeSequencePolicyStatus(input.status);
  if (hasOwn(input, 'isDefault')) data.isDefault = Boolean(input.isDefault);
  if (hasOwn(input, 'steps')) data.steps = normalizeSequencePolicyWriteSteps(input.steps);
  if (hasOwn(input, 'linkPolicy')) data.linkPolicy = normalizeSequencePolicyLinkPolicy(input.linkPolicy);
  if (hasOwn(input, 'allowLowRiskAutoSend')) data.allowLowRiskAutoSend = Boolean(input.allowLowRiskAutoSend);
  if (hasOwn(input, 'sameCompanyContactStrategy')) {
    data.sameCompanyContactStrategy = normalizeSequencePolicySameCompanyStrategy(input.sameCompanyContactStrategy);
  }

  return data;
}

/** Normalize the five-step sequence policy contract used by CRM sequences. */
export function normalizeSequencePolicyWriteSteps(value: unknown) {
  if (!Array.isArray(value)) {
    return defaultSequencePolicySteps.map(step => ({ ...step }));
  }

  if (value.length !== defaultSequenceStepCount) {
    throw new BadRequestException('序列策略必须包含 5 个步骤');
  }

  const steps = normalizeSequencePolicySteps(value);
  if (steps.some((step, index) => step.stepIndex !== index + 1)) {
    throw new BadRequestException('序列策略步骤必须为 1-5');
  }

  return steps;
}

function normalizeRequiredString(value: string, emptyMessage: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new BadRequestException(emptyMessage);
  }

  return normalized;
}

function hasOwn<T extends object>(object: T, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(object, key);
}
