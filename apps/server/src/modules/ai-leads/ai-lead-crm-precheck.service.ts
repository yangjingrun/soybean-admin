import { Inject, Injectable, Optional } from '@nestjs/common';
import type { RequestUserContext } from '../../shared/request-context';
import { CrmAccountService } from '../crm/accounts/crm-account.service';
import type { CrmAccountRecord } from '../crm/crm.types';
import { normalizeCrmDomain, normalizeCrmName } from '../crm/shared/crm-normalizers';
import type { AiLeadSearchCandidate } from './ai-lead-search-orchestrator.service';

const defaultLeadReactivationCooldownDays = 90;
const activeSkipStatuses = new Set([
  'customer',
  'blocked',
  'invalid',
  'sequence_running',
  'replied_pending',
  'followed_up',
  'opportunity'
]);
const cooldownStatuses = new Set(['archived', 'paused']);

export interface AiLeadCrmPrecheckSummary {
  rawCandidateCount: number;
  acceptedCandidateCount: number;
  existingSkippedCount: number;
  activeSkippedCount: number;
  cooldownSkippedCount: number;
  reactivatedCandidateCount: number;
  domainlessCandidateCount: number;
}

export interface AiLeadCrmPrecheckResult {
  acceptedCandidates: AiLeadSearchCandidate[];
  summary: AiLeadCrmPrecheckSummary;
}

@Injectable()
export class AiLeadCrmPrecheckService {
  constructor(@Optional() @Inject(CrmAccountService) private readonly crmAccountService?: CrmAccountService) {}

  /** Batch-check one Serper page against CRM and return candidates worth keeping in the auto flow. */
  async precheckCandidates(input: {
    candidates: AiLeadSearchCandidate[];
    context?: RequestUserContext | null;
    now?: Date;
  }): Promise<AiLeadCrmPrecheckResult> {
    const summary: AiLeadCrmPrecheckSummary = {
      rawCandidateCount: input.candidates.length,
      acceptedCandidateCount: 0,
      existingSkippedCount: 0,
      activeSkippedCount: 0,
      cooldownSkippedCount: 0,
      reactivatedCandidateCount: 0,
      domainlessCandidateCount: input.candidates.filter(candidate => !getCandidateDomain(candidate)).length
    };

    if (!this.crmAccountService || !input.context || input.candidates.length === 0) {
      summary.acceptedCandidateCount = input.candidates.length;

      return {
        acceptedCandidates: input.candidates,
        summary
      };
    }

    const identities = toCandidateIdentities(input.candidates);
    const matches = await this.crmAccountService.findLeadImportPrecheckMatches(
      {
        domains: identities.domains,
        normalizedNames: identities.normalizedNames
      },
      input.context
    );
    const matchIndex = buildMatchIndex(matches);
    const acceptedCandidates: AiLeadSearchCandidate[] = [];

    for (const candidate of input.candidates) {
      const domain = getCandidateDomain(candidate);
      const normalizedName = getCandidateNormalizedName(candidate);
      const match = (domain ? matchIndex.byDomain.get(domain) : null) ?? matchIndex.byName.get(normalizedName);

      if (!match) {
        acceptedCandidates.push(candidate);
        continue;
      }

      const decision = shouldAcceptExistingMatch(match, input.now ?? new Date());

      if (decision.accepted) {
        acceptedCandidates.push(candidate);
        summary.reactivatedCandidateCount += 1;
        continue;
      }

      if (decision.summaryKey) {
        summary[decision.summaryKey] += 1;
      }
    }

    summary.acceptedCandidateCount = acceptedCandidates.length;

    return {
      acceptedCandidates,
      summary
    };
  }
}

function toCandidateIdentities(candidates: AiLeadSearchCandidate[]) {
  const domains = new Set<string>();
  const normalizedNames = new Set<string>();

  for (const candidate of candidates) {
    const domain = getCandidateDomain(candidate);

    if (domain) {
      domains.add(domain);
      continue;
    }

    const normalizedName = getCandidateNormalizedName(candidate);

    if (normalizedName) {
      normalizedNames.add(normalizedName);
    }
  }

  return {
    domains: Array.from(domains),
    normalizedNames: Array.from(normalizedNames)
  };
}

function buildMatchIndex(matches: CrmAccountRecord[]) {
  const byDomain = new Map<string, CrmAccountRecord>();
  const byName = new Map<string, CrmAccountRecord>();

  for (const match of matches) {
    if (match.domain && !byDomain.has(match.domain)) {
      byDomain.set(match.domain, match);
    }

    if (match.normalizedName && !byName.has(match.normalizedName)) {
      byName.set(match.normalizedName, match);
    }
  }

  return { byDomain, byName };
}

function shouldAcceptExistingMatch(match: CrmAccountRecord, now: Date) {
  if (activeSkipStatuses.has(match.status)) {
    return {
      accepted: false,
      summaryKey: 'activeSkippedCount' as const
    };
  }

  if (cooldownStatuses.has(match.status)) {
    const referenceAt = match.archivedAt ?? match.updatedAt;

    if (!isPastCooldown(referenceAt, now)) {
      return {
        accepted: false,
        summaryKey: 'cooldownSkippedCount' as const
      };
    }

    return {
      accepted: true,
      summaryKey: null
    };
  }

  return {
    accepted: false,
    summaryKey: 'existingSkippedCount' as const
  };
}

function isPastCooldown(date: Date, now: Date) {
  return now.getTime() - date.getTime() > defaultLeadReactivationCooldownDays * 24 * 60 * 60 * 1000;
}

function getCandidateDomain(candidate: AiLeadSearchCandidate) {
  return normalizeCrmDomain(candidate.website ?? candidate.url);
}

function getCandidateNormalizedName(candidate: AiLeadSearchCandidate) {
  return candidate.title ? normalizeCrmName(candidate.title) : '';
}
