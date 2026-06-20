import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { SystemLogController } from './system-log.controller';
import type { SystemLogService } from './system-log.service';

describe('SystemLogController', () => {
  it('allows super administrators to query logs', async () => {
    const controller = new SystemLogController(createSystemLogService(), createAuthService(['R_SUPER']));

    const result = await controller.list('Bearer token', null, {});

    assert.deepEqual(result, {
      code: '0000',
      msg: 'ok',
      data: {
        current: 1,
        size: 10,
        total: 0,
        records: []
      }
    });
  });

  it('rejects non-super administrators', async () => {
    const controller = new SystemLogController(createSystemLogService(), createAuthService(['R_ADMIN']));

    await assert.rejects(() => controller.users('Bearer token', null), ForbiddenException);
  });
});

function createSystemLogService(): SystemLogService {
  return {
    async list() {
      return {
        current: 1,
        size: 10,
        total: 0,
        records: []
      };
    },
    async listUsers() {
      return [];
    },
    async getById() {
      throw new Error('not used');
    }
  } as unknown as SystemLogService;
}

function createAuthService(roles: string[]): AuthService {
  return {
    getUserByAccessToken() {
      return {
        userId: 'u-1',
        userName: 'tester',
        roles,
        buttons: []
      };
    }
  } as unknown as AuthService;
}
