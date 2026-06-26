import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HealthController } from './health.controller';
import type { HealthReadinessResult } from './health.service';

describe('HealthController', () => {
  it('keeps the default health endpoint compatible with the liveness response', () => {
    const controller = new HealthController({
      getLiveness: () => ({
        status: 'up',
        service: 'AI外贸管理系统-nest-server',
        role: 'all',
        time: '2026-06-20T00:00:00.000Z'
      }),
      getReadiness: async () => createReadiness('up')
    } as never);

    assert.deepEqual(controller.getHealth(), {
      code: '0000',
      msg: 'ok',
      data: {
        status: 'up',
        service: 'AI外贸管理系统-nest-server',
        role: 'all',
        time: '2026-06-20T00:00:00.000Z'
      }
    });
  });

  it('returns ok readiness when dependencies are available', async () => {
    const controller = new HealthController({
      getLiveness: () => createReadiness('up'),
      getReadiness: async () => createReadiness('up')
    } as never);
    const response = createFastifyReply();

    const result = await controller.getReadiness(response as never);

    assert.equal(response.statusCode, undefined);
    assert.equal(result.code, '0000');
    assert.equal(result.data.status, 'up');
  });

  it('returns HTTP 503 envelope when readiness is down', async () => {
    const controller = new HealthController({
      getLiveness: () => createReadiness('up'),
      getReadiness: async () => createReadiness('down')
    } as never);
    const response = createFastifyReply();

    const result = await controller.getReadiness(response as never);

    assert.equal(response.statusCode, 503);
    assert.deepEqual(result, {
      code: '503',
      msg: 'Service unavailable',
      data: createReadiness('down')
    });
  });
});

function createReadiness(status: 'up' | 'down'): HealthReadinessResult {
  return {
    status,
    service: 'AI外贸管理系统-nest-server',
    role: 'all',
    time: '2026-06-20T00:00:00.000Z',
    dependencies: {
      database: { status },
      redis: { status: 'up' }
    }
  };
}

function createFastifyReply() {
  return {
    statusCode: undefined as number | undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    }
  };
}
