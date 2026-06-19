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
        async getHunterConfig() {
          return {
            configKey: 'default',
            title: 'Hunter',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: 'hunter-key',
            updatedAt: ''
          };
        }
      } as Pick<AiGatewayService, 'getHunterConfig'> as AiGatewayService,
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
    ]);

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
        async getHunterConfig() {
          return {
            configKey: 'default',
            title: 'Hunter',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: 'hunter-key',
            updatedAt: ''
          };
        }
      } as Pick<AiGatewayService, 'getHunterConfig'> as AiGatewayService,
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
    ]);

    assert.equal(result.enrichedCount, 0);
    assert.equal(result.failedCount, 1);
    assert.equal(result.firstErrorMessage, 'Hunter timeout');
    assert.equal(result.inputs[0].contact, null);
  });

  it('does not read Hunter config or call Domain Search when inputs have no website domain', async () => {
    const service = new AiLeadHunterEnrichmentService(
      {
        async getHunterConfig() {
          throw new Error('config should not be read');
        }
      } as Pick<AiGatewayService, 'getHunterConfig'> as AiGatewayService,
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
    ]);

    assert.equal(result.attemptedCount, 0);
    assert.equal(result.enrichedCount, 0);
    assert.equal(result.failedCount, 0);
    assert.equal(result.inputs[0].contact, null);
  });

  it('only fills missing contact fields without overwriting existing name or title', async () => {
    const service = new AiLeadHunterEnrichmentService(
      {
        async getHunterConfig() {
          return {
            configKey: 'default',
            title: 'Hunter',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: 'hunter-key',
            updatedAt: ''
          };
        }
      } as Pick<AiGatewayService, 'getHunterConfig'> as AiGatewayService,
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
    ]);

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
        async getHunterConfig() {
          return {
            configKey: 'default',
            title: 'Hunter',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: 'hunter-key',
            updatedAt: ''
          };
        }
      } as Pick<AiGatewayService, 'getHunterConfig'> as AiGatewayService,
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
    ]);

    assert.deepEqual(calls, ['example.com']);
    assert.equal(result.enrichedCount, 1);
    assert.deepEqual(result.inputs[0].contact, {
      fullName: 'Alice Buyer',
      title: 'Purchasing Manager',
      email: 'existing@example.com'
    });
  });
});
