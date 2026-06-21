import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import type { RequestUserContext } from '../../shared/request-context';
import { SystemRoleController } from './system-role.controller';
import type { SystemRoleService } from './system-role.service';

describe('SystemRoleController', () => {
  it('allows super administrators to list and update role permissions', async () => {
    const service = createSystemRoleService();
    const controller = new SystemRoleController(service);

    const listResult = await controller.list(createContext(['R_SUPER']), { current: 1, size: 10 });
    const updateResult = await controller.updatePermissions(createContext(['R_SUPER']), 'role-admin', {
      permissions: ['crm:settings:assets:write']
    });

    assert.equal(listResult.code, '0000');
    assert.equal(updateResult.code, '0000');
    assert.deepEqual(service.permissionUpdate, {
      id: 'role-admin',
      permissions: ['crm:settings:assets:write'],
      operatorUserId: 'u-1'
    });
  });

  it('rejects non-super administrators', async () => {
    const controller = new SystemRoleController(createSystemRoleService());

    await assert.rejects(() => controller.list(createContext(['R_ADMIN']), {}), ForbiddenException);
  });
});

function createSystemRoleService(): SystemRoleService & { permissionUpdate: unknown } {
  const state = {
    permissionUpdate: null as unknown
  };

  return {
    get permissionUpdate() {
      return state.permissionUpdate;
    },
    async list(params: { current?: number; size?: number }) {
      return {
        current: params.current || 1,
        size: params.size || 10,
        total: 1,
        records: [
          {
            id: 'role-admin',
            roleName: '管理员',
            roleCode: 'R_ADMIN',
            roleDesc: null,
            permissions: [],
            status: 'enabled',
            builtIn: true,
            createdAt: '2026-06-21T01:00:00.000Z',
            updatedAt: '2026-06-21T01:00:00.000Z'
          }
        ]
      };
    },
    async updatePermissions(id: string, permissions: string[], operator: RequestUserContext) {
      state.permissionUpdate = {
        id,
        permissions,
        operatorUserId: operator.userId
      };

      return {
        id,
        roleName: '管理员',
        roleCode: 'R_ADMIN',
        roleDesc: null,
        permissions,
        status: 'enabled',
        builtIn: true,
        createdAt: '2026-06-21T01:00:00.000Z',
        updatedAt: '2026-06-21T01:00:00.000Z'
      };
    }
  } as unknown as SystemRoleService & { permissionUpdate: unknown };
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
