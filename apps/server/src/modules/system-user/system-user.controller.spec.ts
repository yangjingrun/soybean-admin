import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { SystemUserController } from './system-user.controller';
import type { SystemUserService } from './system-user.service';

describe('SystemUserController', () => {
  it('allows super administrators to list users', async () => {
    const controller = new SystemUserController(createAuthService(['R_SUPER']), createSystemUserService());

    const result = await controller.list('Bearer token', null, {
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
    const controller = new SystemUserController(createAuthService(['R_ADMIN']), createSystemUserService());

    await assert.rejects(() => controller.list('Bearer token', null, {}), ForbiddenException);
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
