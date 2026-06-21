import { Inject, Injectable } from '@nestjs/common';
import type { RequestUserContext } from '../../shared/request-context';
import { defaultAiModelConfigKey } from '../ai-gateway/ai-gateway.constants';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { buildCrmAiReplyDraftPrompt, parseCrmAiReplyDraftOutput } from './crm-ai-reply-draft-prompt';
import type { CrmAiReplyDraftGenerateResult, CrmAiReplyDraftPromptInput } from './crm-ai-reply-draft.types';

@Injectable()
export class CrmAiReplyDraftService {
  constructor(@Inject(AiGatewayService) private readonly aiGatewayService: Pick<AiGatewayService, 'generateText'>) {}

  /** Polishes a user-provided reply topic into a local draft for human confirmation only. */
  async polishReplyDraft(
    input: CrmAiReplyDraftPromptInput,
    context: RequestUserContext
  ): Promise<CrmAiReplyDraftGenerateResult> {
    const prompt = buildCrmAiReplyDraftPrompt(input);
    const result = await this.aiGatewayService.generateText(
      {
        prompt: prompt.userPrompt,
        systemPrompt: prompt.systemPrompt,
        modelConfigKey: defaultAiModelConfigKey,
        temperature: 0.35,
        maxOutputTokens: 1000
      },
      { user: context }
    );
    const output = parseCrmAiReplyDraftOutput(result.text);
    const riskNotes = [...new Set([...prompt.riskNotes, ...output.riskNotes])];

    return {
      ...output,
      riskNotes,
      metadata: {
        generated: true,
        reason: output.reason,
        riskNotes,
        productLineId: input.productLine?.id ?? null,
        productLineName: input.productLine?.name ?? null,
        generatedAt: new Date().toISOString()
      }
    };
  }
}
