import { BadGatewayException, Inject, Injectable, Optional } from '@nestjs/common';
import type { RequestUserContext } from '../../shared/request-context';
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
import type { LeadSearchProgressReporter } from './ai-lead-search-progress';
import { toLeadSearchPublicResult } from './ai-lead-search-progress';
import { AiLeadCrmPrecheckService, type AiLeadCrmPrecheckSummary } from './ai-lead-crm-precheck.service';

const keywordOptimizeMaxOutputTokens = 3600;
const searchDecisionMaxOutputTokens = 1000;
const defaultMaxSearchRequests = 20;
const maxRepeatRounds = 2;
const maxSearchPages = 3;
const maxPlacesPages = 2;
const candidatePoolMultiplier = 1.5;

export interface AiLeadSearchContext {
  user?: RequestUserContext | null;
}

export interface OptimizedKeywordPlan {
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

export interface SearchRequestTrace {
  endpoint: SerperEndpoint;
  requestBody: SerperRequestBody;
}

interface SerperResultTrace extends SearchRequestTrace {
  result: unknown;
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

export interface AiLeadSearchCandidate {
  dedupeKey: string;
  sourceType: 'organic' | 'place' | 'local';
  title?: string;
  url?: string;
  snippet?: string;
  website?: string;
  address?: string;
  phoneNumber?: string;
}

export interface LeadSearchQueryExecutionInput {
  request: SearchRequestTrace;
  requestKey: string;
  requestIndex: number;
}

export interface LeadSearchExecutionOptions {
  executeQuery?: (input: LeadSearchQueryExecutionInput, runDefault: () => Promise<unknown>) => Promise<unknown>;
}

export interface BoundKeywordSearchDto extends SearchOrchestrateDto {
  keywordPlan: OptimizedKeywordPlan;
  keywordOptimizationText?: string;
  qualityWarnings?: string[];
}

@Injectable()
export class AiLeadSearchOrchestrator {
  constructor(
    @Inject(AiGatewayService) private readonly aiGatewayService: AiGatewayService,
    @Inject(SerperClient) private readonly serperClient: SerperClient,
    @Inject(SystemLogService) private readonly systemLogService: SystemLogRecorder,
    @Optional()
    @Inject(AiLeadCrmPrecheckService)
    private readonly crmPrecheckService?: AiLeadCrmPrecheckService
  ) {}

  /** Runs keyword optimization, Serper search, and search-result decisions as one backend workflow. */
  async search(dto: SearchOrchestrateDto, context: AiLeadSearchContext = {}, reporter?: LeadSearchProgressReporter) {
    const requirement = dto.requirement.trim();

    await reporter?.emit({
      type: 'workflow_started',
      title: '开始搜索采集',
      description: '正在准备采集任务',
      progressPercent: 0
    });

    await reporter?.emit({
      type: 'step_started',
      stepKey: 'understand_requirement',
      title: '理解获客需求',
      description: '正在分析产品、市场和目标客户',
      progressPercent: 5
    });

    const {
      result: keywordOptimizationText,
      keywordOptimization,
      qualityWarnings
    } = await this.generateKeywordPlanWithRepair(requirement, context);

    return this.runSearchWithPlan(
      {
        ...dto,
        requirement,
        keywordPlan: keywordOptimization,
        keywordOptimizationText: keywordOptimizationText.text,
        qualityWarnings
      },
      context,
      reporter,
      {
        shouldCompleteRequirementStep: true
      }
    );
  }

  /** Runs search collection from a keyword plan that has already been saved on the task. */
  async searchWithKeywordPlan(
    dto: BoundKeywordSearchDto,
    context: AiLeadSearchContext = {},
    reporter?: LeadSearchProgressReporter,
    options: LeadSearchExecutionOptions = {}
  ) {
    await reporter?.emit({
      type: 'workflow_started',
      title: '开始搜索采集',
      description: '正在准备采集任务',
      progressPercent: 0
    });

    return this.runSearchWithPlan(dto, context, reporter, {
      ...options,
      shouldCompleteRequirementStep: false
    });
  }

  private async runSearchWithPlan(
    dto: BoundKeywordSearchDto,
    context: AiLeadSearchContext,
    reporter?: LeadSearchProgressReporter,
    options: LeadSearchExecutionOptions & { shouldCompleteRequirementStep: boolean } = {
      shouldCompleteRequirementStep: false
    }
  ) {
    const requirement = dto.requirement.trim();
    const maxRequests = dto.maxSearchRequests ?? defaultMaxSearchRequests;
    const targetLeadCount = dto.targetLeadCount;
    const candidatePoolTargetCount = toCandidatePoolTargetCount(targetLeadCount);
    const keywordOptimization = dto.keywordPlan;
    const queryQueue = this.toInitialRequests(keywordOptimization);
    const executedKeys = new Set<string>();
    const serperRequests: SearchRequestTrace[] = [];
    const serperResults: SerperResultTrace[] = [];
    const decisions: Array<{ request: SearchRequestTrace; decision: SearchDecision }> = [];
    const candidates: AiLeadSearchCandidate[] = [];
    const candidateKeys = new Set<string>();
    const serperConfig = await this.aiGatewayService.getSerperConfig(defaultSerperConfigKey);

    await this.recordLog('processing', 'AI 获客搜索编排开始', context, {
      requirement,
      maxRequests,
      targetLeadCount,
      candidatePoolTargetCount,
      maxRepeatRounds
    });

    await this.recordLog('processing', '关键词优化完成', context, {
      searchQueryCount: keywordOptimization.serperSearchQueries?.length ?? 0,
      placesQueryCount: this.getPlacesQueries(keywordOptimization).length,
      targetLeadCount,
      candidatePoolTargetCount
    });

    let stopReason = '所有查询已完成';

    if (options.shouldCompleteRequirementStep) {
      await reporter?.emit({
        type: 'step_completed',
        stepKey: 'understand_requirement',
        title: '理解获客需求',
        description: '已完成需求理解和采集方向规划',
        progressPercent: 20
      });
    }

    await reporter?.emit({
      type: 'step_started',
      stepKey: 'collect_public_leads',
      title: '采集公开线索',
      description: '正在按规划方向采集公开线索',
      progressPercent: 25,
      metrics: this.toProgressMetrics(serperRequests.length, maxRequests, candidates.length, decisions.length)
    });

    for (const initialRequest of queryQueue) {
      let currentRequest: SearchRequestTrace | null = initialRequest;
      let currentQuery = initialRequest.requestBody;
      let repeatedRounds = 0;

      while (currentRequest) {
        if (serperRequests.length >= maxRequests) {
          stopReason = '已达到 Serper 请求上限';
          currentRequest = null;
          break;
        }

        if (candidates.length >= candidatePoolTargetCount) {
          stopReason = '已达到候选池目标数量';
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
        const serperResult = await this.executeSerperRequest(
          serperConfig,
          currentRequest,
          requestKey,
          serperRequests.length,
          options
        );
        serperResults.push({
          endpoint: currentRequest.endpoint,
          requestBody: currentRequest.requestBody,
          result: serperResult
        });

        const rawCandidates = extractCandidates(serperResult);
        const precheckResult = await this.precheckCandidates(rawCandidates, context);

        this.addCandidates(precheckResult.acceptedCandidates, candidates, candidateKeys);
        await this.recordLog('processing', 'Serper 搜索完成', context, {
          endpoint: currentRequest.endpoint,
          q: currentRequest.requestBody.q,
          page: currentRequest.requestBody.page,
          num: currentRequest.requestBody.num,
          collectedLeadCount: candidates.length,
          crmPrecheckSummary: precheckResult.summary
        });
        await reporter?.emit({
          type: 'step_progress',
          stepKey: 'collect_public_leads',
          title: '采集公开线索',
          description: `已完成 ${serperRequests.length} 个采集动作，整理出 ${candidates.length} 条候选线索`,
          progressPercent: toProgressPercent(serperRequests.length, maxRequests),
          metrics: this.toProgressMetrics(serperRequests.length, maxRequests, candidates.length, decisions.length)
        });

        if (candidates.length >= candidatePoolTargetCount) {
          stopReason = '已达到候选池目标数量';
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
          crmPrecheckSummary: precheckResult.summary,
          targetLeadCount,
          maxRepeatRounds,
          context
        });
        decisions.push({ request: currentRequest, decision });
        await reporter?.emit({
          type: 'step_progress',
          stepKey: 'analyze_candidate_quality',
          title: '判断线索质量',
          description: `已完成 ${decisions.length} 次质量判断`,
          progressPercent: toProgressPercent(serperRequests.length, maxRequests),
          metrics: this.toProgressMetrics(serperRequests.length, maxRequests, candidates.length, decisions.length)
        });

        await this.recordLog('processing', '搜索结果决策完成', context, {
          endpoint: currentRequest.endpoint,
          q: currentRequest.requestBody.q,
          page: currentRequest.requestBody.page,
          num: currentRequest.requestBody.num,
          nextAction: decision.nextAction,
          pageQuality: decision.pageQuality
        });

        const nextRequest = this.toNextRequest(decision, currentRequest);

        if (!nextRequest || repeatedRounds >= maxRepeatRounds) {
          currentRequest = null;
          break;
        }

        // 同一个初始查询最多让 AI 继续两轮，避免低质结果反复重搜。
        repeatedRounds += 1;
        currentRequest = nextRequest;
        currentQuery = currentRequest?.requestBody ?? currentQuery;
      }

      if (stopReason !== '所有查询已完成') {
        break;
      }
    }

    await reporter?.emit({
      type: 'step_completed',
      stepKey: 'collect_public_leads',
      title: '采集公开线索',
      description: `已完成 ${serperRequests.length} 个采集动作`,
      progressPercent: 90,
      metrics: this.toProgressMetrics(serperRequests.length, maxRequests, candidates.length, decisions.length)
    });
    await reporter?.emit({
      type: 'step_completed',
      stepKey: 'organize_candidates',
      title: '整理候选客户',
      description: `已整理 ${candidates.length} 条候选线索`,
      progressPercent: 95,
      metrics: this.toProgressMetrics(serperRequests.length, maxRequests, candidates.length, decisions.length)
    });

    await this.recordLog('success', 'AI 获客搜索编排完成', context, {
      serperRequestCount: serperRequests.length,
      decisionCount: decisions.length,
      candidateCount: candidates.length,
      stopReason
    });

    const result = {
      keywordOptimization,
      keywordOptimizationText: dto.keywordOptimizationText ?? JSON.stringify(keywordOptimization),
      qualityWarnings: dto.qualityWarnings ?? [],
      serperRequests,
      serperResults,
      decisions,
      candidates,
      stopReason
    };

    const publicResult = toLeadSearchPublicResult(result);

    await reporter?.emit({
      type: 'workflow_completed',
      title: '搜索采集完成',
      description: publicResult.summary.stopReason,
      progressPercent: 100,
      result: publicResult
    });

    return result;
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

  private executeSerperRequest(
    config: Awaited<ReturnType<AiGatewayService['getSerperConfig']>>,
    request: SearchRequestTrace,
    requestKey: string,
    requestIndex: number,
    options: LeadSearchExecutionOptions
  ) {
    const runDefault = () => this.callSerper(config, request);

    return options.executeQuery
      ? options.executeQuery({ request, requestKey, requestIndex }, runDefault)
      : runDefault();
  }

  private async precheckCandidates(candidates: AiLeadSearchCandidate[], context: AiLeadSearchContext) {
    if (!this.crmPrecheckService) {
      return {
        acceptedCandidates: candidates,
        summary: {
          rawCandidateCount: candidates.length,
          acceptedCandidateCount: candidates.length,
          existingSkippedCount: 0,
          activeSkippedCount: 0,
          cooldownSkippedCount: 0,
          reactivatedCandidateCount: 0,
          domainlessCandidateCount: candidates.filter(candidate => !candidate.website && !candidate.url).length
        }
      };
    }

    return this.crmPrecheckService.precheckCandidates({
      candidates,
      context: context.user
    });
  }

  private async decideNextStep(input: {
    keywordOptimization: OptimizedKeywordPlan;
    currentQuery: SerperRequestBody;
    currentRequest: SearchRequestTrace;
    serperResult: unknown;
    serperRequests: SearchRequestTrace[];
    collectedLeadCount: number;
    crmPrecheckSummary: AiLeadCrmPrecheckSummary;
    targetLeadCount: number;
    maxRepeatRounds: number;
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
          resolvedTargetLeadCount: input.targetLeadCount,
          maxRepeatRounds: input.maxRepeatRounds,
          currentQuery: input.currentQuery,
          endpoint: input.currentRequest.endpoint,
          currentPage: input.currentRequest.requestBody.page ?? 1,
          executedQueries: input.serperRequests,
          collectedLeadCount: input.collectedLeadCount,
          crmPrecheckSummary: input.crmPrecheckSummary,
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

  private addCandidates(
    newCandidates: AiLeadSearchCandidate[],
    candidates: AiLeadSearchCandidate[],
    candidateKeys: Set<string>
  ) {
    for (const candidate of newCandidates) {
      if (candidateKeys.has(candidate.dedupeKey)) {
        continue;
      }

      candidateKeys.add(candidate.dedupeKey);
      candidates.push(candidate);
    }
  }

  private toProgressMetrics(
    actionCount: number,
    actionTotal: number,
    candidateCount: number,
    qualityCheckCount: number
  ) {
    return [
      { key: 'actionCount', label: '采集动作', value: actionCount, total: actionTotal },
      { key: 'candidateCount', label: '候选线索', value: candidateCount },
      { key: 'qualityCheckCount', label: '质量判断', value: qualityCheckCount }
    ];
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

function toCandidatePoolTargetCount(targetLeadCount: number) {
  return Math.ceil(targetLeadCount * candidatePoolMultiplier);
}

function toProgressPercent(done: number, total: number) {
  if (total <= 0) {
    return undefined;
  }

  return Math.min(89, 25 + Math.round((done / total) * 60));
}

function toRequestKey(request: SearchRequestTrace) {
  const body = request.requestBody;

  return [
    request.endpoint,
    body.q,
    body.gl || '',
    body.hl || '',
    body.location || '',
    body.num || 10,
    body.page || 1,
    body.tbs || ''
  ].join('|');
}

function extractCandidates(result: unknown): AiLeadSearchCandidate[] {
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

function extractOrganicCandidates(value: unknown): AiLeadSearchCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): AiLeadSearchCandidate | null => {
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

function extractPlaceCandidates(value: unknown, sourceType: 'place' | 'local'): AiLeadSearchCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): AiLeadSearchCandidate | null => {
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

function isCandidateSummary(value: AiLeadSearchCandidate | null): value is AiLeadSearchCandidate {
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
