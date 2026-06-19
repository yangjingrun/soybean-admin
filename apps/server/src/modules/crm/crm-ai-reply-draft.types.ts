import type { CrmInboxReplyDraftMetadata } from './crm.types';

export interface CrmAiReplyDraftPromptAccount {
  name: string;
  country: string | null;
  domain: string | null;
  customerType: string | null;
}

export interface CrmAiReplyDraftPromptContact {
  fullName: string | null;
  title: string | null;
  maskedEmail: string;
}

export interface CrmAiReplyDraftPromptProductLine {
  id: string;
  name: string;
  targetCustomerType: string | null;
  coreSellingPoints: string | null;
  moq: string | null;
  leadTime: string | null;
  paymentTerms: string | null;
  certifications: string | null;
  catalogUrl: string | null;
  websiteUrl: string | null;
  commonModelsText: string | null;
  forbiddenClaims: string;
}

export interface CrmAiReplyDraftPromptMessage {
  subject: string;
  bodyText: string;
  receivedAt: string;
}

export interface CrmAiReplyDraftPromptInput {
  account: CrmAiReplyDraftPromptAccount;
  contact: CrmAiReplyDraftPromptContact;
  thread: {
    subject: string;
    status: string;
  };
  latestInboundMessage: CrmAiReplyDraftPromptMessage;
  history: CrmAiReplyDraftPromptMessage[];
  productLine: CrmAiReplyDraftPromptProductLine | null;
  userTopicOrOutline: string;
  senderName: string | null;
}

export interface CrmAiReplyDraftPrompt {
  systemPrompt: string;
  userPrompt: string;
  riskNotes: string[];
}

export interface CrmAiReplyDraftOutput {
  bodyText: string;
  reason: string;
  riskNotes: string[];
}

export interface CrmAiReplyDraftGenerateResult extends CrmAiReplyDraftOutput {
  metadata: CrmInboxReplyDraftMetadata;
}
