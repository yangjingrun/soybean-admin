import type { CrmAiDraftPromptInput } from '../crm-ai-draft.types';
import type {
  CrmAiWritingContext,
  CrmAiWritingFact,
  CrmAiWritingPreviousMessageContext
} from './crm-ai-writing-module.types';

/** Builds a compact, fact-id based CRM context that is safe to pass to an LLM. */
export function buildCrmAiWritingContext(input: CrmAiDraftPromptInput): CrmAiWritingContext {
  const publicFacts: CrmAiWritingFact[] = [];
  const previousMessages = buildPreviousMessageContext(input.previousMessages);
  const reviewNotes: string[] = [];

  addFact(publicFacts, 'account.name', 'Account name', input.account.name, 'account');
  addFact(publicFacts, 'account.country', 'Account country', input.account.country, 'account');
  addFact(publicFacts, 'account.city', 'Account city', input.account.city, 'account');
  addFact(publicFacts, 'account.timeZone', 'Account timezone', input.account.timeZone, 'account');
  addFact(publicFacts, 'account.domain', 'Account domain', input.account.domain, 'account');
  addFact(publicFacts, 'account.customerType', 'Account customer type', input.account.customerType, 'account');

  addFact(publicFacts, 'contact.fullName', 'Contact name', input.contact.fullName, 'contact');
  addFact(publicFacts, 'contact.title', 'Contact title', input.contact.title, 'contact');
  addFact(publicFacts, 'contact.emailStatus', 'Contact email status', input.contact.emailStatus, 'contact');

  addFact(publicFacts, 'product_line.name', 'Product line', input.productLine.name, 'product_line');
  addFact(
    publicFacts,
    'product_line.targetCustomerType',
    'Target customer type',
    input.productLine.targetCustomerType,
    'product_line'
  );
  addFact(
    publicFacts,
    'product_line.coreSellingPoints',
    'Core selling points',
    input.productLine.coreSellingPoints,
    'product_line'
  );
  addFact(publicFacts, 'product_line.moq', 'MOQ', input.productLine.moq, 'product_line');
  addFact(publicFacts, 'product_line.leadTime', 'Lead time', input.productLine.leadTime, 'product_line');
  addFact(publicFacts, 'product_line.paymentTerms', 'Payment terms', input.productLine.paymentTerms, 'product_line');
  addFact(
    publicFacts,
    'product_line.certifications',
    'Certifications',
    input.productLine.certifications,
    'product_line'
  );
  addFact(publicFacts, 'product_line.catalogUrl', 'Catalog URL', input.productLine.catalogUrl, 'product_line');
  addFact(publicFacts, 'product_line.websiteUrl', 'Website URL', input.productLine.websiteUrl, 'product_line');
  addFact(
    publicFacts,
    'product_line.commonModelsText',
    'Common models',
    input.productLine.commonModelsText,
    'product_line'
  );
  addFact(publicFacts, 'product_line.proofAssets', 'Proof assets', input.writingConfig.proofAssets, 'product_line');
  addFact(publicFacts, 'product_line.regionNotes', 'Region notes', input.writingConfig.regionNotes, 'product_line');

  if (input.persona) {
    addFact(publicFacts, 'persona.label', 'Persona label', input.persona.label, 'persona');
    addFact(publicFacts, 'persona.focusText', 'Persona focus', input.persona.focusText, 'persona');
    addFact(publicFacts, 'persona.draftFocusText', 'Persona draft focus', input.persona.draftFocusText, 'persona');
    addFact(publicFacts, 'persona.painPoints', 'Persona pain points', input.persona.painPoints, 'persona');
    addFact(publicFacts, 'persona.avoidText', 'Persona avoid text', input.persona.avoidText, 'persona');
  }

  publicFacts.push(
    ...previousMessages.map(message => ({
      id: message.factId,
      label: `Previous message step ${message.stepIndex}`,
      value: `Subject: ${message.subject || '(same thread)'}\nBody summary: ${message.bodySummary}`,
      source: 'previous_message' as const
    }))
  );

  if (!input.contact.title?.trim()) reviewNotes.push('联系人职位缺失');
  if (!input.account.country?.trim() && !input.account.city?.trim() && !input.account.timeZone?.trim()) {
    reviewNotes.push('客户地区信息缺失');
  }
  if (!input.productLine.coreSellingPoints?.trim()) reviewNotes.push('产品核心卖点缺失');

  return {
    publicFacts,
    previousMessages,
    reviewNotes,
    baseDraftFact: buildBaseDraftFact(input)
  };
}

function buildPreviousMessageContext(
  messages: CrmAiDraftPromptInput['previousMessages']
): CrmAiWritingPreviousMessageContext[] {
  return messages.map(message => ({
    factId: `previous_message.step_${message.stepIndex}`,
    stepIndex: message.stepIndex,
    subject: normalizeString(message.subject),
    bodySummary: summarizeText(message.bodyText)
  }));
}

function buildBaseDraftFact(input: CrmAiDraftPromptInput): CrmAiWritingFact | null {
  const subject = normalizeString(input.baseDraft.subject);
  const bodyText = normalizeString(input.baseDraft.bodyText);
  if (!subject && !bodyText) return null;

  return {
    id: 'base_draft.current',
    label: 'Base draft',
    value: `Subject: ${subject || '(same thread)'}\nBody: ${bodyText}`,
    source: 'base_draft'
  };
}

function addFact(
  facts: CrmAiWritingFact[],
  id: string,
  label: string,
  value: unknown,
  source: CrmAiWritingFact['source']
) {
  const normalized = normalizeString(value);
  if (!normalized) return;

  facts.push({
    id,
    label,
    value: normalized,
    source
  });
}

function summarizeText(value: unknown) {
  const normalized = normalizeString(value).replace(/\s+/g, ' ');
  return normalized.length > 220 ? `${normalized.slice(0, 217)}...` : normalized;
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
