declare namespace Api {
  namespace AiLeads {
    type LeadSourceMode = 'search' | 'maps';

    interface KeywordOptimizePayload {
      requirement: string;
      leadSourceMode?: LeadSourceMode;
      productLineSnapshot?: ProductLineSnapshot | null;
      leadContext?: LeadContextSnapshot | null;
    }

    interface ProductLineSnapshot {
      id: string;
      name: string;
      targetCustomerType?: string | null;
      coreSellingPoints?: string | null;
      moq?: string | null;
      leadTime?: string | null;
      paymentTerms?: string | null;
      certifications?: string | null;
      catalogUrl?: string | null;
      websiteUrl?: string | null;
      commonModelsText?: string | null;
    }

    interface BuyerSegment {
      buyerType: string;
      purchaseReason: string;
      websiteSignals: string[];
      priorityContacts: string[];
      priorityLevel: string;
      preferredSerperChannel?: string;
    }

    interface LeadContextTargetRegion {
      value: string;
      label: string;
      countryCode?: string | null;
    }

    interface LeadContextOptionSnapshot {
      key: string;
      label: string;
      description?: string | null;
      promptHint?: string | null;
    }

    interface LeadContextSnapshot {
      targetRegion: LeadContextTargetRegion | null;
      targetCustomerTypes: LeadContextOptionSnapshot[];
      exclusionRules: LeadContextOptionSnapshot[];
      keywordText?: string | null;
      supplementalRequirement?: string | null;
      targetLeadCount?: number | null;
    }

    interface SerperQueryRequestBody {
      q: string;
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

    interface SerperMapsQuery {
      endpoint?: 'maps';
      requestBody?: Pick<SerperQueryRequestBody, 'q' | 'hl' | 'll' | 'page' | 'placeId' | 'cid'>;
      meta?: SerperQueryMeta;
      buyerType?: string;
      intent?: string;
      q?: string;
      hl?: string;
      ll?: string;
      city?: string;
      priority?: string;
      expectedPlaceTypes?: string[];
    }

    interface SearchExecutionRules {
      channelPriority?: Array<'search' | 'places' | 'maps'>;
      searchUsage?: string;
      placesUsage?: string;
      mapsUsage?: string;
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
      productLineSnapshot?: ProductLineSnapshot | null;
      leadContextSnapshot?: LeadContextSnapshot | null;
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
      productLineId: string;
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
      productLineId: string | null;
      productLineSnapshot: ProductLineSnapshot | null;
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

    type LeadWebsiteCrawlStatus = 'completed' | 'failed' | 'skipped';
    type LeadPrecisionPriority = 'high' | 'medium' | 'low' | 'reject';
    type LeadTargetMarketFit = 'target' | 'uncertain' | 'outside_target';

    interface LeadSearchWebsiteEvidence {
      crawlStatus: LeadWebsiteCrawlStatus;
      pageCount: number;
      finalUrl?: string;
      title?: string;
      description?: string;
      emails: string[];
      phones: string[];
      socialLinks: string[];
      whatsappLinks: string[];
      mapLinks: string[];
      contactLinks: string[];
      keywordHits: string[];
      evidenceSnippets: string[];
      companyAddressEvidence?: string[];
      companyCountrySignals?: string[];
      negativeKeywordHits?: string[];
      negativeEvidenceSnippets?: string[];
      failureReason: string | null;
    }

    interface LeadSearchPrecisionAnalysis {
      score: number;
      priority: LeadPrecisionPriority;
      buyerType: string;
      customerGroup?: string;
      companyCountry?: string;
      targetMarketFit?: LeadTargetMarketFit;
      reason: string;
      matchedSignals: string[];
      risks: string[];
      recommendedAction: string;
      reviewRequired: boolean;
    }

    interface LeadSearchCandidateView {
      title?: string;
      website?: string;
      snippet?: string;
      country?: string;
      city?: string;
      address?: string;
      phoneNumber?: string;
      sourceType?: string;
      sourceLabel?: string;
      sourceUrl?: string;
      score?: number;
      reason?: string;
      websiteEvidence?: LeadSearchWebsiteEvidence;
      precisionAnalysis?: LeadSearchPrecisionAnalysis;
    }

    interface LeadSearchSerperResultView {
      endpoint: string;
      requestBody: Record<string, unknown>;
      result: Record<string, unknown>;
    }

    interface LeadSearchPublicResult {
      summary: {
        actionCount?: number;
        qualityCheckCount?: number;
        candidateCount: number;
        stopReason?: string;
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
