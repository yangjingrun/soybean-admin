import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns liveness without checking dependencies', () => {
    const database = {
      $queryRaw: () => {
        throw new Error('database should not be checked');
      }
    };
    const redis = {
      getClient: () => ({
        ping: () => {
          throw new Error('redis should not be checked');
        }
      })
    };

    const service = new HealthService(database as never, redis as never, createConfigService('api') as never);
    const result = service.getLiveness();

    assert.equal(result.status, 'up');
    assert.equal(result.service, 'soybean-nest-server');
    assert.equal(result.role, 'api');
  });

  it('marks readiness up when database and redis pings pass', async () => {
    const service = new HealthService(
      { $queryRaw: () => Promise.resolve([{ '?column?': 1 }]) } as never,
      { getClient: () => ({ ping: () => Promise.resolve('PONG') }) } as never,
      createConfigService('worker') as never
    );

    const result = await service.getReadiness();

    assert.equal(result.status, 'up');
    assert.equal(result.role, 'worker');
    assert.deepEqual(result.dependencies, {
      database: { status: 'up' },
      redis: { status: 'up' }
    });
  });

  it('marks readiness down when a dependency ping fails', async () => {
    const service = new HealthService(
      { $queryRaw: () => Promise.reject(new Error('database unavailable')) } as never,
      { getClient: () => ({ ping: () => Promise.resolve('PONG') }) } as never
    );

    const result = await service.getReadiness();

    assert.equal(result.status, 'down');
    assert.equal(result.dependencies.database.status, 'down');
    assert.equal(result.dependencies.database.error, 'database unavailable');
    assert.equal(result.dependencies.redis.status, 'up');
  });
});

function createConfigService(role: string) {
  return {
    config: {
      serverRuntimeRole: role
    }
  };
}
