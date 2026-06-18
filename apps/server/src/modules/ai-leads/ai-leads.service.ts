import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { UserInfo } from '../auth/auth.types';
import { defaultAiModelConfigKey, leadKeywordOptimizePromptKey } from '../ai-gateway/ai-gateway.constants';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import type { KeywordOptimizeDto } from './dto/keyword-optimize.dto';
import type { SearchOrchestrateDto } from './dto/search-orchestrate.dto';
import { AiLeadSearchOrchestrator } from './ai-lead-search-orchestrator.service';

const keywordOptimizeMaxOutputTokens = 1200;

export interface AiLeadsContext {
  user?: UserInfo | null;
}

@Injectable()
export class AiLeadsService {
  constructor(
    @Inject(AiGatewayService) private readonly aiGatewayService: AiGatewayService,
    @Optional() @Inject(AiLeadSearchOrchestrator) private readonly searchOrchestrator?: AiLeadSearchOrchestrator
  ) {}

  /** Runs the fixed AI leads keyword optimization step with the configured system prompt. */
  optimizeKeywords(dto: KeywordOptimizeDto, context: AiLeadsContext = {}) {
    return this.aiGatewayService.generateText(
      {
        modelConfigKey: defaultAiModelConfigKey,
        promptKey: leadKeywordOptimizePromptKey,
        prompt: dto.requirement.trim(),
        // 关键词优化只需要结构化建议，限制输出长度避免长时间阻塞请求。
        maxOutputTokens: keywordOptimizeMaxOutputTokens
      },
      context
    );
  }

  /** Runs the backend AI leads Search + Places orchestration workflow. */
  searchOrchestrate(dto: SearchOrchestrateDto, context: AiLeadsContext = {}) {
    if (!this.searchOrchestrator) {
      throw new NotFoundException('AI 获客搜索编排服务未初始化');
    }

    return this.searchOrchestrator.search(
      {
        ...dto,
        requirement: dto.requirement.trim()
      },
      context
    );
  }
}
