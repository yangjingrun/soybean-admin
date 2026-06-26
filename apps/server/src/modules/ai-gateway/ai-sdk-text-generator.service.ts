import { BadGatewayException, Injectable } from '@nestjs/common';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import type { AiTextGenerateParams, AiTextGenerator, AiTextResult, AiUsage } from './ai-gateway.types';

@Injectable()
export class AiSdkTextGenerator implements AiTextGenerator {
  /** Calls any OpenAI-compatible model provider through the AI SDK provider abstraction. */
  async generateText(params: AiTextGenerateParams): Promise<AiTextResult> {
    const provider = createOpenAICompatible({
      name: params.providerName,
      apiKey: params.apiKey,
      baseURL: params.apiBase
    });

    try {
      const result = await generateText({
        model: provider(params.model),
        prompt: params.prompt,
        system: params.systemPrompt,
        temperature: params.temperature,
        maxOutputTokens: params.maxOutputTokens,
        timeout: params.timeout
      });

      return {
        text: result.text,
        finishReason: result.finishReason,
        usage: toAiUsage(result.usage)
      };
    } catch (error) {
      throw new BadGatewayException(`大模型调用失败：${readableError(error)}`);
    }
  }
}

function toAiUsage(usage: { inputTokens?: number; outputTokens?: number }): AiUsage {
  const inputTokens = usage.inputTokens ?? null;
  const outputTokens = usage.outputTokens ?? null;
  const totalTokens = inputTokens === null || outputTokens === null ? null : inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens
  };
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
