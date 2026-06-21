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

export interface AiPromptStore {
  getPrompt(promptKey: string): Promise<AiPromptRecord | null>;
  savePrompt(record: AiPromptRecord): Promise<AiPromptRecord>;
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
