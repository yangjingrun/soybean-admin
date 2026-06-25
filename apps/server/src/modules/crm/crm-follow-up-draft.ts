import { findPersonaProfile, renderEmailTemplateText, type PersonaProfile } from './crm-email-template-renderer';
import { getCrmOutreachStepStrategy } from './crm-outreach-step-strategy';
import type {
  CrmEmailTemplateGroupRecord,
  CrmGlobalConfigRecord,
  CrmMailboxRecord,
  CrmMessageCreateInput,
  CrmMessageRecord,
  CrmSequencePolicyRecord,
  CrmSequenceReviewRecord
} from './crm.types';

const oneDayMs = 24 * 60 * 60 * 1000;

interface BuildNextFollowUpDraftInput {
  item: Pick<CrmSequenceReviewRecord, 'enrollment' | 'account' | 'contact' | 'productLine' | 'policy'> & {
    mailbox: CrmMailboxRecord | null;
  };
  sourceMessage: CrmMessageRecord;
  providerThreadId: string | null;
  baseTime: Date;
  followUpDelayDays: CrmGlobalConfigRecord['followUpDelayDays'];
  personaProfile?: PersonaProfile | null;
  templateGroup: CrmEmailTemplateGroupRecord | null;
  senderName?: string | null;
}

/** Builds the next follow-up email directly in the send schedule when no customer reply has stopped the sequence. */
export function buildNextFollowUpDraft({
  item,
  sourceMessage,
  providerThreadId,
  baseTime,
  followUpDelayDays,
  personaProfile,
  templateGroup,
  senderName: inputSenderName
}: BuildNextFollowUpDraftInput): Omit<CrmMessageCreateInput, 'enrollmentId'> | null {
  const nextStepIndex = sourceMessage.stepIndex + 1;

  if (nextStepIndex > item.enrollment.totalSteps) {
    return null;
  }

  const templateStep =
    templateGroup?.status === 'active' ? templateGroup.steps.find(step => step.stepIndex === nextStepIndex) : null;
  const policyStep = item.policy?.steps.find(step => step.stepIndex === nextStepIndex) ?? null;
  const strategyStep = getCrmOutreachStepStrategy(nextStepIndex);
  const delayDays =
    policyStep?.delayDays ?? templateStep?.delayDays ?? getFollowUpDelayDays(nextStepIndex, followUpDelayDays);

  if (delayDays === null) {
    return null;
  }

  const senderName = inputSenderName || item.enrollment.createdByName || item.mailbox?.ownerUserName || 'Sales team';
  const persona = personaProfile ?? findPersonaProfile(item.contact.title);
  const renderVars = {
    account: item.account,
    contact: item.contact,
    persona,
    productLine: item.productLine,
    senderName
  };
  const templateBodyText = templateStep ? renderEmailTemplateText(templateStep.bodyTemplate, renderVars) : null;
  const templateSubject =
    templateStep && templateStep.subjectTemplate
      ? renderEmailTemplateText(templateStep.subjectTemplate, renderVars)
      : null;
  const strategySubject = strategyStep.subjectTemplate
    ? renderEmailTemplateText(strategyStep.subjectTemplate, renderVars)
    : null;
  const subject = applyLinkPolicy(templateSubject || strategySubject || sourceMessage.subject, item.policy?.linkPolicy);
  const bodyText = applyLinkPolicy(
    templateBodyText || renderEmailTemplateText(strategyStep.bodyTemplate, renderVars),
    item.policy?.linkPolicy
  );

  return {
    organizationId: sourceMessage.organizationId,
    ownerUserId: sourceMessage.ownerUserId,
    accountId: sourceMessage.accountId,
    contactId: sourceMessage.contactId,
    mailboxId: item.mailbox?.id ?? sourceMessage.mailboxId,
    stepIndex: nextStepIndex,
    threadMode: policyStep?.threadMode ?? templateStep?.threadMode ?? strategyStep.threadMode,
    subject,
    bodyText,
    status: 'draft_ready',
    scheduledAt: new Date(baseTime.getTime() + delayDays * oneDayMs),
    providerThreadId
  };
}

function getFollowUpDelayDays(stepIndex: number, followUpDelayDays: CrmGlobalConfigRecord['followUpDelayDays']) {
  const delayDaysByStep = new Map([
    [2, followUpDelayDays.step2Days],
    [3, followUpDelayDays.step3Days],
    [4, followUpDelayDays.step4Days],
    [5, followUpDelayDays.step5Days]
  ]);
  const delayDays = delayDaysByStep.get(stepIndex);

  return delayDays ?? null;
}

/** Applies sequence link policy to generated plain-text email content. */
function applyLinkPolicy(text: string, linkPolicy?: CrmSequencePolicyRecord['linkPolicy']) {
  if (linkPolicy !== 'block_new_links') return text;

  return text
    .replace(/\[([^\]]+)]\((?:https?:\/\/|www\.)[^)\s]+\)/gi, '$1')
    .replace(/\bhttps?:\/\/\S+/gi, '')
    .replace(/\bwww\.\S+/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
