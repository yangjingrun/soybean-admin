const minimumAutoEnrichConfidence = 70;
const buyerRoleKeywords = [
  'buyer',
  'buying',
  'purchase',
  'purchasing',
  'procurement',
  'sourcing',
  'supply chain',
  'sales',
  'business development',
  'owner',
  'founder',
  'director',
  'manager',
  'ceo',
  'general manager'
];

interface HunterEmailCandidate {
  value?: unknown;
  email?: unknown;
  type?: unknown;
  confidence?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  position?: unknown;
}

export interface CrmHunterContact {
  fullName: string | null;
  title: string | null;
  email: string;
}

/** Select the best buyer-like personal email from a Hunter Domain Search response. */
export function selectBestHunterContact(result: unknown): CrmHunterContact | null {
  const best = readHunterEmails(result).filter(isAutoEnrichableHunterCandidate).sort(compareHunterEmailCandidates)[0];
  const email = normalizeString(best?.value) || normalizeString(best?.email);

  if (!email) {
    return null;
  }

  return {
    fullName: normalizeFullName(best),
    title: normalizeString(best?.position) || null,
    email
  };
}

function readHunterEmails(result: unknown): HunterEmailCandidate[] {
  const emails = (result as { data?: { emails?: unknown } } | null)?.data?.emails;

  return Array.isArray(emails) ? emails.filter(isHunterEmailCandidate) : [];
}

function isHunterEmailCandidate(value: unknown): value is HunterEmailCandidate {
  return !!value && typeof value === 'object';
}

function compareHunterEmailCandidates(left: HunterEmailCandidate, right: HunterEmailCandidate) {
  const leftPersonalScore = normalizeString(left.type) === 'personal' ? 1 : 0;
  const rightPersonalScore = normalizeString(right.type) === 'personal' ? 1 : 0;

  if (leftPersonalScore !== rightPersonalScore) {
    return rightPersonalScore - leftPersonalScore;
  }

  return normalizeNumber(right.confidence) - normalizeNumber(left.confidence);
}

function isAutoEnrichableHunterCandidate(candidate: HunterEmailCandidate) {
  const email = normalizeString(candidate.value) || normalizeString(candidate.email);
  const confidence = normalizeNumber(candidate.confidence);
  const title = normalizeString(candidate.position).toLowerCase();

  return (
    !!email &&
    normalizeString(candidate.type) === 'personal' &&
    confidence >= minimumAutoEnrichConfidence &&
    !!normalizeFullName(candidate) &&
    buyerRoleKeywords.some(keyword => title.includes(keyword))
  );
}

function normalizeFullName(candidate: HunterEmailCandidate | undefined) {
  const firstName = normalizeString(candidate?.first_name);
  const lastName = normalizeString(candidate?.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return fullName || null;
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
