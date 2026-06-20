import { Inject, Injectable } from '@nestjs/common';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { HunterClient } from '../ai-gateway/hunter-client.service';
import type { ImportCrmLeadInput } from '../crm/crm.types';

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

type HunterContact = {
  fullName: string | null;
  title: string | null;
  email: string;
};

export interface AiLeadHunterEnrichmentResult {
  inputs: ImportCrmLeadInput[];
  attemptedCount: number;
  enrichedCount: number;
  failedCount: number;
  firstErrorMessage: string | null;
}

@Injectable()
export class AiLeadHunterEnrichmentService {
  constructor(
    @Inject(AiGatewayService) private readonly aiGatewayService: Pick<AiGatewayService, 'getHunterConfig'>,
    @Inject(HunterClient) private readonly hunterClient: Pick<HunterClient, 'domainSearch'>
  ) {}

  /** Enriches CRM imports with one best-fit Hunter Domain Search contact per company domain. */
  async enrichCrmImportInputs(inputs: ImportCrmLeadInput[]): Promise<AiLeadHunterEnrichmentResult> {
    const targets = findHunterEnrichmentTargets(inputs);
    const domainCache = new Map<string, Promise<HunterContact | null>>();
    let attemptedCount = 0;
    let enrichedCount = 0;
    let failedCount = 0;
    let firstErrorMessage: string | null = null;

    if (targets.length === 0) {
      return {
        inputs,
        attemptedCount,
        enrichedCount,
        failedCount,
        firstErrorMessage
      };
    }

    const config = await this.aiGatewayService.getHunterConfig();

    for (const { input, domain } of targets) {
      attemptedCount += domainCache.has(domain) ? 0 : 1;

      if (!domainCache.has(domain)) {
        domainCache.set(
          domain,
          this.findBestContact(config, domain).catch(error => {
            failedCount += 1;
            firstErrorMessage ||= error instanceof Error ? error.message : String(error);

            return null;
          })
        );
      }

      const contact = await domainCache.get(domain);

      if (!contact) {
        continue;
      }

      const mergedContact = mergeMissingContactFields(input.contact, contact);

      if (!hasContactChanged(input.contact, mergedContact)) {
        continue;
      }

      input.contact = mergedContact;
      enrichedCount += 1;
    }

    return {
      inputs,
      attemptedCount,
      enrichedCount,
      failedCount,
      firstErrorMessage
    };
  }

  private async findBestContact(config: Awaited<ReturnType<AiGatewayService['getHunterConfig']>>, domain: string) {
    const result = await this.hunterClient.domainSearch(config, { domain, limit: 10, offset: 0 });
    const candidates = readHunterEmails(result).filter(isAutoEnrichableHunterCandidate);
    const best = candidates.sort(compareHunterEmailCandidates)[0];
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
}

/** Finds inputs that can be enriched by Hunter Domain Search. */
function findHunterEnrichmentTargets(inputs: ImportCrmLeadInput[]) {
  return inputs.flatMap(input => {
    if (!hasMissingContactFields(input.contact)) {
      return [];
    }

    const domain = normalizeWebsiteDomain(input.websiteUrl);

    if (!domain) {
      return [];
    }

    return [{ input, domain }];
  });
}

function hasMissingContactFields(contact: ImportCrmLeadInput['contact']) {
  return !normalizeString(contact?.fullName) || !normalizeString(contact?.title) || !normalizeString(contact?.email);
}

/** Merges Hunter contact data without overwriting CRM fields that already exist. */
function mergeMissingContactFields(existing: ImportCrmLeadInput['contact'], contact: HunterContact) {
  return {
    fullName: normalizeString(existing?.fullName) || contact.fullName,
    title: normalizeString(existing?.title) || contact.title,
    email: normalizeString(existing?.email) || contact.email
  };
}

function hasContactChanged(
  existing: ImportCrmLeadInput['contact'],
  merged: NonNullable<ImportCrmLeadInput['contact']>
) {
  return (
    normalizeString(existing?.fullName) !== normalizeString(merged.fullName) ||
    normalizeString(existing?.title) !== normalizeString(merged.title) ||
    normalizeString(existing?.email) !== normalizeString(merged.email)
  );
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

function normalizeWebsiteDomain(value: string | null | undefined) {
  const rawValue = normalizeString(value);

  if (!rawValue) {
    return null;
  }

  try {
    const url = new URL(rawValue.includes('://') ? rawValue : `https://${rawValue}`);

    return url.hostname.replace(/^www\./i, '').toLowerCase() || null;
  } catch {
    return null;
  }
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
