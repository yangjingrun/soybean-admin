import { BadRequestException } from '@nestjs/common';
import type {
  CrmAiReplyDraftOutput,
  CrmAiReplyDraftPrompt,
  CrmAiReplyDraftPromptInput
} from './crm-ai-reply-draft.types';

/** Builds a reply-polish prompt that requires the user's topic or outline as the source intent. */
export function buildCrmAiReplyDraftPrompt(input: CrmAiReplyDraftPromptInput): CrmAiReplyDraftPrompt {
  const topic = normalizeString(input.userTopicOrOutline);

  if (!topic) {
    throw new BadRequestException('回复主题或要点不能为空');
  }

  const riskNotes = collectCrmAiReplyDraftRiskNotes(input);

  return {
    systemPrompt: [
      'You polish B2B customer reply drafts from the user provided topic or outline.',
      'Return only one valid JSON object with bodyText, reason, and riskNotes.',
      'Do not wrap JSON in Markdown.',
      'Do not initiate an email by yourself. Only expand and polish the user topic or outline.',
      'Never invent price, MOQ, lead time, certifications, customer references, exclusive claims, or compliance claims.'
    ].join('\n'),
    userPrompt: [
      'Task: polish and expand the user topic or outline into a concise plain-text reply draft for human review.',
      'The draft must not be sent automatically.',
      '',
      `User topic or outline:\n${topic}`,
      '',
      'Forbidden claims:\nDo not invent unprovided commercial claims.',
      `Sender:\n${input.senderName || 'Sales team'}`,
      '',
      `Account:\n${JSON.stringify(input.account, null, 2)}`,
      `Contact:\n${JSON.stringify(input.contact, null, 2)}`,
      `Thread:\n${JSON.stringify(input.thread, null, 2)}`,
      `Product line:\n${input.productLine ? JSON.stringify(input.productLine, null, 2) : 'None selected.'}`,
      '',
      `Latest customer message:\n${JSON.stringify(input.latestInboundMessage, null, 2)}`,
      `Recent thread history:\n${JSON.stringify(input.history, null, 2)}`,
      '',
      `Known risk notes to include if still relevant:\n${riskNotes.join('\n') || 'None'}`
    ].join('\n'),
    riskNotes
  };
}

/** Collects deterministic review notes when reply context may need human confirmation. */
export function collectCrmAiReplyDraftRiskNotes(input: CrmAiReplyDraftPromptInput): string[] {
  const notes: string[] = [];

  if (!input.productLine) notes.push('未选择产品线，请人工确认产品信息');
  if (!input.contact.fullName?.trim()) notes.push('联系人姓名缺失');
  if (!input.latestInboundMessage.bodyText.trim()) notes.push('最新客户回信正文为空');

  return notes;
}

/** Parses strict model JSON output into a local reply draft. */
export function parseCrmAiReplyDraftOutput(text: string): CrmAiReplyDraftOutput {
  let value: unknown;

  try {
    value = JSON.parse(text.trim());
  } catch {
    throw new BadRequestException('AI 返回内容不是合法 JSON');
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('AI 返回内容不是合法 JSON 对象');
  }

  const record = value as Partial<CrmAiReplyDraftOutput>;
  const bodyText = normalizeString(record.bodyText);
  const reason = normalizeString(record.reason);
  const riskNotes = Array.isArray(record.riskNotes)
    ? record.riskNotes.map(item => normalizeString(item)).filter(Boolean)
    : [];

  if (!bodyText) throw new BadRequestException('AI 返回回复正文不能为空');

  return {
    bodyText,
    reason,
    riskNotes
  };
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
