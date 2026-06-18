declare namespace Api {
  namespace AiLeads {
    interface KeywordOptimizePayload {
      requirement: string;
    }

    interface BuyerSegment {
      buyerType: string;
      purchaseReason: string;
      websiteSignals: string[];
      priorityContacts: string[];
      priorityLevel: string;
      preferredSerperChannel?: string;
    }

    interface SerperQueryRequestBody {
      q: string;
      gl?: string;
      hl?: string;
      location?: string;
      num?: number;
      page?: number;
      tbs?: string | null;
    }

    interface SerperQueryMeta {
      buyerType?: string;
      intent?: string;
      city?: string;
      priority?: string;
      dateRange?: string;
      tbs?: string | null;
      expectedPlaceTypes?: string[];
      reason?: string;
    }

    interface SerperSearchQuery {
      endpoint?: 'search';
      requestBody?: SerperQueryRequestBody;
      meta?: SerperQueryMeta;
      buyerType?: string;
      intent?: string;
      q?: string;
      location?: string;
      gl?: string;
      hl?: string;
      priority?: string;
    }

    interface SerperPlacesQuery {
      endpoint?: 'places';
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
      expectedPlaceTypes?: string[];
    }

    type SerperMapsQuery = SerperPlacesQuery;

    interface SearchExecutionRules {
      channelPriority?: Array<'search' | 'places'>;
      searchUsage?: string;
      placesUsage?: string;
      defaultDateRange?: string;
      tbsRules?: Record<string, string | null>;
      keep: string[];
      exclude: string[];
      websiteCheckPages: string[];
      dedupeKeys: string[];
    }

    interface OptimizedKeywordPlan {
      resolvedProductKeywords: string;
      resolvedTargetRegions: string;
      resolvedTargetCustomerProfile: string;
      resolvedTargetLeadCount: number | null;
      structuredRequirement: string;
      buyerSegments: BuyerSegment[];
      serperSearchQueries: SerperSearchQuery[];
      serperPlacesQueries?: SerperPlacesQuery[];
      serperMapsQueries?: SerperMapsQuery[];
      searchExecutionRules: SearchExecutionRules;
    }

    interface KeywordHistoryRecord {
      id: string;
      requirement: string;
      resultText: string;
      keywordPlan: OptimizedKeywordPlan;
      finishReason: string;
      usage: Api.AiGateway.AiUsage;
      createdAt: string;
      updatedAt: string;
    }

    interface KeywordOptimizeResult extends Api.AiGateway.AiTextResult {
      keywordPlan: OptimizedKeywordPlan;
      historyRecord: KeywordHistoryRecord;
      qualityWarnings?: string[];
    }

    interface KeywordHistoryListParams {
      size?: number;
    }

    interface KeywordHistoryListResult {
      records: KeywordHistoryRecord[];
    }

    interface UpdateKeywordHistoryPayload {
      requirement: string;
      keywordPlan: OptimizedKeywordPlan;
    }

    interface KeywordHistoryDeleteResult {
      id: string;
    }

    interface SearchOrchestratePayload {
      requirement: string;
      targetLeadCount: number;
      maxSearchRequests?: number;
    }

    interface SearchOrchestrateResult {
      keywordOptimization: OptimizedKeywordPlan;
      keywordOptimizationText: string;
      qualityWarnings?: string[];
      serperRequests: Array<Record<string, unknown>>;
      serperResults: LeadSearchSerperResultView[];
      decisions: Array<Record<string, unknown>>;
      candidates: Array<Record<string, unknown>>;
      stopReason: string;
    }

    type TaskStatus = 'queued' | 'running' | 'interrupted' | 'failed' | 'completed' | 'discarded';

    type OrganizationRole = import('@soybean/shared').OrganizationRole;

    interface CreateSearchTaskPayload {
      requirement: string;
      targetLeadCount: number;
      keywordPlan: OptimizedKeywordPlan;
    }

    interface TaskRecord {
      id: string;
      userId: string;
      userName: string | null;
      organizationId: string;
      organizationRole: OrganizationRole;
      requirement: string;
      targetLeadCount: number;
      keywordPlan: OptimizedKeywordPlan;
      status: TaskStatus;
      priority: number;
      runVersion: number;
      progressState: LeadSearchProgressEvent | null;
      result: SearchOrchestrateResult | LeadSearchPublicResult | null;
      errorMessage: string | null;
      bullJobId: string | null;
      readAt: string | null;
      notifiedAt: string | null;
      startedAt: string | null;
      finishedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }

    interface QueueConfig {
      configKey: string;
      workerConcurrency: number;
      priorityStrategy: 'fifo';
      updatedAt: string | null;
    }

    interface SaveQueueConfigPayload {
      workerConcurrency: number;
    }

    type LeadSearchProgressEventType =
      | 'workflow_started'
      | 'step_started'
      | 'step_progress'
      | 'step_completed'
      | 'workflow_completed'
      | 'workflow_failed';

    interface LeadSearchProgressMetric {
      key: string;
      label: string;
      value: number | string;
      total?: number;
    }

    interface LeadSearchCandidateView {
      title?: string;
      website?: string;
      snippet?: string;
      address?: string;
      phoneNumber?: string;
      sourceLabel: string;
    }

    interface LeadSearchSerperResultView {
      endpoint: string;
      requestBody: Record<string, unknown>;
      result: Record<string, unknown>;
    }

    interface LeadSearchPublicResult {
      summary: {
        actionCount: number;
        qualityCheckCount: number;
        candidateCount: number;
        stopReason: string;
      };
      candidates: LeadSearchCandidateView[];
      serperResults: LeadSearchSerperResultView[];
      warnings?: string[];
    }

    interface LeadSearchProgressEvent {
      type: LeadSearchProgressEventType;
      runId: string;
      sequence: number;
      emittedAt: string;
      stepKey?: string;
      parentKey?: string;
      title?: string;
      description?: string;
      progressPercent?: number;
      metrics?: LeadSearchProgressMetric[];
      result?: LeadSearchPublicResult;
      errorMessage?: string;
    }

    interface LeadSearchStreamHandlers {
      onEvent: (event: LeadSearchProgressEvent) => void;
      onError?: (error: unknown) => void;
      onComplete?: () => void;
    }
  }
}
