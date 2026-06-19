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

export interface AiModelConfigStore {
  getModelConfig(configKey: string): Promise<AiModelConfigRecord | null>;
  saveModelConfig(record: AiModelConfigRecord): Promise<AiModelConfigRecord>;
}

export interface SerperConfigRecord {
  configKey: string;
  title: string;
  apiBase: string;
  apiKey: string;
  updatedAt: string;
}

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

export interface HunterConfigStore {
  getHunterConfig(configKey: string): Promise<HunterConfigRecord | null>;
  saveHunterConfig(record: HunterConfigRecord): Promise<HunterConfigRecord>;
}
