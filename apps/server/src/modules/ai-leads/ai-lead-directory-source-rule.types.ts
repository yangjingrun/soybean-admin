import type { RequestUserContext } from '../../shared/request-context';
import type { AiLeadDirectorySourceRuleMatchMode } from './ai-lead-source-url';

export interface AiLeadDirectorySourceRuleRecord {
  id: string;
  value: string;
  matchMode: AiLeadDirectorySourceRuleMatchMode;
  enabled: boolean;
  builtin: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiLeadDirectorySourceRuleInput {
  value: string;
  matchMode: AiLeadDirectorySourceRuleMatchMode;
  enabled: boolean;
  description?: string | null;
  user?: RequestUserContext | null;
}

export interface AiLeadDirectorySourceRuleUpdateInput extends AiLeadDirectorySourceRuleInput {
  id: string;
}

export interface AiLeadDirectorySourceRuleStore {
  listRules(): Promise<AiLeadDirectorySourceRuleRecord[]>;
  createRule(input: AiLeadDirectorySourceRuleInput): Promise<AiLeadDirectorySourceRuleRecord>;
  updateRule(input: AiLeadDirectorySourceRuleUpdateInput): Promise<AiLeadDirectorySourceRuleRecord | null>;
  deleteRule(id: string): Promise<boolean>;
}
