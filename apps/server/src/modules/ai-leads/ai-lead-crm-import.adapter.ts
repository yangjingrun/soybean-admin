import type { ImportCrmLeadInput } from '../crm/crm.types';
import { buildCandidateCountryPatch } from './ai-lead-candidate-country';
import type { AiLeadProductLineSnapshot } from './ai-lead-product-line-context';

interface AiLeadCandidateLike {
  title?: unknown;
  website?: unknown;
  url?: unknown;
  snippet?: unknown;
  city?: unknown;
  address?: unknown;
  phoneNumber?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  country?: unknown;
  sourceType?: unknown;
  score?: unknown;
  reason?: unknown;
  sourceUrl?: unknown;
  websiteEvidence?: unknown;
  precisionAnalysis?: unknown;
}

/** Maps completed AI lead candidates to CRM import inputs. */
export function mapAiLeadTaskResultToCrmImportInputs(
  task: { id: string; productLineSnapshot?: AiLeadProductLineSnapshot | null },
  result: unknown
): ImportCrmLeadInput[] {
  const candidates = readCandidates(result);

  return candidates.flatMap(candidate => {
    const name = normalizeString(candidate.title);

    if (!name) {
      return [];
    }

    return [
      {
        name,
        websiteUrl: normalizeString(candidate.website) || normalizeString(candidate.url),
        ...buildCandidateCountryPatch(candidate),
        ...buildCandidateLocationPatch(candidate),
        ...buildCandidateCoordinatePatch(candidate),
        sourceTaskId: task.id,
        contact: null,
        sourceSnapshot: buildCandidateSourceSnapshot(candidate, task.productLineSnapshot ?? null)
      }
    ];
  });
}

function readCandidates(result: unknown): AiLeadCandidateLike[] {
  if (!result || typeof result !== 'object' || !Array.isArray((result as { candidates?: unknown }).candidates)) {
    return [];
  }

  return (result as { candidates: unknown[] }).candidates.filter(isCandidateLike);
}

function isCandidateLike(value: unknown): value is AiLeadCandidateLike {
  return !!value && typeof value === 'object';
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Build a CRM location patch only from explicit candidate profile fields. */
function buildCandidateLocationPatch(candidate: AiLeadCandidateLike) {
  const city = normalizeString(candidate.city);
  const address = normalizeString(candidate.address);

  return {
    ...(city ? { city } : {}),
    ...(address ? { address } : {})
  };
}

/** Build normalized coordinate fields for CRM account persistence. */
function buildCandidateCoordinatePatch(candidate: AiLeadCandidateLike) {
  const latitude = normalizeNumber(candidate.latitude);
  const longitude = normalizeNumber(candidate.longitude);

  return {
    ...(latitude !== null ? { latitude } : {}),
    ...(longitude !== null ? { longitude } : {})
  };
}

function buildCandidateSourceSnapshot(candidate: AiLeadCandidateLike, productLineSnapshot: AiLeadProductLineSnapshot | null) {
  const snapshot: Record<string, unknown> = {};
  const stringFields = [
    'snippet',
    'city',
    'address',
    'phoneNumber',
    'country',
    'sourceType',
    'reason',
    'sourceUrl',
    'url',
    'website'
  ] as const;

  for (const field of stringFields) {
    const value = normalizeString(candidate[field]);
    if (value) snapshot[field] = value;
  }

  const score = normalizeNumber(candidate.score);
  if (score !== null) snapshot.score = score;

  const latitude = normalizeNumber(candidate.latitude);
  if (latitude !== null) snapshot.latitude = latitude;

  const longitude = normalizeNumber(candidate.longitude);
  if (longitude !== null) snapshot.longitude = longitude;

  for (const field of ['websiteEvidence', 'precisionAnalysis'] as const) {
    if (candidate[field] && typeof candidate[field] === 'object') {
      snapshot[field] = candidate[field];
    }
  }

  if (productLineSnapshot) {
    snapshot.productLine = productLineSnapshot;
  }

  return Object.keys(snapshot).length ? snapshot : null;
}
