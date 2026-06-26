import assert from 'node:assert/strict';
import { BadGatewayException } from '@nestjs/common';
import { describe, it } from 'node:test';
import { HunterClient } from './hunter-client.service';

describe('HunterClient', () => {
  it('calls Hunter Domain Search with query params and the configured API key', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = new HunterClient(async (url, init) => {
      calls.push({ url, init });

      return new Response(
        JSON.stringify({
          data: {
            emails: [
              {
                value: 'alice@example.com',
                type: 'personal',
                confidence: 94,
                first_name: 'Alice',
                last_name: 'Buyer',
                position: 'Purchasing Manager'
              }
            ]
          }
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      );
    });

    const result = await client.domainSearch(
      {
        configKey: 'default',
        title: 'Hunter',
        apiBase: 'https://api.hunter.io/v2/',
        apiKey: 'hunter-key',
        updatedAt: ''
      },
      {
        domain: 'example.com',
        limit: 10,
        offset: 0
      }
    );

    assert.deepEqual(result, {
      data: {
        emails: [
          {
            value: 'alice@example.com',
            type: 'personal',
            confidence: 94,
            first_name: 'Alice',
            last_name: 'Buyer',
            position: 'Purchasing Manager'
          }
        ]
      }
    });
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      'https://api.hunter.io/v2/domain-search?domain=example.com&limit=10&offset=0&api_key=hunter-key'
    );
    assert.deepEqual(calls[0].init, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });
  });

  it('throws BadGatewayException when Hunter returns a non-2xx response', async () => {
    const client = new HunterClient(async () => new Response(JSON.stringify({ errors: [] }), { status: 429 }));

    await assert.rejects(
      () =>
        client.domainSearch(
          {
            configKey: 'default',
            title: 'Hunter',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: 'hunter-key',
            updatedAt: ''
          },
          {
            domain: 'example.com',
            limit: 10,
            offset: 0
          }
        ),
      BadGatewayException
    );
  });
});
