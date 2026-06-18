import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException
} from '@nestjs/common';
import type { UserInfo } from '../auth/auth.types';
import { defaultAiModelConfigKey, leadKeywordOptimizePromptKey } from '../ai-gateway/ai-gateway.constants';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { SystemLogService } from '../system-log/system-log.service';
import type { KeywordOptimizeDto } from './dto/keyword-optimize.dto';
import type { KeywordHistoryQueryDto, UpdateKeywordHistoryDto } from './dto/keyword-history.dto';
import type { SearchOrchestrateDto } from './dto/search-orchestrate.dto';
import { AiLeadSearchOrchestrator } from './ai-lead-search-orchestrator.service';
import { AI_LEAD_KEYWORD_HISTORY_STORE } from './ai-leads.tokens';
import type { AiLeadKeywordHistoryRecord, AiLeadKeywordHistoryStore } from './ai-leads.types';

const keywordOptimizeMaxOutputTokens = 3600;
const defaultHistorySize = 20;

export interface AiLeadsContext {
  user?: UserInfo | null;
}

@Injectable()
export class AiLeadsService {
  constructor(
    @Inject(AiGatewayService) private readonly aiGatewayService: AiGatewayService,
    @Inject(AI_LEAD_KEYWORD_HISTORY_STORE) private readonly keywordHistoryStore: AiLeadKeywordHistoryStore,
    @Optional() @Inject(SystemLogService) private readonly systemLogService?: SystemLogRecorder,
    @Optional() @Inject(AiLeadSearchOrchestrator) private readonly searchOrchestrator?: AiLeadSearchOrchestrator
  ) {}

  /** Runs the fixed AI leads keyword optimization step with the configured system prompt. */
  async optimizeKeywords(dto: KeywordOptimizeDto, context: AiLeadsContext = {}) {
    const user = this.requireUser(context);
    const result = await this.aiGatewayService.generateText(
      {
        modelConfigKey: defaultAiModelConfigKey,
        promptKey: leadKeywordOptimizePromptKey,
        prompt: dto.requirement.trim(),
        // 关键词优化只需要结构化建议，限制输出长度避免长时间阻塞请求。
        maxOutputTokens: keywordOptimizeMaxOutputTokens
      },
      context
    );
    const keywordPlan = parseKeywordPlan(result.text);
    const historyRecord = await this.keywordHistoryStore.create({
      userId: user.userId,
      userName: user.userName,
      requirement: dto.requirement.trim(),
      resultText: result.text,
      keywordPlan,
      finishReason: result.finishReason,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens
    });

    await this.recordLog('keyword-history-create', '关键词优化历史已保存', context, {
      historyId: historyRecord.id,
      searchQueryCount: readArrayLength(keywordPlan, 'serperSearchQueries'),
      placesQueryCount: readArrayLength(keywordPlan, 'serperPlacesQueries')
    });

    return {
      ...result,
      keywordPlan,
      historyRecord: this.toKeywordHistoryView(historyRecord)
    };
  }

  /** Lists recent keyword optimization histories for the current user. */
  async listKeywordHistories(query: KeywordHistoryQueryDto = {}, context: AiLeadsContext = {}) {
    const user = this.requireUser(context);
    const records = await this.keywordHistoryStore.listByUser(user.userId, query.size ?? defaultHistorySize);

    return {
      records: records.map(record => this.toKeywordHistoryView(record))
    };
  }

  /** Updates one keyword optimization history inside the current user's boundary. */
  async updateKeywordHistory(id: string, dto: UpdateKeywordHistoryDto, context: AiLeadsContext = {}) {
    const user = this.requireUser(context);
    const resultText = JSON.stringify(dto.keywordPlan);
    const record = await this.keywordHistoryStore.updateByIdForUser(id, user.userId, {
      requirement: dto.requirement.trim(),
      resultText,
      keywordPlan: dto.keywordPlan
    });

    if (!record) {
      throw new NotFoundException('关键词优化历史不存在');
    }

    await this.recordLog('keyword-history-update', '关键词优化历史已更新', context, {
      historyId: record.id
    });

    return this.toKeywordHistoryView(record);
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

  private requireUser(context: AiLeadsContext) {
    if (!context.user?.userId) {
      throw new UnauthorizedException('请先登录');
    }

    return context.user;
  }

  private toKeywordHistoryView(record: AiLeadKeywordHistoryRecord) {
    return {
      id: record.id,
      requirement: record.requirement,
      resultText: record.resultText,
      keywordPlan: record.keywordPlan,
      finishReason: record.finishReason,
      usage: {
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        totalTokens: record.totalTokens
      },
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private recordLog(action: string, message: string, context: AiLeadsContext, metadata: Record<string, unknown>) {
    return this.systemLogService?.record({
      level: 'info',
      status: 'success',
      module: 'ai-leads',
      action,
      message,
      userId: context.user?.userId,
      userName: context.user?.userName,
      metadata
    });
  }
}

function parseKeywordPlan(text: string) {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    throw new BadGatewayException('关键词优化结果不是合法 JSON');
  }
}

function readArrayLength(value: unknown, key: string) {
  if (!value || typeof value !== 'object') {
    return 0;
  }

  const item = (value as Record<string, unknown>)[key];

  return Array.isArray(item) ? item.length : 0;
}
