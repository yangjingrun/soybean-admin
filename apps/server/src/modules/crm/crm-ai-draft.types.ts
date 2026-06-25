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
  sourceSnapshot?: Record<string, unknown> | null;
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

export interface CrmAiDraftStepStrategy {
  taskDescription: string;
  newValue: string;
  wordRange: { min: number; max: number };
  requiredFactGroups: string[];
  mustDo?: string[];
  mustAvoid?: string[];
  ctaInstruction?: string;
  selfCheck?: string[];
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
  stepStrategy?: CrmAiDraftStepStrategy | null;
}

export interface CrmAiDraftPrompt {
  systemPrompt: string;
  userPrompt: string;
  riskNotes: string[];
}

export type CrmAiDraftSendDecision = 'send' | 'hold_for_review' | 'skip';

export interface CrmAiDraftSequenceNovelty {
  newValueVsPrevious: string;
  ctaDifferentFromPrevious: boolean;
  ctaObjectDifferentFromPrevious: boolean;
  industryAngleDifferentFromPrevious: boolean;
  subjectDifferentFromPrevious: boolean;
}

export interface CrmAiDraftOutput {
  sendDecision?: CrmAiDraftSendDecision;
  subject: string;
  bodyText: string;
  reason: string;
  roleNormalized?: string;
  roleDecision?: string;
  operatingContext?: string;
  industryAngle?: string;
  ctaType?: string;
  ctaObject?: string;
  ctaResponseMode?: string;
  riskNotes: string[];
  usedAngles: string[];
  usedFacts: string[];
  canonicalTermsUsed?: string[];
  sequenceNovelty?: CrmAiDraftSequenceNovelty | null;
  nextReviewHints: string[];
  qualityFlags: string[];
  polishChanges: string[];
}

export interface CrmAiDraftGenerateResult extends CrmAiDraftOutput {
  metadata: CrmAiDraftMetadata;
}
