import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import type { CrmUserContext, ImportCrmLeadInput } from './crm.types';

type CrmAccountView = Awaited<ReturnType<CrmService['listAccounts']>>['records'][number];
type CrmTimelineEventView = Awaited<ReturnType<CrmService['addAccountNote']>>['event'];
type CrmEmailVerificationView = Awaited<ReturnType<CrmService['verifyContactEmail']>>;

describe('CrmController', () => {
  it('lists accounts with the current organization context', async () => {
    const calls: Array<{ context: CrmUserContext; query: unknown }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async listAccounts(context, query) {
          calls.push({ context, query });

          return {
            current: 1,
            size: 20,
            total: 0,
            records: []
          };
        }
      })
    );

    const query = { current: 1, size: 20, keyword: 'abc', status: 'ready' as const };
    const result = await controller.listAccounts('Bearer token', query);

    assert.equal(result.code, '0000');
    assert.deepEqual(calls[0].context, {
      userId: 'user-1',
      userName: 'Alice',
      roles: ['R_USER'],
      organizationId: 'org-1',
      organizationRole: 'member'
    });
    assert.equal(calls[0].query, query);
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

  it('gets account detail with the current user context', async () => {
    const calls: Array<{ id: string; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async getAccountDetail(id, context) {
          calls.push({ id, context });

          return {
            account: createAccountView({ id }),
            contacts: [],
            timelineEvents: []
          };
        }
      })
    );

    const result = await controller.getAccountDetail('Bearer token', 'account-1');

    assert.equal(result.code, '0000');
    assert.equal(calls[0].id, 'account-1');
    assert.equal(calls[0].context.userId, 'user-1');
  });

  it('changes account status with the current user context', async () => {
    const calls: Array<{ id: string; dto: unknown; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async updateAccountStatus(id, dto, context) {
          calls.push({ id, dto, context });

          return {
            account: createAccountView({ id, status: dto.status }),
            event: createTimelineEventView({ accountId: id, eventType: 'status_changed' })
          };
        }
      })
    );

    const dto = { status: 'ready' as const, remark: 'verified' };
    const result = await controller.updateAccountStatus('Bearer token', 'account-1', dto);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].id, 'account-1');
    assert.equal(calls[0].dto, dto);
    assert.equal(calls[0].context.organizationId, 'org-1');
  });

  it('adds account notes with the current user context', async () => {
    const calls: Array<{ id: string; dto: unknown; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async addAccountNote(id, dto, context) {
          calls.push({ id, dto, context });

          return { event: createTimelineEventView({ id: 'event-1', accountId: id, content: dto.content }) };
        }
      })
    );

    const dto = { content: 'Call next week.' };
    const result = await controller.addAccountNote('Bearer token', 'account-1', dto);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].id, 'account-1');
    assert.equal(calls[0].dto, dto);
    assert.equal(calls[0].context.userId, 'user-1');
  });

  it('archives accounts with the current user context', async () => {
    const calls: Array<{ id: string; dto: unknown; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async archiveAccount(id, dto, context) {
          calls.push({ id, dto, context });

          return {
            account: createAccountView({ id, status: 'archived' }),
            event: createTimelineEventView({ accountId: id, eventType: 'account_archived' })
          };
        }
      })
    );

    const dto = { reason: 'Not a fit' };
    const result = await controller.archiveAccount('Bearer token', 'account-1', dto);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].id, 'account-1');
    assert.equal(calls[0].dto, dto);
    assert.equal(calls[0].context.organizationId, 'org-1');
  });

  it('verifies contact email with the current user context', async () => {
    const calls: Array<{ id: string; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async verifyContactEmail(id, context) {
          calls.push({ id, context });

          return createEmailVerificationView({ contactId: id });
        }
      })
    );

    const result = await controller.verifyContactEmail('Bearer token', 'contact-1');

    assert.equal(result.code, '0000');
    assert.equal(calls[0].id, 'contact-1');
    assert.equal(calls[0].context.userId, 'user-1');
    assert.equal(result.data.contact.id, 'contact-1');
    assert.equal(result.data.event.eventType, 'email_verified');
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

function createAccountView(overrides: Partial<CrmAccountView> = {}) {
  return {
    id: 'account-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    name: 'ABC Trading',
    normalizedName: 'abc trading',
    websiteUrl: 'https://abc.example',
    domain: 'abc.example',
    country: 'AE',
    customerType: 'distributor',
    status: 'candidate' as const,
    sourceTaskId: null,
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T09:00:00.000Z',
    ...overrides
  };
}

function createTimelineEventView(overrides: Partial<CrmTimelineEventView> = {}) {
  return {
    id: 'event-1',
    organizationId: 'org-1',
    accountId: 'account-1',
    contactId: null,
    ownerUserId: 'user-1',
    eventType: 'note_added',
    title: '新增备注',
    content: null,
    metadata: null,
    createdAt: '2026-06-18T09:00:00.000Z',
    ...overrides
  };
}

function createContactView(overrides: Partial<CrmEmailVerificationView['contact']> = {}) {
  return {
    id: 'contact-1',
    organizationId: 'org-1',
    accountId: 'account-1',
    ownerUserId: 'user-1',
    fullName: 'Ali Hassan',
    title: 'Buyer',
    email: 'ali@example.com',
    emailHash: 'hash-1',
    maskedEmail: 'a***@example.com',
    isPublicEmail: false,
    emailStatus: 'valid' as const,
    sourceTaskId: null,
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T10:00:00.000Z',
    ...overrides
  };
}

function createEmailVerificationView(overrides: { contactId?: string } = {}): CrmEmailVerificationView {
  return {
    contact: createContactView({ id: overrides.contactId }),
    event: createTimelineEventView({
      accountId: 'account-1',
      contactId: overrides.contactId ?? 'contact-1',
      eventType: 'email_verified',
      title: '邮箱验证'
    })
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
    async getAccountDetail() {
      return {
        account: null,
        contacts: [],
        timelineEvents: []
      };
    },
    async updateAccountStatus() {
      return {
        account: null
      };
    },
    async addAccountNote() {
      return {
        event: null
      };
    },
    async archiveAccount() {
      return {
        account: null
      };
    },
    async verifyContactEmail() {
      return createEmailVerificationView();
    },
    ...partial
  } as unknown as CrmService;
}
