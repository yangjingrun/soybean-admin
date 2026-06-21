import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import type { RequestUserContext } from '../../shared/request-context';
import { SystemOrganizationController } from './system-organization.controller';
import type { SystemOrganizationService } from './system-organization.service';

describe('SystemOrganizationController', () => {
  it('allows super administrators to list and update organizations', async () => {
    const service = createSystemOrganizationService();
    const controller = new SystemOrganizationController(service);

    const listResult = await controller.list(createContext(['R_SUPER']), { current: 1, size: 10 });
    const statusResult = await controller.updateStatus(createContext(['R_SUPER']), 'org-1', { status: 'disabled' });

    assert.equal(listResult.code, '0000');
    assert.equal(statusResult.code, '0000');
    assert.deepEqual(service.statusUpdate, {
      id: 'org-1',
      status: 'disabled',
      operatorUserId: 'u-1'
    });
  });

  it('rejects non-super administrators', async () => {
    const controller = new SystemOrganizationController(createSystemOrganizationService());

    await assert.rejects(() => controller.list(createContext(['R_ADMIN']), {}), ForbiddenException);
  });
});

function createSystemOrganizationService(): SystemOrganizationService & { statusUpdate: unknown } {
  const state = {
    statusUpdate: null as unknown
  };

  return {
    get statusUpdate() {
      return state.statusUpdate;
    },
    async list(params: { current?: number; size?: number }) {
      return {
        current: params.current || 1,
        size: params.size || 10,
        total: 1,
        records: [createOrganization()]
      };
    },
    async updateStatus(id: string, status: string, operator: RequestUserContext) {
      state.statusUpdate = {
        id,
        status,
        operatorUserId: operator.userId
      };

      return { ...createOrganization(), id, status };
    }
  } as unknown as SystemOrganizationService & { statusUpdate: unknown };
}

function createOrganization() {
  return {
    id: 'org-1',
    name: '默认组织',
    status: 'enabled',
    userCount: 1,
    adminCount: 1,
    createdAt: '2026-06-21T01:00:00.000Z',
    updatedAt: '2026-06-21T01:00:00.000Z'
  };
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
