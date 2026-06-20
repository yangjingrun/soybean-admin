import { Prisma } from '../../../generated/prisma/client';
import type { CrmEmailTemplateGroupModel } from '../../../generated/prisma/models/CrmEmailTemplateGroup';
import type { CrmEmailTemplateStepModel } from '../../../generated/prisma/models/CrmEmailTemplateStep';
import type { CrmPersonaProfileModel } from '../../../generated/prisma/models/CrmPersonaProfile';
import type { CrmProductLineAiPromptVersionModel } from '../../../generated/prisma/models/CrmProductLineAiPromptVersion';
import type { CrmProductLineModel } from '../../../generated/prisma/models/CrmProductLine';
import type { CrmSequencePolicyModel } from '../../../generated/prisma/models/CrmSequencePolicy';
import {
  normalizeSequencePolicyLinkPolicy,
  normalizeSequencePolicySameCompanyStrategy,
  normalizeSequencePolicyStatus,
  parseSequencePolicySteps
} from '../crm-sequence-policy';
import type {
  CrmEmailTemplateGroupRecord,
  CrmEmailTemplateStepRecord,
  CrmPersonaProfileRecord,
  CrmProductLineAiPromptVersionRecord,
  CrmProductLineAiWritingConfig,
  CrmProductLineRecord,
  CrmSequencePolicyRecord
} from '../crm.types';

export type CrmEmailTemplateGroupModelWithSteps = CrmEmailTemplateGroupModel & {
  steps: CrmEmailTemplateStepModel[];
};

/** Maps product-line rows and normalizes the optional AI writing config JSON. */
export function toProductLineRecord(record: CrmProductLineModel): CrmProductLineRecord {
  return {
    ...record,
    aiWritingConfig: toProductLineAiWritingConfig(record.aiWritingConfig),
    status: record.status as CrmProductLineRecord['status']
  };
}

/** Returns a product-line AI writing config only when the persisted JSON is an object. */
export function toProductLineAiWritingConfig(value: unknown): CrmProductLineRecord['aiWritingConfig'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  return value as CrmProductLineRecord['aiWritingConfig'];
}

/** Converts nullable AI writing config into a Prisma JSON value. */
export function toProductLineAiPromptVersionJson(config: CrmProductLineAiWritingConfig | null) {
  return config === null ? Prisma.JsonNull : (config as unknown as Prisma.InputJsonValue);
}

/** Maps product-line prompt versions and normalizes the stored config JSON. */
export function toProductLineAiPromptVersionRecord(
  record: CrmProductLineAiPromptVersionModel
): CrmProductLineAiPromptVersionRecord {
  return {
    ...record,
    aiWritingConfig: toProductLineAiWritingConfig(record.aiWritingConfig)
  };
}

/** Maps persona profile rows used by CRM draft generation. */
export function toPersonaProfileRecord(record: CrmPersonaProfileModel): CrmPersonaProfileRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    description: record.description,
    titleKeywordsText: record.titleKeywordsText,
    customerTypeKeywordsText: record.customerTypeKeywordsText,
    painPoints: record.painPoints,
    focusText: record.focusText,
    avoidText: record.avoidText,
    status: record.status as CrmPersonaProfileRecord['status'],
    isDefault: record.isDefault,
    createdById: record.createdById,
    createdByName: record.createdByName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

/** Maps one email-template sequence step. */
export function toEmailTemplateStepRecord(record: CrmEmailTemplateStepModel): CrmEmailTemplateStepRecord {
  return {
    ...record,
    threadMode: record.threadMode as CrmEmailTemplateStepRecord['threadMode']
  };
}

/** Maps an email-template group together with its ordered steps. */
export function toEmailTemplateGroupRecord(record: CrmEmailTemplateGroupModelWithSteps): CrmEmailTemplateGroupRecord {
  return {
    ...record,
    status: record.status as CrmEmailTemplateGroupRecord['status'],
    steps: record.steps.map(toEmailTemplateStepRecord)
  };
}

/** Maps one sequence policy and parses persisted step delay/thread-mode text. */
export function toSequencePolicyRecord(record: CrmSequencePolicyModel): CrmSequencePolicyRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    description: record.description,
    status: normalizeSequencePolicyStatus(record.status),
    isDefault: record.isDefault,
    steps: parseSequencePolicySteps(record.stepDelayDaysText, record.stepThreadModesText),
    linkPolicy: normalizeSequencePolicyLinkPolicy(record.linkPolicy),
    allowLowRiskAutoSend: record.allowLowRiskAutoSend,
    sameCompanyContactStrategy: normalizeSequencePolicySameCompanyStrategy(record.sameCompanyContactStrategy),
    createdById: record.createdById,
    createdByName: record.createdByName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}
