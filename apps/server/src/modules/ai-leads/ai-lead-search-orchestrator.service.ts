import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import type { UserInfo } from '../auth/auth.types';
import {
  defaultAiModelConfigKey,
  defaultSerperConfigKey,
  leadKeywordOptimizePromptKey,
  leadSearchResultDecidePromptKey
} from '../ai-gateway/ai-gateway.constants';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { SerperClient, type SerperEndpoint, type SerperRequestBody } from '../ai-gateway/serper-client.service';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import type { SearchOrchestrateDto } from './dto/search-orchestrate.dto';
import {
  buildKeywordOptimizePrompt,
  buildKeywordOptimizeRepairPrompt,
  validateKeywordPlanLocalLanguages
} from './keyword-local-language-rules';

const keywordOptimizeMaxOutputTokens = 3600;
const searchDecisionMaxOutputTokens = 1000;
const defaultMaxSearchRequests = 20;
const maxSearchPages = 3;
const maxPlacesPages = 2;

export interface AiLeadSearchContext {
  user?: UserInfo | null;
}

interface OptimizedKeywordPlan {
  resolvedProductKeywords?: string;
  resolvedTargetRegions?: string;
  resolvedTargetCustomerProfile?: string;
  resolvedTargetLeadCount?: number | null;
  serperSearchQueries?: SerperQuery[];
  serperPlacesQueries?: SerperQuery[];
  serperMapsQueries?: SerperQuery[];
  [key: string]: unknown;
}

interface SerperQuery extends Record<string, unknown> {
  endpoint?: SerperEndpoint;
  requestBody?: SerperQueryRequestBody;
  meta?: SerperQueryMeta;
  buyerType?: string;
  intent?: string;
  q?: string;
  location?: string;
  city?: string;
  gl?: string;
  hl?: string;
  priority?: string;
}

interface SerperQueryRequestBody extends Record<string, unknown> {
  q?: string;
  gl?: string;
  hl?: string;
  location?: string;
  num?: number;
  page?: number;
  tbs?: string | null;
}

interface SerperQueryMeta extends Record<string, unknown> {
  priority?: string;
  tbs?: string | null;
}

interface SearchRequestTrace {
  endpoint: SerperEndpoint;
  requestBody: SerperRequestBody;
}

interface SearchDecision {
  pageQuality?: string;
  nextAction?: 'paginate' | 'requery' | 'switch_to_places' | 'switch_to_search' | 'stop';
  nextRequest?: {
    endpoint?: SerperEndpoint;
    requestBody?: SerperRequestBody;
  };
  tbs?: string | null;
  [key: string]: unknown;
}

interface CandidateSummary {
  dedupeKey: string;
  sourceType: 'organic' | 'place' | 'local';
  title?: string;
  url?: string;
  snippet?: string;
  website?: string;
  address?: string;
  phoneNumber?: string;
}

@Injectable()
export class AiLeadSearchOrchestrator {
  constructor(
    @Inject(AiGatewayService) private readonly aiGatewayService: AiGatewayService,
    @Inject(SerperClient) private readonly serperClient: SerperClient,
    @Inject(SystemLogService) private readonly systemLogService: SystemLogRecorder
  ) {}

  /** Runs keyword optimization, Serper search, and search-result decisions as one backend workflow. */
  async search(dto: SearchOrchestrateDto, context: AiLeadSearchContext = {}) {
    const requirement = dto.requirement.trim();
    const maxRequests = dto.maxSearchRequests ?? defaultMaxSearchRequests;
    const serperConfig = await this.aiGatewayService.getSerperConfig(defaultSerperConfigKey);

    await this.recordLog('processing', 'AI 获客搜索编排开始', context, {
      maxRequests
    });

    const {
      result: keywordOptimizationText,
      keywordOptimization,
      qualityWarnings
    } = await this.generateKeywordPlanWithRepair(requirement, context);
    const targetLeadCount = dto.targetLeadCountOverride ?? keywordOptimization.resolvedTargetLeadCount ?? null;
    const queryQueue = this.toInitialRequests(keywordOptimization);
    const executedKeys = new Set<string>();
    const serperRequests: SearchRequestTrace[] = [];
    const decisions: Array<{ request: SearchRequestTrace; decision: SearchDecision }> = [];
    const candidates: CandidateSummary[] = [];
    const candidateKeys = new Set<string>();

    await this.recordLog('processing', '关键词优化完成', context, {
      searchQueryCount: keywordOptimization.serperSearchQueries?.length ?? 0,
      placesQueryCount: this.getPlacesQueries(keywordOptimization).length,
      targetLeadCount
    });

    let stopReason = '所有查询已完成';

    for (const initialRequest of queryQueue) {
      let currentRequest: SearchRequestTrace | null = initialRequest;
      let currentQuery = initialRequest.requestBody;

      while (currentRequest) {
        if (serperRequests.length >= maxRequests) {
          stopReason = '已达到 Serper 请求上限';
          currentRequest = null;
          break;
        }

        if (targetLeadCount && candidates.length >= targetLeadCount) {
          stopReason = '已达到目标线索数量';
          currentRequest = null;
          break;
        }

        const requestKey = toRequestKey(currentRequest);

        if (executedKeys.has(requestKey)) {
          currentRequest = null;
          break;
        }

        if (!this.isWithinPageLimit(currentRequest)) {
          currentRequest = null;
          break;
        }

        executedKeys.add(requestKey);
        serperRequests.push(currentRequest);
        const serperResult = await this.callSerper(serperConfig, currentRequest);

        this.addCandidates(serperResult, candidates, candidateKeys);
        await this.recordLog('processing', 'Serper 搜索完成', context, {
          endpoint: currentRequest.endpoint,
          q: currentRequest.requestBody.q,
          page: currentRequest.requestBody.page,
          collectedLeadCount: candidates.length
        });

        if (targetLeadCount && candidates.length >= targetLeadCount) {
          stopReason = '已达到目标线索数量';
          currentRequest = null;
          break;
        }

        const decision = await this.decideNextStep({
          keywordOptimization,
          currentQuery,
          currentRequest,
          serperResult,
          serperRequests,
          collectedLeadCount: candidates.length,
          context
        });
        decisions.push({ request: currentRequest, decision });

        await this.recordLog('processing', '搜索结果决策完成', context, {
          endpoint: currentRequest.endpoint,
          q: currentRequest.requestBody.q,
          page: currentRequest.requestBody.page,
          nextAction: decision.nextAction,
          pageQuality: decision.pageQuality
        });

        currentRequest = this.toNextRequest(decision, currentRequest);
        currentQuery = currentRequest?.requestBody ?? currentQuery;
      }

      if (stopReason !== '所有查询已完成') {
        break;
      }
    }

    await this.recordLog('success', 'AI 获客搜索编排完成', context, {
      serperRequestCount: serperRequests.length,
      decisionCount: decisions.length,
      candidateCount: candidates.length,
      stopReason
    });

    return {
      keywordOptimization,
      keywordOptimizationText: keywordOptimizationText.text,
      qualityWarnings,
      serperRequests,
      decisions,
      candidates,
      stopReason
    };
  }

  /** Generates a keyword plan and asks the model to repair it once if quality gates fail. */
  private async generateKeywordPlanWithRepair(requirement: string, context: AiLeadSearchContext) {
    const result = await this.aiGatewayService.generateText(
      {
        modelConfigKey: defaultAiModelConfigKey,
        promptKey: leadKeywordOptimizePromptKey,
        prompt: buildKeywordOptimizePrompt(requirement),
        maxOutputTokens: keywordOptimizeMaxOutputTokens
      },
      context
    );
    const keywordOptimization = parseJsonObject<OptimizedKeywordPlan>(result.text, '关键词优化结果');
    const issues = validateKeywordPlanLocalLanguages(requirement, keywordOptimization);

    if (issues.length === 0) {
      return { result, keywordOptimization, qualityWarnings: [] };
    }

    const repairResult = await this.aiGatewayService.generateText(
      {
        modelConfigKey: defaultAiModelConfigKey,
        promptKey: leadKeywordOptimizePromptKey,
        prompt: buildKeywordOptimizeRepairPrompt(requirement, issues, keywordOptimization),
        maxOutputTokens: keywordOptimizeMaxOutputTokens
      },
      context
    );
    const repairedKeywordOptimization = parseJsonObject<OptimizedKeywordPlan>(repairResult.text, '关键词优化修复结果');
    const qualityWarnings = validateKeywordPlanLocalLanguages(requirement, repairedKeywordOptimization);

    return { result: repairResult, keywordOptimization: repairedKeywordOptimization, qualityWarnings };
  }

  private toInitialRequests(keywordOptimization: OptimizedKeywordPlan): SearchRequestTrace[] {
    const searchQueries = sortQueries(keywordOptimization.serperSearchQueries ?? []);
    const placesQueries = sortQueries(this.getPlacesQueries(keywordOptimization));

    return [
      ...searchQueries.map(query => this.toRequest('search', query)),
      ...placesQueries.map(query => this.toRequest('places', query))
    ].filter((request): request is SearchRequestTrace => Boolean(request));
  }

  private getPlacesQueries(keywordOptimization: OptimizedKeywordPlan) {
    return keywordOptimization.serperPlacesQueries ?? keywordOptimization.serperMapsQueries ?? [];
  }

  private toRequest(endpoint: SerperEndpoint, query: SerperQuery): SearchRequestTrace | null {
    const requestBody = query.requestBody;
    const q = trimOptional(requestBody?.q || query.q);

    if (!q) {
      return null;
    }

    return {
      endpoint: this.toQueryEndpoint(endpoint, query.endpoint),
      requestBody: {
        q,
        gl: trimOptional(requestBody?.gl || query.gl),
        hl: trimOptional(requestBody?.hl || query.hl),
        location: trimOptional(requestBody?.location || query.location || query.city),
        num: readPositiveNumber(requestBody?.num) || 10,
        page: readPositiveNumber(requestBody?.page) || 1,
        ...readTbs(requestBody?.tbs || query.meta?.tbs)
      }
    };
  }

  private toQueryEndpoint(defaultEndpoint: SerperEndpoint, endpoint: SerperEndpoint | undefined) {
    return endpoint === 'search' || endpoint === 'places' ? endpoint : defaultEndpoint;
  }

  private callSerper(config: Awaited<ReturnType<AiGatewayService['getSerperConfig']>>, request: SearchRequestTrace) {
    return request.endpoint === 'places'
      ? this.serperClient.places(config, request.requestBody)
      : this.serperClient.search(config, request.requestBody);
  }

  private async decideNextStep(input: {
    keywordOptimization: OptimizedKeywordPlan;
    currentQuery: SerperRequestBody;
    currentRequest: SearchRequestTrace;
    serperResult: unknown;
    serperRequests: SearchRequestTrace[];
    collectedLeadCount: number;
    context: AiLeadSearchContext;
  }) {
    const result = await this.aiGatewayService.generateText(
      {
        modelConfigKey: defaultAiModelConfigKey,
        promptKey: leadSearchResultDecidePromptKey,
        prompt: JSON.stringify({
          resolvedProductKeywords: input.keywordOptimization.resolvedProductKeywords || '',
          resolvedTargetRegions: input.keywordOptimization.resolvedTargetRegions || '',
          resolvedTargetCustomerProfile: input.keywordOptimization.resolvedTargetCustomerProfile || '',
          resolvedTargetLeadCount: input.keywordOptimization.resolvedTargetLeadCount ?? null,
          currentQuery: input.currentQuery,
          endpoint: input.currentRequest.endpoint,
          currentPage: input.currentRequest.requestBody.page ?? 1,
          executedQueries: input.serperRequests,
          collectedLeadCount: input.collectedLeadCount,
          serperResult: input.serperResult
        }),
        maxOutputTokens: searchDecisionMaxOutputTokens
      },
      input.context
    );

    return parseJsonObject<SearchDecision>(result.text, '搜索结果决策');
  }

  private toNextRequest(decision: SearchDecision, currentRequest: SearchRequestTrace): SearchRequestTrace | null {
    if (!decision.nextAction || decision.nextAction === 'stop') {
      return null;
    }

    const nextRequest = decision.nextRequest;
    const endpoint = this.toNextEndpoint(decision.nextAction, nextRequest?.endpoint, currentRequest.endpoint);
    const requestBody = nextRequest?.requestBody;
    const q = requestBody?.q?.trim();

    if (!endpoint || !requestBody || !q) {
      return null;
    }

    return {
      endpoint,
      requestBody: {
        q,
        gl: trimOptional(requestBody.gl),
        hl: trimOptional(requestBody.hl),
        location: trimOptional(requestBody.location),
        num: requestBody.num || 10,
        page: requestBody.page || 1,
        ...(decision.tbs ? { tbs: decision.tbs } : {})
      }
    };
  }

  private toNextEndpoint(
    action: NonNullable<SearchDecision['nextAction']>,
    requestedEndpoint: SerperEndpoint | undefined,
    currentEndpoint: SerperEndpoint
  ): SerperEndpoint | null {
    if (action === 'switch_to_places') return 'places';
    if (action === 'switch_to_search') return 'search';
    if (action === 'paginate' || action === 'requery') return requestedEndpoint || currentEndpoint;

    return null;
  }

  private isWithinPageLimit(request: SearchRequestTrace) {
    const page = request.requestBody.page || 1;

    return request.endpoint === 'places' ? page <= maxPlacesPages : page <= maxSearchPages;
  }

  private addCandidates(result: unknown, candidates: CandidateSummary[], candidateKeys: Set<string>) {
    for (const candidate of extractCandidates(result)) {
      if (candidateKeys.has(candidate.dedupeKey)) {
        continue;
      }

      candidateKeys.add(candidate.dedupeKey);
      candidates.push(candidate);
    }
  }

  private recordLog(
    status: 'processing' | 'success',
    message: string,
    context: AiLeadSearchContext,
    metadata: Record<string, unknown>
  ) {
    return this.systemLogService.record({
      level: status === 'success' ? 'info' : 'info',
      status,
      module: 'ai-leads',
      action: 'search-orchestrate',
      message,
      userId: context.user?.userId,
      userName: context.user?.userName,
      metadata
    });
  }
}

function parseJsonObject<T>(text: string, label: string): T {
  try {
    const value = JSON.parse(text);

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('not-object');
    }

    return value as T;
  } catch {
    throw new BadGatewayException(`${label}不是合法 JSON`);
  }
}

function sortQueries(queries: SerperQuery[]) {
  return [...queries].sort(
    (left, right) => getPriorityWeight(getQueryPriority(left)) - getPriorityWeight(getQueryPriority(right))
  );
}

function getQueryPriority(query: SerperQuery) {
  return query.priority || query.meta?.priority;
}

function getPriorityWeight(priority?: string) {
  if (!priority) return 3;
  if (/^(高|high)$/i.test(priority)) return 0;
  if (/^(中|medium)$/i.test(priority)) return 1;
  if (/^(低|low)$/i.test(priority)) return 2;

  return 3;
}

function trimOptional(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readPositiveNumber(value: unknown) {
  return typeof value === 'number' && value > 0 ? value : undefined;
}

function readTbs(value: unknown) {
  const tbs = trimOptional(value);

  return tbs ? { tbs } : {};
}

function toRequestKey(request: SearchRequestTrace) {
  const body = request.requestBody;

  return [request.endpoint, body.q, body.gl || '', body.hl || '', body.location || '', body.page || 1].join('|');
}

function extractCandidates(result: unknown): CandidateSummary[] {
  if (!result || typeof result !== 'object') {
    return [];
  }

  const record = result as Record<string, unknown>;

  return [
    ...extractOrganicCandidates(record.organic),
    ...extractPlaceCandidates(record.places, 'place'),
    ...extractPlaceCandidates(record.localResults, 'local')
  ];
}

function extractOrganicCandidates(value: unknown): CandidateSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): CandidateSummary | null => {
      const record = item as Record<string, unknown>;
      const url = stringValue(record.link);
      const title = stringValue(record.title);
      const dedupeKey = getDomain(url) || title;

      if (!dedupeKey) {
        return null;
      }

      return {
        dedupeKey,
        sourceType: 'organic' as const,
        title,
        url,
        snippet: stringValue(record.snippet)
      };
    })
    .filter(isCandidateSummary);
}

function extractPlaceCandidates(value: unknown, sourceType: 'place' | 'local'): CandidateSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): CandidateSummary | null => {
      const record = item as Record<string, unknown>;
      const website = stringValue(record.website);
      const title = stringValue(record.title);
      const address = stringValue(record.address);
      const dedupeKey =
        getDomain(website) || stringValue(record.placeId) || stringValue(record.cid) || [title, address].join('|');

      if (!dedupeKey.trim()) {
        return null;
      }

      return {
        dedupeKey,
        sourceType,
        title,
        website,
        address,
        phoneNumber: stringValue(record.phoneNumber)
      };
    })
    .filter(isCandidateSummary);
}

function isCandidateSummary(value: CandidateSummary | null): value is CandidateSummary {
  return Boolean(value);
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function getDomain(url: string) {
  if (!url) {
    return '';
  }

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
