import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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

  it('passes keyword and status filters while keeping member ownership isolation', async () => {
    const store = createStore([
      createAccount({ id: 'own-ready', ownerUserId: 'user-1', name: 'ABC Bearing', status: 'ready' }),
      createAccount({ id: 'own-candidate', ownerUserId: 'user-1', name: 'ABC Distributor', status: 'candidate' }),
      createAccount({ id: 'peer-ready', ownerUserId: 'user-2', name: 'ABC Peer', status: 'ready' })
    ]);
    const service = new CrmService(store);

    const result = await service.listAccounts(createContext(), {
      keyword: ' ABC ',
      status: 'ready'
    });

    assert.deepEqual(
      result.records.map(record => record.id),
      ['own-ready']
    );
    assert.deepEqual(store.lastListArgs, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      skip: 0,
      take: 20,
      keyword: 'ABC',
      status: 'ready'
    });
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

  it('returns account detail for scoped member accounts with ISO dates and newest timeline first', async () => {
    const store = createStore([createAccount({ id: 'account-1', ownerUserId: 'user-1' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', ownerUserId: 'user-1' })],
      timelineEvents: [
        createTimelineEvent({
          id: 'event-old',
          accountId: 'account-1',
          createdAt: new Date('2026-06-18T08:00:00.000Z')
        }),
        createTimelineEvent({
          id: 'event-new',
          accountId: 'account-1',
          createdAt: new Date('2026-06-18T10:00:00.000Z')
        })
      ]
    });
    const service = new CrmService(store);

    const result = await service.getAccountDetail('account-1', createContext());

    assert.equal(result.account.createdAt, '2026-06-18T09:00:00.000Z');
    assert.equal(result.contacts[0].createdAt, '2026-06-18T09:00:00.000Z');
    assert.deepEqual(
      result.timelineEvents.map(event => event.id),
      ['event-new', 'event-old']
    );
    assert.equal(store.lastDetailArgs?.ownerUserId, 'user-1');
  });

  it('allows organization admins to read organization account detail without owner scope', async () => {
    const store = createStore([createAccount({ id: 'peer-account', ownerUserId: 'user-2' })]);
    const service = new CrmService(store);

    await service.getAccountDetail('peer-account', createContext({ organizationRole: 'admin' }));

    assert.equal(store.lastDetailArgs?.ownerUserId, undefined);
  });

  it('throws not found for account detail outside the current member scope', async () => {
    const store = createStore([createAccount({ id: 'peer-account', ownerUserId: 'user-2' })]);
    const service = new CrmService(store);

    await assert.rejects(() => service.getAccountDetail('peer-account', createContext()), NotFoundException);
  });

  it('changes account status after scoped read and writes status timeline metadata', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'candidate' })]);
    const service = new CrmService(store);

    const result = await service.updateAccountStatus(
      'account-1',
      { status: 'ready', remark: ' verified ' },
      createContext()
    );

    assert.equal(result.account.status, 'ready');
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'status_changed');
    assert.equal(store.timelineEvents.at(-1)?.title, '线索状态变更');
    assert.equal(store.timelineEvents.at(-1)?.content, 'verified');
    assert.deepEqual(store.timelineEvents.at(-1)?.metadata, {
      fromStatus: 'candidate',
      toStatus: 'ready'
    });
  });

  it('rejects status changes outside current member scope without updating by raw id', async () => {
    const store = createStore([createAccount({ id: 'peer-account', ownerUserId: 'user-2', status: 'candidate' })]);
    const service = new CrmService(store);

    await assert.rejects(
      () => service.updateAccountStatus('peer-account', { status: 'ready' }, createContext()),
      NotFoundException
    );

    assert.equal(store.accounts[0].status, 'candidate');
    assert.equal(store.timelineEvents.length, 0);
  });

  it('adds a trimmed note timeline event for scoped accounts', async () => {
    const store = createStore([createAccount({ id: 'account-1' })]);
    const service = new CrmService(store);

    const result = await service.addAccountNote('account-1', { content: '  Call next week.  ' }, createContext());

    assert.equal(result.event.eventType, 'note_added');
    assert.equal(result.event.title, '新增备注');
    assert.equal(result.event.content, 'Call next week.');
  });

  it('rejects empty account notes', async () => {
    const store = createStore([createAccount({ id: 'account-1' })]);
    const service = new CrmService(store);

    await assert.rejects(() => service.addAccountNote('account-1', { content: '   ' }, createContext()), BadRequestException);
  });

  it('archives scoped accounts with archive timeline metadata', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'ready' })]);
    const service = new CrmService(store);

    const result = await service.archiveAccount('account-1', { reason: '  Not a fit  ' }, createContext());

    assert.equal(result.account.status, 'archived');
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'account_archived');
    assert.equal(store.timelineEvents.at(-1)?.title, '归档线索');
    assert.equal(store.timelineEvents.at(-1)?.content, 'Not a fit');
    assert.deepEqual(store.timelineEvents.at(-1)?.metadata, {
      fromStatus: 'ready',
      toStatus: 'archived'
    });
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

function createStore(
  initialAccounts: TestAccount[] = [],
  initialData: {
    contacts?: TestContact[];
    timelineEvents?: TestTimelineEvent[];
  } = {}
): CrmStore & {
  accounts: TestAccount[];
  contacts: TestContact[];
  timelineEvents: TestTimelineEvent[];
  lastListArgs?: Parameters<CrmStore['listAccounts']>[0];
  lastDetailArgs?: Parameters<CrmStore['getAccountDetail']>[0];
} {
  const accounts = [...initialAccounts];
  const contacts: TestContact[] = [...(initialData.contacts ?? [])];
  const timelineEvents: TestTimelineEvent[] = [...(initialData.timelineEvents ?? [])];

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
      this.lastListArgs = args;
      const records = accounts.filter(account => {
        if (account.organizationId !== args.organizationId) return false;
        if (args.ownerUserId && account.ownerUserId !== args.ownerUserId) return false;
        if (args.status && account.status !== args.status) return false;
        if (args.keyword) {
          const keyword = args.keyword.toLowerCase();
          const searchableValues = [
            account.name,
            account.domain,
            account.websiteUrl,
            account.country,
            account.customerType
          ];
          if (!searchableValues.some(value => value?.toLowerCase().includes(keyword))) return false;
        }
        return true;
      });
      return { records, total: records.length };
    },
    async getAccountDetail(args) {
      this.lastDetailArgs = args;
      const account = accounts.find(item => {
        if (item.id !== args.id) return false;
        if (item.organizationId !== args.organizationId) return false;
        if (args.ownerUserId && item.ownerUserId !== args.ownerUserId) return false;
        return true;
      });
      if (!account) return null;

      return {
        account,
        contacts: contacts.filter(contact => contact.accountId === account.id),
        timelineEvents: timelineEvents
          .filter(event => event.accountId === account.id)
          .toSorted((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      };
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

function createContact(input: Partial<TestContact> = {}): TestContact {
  return {
    id: input.id || 'contact-1',
    organizationId: input.organizationId || 'org-1',
    accountId: input.accountId || 'account-1',
    ownerUserId: input.ownerUserId || 'user-1',
    fullName: input.fullName ?? 'Ali Hassan',
    title: input.title ?? 'Buyer',
    email: input.email ?? 'ali@example.com',
    emailHash: input.emailHash ?? 'hash-1',
    maskedEmail: input.maskedEmail ?? 'a***@example.com',
    isPublicEmail: input.isPublicEmail ?? false,
    emailStatus: input.emailStatus ?? 'unchecked',
    sourceTaskId: input.sourceTaskId ?? null,
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createTimelineEvent(input: Partial<TestTimelineEvent> = {}): TestTimelineEvent {
  return {
    id: input.id || 'event-1',
    organizationId: input.organizationId || 'org-1',
    accountId: input.accountId || 'account-1',
    contactId: input.contactId ?? null,
    ownerUserId: input.ownerUserId || 'user-1',
    eventType: input.eventType || 'account_imported',
    title: input.title || '导入',
    content: input.content ?? null,
    metadata: input.metadata ?? null,
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

type TestAccount = Awaited<ReturnType<CrmStore['createAccount']>>;
type TestContact = Awaited<ReturnType<CrmStore['createContact']>>;
type TestTimelineEvent = Awaited<ReturnType<CrmStore['createTimelineEvent']>>;
