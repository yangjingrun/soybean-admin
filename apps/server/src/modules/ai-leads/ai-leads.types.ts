import type { AiUsage } from '../ai-gateway/ai-gateway.types';

export interface AiLeadKeywordHistoryRecord {
  id: string;
  userId: string;
  userName: string | null;
  requirement: string;
  resultText: string;
  keywordPlan: unknown;
  finishReason: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiLeadKeywordHistoryView {
  id: string;
  requirement: string;
  resultText: string;
  keywordPlan: unknown;
  finishReason: string;
  usage: AiUsage;
  createdAt: string;
  updatedAt: string;
}

export interface SaveKeywordHistoryInput {
  userId: string;
  userName?: string | null;
  requirement: string;
  resultText: string;
  keywordPlan: unknown;
  finishReason: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
}

export interface UpdateKeywordHistoryInput {
  requirement: string;
  resultText: string;
  keywordPlan: unknown;
}

export interface AiLeadKeywordHistoryStore {
  create(input: SaveKeywordHistoryInput): Promise<AiLeadKeywordHistoryRecord>;
  listByUser(userId: string, take?: number): Promise<AiLeadKeywordHistoryRecord[]>;
  updateByIdForUser(
    id: string,
    userId: string,
    input: UpdateKeywordHistoryInput
  ): Promise<AiLeadKeywordHistoryRecord | null>;
}
