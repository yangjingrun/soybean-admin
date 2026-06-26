import type { SerperRequestBody } from '../ai-gateway/serper-client.service';
import { normalizeCountryToMappedZhName } from '../../shared/country-name-map';

interface CandidateCountryLike {
  country?: unknown;
}

/** Attach the Serper request country to candidates before CRM import. */
export function applySerperRequestCountry<T extends CandidateCountryLike>(
  candidates: T[],
  requestBody: Pick<SerperRequestBody, 'gl' | 'location'>
): T[] {
  const country = resolveSerperRequestCountry(requestBody);

  if (!country) {
    return candidates;
  }

  return candidates.map(candidate => ({
    ...candidate,
    country
  }));
}

/** Resolve the candidate country from Serper request geography. */
export function resolveSerperRequestCountry(requestBody: Pick<SerperRequestBody, 'gl' | 'location'>) {
  const gl = requestBody.gl?.trim();

  if (gl && /^[a-z]{2}$/i.test(gl)) {
    return normalizeCountryToMappedZhName(gl);
  }

  return normalizeCountryToMappedZhName(requestBody.location);
}

/** Build an import patch only when the candidate already has country data. */
export function buildCandidateCountryPatch(candidate: CandidateCountryLike) {
  const country = typeof candidate.country === 'string' ? candidate.country.trim() : '';

  return country ? { country: normalizeCountryToMappedZhName(country) } : {};
}
