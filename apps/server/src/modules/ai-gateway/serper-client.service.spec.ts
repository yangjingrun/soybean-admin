import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadGatewayException } from '@nestjs/common';
import { SerperClient } from './serper-client.service';

describe('SerperClient', () => {
  it('posts Search requests to the Serper search endpoint', async () => {
    const calls: unknown[] = [];
    const client = new SerperClient(async (url, init) => {
      calls.push({ url, init });

      return new Response(JSON.stringify({ organic: [{ title: 'Bearing supplier' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const result = await client.search(
      {
        configKey: 'default',
        title: 'Serper 搜索',
        apiBase: 'https://google.serper.dev/',
        apiKey: 'serper-key',
        updatedAt: ''
      },
      {
        q: 'bearing distributor Saudi Arabia',
        gl: 'sa',
        hl: 'en',
        location: 'Saudi Arabia',
        num: 10,
        page: 1
      }
    );

    assert.deepEqual(result, { organic: [{ title: 'Bearing supplier' }] });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      url: 'https://google.serper.dev/search',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': 'serper-key'
        },
        body: JSON.stringify({
          q: 'bearing distributor Saudi Arabia',
          gl: 'sa',
          hl: 'en',
          location: 'Saudi Arabia',
          num: 10,
          page: 1
        })
      }
    });
  });

  it('posts Places requests with optional tbs only when provided', async () => {
    const calls: unknown[] = [];
    const client = new SerperClient(async (url, init) => {
      calls.push({ url, init });

      return new Response(JSON.stringify({ places: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    await client.places(
      {
        configKey: 'default',
        title: 'Serper 搜索',
        apiBase: 'https://google.serper.dev',
        apiKey: 'serper-key',
        updatedAt: ''
      },
      {
        q: 'bearing supplier Riyadh',
        gl: 'sa',
        hl: 'en',
        location: 'Riyadh Saudi Arabia',
        num: 10,
        page: 1,
        tbs: 'qdr:y'
      }
    );

    assert.equal(calls.length, 1);
    assert.equal((calls[0] as { url: string }).url, 'https://google.serper.dev/places');
    assert.deepEqual(JSON.parse((calls[0] as { init: { body: string } }).init.body), {
      q: 'bearing supplier Riyadh',
      gl: 'sa',
      hl: 'en',
      location: 'Riyadh Saudi Arabia',
      num: 10,
      page: 1,
      tbs: 'qdr:y'
    });
  });

  it('posts Maps requests to the Serper maps endpoint with Maps-specific params', async () => {
    const calls: unknown[] = [];
    const client = new SerperClient(async (url, init) => {
      calls.push({ url, init });

      return new Response(JSON.stringify({ places: [{ title: 'Bearing Depot' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const result = await client.maps(
      {
        configKey: 'default',
        title: 'Serper 搜索',
        apiBase: 'https://google.serper.dev',
        apiKey: 'serper-key',
        updatedAt: ''
      },
      {
        q: 'bearing distributor',
        hl: 'en',
        ll: '@41.6469296,-73.2681778,8z',
        page: 1
      }
    );

    assert.deepEqual(result, { places: [{ title: 'Bearing Depot' }] });
    assert.equal(calls.length, 1);
    assert.equal((calls[0] as { url: string }).url, 'https://google.serper.dev/maps');
    assert.deepEqual(JSON.parse((calls[0] as { init: { body: string } }).init.body), {
      q: 'bearing distributor',
      hl: 'en',
      ll: '@41.6469296,-73.2681778,8z',
      page: 1
    });
  });

  it('translates fetch network errors into a Chinese message', async () => {
    const client = new SerperClient(async () => {
      throw new TypeError('fetch failed');
    });

    await assert.rejects(
      () =>
        client.search(
          {
            configKey: 'default',
            title: 'Serper 搜索',
            apiBase: 'https://google.serper.dev',
            apiKey: 'serper-key',
            updatedAt: ''
          },
          {
            q: 'bearing distributor Saudi Arabia',
            gl: 'sa',
            hl: 'en',
            num: 10,
            page: 1
          }
        ),
      (error: unknown) => {
        assert.ok(error instanceof BadGatewayException);
        assert.equal(error.message, 'Serper search 调用失败：网络异常');

        return true;
      }
    );
  });
});
