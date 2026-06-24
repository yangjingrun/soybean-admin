import type {
  CrmAiDraftMetadata,
  CrmAiWritingStepIndex,
  CrmEmailStatus,
  CrmProductLineAiWritingConfig
} from './crm.types';
import type { PersonaProfile } from './crm-email-template-renderer';

export interface CrmAiDraftPromptAccount {
  name: string;
  country: string | null;
  city?: string | null;
  timeZone?: string | null;
  domain: string | null;
  customerType: string | null;
}

export interface CrmAiDraftPromptContact {
  fullName: string | null;
  title: string | null;
  maskedEmail: string;
  emailStatus: CrmEmailStatus;
}

export interface CrmAiDraftPromptProductLine {
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
}

export interface CrmAiDraftPromptMessage {
  stepIndex: number;
  subject: string;
  bodyText: string;
}

export interface CrmAiDraftBaseDraft {
  subject: string;
  bodyText: string;
}

export interface CrmAiDraftPromptInput {
  account: CrmAiDraftPromptAccount;
  contact: CrmAiDraftPromptContact;
  productLine: CrmAiDraftPromptProductLine;
  writingConfig: CrmProductLineAiWritingConfig;
  stepIndex: CrmAiWritingStepIndex;
  previousMessages: CrmAiDraftPromptMessage[];
  senderName: string | null;
  templateLanguage?: string | null;
  baseDraft: CrmAiDraftBaseDraft;
  persona?: Pick<PersonaProfile, 'label' | 'focusText' | 'draftFocusText' | 'painPoints' | 'avoidText'> | null;
}

export interface CrmAiDraftPrompt {
  systemPrompt: string;
  userPrompt: string;
  riskNotes: string[];
}

export interface CrmAiDraftOutput {
  subject: string;
  bodyText: string;
  reason: string;
  riskNotes: string[];
  usedAngles: string[];
  usedFacts: string[];
  nextReviewHints: string[];
  qualityFlags: string[];
  polishChanges: string[];
}

export interface CrmAiDraftGenerateResult extends CrmAiDraftOutput {
  metadata: CrmAiDraftMetadata;
}
