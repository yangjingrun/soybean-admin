import { BadRequestException } from '@nestjs/common';
import type {
  CrmAiWritingStepIndex,
  CrmProductLineAiWritingConfig,
  CrmProductLineAiWritingStepConfig
} from './crm.types';
import type { CrmAiDraftOutput, CrmAiDraftPrompt, CrmAiDraftPromptInput } from './crm-ai-draft.types';

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
    steps: stepIndexes.map(stepIndex => {
      const step = steps.find(item => Number(item?.stepIndex) === stepIndex);

      return {
        stepIndex,
        prompt: normalizeString(step?.prompt)
      };
    })
  };
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
export function buildCrmAiDraftPrompt(input: CrmAiDraftPromptInput): CrmAiDraftPrompt {
  const config = requireEnabledCrmProductLineAiWritingConfig(input.writingConfig);
  const stepPrompt = getStepConfig(config, input.stepIndex).prompt;
  const riskNotes = collectCrmAiDraftRiskNotes(input);
  const previousMessages = input.previousMessages.length
    ? input.previousMessages
        .map(
          message =>
            `Step ${message.stepIndex}\nSubject: ${message.subject || '(same thread)'}\nBody:\n${message.bodyText}`
        )
        .join('\n\n')
    : 'No previous messages.';

  return {
    systemPrompt: [
      'You write concise B2B outbound email drafts for human review.',
      'Return only one valid JSON object with subject, bodyText, reason, and riskNotes.',
      'Do not wrap JSON in Markdown.',
      'Never invent price, MOQ, lead time, certifications, customer references, exclusive claims, or compliance claims.',
      'Use missing fields as missing; do not create fake personalization.'
    ].join('\n'),
    userPrompt: [
      `Step ${input.stepIndex} of 5.`,
      'Do not repeat previous emails. Change the angle according to the step prompt.',
      '',
      `Common requirements:\n${config.commonRequirements}`,
      `Forbidden claims:\n${config.forbiddenClaims}`,
      `Product emphasis:\n${config.productEmphasis}`,
      `Step prompt:\n${stepPrompt}`,
      '',
      `Account:\n${JSON.stringify(input.account, null, 2)}`,
      `Contact:\n${JSON.stringify(input.contact, null, 2)}`,
      `Product line:\n${JSON.stringify(input.productLine, null, 2)}`,
      `Sender:\n${input.senderName || 'Sales team'}`,
      '',
      `Previous messages:\n${previousMessages}`,
      '',
      `Known risk notes to include if still relevant:\n${riskNotes.join('\n') || 'None'}`
    ].join('\n'),
    riskNotes
  };
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
  const riskNotes = Array.isArray(record.riskNotes)
    ? record.riskNotes.map(item => normalizeString(item)).filter(Boolean)
    : [];

  if (!bodyText) throw new BadRequestException('AI 返回正文不能为空');

  return {
    subject,
    bodyText,
    reason,
    riskNotes
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
