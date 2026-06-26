import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import type { RequestUserContext } from '../../shared/request-context';
import { SystemLogController } from './system-log.controller';
import type { SystemLogService } from './system-log.service';

describe('SystemLogController', () => {
  it('allows super administrators to query logs', async () => {
    const controller = new SystemLogController(createSystemLogService());

    const result = await controller.list(createContext(['R_SUPER']), {});

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
    const controller = new SystemLogController(createSystemLogService());

    await assert.rejects(() => controller.users(createContext(['R_ADMIN'])), ForbiddenException);
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

function createContext(roles: string[]): RequestUserContext {
  return {
    userId: 'u-1',
    userName: 'tester',
    roles,
    organizationId: 'org-default',
    organizationRole: roles.includes('R_SUPER') ? 'admin' : 'member'
  };
}
