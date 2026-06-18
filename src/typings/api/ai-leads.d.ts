declare namespace Api {
  namespace AiLeads {
    interface KeywordOptimizePayload {
      requirement: string;
    }

    interface SearchOrchestratePayload {
      requirement: string;
      targetLeadCountOverride?: number;
      maxSearchRequests?: number;
    }

    interface SearchOrchestrateResult {
      keywordOptimization: Record<string, unknown>;
      keywordOptimizationText: string;
      serperRequests: Array<Record<string, unknown>>;
      decisions: Array<Record<string, unknown>>;
      candidates: Array<Record<string, unknown>>;
      stopReason: string;
    }
  }
}
