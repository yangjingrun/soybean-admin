declare namespace Api {
  namespace AiGateway {
    interface AiPromptRecord {
      promptKey: string;
      title: string;
      systemPrompt: string;
      updatedAt: string;
    }

    type AiPromptValidationStatus = 'pass' | 'warn' | 'fail';

    interface AiPromptValidationItem {
      key: string;
      label: string;
      status: AiPromptValidationStatus;
      message: string;
    }

    interface AiPromptValidationResult {
      ok: boolean;
      items: AiPromptValidationItem[];
    }

    interface AiPromptVersionRecord {
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

    interface AiPromptTestRunRecord {
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

    interface AiPromptStepSummary {
      promptKey: string;
      title: string;
      usage: string;
      channel: 'search_places' | 'maps' | 'analysis' | 'email' | 'crm_email';
      group?: string;
      published: AiPromptRecord | null;
      draft: AiPromptVersionRecord | null;
      latestTestRun: AiPromptTestRunRecord | null;
    }

    interface AiPromptWorkbenchDetail extends AiPromptStepSummary {
      versions: AiPromptVersionRecord[];
      defaultPrompt: AiPromptRecord;
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

    interface SavePromptDraftPayload extends SavePromptPayload {
      changeNote?: string | null;
    }

    interface ValidatePromptDraftPayload {
      promptKey: string;
      systemPrompt: string;
    }

    interface TestPromptDraftPayload extends ValidatePromptDraftPayload {
      inputPrompt: string;
    }

    interface PublishPromptDraftPayload {
      promptKey: string;
      changeNote?: string | null;
    }

    interface RollbackPromptVersionPayload extends PublishPromptDraftPayload {
      versionId: string;
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

    interface MyAiModelConfigRecord {
      configKey?: string;
      title?: string;
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

    interface MySerperConfigRecord {
      title: string;
      apiBase: string;
      apiKey?: string;
      hasApiKey: boolean;
      maskedApiKey: string;
      updatedAt: string;
    }

    interface MyHunterConfigRecord {
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

    interface SaveMyModelConfigPayload {
      providerName: string;
      apiBase: string;
      apiKey?: string;
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

    interface SaveMySerperConfigPayload {
      title: string;
      apiBase: string;
      apiKey?: string;
    }

    interface SaveHunterConfigPayload {
      configKey: string;
      title: string;
      apiBase: string;
      apiKey: string;
    }

    interface SaveMyHunterConfigPayload {
      title: string;
      apiBase: string;
      apiKey?: string;
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
