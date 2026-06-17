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
      apiKey: string;
      model: string;
      temperature?: number;
      maxOutputTokens?: number;
      updatedAt: string;
    }

    interface SaveModelConfigPayload {
      configKey: string;
      title: string;
      providerName: string;
      apiBase: string;
      apiKey: string;
      model: string;
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
