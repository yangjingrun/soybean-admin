declare namespace Api {
  namespace AiGateway {
    interface AiPromptRecord {
      promptKey: string;
      title: string;
      systemPrompt: string;
      updatedAt: string;
    }

    interface AiUsage {
      inputTokens: number | null;
      outputTokens: number | null;
      totalTokens: number | null;
    }

    interface AiTextResult {
      text: string;
      finishReason: string;
      usage: AiUsage;
    }

    interface SavePromptPayload {
      promptKey: string;
      title: string;
      systemPrompt: string;
    }

    interface AiModelConfigRecord {
      configKey: string;
      title: string;
      providerName: string;
      apiBase: string;
      apiKey?: string;
      model: string;
      temperature?: number;
      maxOutputTokens?: number;
      hasApiKey: boolean;
      maskedApiKey: string;
      updatedAt: string;
    }

    interface SerperConfigRecord {
      configKey: string;
      title: string;
      apiBase: string;
      apiKey?: string;
      hasApiKey: boolean;
      maskedApiKey: string;
      updatedAt: string;
    }

    interface HunterConfigRecord {
      configKey: string;
      title: string;
      apiBase: string;
      apiKey?: string;
      hasApiKey: boolean;
      maskedApiKey: string;
      updatedAt: string;
    }

    interface SaveModelConfigPayload {
      configKey: string;
      title: string;
      providerName: string;
      apiBase: string;
      apiKey: string;
      model: string;
      temperature?: number;
      maxOutputTokens?: number;
    }

    interface SaveSerperConfigPayload {
      configKey: string;
      title: string;
      apiBase: string;
      apiKey: string;
    }

    interface SaveHunterConfigPayload {
      configKey: string;
      title: string;
      apiBase: string;
      apiKey: string;
    }

    interface SerperTestResult {
      ok: boolean;
      result: unknown;
    }

    interface HunterTestResult {
      ok: boolean;
      resultEmailCount: number;
    }

    interface GenerateTextPayload {
      prompt: string;
      promptKey?: string;
      modelConfigKey?: string;
      systemPrompt?: string;
      providerName?: string;
      apiBase?: string;
      apiKey?: string;
      model?: string;
      temperature?: number;
      maxOutputTokens?: number;
    }
  }
}
