import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import type { CrmUserContext, ImportCrmLeadInput } from './crm.types';

describe('CrmController', () => {
  it('lists accounts with the current organization context', async () => {
    const calls: CrmUserContext[] = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async listAccounts(context) {
          calls.push(context);

          return {
            current: 1,
            size: 20,
            total: 0,
            records: []
          };
        }
      })
    );

    const result = await controller.listAccounts('Bearer token', { current: 1, size: 20 });

    assert.equal(result.code, '0000');
    assert.deepEqual(calls[0], {
      userId: 'user-1',
      userName: 'Alice',
      roles: ['R_USER'],
      organizationId: 'org-1',
      organizationRole: 'member'
    });
  });

  it('imports one lead account for the current user', async () => {
    const calls: Array<{ input: ImportCrmLeadInput; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async importAccountFromLead(input, context) {
          calls.push({ input, context });

          return {
            account: {
              id: 'account-1',
              organizationId: context.organizationId,
              ownerUserId: context.userId,
              name: input.name,
              normalizedName: 'abc trading',
              websiteUrl: input.websiteUrl ?? null,
              domain: 'abc.example',
              country: input.country ?? null,
              customerType: input.customerType ?? null,
              status: 'missing_contact',
              sourceTaskId: input.sourceTaskId ?? null,
              createdAt: new Date('2026-06-18T09:00:00.000Z'),
              updatedAt: new Date('2026-06-18T09:00:00.000Z')
            },
            contact: null
          };
        }
      })
    );

    const result = await controller.importLead('Bearer token', {
      name: 'ABC Trading',
      websiteUrl: 'https://abc.example',
      country: 'AE',
      customerType: 'distributor',
      sourceTaskId: 'task-1'
    });

    assert.equal(result.code, '0000');
    assert.equal(calls[0].input.name, 'ABC Trading');
    assert.equal(calls[0].input.sourceTaskId, null);
    assert.equal(calls[0].context.organizationId, 'org-1');
  });

  it('rejects anonymous users', async () => {
    const controller = new CrmController(createAuthService(null), createCrmService());

    await assert.rejects(() => controller.listAccounts('', {}), UnauthorizedException);
  });
});

function createAuthService(user: ReturnType<typeof createUser> | null = createUser()): AuthService {
  return {
    getUserByAccessToken() {
      return user;
    }
  } as unknown as AuthService;
}

function createUser() {
  return {
    userId: 'user-1',
    userName: 'Alice',
    roles: ['R_USER'],
    buttons: [],
    organizationId: 'org-1',
    organizationName: 'Org One',
    organizationRole: 'member' as const
  };
}

function createCrmService(partial: Partial<CrmService> = {}): CrmService {
  return {
    async listAccounts() {
      return {
        current: 1,
        size: 20,
        total: 0,
        records: []
      };
    },
    async importAccountFromLead() {
      return {
        account: null,
        contact: null
      };
    },
    ...partial
  } as unknown as CrmService;
}
