export interface AiUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface AiTextResult {
  text: string;
  finishReason: string;
  usage: AiUsage;
}

export interface AiTextGenerateParams {
  providerName: string;
  apiBase: string;
  apiKey: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  promptKey?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AiTextGenerator {
  generateText(params: AiTextGenerateParams): Promise<AiTextResult>;
}

export interface AiPromptRecord {
  promptKey: string;
  title: string;
  systemPrompt: string;
  updatedAt: string;
}

export type AiPromptValidationStatus = 'pass' | 'warn' | 'fail';

export interface AiPromptValidationItem {
  key: string;
  label: string;
  status: AiPromptValidationStatus;
  message: string;
}

export interface AiPromptValidationResult {
  ok: boolean;
  items: AiPromptValidationItem[];
}

export interface AiPromptVersionRecord {
  id: string;
  promptKey: string;
  title: string;
  version: number;
  lifecycle: 'draft' | 'published';
  systemPrompt: string;
  validationResult: AiPromptValidationResult | null;
  changeNote: string | null;
  createdById: string | null;
  createdByName: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveAiPromptDraftInput {
  promptKey: string;
  title: string;
  systemPrompt: string;
  validationResult: AiPromptValidationResult;
  changeNote?: string | null;
  userId?: string | null;
  userName?: string | null;
}

export interface PublishAiPromptDraftInput {
  promptKey: string;
  changeNote?: string | null;
  userId?: string | null;
  userName?: string | null;
}

export interface AiPromptTestRunRecord {
  id: string;
  promptKey: string;
  inputPrompt: string;
  outputText: string | null;
  validationResult: AiPromptValidationResult | null;
  success: boolean;
  durationMs: number | null;
  errorMessage: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface AiPromptStepSummary {
  promptKey: string;
  title: string;
  usage: string;
  channel: 'search_places' | 'maps' | 'analysis' | 'email';
  published: AiPromptRecord | null;
  draft: AiPromptVersionRecord | null;
  latestTestRun: AiPromptTestRunRecord | null;
}

export interface AiPromptWorkbenchDetail extends AiPromptStepSummary {
  versions: AiPromptVersionRecord[];
  defaultPrompt: AiPromptRecord;
}

export interface SaveAiPromptDraftPayload {
  promptKey: string;
  title: string;
  systemPrompt: string;
  changeNote?: string | null;
}

export interface PublishAiPromptDraftPayload {
  promptKey: string;
  changeNote?: string | null;
}

export interface TestAiPromptDraftPayload {
  promptKey: string;
  systemPrompt: string;
  inputPrompt: string;
}

export interface RollbackAiPromptVersionPayload {
  promptKey: string;
  versionId: string;
  changeNote?: string | null;
}

export interface SaveAiPromptTestRunInput {
  promptKey: string;
  inputPrompt: string;
  outputText?: string | null;
  validationResult: AiPromptValidationResult | null;
  success: boolean;
  durationMs?: number | null;
  errorMessage?: string | null;
  userId?: string | null;
  userName?: string | null;
}

export interface AiPromptStore {
  getPrompt(promptKey: string): Promise<AiPromptRecord | null>;
  savePrompt(record: AiPromptRecord): Promise<AiPromptRecord>;
  getDraftPromptVersion(promptKey: string): Promise<AiPromptVersionRecord | null>;
  saveDraftPromptVersion(input: SaveAiPromptDraftInput): Promise<AiPromptVersionRecord>;
  publishDraftPromptVersion(input: PublishAiPromptDraftInput): Promise<AiPromptVersionRecord>;
  getPromptVersionById(id: string): Promise<AiPromptVersionRecord | null>;
  listPromptVersions(promptKey: string, limit: number): Promise<AiPromptVersionRecord[]>;
  recordPromptTestRun(input: SaveAiPromptTestRunInput): Promise<AiPromptTestRunRecord>;
  getLatestPromptTestRun(promptKey: string): Promise<AiPromptTestRunRecord | null>;
}

export interface AiModelConfigRecord {
  configKey: string;
  title: string;
  providerName: string;
  apiBase: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  updatedAt: string;
}

export type AiModelConfigViewRecord = Omit<AiModelConfigRecord, 'apiKey'> &
  Partial<Pick<AiModelConfigRecord, 'apiKey'>> &
  SecretViewFields;

export interface AiModelConfigStore {
  getModelConfig(configKey: string): Promise<AiModelConfigRecord | null>;
  saveModelConfig(record: AiModelConfigRecord): Promise<AiModelConfigRecord>;
}

export interface AiUserModelConfigRecord {
  userId: string;
  providerName: string;
  apiBase: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  updatedAt: string;
}

export type AiUserModelConfigViewRecord = Omit<AiUserModelConfigRecord, 'userId' | 'apiKey'> &
  Partial<Pick<AiUserModelConfigRecord, 'apiKey'>> &
  SecretViewFields;

export interface AiUserModelConfigStore {
  getUserModelConfig(userId: string): Promise<AiUserModelConfigRecord | null>;
  saveUserModelConfig(record: AiUserModelConfigRecord): Promise<AiUserModelConfigRecord>;
}

export interface AiUserSerperConfigRecord {
  userId: string;
  title: string;
  apiBase: string;
  apiKey: string;
  updatedAt: string;
}

export type AiUserSerperConfigViewRecord = Omit<AiUserSerperConfigRecord, 'userId' | 'apiKey'> &
  Partial<Pick<AiUserSerperConfigRecord, 'apiKey'>> &
  SecretViewFields;

export interface AiUserSerperConfigStore {
  getUserSerperConfig(userId: string): Promise<AiUserSerperConfigRecord | null>;
  saveUserSerperConfig(record: AiUserSerperConfigRecord): Promise<AiUserSerperConfigRecord>;
}

export interface AiUserHunterConfigRecord {
  userId: string;
  title: string;
  apiBase: string;
  apiKey: string;
  updatedAt: string;
}

export type AiUserHunterConfigViewRecord = Omit<AiUserHunterConfigRecord, 'userId' | 'apiKey'> &
  Partial<Pick<AiUserHunterConfigRecord, 'apiKey'>> &
  SecretViewFields;

export interface AiUserHunterConfigStore {
  getUserHunterConfig(userId: string): Promise<AiUserHunterConfigRecord | null>;
  saveUserHunterConfig(record: AiUserHunterConfigRecord): Promise<AiUserHunterConfigRecord>;
}

export interface SerperConfigRecord {
  configKey: string;
  title: string;
  apiBase: string;
  apiKey: string;
  updatedAt: string;
}

export type SerperConfigViewRecord = Omit<SerperConfigRecord, 'apiKey'> &
  Partial<Pick<SerperConfigRecord, 'apiKey'>> &
  SecretViewFields;

export interface SerperConfigStore {
  getSerperConfig(configKey: string): Promise<SerperConfigRecord | null>;
  saveSerperConfig(record: SerperConfigRecord): Promise<SerperConfigRecord>;
}

export interface HunterConfigRecord {
  configKey: string;
  title: string;
  apiBase: string;
  apiKey: string;
  updatedAt: string;
}

export type HunterConfigViewRecord = Omit<HunterConfigRecord, 'apiKey'> &
  Partial<Pick<HunterConfigRecord, 'apiKey'>> &
  SecretViewFields;

export interface HunterConfigStore {
  getHunterConfig(configKey: string): Promise<HunterConfigRecord | null>;
  saveHunterConfig(record: HunterConfigRecord): Promise<HunterConfigRecord>;
}

export interface SecretViewFields {
  hasApiKey: boolean;
  maskedApiKey: string;
}
