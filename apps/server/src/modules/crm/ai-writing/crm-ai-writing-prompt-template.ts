import type { CrmAiWritingStepIndex, CrmPromptTemplateKey } from '../crm.types';
import type { CrmAiWritingModuleKey } from './crm-ai-writing-module.types';

export const defaultCrmPromptTemplateKey = 'crm_outreach_general' satisfies CrmPromptTemplateKey;

export const crmPromptTemplateKeys = [defaultCrmPromptTemplateKey] as const;

const crmGeneralStepPromptKeyMap = {
  1: 'crm_outreach_general_step_1_relevance',
  2: 'crm_outreach_general_step_2_decision',
  3: 'crm_outreach_general_step_3_risk_validation',
  4: 'crm_outreach_general_step_4_choice_followup',
  5: 'crm_outreach_general_step_5_light_exit'
} satisfies Record<CrmAiWritingStepIndex, CrmAiWritingModuleKey>;

const crmTemplateStepPromptKeyMap = {
  crm_outreach_general: crmGeneralStepPromptKeyMap
} satisfies Record<CrmPromptTemplateKey, Record<CrmAiWritingStepIndex, CrmAiWritingModuleKey>>;

/** Normalizes the product-line prompt template key to a supported published-template family. */
export function normalizeCrmPromptTemplateKey(value: unknown): CrmPromptTemplateKey {
  return typeof value === 'string' && crmPromptTemplateKeys.includes(value as CrmPromptTemplateKey)
    ? (value as CrmPromptTemplateKey)
    : defaultCrmPromptTemplateKey;
}

/** Resolves the global prompt key used for one CRM outreach sequence step. */
export function resolveCrmAiWritingStepPromptKey(input: {
  templateKey?: CrmPromptTemplateKey | null;
  stepIndex: CrmAiWritingStepIndex;
}): CrmAiWritingModuleKey {
  const templateKey = normalizeCrmPromptTemplateKey(input.templateKey);

  return crmTemplateStepPromptKeyMap[templateKey][input.stepIndex];
}
