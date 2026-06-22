import type { ImportCrmLeadInput } from '../crm/crm.types';
import { buildCandidateCountryPatch } from './ai-lead-candidate-country';

interface AiLeadCandidateLike {
  title?: unknown;
  website?: unknown;
  url?: unknown;
  snippet?: unknown;
  city?: unknown;
  address?: unknown;
  phoneNumber?: unknown;
  country?: unknown;
  sourceType?: unknown;
  score?: unknown;
  reason?: unknown;
  sourceUrl?: unknown;
}

/** Maps completed AI lead candidates to CRM import inputs. */
export function mapAiLeadTaskResultToCrmImportInputs(taskId: string, result: unknown): ImportCrmLeadInput[] {
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
        sourceTaskId: taskId,
        contact: null,
        sourceSnapshot: buildCandidateSourceSnapshot(candidate)
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

function buildCandidateSourceSnapshot(candidate: AiLeadCandidateLike) {
  const snapshot: Record<string, string | number> = {};
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

  return Object.keys(snapshot).length ? snapshot : null;
}
