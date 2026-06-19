import { Injectable } from '@nestjs/common';
import { defaultAiModelConfigKey } from '../ai-gateway/ai-gateway.constants';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { buildCrmAiDraftPrompt, parseCrmAiDraftOutput } from './crm-ai-draft-prompt';
import type { CrmAiDraftGenerateResult, CrmAiDraftPromptInput } from './crm-ai-draft.types';

@Injectable()
export class CrmAiDraftService {
  constructor(private readonly aiGatewayService: Pick<AiGatewayService, 'generateText'>) {}

  /** Generates a review-only CRM draft from product-line AI writing configuration. */
  async generateDraft(input: CrmAiDraftPromptInput): Promise<CrmAiDraftGenerateResult> {
    const prompt = buildCrmAiDraftPrompt(input);
    const result = await this.aiGatewayService.generateText({
      prompt: prompt.userPrompt,
      systemPrompt: prompt.systemPrompt,
      modelConfigKey: defaultAiModelConfigKey,
      temperature: 0.4,
      maxOutputTokens: 1200
    });
    const output = parseCrmAiDraftOutput(result.text);
    const riskNotes = [...new Set([...prompt.riskNotes, ...output.riskNotes])];

    return {
      ...output,
      riskNotes,
      metadata: {
        generated: true,
        reason: output.reason,
        riskNotes,
        snapshot: {
          productLineId: input.productLine.id,
          productLineName: input.productLine.name,
          stepIndex: input.stepIndex,
          writingConfig: input.writingConfig,
          reason: output.reason,
          riskNotes,
          generatedAt: new Date().toISOString()
        }
      }
    };
  }
}
