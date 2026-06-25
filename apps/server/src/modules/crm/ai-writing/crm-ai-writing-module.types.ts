import type { AiPromptKey } from '../../ai-gateway/ai-gateway.constants';
import type { CrmAiDraftPromptInput } from '../crm-ai-draft.types';

export type CrmAiWritingModuleKey = Extract<AiPromptKey, `crm_outreach_${string}`>;

export interface CrmAiWritingSelectedModule {
  promptKey: CrmAiWritingModuleKey;
  title: string;
  reason: string;
  systemPrompt?: string;
  version?: number | null;
  updatedAt?: string | null;
}

export interface CrmAiWritingModuleResolveInput {
  stepIndex: CrmAiDraftPromptInput['stepIndex'];
  contactTitle: string | null;
  account: {
    country?: string | null;
    city?: string | null;
    timeZone?: string | null;
  };
  previousMessages: CrmAiDraftPromptInput['previousMessages'];
}

export interface CrmAiWritingFact {
  id: string;
  label: string;
  value: string;
  source:
    | 'account'
    | 'contact'
    | 'product_line'
    | 'persona'
    | 'previous_message'
    | 'base_draft'
    | 'source_snapshot'
    | 'sequence_strategy';
}

export interface CrmAiWritingPreviousMessageContext {
  factId: string;
  stepIndex: number;
  subject: string;
  bodySummary: string;
}

export interface CrmAiWritingContext {
  publicFacts: CrmAiWritingFact[];
  previousMessages: CrmAiWritingPreviousMessageContext[];
  reviewNotes: string[];
  baseDraftFact: CrmAiWritingFact | null;
}
