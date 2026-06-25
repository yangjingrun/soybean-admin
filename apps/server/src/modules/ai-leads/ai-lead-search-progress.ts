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
  address?: string;
  phoneNumber?: string;
  latitude?: number;
  longitude?: number;
  sourceLabel?: string;
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
      candidateCount: result.candidates.length
    },
    candidates: result.candidates.map(toCandidateView),
    serperResults: []
  };
}

function toCandidateView(candidate: InternalCandidateSummary): LeadSearchCandidateView {
  return {
    title: candidate.title,
    website: candidate.website || candidate.url,
    snippet: candidate.snippet,
    address: candidate.address,
    phoneNumber: candidate.phoneNumber,
    latitude: candidate.latitude,
    longitude: candidate.longitude
  };
}
