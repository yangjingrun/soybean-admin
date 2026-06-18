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
    }

    interface SerperSearchQuery {
      buyerType: string;
      intent: string;
      q: string;
      location: string;
      gl: string;
      hl: string;
      priority: string;
    }

    interface SerperMapsQuery {
      buyerType: string;
      intent: string;
      q: string;
      location: string;
      city: string;
      gl: string;
      hl: string;
      priority: string;
      expectedPlaceTypes: string[];
    }

    interface SearchExecutionRules {
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
      serperMapsQueries: SerperMapsQuery[];
      searchExecutionRules: SearchExecutionRules;
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
