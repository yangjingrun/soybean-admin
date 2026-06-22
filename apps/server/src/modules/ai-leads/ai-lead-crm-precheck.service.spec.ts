import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CrmAccountRecord } from '../crm/crm.types';
import { AiLeadCrmPrecheckService } from './ai-lead-crm-precheck.service';
import type { AiLeadSearchCandidate } from './ai-lead-search-orchestrator.service';

describe('AiLeadCrmPrecheckService', () => {
  it('keeps only CRM-new candidates from one Serper page with a single batch lookup', async () => {
    const existingAccounts = createAccounts(['customer-1', 'customer-2', 'customer-3', 'customer-4', 'customer-5']);
    const batchInputs: Array<{ domains: string[]; normalizedNames: string[] }> = [];
    const crmService = {
      async findLeadImportPrecheckMatches(input: { domains: string[]; normalizedNames: string[] }) {
        batchInputs.push(input);

        return existingAccounts;
      }
    };
    const service = new AiLeadCrmPrecheckService(crmService as never);
    const candidates = createCandidates(10);

    const result = await service.precheckCandidates({
      candidates,
      context: createUser(),
      now: new Date('2026-06-21T00:00:00Z')
    });

    assert.equal(batchInputs.length, 1);
    assert.deepEqual(
      batchInputs[0].domains,
      candidates.map(candidate => candidate.url!.replace('https://', ''))
    );
    assert.deepEqual(batchInputs[0].normalizedNames, []);
    assert.equal(result.acceptedCandidates.length, 5);
    assert.equal(result.summary.rawCandidateCount, 10);
    assert.equal(result.summary.existingSkippedCount, 5);
    assert.equal(result.summary.acceptedCandidateCount, 5);
  });

  it('checks domainless candidates by normalized name and skips active CRM records', async () => {
    const batchInputs: Array<{ domains: string[]; normalizedNames: string[] }> = [];
    const crmService = {
      async findLeadImportPrecheckMatches(input: { domains: string[]; normalizedNames: string[] }) {
        batchInputs.push(input);

        return [
          createAccount({
            id: 'existing-name',
            domain: null,
            normalizedName: 'abc trading',
            status: 'sequence_running'
          })
        ];
      }
    };
    const service = new AiLeadCrmPrecheckService(crmService as never);

    const result = await service.precheckCandidates({
      candidates: [
        {
          dedupeKey: 'name:abc-trading',
          sourceType: 'place',
          title: 'ABC Trading',
          address: 'Riyadh'
        },
        {
          dedupeKey: 'name:xyz-bearing',
          sourceType: 'place',
          title: 'XYZ Bearing',
          address: 'Jeddah'
        }
      ],
      context: createUser(),
      now: new Date('2026-06-21T00:00:00Z')
    });

    assert.equal(batchInputs.length, 1);
    assert.deepEqual(batchInputs[0].domains, []);
    assert.deepEqual(batchInputs[0].normalizedNames, ['abc trading', 'xyz bearing']);
    assert.deepEqual(
      result.acceptedCandidates.map(candidate => candidate.title),
      ['XYZ Bearing']
    );
    assert.equal(result.summary.activeSkippedCount, 1);
    assert.equal(result.summary.domainlessCandidateCount, 2);
  });

  it('allows archived or paused matches only after the cooldown window', async () => {
    const crmService = {
      async findLeadImportPrecheckMatches() {
        return [
          createAccount({
            id: 'archived-fresh',
            domain: 'fresh.example',
            normalizedName: 'fresh',
            status: 'archived',
            archivedAt: new Date('2026-05-21T00:00:00Z')
          }),
          createAccount({
            id: 'archived-old',
            domain: 'old.example',
            normalizedName: 'old',
            status: 'archived',
            archivedAt: new Date('2026-01-01T00:00:00Z')
          }),
          createAccount({
            id: 'paused-old',
            domain: 'paused.example',
            normalizedName: 'paused',
            status: 'paused',
            updatedAt: new Date('2026-01-01T00:00:00Z')
          })
        ];
      }
    };
    const service = new AiLeadCrmPrecheckService(crmService as never);

    const result = await service.precheckCandidates({
      candidates: [
        createCandidate('Fresh', 'https://fresh.example'),
        createCandidate('Old', 'https://old.example'),
        createCandidate('Paused', 'https://paused.example')
      ],
      context: createUser(),
      now: new Date('2026-06-21T00:00:00Z')
    });

    assert.deepEqual(
      result.acceptedCandidates.map(candidate => candidate.title),
      ['Old', 'Paused']
    );
    assert.equal(result.summary.cooldownSkippedCount, 1);
    assert.equal(result.summary.reactivatedCandidateCount, 2);
  });
});

function createCandidates(count: number): AiLeadSearchCandidate[] {
  return Array.from({ length: count }, (_, index) => {
    const name = `Customer ${index + 1}`;

    return createCandidate(name, `https://customer-${index + 1}`);
  });
}

function createCandidate(title: string, url: string): AiLeadSearchCandidate {
  return {
    dedupeKey: `domain:${url}`,
    sourceType: 'organic',
    title,
    url
  };
}

function createAccounts(domains: string[]) {
  return domains.map(domain =>
    createAccount({
      id: domain,
      domain,
      normalizedName: domain.replace('.example', ''),
      status: 'ready'
    })
  );
}

function createAccount(overrides: Partial<CrmAccountRecord>): CrmAccountRecord {
  return {
    id: 'account-1',
    organizationId: 'org-1',
    ownerUserId: 'u-1',
    name: 'ABC Trading',
    normalizedName: 'abc trading',
    websiteUrl: null,
    domain: 'abc.example',
    country: null,
    customerType: null,
    status: 'candidate',
    sourceTaskId: null,
    archivedAt: null,
    archiveReason: null,
    archiveSlimmedAt: null,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    updatedAt: new Date('2026-06-01T00:00:00Z'),
    ...overrides,
    city: overrides.city ?? null,
    address: overrides.address ?? null,
    timeZone: overrides.timeZone ?? null
  };
}

function createUser() {
  return {
    userId: 'u-1',
    userName: 'AI外贸管理系统',
    roles: [],
    organizationId: 'org-1',
    organizationRole: 'member' as const
  };
}
