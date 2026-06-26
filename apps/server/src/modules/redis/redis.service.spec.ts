import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { RedisService } from './redis.service';

const originalRedisUrl = process.env.REDIS_URL;

describe('RedisService', () => {
  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it('preserves TLS intent when creating BullMQ options from rediss urls', async () => {
    process.env.REDIS_URL = 'rediss://default:secret@redis.example.com:6380/2';
    const service = new RedisService();

    const options = service.createBullMqConnectionOptions();

    assert.equal(options.host, 'redis.example.com');
    assert.equal(options.port, 6380);
    assert.equal(options.username, 'default');
    assert.equal(options.password, 'secret');
    assert.equal(options.db, 2);
    assert.deepEqual(options.tls, {});

    await service.onModuleDestroy();
  });
});
