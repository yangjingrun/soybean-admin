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
      targetLeadCountOverride?: number;
      maxSearchRequests?: number;
    }

    interface SearchOrchestrateResult {
      keywordOptimization: OptimizedKeywordPlan;
      keywordOptimizationText: string;
      serperRequests: Array<Record<string, unknown>>;
      decisions: Array<Record<string, unknown>>;
      candidates: Array<Record<string, unknown>>;
      stopReason: string;
    }
  }
}
