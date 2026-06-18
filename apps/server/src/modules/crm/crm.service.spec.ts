import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmService } from './crm.service';
import type { CrmStore, CrmUserContext } from './crm.types';

describe('CrmService', () => {
  it('imports one lead account and contact with organization scoped dedupe', async () => {
    const store = createStore();
    const service = new CrmService(store);
    const context = createContext();

    const first = await service.importAccountFromLead(
      {
        name: 'ABC Bearings Trading LLC',
        websiteUrl: 'https://www.abc-bearing.example/about',
        country: 'AE',
        customerType: 'distributor',
        sourceTaskId: 'task-1',
        contact: {
          fullName: 'Ali Hassan',
          title: 'Purchasing Manager',
          email: ' Ali@ABC-Bearing.example '
        }
      },
      context
    );
    const second = await service.importAccountFromLead(
      {
        name: 'ABC Bearings Trading',
        websiteUrl: 'https://abc-bearing.example',
        country: 'AE',
        customerType: 'distributor',
        sourceTaskId: 'task-2',
        contact: {
          fullName: 'Ali H.',
          title: 'Buyer',
          email: 'ali@abc-bearing.example'
        }
      },
      context
    );

    assert.equal(first.account.id, second.account.id);
    assert.equal(first.contact?.id, second.contact?.id);
    assert.equal(store.accounts.length, 1);
    assert.equal(store.contacts.length, 1);
    assert.equal(store.accounts[0].organizationId, 'org-1');
    assert.equal(store.accounts[0].ownerUserId, 'user-1');
    assert.equal(store.accounts[0].domain, 'abc-bearing.example');
    assert.equal(store.contacts[0].maskedEmail, 'a***@abc-bearing.example');
    assert.equal(store.timelineEvents.map(event => event.eventType).join(','), 'account_imported,contact_imported');
  });

  it('lists only owner accounts for members and all organization accounts for organization admins', async () => {
    const store = createStore([
      createAccount({ id: 'own-account', ownerUserId: 'user-1', name: 'Own Account' }),
      createAccount({ id: 'peer-account', ownerUserId: 'user-2', name: 'Peer Account' })
    ]);
    const service = new CrmService(store);

    const memberResult = await service.listAccounts(createContext({ organizationRole: 'member' }));
    const adminResult = await service.listAccounts(createContext({ organizationRole: 'admin' }));

    assert.deepEqual(
      memberResult.records.map(record => record.id),
      ['own-account']
    );
    assert.deepEqual(
      adminResult.records.map(record => record.id),
      ['own-account', 'peer-account']
    );
  });

  it('keeps same-organization member imports isolated by owner', async () => {
    const store = createStore([
      createAccount({ id: 'peer-account', ownerUserId: 'user-2', name: 'Peer Account', domain: 'shared.example' })
    ]);
    const service = new CrmService(store);

    const result = await service.importAccountFromLead(
      {
        name: 'Shared Domain',
        websiteUrl: 'https://shared.example'
      },
      createContext({ userId: 'user-1' })
    );

    assert.notEqual(result.account.id, 'peer-account');
    assert.equal(result.account.ownerUserId, 'user-1');
    assert.equal(store.accounts.length, 2);
  });

  it('normalizes domains with uppercase URL schemes', async () => {
    const store = createStore();
    const service = new CrmService(store);

    const result = await service.importAccountFromLead(
      {
        name: 'Uppercase Scheme',
        websiteUrl: 'HTTPS://WWW.Example.COM/path'
      },
      createContext()
    );

    assert.equal(result.account.domain, 'example.com');
  });
});

function createContext(overrides: Partial<CrmUserContext> = {}): CrmUserContext {
  return {
    userId: 'user-1',
    userName: 'Alice',
    roles: ['R_USER'],
    organizationId: 'org-1',
    organizationRole: 'member',
    ...overrides
  };
}

function createStore(initialAccounts: TestAccount[] = []): CrmStore & {
  accounts: TestAccount[];
  contacts: TestContact[];
  timelineEvents: TestTimelineEvent[];
} {
  const accounts = [...initialAccounts];
  const contacts: TestContact[] = [];
  const timelineEvents: TestTimelineEvent[] = [];

  return {
    accounts,
    contacts,
    timelineEvents,
    async findAccountByDomain(organizationId, ownerUserId, domain) {
      return (
        accounts.find(
          account =>
            account.organizationId === organizationId &&
            account.ownerUserId === ownerUserId &&
            account.domain === domain
        ) || null
      );
    },
    async createAccount(input) {
      const account = createAccount({
        ...input,
        id: `account-${accounts.length + 1}`
      });
      accounts.push(account);
      return account;
    },
    async updateAccount(id, input) {
      const account = accounts.find(item => item.id === id);
      if (!account) return null;
      Object.assign(account, input, { updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      return account;
    },
    async findContactByEmailHash(organizationId, ownerUserId, emailHash) {
      return (
        contacts.find(
          contact =>
            contact.organizationId === organizationId &&
            contact.ownerUserId === ownerUserId &&
            contact.emailHash === emailHash
        ) || null
      );
    },
    async createContact(input) {
      const contact: TestContact = {
        id: `contact-${contacts.length + 1}`,
        organizationId: input.organizationId,
        accountId: input.accountId,
        ownerUserId: input.ownerUserId,
        fullName: input.fullName ?? null,
        title: input.title ?? null,
        email: input.email,
        emailHash: input.emailHash,
        maskedEmail: input.maskedEmail,
        isPublicEmail: input.isPublicEmail,
        emailStatus: input.emailStatus,
        sourceTaskId: input.sourceTaskId ?? null,
        createdAt: new Date('2026-06-18T09:00:00.000Z'),
        updatedAt: new Date('2026-06-18T09:00:00.000Z')
      };
      contacts.push(contact);
      return contact;
    },
    async updateContact(id, input) {
      const contact = contacts.find(item => item.id === id);
      if (!contact) return null;
      Object.assign(contact, input, { updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      return contact;
    },
    async listAccounts(args) {
      const records = accounts.filter(account => {
        if (account.organizationId !== args.organizationId) return false;
        if (args.ownerUserId && account.ownerUserId !== args.ownerUserId) return false;
        return true;
      });
      return { records, total: records.length };
    },
    async createTimelineEvent(input) {
      const event: TestTimelineEvent = {
        id: `event-${timelineEvents.length + 1}`,
        organizationId: input.organizationId,
        accountId: input.accountId,
        contactId: input.contactId ?? null,
        ownerUserId: input.ownerUserId,
        eventType: input.eventType,
        title: input.title,
        content: input.content ?? null,
        metadata: input.metadata ?? null,
        createdAt: new Date('2026-06-18T09:00:00.000Z')
      };
      timelineEvents.push(event);
      return event;
    }
  };
}

function createAccount(input: Partial<TestAccount> = {}): TestAccount {
  return {
    id: input.id || 'account-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    name: input.name || 'Account',
    normalizedName: input.normalizedName || 'account',
    websiteUrl: input.websiteUrl ?? null,
    domain: input.domain ?? 'account.example',
    country: input.country ?? null,
    customerType: input.customerType ?? null,
    status: input.status || 'candidate',
    sourceTaskId: input.sourceTaskId ?? null,
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

type TestAccount = Awaited<ReturnType<CrmStore['createAccount']>>;
type TestContact = Awaited<ReturnType<CrmStore['createContact']>>;
type TestTimelineEvent = Awaited<ReturnType<CrmStore['createTimelineEvent']>>;
