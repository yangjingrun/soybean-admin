import { Prisma } from '../../../generated/prisma/client';
import { serializeSequencePolicyStepDelayDays, serializeSequencePolicyThreadModes } from '../crm-sequence-policy';
import type {
  CrmAiDraftTaskItemUpdateInput,
  CrmAiDraftTaskUpdateInput,
  CrmAccountCreateInput,
  CrmAccountUpdateInput,
  CrmEmailTemplateStepInput,
  CrmPersonaProfileCreateInput,
  CrmPersonaProfileUpdateInput,
  CrmSequencePolicyCreateInput,
  CrmSequencePolicyUpdateInput
} from '../crm.types';

/** Converts nullable values into Prisma JSON input values. */
export function toNullableJsonInput(value: unknown) {
  return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

/** Maps account create input and serializes nullable source snapshot JSON. */
export function toAccountCreateInput(input: CrmAccountCreateInput): Prisma.CrmAccountUncheckedCreateInput {
  return {
    ...input,
    sourceSnapshot: input.sourceSnapshot === undefined ? undefined : toNullableJsonInput(input.sourceSnapshot)
  };
}

/** Maps account update input and serializes nullable source snapshot JSON. */
export function toAccountUpdateInput(input: CrmAccountUpdateInput): Prisma.CrmAccountUncheckedUpdateInput {
  return {
    ...input,
    sourceSnapshot: input.sourceSnapshot === undefined ? undefined : toNullableJsonInput(input.sourceSnapshot)
  };
}

/** Maps AI draft task updates and serializes nullable JSON fields. */
export function toAiDraftTaskUpdateData(input: CrmAiDraftTaskUpdateInput): Prisma.CrmAiDraftTaskUncheckedUpdateInput {
  return {
    ...input,
    progressState: input.progressState === undefined ? undefined : toNullableJsonInput(input.progressState),
    resultSummary: input.resultSummary === undefined ? undefined : toNullableJsonInput(input.resultSummary)
  };
}

/** Maps AI draft task item updates and serializes nullable JSON metadata. */
export function toAiDraftTaskItemUpdateData(
  input: CrmAiDraftTaskItemUpdateInput
): Prisma.CrmAiDraftTaskItemUncheckedUpdateInput {
  return {
    ...input,
    metadata: input.metadata === undefined ? undefined : toNullableJsonInput(input.metadata)
  };
}

/** Maps normalized email template steps into createMany input rows. */
export function toEmailTemplateStepCreateManyInput(
  organizationId: string,
  templateGroupId: string,
  steps: CrmEmailTemplateStepInput[]
) {
  return steps.map(step => ({
    organizationId,
    templateGroupId,
    stepIndex: step.stepIndex,
    name: step.name,
    threadMode: step.threadMode,
    delayDays: step.delayDays,
    subjectTemplate: step.subjectTemplate,
    bodyTemplate: step.bodyTemplate
  }));
}

/** Maps persona profile create input into unchecked Prisma create input. */
export function toPersonaProfileCreateInput(
  input: CrmPersonaProfileCreateInput
): Prisma.CrmPersonaProfileUncheckedCreateInput {
  return {
    organizationId: input.organizationId,
    name: input.name,
    description: input.description ?? null,
    titleKeywordsText: input.titleKeywordsText ?? null,
    customerTypeKeywordsText: input.customerTypeKeywordsText ?? null,
    painPoints: input.painPoints ?? null,
    focusText: input.focusText ?? null,
    avoidText: input.avoidText ?? null,
    status: input.status,
    isDefault: input.isDefault,
    createdById: input.createdById,
    createdByName: input.createdByName ?? null
  };
}

/** Maps persona profile update input into unchecked Prisma update input. */
export function toPersonaProfileUpdateInput(
  input: CrmPersonaProfileUpdateInput
): Prisma.CrmPersonaProfileUncheckedUpdateInput {
  return {
    name: input.name,
    description: input.description,
    titleKeywordsText: input.titleKeywordsText,
    customerTypeKeywordsText: input.customerTypeKeywordsText,
    painPoints: input.painPoints,
    focusText: input.focusText,
    avoidText: input.avoidText,
    status: input.status,
    isDefault: input.isDefault
  };
}

/** Maps sequence policy create input and serializes policy step arrays. */
export function toSequencePolicyCreateInput(
  input: CrmSequencePolicyCreateInput
): Prisma.CrmSequencePolicyUncheckedCreateInput {
  return {
    organizationId: input.organizationId,
    name: input.name,
    description: input.description ?? null,
    status: input.status,
    isDefault: input.isDefault,
    stepDelayDaysText: serializeSequencePolicyStepDelayDays(input.steps),
    stepThreadModesText: serializeSequencePolicyThreadModes(input.steps),
    linkPolicy: input.linkPolicy,
    allowLowRiskAutoSend: input.allowLowRiskAutoSend,
    sameCompanyContactStrategy: input.sameCompanyContactStrategy,
    createdById: input.createdById,
    createdByName: input.createdByName ?? null
  };
}

/** Maps sequence policy update input and serializes optional policy step arrays. */
export function toSequencePolicyUpdateInput(
  input: CrmSequencePolicyUpdateInput
): Prisma.CrmSequencePolicyUncheckedUpdateInput {
  return {
    name: input.name,
    description: input.description,
    status: input.status,
    isDefault: input.isDefault,
    ...(input.steps
      ? {
          stepDelayDaysText: serializeSequencePolicyStepDelayDays(input.steps),
          stepThreadModesText: serializeSequencePolicyThreadModes(input.steps)
        }
      : {}),
    linkPolicy: input.linkPolicy,
    allowLowRiskAutoSend: input.allowLowRiskAutoSend,
    sameCompanyContactStrategy: input.sameCompanyContactStrategy
  };
}
