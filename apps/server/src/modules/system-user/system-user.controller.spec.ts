import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { SystemUserController } from './system-user.controller';

describe('SystemUserController', () => {
  it('allows super administrators to list users', async () => {
    const controller = new SystemUserController(createAuthService(['R_SUPER']));

    const result = await controller.list('Bearer token', {
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
            userId: '1',
            userName: 'Super',
            roles: ['R_SUPER'],
            buttons: ['B_CODE1'],
            status: 'enabled'
          }
        ]
      }
    });
  });

  it('rejects non-super administrators', async () => {
    const controller = new SystemUserController(createAuthService(['R_ADMIN']));

    await assert.rejects(() => controller.list('Bearer token', {}), ForbiddenException);
  });
});

function createAuthService(roles: string[]): AuthService {
  const users = [
    {
      userId: '1',
      userName: 'Super',
      roles: ['R_SUPER'],
      buttons: ['B_CODE1']
    },
    {
      userId: '2',
      userName: 'Admin',
      roles: ['R_ADMIN'],
      buttons: []
    }
  ];

  return {
    getUserByAccessToken() {
      return {
        userId: 'u-1',
        userName: 'tester',
        roles,
        buttons: []
      };
    },
    listUsers(params: { current?: number; size?: number; keyword?: string }) {
      const keyword = params.keyword?.trim().toLowerCase() || '';
      const records = keyword ? users.filter(user => user.userName.toLowerCase().includes(keyword)) : users;

      return {
        current: params.current || 1,
        size: params.size || 10,
        total: records.length,
        records: records.map(user => ({
          ...user,
          status: 'enabled'
        }))
      };
    }
  } as unknown as AuthService;
}
