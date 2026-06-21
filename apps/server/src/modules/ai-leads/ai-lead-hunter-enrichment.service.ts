import { Inject, Injectable } from '@nestjs/common';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { HunterClient } from '../ai-gateway/hunter-client.service';
import type { ImportCrmLeadInput } from '../crm/crm.types';
import { selectBestHunterContact, type CrmHunterContact } from '../crm/shared/crm-hunter-contact-picker';
import { normalizeCrmDomain } from '../crm/shared/crm-normalizers';

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
    const domainCache = new Map<string, Promise<CrmHunterContact | null>>();
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

    return selectBestHunterContact(result);
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
function mergeMissingContactFields(existing: ImportCrmLeadInput['contact'], contact: CrmHunterContact) {
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

function normalizeWebsiteDomain(value: string | null | undefined) {
  return normalizeCrmDomain(value);
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
