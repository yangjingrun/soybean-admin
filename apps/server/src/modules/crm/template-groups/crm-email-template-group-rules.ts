import { BadRequestException } from '@nestjs/common';
import {
  defaultTemplateSteps,
  defaultTemplateVariables,
  personaProfiles as builtInPersonaProfiles,
  type PersonaProfile
} from '../crm-email-template-renderer';
import { toTemplatePersonaProfile } from '../crm-persona-match';
import type {
  CrmEmailTemplateGroupRecord,
  CrmEmailTemplateGroupUpdateInput,
  CrmEmailTemplateStatus,
  CrmEmailTemplateStepInput,
  CrmGlobalConfigRecord,
  CrmPersonaProfileRecord
} from '../crm.types';
import { normalizeLimitedContent, normalizeNullableString } from '../shared/crm-normalizers';

export const defaultEmailTemplateStatus: CrmEmailTemplateStatus = 'active';
export const defaultEmailTemplateStepCount = 5;
export const initialEmailTemplateStepIndex = 1;

export interface EmailTemplateGroupCreateInput {
  name: string;
  language?: string | null;
  description?: string | null;
  steps: CrmEmailTemplateStepInput[];
}

export interface EmailTemplateGroupUpdateInput extends Partial<Omit<EmailTemplateGroupCreateInput, 'steps'>> {
  status?: CrmEmailTemplateStatus;
  isDefault?: boolean;
  steps?: CrmEmailTemplateStepInput[];
}

/** Normalize create payloads before they reach the template repository. */
export function normalizeEmailTemplateGroupCreateInput(input: EmailTemplateGroupCreateInput) {
  return {
    name: normalizeRequiredString(input.name, '邮件模板名称不能为空'),
    language: normalizeNullableString(input.language) || 'en',
    description: normalizeNullableString(input.description),
    steps: normalizeEmailTemplateSteps(input.steps)
  };
}

/** Normalize patch-like updates while preserving explicit null and boolean values. */
export function normalizeEmailTemplateGroupUpdateInput(
  input: EmailTemplateGroupUpdateInput
): CrmEmailTemplateGroupUpdateInput {
  const data: CrmEmailTemplateGroupUpdateInput = {};

  if (hasOwn(input, 'name')) data.name = normalizeRequiredString(input.name ?? '', '邮件模板名称不能为空');
  if (hasOwn(input, 'language')) data.language = normalizeNullableString(input.language) || 'en';
  if (hasOwn(input, 'description')) data.description = normalizeNullableString(input.description);
  if (hasOwn(input, 'status')) data.status = input.status;
  if (hasOwn(input, 'isDefault')) data.isDefault = input.isDefault;
  if (hasOwn(input, 'steps')) data.steps = normalizeEmailTemplateSteps(input.steps ?? []);

  return data;
}

/** Normalize and validate the five persisted sequence template steps. */
export function normalizeEmailTemplateSteps(steps: CrmEmailTemplateStepInput[]): CrmEmailTemplateStepInput[] {
  if (steps.length !== defaultEmailTemplateStepCount) {
    throw new BadRequestException('邮件模板必须包含 5 个步骤');
  }

  const normalizedSteps = steps
    .map(step => ({
      stepIndex: step.stepIndex,
      name: normalizeRequiredString(step.name, '步骤名称不能为空'),
      threadMode: step.threadMode,
      delayDays: normalizeEmailTemplateDelayDays(step.stepIndex, step.delayDays),
      subjectTemplate: normalizeEmailTemplateSubject(step.stepIndex, step.subjectTemplate),
      bodyTemplate: normalizeLimitedContent(step.bodyTemplate, '邮件正文不能为空', 4000)
    }))
    .toSorted((left, right) => left.stepIndex - right.stepIndex);

  if (normalizedSteps.some((step, index) => step.stepIndex !== index + 1)) {
    throw new BadRequestException('邮件模板步骤必须为 1-5');
  }

  return normalizedSteps;
}

/** Convert one template group record into the API view shape. */
export function toEmailTemplateGroupView(record: CrmEmailTemplateGroupRecord) {
  return {
    ...record,
    steps: record.steps.map(step => ({
      ...step,
      createdAt: step.createdAt.toISOString(),
      updatedAt: step.updatedAt.toISOString()
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

/** Build the read-only default template/persona view used by CRM settings. */
export function toEmailTemplateDefaultsView(input: {
  defaultTemplateGroup: CrmEmailTemplateGroupRecord | null;
  activePersonaProfiles: CrmPersonaProfileRecord[];
  globalConfig?: CrmGlobalConfigRecord;
}) {
  const personas = toTemplatePersonaDefaults(input.activePersonaProfiles);

  if (input.defaultTemplateGroup) {
    return {
      templateGroup: {
        ...toEmailTemplateGroupView(input.defaultTemplateGroup),
        scope: 'organization' as const,
        variables: cloneDefaultTemplateVariables()
      },
      personas
    };
  }

  const globalConfig = input.globalConfig;

  if (!globalConfig) {
    throw new BadRequestException('CRM 全局配置不存在');
  }

  return {
    templateGroup: {
      id: 'global-first-touch',
      name: '默认开发信序列模板',
      scope: 'global' as const,
      language: 'en',
      variables: cloneDefaultTemplateVariables(),
      steps: defaultTemplateSteps.map(step => ({
        ...step,
        delayDays: getTemplateStepDelayDays(step.stepIndex, globalConfig.followUpDelayDays)
      }))
    },
    personas
  };
}

/** Resolve organization persona defaults first, then fall back to built-in personas. */
export function toTemplatePersonaDefaults(activePersonaProfiles: CrmPersonaProfileRecord[]) {
  const profiles = activePersonaProfiles.length
    ? activePersonaProfiles.map(toTemplatePersonaProfile)
    : builtInPersonaProfiles.map(profile => ({
        ...profile,
        aliases: [...profile.aliases]
      }));

  return profiles.map(cloneTemplatePersonaProfile);
}

/** Map configured follow-up delays onto the built-in default sequence steps. */
export function getTemplateStepDelayDays(
  stepIndex: number,
  followUpDelayDays: CrmGlobalConfigRecord['followUpDelayDays']
) {
  if (stepIndex === initialEmailTemplateStepIndex) {
    return 0;
  }

  const delayDaysByStep = new Map([
    [2, followUpDelayDays.step2Days],
    [3, followUpDelayDays.step3Days],
    [4, followUpDelayDays.step4Days],
    [5, followUpDelayDays.step5Days]
  ]);

  return delayDaysByStep.get(stepIndex) ?? 0;
}

/** Check own properties so update payloads can intentionally clear optional fields. */
export function hasOwn<T extends object>(object: T, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeEmailTemplateDelayDays(stepIndex: number, value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 90) {
    throw new BadRequestException('发送间隔必须在 0-90 天之间');
  }

  return stepIndex === initialEmailTemplateStepIndex ? 0 : value;
}

function normalizeEmailTemplateSubject(stepIndex: number, value: string) {
  const normalized = value.trim();

  if (normalized.length > 300) {
    throw new BadRequestException('邮件主题不能超过 300 个字符');
  }

  if (stepIndex !== 2 && !normalized) {
    throw new BadRequestException('新主题邮件必须填写主题');
  }

  return normalized;
}

function normalizeRequiredString(value: string, emptyMessage: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new BadRequestException(emptyMessage);
  }

  return normalized;
}

function cloneDefaultTemplateVariables() {
  return defaultTemplateVariables.map(variable => ({
    ...variable
  }));
}

function cloneTemplatePersonaProfile(profile: PersonaProfile) {
  return {
    ...profile,
    aliases: [...profile.aliases]
  };
}
