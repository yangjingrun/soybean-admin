import type { ImportCrmLeadInput } from '../crm/crm.types';

interface AiLeadCandidateLike {
  title?: unknown;
  website?: unknown;
  url?: unknown;
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
        sourceTaskId: taskId,
        contact: null
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
