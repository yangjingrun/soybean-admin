import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import type { RequestUserContext } from '../../shared/request-context';
import { SystemUserController } from './system-user.controller';
import type { SystemUserService } from './system-user.service';

describe('SystemUserController', () => {
  it('allows super administrators to list users', async () => {
    const controller = new SystemUserController(createSystemUserService());

    const result = await controller.list(createContext(['R_SUPER']), {
      current: 1,
      size: 10,
      keyword: 'super'
    });

    assert.deepEqual(result, {
      code: '0000',
      msg: 'ok',
      data: {
        current: 1,
        size: 10,
        total: 1,
        records: [
          {
            id: '1',
            userName: 'Super',
            nickName: 'Super',
            phone: null,
            email: null,
            roles: ['R_SUPER'],
            status: 'enabled',
            companyName: null,
            expireAt: null,
            remark: null,
            lastLoginAt: null,
            lastLoginIp: null,
            lockedUntil: null,
            expired: false,
            locked: false,
            createdAt: '2026-06-18T01:00:00.000Z',
            updatedAt: '2026-06-18T01:00:00.000Z'
          }
        ]
      }
    });
  });

  it('rejects non-super administrators', async () => {
    const controller = new SystemUserController(createSystemUserService());

    await assert.rejects(() => controller.list(createContext(['R_ADMIN']), {}), ForbiddenException);
  });
});

function createSystemUserService(): SystemUserService {
  return {
    async list(params: { current?: number; size?: number; keyword?: string }) {
      const records = [
        {
          id: '1',
          userName: 'Super',
          nickName: 'Super',
          phone: null,
          email: null,
          roles: ['R_SUPER'],
          status: 'enabled',
          companyName: null,
          expireAt: null,
          remark: null,
          lastLoginAt: null,
          lastLoginIp: null,
          lockedUntil: null,
          expired: false,
          locked: false,
          createdAt: '2026-06-18T01:00:00.000Z',
          updatedAt: '2026-06-18T01:00:00.000Z'
        }
      ];

      return {
        current: params.current || 1,
        size: params.size || 10,
        total: records.length,
        records
      };
    }
  } as unknown as SystemUserService;
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
