import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CrmAccountRecord, CrmContactRecord, CrmTimelineEventCreateInput } from '../crm.types';
import { CrmAccountService } from './crm-account.service';

describe('CrmAccountService', () => {
  it('passes source task filter to scoped account listing', async () => {
    const listCalls: unknown[] = [];
    const service = new CrmAccountService(
      {
        async listAccounts(input: unknown) {
          listCalls.push(input);

          return { records: [], total: 0 };
        }
      } as never,
      {} as never
    );

    await service.listAccounts(
      {
        userId: 'user-1',
        userName: 'Sales',
        roles: ['R_USER'],
        buttons: [],
        organizationId: 'org-1',
        organizationRole: 'member'
      },
      { current: 1, size: 20, sourceTaskId: ' task-1 ' }
    );

    assert.deepEqual(listCalls[0], {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      sourceTaskId: 'task-1',
      skip: 0,
      take: 20
    });
  });

  it('updates editable account profile fields and records a timeline event', async () => {
    const account = createAccount();
    const updateCalls: Array<Record<string, unknown>> = [];
    const eventCalls: CrmTimelineEventCreateInput[] = [];
    const service = new CrmAccountService(
      {
        async getAccountDetail() {
          return {
            account,
            contacts: [],
            enrichmentHistories: [],
            timelineEvents: []
          };
        },
        async updateAccount(id: string, input: Record<string, unknown>) {
          updateCalls.push({ id, ...input });

          return {
            ...account,
            name: 'ABC Bearing Group',
            normalizedName: 'abc bearing group',
            websiteUrl: 'https://group.example',
            domain: 'group.example',
            country: 'AE',
            customerType: 'distributor'
          };
        },
        async createTimelineEvent(input: CrmTimelineEventCreateInput) {
          eventCalls.push(input);

          return {
            id: 'event-1',
            organizationId: input.organizationId,
            accountId: input.accountId,
            contactId: input.contactId ?? null,
            ownerUserId: input.ownerUserId,
            eventType: input.eventType,
            title: input.title,
            content: input.content ?? null,
            metadata: input.metadata ?? null,
            createdAt: new Date('2026-06-21T00:00:00Z')
          };
        }
      } as never,
      {} as never
    );

    const result = await service.updateAccount(
      account.id,
      {
        name: 'ABC Bearing Group',
        normalizedName: 'abc bearing group',
        websiteUrl: 'https://group.example',
        country: 'AE',
        customerType: 'distributor'
      },
      {
        userId: 'u-1',
        userName: 'Sales',
        roles: ['R_USER'],
        organizationId: 'org-1',
        organizationRole: 'member'
      }
    );

    assert.equal(updateCalls[0].id, account.id);
    assert.equal(updateCalls[0].domain, 'group.example');
    assert.equal(eventCalls[0].eventType, 'account_profile_updated');
    assert.equal((result.account as { name: string }).name, 'ABC Bearing Group');
  });

  it('creates one manual contact under the owned account', async () => {
    const account = createAccount();
    const createdContacts: CrmContactRecord[] = [];
    const service = new CrmAccountService(
      {
        async getAccountDetail() {
          return {
            account,
            contacts: [],
            enrichmentHistories: [],
            timelineEvents: []
          };
        },
        async findContactByEmailHash() {
          return null;
        },
        async createContact(input: Partial<CrmContactRecord>) {
          const contact = createContact(input);
          createdContacts.push(contact);
          return contact;
        },
        async createTimelineEvent(input: CrmTimelineEventCreateInput) {
          return {
            id: 'event-1',
            organizationId: input.organizationId,
            accountId: input.accountId,
            contactId: input.contactId ?? null,
            ownerUserId: input.ownerUserId,
            eventType: input.eventType,
            title: input.title,
            content: input.content ?? null,
            metadata: input.metadata ?? null,
            createdAt: new Date('2026-06-21T00:00:00Z')
          };
        },
        async updateAccount() {
          return {
            ...account,
            status: 'email_verification_pending'
          };
        }
      } as never,
      {} as never
    );

    const result = await service.createContact(
      account.id,
      { fullName: 'Alice Buyer', title: 'Purchasing Manager', email: 'alice@abc.example' },
      {
        userId: 'u-1',
        userName: 'Sales',
        roles: ['R_USER'],
        organizationId: 'org-1',
        organizationRole: 'member'
      }
    );

    assert.equal(createdContacts[0].email, 'alice@abc.example');
    assert.equal(result.contact.email, 'alice@abc.example');
  });

  it('updates one owned contact email and resets its verification status', async () => {
    const contact = createContact({});
    const service = new CrmAccountService(
      {
        async findContactById() {
          return contact;
        },
        async findContactByEmailHash() {
          return null;
        },
        async updateContact(_id: string, input: Partial<CrmContactRecord>) {
          return createContact({
            ...contact,
            ...input,
            emailStatus: input.emailStatus as CrmContactRecord['emailStatus']
          });
        },
        async createTimelineEvent(input: CrmTimelineEventCreateInput) {
          return {
            id: 'event-1',
            organizationId: input.organizationId,
            accountId: input.accountId,
            contactId: input.contactId ?? null,
            ownerUserId: input.ownerUserId,
            eventType: input.eventType,
            title: input.title,
            content: input.content ?? null,
            metadata: input.metadata ?? null,
            createdAt: new Date('2026-06-21T00:00:00Z')
          };
        }
      } as never,
      {} as never
    );

    const result = await service.updateContact(
      contact.id,
      { email: 'buyer@abc.example', fullName: 'Buyer' },
      {
        userId: 'u-1',
        userName: 'Sales',
        roles: ['R_USER'],
        organizationId: 'org-1',
        organizationRole: 'member'
      }
    );

    assert.equal(result.contact.email, 'buyer@abc.example');
    assert.equal(result.contact.emailStatus, 'unchecked');
  });

  it('deletes one owned contact and moves the account back to missing_contact when it becomes empty', async () => {
    const account = createAccount();
    const contact = createContact({});
    const service = new CrmAccountService(
      {
        async findContactById() {
          return contact;
        },
        async deleteContact() {
          return contact;
        },
        async createTimelineEvent(input: CrmTimelineEventCreateInput) {
          return {
            id: 'event-1',
            organizationId: input.organizationId,
            accountId: input.accountId,
            contactId: input.contactId ?? null,
            ownerUserId: input.ownerUserId,
            eventType: input.eventType,
            title: input.title,
            content: input.content ?? null,
            metadata: input.metadata ?? null,
            createdAt: new Date('2026-06-21T00:00:00Z')
          };
        },
        async getAccountDetail() {
          return {
            account: {
              ...account,
              id: contact.accountId,
              status: 'ready'
            },
            contacts: [],
            enrichmentHistories: [],
            timelineEvents: []
          };
        },
        async updateAccount() {
          return {
            ...account,
            status: 'missing_contact'
          };
        }
      } as never,
      {} as never
    );

    const result = await service.deleteContact(contact.id, {
      userId: 'u-1',
      userName: 'Sales',
      roles: ['R_USER'],
      organizationId: 'org-1',
      organizationRole: 'member'
    });

    assert.equal(result.contact.id, contact.id);
  });

  it('manually refreshes Hunter contacts and updates enrichment history', async () => {
    const account = createAccount();
    const createdContacts: CrmContactRecord[] = [];
    const histories: Array<{ status: string; lastAttemptedAt: Date; maskedEmail?: string | null }> = [];
    const hunterCalls: string[] = [];
    const accountRepository = {
      async getAccountDetail() {
        return {
          account,
          contacts: createdContacts,
          enrichmentHistories: [],
          timelineEvents: []
        };
      },
      async findAccountByDomain() {
        return account;
      },
      async findArchivedFingerprints() {
        return [];
      },
      async createTimelineEvent(input: CrmTimelineEventCreateInput) {
        return {
          id: `event-${input.eventType}`,
          organizationId: input.organizationId,
          accountId: input.accountId,
          contactId: input.contactId ?? null,
          ownerUserId: input.ownerUserId,
          eventType: input.eventType,
          title: input.title,
          content: input.content ?? null,
          metadata: input.metadata ?? null,
          createdAt: new Date('2026-06-21T00:00:00Z')
        };
      },
      async findContactByEmailHash() {
        return null;
      },
      async createContact(input: Partial<CrmContactRecord>) {
        const contact = createContact(input);
        createdContacts.push(contact);

        return contact;
      },
      async updateContactEmailStatus(id: string) {
        return createdContacts.find(contact => contact.id === id) ?? null;
      },
      async updateAccount() {
        return {
          ...account,
          status: 'ready'
        };
      },
      async findEmailVerificationCache() {
        return null;
      },
      async upsertEmailVerificationCache() {
        return {
          id: 'cache-1',
          emailHash: 'hash',
          maskedEmail: 'a***@abc.example',
          domain: 'abc.example',
          status: 'valid',
          reason: 'mx_found',
          verifiedAt: new Date('2026-06-21T00:00:00Z'),
          expiresAt: new Date('2026-07-21T00:00:00Z'),
          checkedById: 'u-1',
          checkedByName: 'AI外贸管理系统',
          createdAt: new Date('2026-06-21T00:00:00Z'),
          updatedAt: new Date('2026-06-21T00:00:00Z')
        };
      },
      async upsertLeadEnrichmentHistory(input: { status: string; lastAttemptedAt: Date; maskedEmail?: string | null }) {
        histories.push(input);

        return {
          id: 'history-1',
          organizationId: 'org-1',
          ownerUserId: 'u-1',
          accountId: account.id,
          contactId: createdContacts[0]?.id ?? null,
          provider: 'hunter',
          identityType: 'domain',
          identityValue: 'abc.example',
          status: input.status,
          lastAttemptedAt: input.lastAttemptedAt,
          lastSucceededAt: input.lastAttemptedAt,
          maskedEmail: input.maskedEmail ?? null,
          errorMessage: null,
          createdAt: new Date('2026-06-21T00:00:00Z'),
          updatedAt: new Date('2026-06-21T00:00:00Z')
        };
      }
    };
    const service = new CrmAccountService(
      accountRepository as never,
      {
        async getGlobalConfig() {
          return {
            configKey: 'default',
            emailVerificationCooldownDays: 30,
            ownerConcurrentSendLimit: 5,
            ownerDailySendLimitMax: 200,
            followUpDelayDays: { step2Days: 3, step3Days: 7, step4Days: 14, step5Days: 21 },
            updatedAt: new Date('2026-06-21T00:00:00Z')
          };
        }
      } as never,
      {
        async resolveMx() {
          return [{ exchange: 'mx.abc.example', priority: 10 }];
        }
      },
      undefined,
      {
        async getRequiredUserHunterConfig(user: { userId: string }) {
          assert.equal(user.userId, 'u-1');

          return {
            configKey: 'default',
            title: 'Hunter',
            apiBase: 'https://api.hunter.io/v2',
            apiKey: 'hunter-key',
            updatedAt: new Date('2026-06-21T00:00:00Z')
          };
        }
      } as never,
      {
        async domainSearch(_config: unknown, request: { domain: string }) {
          hunterCalls.push(request.domain);

          return {
            data: {
              emails: [
                {
                  value: 'alice@abc.example',
                  type: 'personal',
                  confidence: 95,
                  first_name: 'Alice',
                  last_name: 'Buyer',
                  position: 'Purchasing Manager'
                }
              ]
            }
          };
        }
      } as never
    );

    const result = await service.refreshAccountEnrichment(
      account.id,
      { provider: 'hunter' },
      {
        userId: 'u-1',
        userName: 'AI外贸管理系统',
        roles: [],
        organizationId: 'org-1',
        organizationRole: 'member'
      }
    );

    assert.deepEqual(hunterCalls, ['abc.example']);
    assert.equal(createdContacts[0].email, 'alice@abc.example');
    assert.equal(histories.length, 1);
    assert.equal(histories[0].status, 'success');
    assert.equal(histories[0].maskedEmail, 'a***@abc.example');
    assert.equal(result.enrichmentHistory.lastAttemptedAt, histories[0].lastAttemptedAt.toISOString());
  });
});

function createAccount(): CrmAccountRecord {
  return {
    id: 'account-1',
    organizationId: 'org-1',
    ownerUserId: 'u-1',
    name: 'ABC Bearing',
    normalizedName: 'abc bearing',
    websiteUrl: 'https://abc.example',
    domain: 'abc.example',
    country: null,
    customerType: null,
    status: 'missing_contact',
    sourceTaskId: null,
    archivedAt: null,
    archiveReason: null,
    archiveSlimmedAt: null,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    updatedAt: new Date('2026-06-01T00:00:00Z')
  };
}

function createContact(overrides: Partial<CrmContactRecord>): CrmContactRecord {
  return {
    id: 'contact-1',
    organizationId: 'org-1',
    accountId: 'account-1',
    ownerUserId: 'u-1',
    fullName: 'Alice Buyer',
    title: 'Purchasing Manager',
    email: 'alice@abc.example',
    emailHash: 'hash',
    maskedEmail: 'a***@abc.example',
    isPublicEmail: false,
    emailStatus: 'unchecked',
    sourceTaskId: null,
    createdAt: new Date('2026-06-21T00:00:00Z'),
    updatedAt: new Date('2026-06-21T00:00:00Z'),
    ...overrides
  };
}
