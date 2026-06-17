import { Inject, Injectable } from '@nestjs/common';
import type { UserInfo } from '../auth/auth.types';
import { defaultAiModelConfigKey, leadKeywordOptimizePromptKey } from '../ai-gateway/ai-gateway.constants';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import type { KeywordOptimizeDto } from './dto/keyword-optimize.dto';

export interface AiLeadsContext {
  user?: UserInfo | null;
}

@Injectable()
export class AiLeadsService {
  constructor(@Inject(AiGatewayService) private readonly aiGatewayService: AiGatewayService) {}

  /** Runs the fixed AI leads keyword optimization step with the configured system prompt. */
  optimizeKeywords(dto: KeywordOptimizeDto, context: AiLeadsContext = {}) {
    return this.aiGatewayService.generateText(
      {
        modelConfigKey: defaultAiModelConfigKey,
        promptKey: leadKeywordOptimizePromptKey,
        prompt: dto.requirement.trim()
      },
      context
    );
  }
}
