import { BadGatewayException, Inject, Injectable, Optional } from '@nestjs/common';
import { requireRequestUserContext, type RequestUserContext } from '../../shared/request-context';
import {
  defaultAiModelConfigKey,
  leadKeywordOptimizePromptKey,
  leadSearchResultDecidePromptKey
} from '../ai-gateway/ai-gateway.constants';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { SerperClient, type SerperEndpoint, type SerperRequestBody } from '../ai-gateway/serper-client.service';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import type { SearchOrchestrateDto } from './dto/search-orchestrate.dto';
import { AiLeadPrecisionAnalysisService } from './ai-lead-precision-analysis.service';
import {
  buildKeywordOptimizePrompt,
  buildKeywordOptimizeRepairPrompt,
  validateKeywordPlanLocalLanguages
} from './keyword-local-language-rules';
import type { LeadSearchProgressReporter } from './ai-lead-search-progress';
import { toLeadSearchPublicResult } from './ai-lead-search-progress';
import { AiLeadCrmPrecheckService, type AiLeadCrmPrecheckSummary } from './ai-lead-crm-precheck.service';
import { applySerperRequestCountry } from './ai-lead-candidate-country';
import { AiLeadWebsiteCrawlerService } from './ai-lead-website-crawler.service';
import type {
  AiLeadPrecisionAnalysis,
  AiLeadWebsiteEvidence,
  AiLeadWebsiteMatchProfile
} from './ai-lead-website-crawler.types';

const keywordOptimizeMaxOutputTokens = 3600;
const searchDecisionMaxOutputTokens = 1000;
const defaultMaxSearchRequests = 20;
const maxRepeatRounds = 2;
const maxSearchPages = 3;
const maxPlacesPages = 2;
const maxMapsPages = 2;
const candidatePoolMultiplier = 1.5;
const blockedLeadHostPatterns = [
  /(^|\.)taobao\.com$/i,
  /(^|\.)tmall\.com$/i,
  /(^|\.)1688\.com$/i,
  /(^|\.)alibaba\.com$/i,
  /(^|\.)made-in-china\.com$/i,
  /(^|\.)ruten\.com\.tw$/i,
  /(^|\.)bid\.yahoo\.com$/i,
  /(^|\.)shopee\.(?:com|tw|sg|my|ph|id|vn|th)$/i,
  /(^|\.)pchome\.com\.tw$/i,
  /(^|\.)momo\.com\.tw$/i,
  /(^|\.)yahoo\.com$/i,
  /(^|\.)ebay\./i,
  /(^|\.)amazon\./i
];
const blockedLeadTextPatterns = [
  /淘寶/i,
  /淘宝/i,
  /拍賣/i,
  /拍卖/i,
  /auction/i,
  /marketplace/i,
  /商城/i,
  /賣場/i,
  /卖场/i
];

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
  ll?: string;
  placeId?: string;
  cid?: string;
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
  nextAction?: 'paginate' | 'requery' | 'switch_to_places' | 'switch_to_search' | 'switch_to_maps' | 'stop';
  nextRequest?: {
    endpoint?: SerperEndpoint;
    requestBody?: SerperRequestBody;
  };
  tbs?: string | null;
  [key: string]: unknown;
}

export interface AiLeadSearchCandidate {
  dedupeKey: string;
  sourceType: 'organic' | 'place' | 'local' | 'maps';
  title?: string;
  url?: string;
  snippet?: string;
  website?: string;
  address?: string;
  phoneNumber?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  websiteEvidence?: AiLeadWebsiteEvidence;
  precisionAnalysis?: AiLeadPrecisionAnalysis;
  score?: number;
  reason?: string;
}

export interface LeadSearchQueryExecutionInput {
  request: SearchRequestTrace;
  requestKey: string;
  requestIndex: number;
}

export interface LeadSearchExecutionOptions {
  executeQuery?: (input: LeadSearchQueryExecutionInput, runDefault: () => Promise<unknown>) => Promise<unknown>;
  assertStillRunning?: () => Promise<void>;
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
    private readonly crmPrecheckService?: AiLeadCrmPrecheckService,
    @Optional()
    @Inject(AiLeadWebsiteCrawlerService)
    private readonly websiteCrawlerService?: AiLeadWebsiteCrawlerService,
    @Optional()
    @Inject(AiLeadPrecisionAnalysisService)
    private readonly precisionAnalysisService?: AiLeadPrecisionAnalysisService
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
    const serperConfig = await this.aiGatewayService.getRequiredUserSerperConfig(
      requireRequestUserContext(context.user ?? null)
    );

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

        const rawCandidates = applySerperRequestCountry(
          extractCandidates(serperResult, currentRequest.endpoint),
          currentRequest.requestBody
        );
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

    const enrichedCandidates = await this.enrichCandidatesWithWebsiteEvidence(
      candidates,
      requirement,
      keywordOptimization,
      context,
      reporter,
      options
    );

    await reporter?.emit({
      type: 'step_completed',
      stepKey: 'organize_candidates',
      title: '整理候选客户',
      description: `已整理 ${enrichedCandidates.length} 条候选线索`,
      progressPercent: 95,
      metrics: this.toProgressMetrics(serperRequests.length, maxRequests, enrichedCandidates.length, decisions.length)
    });

    await this.recordLog('success', 'AI 获客搜索编排完成', context, {
      serperRequestCount: serperRequests.length,
      decisionCount: decisions.length,
      candidateCount: enrichedCandidates.length,
      stopReason
    });

    const result = {
      keywordOptimization,
      keywordOptimizationText: dto.keywordOptimizationText ?? JSON.stringify(keywordOptimization),
      qualityWarnings: dto.qualityWarnings ?? [],
      serperRequests,
      serperResults,
      decisions,
      candidates: enrichedCandidates,
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

  private async enrichCandidatesWithWebsiteEvidence(
    candidates: AiLeadSearchCandidate[],
    requirement: string,
    keywordOptimization: OptimizedKeywordPlan,
    context: AiLeadSearchContext,
    reporter: LeadSearchProgressReporter | undefined,
    options: LeadSearchExecutionOptions
  ) {
    if (candidates.length === 0 || !this.websiteCrawlerService || !this.precisionAnalysisService) {
      return candidates;
    }

    await options.assertStillRunning?.();
    await reporter?.emit({
      type: 'step_started',
      stepKey: 'crawl_websites',
      title: '采集官网证据',
      description: `正在补充 ${candidates.length} 个客户的官网公开信息`,
      progressPercent: 90,
      metrics: this.toProgressMetrics(0, candidates.length, candidates.length, 0)
    });

    const websiteEnrichedCandidates = await this.websiteCrawlerService.enrichCandidates(candidates, {
      matchProfile: buildWebsiteMatchProfile(requirement, keywordOptimization)
    });

    await options.assertStillRunning?.();
    await reporter?.emit({
      type: 'step_completed',
      stepKey: 'crawl_websites',
      title: '采集官网证据',
      description: `已完成 ${websiteEnrichedCandidates.length} 个客户的官网证据补充`,
      progressPercent: 93,
      metrics: this.toProgressMetrics(websiteEnrichedCandidates.length, candidates.length, candidates.length, 0)
    });

    await reporter?.emit({
      type: 'step_started',
      stepKey: 'analyze_precision',
      title: '分析客户精准度',
      description: '正在结合 Serper 和官网证据判断客户匹配度',
      progressPercent: 94
    });

    const analyzedCandidates = await this.precisionAnalysisService.analyzeCandidates(
      {
        requirement,
        keywordPlan: keywordOptimization,
        candidates: websiteEnrichedCandidates
      },
      context
    );

    await options.assertStillRunning?.();
    await reporter?.emit({
      type: 'step_completed',
      stepKey: 'analyze_precision',
      title: '分析客户精准度',
      description: `已完成 ${analyzedCandidates.length} 个客户的精准度判断`,
      progressPercent: 95
    });

    return analyzedCandidates;
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
    const mapsQueries = sortQueries(keywordOptimization.serperMapsQueries ?? []);

    return [
      ...searchQueries.map(query => this.toRequest('search', query)),
      ...placesQueries.map(query => this.toRequest('places', query)),
      ...mapsQueries.map(query => this.toRequest('maps', query))
    ].filter((request): request is SearchRequestTrace => Boolean(request));
  }

  private getPlacesQueries(keywordOptimization: OptimizedKeywordPlan) {
    return keywordOptimization.serperPlacesQueries ?? [];
  }

  private toRequest(endpoint: SerperEndpoint, query: SerperQuery): SearchRequestTrace | null {
    const requestBody = query.requestBody;
    const q = trimOptional(requestBody?.q || query.q);

    if (!q) {
      return null;
    }

    const resolvedEndpoint = this.toQueryEndpoint(endpoint, query.endpoint);
    const resolvedRequestBody =
      resolvedEndpoint === 'maps'
        ? {
            q,
            hl: trimOptional(requestBody?.hl || query.hl),
            ll: trimOptional(requestBody?.ll),
            page: readPositiveNumber(requestBody?.page) || 1,
            placeId: trimOptional(requestBody?.placeId),
            cid: trimOptional(requestBody?.cid)
          }
        : {
            q,
            gl: trimOptional(requestBody?.gl || query.gl),
            hl: trimOptional(requestBody?.hl || query.hl),
            location: trimOptional(requestBody?.location || query.location || query.city),
            num: readPositiveNumber(requestBody?.num) || 10,
            page: readPositiveNumber(requestBody?.page) || 1,
            ...readTbs(requestBody?.tbs || query.meta?.tbs)
          };

    return {
      endpoint: resolvedEndpoint,
      requestBody: compactSerperRequestBody(resolvedRequestBody)
    };
  }

  private toQueryEndpoint(defaultEndpoint: SerperEndpoint, endpoint: SerperEndpoint | undefined) {
    return endpoint === 'search' || endpoint === 'places' || endpoint === 'maps' ? endpoint : defaultEndpoint;
  }

  private callSerper(
    config: Awaited<ReturnType<AiGatewayService['getRequiredUserSerperConfig']>>,
    request: SearchRequestTrace
  ) {
    if (request.endpoint === 'places') {
      return this.serperClient.places(config, request.requestBody);
    }

    if (request.endpoint === 'maps') {
      return this.serperClient.maps(config, request.requestBody);
    }

    return this.serperClient.search(config, request.requestBody);
  }

  private executeSerperRequest(
    config: Awaited<ReturnType<AiGatewayService['getRequiredUserSerperConfig']>>,
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

    if (endpoint === 'maps') {
      return {
        endpoint,
        requestBody: compactSerperRequestBody({
          q,
          hl: trimOptional(requestBody.hl),
          ll: trimOptional(requestBody.ll),
          placeId: trimOptional(requestBody.placeId),
          cid: trimOptional(requestBody.cid),
          page: requestBody.page || 1
        })
      };
    }

    return {
      endpoint,
      requestBody: compactSerperRequestBody({
        q,
        gl: trimOptional(requestBody.gl),
        hl: trimOptional(requestBody.hl),
        location: trimOptional(requestBody.location),
        num: requestBody.num || 10,
        page: requestBody.page || 1,
        ...(decision.tbs ? { tbs: decision.tbs } : {})
      })
    };
  }

  private toNextEndpoint(
    action: NonNullable<SearchDecision['nextAction']>,
    requestedEndpoint: SerperEndpoint | undefined,
    currentEndpoint: SerperEndpoint
  ): SerperEndpoint | null {
    if (action === 'switch_to_places') return 'places';
    if (action === 'switch_to_search') return 'search';
    if (action === 'switch_to_maps') return 'maps';
    if (action === 'paginate' || action === 'requery') return requestedEndpoint || currentEndpoint;

    return null;
  }

  private isWithinPageLimit(request: SearchRequestTrace) {
    const page = request.requestBody.page || 1;

    if (request.endpoint === 'places') {
      return page <= maxPlacesPages;
    }

    if (request.endpoint === 'maps') {
      return page <= maxMapsPages && (page <= 1 || Boolean(request.requestBody.ll));
    }

    return page <= maxSearchPages;
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

function buildWebsiteMatchProfile(requirement: string, keywordPlan: OptimizedKeywordPlan): AiLeadWebsiteMatchProfile {
  const positiveKeywords: string[] = [];
  const negativeKeywords: string[] = [];
  const productLineKeywords: string[] = [];

  collectKeywordPlanSignals(keywordPlan, positiveKeywords, negativeKeywords);
  collectProductLineSignals(keywordPlan, productLineKeywords);
  addMixedLanguageProductKeywords(positiveKeywords, requirement);
  addMixedLanguageProductKeywords(positiveKeywords, stringValue(keywordPlan.structuredRequirement));

  return {
    positiveKeywords: uniqueCrawlerKeywords(positiveKeywords, 48),
    negativeKeywords: uniqueCrawlerKeywords(negativeKeywords, 48),
    productLineKeywords: uniqueCrawlerKeywords(productLineKeywords, 24)
  };
}

function collectKeywordPlanSignals(value: unknown, positiveOutput: string[], negativeOutput: string[]) {
  if (Array.isArray(value)) {
    value.forEach(item => collectKeywordPlanSignals(item, positiveOutput, negativeOutput));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, childValue] of Object.entries(value)) {
    if (key === 'requestBody' || key === 'q') {
      continue;
    }

    if (isNegativeKeywordField(key)) {
      addDelimitedKeywords(negativeOutput, childValue);
      continue;
    }

    if (isPositiveKeywordField(key)) {
      addDelimitedKeywords(positiveOutput, childValue);
      continue;
    }

    collectKeywordPlanSignals(childValue, positiveOutput, negativeOutput);
  }
}

function collectProductLineSignals(keywordPlan: OptimizedKeywordPlan, output: string[]) {
  for (const key of ['productLine', 'productLineSnapshot', 'productLineInfo', 'selectedProductLine']) {
    const value = keywordPlan[key];

    if (value && typeof value === 'object') {
      collectKnownProductLineFields(value, output);
    }
  }
}

function collectKnownProductLineFields(value: unknown, output: string[]) {
  if (Array.isArray(value)) {
    value.forEach(item => collectKnownProductLineFields(item, output));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, childValue] of Object.entries(value)) {
    if (isProductLineKeywordField(key)) {
      addDelimitedKeywords(output, childValue);
      continue;
    }

    collectKnownProductLineFields(childValue, output);
  }
}

function isPositiveKeywordField(key: string) {
  return [
    'resolvedProductKeywords',
    'resolvedTargetCustomerProfile',
    'buyerType',
    'purchaseReason',
    'websiteSignals',
    'expectedPlaceTypes',
    'keep',
    'intent',
    'targetCustomerType',
    'positiveSignals',
    'matchKeywords'
  ].includes(key);
}

function isNegativeKeywordField(key: string) {
  return [
    'exclude',
    'excludeWords',
    'excludedKeywords',
    'negativeSignals',
    'negativeKeywords',
    'rejectSignals'
  ].includes(key);
}

function isProductLineKeywordField(key: string) {
  return [
    'name',
    'targetCustomerType',
    'coreSellingPoints',
    'commonModelsText',
    'certifications',
    'productKeywords',
    'applicationScenarios'
  ].includes(key);
}

function addDelimitedKeywords(output: string[], value: unknown) {
  if (typeof value !== 'string') {
    if (Array.isArray(value)) {
      value.forEach(item => addDelimitedKeywords(output, item));
    }

    return;
  }

  for (const item of value.split(/[,，;；、\n\r|/]+/)) {
    addCrawlerKeyword(output, item);
  }
}

function addMixedLanguageProductKeywords(output: string[], requirement: string) {
  const matches =
    requirement.match(/[A-Za-z0-9][A-Za-z0-9+./-]*(?:\s+[A-Za-z0-9+./-]+){0,3}\s*[\u4e00-\u9fff]{1,12}/g) ?? [];

  for (const match of matches) {
    addCrawlerKeyword(
      output,
      match.replace(/(?:进口商|经销商|分销商|批发商|供应商|制造商|生产商|代理商|采购商|厂家|工厂|买家|客户)$/u, '')
    );
  }
}

function addCrawlerKeyword(output: string[], value: string) {
  const keyword = normalizeCrawlerKeyword(value);

  if (keyword.length < 2 || keyword.length > 80) {
    return;
  }

  output.push(keyword);
}

function normalizeCrawlerKeyword(value: string) {
  return value
    .replace(/["'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:：,，;；、-]+|[\s:：,，;；、-]+$/g, '')
    .trim();
}

function uniqueCrawlerKeywords(values: string[], limit: number) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const key = value.toLowerCase();

    if (!value || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(value);

    if (output.length >= limit) {
      break;
    }
  }

  return output;
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

  if (request.endpoint === 'maps') {
    return [
      request.endpoint,
      body.q,
      body.hl || '',
      body.ll || '',
      body.placeId || '',
      body.cid || '',
      body.page || 1
    ].join('|');
  }

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

function compactSerperRequestBody(body: SerperRequestBody): SerperRequestBody {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ) as SerperRequestBody;
}

function extractCandidates(result: unknown, endpoint: SerperEndpoint): AiLeadSearchCandidate[] {
  if (!result || typeof result !== 'object') {
    return [];
  }

  const record = result as Record<string, unknown>;
  const placeSourceType = endpoint === 'maps' ? 'maps' : 'place';

  return [
    ...extractOrganicCandidates(record.organic),
    ...extractPlaceCandidates(record.places, placeSourceType),
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

      if (!dedupeKey || isBlockedLeadUrl(url, title)) {
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

function extractPlaceCandidates(value: unknown, sourceType: 'place' | 'local' | 'maps'): AiLeadSearchCandidate[] {
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
        phoneNumber: stringValue(record.phoneNumber),
        ...buildCoordinatePatch(record)
      };
    })
    .filter(isCandidateSummary);
}

/** Keeps provider map coordinates as normalized numeric candidate fields. */
function buildCoordinatePatch(record: Record<string, unknown>) {
  const latitude = numberValue(record.latitude);
  const longitude = numberValue(record.longitude);

  return {
    ...(latitude !== null ? { latitude } : {}),
    ...(longitude !== null ? { longitude } : {})
  };
}

function isCandidateSummary(value: AiLeadSearchCandidate | null): value is AiLeadSearchCandidate {
  return Boolean(value);
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

/** Filters out marketplace and consumer platform results that are not real B2B targets. */
function isBlockedLeadUrl(url: string, title: string) {
  const normalizedHost = getDomain(url).toLowerCase();

  return (
    blockedLeadHostPatterns.some(pattern => pattern.test(normalizedHost)) ||
    blockedLeadTextPatterns.some(pattern => pattern.test(title))
  );
}
