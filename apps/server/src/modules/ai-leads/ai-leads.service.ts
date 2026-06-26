import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException
} from '@nestjs/common';
import { isSuper } from '../../shared/permission-policy';
import type { RequestUserContext } from '../../shared/request-context';
import {
  defaultAiModelConfigKey,
  leadKeywordOptimizePromptKey,
  leadMapsKeywordOptimizePromptKey
} from '../ai-gateway/ai-gateway.constants';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { SystemLogService } from '../system-log/system-log.service';
import type { KeywordOptimizeDto } from './dto/keyword-optimize.dto';
import type { KeywordHistoryQueryDto, UpdateKeywordHistoryDto } from './dto/keyword-history.dto';
import type { SearchOrchestrateDto } from './dto/search-orchestrate.dto';
import { AiLeadSearchOrchestrator } from './ai-lead-search-orchestrator.service';
import { toLeadSearchPublicResult, type LeadSearchProgressReporter } from './ai-lead-search-progress';
import { AI_LEAD_KEYWORD_HISTORY_STORE } from './ai-leads.tokens';
import type { AiLeadKeywordHistoryRecord, AiLeadKeywordHistoryStore } from './ai-leads.types';
import {
  attachProductLineSnapshotToKeywordPlan,
  normalizeAiLeadProductLineSnapshot,
  type AiLeadProductLineSnapshot
} from './ai-lead-product-line-context';
import {
  buildMapsKeywordOptimizePrompt,
  buildKeywordOptimizePrompt,
  buildKeywordOptimizeRepairPrompt,
  validateKeywordPlanLocalLanguages
} from './keyword-local-language-rules';

const keywordOptimizeMaxOutputTokens = 3600;
const defaultHistorySize = 20;

export interface AiLeadsContext {
  user?: RequestUserContext | null;
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
    const requirement = dto.requirement.trim();
    const productLineSnapshot = normalizeAiLeadProductLineSnapshot(dto.productLineSnapshot);
    const { result, keywordPlan, qualityWarnings } = await this.generateKeywordPlanWithRepair(
      requirement,
      dto.leadSourceMode ?? 'search',
      productLineSnapshot,
      context
    );
    const resultText = JSON.stringify(keywordPlan);
    const historyRecord = await this.keywordHistoryStore.create({
      userId: user.userId,
      userName: user.userName,
      requirement,
      resultText,
      keywordPlan,
      finishReason: result.finishReason,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens
    });

    await this.recordLog('keyword-history-create', '关键词优化历史已保存', context, {
      historyId: historyRecord.id,
      searchQueryCount: readArrayLength(keywordPlan, 'serperSearchQueries'),
      placesQueryCount: readArrayLength(keywordPlan, 'serperPlacesQueries'),
      mapsQueryCount: readArrayLength(keywordPlan, 'serperMapsQueries'),
      leadSourceMode: dto.leadSourceMode ?? 'search'
    });

    return {
      ...result,
      text: resultText,
      keywordPlan,
      historyRecord: this.toKeywordHistoryView(historyRecord),
      qualityWarnings
    };
  }

  /** Generates a keyword plan and asks the model to repair it once if quality gates fail. */
  private async generateKeywordPlanWithRepair(
    requirement: string,
    leadSourceMode: NonNullable<KeywordOptimizeDto['leadSourceMode']>,
    productLineSnapshot: AiLeadProductLineSnapshot | null,
    context: AiLeadsContext
  ) {
    if (leadSourceMode === 'maps') {
      const result = await this.aiGatewayService.generateText(
        {
          modelConfigKey: defaultAiModelConfigKey,
          promptKey: leadMapsKeywordOptimizePromptKey,
          prompt: buildMapsKeywordOptimizePrompt(requirement, productLineSnapshot),
          maxOutputTokens: keywordOptimizeMaxOutputTokens
        },
        context
      );

      return {
        result,
        keywordPlan: attachProductLineSnapshotToKeywordPlan(parseKeywordPlan(result.text), productLineSnapshot),
        qualityWarnings: []
      };
    }

    const result = await this.aiGatewayService.generateText(
      {
        modelConfigKey: defaultAiModelConfigKey,
        promptKey: leadKeywordOptimizePromptKey,
        prompt: buildKeywordOptimizePrompt(requirement, productLineSnapshot),
        // 关键词优化只需要结构化建议，限制输出长度避免长时间阻塞请求。
        maxOutputTokens: keywordOptimizeMaxOutputTokens
      },
      context
    );
    const keywordPlan = attachProductLineSnapshotToKeywordPlan(parseKeywordPlan(result.text), productLineSnapshot);
    const issues = validateKeywordPlanLocalLanguages(requirement, keywordPlan);

    if (issues.length === 0) {
      return { result, keywordPlan, qualityWarnings: [] };
    }

    const repairResult = await this.aiGatewayService.generateText(
      {
        modelConfigKey: defaultAiModelConfigKey,
        promptKey: leadKeywordOptimizePromptKey,
        prompt: buildKeywordOptimizeRepairPrompt(requirement, issues, keywordPlan, productLineSnapshot),
        maxOutputTokens: keywordOptimizeMaxOutputTokens
      },
      context
    );
    const repairedKeywordPlan = attachProductLineSnapshotToKeywordPlan(
      parseKeywordPlan(repairResult.text),
      productLineSnapshot
    );
    const qualityWarnings = validateKeywordPlanLocalLanguages(requirement, repairedKeywordPlan);

    return { result: repairResult, keywordPlan: repairedKeywordPlan, qualityWarnings };
  }

  /** Lists recent keyword optimization histories for the current user. */
  async listKeywordHistories(query: KeywordHistoryQueryDto = {}, context: AiLeadsContext = {}) {
    const user = this.requireUser(context);
    const records = await this.keywordHistoryStore.listByUser(user.userId, normalizeHistorySize(query.size));

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

  /** Deletes one keyword optimization history inside the current user's boundary. */
  async deleteKeywordHistory(id: string, context: AiLeadsContext = {}) {
    const user = this.requireUser(context);
    const deleted = await this.keywordHistoryStore.deleteByIdForUser(id, user.userId);

    if (!deleted) {
      throw new NotFoundException('关键词优化历史不存在');
    }

    await this.recordLog('keyword-history-delete', '关键词优化历史已删除', context, {
      historyId: id
    });

    return { id };
  }

  /** Runs the backend AI leads Search + Places orchestration workflow. */
  async searchOrchestrate(dto: SearchOrchestrateDto, context: AiLeadsContext = {}) {
    const user = this.requireUser(context);

    if (!this.searchOrchestrator) {
      throw new NotFoundException('AI 获客搜索编排服务未初始化');
    }

    const result = await this.searchOrchestrator.search(
      {
        ...dto,
        requirement: dto.requirement.trim()
      },
      { ...context, user }
    );

    return this.toVisibleSearchResult(result, user);
  }

  /** Runs the backend AI leads orchestration workflow and reports business progress events. */
  async searchOrchestrateStream(
    dto: SearchOrchestrateDto,
    context: AiLeadsContext = {},
    reporter?: LeadSearchProgressReporter
  ) {
    const user = this.requireUser(context);

    if (!this.searchOrchestrator) {
      throw new NotFoundException('AI 获客搜索编排服务未初始化');
    }

    const result = await this.searchOrchestrator.search(
      {
        ...dto,
        requirement: dto.requirement.trim()
      },
      { ...context, user },
      reporter
    );

    return this.toVisibleSearchResult(result, user);
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

  /** Keeps super-admin diagnostics raw while hiding search traces from ordinary users. */
  private toVisibleSearchResult<T extends Parameters<typeof toLeadSearchPublicResult>[0]>(
    result: T,
    user: RequestUserContext
  ) {
    if (isSuper(user)) {
      return result;
    }

    return toLeadSearchPublicResult(result);
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

/** Normalizes query values before passing them to Prisma pagination options. */
function normalizeHistorySize(size: unknown) {
  return Number(size ?? defaultHistorySize);
}

function parseKeywordPlan(text: string) {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
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
