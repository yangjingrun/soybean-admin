import { BadRequestException } from '@nestjs/common';
import type {
  CrmAiWritingStepIndex,
  CrmProductLineAiWritingConfig,
  CrmProductLineAiWritingStepConfig
} from './crm.types';
import type { CrmAiDraftOutput, CrmAiDraftPrompt, CrmAiDraftPromptInput } from './crm-ai-draft.types';
import { buildCrmAiWritingContext } from './ai-writing/crm-ai-writing-context';
import { resolveCrmAiWritingModules } from './ai-writing/crm-ai-writing-module-resolver';
import { composeCrmAiWritingPrompt } from './ai-writing/crm-ai-writing-prompt-composer';
import type { CrmAiWritingContext, CrmAiWritingSelectedModule } from './ai-writing/crm-ai-writing-module.types';

const stepIndexes: CrmAiWritingStepIndex[] = [1, 2, 3, 4, 5];

/** Normalizes a product-line AI writing config without inventing missing prompts. */
export function normalizeCrmProductLineAiWritingConfig(value: unknown): CrmProductLineAiWritingConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Partial<CrmProductLineAiWritingConfig>;
  const enabled = Boolean(record.enabled);
  const steps = Array.isArray(record.steps) ? record.steps : [];

  return {
    enabled,
    commonRequirements: normalizeString(record.commonRequirements),
    forbiddenClaims: normalizeString(record.forbiddenClaims),
    productEmphasis: normalizeString(record.productEmphasis),
    ...normalizeOptionalAiWritingStyle(record),
    steps: stepIndexes.map(stepIndex => {
      const step = steps.find(item => Number(item?.stepIndex) === stepIndex);

      return {
        stepIndex,
        prompt: normalizeString(step?.prompt)
      };
    })
  };
}

function normalizeOptionalAiWritingStyle(record: Partial<CrmProductLineAiWritingConfig>) {
  return {
    ...pickStringUnion(record.sequenceStrategy, ['core_3_step', 'full_5_step'], 'sequenceStrategy'),
    ...pickStringUnion(
      record.languagePolicy,
      ['account_locale_or_english', 'english', 'local_language'],
      'languagePolicy'
    ),
    ...pickStringUnion(record.tone, ['consultative', 'direct', 'formal'], 'tone'),
    ...pickStringUnion(
      record.ctaPreference,
      ['low_friction_question', 'meeting', 'quote', 'referral'],
      'ctaPreference'
    ),
    ...pickStringUnion(record.polishPolicy, ['auto_when_flagged', 'always', 'off'], 'polishPolicy'),
    ...pickTrimmedOptional(record.proofAssets, 'proofAssets'),
    ...pickTrimmedOptional(record.regionNotes, 'regionNotes')
  };
}

function pickStringUnion<Key extends keyof CrmProductLineAiWritingConfig>(
  value: unknown,
  allowed: string[],
  key: Key
) {
  return typeof value === 'string' && allowed.includes(value) ? { [key]: value } : {};
}

function pickTrimmedOptional<Key extends keyof CrmProductLineAiWritingConfig>(value: unknown, key: Key) {
  const normalized = normalizeString(value);
  return normalized ? { [key]: normalized } : {};
}

/** Returns an enabled complete config or throws a user-facing business error. */
export function requireEnabledCrmProductLineAiWritingConfig(value: unknown): CrmProductLineAiWritingConfig {
  const config = normalizeCrmProductLineAiWritingConfig(value);

  if (!config?.enabled) {
    throw new BadRequestException('产品线未启用 AI 写信配置');
  }

  if (!config.commonRequirements) throw new BadRequestException('AI 写信通用要求不能为空');
  if (!config.forbiddenClaims) throw new BadRequestException('AI 写信禁止内容不能为空');
  if (!config.productEmphasis) throw new BadRequestException('AI 写信产品重点不能为空');

  for (const step of config.steps) {
    if (!step.prompt) {
      throw new BadRequestException(`AI 写信第 ${step.stepIndex} 封提示词不能为空`);
    }
  }

  return config;
}

/** Builds strict model instructions and a structured CRM context prompt. */
export function buildCrmAiDraftPrompt(
  input: CrmAiDraftPromptInput,
  options: { selectedModules?: CrmAiWritingSelectedModule[]; writingContext?: CrmAiWritingContext } = {}
): CrmAiDraftPrompt {
  const config = requireEnabledCrmProductLineAiWritingConfig(input.writingConfig);
  const riskNotes = collectCrmAiDraftRiskNotes(input);
  const selectedModules =
    options.selectedModules ??
    resolveCrmAiWritingModules({
      stepIndex: input.stepIndex,
      contactTitle: input.contact.title,
      account: input.account,
      previousMessages: input.previousMessages
    });
  const writingContext = options.writingContext ?? buildCrmAiWritingContext({ ...input, writingConfig: config });

  getStepConfig(config, input.stepIndex);

  return composeCrmAiWritingPrompt({
    input: { ...input, writingConfig: config },
    selectedModules,
    writingContext,
    riskNotes
  });
}

/** Collects deterministic review notes when CRM context is too thin for confident personalization. */
export function collectCrmAiDraftRiskNotes(input: CrmAiDraftPromptInput): string[] {
  const notes: string[] = [];

  if (!input.contact.title?.trim()) notes.push('联系人职位缺失');
  if (!input.productLine.coreSellingPoints?.trim()) notes.push('产品核心卖点缺失');
  if (!input.productLine.leadTime?.trim()) notes.push('产品交期未配置');

  return notes;
}

/** Parses strict model JSON output into a CRM draft. */
export function parseCrmAiDraftOutput(text: string): CrmAiDraftOutput {
  let value: unknown;

  try {
    value = JSON.parse(text.trim());
  } catch {
    throw new BadRequestException('AI 返回内容不是合法 JSON');
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('AI 返回内容不是合法 JSON 对象');
  }

  const record = value as Partial<CrmAiDraftOutput>;
  const subject = normalizeString(record.subject);
  const bodyText = normalizeString(record.bodyText);
  const reason = normalizeString(record.reason);
  const riskNotes = normalizeStringArray(record.riskNotes);

  if (!bodyText) throw new BadRequestException('AI 返回正文不能为空');

  return {
    subject,
    bodyText,
    reason,
    riskNotes,
    usedAngles: normalizeStringArray(record.usedAngles),
    usedFacts: normalizeStringArray(record.usedFacts),
    nextReviewHints: normalizeStringArray(record.nextReviewHints),
    qualityFlags: normalizeStringArray(record.qualityFlags),
    polishChanges: normalizeStringArray(record.polishChanges)
  };
}

function getStepConfig(
  config: CrmProductLineAiWritingConfig,
  stepIndex: CrmAiWritingStepIndex
): CrmProductLineAiWritingStepConfig {
  const step = config.steps.find(item => item.stepIndex === stepIndex);

  if (!step) {
    throw new BadRequestException(`AI 写信第 ${stepIndex} 封提示词不能为空`);
  }

  return step;
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(item => normalizeString(item)).filter(Boolean) : [];
}
