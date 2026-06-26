export type LeadSearchProgressEventType =
  | 'workflow_started'
  | 'step_started'
  | 'step_progress'
  | 'step_completed'
  | 'workflow_completed'
  | 'workflow_failed';

export interface LeadSearchProgressMetric {
  key: string;
  label: string;
  value: number | string;
  total?: number;
}

export interface LeadSearchCandidateView {
  title?: string;
  website?: string;
  snippet?: string;
  country?: string;
  city?: string;
  address?: string;
  phoneNumber?: string;
  latitude?: number;
  longitude?: number;
  sourceType?: string;
  sourceLabel?: string;
  sourceUrl?: string;
  score?: number;
  reason?: string;
  websiteEvidence?: unknown;
  precisionAnalysis?: unknown;
  emailWritingContext?: unknown;
}

export interface LeadSearchSerperResultView {
  endpoint: string;
  requestBody: unknown;
  result: unknown;
}

export interface LeadSearchPublicResult {
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

export interface LeadSearchProgressEvent {
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

export type LeadSearchProgressEventInput = Omit<LeadSearchProgressEvent, 'runId' | 'sequence' | 'emittedAt'>;

export interface LeadSearchProgressReporter {
  emit(event: LeadSearchProgressEventInput): void | Promise<void>;
}

interface InternalSearchResult {
  qualityWarnings?: string[];
  serperRequests: unknown[];
  serperResults: LeadSearchSerperResultView[];
  decisions: unknown[];
  candidates: InternalCandidateSummary[];
  stopReason: string;
}

interface InternalCandidateSummary {
  sourceType?: string;
  title?: string;
  url?: string;
  snippet?: string;
  website?: string;
  address?: string;
  phoneNumber?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  city?: string;
  sourceUrl?: string;
  score?: number;
  reason?: string;
  websiteEvidence?: unknown;
  precisionAnalysis?: unknown;
  emailWritingContext?: unknown;
}

/** Adds run metadata and monotonic sequence numbers to business progress events. */
export function createLeadSearchProgressEmitter(
  runId: string,
  sink: (event: LeadSearchProgressEvent) => void | Promise<void>
): LeadSearchProgressReporter {
  let sequence = 0;

  return {
    emit(event) {
      sequence += 1;

      return sink({
        ...event,
        runId,
        sequence,
        emittedAt: new Date().toISOString()
      });
    }
  };
}

/** Serializes a progress event as one NDJSON line. */
export function serializeLeadSearchProgressEvent(event: LeadSearchProgressEvent) {
  return `${JSON.stringify(event)}\n`;
}

/** Projects internal search traces into an ordinary-user-safe result shape. */
export function toLeadSearchPublicResult(result: InternalSearchResult): LeadSearchPublicResult {
  return {
    summary: {
      actionCount: result.serperRequests.length,
      qualityCheckCount: result.decisions.length,
      candidateCount: result.candidates.length,
      stopReason: result.stopReason
    },
    candidates: result.candidates.map(toCandidateView),
    serperResults: [],
    warnings: result.qualityWarnings
  };
}

function toCandidateView(candidate: InternalCandidateSummary): LeadSearchCandidateView {
  return {
    title: candidate.title,
    website: candidate.website || candidate.url,
    snippet: candidate.snippet,
    country: candidate.country,
    city: candidate.city,
    address: candidate.address,
    phoneNumber: candidate.phoneNumber,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    sourceType: candidate.sourceType,
    sourceLabel: toSourceLabel(candidate.sourceType),
    sourceUrl: candidate.sourceUrl || candidate.url,
    score: candidate.score,
    reason: candidate.reason,
    websiteEvidence: candidate.websiteEvidence,
    precisionAnalysis: candidate.precisionAnalysis,
    emailWritingContext: candidate.emailWritingContext
  };
}

function toSourceLabel(sourceType?: string) {
  if (sourceType === 'place' || sourceType === 'local') {
    return '本地商家线索';
  }

  if (sourceType === 'organic') {
    return '公开线索';
  }

  if (sourceType === 'maps') {
    return '地图线索';
  }

  return undefined;
}
