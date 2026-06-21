import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import type { HunterClient } from '../ai-gateway/hunter-client.service';
import { AiLeadHunterEnrichmentService } from './ai-lead-hunter-enrichment.service';

describe('AiLeadHunterEnrichmentService', () => {
  it('enriches CRM import inputs with the best Hunter personal email for each domain', async () => {
    const calls: string[] = [];
    const service = new AiLeadHunterEnrichmentService(
      {
        async getRequiredUserHunterConfig(user) {
          assert.equal(user.userId, 'u-1');

          return {
            configKey: 'default',
            title: 'Hunter',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: 'hunter-key',
            updatedAt: ''
          };
        }
      } as Pick<AiGatewayService, 'getRequiredUserHunterConfig'> as AiGatewayService,
      {
        async domainSearch(_config, request) {
          calls.push(request.domain);

          return {
            data: {
              emails: [
                {
                  value: 'info@example.com',
                  type: 'generic',
                  confidence: 99,
                  first_name: null,
                  last_name: null,
                  position: null
                },
                {
                  value: 'alice@example.com',
                  type: 'personal',
                  confidence: 82,
                  first_name: 'Alice',
                  last_name: 'Buyer',
                  position: 'Purchasing Manager'
                }
              ]
            }
          };
        }
      } as Pick<HunterClient, 'domainSearch'> as HunterClient
    );

    const result = await service.enrichCrmImportInputs([
      {
        name: 'Example Trading',
        websiteUrl: 'https://www.example.com/products',
        sourceTaskId: 'task-1',
        contact: null
      }
    ], createUser());

    assert.deepEqual(calls, ['example.com']);
    assert.equal(result.enrichedCount, 1);
    assert.equal(result.failedCount, 0);
    assert.deepEqual(result.inputs[0].contact, {
      fullName: 'Alice Buyer',
      title: 'Purchasing Manager',
      email: 'alice@example.com'
    });
  });

  it('keeps original inputs when Hunter fails for a domain', async () => {
    const service = new AiLeadHunterEnrichmentService(
      {
        async getRequiredUserHunterConfig() {
          return {
            configKey: 'default',
            title: 'Hunter',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: 'hunter-key',
            updatedAt: ''
          };
        }
      } as Pick<AiGatewayService, 'getRequiredUserHunterConfig'> as AiGatewayService,
      {
        async domainSearch() {
          throw new Error('Hunter timeout');
        }
      } as Pick<HunterClient, 'domainSearch'> as HunterClient
    );

    const result = await service.enrichCrmImportInputs([
      {
        name: 'Example Trading',
        websiteUrl: 'https://example.com',
        sourceTaskId: 'task-1',
        contact: null
      }
    ], createUser());

    assert.equal(result.enrichedCount, 0);
    assert.equal(result.failedCount, 1);
    assert.equal(result.firstErrorMessage, 'Hunter timeout');
    assert.equal(result.inputs[0].contact, null);
  });

  it('does not read Hunter config or call Domain Search when inputs have no website domain', async () => {
    const service = new AiLeadHunterEnrichmentService(
      {
        async getRequiredUserHunterConfig() {
          throw new Error('config should not be read');
        }
      } as Pick<AiGatewayService, 'getRequiredUserHunterConfig'> as AiGatewayService,
      {
        async domainSearch() {
          throw new Error('domain search should not be called');
        }
      } as Pick<HunterClient, 'domainSearch'> as HunterClient
    );

    const result = await service.enrichCrmImportInputs([
      {
        name: 'No Website Trading',
        websiteUrl: null,
        sourceTaskId: 'task-1',
        contact: null
      }
    ], createUser());

    assert.equal(result.attemptedCount, 0);
    assert.equal(result.enrichedCount, 0);
    assert.equal(result.failedCount, 0);
    assert.equal(result.inputs[0].contact, null);
  });

  it('only fills missing contact fields without overwriting existing name or title', async () => {
    const service = new AiLeadHunterEnrichmentService(
      {
        async getRequiredUserHunterConfig() {
          return {
            configKey: 'default',
            title: 'Hunter',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: 'hunter-key',
            updatedAt: ''
          };
        }
      } as Pick<AiGatewayService, 'getRequiredUserHunterConfig'> as AiGatewayService,
      {
        async domainSearch() {
          return {
            data: {
              emails: [
                {
                  value: 'alice@example.com',
                  type: 'personal',
                  confidence: 82,
                  first_name: 'Alice',
                  last_name: 'Buyer',
                  position: 'Purchasing Manager'
                }
              ]
            }
          };
        }
      } as Pick<HunterClient, 'domainSearch'> as HunterClient
    );

    const result = await service.enrichCrmImportInputs([
      {
        name: 'Example Trading',
        websiteUrl: 'https://example.com',
        sourceTaskId: 'task-1',
        contact: {
          fullName: 'Existing Contact',
          title: 'Owner',
          email: null
        }
      }
    ], createUser());

    assert.equal(result.enrichedCount, 1);
    assert.deepEqual(result.inputs[0].contact, {
      fullName: 'Existing Contact',
      title: 'Owner',
      email: 'alice@example.com'
    });
  });

  it('fills missing name and title without overwriting an existing email', async () => {
    const calls: string[] = [];
    const service = new AiLeadHunterEnrichmentService(
      {
        async getRequiredUserHunterConfig() {
          return {
            configKey: 'default',
            title: 'Hunter',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: 'hunter-key',
            updatedAt: ''
          };
        }
      } as Pick<AiGatewayService, 'getRequiredUserHunterConfig'> as AiGatewayService,
      {
        async domainSearch(_config, request) {
          calls.push(request.domain);

          return {
            data: {
              emails: [
                {
                  value: 'hunter@example.com',
                  type: 'personal',
                  confidence: 82,
                  first_name: 'Alice',
                  last_name: 'Buyer',
                  position: 'Purchasing Manager'
                }
              ]
            }
          };
        }
      } as Pick<HunterClient, 'domainSearch'> as HunterClient
    );

    const result = await service.enrichCrmImportInputs([
      {
        name: 'Example Trading',
        websiteUrl: 'https://example.com',
        sourceTaskId: 'task-1',
        contact: {
          fullName: null,
          title: null,
          email: 'existing@example.com'
        }
      }
    ], createUser());

    assert.deepEqual(calls, ['example.com']);
    assert.equal(result.enrichedCount, 1);
    assert.deepEqual(result.inputs[0].contact, {
      fullName: 'Alice Buyer',
      title: 'Purchasing Manager',
      email: 'existing@example.com'
    });
  });

  it('does not enrich with low-confidence personal contacts', async () => {
    const service = new AiLeadHunterEnrichmentService(
      {
        async getRequiredUserHunterConfig() {
          return {
            configKey: 'default',
            title: 'Hunter',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: 'hunter-key',
            updatedAt: ''
          };
        }
      } as Pick<AiGatewayService, 'getRequiredUserHunterConfig'> as AiGatewayService,
      {
        async domainSearch() {
          return {
            data: {
              emails: [
                {
                  value: 'alice@example.com',
                  type: 'personal',
                  confidence: 45,
                  first_name: 'Alice',
                  last_name: 'Buyer',
                  position: 'Purchasing Manager'
                }
              ]
            }
          };
        }
      } as Pick<HunterClient, 'domainSearch'> as HunterClient
    );

    const result = await service.enrichCrmImportInputs([
      {
        name: 'Example Trading',
        websiteUrl: 'https://example.com',
        sourceTaskId: 'task-1',
        contact: null
      }
    ], createUser());

    assert.equal(result.enrichedCount, 0);
    assert.equal(result.inputs[0].contact, null);
  });

  it('does not enrich with generic Hunter emails even when confidence is high', async () => {
    const service = new AiLeadHunterEnrichmentService(
      {
        async getRequiredUserHunterConfig() {
          return {
            configKey: 'default',
            title: 'Hunter',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: 'hunter-key',
            updatedAt: ''
          };
        }
      } as Pick<AiGatewayService, 'getRequiredUserHunterConfig'> as AiGatewayService,
      {
        async domainSearch() {
          return {
            data: {
              emails: [
                {
                  value: 'info@example.com',
                  type: 'generic',
                  confidence: 99,
                  first_name: null,
                  last_name: null,
                  position: null
                }
              ]
            }
          };
        }
      } as Pick<HunterClient, 'domainSearch'> as HunterClient
    );

    const result = await service.enrichCrmImportInputs([
      {
        name: 'Example Trading',
        websiteUrl: 'https://example.com',
        sourceTaskId: 'task-1',
        contact: null
      }
    ], createUser());

    assert.equal(result.enrichedCount, 0);
    assert.equal(result.inputs[0].contact, null);
  });
});

function createUser() {
  return {
    userId: 'u-1',
    userName: 'User',
    roles: ['R_USER'],
    organizationId: 'org-1',
    organizationRole: 'member' as const
  };
}
