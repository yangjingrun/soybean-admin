import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { SystemLogRecordInput, SystemLogRecorder } from '../system-log/system-log.types';
import { CrmService } from './crm.service';
import type {
  CrmInboxMessageRecord,
  CrmInboxThreadRecord,
  CrmMailboxRecord,
  CrmSendQueueJob,
  CrmSendQueuePort,
  CrmSequenceReviewRecord,
  CrmStore,
  CrmUserContext
} from './crm.types';

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

  it('verifies a contact email as valid when the domain has MX records', async () => {
    const store = createStore([createAccount({ id: 'account-1' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', email: 'Ali@Example.COM' })]
    });
    const logs = createLogRecorder();
    const service = new CrmService(store, createDnsResolver([{ exchange: 'mx.example.com', priority: 10 }]), logs.service);

    const result = await service.verifyContactEmail('contact-1', createContext());

    assert.equal(result.contact.emailStatus, 'valid');
    assert.equal(result.contact.updatedAt, '2026-06-18T10:00:00.000Z');
    assert.equal(result.event.eventType, 'email_verified');
    assert.equal(result.event.title, '邮箱验证');
    assert.equal(store.timelineEvents.at(-1)?.contactId, 'contact-1');
    assert.deepEqual(store.timelineEvents.at(-1)?.metadata, {
      maskedEmail: 'a***@example.com',
      domain: 'example.com',
      fromStatus: 'unchecked',
      toStatus: 'valid',
      reason: 'mx_found'
    });
    assert.deepEqual(logs.records[0], {
      level: 'info',
      status: 'success',
      module: 'crm',
      action: 'contact-email-verify',
      message: 'CRM 联系人邮箱验证完成',
      userId: 'user-1',
      userName: 'Alice',
      metadata: {
        organizationId: 'org-1',
        accountId: 'account-1',
        contactId: 'contact-1',
        maskedEmail: 'a***@example.com',
        domain: 'example.com',
        fromStatus: 'unchecked',
        toStatus: 'valid',
        reason: 'mx_found'
      }
    });
  });

  it('marks invalid format emails without querying DNS', async () => {
    const store = createStore([createAccount({ id: 'account-1' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', email: 'invalid-email' })]
    });
    const resolver = createDnsResolver([]);
    const service = new CrmService(store, resolver);

    const result = await service.verifyContactEmail('contact-1', createContext());

    assert.equal(result.contact.emailStatus, 'invalid');
    assert.equal(resolver.calls.length, 0);
    assert.equal((store.timelineEvents.at(-1)?.metadata as { reason: string } | undefined)?.reason, 'invalid_format');
  });

  it('marks malformed email domains invalid without querying DNS', async () => {
    const store = createStore([createAccount({ id: 'account-1' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', email: 'buyer@example..com' })]
    });
    const resolver = createDnsResolver([]);
    const service = new CrmService(store, resolver);

    const result = await service.verifyContactEmail('contact-1', createContext());

    assert.equal(result.contact.emailStatus, 'invalid');
    assert.equal(resolver.calls.length, 0);
    assert.equal((store.timelineEvents.at(-1)?.metadata as { reason: string } | undefined)?.reason, 'invalid_format');
  });

  it('marks emails invalid when the domain has no MX records', async () => {
    const store = createStore([createAccount({ id: 'account-1' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', email: 'buyer@nomx.example' })]
    });
    const service = new CrmService(store, createDnsResolver(createDnsError('ENODATA')));

    const result = await service.verifyContactEmail('contact-1', createContext());

    assert.equal(result.contact.emailStatus, 'invalid');
    assert.equal((store.timelineEvents.at(-1)?.metadata as { reason: string } | undefined)?.reason, 'no_mx');
  });

  it('marks emails unreachable when DNS fails temporarily', async () => {
    const store = createStore([createAccount({ id: 'account-1' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', email: 'buyer@timeout.example' })]
    });
    const service = new CrmService(store, createDnsResolver(createDnsError('ETIMEOUT')));

    const result = await service.verifyContactEmail('contact-1', createContext());

    assert.equal(result.contact.emailStatus, 'unreachable');
    assert.equal((store.timelineEvents.at(-1)?.metadata as { reason: string } | undefined)?.reason, 'dns_temporary_failure');
  });

  it('rejects contact verification outside current member scope without updating status', async () => {
    const store = createStore([createAccount({ id: 'account-1', ownerUserId: 'user-2' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', ownerUserId: 'user-2' })]
    });
    const service = new CrmService(store, createDnsResolver([{ exchange: 'mx.example.com', priority: 10 }]));

    await assert.rejects(() => service.verifyContactEmail('contact-1', createContext()), NotFoundException);

    assert.equal(store.contacts[0].emailStatus, 'unchecked');
    assert.equal(store.timelineEvents.length, 0);
  });

  it('allows organization admins to verify organization contacts without owner scope', async () => {
    const store = createStore([createAccount({ id: 'account-1', ownerUserId: 'user-2' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', ownerUserId: 'user-2' })]
    });
    const service = new CrmService(store, createDnsResolver([{ exchange: 'mx.example.com', priority: 10 }]));

    await service.verifyContactEmail('contact-1', createContext({ organizationRole: 'admin' }));

    assert.equal(store.lastContactArgs?.ownerUserId, undefined);
    assert.equal(store.contacts[0].emailStatus, 'valid');
  });

  it('allows R_SUPER users to verify organization contacts without owner scope', async () => {
    const store = createStore([createAccount({ id: 'account-1', ownerUserId: 'user-2' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', ownerUserId: 'user-2' })]
    });
    const service = new CrmService(store, createDnsResolver([{ exchange: 'mx.example.com', priority: 10 }]));

    await service.verifyContactEmail('contact-1', createContext({ roles: ['R_SUPER'], organizationRole: 'member' }));

    assert.equal(store.lastContactArgs?.ownerUserId, undefined);
    assert.equal(store.contacts[0].emailStatus, 'valid');
  });

  it('mock authorizes a normalized Gmail mailbox without storing tokens and records a sanitized log', async () => {
    const store = createStore();
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service);

    const result = await service.mockAuthorizeMailbox({ emailAddress: '  Alice@Gmail.COM  ' }, createContext());

    assert.equal(result.mailbox.provider, 'gmail');
    assert.equal(result.mailbox.emailAddress, 'alice@gmail.com');
    assert.equal(result.mailbox.maskedEmail, 'a***@gmail.com');
    assert.equal(result.mailbox.status, 'active');
    assert.equal(result.mailbox.dailyLimit, 50);
    assert.equal(result.mailbox.hourlyLimit, 10);
    assert.equal(result.mailbox.warmupStage, 'new');
    assert.equal(result.mailbox.authorizedAt, '2026-06-18T09:00:00.000Z');
    assert.equal(result.mailbox.ownerUserId, 'user-1');
    assert.equal(store.mailboxes[0].emailHash.length, 64);
    assert.deepEqual(logs.records[0].metadata, {
      organizationId: 'org-1',
      mailboxId: 'mailbox-1',
      provider: 'gmail',
      maskedEmail: 'a***@gmail.com',
      fromStatus: null,
      toStatus: 'active'
    });
  });

  it('returns the current user mailbox when mock authorizing the same Gmail address again', async () => {
    const existingMailbox = createMailbox({
      id: 'mailbox-existing',
      emailAddress: 'alice@gmail.com',
      emailHash: hashTestEmail('alice@gmail.com')
    });
    const store = createStore([], { mailboxes: [existingMailbox] });
    const service = new CrmService(store);

    const result = await service.mockAuthorizeMailbox({ emailAddress: 'ALICE@gmail.com' }, createContext());

    assert.equal(result.mailbox.id, 'mailbox-existing');
    assert.equal(store.mailboxes.length, 1);
  });

  it('rejects concurrent mock authorization when unique conflict returns another owner mailbox', async () => {
    const store = createStore();
    const peerMailbox = createMailbox({
      id: 'peer-mailbox',
      organizationId: 'org-2',
      ownerUserId: 'user-2',
      emailAddress: 'alice@gmail.com',
      emailHash: hashTestEmail('alice@gmail.com')
    });
    store.createMailbox = async () => peerMailbox;
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service);

    await assert.rejects(
      () => service.mockAuthorizeMailbox({ emailAddress: 'alice@gmail.com' }, createContext()),
      BadRequestException
    );

    assert.equal(logs.records.length, 0);
  });

  it('rejects unsupported mailbox aliases and non-Gmail addresses in the first version', async () => {
    const service = new CrmService(createStore());

    await assert.rejects(
      () => service.mockAuthorizeMailbox({ emailAddress: 'alice+sales@gmail.com' }, createContext()),
      BadRequestException
    );
    await assert.rejects(
      () => service.mockAuthorizeMailbox({ emailAddress: 'alice@example.com' }, createContext()),
      BadRequestException
    );
  });

  it('lists only owner mailboxes for members and all organization mailboxes for admins', async () => {
    const store = createStore([], {
      mailboxes: [
        createMailbox({ id: 'own-mailbox', ownerUserId: 'user-1', emailAddress: 'own@gmail.com' }),
        createMailbox({ id: 'peer-mailbox', ownerUserId: 'user-2', emailAddress: 'peer@gmail.com' })
      ]
    });
    const service = new CrmService(store);

    const memberResult = await service.listMailboxes(createContext(), { keyword: 'gmail', status: 'active' });

    assert.deepEqual(
      memberResult.records.map(record => record.id),
      ['own-mailbox']
    );
    assert.deepEqual(store.lastMailboxListArgs, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      skip: 0,
      take: 20,
      keyword: 'gmail',
      status: 'active'
    });

    const adminResult = await service.listMailboxes(createContext({ organizationRole: 'admin' }));

    assert.deepEqual(
      adminResult.records.map(record => record.id),
      ['own-mailbox', 'peer-mailbox']
    );
  });

  it('pauses and resumes mailboxes after scoped reads with sanitized logs', async () => {
    const store = createStore([], {
      mailboxes: [createMailbox({ id: 'mailbox-1', status: 'active' })]
    });
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service);

    const paused = await service.pauseMailbox('mailbox-1', createContext());
    const resumed = await service.resumeMailbox('mailbox-1', createContext());

    assert.equal(paused.mailbox.status, 'paused');
    assert.match(paused.mailbox.pausedAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(resumed.mailbox.status, 'active');
    assert.equal(resumed.mailbox.pausedAt, null);
    assert.equal(store.lastMailboxDetailArgs?.ownerUserId, 'user-1');
    assert.deepEqual(logs.records.map(record => record.metadata), [
      {
        organizationId: 'org-1',
        mailboxId: 'mailbox-1',
        provider: 'gmail',
        maskedEmail: 'a***@gmail.com',
        fromStatus: 'active',
        toStatus: 'paused'
      },
      {
        organizationId: 'org-1',
        mailboxId: 'mailbox-1',
        provider: 'gmail',
        maskedEmail: 'a***@gmail.com',
        fromStatus: 'paused',
        toStatus: 'active'
      }
    ]);
  });

  it('rejects mailbox pause outside the current member scope without raw id updates', async () => {
    const store = createStore([], {
      mailboxes: [createMailbox({ id: 'peer-mailbox', ownerUserId: 'user-2', status: 'active' })]
    });
    const service = new CrmService(store);

    await assert.rejects(() => service.pauseMailbox('peer-mailbox', createContext()), NotFoundException);

    assert.equal(store.mailboxes[0].status, 'active');
    assert.equal(store.mailboxUpdateCalls.length, 0);
  });

  it('lists organization product lines for members without owner isolation', async () => {
    const store = createStore([], {
      productLines: [
        createProductLine({ id: 'line-1', organizationId: 'org-1', name: 'Bearing Series' }),
        createProductLine({ id: 'line-2', organizationId: 'org-1', name: 'Motor Series', status: 'archived' }),
        createProductLine({ id: 'other-org-line', organizationId: 'org-2', name: 'Other Org Series' })
      ]
    });
    const service = new CrmService(store);

    const result = await service.listProductLines(createContext(), {
      keyword: ' Series ',
      status: 'active'
    });

    assert.deepEqual(
      result.records.map(record => record.id),
      ['line-1']
    );
    assert.deepEqual(store.lastProductLineListArgs, {
      organizationId: 'org-1',
      skip: 0,
      take: 20,
      keyword: 'Series',
      status: 'active'
    });
  });

  it('creates product lines with trimmed fields and sanitized system log metadata', async () => {
    const store = createStore();
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service);

    const result = await service.createProductLine(
      {
        name: '  Bearing Series  ',
        targetCustomerType: '  distributors  ',
        coreSellingPoints: '  Stable supply, ISO factories  ',
        moq: '  100 pcs  ',
        leadTime: '  15-20 days  ',
        paymentTerms: '  T/T  ',
        certifications: '  ISO 9001  ',
        catalogUrl: '  /catalog/bearing.pdf  ',
        websiteUrl: '  https://example.com/bearing  ',
        commonModelsText: '  6204, 6205  '
      },
      createContext()
    );

    assert.equal(result.productLine.name, 'Bearing Series');
    assert.equal(result.productLine.targetCustomerType, 'distributors');
    assert.equal(result.productLine.catalogUrl, '/catalog/bearing.pdf');
    assert.equal(store.productLines[0].organizationId, 'org-1');
    assert.equal(store.productLines[0].createdById, 'user-1');
    assert.deepEqual(logs.records[0].metadata, {
      organizationId: 'org-1',
      productLineId: 'product-line-1',
      name: 'Bearing Series',
      status: 'active',
      fromStatus: null,
      toStatus: 'active'
    });
  });

  it('rejects duplicate product line names within the same organization', async () => {
    const store = createStore([], {
      productLines: [createProductLine({ id: 'line-1', name: 'Bearing Series' })]
    });
    const service = new CrmService(store);

    await assert.rejects(
      () => service.createProductLine({ name: ' Bearing Series ' }, createContext()),
      BadRequestException
    );
  });

  it('maps concurrent product line create unique conflicts to business errors', async () => {
    const store = createStore();
    store.createProductLine = async () => {
      throw createPrismaUniqueError();
    };
    const service = new CrmService(store);

    await assert.rejects(() => service.createProductLine({ name: 'Bearing Series' }, createContext()), {
      message: '产品资料名称已存在'
    });
  });

  it('updates product lines through organization scoped reads and writes sanitized logs', async () => {
    const store = createStore([], {
      productLines: [createProductLine({ id: 'line-1', name: 'Bearing Series', status: 'active' })]
    });
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service);

    const result = await service.updateProductLine(
      'line-1',
      {
        name: 'Premium Bearing Series',
        leadTime: '20 days',
        status: 'archived'
      },
      createContext()
    );

    assert.equal(result.productLine.name, 'Premium Bearing Series');
    assert.equal(result.productLine.status, 'archived');
    assert.deepEqual(store.lastProductLineDetailArgs, {
      id: 'line-1',
      organizationId: 'org-1'
    });
    assert.deepEqual(store.productLineUpdateCalls[0], {
      id: 'line-1',
      organizationId: 'org-1',
      input: {
        name: 'Premium Bearing Series',
        leadTime: '20 days',
        status: 'archived'
      }
    });
    assert.deepEqual(logs.records[0].metadata, {
      organizationId: 'org-1',
      productLineId: 'line-1',
      name: 'Premium Bearing Series',
      status: 'archived',
      fromStatus: 'active',
      toStatus: 'archived'
    });
  });

  it('maps concurrent product line rename unique conflicts to business errors', async () => {
    const store = createStore([], {
      productLines: [createProductLine({ id: 'line-1', name: 'Bearing Series' })]
    });
    store.updateProductLine = async () => {
      throw createPrismaUniqueError();
    };
    const service = new CrmService(store);

    await assert.rejects(() => service.updateProductLine('line-1', { name: 'Premium Bearing Series' }, createContext()), {
      message: '产品资料名称已存在'
    });
  });

  it('archives product lines only inside the current organization scope', async () => {
    const store = createStore([], {
      productLines: [createProductLine({ id: 'line-1', organizationId: 'org-2', status: 'active' })]
    });
    const service = new CrmService(store);

    await assert.rejects(() => service.archiveProductLine('line-1', createContext()), NotFoundException);

    assert.equal(store.productLines[0].status, 'active');
    assert.equal(store.productLineUpdateCalls.length, 0);
  });

  it('creates first draft review items with scoped resources and sanitized logs', async () => {
    const store = createStore([createAccount({ id: 'account-1', name: 'ABC Trading', status: 'ready' })], {
      contacts: [
        createContact({
          id: 'contact-1',
          accountId: 'account-1',
          fullName: 'Ali Hassan',
          emailStatus: 'valid'
        })
      ],
      mailboxes: [createMailbox({ id: 'mailbox-1', maskedEmail: 'a***@gmail.com' })],
      productLines: [
        createProductLine({
          id: 'line-1',
          name: 'Bearing Series',
          coreSellingPoints: 'stable supply',
          moq: '100 pcs',
          leadTime: '15 days'
        })
      ]
    });
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service);

    const result = await service.createSequenceReviewItem(
      {
        accountId: 'account-1',
        contactId: 'contact-1',
        productLineId: 'line-1',
        mailboxId: 'mailbox-1'
      },
      createContext()
    );

    assert.equal(result.item.enrollment.status, 'draft_review_pending');
    assert.equal(result.item.firstMessage?.status, 'draft_pending_review');
    assert.equal(result.item.firstMessage?.subject, 'Bearing Series for ABC Trading');
    assert.match(result.item.firstMessage?.bodyText ?? '', /stable supply/);
    assert.equal(store.accounts[0].status, 'manual_review_pending');
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'sequence_draft_generated');
    assert.equal((logs.records[0].metadata as Record<string, unknown>).messageId, 'message-1');
    assert.equal(JSON.stringify(logs.records[0].metadata).includes('stable supply'), false);
  });

  it('rejects sequence review creation for peer contacts and active duplicate enrollments', async () => {
    const store = createStore([createAccount({ id: 'account-1', ownerUserId: 'user-1' })], {
      contacts: [
        createContact({ id: 'contact-1', ownerUserId: 'user-2', accountId: 'account-1' }),
        createContact({ id: 'contact-2', ownerUserId: 'user-1', accountId: 'account-1' })
      ],
      enrollments: [createEnrollment({ id: 'enrollment-1', contactId: 'contact-2' })]
    });
    const service = new CrmService(store);

    await assert.rejects(
      () => service.createSequenceReviewItem({ accountId: 'account-1', contactId: 'contact-1' }, createContext()),
      BadRequestException
    );
    await assert.rejects(
      () => service.createSequenceReviewItem({ accountId: 'account-1', contactId: 'contact-2' }, createContext()),
      BadRequestException
    );
  });

  it('lists sequence review items with member owner scope and generated checklist', async () => {
    const store = createStore([createAccount({ id: 'account-1', name: 'ABC Trading' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', emailStatus: 'valid' })],
      mailboxes: [createMailbox({ id: 'mailbox-1' })],
      productLines: [createProductLine({ id: 'line-1' })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          productLineId: 'line-1',
          mailboxId: 'mailbox-1'
        })
      ],
      messages: [createMessage({ id: 'message-1', enrollmentId: 'enrollment-1' })]
    });
    const service = new CrmService(store);

    const result = await service.listSequenceReviewItems(createContext(), {
      keyword: ' ABC ',
      status: 'draft_review_pending'
    });

    assert.deepEqual(store.lastSequenceReviewListArgs, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      keyword: 'ABC',
      status: 'draft_review_pending',
      skip: 0,
      take: 20
    });
    assert.equal(result.records[0].firstMessage?.id, 'message-1');
    assert.equal(result.records[0].checklist.every(item => item.passed), true);
  });

  it('updates and approves editable message drafts without sending them', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'manual_review_pending' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      enrollments: [createEnrollment({ id: 'enrollment-1', accountId: 'account-1', contactId: 'contact-1' })],
      messages: [createMessage({ id: 'message-1', enrollmentId: 'enrollment-1' })]
    });
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service);

    const updated = await service.updateMessageDraft(
      'message-1',
      {
        subject: ' Updated subject ',
        bodyText: ' Updated body '
      },
      createContext()
    );
    const approved = await service.approveMessageDraft('message-1', createContext());

    assert.equal(updated.message.subject, 'Updated subject');
    assert.equal(store.messages[0].status, 'draft_ready');
    assert.equal(approved.enrollment.status, 'ready_to_send');
    assert.equal(store.accounts[0].status, 'ready');
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'draft_approved');
    assert.equal((logs.records[0].metadata as Record<string, unknown>).messageId, 'message-1');
  });

  it('rejects admin attempts to edit or approve another member draft', async () => {
    const store = createStore([createAccount({ id: 'account-1', ownerUserId: 'user-2' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', ownerUserId: 'user-2' })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          ownerUserId: 'user-2'
        })
      ],
      messages: [
        createMessage({
          id: 'message-1',
          enrollmentId: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          ownerUserId: 'user-2'
        })
      ]
    });
    const service = new CrmService(store);
    const adminContext = createContext({ organizationRole: 'admin' });

    await assert.rejects(
      () => service.updateMessageDraft('message-1', { subject: 'Admin edit', bodyText: 'Body' }, adminContext),
      NotFoundException
    );
    await assert.rejects(() => service.approveMessageDraft('message-1', adminContext), NotFoundException);
    assert.equal(store.messages[0].status, 'draft_pending_review');
    assert.equal(store.enrollments[0].status, 'draft_review_pending');
  });

  it('rejects editing already approved drafts to avoid ready-to-send content drift', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'ready' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          status: 'ready_to_send'
        })
      ],
      messages: [
        createMessage({
          id: 'message-1',
          enrollmentId: 'enrollment-1',
          status: 'draft_ready'
        })
      ]
    });
    const service = new CrmService(store);

    await assert.rejects(
      () => service.updateMessageDraft('message-1', { subject: 'Change', bodyText: 'Body' }, createContext()),
      BadRequestException
    );
  });

  it('starts an approved first message by queueing a guarded send job', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'ready' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      mailboxes: [createMailbox({ id: 'mailbox-1' })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          mailboxId: 'mailbox-1',
          status: 'ready_to_send',
          runVersion: 3
        })
      ],
      messages: [
        createMessage({
          id: 'message-1',
          enrollmentId: 'enrollment-1',
          mailboxId: 'mailbox-1',
          status: 'draft_ready'
        })
      ]
    });
    const queue = createSendQueue();
    const service = new CrmService(store, undefined, undefined, queue);

    const result = await service.startFirstMessageSend('enrollment-1', createContext());

    assert.equal(result.enrollment.status, 'sequence_running');
    assert.equal(result.message.status, 'queued');
    assert.equal(store.messages[0].bullJobId, 'send-job-1');
    assert.deepEqual(queue.jobs[0], {
      enrollmentId: 'enrollment-1',
      messageId: 'message-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 3
    });
  });

  it('rejects admin attempts to start another member send queue job', async () => {
    const store = createStore([createAccount({ id: 'account-1', ownerUserId: 'user-2', status: 'ready' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', ownerUserId: 'user-2' })],
      mailboxes: [createMailbox({ id: 'mailbox-1', ownerUserId: 'user-2' })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          mailboxId: 'mailbox-1',
          ownerUserId: 'user-2',
          status: 'ready_to_send'
        })
      ],
      messages: [
        createMessage({
          id: 'message-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          enrollmentId: 'enrollment-1',
          mailboxId: 'mailbox-1',
          ownerUserId: 'user-2',
          status: 'draft_ready'
        })
      ]
    });
    const service = new CrmService(store, undefined, undefined, createSendQueue());

    await assert.rejects(
      () => service.startFirstMessageSend('enrollment-1', createContext({ organizationRole: 'admin' })),
      NotFoundException
    );
  });

  it('rolls queued first messages back to ready when enqueue fails', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'ready' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      mailboxes: [createMailbox({ id: 'mailbox-1' })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          mailboxId: 'mailbox-1',
          status: 'ready_to_send'
        })
      ],
      messages: [
        createMessage({
          id: 'message-1',
          enrollmentId: 'enrollment-1',
          mailboxId: 'mailbox-1',
          status: 'draft_ready'
        })
      ]
    });
    const service = new CrmService(store, undefined, undefined, createSendQueue(new Error('queue down')));

    await assert.rejects(() => service.startFirstMessageSend('enrollment-1', createContext()), /queue down/);
    assert.equal(store.enrollments[0].status, 'ready_to_send');
    assert.equal(store.messages[0].status, 'draft_ready');
    assert.equal(store.accounts[0].status, 'ready');
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'message_send_failed');
  });

  it('lets organization admins stop member sequences without editing or sending drafts', async () => {
    const store = createStore([createAccount({ id: 'account-1', ownerUserId: 'user-2', status: 'sequence_running' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', ownerUserId: 'user-2' })],
      mailboxes: [createMailbox({ id: 'mailbox-1', ownerUserId: 'user-2' })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          mailboxId: 'mailbox-1',
          ownerUserId: 'user-2',
          status: 'sequence_running',
          runVersion: 3
        })
      ],
      messages: [
        createMessage({
          id: 'message-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          enrollmentId: 'enrollment-1',
          mailboxId: 'mailbox-1',
          ownerUserId: 'user-2',
          status: 'queued',
          bullJobId: 'send-job-1'
        })
      ]
    });
    const service = new CrmService(store);

    const result = await service.stopSequenceEnrollment('enrollment-1', createContext({ organizationRole: 'admin' }));

    assert.equal(result.enrollment.status, 'stopped');
    assert.equal(result.enrollment.runVersion, 4);
    assert.equal(result.message?.status, 'skipped');
    assert.equal(result.message?.bullJobId, null);
    assert.equal(result.account.status, 'paused');
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'sequence_stopped');
  });

  it('rejects stopping already terminal sequences', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'paused' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          status: 'stopped'
        })
      ]
    });
    const service = new CrmService(store);

    await assert.rejects(() => service.stopSequenceEnrollment('enrollment-1', createContext()), BadRequestException);
  });

  it('mock-ingests a customer reply and stops the current sequence', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'sequence_running' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', email: 'ali@example.com' })],
      mailboxes: [createMailbox({ id: 'mailbox-1' })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          mailboxId: 'mailbox-1',
          status: 'sequence_running',
          runVersion: 3
        })
      ],
      messages: [
        createMessage({
          id: 'message-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          enrollmentId: 'enrollment-1',
          mailboxId: 'mailbox-1',
          status: 'sent',
          sentAt: new Date('2026-06-18T10:00:00.000Z')
        })
      ]
    });
    const service = new CrmService(store);

    const result = await service.mockCustomerReply(
      'message-1',
      {
        subject: ' Interested ',
        bodyText: ' Please send details. ',
        receivedAt: '2026-06-18T11:00:00.000Z'
      },
      createContext()
    );

    assert.equal(result.thread.status, 'pending');
    assert.equal(result.messages[0].bodyText, 'Please send details.');
    assert.equal(store.accounts[0].status, 'replied_pending');
    assert.equal(store.enrollments[0].status, 'replied');
    assert.equal(store.enrollments[0].runVersion, 4);
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'customer_replied');
  });

  it('lists inbox threads with member ownership isolation', async () => {
    const store = createStore(
      [
        createAccount({ id: 'own-account', ownerUserId: 'user-1', name: 'Own Account' }),
        createAccount({ id: 'peer-account', ownerUserId: 'user-2', name: 'Peer Account' })
      ],
      {
        contacts: [
          createContact({ id: 'own-contact', accountId: 'own-account', ownerUserId: 'user-1' }),
          createContact({ id: 'peer-contact', accountId: 'peer-account', ownerUserId: 'user-2' })
        ],
        inboxThreads: [
          createInboxThread({
            id: 'own-thread',
            accountId: 'own-account',
            contactId: 'own-contact',
            ownerUserId: 'user-1',
            subject: 'Own reply'
          }),
          createInboxThread({
            id: 'peer-thread',
            accountId: 'peer-account',
            contactId: 'peer-contact',
            ownerUserId: 'user-2',
            subject: 'Peer reply'
          })
        ],
        inboxMessages: [
          createInboxMessage({
            id: 'own-message',
            threadId: 'own-thread',
            accountId: 'own-account',
            contactId: 'own-contact'
          }),
          createInboxMessage({
            id: 'peer-message',
            threadId: 'peer-thread',
            accountId: 'peer-account',
            contactId: 'peer-contact',
            ownerUserId: 'user-2'
          })
        ]
      }
    );
    const service = new CrmService(store);

    const memberResult = await service.listInboxThreads(createContext());
    const adminResult = await service.listInboxThreads(createContext({ organizationRole: 'admin' }));

    assert.deepEqual(
      memberResult.records.map(record => record.id),
      ['own-thread']
    );
    assert.deepEqual(
      adminResult.records.map(record => record.id),
      ['own-thread', 'peer-thread']
    );
  });

  it('rejects member handling inbox threads owned by another user', async () => {
    const store = createStore([createAccount({ id: 'peer-account', ownerUserId: 'user-2' })], {
      contacts: [createContact({ id: 'peer-contact', accountId: 'peer-account', ownerUserId: 'user-2' })],
      inboxThreads: [
        createInboxThread({
          id: 'peer-thread',
          accountId: 'peer-account',
          contactId: 'peer-contact',
          ownerUserId: 'user-2'
        })
      ]
    });
    const service = new CrmService(store);

    await assert.rejects(
      () => service.updateInboxThreadStatus('peer-thread', { status: 'handled' }, createContext()),
      NotFoundException
    );
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
    mailboxes?: TestMailbox[];
    productLines?: TestProductLine[];
    enrollments?: TestEnrollment[];
    messages?: TestMessage[];
    inboxThreads?: TestInboxThread[];
    inboxMessages?: TestInboxMessage[];
  } = {}
): CrmStore & {
  accounts: TestAccount[];
  contacts: TestContact[];
  timelineEvents: TestTimelineEvent[];
  mailboxes: TestMailbox[];
  productLines: TestProductLine[];
  enrollments: TestEnrollment[];
  messages: TestMessage[];
  inboxThreads: TestInboxThread[];
  inboxMessages: TestInboxMessage[];
  mailboxUpdateCalls: Array<{ id: string; input: Parameters<CrmStore['updateMailbox']>[1] }>;
  productLineUpdateCalls: Array<{ id: string; organizationId: string; input: Partial<TestProductLine> }>;
  enrollmentUpdateCalls: Array<{ id: string; organizationId: string; input: Partial<TestEnrollment> }>;
  messageUpdateCalls: Array<{ id: string; organizationId: string; input: Partial<TestMessage> }>;
  lastListArgs?: Parameters<CrmStore['listAccounts']>[0];
  lastDetailArgs?: Parameters<CrmStore['getAccountDetail']>[0];
  lastContactArgs?: Parameters<CrmStore['findContactById']>[0];
  lastMailboxListArgs?: Parameters<CrmStore['listMailboxes']>[0];
  lastMailboxDetailArgs?: Parameters<CrmStore['findMailboxById']>[0];
  lastProductLineListArgs?: {
    organizationId: string;
    keyword?: string;
    status?: TestProductLine['status'];
    skip: number;
    take: number;
  };
  lastProductLineDetailArgs?: { id: string; organizationId: string };
  lastSequenceReviewListArgs?: Parameters<CrmStore['listSequenceReviewItems']>[0];
  lastSequenceReviewDetailArgs?: Parameters<CrmStore['getSequenceReviewItem']>[0];
  lastMessageDetailArgs?: Parameters<CrmStore['findMessageById']>[0];
} {
  const accounts = [...initialAccounts];
  const contacts: TestContact[] = [...(initialData.contacts ?? [])];
  const timelineEvents: TestTimelineEvent[] = [...(initialData.timelineEvents ?? [])];
  const mailboxes: TestMailbox[] = [...(initialData.mailboxes ?? [])];
  const productLines: TestProductLine[] = [...(initialData.productLines ?? [])];
  const enrollments: TestEnrollment[] = [...(initialData.enrollments ?? [])];
  const messages: TestMessage[] = [...(initialData.messages ?? [])];
  const inboxThreads: TestInboxThread[] = [...(initialData.inboxThreads ?? [])];
  const inboxMessages: TestInboxMessage[] = [...(initialData.inboxMessages ?? [])];
  const mailboxUpdateCalls: Array<{ id: string; input: Parameters<CrmStore['updateMailbox']>[1] }> = [];
  const productLineUpdateCalls: Array<{ id: string; organizationId: string; input: Partial<TestProductLine> }> = [];
  const enrollmentUpdateCalls: Array<{ id: string; organizationId: string; input: Partial<TestEnrollment> }> = [];
  const messageUpdateCalls: Array<{ id: string; organizationId: string; input: Partial<TestMessage> }> = [];

  return {
    accounts,
    contacts,
    timelineEvents,
    mailboxes,
    productLines,
    enrollments,
    messages,
    inboxThreads,
    inboxMessages,
    mailboxUpdateCalls,
    productLineUpdateCalls,
    enrollmentUpdateCalls,
    messageUpdateCalls,
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
    async findContactById(args) {
      this.lastContactArgs = args;
      return (
        contacts.find(contact => {
          if (contact.id !== args.id) return false;
          if (contact.organizationId !== args.organizationId) return false;
          if (args.ownerUserId && contact.ownerUserId !== args.ownerUserId) return false;
          return true;
        }) || null
      );
    },
    async updateContactEmailStatus(id, emailStatus) {
      const contact = contacts.find(item => item.id === id);
      if (!contact) return null;
      Object.assign(contact, { emailStatus, updatedAt: new Date('2026-06-18T10:00:00.000Z') });
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
    },
    async findMailboxByProviderAndEmailHash(provider, emailHash) {
      return mailboxes.find(mailbox => mailbox.provider === provider && mailbox.emailHash === emailHash) || null;
    },
    async createMailbox(input) {
      const mailbox = createMailbox({
        ...input,
        id: `mailbox-${mailboxes.length + 1}`,
        authorizedAt: new Date('2026-06-18T09:00:00.000Z'),
        createdAt: new Date('2026-06-18T09:00:00.000Z'),
        updatedAt: new Date('2026-06-18T09:00:00.000Z')
      });
      mailboxes.push(mailbox);
      return mailbox;
    },
    async listMailboxes(args) {
      this.lastMailboxListArgs = args;
      const records = mailboxes.filter(mailbox => {
        if (mailbox.organizationId !== args.organizationId) return false;
        if (args.ownerUserId && mailbox.ownerUserId !== args.ownerUserId) return false;
        if (args.status && mailbox.status !== args.status) return false;
        if (args.keyword && !mailbox.emailAddress.includes(args.keyword.toLowerCase())) return false;
        return true;
      });
      return { records, total: records.length };
    },
    async findMailboxById(args) {
      this.lastMailboxDetailArgs = args;
      return (
        mailboxes.find(mailbox => {
          if (mailbox.id !== args.id) return false;
          if (mailbox.organizationId !== args.organizationId) return false;
          if (args.ownerUserId && mailbox.ownerUserId !== args.ownerUserId) return false;
          return true;
        }) || null
      );
    },
    async updateMailbox(id, input) {
      mailboxUpdateCalls.push({ id, input });
      const mailbox = mailboxes.find(item => item.id === id);
      if (!mailbox) return null;
      Object.assign(mailbox, input, { updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      return mailbox;
    },
    async listProductLines(args) {
      this.lastProductLineListArgs = args;
      const records = productLines.filter(productLine => {
        if (productLine.organizationId !== args.organizationId) return false;
        if (args.status && productLine.status !== args.status) return false;
        if (!args.keyword) return true;
        const keyword = args.keyword.toLowerCase();
        return [
          productLine.name,
          productLine.targetCustomerType,
          productLine.coreSellingPoints,
          productLine.commonModelsText
        ].some(value => value?.toLowerCase().includes(keyword));
      });

      return {
        records: records.slice(args.skip, args.skip + args.take),
        total: records.length
      };
    },
    async findProductLineByName(organizationId, name) {
      return (
        productLines.find(
          productLine => productLine.organizationId === organizationId && productLine.name === name
        ) ?? null
      );
    },
    async findProductLineById(args) {
      this.lastProductLineDetailArgs = args;
      return (
        productLines.find(
          productLine => productLine.id === args.id && productLine.organizationId === args.organizationId
        ) ?? null
      );
    },
    async createProductLine(input) {
      const productLine = createProductLine({
        ...input,
        id: `product-line-${productLines.length + 1}`
      });
      productLines.push(productLine);
      return productLine;
    },
    async updateProductLine(id, organizationId, input) {
      productLineUpdateCalls.push({ id, organizationId, input });
      const productLine = productLines.find(item => item.id === id && item.organizationId === organizationId);
      if (!productLine) return null;
      Object.assign(productLine, input, { updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      return productLine;
    },
    async findActiveEnrollmentByContact(args) {
      return (
        enrollments.find(
          enrollment =>
            enrollment.organizationId === args.organizationId &&
            enrollment.ownerUserId === args.ownerUserId &&
            enrollment.contactId === args.contactId &&
            args.statuses.includes(enrollment.status)
        ) ?? null
      );
    },
    async createSequenceEnrollment(input) {
      const enrollment = createEnrollment({
        ...input,
        id: `enrollment-${enrollments.length + 1}`
      });
      enrollments.push(enrollment);
      return enrollment;
    },
    async createSequenceDraftBundle(input) {
      const enrollment = createEnrollment({
        ...input.enrollment,
        id: `enrollment-${enrollments.length + 1}`
      });
      const message = createMessage({
        ...input.message,
        id: `message-${messages.length + 1}`,
        enrollmentId: enrollment.id
      });
      const account = accounts.find(item => item.id === input.enrollment.accountId);
      if (!account) throw new Error('account missing');
      Object.assign(account, { status: input.accountStatus, updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      const event = createTimelineEvent({
        ...input.timelineEvent,
        metadata: {
          ...input.timelineEvent.metadata,
          enrollmentId: enrollment.id,
          messageId: message.id
        }
      });
      enrollments.push(enrollment);
      messages.push(message);
      timelineEvents.push(event);

      return { enrollment, message, account, event };
    },
    async listSequenceReviewItems(args) {
      this.lastSequenceReviewListArgs = args;
      const records = buildSequenceReviewRecords(
        enrollments.filter(enrollment => {
          if (enrollment.organizationId !== args.organizationId) return false;
          if (args.ownerUserId && enrollment.ownerUserId !== args.ownerUserId) return false;
          if (args.status && enrollment.status !== args.status) return false;
          if (!args.keyword) return true;
          const keyword = args.keyword.toLowerCase();
          const account = accounts.find(item => item.id === enrollment.accountId);
          const contact = contacts.find(item => item.id === enrollment.contactId);
          return [enrollment.name, account?.name, account?.domain, contact?.fullName, contact?.title].some(value =>
            value?.toLowerCase().includes(keyword)
          );
        }),
        { accounts, contacts, productLines, mailboxes, messages }
      );

      return {
        records: records.slice(args.skip, args.skip + args.take),
        total: records.length
      };
    },
    async getSequenceReviewItem(args) {
      this.lastSequenceReviewDetailArgs = args;
      const enrollment = enrollments.find(item => {
        if (item.id !== args.id) return false;
        if (item.organizationId !== args.organizationId) return false;
        if (args.ownerUserId && item.ownerUserId !== args.ownerUserId) return false;
        return true;
      });
      return enrollment
        ? buildSequenceReviewRecords([enrollment], { accounts, contacts, productLines, mailboxes, messages })[0]
        : null;
    },
    async updateSequenceEnrollment(id, organizationId, input) {
      enrollmentUpdateCalls.push({ id, organizationId, input });
      const enrollment = enrollments.find(item => item.id === id && item.organizationId === organizationId);
      if (!enrollment) return null;
      Object.assign(enrollment, input, { updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      return enrollment;
    },
    async createMessage(input) {
      const message = createMessage({
        ...input,
        id: `message-${messages.length + 1}`
      });
      messages.push(message);
      return message;
    },
    async findMessageById(args) {
      this.lastMessageDetailArgs = args;
      return (
        messages.find(message => {
          if (message.id !== args.id) return false;
          if (message.organizationId !== args.organizationId) return false;
          if (args.ownerUserId && message.ownerUserId !== args.ownerUserId) return false;
          return true;
        }) ?? null
      );
    },
    async updateMessage(id, organizationId, input, guard) {
      messageUpdateCalls.push({ id, organizationId, input });
      const message = messages.find(item => {
        if (item.id !== id || item.organizationId !== organizationId) return false;
        if (guard?.status && item.status !== guard.status) return false;
        return true;
      });
      if (!message) return null;
      Object.assign(message, input, { updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      return message;
    },
    async approveMessageDraft(input) {
      const message = messages.find(
        item =>
          item.id === input.messageId &&
          item.organizationId === input.organizationId &&
          item.ownerUserId === input.ownerUserId &&
          item.status === input.fromMessageStatus
      );
      const enrollment = enrollments.find(
        item =>
          item.id === input.enrollmentId &&
          item.organizationId === input.organizationId &&
          item.ownerUserId === input.ownerUserId &&
          item.status === input.fromEnrollmentStatus
      );
      const account = accounts.find(item => item.id === input.accountId);

      if (!message || !enrollment || !account) return null;

      Object.assign(message, { status: input.toMessageStatus, updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      Object.assign(enrollment, { status: input.toEnrollmentStatus, updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      Object.assign(account, { status: input.accountStatus, updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      const event = createTimelineEvent({
        accountId: input.accountId,
        contactId: input.contactId,
        eventType: 'draft_approved',
        title: '首封开发信人工确认',
        content: message.subject,
        metadata: {
          enrollmentId: enrollment.id,
          messageId: message.id,
          fromStatus: input.fromEnrollmentStatus,
          toStatus: input.toEnrollmentStatus
        }
      });
      timelineEvents.push(event);

      return { enrollment, message, account, event };
    },
    async startFirstMessageSend(input) {
      const enrollment = enrollments.find(
        item =>
          item.id === input.enrollmentId &&
          item.organizationId === input.organizationId &&
          item.ownerUserId === input.ownerUserId &&
          item.status === input.fromEnrollmentStatus
      );
      const message = messages.find(
        item =>
          item.enrollmentId === input.enrollmentId &&
          item.organizationId === input.organizationId &&
          item.ownerUserId === input.ownerUserId &&
          item.stepIndex === 1 &&
          item.status === input.fromMessageStatus
      );
      const account = enrollment ? accounts.find(item => item.id === enrollment.accountId) : null;
      const contact = enrollment ? contacts.find(item => item.id === enrollment.contactId) : null;
      const mailbox = enrollment?.mailboxId ? mailboxes.find(item => item.id === enrollment.mailboxId) : null;

      if (!enrollment || !message || !account || !contact || !mailbox || mailbox.status !== 'active') return null;

      Object.assign(enrollment, { status: input.toEnrollmentStatus, updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      Object.assign(message, {
        status: input.toMessageStatus,
        scheduledAt: input.scheduledAt,
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      });
      Object.assign(account, { status: input.accountStatus, updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      const event = createTimelineEvent({
        accountId: enrollment.accountId,
        contactId: enrollment.contactId,
        eventType: 'message_queued',
        title: '首封开发信进入发送队列',
        content: message.subject,
        metadata: {
          enrollmentId: enrollment.id,
          messageId: message.id,
          runVersion: enrollment.runVersion
        }
      });
      timelineEvents.push(event);

      return { enrollment, message, account, contact, mailbox, event };
    },
    async stopSequenceEnrollment(input) {
      const enrollment = enrollments.find(
        item =>
          item.id === input.enrollmentId &&
          item.organizationId === input.organizationId &&
          input.fromStatuses.includes(item.status)
      );
      const account = enrollment ? accounts.find(item => item.id === enrollment.accountId) : null;

      if (!enrollment || !account) return null;

      const previousRunVersion = enrollment.runVersion;
      Object.assign(enrollment, {
        status: 'stopped',
        runVersion: previousRunVersion + 1,
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      });
      Object.assign(account, { status: input.accountStatus, updatedAt: new Date('2026-06-18T10:00:00.000Z') });

      const message =
        messages.find(
          item =>
            item.enrollmentId === enrollment.id &&
            item.organizationId === input.organizationId &&
            item.stepIndex === 1 &&
            item.status === 'queued'
        ) ?? null;

      if (message) {
        Object.assign(message, {
          status: 'skipped',
          bullJobId: null,
          updatedAt: new Date('2026-06-18T10:00:00.000Z')
        });
      }

      const event = createTimelineEvent({
        accountId: enrollment.accountId,
        contactId: enrollment.contactId,
        ownerUserId: input.actorUserId,
        eventType: 'sequence_stopped',
        title: '开发信序列已停止',
        content: enrollment.name,
        metadata: {
          enrollmentId: enrollment.id,
          fromStatuses: input.fromStatuses,
          toStatus: 'stopped',
          runVersion: enrollment.runVersion
        }
      });
      timelineEvents.push(event);

      return { enrollment, message, account, event };
    },
    async completeFirstMessageSend(input) {
      const enrollment = enrollments.find(
        item =>
          item.id === input.enrollmentId &&
          item.organizationId === input.organizationId &&
          item.ownerUserId === input.ownerUserId &&
          item.runVersion === input.runVersion &&
          item.status === 'sequence_running'
      );
      const message = messages.find(
        item =>
          item.id === input.messageId &&
          item.enrollmentId === input.enrollmentId &&
          item.organizationId === input.organizationId &&
          item.ownerUserId === input.ownerUserId &&
          item.status === 'queued'
      );
      const account = enrollment ? accounts.find(item => item.id === enrollment.accountId) : null;

      if (!enrollment || !message || !account) return null;

      Object.assign(message, { status: 'sent', sentAt: input.sentAt, updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      const event = createTimelineEvent({
        accountId: enrollment.accountId,
        contactId: enrollment.contactId,
        eventType: 'message_sent',
        title: '首封开发信已发送',
        content: message.subject
      });
      timelineEvents.push(event);

      return { enrollment, message, account, event };
    },
    async failFirstMessageSend(input) {
      const enrollment = enrollments.find(
        item =>
          item.id === input.enrollmentId &&
          item.organizationId === input.organizationId &&
          item.ownerUserId === input.ownerUserId &&
          item.runVersion === input.runVersion &&
          item.status === 'sequence_running'
      );
      const message = messages.find(
        item =>
          item.id === input.messageId &&
          item.enrollmentId === input.enrollmentId &&
          item.organizationId === input.organizationId &&
          item.ownerUserId === input.ownerUserId &&
          item.status === 'queued'
      );
      const account = enrollment ? accounts.find(item => item.id === enrollment.accountId) : null;

      if (!enrollment || !message || !account) return null;

      Object.assign(enrollment, { status: 'ready_to_send', updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      Object.assign(message, {
        status: 'draft_ready',
        bullJobId: null,
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      });
      Object.assign(account, { status: 'ready', updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      const event = createTimelineEvent({
        accountId: enrollment.accountId,
        contactId: enrollment.contactId,
        eventType: 'message_send_failed',
        title: '首封开发信发送失败',
        content: input.reason
      });
      timelineEvents.push(event);

      return { enrollment, message, account, event };
    },
    async ingestCustomerReply(input) {
      const outboundMessage = messages.find(
        message =>
          message.id === input.outboundMessageId &&
          message.organizationId === input.organizationId &&
          message.ownerUserId === input.ownerUserId &&
          message.status === 'sent'
      );
      const enrollment = outboundMessage ? enrollments.find(item => item.id === outboundMessage.enrollmentId) : null;
      const account = outboundMessage ? accounts.find(item => item.id === outboundMessage.accountId) : null;
      const contact = outboundMessage ? contacts.find(item => item.id === outboundMessage.contactId) : null;
      const mailbox = outboundMessage?.mailboxId ? mailboxes.find(item => item.id === outboundMessage.mailboxId) : null;

      if (!outboundMessage || !account || !contact) return null;

      const existingThread = inboxThreads.find(
        thread =>
          thread.organizationId === input.organizationId &&
          thread.ownerUserId === input.ownerUserId &&
          thread.accountId === outboundMessage.accountId &&
          thread.contactId === outboundMessage.contactId &&
          thread.enrollmentId === outboundMessage.enrollmentId
      );
      const thread =
        existingThread ??
        createInboxThread({
          id: `inbox-thread-${inboxThreads.length + 1}`,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          accountId: outboundMessage.accountId,
          contactId: outboundMessage.contactId,
          enrollmentId: outboundMessage.enrollmentId,
          mailboxId: outboundMessage.mailboxId,
          providerThreadId: outboundMessage.enrollmentId,
          subject: input.subject,
          unreadCount: 0,
          messageCount: 0,
          lastInboundAt: input.receivedAt
        });

      if (!existingThread) {
        inboxThreads.push(thread);
      }

      Object.assign(thread, {
        subject: input.subject,
        status: 'pending',
        lastInboundAt: input.receivedAt,
        unreadCount: thread.unreadCount + 1,
        messageCount: thread.messageCount + 1,
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      });

      const inboxMessage = createInboxMessage({
        id: `inbox-message-${inboxMessages.length + 1}`,
        threadId: thread.id,
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        accountId: outboundMessage.accountId,
        contactId: outboundMessage.contactId,
        enrollmentId: outboundMessage.enrollmentId,
        mailboxId: outboundMessage.mailboxId,
        replyToMessageId: outboundMessage.id,
        fromEmail: contact.email,
        fromEmailHash: contact.emailHash,
        maskedFromEmail: contact.maskedEmail,
        subject: input.subject,
        snippet: input.bodyText,
        bodyText: input.bodyText,
        receivedAt: input.receivedAt,
        messageType: input.messageType ?? 'customer_reply'
      });
      inboxMessages.push(inboxMessage);
      Object.assign(account, { status: 'replied_pending', updatedAt: new Date('2026-06-18T10:00:00.000Z') });

      if (enrollment && ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused'].includes(enrollment.status)) {
        Object.assign(enrollment, {
          status: 'replied',
          runVersion: enrollment.runVersion + 1,
          updatedAt: new Date('2026-06-18T10:00:00.000Z')
        });
      }

      const event = createTimelineEvent({
        accountId: outboundMessage.accountId,
        contactId: outboundMessage.contactId,
        ownerUserId: input.ownerUserId,
        eventType: 'customer_replied',
        title: '客户回信',
        content: input.subject,
        metadata: {
          enrollmentId: outboundMessage.enrollmentId,
          outboundMessageId: outboundMessage.id,
          inboxThreadId: thread.id,
          inboxMessageId: inboxMessage.id
        }
      });
      timelineEvents.push(event);

      return { thread, message: inboxMessage, account, contact, mailbox: mailbox ?? null, enrollment: enrollment ?? null, event };
    },
    async listInboxThreads(args) {
      const records = inboxThreads
        .filter(thread => {
          if (thread.organizationId !== args.organizationId) return false;
          if (args.ownerUserId && thread.ownerUserId !== args.ownerUserId) return false;
          if (args.status && thread.status !== args.status) return false;
          if (args.mailboxId && thread.mailboxId !== args.mailboxId) return false;
          if (!args.keyword) return true;
          const account = accounts.find(item => item.id === thread.accountId);
          const contact = contacts.find(item => item.id === thread.contactId);
          const keyword = args.keyword.toLowerCase();
          return [thread.subject, account?.name, account?.domain, contact?.fullName, contact?.title, contact?.maskedEmail].some(
            value => value?.toLowerCase().includes(keyword)
          );
        })
        .toSorted((left, right) => right.lastInboundAt.getTime() - left.lastInboundAt.getTime());

      return {
        records: records.slice(args.skip, args.skip + args.take).map(thread =>
          buildInboxThreadListRecord(thread, { accounts, contacts, mailboxes, enrollments, inboxMessages })
        ),
        total: records.length
      };
    },
    async getInboxThread(args) {
      const thread = inboxThreads.find(item => {
        if (item.id !== args.id) return false;
        if (item.organizationId !== args.organizationId) return false;
        if (args.ownerUserId && item.ownerUserId !== args.ownerUserId) return false;
        return true;
      });

      if (!thread) return null;

      return {
        ...buildInboxThreadListRecord(thread, { accounts, contacts, mailboxes, enrollments, inboxMessages }),
        messages: inboxMessages
          .filter(message => message.threadId === thread.id)
          .toSorted((left, right) => left.receivedAt.getTime() - right.receivedAt.getTime()),
        timelineEvents: timelineEvents.filter(event => event.accountId === thread.accountId)
      };
    },
    async updateInboxThreadStatus(input) {
      const thread = inboxThreads.find(item => {
        if (item.id !== input.id) return false;
        if (item.organizationId !== input.organizationId) return false;
        if (item.ownerUserId !== input.ownerUserId) return false;
        if (input.fromStatus && item.status !== input.fromStatus) return false;
        return true;
      });
      const account = thread ? accounts.find(item => item.id === thread.accountId) : null;

      if (!thread || !account) return null;

      Object.assign(thread, {
        status: input.toStatus,
        unreadCount: input.toStatus === 'pending' ? thread.unreadCount : 0,
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      });

      if (input.accountStatus) {
        Object.assign(account, { status: input.accountStatus, updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      }

      const event = createTimelineEvent({
        accountId: thread.accountId,
        contactId: thread.contactId,
        ownerUserId: input.ownerUserId,
        eventType: 'inbox_status_changed',
        title: '收件箱处理状态变更',
        content: thread.subject,
        metadata: {
          threadId: thread.id,
          fromStatus: input.fromStatus ?? null,
          toStatus: input.toStatus
        }
      });
      timelineEvents.push(event);

      return { thread, account, event };
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

function createMailbox(input: Partial<TestMailbox> = {}): TestMailbox {
  return {
    id: input.id || 'mailbox-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    ownerUserName: input.ownerUserName ?? 'Alice',
    provider: input.provider || 'gmail',
    emailAddress: input.emailAddress || 'alice@gmail.com',
    emailHash: input.emailHash || 'hash-1',
    maskedEmail: input.maskedEmail || 'a***@gmail.com',
    status: input.status || 'active',
    dailyLimit: input.dailyLimit ?? 50,
    hourlyLimit: input.hourlyLimit ?? 10,
    warmupStage: input.warmupStage || 'new',
    watchExpiration: input.watchExpiration ?? null,
    lastHistoryId: input.lastHistoryId ?? null,
    authorizedAt: input.authorizedAt || new Date('2026-06-18T09:00:00.000Z'),
    pausedAt: input.pausedAt ?? null,
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createProductLine(input: Partial<TestProductLine> = {}): TestProductLine {
  return {
    id: input.id || 'product-line-1',
    organizationId: input.organizationId || 'org-1',
    name: input.name || 'Bearing Series',
    targetCustomerType: input.targetCustomerType ?? null,
    coreSellingPoints: input.coreSellingPoints ?? null,
    moq: input.moq ?? null,
    leadTime: input.leadTime ?? null,
    paymentTerms: input.paymentTerms ?? null,
    certifications: input.certifications ?? null,
    catalogUrl: input.catalogUrl ?? null,
    websiteUrl: input.websiteUrl ?? null,
    commonModelsText: input.commonModelsText ?? null,
    status: input.status || 'active',
    createdById: input.createdById || 'user-1',
    createdByName: input.createdByName ?? 'Alice',
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createEnrollment(input: Partial<TestEnrollment> = {}): TestEnrollment {
  return {
    id: input.id || 'enrollment-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    accountId: input.accountId || 'account-1',
    contactId: input.contactId || 'contact-1',
    productLineId: input.productLineId ?? null,
    mailboxId: input.mailboxId ?? null,
    name: input.name || 'Account - Ali Hassan',
    status: input.status || 'draft_review_pending',
    currentStep: input.currentStep ?? 1,
    totalSteps: input.totalSteps ?? 5,
    runVersion: input.runVersion ?? 1,
    createdById: input.createdById || 'user-1',
    createdByName: input.createdByName ?? 'Alice',
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createMessage(input: Partial<TestMessage> = {}): TestMessage {
  return {
    id: input.id || 'message-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    accountId: input.accountId || 'account-1',
    contactId: input.contactId || 'contact-1',
    enrollmentId: input.enrollmentId || 'enrollment-1',
    mailboxId: input.mailboxId ?? null,
    stepIndex: input.stepIndex ?? 1,
    threadMode: input.threadMode || 'new_subject',
    subject: input.subject || 'Bearing Series for Account',
    bodyText: input.bodyText || 'Hi Ali,\n\nWould it be useful if I sent a short product list?\n\nBest regards,\nAlice',
    status: input.status || 'draft_pending_review',
    scheduledAt: input.scheduledAt ?? null,
    sentAt: input.sentAt ?? null,
    bullJobId: input.bullJobId ?? null,
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createInboxThread(input: Partial<TestInboxThread> = {}): TestInboxThread {
  return {
    id: input.id || 'inbox-thread-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    accountId: input.accountId || 'account-1',
    contactId: input.contactId || 'contact-1',
    enrollmentId: input.enrollmentId ?? 'enrollment-1',
    mailboxId: input.mailboxId ?? 'mailbox-1',
    provider: input.provider || 'gmail',
    providerThreadId: input.providerThreadId ?? 'enrollment-1',
    subject: input.subject || 'Re: Bearing Series for Account',
    status: input.status || 'pending',
    lastInboundAt: input.lastInboundAt || new Date('2026-06-18T11:00:00.000Z'),
    unreadCount: input.unreadCount ?? 1,
    messageCount: input.messageCount ?? 1,
    createdAt: input.createdAt || new Date('2026-06-18T11:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T11:00:00.000Z')
  };
}

function createInboxMessage(input: Partial<TestInboxMessage> = {}): TestInboxMessage {
  return {
    id: input.id || 'inbox-message-1',
    threadId: input.threadId || 'inbox-thread-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    accountId: input.accountId || 'account-1',
    contactId: input.contactId || 'contact-1',
    enrollmentId: input.enrollmentId ?? 'enrollment-1',
    mailboxId: input.mailboxId ?? 'mailbox-1',
    provider: input.provider || 'gmail',
    providerMessageId: input.providerMessageId ?? null,
    replyToMessageId: input.replyToMessageId ?? 'message-1',
    fromEmail: input.fromEmail || 'ali@example.com',
    fromEmailHash: input.fromEmailHash || hashTestEmail('ali@example.com'),
    maskedFromEmail: input.maskedFromEmail || 'a***@example.com',
    subject: input.subject || 'Re: Bearing Series for Account',
    snippet: input.snippet ?? 'Please send details.',
    bodyText: input.bodyText || 'Please send details.',
    receivedAt: input.receivedAt || new Date('2026-06-18T11:00:00.000Z'),
    messageType: input.messageType || 'customer_reply',
    createdAt: input.createdAt || new Date('2026-06-18T11:00:00.000Z')
  };
}

function buildSequenceReviewRecords(
  enrollments: TestEnrollment[],
  data: {
    accounts: TestAccount[];
    contacts: TestContact[];
    productLines: TestProductLine[];
    mailboxes: TestMailbox[];
    messages: TestMessage[];
  }
): CrmSequenceReviewRecord[] {
  return enrollments.map(enrollment => ({
    enrollment,
    account: data.accounts.find(account => account.id === enrollment.accountId) || createAccount({ id: enrollment.accountId }),
    contact: data.contacts.find(contact => contact.id === enrollment.contactId) || createContact({ id: enrollment.contactId }),
    productLine: enrollment.productLineId
      ? data.productLines.find(productLine => productLine.id === enrollment.productLineId) || null
      : null,
    mailbox: enrollment.mailboxId ? data.mailboxes.find(mailbox => mailbox.id === enrollment.mailboxId) || null : null,
    firstMessage:
      data.messages.find(message => message.enrollmentId === enrollment.id && message.stepIndex === 1) || null
  }));
}

function buildInboxThreadListRecord(
  thread: TestInboxThread,
  data: {
    accounts: TestAccount[];
    contacts: TestContact[];
    mailboxes: TestMailbox[];
    enrollments: TestEnrollment[];
    inboxMessages: TestInboxMessage[];
  }
) {
  return {
    thread,
    account: data.accounts.find(account => account.id === thread.accountId) || createAccount({ id: thread.accountId }),
    contact: data.contacts.find(contact => contact.id === thread.contactId) || createContact({ id: thread.contactId }),
    mailbox: thread.mailboxId ? data.mailboxes.find(mailbox => mailbox.id === thread.mailboxId) || null : null,
    enrollment: thread.enrollmentId
      ? data.enrollments.find(enrollment => enrollment.id === thread.enrollmentId) || null
      : null,
    lastMessage:
      data.inboxMessages
        .filter(message => message.threadId === thread.id)
        .toSorted((left, right) => right.receivedAt.getTime() - left.receivedAt.getTime())[0] ?? null
  };
}

type TestAccount = Awaited<ReturnType<CrmStore['createAccount']>>;
type TestContact = Awaited<ReturnType<CrmStore['createContact']>>;
type TestTimelineEvent = Awaited<ReturnType<CrmStore['createTimelineEvent']>>;
type TestMailbox = CrmMailboxRecord;
type TestEnrollment = Awaited<ReturnType<CrmStore['createSequenceEnrollment']>>;
type TestMessage = Awaited<ReturnType<CrmStore['createMessage']>>;
type TestInboxThread = CrmInboxThreadRecord;
type TestInboxMessage = CrmInboxMessageRecord;

interface TestProductLine {
  id: string;
  organizationId: string;
  name: string;
  targetCustomerType: string | null;
  coreSellingPoints: string | null;
  moq: string | null;
  leadTime: string | null;
  paymentTerms: string | null;
  certifications: string | null;
  catalogUrl: string | null;
  websiteUrl: string | null;
  commonModelsText: string | null;
  status: 'active' | 'archived';
  createdById: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function createDnsResolver(result: Array<{ exchange: string; priority: number }> | Error) {
  return {
    calls: [] as string[],
    async resolveMx(domain: string) {
      this.calls.push(domain);

      if (result instanceof Error) {
        throw result;
      }

      return result;
    }
  };
}

function createDnsError(code: string) {
  return Object.assign(new Error(code), { code });
}

function createSendQueue(error?: Error): CrmSendQueuePort & { jobs: CrmSendQueueJob[] } {
  const jobs: CrmSendQueueJob[] = [];

  return {
    jobs,
    async enqueueFirstMessage(input) {
      if (error) {
        throw error;
      }

      jobs.push(input);
      return { jobId: `send-job-${jobs.length}` };
    }
  };
}

function hashTestEmail(email: string) {
  return createHash('sha256').update(email).digest('hex');
}

function createPrismaUniqueError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test'
  });
}

function createLogRecorder() {
  const records: SystemLogRecordInput[] = [];

  return {
    records,
    service: {
      async record(input: SystemLogRecordInput) {
        records.push(input);
      }
    } satisfies SystemLogRecorder
  };
}
