import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { SystemLogRecordInput, SystemLogRecorder } from '../system-log/system-log.types';
import type { CrmGmailOAuthFlowPort, CrmGmailOAuthStatePayload } from './crm-gmail-oauth-flow';
import { CrmGmailWatchService } from './crm-gmail-watch.service';
import { CrmService } from './crm.service';
import type {
  CrmArchivedFingerprintRecord,
  CrmBlacklistRecord,
  CrmEmailTemplateGroupRecord,
  CrmEmailVerificationCacheRecord,
  CrmGlobalConfigRecord,
  CrmInboxMessageRecord,
  CrmInboxThreadRecord,
  CrmMailboxRecord,
  CrmEmailSendGateway,
  CrmOrganizationConfigRecord,
  CrmSendQueueJob,
  CrmSendQueuePort,
  CrmSequencePolicyRecord,
  CrmSequenceReviewRecord,
  CrmStore,
  CrmUserContext
} from './crm.types';

describe('CrmService', () => {
  it('imports one lead account and contact with organization scoped dedupe', async () => {
    const store = createStore();
    const service = new CrmService(store, {
      async resolveMx() {
        return [{ exchange: 'mx.abc-bearing.example' }];
      }
    });
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
    assert.equal(
      store.timelineEvents.map(event => event.eventType).join(','),
      'account_imported,contact_imported,email_verified'
    );
  });

  it('auto verifies imported personal contact email by MX lookup', async () => {
    const store = createStore();
    const service = new CrmService(store, {
      async resolveMx(domain) {
        assert.equal(domain, 'buyer.example');

        return [{ exchange: 'mx.buyer.example' }];
      }
    });

    const result = await service.importAccountFromLead(
      {
        name: 'Buyer Inc',
        websiteUrl: 'https://buyer.example',
        contact: {
          fullName: 'Alice Buyer',
          title: 'Purchasing Manager',
          email: 'alice@buyer.example'
        }
      },
      createContext()
    );

    assert.equal(result.contact?.emailStatus, 'valid');
    assert.equal(store.contacts[0].emailStatus, 'valid');
    assert.equal(store.timelineEvents.some(event => event.eventType === 'email_verified'), true);
  });

  it('reuses fresh global email verification cache across owners', async () => {
    const store = createStore();
    const dnsResolver = createDnsResolver([{ exchange: 'mx.buyer.example', priority: 10 }]);
    const service = new CrmService(store, dnsResolver);

    await service.importAccountFromLead(
      {
        name: 'Buyer Inc',
        websiteUrl: 'https://buyer.example',
        contact: {
          fullName: 'Alice Buyer',
          title: 'Purchasing Manager',
          email: 'alice@buyer.example'
        }
      },
      createContext({ userId: 'user-1' })
    );
    const second = await service.importAccountFromLead(
      {
        name: 'Buyer Inc',
        websiteUrl: 'https://buyer.example',
        contact: {
          fullName: 'Alice Buyer',
          title: 'Purchasing Manager',
          email: 'alice@buyer.example'
        }
      },
      createContext({ userId: 'user-2' })
    );

    assert.deepEqual(dnsResolver.calls, ['buyer.example']);
    assert.equal(store.contacts.length, 2);
    assert.equal(store.emailVerificationCaches.length, 1);
    assert.equal(second.contact?.emailStatus, 'valid');
    assert.equal((store.timelineEvents.at(-1)?.metadata as { cacheHit?: boolean } | undefined)?.cacheHit, true);
  });

  it('reuses fresh global email verification cache across organizations', async () => {
    const store = createStore([], {
      emailVerificationCaches: [
        createEmailVerificationCache({
          emailHash: hashTestEmail('alice@buyer.example'),
          maskedEmail: 'a***@buyer.example',
          domain: 'buyer.example',
          status: 'valid',
          reason: 'mx_found',
          checkedById: 'user-1',
          checkedByName: 'Alice'
        })
      ]
    });
    const dnsResolver = createDnsResolver([]);
    const service = new CrmService(store, dnsResolver);

    const result = await service.importAccountFromLead(
      {
        name: 'Buyer Inc',
        websiteUrl: 'https://buyer.example',
        contact: {
          fullName: 'Alice Buyer',
          title: 'Purchasing Manager',
          email: 'alice@buyer.example'
        }
      },
      createContext({ organizationId: 'org-2', userId: 'user-9' })
    );

    assert.equal(result.contact?.emailStatus, 'valid');
    assert.equal(dnsResolver.calls.length, 0);
    assert.equal((store.timelineEvents.at(-1)?.metadata as { cacheHit?: boolean } | undefined)?.cacheHit, true);
  });

  it('reads and saves organization CRM permission config by organization administrators', async () => {
    const store = createStore();
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service);
    const adminContext = createContext({ organizationRole: 'admin' });

    const current = await service.getOrganizationConfig(createContext());
    const saved = await service.saveOrganizationConfig({ allowAdminViewMemberEmailBody: true }, adminContext);

    assert.equal(current.allowAdminViewMemberEmailBody, false);
    assert.equal(current.updatedAt, null);
    assert.equal(saved.allowAdminViewMemberEmailBody, true);
    assert.equal(store.organizationConfig?.organizationId, 'org-1');
    assert.equal(logs.records[0]?.action, 'save-organization-config');
    await assert.rejects(
      () => service.saveOrganizationConfig({ allowAdminViewMemberEmailBody: false }, createContext()),
      ForbiddenException
    );
  });

  it('refreshes stale global email verification cache after cooldown', async () => {
    const store = createStore([], {
      emailVerificationCaches: [
        createEmailVerificationCache({
          emailHash: hashTestEmail('alice@buyer.example'),
          maskedEmail: 'a***@buyer.example',
          domain: 'buyer.example',
          status: 'invalid',
          reason: 'no_mx',
          verifiedAt: new Date('2026-05-01T00:00:00.000Z'),
          expiresAt: new Date('2026-05-31T00:00:00.000Z')
        })
      ]
    });
    const dnsResolver = createDnsResolver([{ exchange: 'mx.buyer.example', priority: 10 }]);
    const service = new CrmService(store, dnsResolver);

    const result = await service.importAccountFromLead(
      {
        name: 'Buyer Inc',
        websiteUrl: 'https://buyer.example',
        contact: {
          fullName: 'Alice Buyer',
          title: 'Purchasing Manager',
          email: 'alice@buyer.example'
        }
      },
      createContext()
    );

    assert.deepEqual(dnsResolver.calls, ['buyer.example']);
    assert.equal(result.contact?.emailStatus, 'valid');
    assert.equal(store.emailVerificationCaches[0].status, 'valid');
    assert.equal(store.emailVerificationCaches[0].reason, 'mx_found');
    assert.equal(store.emailVerificationCaches[0].expiresAt.getTime() > Date.now(), true);
  });

  it('uses configured CRM email verification cooldown when deciding cache freshness', async () => {
    const store = createStore([], {
      globalConfig: createGlobalConfig({ emailVerificationCooldownDays: 60 }),
      emailVerificationCaches: [
        createEmailVerificationCache({
          emailHash: hashTestEmail('alice@buyer.example'),
          maskedEmail: 'a***@buyer.example',
          domain: 'buyer.example',
          status: 'valid',
          reason: 'mx_found',
          verifiedAt: new Date('2026-05-15T00:00:00.000Z'),
          expiresAt: new Date('2026-06-14T00:00:00.000Z')
        })
      ]
    });
    const dnsResolver = createDnsResolver([]);
    const service = new CrmService(store, dnsResolver);

    const result = await service.importAccountFromLead(
      {
        name: 'Buyer Inc',
        websiteUrl: 'https://buyer.example',
        contact: {
          fullName: 'Alice Buyer',
          title: 'Purchasing Manager',
          email: 'alice@buyer.example'
        }
      },
      createContext()
    );

    assert.equal(result.contact?.emailStatus, 'valid');
    assert.equal(dnsResolver.calls.length, 0);
    assert.equal((store.timelineEvents.at(-1)?.metadata as { cacheHit?: boolean } | undefined)?.cacheHit, true);
  });

  it('keeps imported public mailbox in risky review without querying MX', async () => {
    const store = createStore();
    const service = new CrmService(store, {
      async resolveMx() {
        throw new Error('public mailbox should not query DNS');
      }
    });

    const result = await service.importAccountFromLead(
      {
        name: 'Buyer Inc',
        websiteUrl: 'https://buyer.example',
        contact: {
          fullName: null,
          title: null,
          email: 'info@buyer.example'
        }
      },
      createContext()
    );

    assert.equal(result.contact?.isPublicEmail, true);
    assert.equal(result.contact?.emailStatus, 'risky');
    assert.equal(store.accounts[0].status, 'manual_review_pending');
    assert.equal(store.timelineEvents.some(event => event.eventType === 'email_verified'), true);
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

  it('records a timeline warning when importing an account that matches organization archived fingerprints', async () => {
    const store = createStore([], {
      archivedFingerprints: [
        createArchivedFingerprint({
          organizationId: 'org-1',
          fingerprintType: 'domain',
          fingerprintValue: 'buyer.example',
          maskedValue: 'buyer.example',
          accountName: 'Archived Buyer'
        })
      ]
    });
    const service = new CrmService(store, createDnsResolver([]));

    const result = await service.importAccountFromLead(
      {
        name: 'Buyer Inc',
        websiteUrl: 'https://buyer.example',
        contact: {
          fullName: 'Alice Buyer',
          title: 'Purchasing Manager',
          email: 'alice@buyer.example'
        }
      },
      createContext()
    );

    assert.equal(result.account.domain, 'buyer.example');
    assert.equal(store.timelineEvents.some(event => event.eventType === 'archived_fingerprint_matched'), true);
    assert.deepEqual(store.timelineEvents.find(event => event.eventType === 'archived_fingerprint_matched')?.metadata, {
      matchedFingerprints: [
        {
          fingerprintType: 'domain',
          maskedValue: 'buyer.example',
          archivedAt: '2026-06-18T09:00:00.000Z',
          accountName: 'Archived Buyer'
        }
      ]
    });
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
    const store = createStore([createAccount({ id: 'account-1', status: 'ready', domain: 'buyer.example' })], {
      contacts: [
        createContact({
          id: 'contact-1',
          accountId: 'account-1',
          email: 'alice@buyer.example',
          emailHash: hashTestEmail('alice@buyer.example'),
          maskedEmail: 'a***@buyer.example'
        })
      ]
    });
    const service = new CrmService(store);

    const result = await service.archiveAccount('account-1', { reason: '  Not a fit  ' }, createContext());

    assert.equal(result.account.status, 'archived');
    assert.equal(result.account.archiveReason, 'Not a fit');
    assert.match(result.account.archivedAt ?? '', /^20/);
    assert.deepEqual(
      store.archivedFingerprints.map(fingerprint => ({
        fingerprintType: fingerprint.fingerprintType,
        fingerprintValue: fingerprint.fingerprintValue,
        maskedValue: fingerprint.maskedValue,
        archiveReason: fingerprint.archiveReason
      })),
      [
        {
          fingerprintType: 'domain',
          fingerprintValue: 'buyer.example',
          maskedValue: 'buyer.example',
          archiveReason: 'Not a fit'
        },
        {
          fingerprintType: 'email_hash',
          fingerprintValue: hashTestEmail('alice@buyer.example'),
          maskedValue: 'a***@buyer.example',
          archiveReason: 'Not a fit'
        }
      ]
    );
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'account_archived');
    assert.equal(store.timelineEvents.at(-1)?.title, '归档线索');
    assert.equal(store.timelineEvents.at(-1)?.content, 'Not a fit');
    assert.deepEqual(store.timelineEvents.at(-1)?.metadata, {
      fromStatus: 'ready',
      toStatus: 'archived'
    });
  });

  it('restores archived accounts inside the recovery window', async () => {
    const store = createStore([
      createAccount({
        id: 'account-1',
        status: 'archived',
        archivedAt: new Date(),
        archiveReason: 'Not a fit'
      })
    ]);
    const service = new CrmService(store);

    const result = await service.restoreAccount('account-1', createContext());

    assert.equal(result.account.status, 'candidate');
    assert.equal(result.account.archivedAt, null);
    assert.equal(result.account.archiveReason, null);
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'account_restored');
    assert.deepEqual(store.timelineEvents.at(-1)?.metadata, {
      fromStatus: 'archived',
      toStatus: 'candidate'
    });
  });

  it('rejects restoring archived accounts after the recovery window', async () => {
    const store = createStore([
      createAccount({
        id: 'account-1',
        status: 'archived',
        archivedAt: new Date('2026-01-01T00:00:00.000Z')
      })
    ]);
    const service = new CrmService(store);

    await assert.rejects(() => service.restoreAccount('account-1', createContext()), BadRequestException);
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
      reason: 'mx_found',
      cacheHit: false
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
        reason: 'mx_found',
        cacheHit: false
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

  it('marks public role mailboxes risky without querying DNS during manual verification', async () => {
    const store = createStore([createAccount({ id: 'account-1' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', email: 'sales@example.com' })]
    });
    const resolver = createDnsResolver([]);
    const service = new CrmService(store, resolver);

    const result = await service.verifyContactEmail('contact-1', createContext());

    assert.equal(result.contact.emailStatus, 'risky');
    assert.equal(resolver.calls.length, 0);
    assert.equal((store.timelineEvents.at(-1)?.metadata as { reason: string } | undefined)?.reason, 'public_email');
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

  it('creates a Gmail OAuth URL bound to the current user context', () => {
    const flow = createOAuthFlow();
    const service = new CrmService(createStore(), undefined, undefined, undefined, undefined, undefined, flow);

    const result = service.createGmailOAuthAuthorizationUrl(createContext());

    assert.equal(result.authorizationUrl, 'https://accounts.google.com/o/oauth2/v2/auth?state=state-1');
    assert.deepEqual(flow.createUrlCalls[0], {
      organizationId: 'org-1',
      userId: 'user-1'
    });
  });

  it('completes Gmail OAuth authorization and stores only the encrypted refresh token', async () => {
    const store = createStore();
    const logs = createLogRecorder();
    const flow = createOAuthFlow({
      mailbox: {
        emailAddress: 'Alice@Gmail.COM',
        historyId: '1001',
        encryptedRefreshToken: 'encrypted-refresh-token-1'
      }
    });
    const service = new CrmService(store, undefined, logs.service, undefined, undefined, undefined, flow);

    const result = await service.completeGmailOAuthAuthorization({ code: 'code-1', state: 'state-1' }, createContext());

    assert.equal(result.mailbox.emailAddress, 'alice@gmail.com');
    assert.equal(result.mailbox.lastHistoryId, '1001');
    assert.equal('encryptedRefreshToken' in result.mailbox, false);
    assert.equal(store.mailboxes[0].encryptedRefreshToken, 'encrypted-refresh-token-1');
    assert.equal(flow.verifyStateCalls[0]?.state, 'state-1');
    assert.deepEqual(flow.verifyStateCalls[0]?.context, { organizationId: 'org-1', userId: 'user-1' });
    assert.equal(flow.exchangeCodeCalls[0], 'code-1');
    assert.deepEqual(logs.records[0].metadata, {
      organizationId: 'org-1',
      mailboxId: 'mailbox-1',
      provider: 'gmail',
      maskedEmail: 'a***@gmail.com',
      fromStatus: null,
      toStatus: 'active'
    });
  });

  it('renews Gmail watch immediately after completing OAuth authorization', async () => {
    const store = createStore();
    const flow = createOAuthFlow({
      mailbox: {
        emailAddress: 'alice@gmail.com',
        historyId: '1001',
        encryptedRefreshToken: 'encrypted-refresh-token-1'
      }
    });
    const watchService = new CrmGmailWatchService(store, {
      async renewWatch() {
        return {
          historyId: '1500',
          watchExpiration: new Date('2026-06-26T08:00:00.000Z')
        };
      }
    });
    const service = new CrmService(store, undefined, undefined, undefined, undefined, undefined, flow, watchService);

    const result = await service.completeGmailOAuthAuthorization({ code: 'code-1', state: 'state-1' }, createContext());

    assert.ok('watch' in result);
    assert.deepEqual(result.watch, {
      historyId: '1500',
      watchExpiration: '2026-06-26T08:00:00.000Z'
    });
    assert.equal(result.mailbox.lastHistoryId, '1500');
    assert.equal(result.mailbox.watchExpiration, '2026-06-26T08:00:00.000Z');
    assert.equal(store.mailboxes[0].lastHistoryId, '1500');
    assert.equal(store.mailboxUpdateCalls[0]?.input.lastHistoryId, '1500');
  });

  it('updates the current user mailbox when completing Gmail OAuth for an existing address', async () => {
    const existingMailbox = createMailbox({
      id: 'mailbox-existing',
      emailAddress: 'alice@gmail.com',
      emailHash: hashTestEmail('alice@gmail.com'),
      encryptedRefreshToken: null,
      status: 'auth_expired'
    });
    const store = createStore([], { mailboxes: [existingMailbox] });
    const flow = createOAuthFlow({
      mailbox: {
        emailAddress: 'alice@gmail.com',
        historyId: '2002',
        encryptedRefreshToken: 'encrypted-refresh-token-2'
      }
    });
    const service = new CrmService(store, undefined, undefined, undefined, undefined, undefined, flow);

    const result = await service.completeGmailOAuthAuthorization({ code: 'code-2', state: 'state-2' }, createContext());

    assert.equal(result.mailbox.id, 'mailbox-existing');
    assert.equal(result.mailbox.status, 'active');
    assert.equal(store.mailboxes.length, 1);
    assert.equal(store.mailboxes[0].encryptedRefreshToken, 'encrypted-refresh-token-2');
    assert.equal(store.mailboxUpdateCalls[0]?.input.lastHistoryId, '2002');
  });

  it('rejects Gmail OAuth authorization when the Gmail address belongs to another owner', async () => {
    const peerMailbox = createMailbox({
      id: 'peer-mailbox',
      organizationId: 'org-2',
      ownerUserId: 'user-2',
      emailAddress: 'alice@gmail.com',
      emailHash: hashTestEmail('alice@gmail.com')
    });
    const store = createStore([], { mailboxes: [peerMailbox] });
    const logs = createLogRecorder();
    const service = new CrmService(
      store,
      undefined,
      logs.service,
      undefined,
      undefined,
      undefined,
      createOAuthFlow({
        mailbox: {
          emailAddress: 'alice@gmail.com',
          historyId: '3003',
          encryptedRefreshToken: 'encrypted-refresh-token-3'
        }
      })
    );

    await assert.rejects(
      () => service.completeGmailOAuthAuthorization({ code: 'code-3', state: 'state-3' }, createContext()),
      BadRequestException
    );
    assert.equal(logs.records.length, 0);
  });

  it('lists only owner mailboxes for members and all organization mailboxes for admins', async () => {
    const store = createStore([], {
      mailboxes: [
        createMailbox({ id: 'own-mailbox', ownerUserId: 'user-1', emailAddress: 'own@gmail.com' }),
        createMailbox({
          id: 'peer-mailbox',
          ownerUserId: 'user-2',
          emailAddress: 'peer@gmail.com',
          syncIssueType: 'history_expired',
          syncIssueAt: new Date('2026-06-19T08:00:00.000Z'),
          syncIssueMessage: 'Gmail History checkpoint 已过期，需要人工处理'
        } as Partial<CrmMailboxRecord>)
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
    assert.deepEqual(adminResult.records[1].lastSyncIssue, {
      type: 'history_expired',
      message: 'Gmail History checkpoint 已过期，需要人工处理',
      happenedAt: '2026-06-19T08:00:00.000Z'
    });
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

  it('returns read-only default templates and persona profiles', async () => {
    const service = new CrmService(
      createStore([], {
        globalConfig: createGlobalConfig({
          followUpDelayDays: {
            step2Days: 2,
            step3Days: 4,
            step4Days: 8,
            step5Days: 16
          }
        })
      })
    );

    const result = await service.getTemplateDefaults(createContext());

    assert.equal(result.templateGroup.scope, 'global');
    assert.equal(result.templateGroup.steps.length, 5);
    assert.equal(result.templateGroup.steps[0].stepIndex, 1);
    assert.equal(result.templateGroup.steps[0].threadMode, 'new_subject');
    assert.deepEqual(
      result.templateGroup.steps.map(step => step.delayDays),
      [0, 2, 4, 8, 16]
    );
    assert.match(result.templateGroup.steps[0].bodyTemplate, /{{persona.focus}}/);
    assert.equal(result.personas.some(persona => persona.label === 'Purchasing Manager'), true);
  });

  it('creates, lists, updates, defaults and archives organization email template groups', async () => {
    const store = createStore([], {
      emailTemplateGroups: [createEmailTemplateGroup({ id: 'template-1', name: 'Distributor follow-up' })]
    });
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service);

    const created = await service.createEmailTemplateGroup(createEmailTemplatePayload({ name: 'Starter sequence' }), createContext());
    const list = await service.listEmailTemplateGroups(createContext(), { current: 1, size: 10, keyword: 'starter' });
    const updated = await service.updateEmailTemplateGroup(
      created.templateGroup.id,
      createEmailTemplatePayload({ name: 'Updated starter sequence' }),
      createContext()
    );
    const defaulted = await service.setDefaultEmailTemplateGroup(created.templateGroup.id, createContext());
    const archived = await service.archiveEmailTemplateGroup(created.templateGroup.id, createContext());

    assert.equal(created.templateGroup.steps.length, 5);
    assert.equal(list.records[0].organizationId, 'org-1');
    assert.equal(updated.templateGroup.name, 'Updated starter sequence');
    assert.equal(defaulted.templateGroup.isDefault, true);
    assert.equal(archived.templateGroup.status, 'archived');
    assert.equal(store.emailTemplateGroups.length, 2);
    assert.deepEqual(logs.records.map(record => record.action), [
      'email-template-create',
      'email-template-update',
      'email-template-default',
      'email-template-archive'
    ]);
  });

  it('creates, lists, updates, defaults and archives organization sequence policies', async () => {
    const store = createStore([], {
      sequencePolicies: [
        createSequencePolicy({
          id: 'policy-1',
          name: 'Conservative sequence',
          isDefault: true
        })
      ]
    });
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service);

    const created = await service.createSequencePolicy(
      {
        name: 'Fast follow-up',
        isDefault: true,
        steps: [
          { stepIndex: 1, delayDays: 0, threadMode: 'new_subject' },
          { stepIndex: 2, delayDays: 2, threadMode: 'same_thread' },
          { stepIndex: 3, delayDays: 5, threadMode: 'new_subject' },
          { stepIndex: 4, delayDays: 9, threadMode: 'new_subject' },
          { stepIndex: 5, delayDays: 14, threadMode: 'new_subject' }
        ],
        linkPolicy: 'block_new_links',
        sameCompanyContactStrategy: 'single_active_per_company'
      },
      createContext()
    );
    const list = await service.listSequencePolicies(createContext(), { keyword: 'fast', status: 'active' });
    const updated = await service.updateSequencePolicy(
      created.policy.id,
      {
        name: 'Fast follow-up v2',
        allowLowRiskAutoSend: true
      },
      createContext()
    );
    const defaulted = await service.setDefaultSequencePolicy('policy-1', createContext());
    const archived = await service.archiveSequencePolicy(created.policy.id, createContext());

    assert.equal(created.policy.steps[1].delayDays, 2);
    assert.equal(created.policy.linkPolicy, 'block_new_links');
    assert.equal(store.sequencePolicies.find(policy => policy.id === 'policy-1')?.isDefault, true);
    assert.equal(list.records[0].name, 'Fast follow-up');
    assert.equal(updated.policy.allowLowRiskAutoSend, true);
    assert.equal(defaulted.policy.isDefault, true);
    assert.equal(archived.policy.status, 'archived');
    assert.deepEqual(logs.records.map(record => record.action), [
      'sequence-policy-create',
      'sequence-policy-update',
      'sequence-policy-default',
      'sequence-policy-archive'
    ]);
  });

  it('rejects archived sequence policies as default policies', async () => {
    const store = createStore([], {
      sequencePolicies: [
        createSequencePolicy({
          id: 'policy-1',
          name: 'Conservative sequence',
          isDefault: true
        })
      ]
    });
    const service = new CrmService(store);

    await assert.rejects(
      () => service.updateSequencePolicy('policy-1', { status: 'archived', isDefault: true }, createContext()),
      /只能将启用策略设为默认/
    );

    assert.equal(store.sequencePolicies[0].status, 'active');
    assert.equal(store.sequencePolicies[0].isDefault, true);
  });

  it('uses the organization default email template for first draft generation', async () => {
    const store = createStore([createAccount({ id: 'account-1', name: 'ABC Trading', status: 'ready' })], {
      contacts: [
        createContact({
          id: 'contact-1',
          accountId: 'account-1',
          fullName: 'Ali Hassan',
          title: 'Purchasing Manager',
          emailStatus: 'valid'
        })
      ],
      emailTemplateGroups: [
        createEmailTemplateGroup({
          isDefault: true,
          steps: createEmailTemplateSteps({
            subjectTemplate: '{{product.name}} for {{account.name}}',
            bodyTemplate: 'Hi {{contact.name}},\n\nTemplate says {{persona.focus}} for {{account.name}}.\n\n{{sender.name}}'
          })
        })
      ],
      productLines: [
        createProductLine({
          id: 'product-line-1',
          name: 'Bearing Series',
          coreSellingPoints: 'stable supply'
        })
      ]
    });
    const service = new CrmService(store);

    const result = await service.createSequenceReviewItem(
      {
        accountId: 'account-1',
        contactId: 'contact-1',
        productLineId: 'product-line-1'
      },
      createContext()
    );

    assert.equal(result.item.firstMessage?.subject, 'Bearing Series for ABC Trading');
    assert.match(result.item.firstMessage?.bodyText || '', /Template says price, MOQ, lead time, and payment terms/);
  });

  it('creates first draft review items with scoped resources and sanitized logs', async () => {
    const store = createStore([createAccount({ id: 'account-1', name: 'ABC Trading', status: 'ready' })], {
      contacts: [
        createContact({
          id: 'contact-1',
          accountId: 'account-1',
          fullName: 'Ali Hassan',
          title: 'Purchasing Manager',
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
    assert.match(result.item.firstMessage?.bodyText ?? '', /price, MOQ, lead time, and payment terms/);
    assert.deepEqual(
      result.item.checklist.find(item => item.key === 'persona_focus'),
      {
        key: 'persona_focus',
        label: '职位画像',
        passed: true,
        message: '已匹配 Purchasing Manager：价格、MOQ、交期、付款方式'
      }
    );
    assert.equal(store.accounts[0].status, 'manual_review_pending');
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'sequence_draft_generated');
    assert.equal((logs.records[0].metadata as Record<string, unknown>).messageId, 'message-1');
    assert.equal(JSON.stringify(logs.records[0].metadata).includes('stable supply'), false);
  });

  it('binds sequence review drafts to the selected or default sequence policy', async () => {
    const store = createStore([createAccount({ id: 'account-1', name: 'ABC Trading', status: 'ready' })], {
      contacts: [
        createContact({
          id: 'contact-1',
          accountId: 'account-1',
          fullName: 'Ali Hassan',
          title: 'Purchasing Manager',
          emailStatus: 'valid'
        })
      ],
      sequencePolicies: [
        createSequencePolicy({
          id: 'policy-default',
          name: 'Default sequence',
          isDefault: true,
          steps: [
            { stepIndex: 1, delayDays: 0, threadMode: 'same_thread' },
            { stepIndex: 2, delayDays: 3, threadMode: 'same_thread' },
            { stepIndex: 3, delayDays: 7, threadMode: 'new_subject' },
            { stepIndex: 4, delayDays: 14, threadMode: 'new_subject' },
            { stepIndex: 5, delayDays: 21, threadMode: 'new_subject' }
          ]
        }),
        createSequencePolicy({
          id: 'policy-selected',
          name: 'Selected sequence',
          steps: [
            { stepIndex: 1, delayDays: 0, threadMode: 'new_subject' },
            { stepIndex: 2, delayDays: 2, threadMode: 'same_thread' },
            { stepIndex: 3, delayDays: 5, threadMode: 'new_subject' },
            { stepIndex: 4, delayDays: 10, threadMode: 'new_subject' },
            { stepIndex: 5, delayDays: 15, threadMode: 'new_subject' }
          ]
        })
      ]
    });
    const service = new CrmService(store);

    const defaultResult = await service.createSequenceReviewItem(
      {
        accountId: 'account-1',
        contactId: 'contact-1'
      },
      createContext()
    );
    store.enrollments.length = 0;
    store.messages.length = 0;
    const selectedResult = await service.createSequenceReviewItem(
      {
        accountId: 'account-1',
        contactId: 'contact-1',
        policyId: 'policy-selected'
      },
      createContext()
    );

    assert.equal(defaultResult.item.enrollment.policyId, 'policy-default');
    assert.equal(defaultResult.item.policy?.id, 'policy-default');
    assert.equal(defaultResult.item.firstMessage?.threadMode, 'same_thread');
    assert.equal(selectedResult.item.enrollment.policyId, 'policy-selected');
    assert.equal(selectedResult.item.policy?.id, 'policy-selected');
    assert.equal(selectedResult.item.firstMessage?.threadMode, 'new_subject');
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

  it('applies sequence policy same-company contact strategy when creating review items', async () => {
    const store = createStore([createAccount({ id: 'account-1', ownerUserId: 'user-1' })], {
      contacts: [
        createContact({ id: 'contact-1', ownerUserId: 'user-1', accountId: 'account-1' }),
        createContact({ id: 'contact-2', ownerUserId: 'user-1', accountId: 'account-1' })
      ],
      enrollments: [
        createEnrollment({
          id: 'enrollment-active',
          accountId: 'account-1',
          contactId: 'contact-1',
          status: 'sequence_running'
        })
      ],
      sequencePolicies: [
        createSequencePolicy({
          id: 'policy-single',
          isDefault: true,
          sameCompanyContactStrategy: 'single_active_per_company'
        }),
        createSequencePolicy({
          id: 'policy-multiple',
          sameCompanyContactStrategy: 'allow_multiple_contacts'
        })
      ]
    });
    const service = new CrmService(store);

    await assert.rejects(
      () => service.createSequenceReviewItem({ accountId: 'account-1', contactId: 'contact-2' }, createContext()),
      /同公司已有进行中的开发信序列/
    );

    const created = await service.createSequenceReviewItem(
      { accountId: 'account-1', contactId: 'contact-2', policyId: 'policy-multiple' },
      createContext()
    );

    assert.equal(created.item.enrollment.policyId, 'policy-multiple');
  });

  it('rejects sequence review creation for organization blacklisted contact emails', async () => {
    const store = createStore([createAccount({ id: 'account-1', ownerUserId: 'user-1' })], {
      contacts: [
        createContact({
          id: 'contact-1',
          ownerUserId: 'user-1',
          accountId: 'account-1',
          email: 'ali@example.com',
          emailHash: hashTestEmail('ali@example.com')
        })
      ],
      blacklists: [
        createBlacklist({
          organizationId: 'org-1',
          emailHash: hashTestEmail('ali@example.com'),
          maskedEmail: 'a***@example.com'
        })
      ]
    });
    const service = new CrmService(store);

    await assert.rejects(
      () => service.createSequenceReviewItem({ accountId: 'account-1', contactId: 'contact-1' }, createContext()),
      /组织黑名单/
    );
  });

  it('lists organization blacklist entries without exposing email hashes', async () => {
    const store = createStore([], {
      blacklists: [
        createBlacklist({
          id: 'blacklist-1',
          organizationId: 'org-1',
          emailHash: hashTestEmail('ali@example.com'),
          maskedEmail: 'a***@example.com',
          createdByName: 'Alice'
        }),
        createBlacklist({
          id: 'blacklist-2',
          organizationId: 'org-2',
          emailHash: hashTestEmail('bob@example.com'),
          maskedEmail: 'b***@example.com'
        })
      ]
    });
    const service = new CrmService(store);

    const result = await service.listBlacklistEntries(createContext(), {
      current: 1,
      size: 10,
      keyword: 'alice'
    });

    assert.deepEqual(store.lastBlacklistListArgs, {
      organizationId: 'org-1',
      keyword: 'alice',
      skip: 0,
      take: 10
    });
    assert.equal(result.total, 1);
    assert.equal(result.records[0].maskedEmail, 'a***@example.com');
    assert.equal('emailHash' in result.records[0], false);
  });

  it('removes organization blacklist entries with reason and audit log', async () => {
    const logs = createLogRecorder();
    const store = createStore([], {
      blacklists: [
        createBlacklist({
          id: 'blacklist-1',
          organizationId: 'org-1',
          maskedEmail: 'a***@example.com',
          sourceMessageId: 'inbox-message-1'
        }),
        createBlacklist({
          id: 'blacklist-2',
          organizationId: 'org-2',
          maskedEmail: 'b***@example.com'
        })
      ]
    });
    const service = new CrmService(store, undefined, logs.service);

    const result = await service.removeBlacklistEntry(
      'blacklist-1',
      { reason: '客户邮件确认可以重新联系' },
      createContext()
    );

    assert.equal(result.blacklistEntry.id, 'blacklist-1');
    assert.equal(store.blacklists.some(entry => entry.id === 'blacklist-1'), false);
    assert.equal(store.blacklists.some(entry => entry.id === 'blacklist-2'), true);
    assert.equal(logs.records.at(-1)?.action, 'blacklist-entry-removed');
    assert.deepEqual(logs.records.at(-1)?.metadata, {
      organizationId: 'org-1',
      blacklistEntryId: 'blacklist-1',
      maskedEmail: 'a***@example.com',
      reason: '客户邮件确认可以重新联系',
      sourceAccountId: 'account-1',
      sourceContactId: 'contact-1',
      sourceMessageId: 'inbox-message-1'
    });
  });

  it('rejects blacklist removal without an audit reason', async () => {
    const service = new CrmService(createStore([], { blacklists: [createBlacklist({ id: 'blacklist-1' })] }));

    await assert.rejects(
      () => service.removeBlacklistEntry('blacklist-1', { reason: '   ' }, createContext()),
      /解除原因/
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
      messages: [
        createMessage({ id: 'message-1', enrollmentId: 'enrollment-1' }),
        createMessage({
          id: 'message-2',
          enrollmentId: 'enrollment-1',
          stepIndex: 2,
          status: 'draft_pending_review'
        })
      ]
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
    assert.deepEqual(
      result.records[0].messages.map(message => message.id),
      ['message-1', 'message-2']
    );
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

  it('approves follow-up drafts by queueing their scheduled send jobs', async () => {
    const scheduledAt = new Date('2030-06-21T10:00:00.000Z');
    const store = createStore([createAccount({ id: 'account-1', status: 'sequence_running' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      mailboxes: [createMailbox({ id: 'mailbox-1', status: 'active' })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          mailboxId: 'mailbox-1',
          status: 'sequence_running',
          runVersion: 3,
          currentStep: 1
        })
      ],
      messages: [
        createMessage({
          id: 'message-1',
          enrollmentId: 'enrollment-1',
          status: 'sent',
          stepIndex: 1
        }),
        createMessage({
          id: 'message-2',
          enrollmentId: 'enrollment-1',
          status: 'draft_pending_review',
          stepIndex: 2,
          threadMode: 'same_thread',
          scheduledAt
        })
      ]
    });
    const sendQueue = createSendQueue();
    const service = new CrmService(store, undefined, undefined, sendQueue);

    const approved = await service.approveMessageDraft('message-2', createContext());

    assert.equal(approved.enrollment.status, 'sequence_running');
    assert.equal(approved.message.status, 'queued');
    assert.equal(store.messages[1].bullJobId, 'send-job-1');
    assert.deepEqual(sendQueue.jobs[0], {
      enrollmentId: 'enrollment-1',
      messageId: 'message-2',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      runVersion: 3
    });
    assert.ok((sendQueue.options[0]?.delayMs ?? 0) > 0);
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

  it('rejects starting send when the contact email is organization blacklisted', async () => {
    const email = 'ali@example.com';
    const store = createStore([createAccount({ id: 'account-1', status: 'ready' })], {
      contacts: [
        createContact({
          id: 'contact-1',
          accountId: 'account-1',
          email,
          emailHash: hashTestEmail(email)
        })
      ],
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
      ],
      blacklists: [
        createBlacklist({
          organizationId: 'org-1',
          emailHash: hashTestEmail(email),
          maskedEmail: 'a***@example.com'
        })
      ]
    });
    const queue = createSendQueue();
    const service = new CrmService(store, undefined, undefined, queue);

    await assert.rejects(() => service.startFirstMessageSend('enrollment-1', createContext()), /组织黑名单/);
    assert.equal(queue.jobs.length, 0);
    assert.equal(store.messages[0].status, 'draft_ready');
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
        }),
        createMessage({
          id: 'message-2',
          accountId: 'account-1',
          contactId: 'contact-1',
          enrollmentId: 'enrollment-1',
          mailboxId: 'mailbox-1',
          ownerUserId: 'user-2',
          status: 'queued',
          stepIndex: 2,
          bullJobId: 'send-job-2'
        })
      ]
    });
    const service = new CrmService(store);

    const result = await service.stopSequenceEnrollment('enrollment-1', createContext({ organizationRole: 'admin' }));

    assert.equal(result.enrollment.status, 'stopped');
    assert.equal(result.enrollment.runVersion, 4);
    assert.equal(result.message?.status, 'skipped');
    assert.equal(result.message?.bullJobId, null);
    assert.equal(store.messages[1].status, 'skipped');
    assert.equal(store.messages[1].bullJobId, null);
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

  it('mock-ingests a customer reply and stops all active same-account sequences', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'sequence_running' })], {
      contacts: [
        createContact({ id: 'contact-1', accountId: 'account-1', email: 'ali@example.com' }),
        createContact({ id: 'contact-2', accountId: 'account-1', email: 'buyer@example.com' })
      ],
      mailboxes: [createMailbox({ id: 'mailbox-1' })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          mailboxId: 'mailbox-1',
          status: 'sequence_running',
          runVersion: 3
        }),
        createEnrollment({
          id: 'enrollment-2',
          accountId: 'account-1',
          contactId: 'contact-2',
          mailboxId: 'mailbox-1',
          status: 'sequence_running',
          runVersion: 6
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
        }),
        createMessage({
          id: 'message-2',
          accountId: 'account-1',
          contactId: 'contact-2',
          enrollmentId: 'enrollment-2',
          mailboxId: 'mailbox-1',
          status: 'queued',
          bullJobId: 'crm-send:message-2'
        })
      ]
    });
    const service = new CrmService(store);

    await service.mockCustomerReply(
      'message-1',
      {
        subject: 'Interested',
        bodyText: 'Please send details.',
        receivedAt: '2026-06-18T11:00:00.000Z'
      },
      createContext()
    );

    assert.equal(store.enrollments[0].status, 'replied');
    assert.equal(store.enrollments[0].runVersion, 4);
    assert.equal(store.enrollments[1].status, 'replied');
    assert.equal(store.enrollments[1].runVersion, 7);
    assert.equal(store.messages[1].status, 'skipped');
    assert.equal(store.messages[1].bullJobId, null);
  });

  it('does not notify or log when provider reply ingest is a duplicate', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'replied_pending' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', email: 'ali@example.com', emailStatus: 'valid' })],
      mailboxes: [createMailbox({ id: 'mailbox-1' })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          mailboxId: 'mailbox-1',
          status: 'replied',
          runVersion: 4
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
      ],
      inboxThreads: [createInboxThread({ id: 'inbox-thread-1', accountId: 'account-1', contactId: 'contact-1' })],
      inboxMessages: [
        createInboxMessage({
          id: 'inbox-message-1',
          threadId: 'inbox-thread-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          providerMessageId: 'gmail-message-1'
        })
      ]
    });
    const logs = createLogRecorder();
    const notificationCreates: Array<{ title: string; content: string; type: string; metadata?: unknown }> = [];
    store.ingestCustomerReply = async () => ({
      thread: store.inboxThreads[0],
      message: store.inboxMessages[0],
      account: store.accounts[0],
      contact: store.contacts[0],
      mailbox: store.mailboxes[0],
      enrollment: store.enrollments[0],
      event: null,
      isDuplicate: true
    });
    const service = new CrmService(store, undefined, logs.service, undefined, {
      async create(input: { title: string; content: string; type: string; metadata?: unknown }) {
        notificationCreates.push(input);
        return input as never;
      }
    } as never);

    const result = await service.mockCustomerReply(
      'message-1',
      {
        subject: 'Re: Bearing Series',
        bodyText: 'Please send details.',
        receivedAt: '2026-06-18T11:00:00.000Z'
      },
      createContext()
    );

    assert.equal(result.messages[0].id, 'inbox-message-1');
    assert.equal(result.timelineEvents.length, 0);
    assert.equal(notificationCreates.length, 0);
    assert.equal(logs.records.length, 0);
  });

  it('classifies unsubscribe replies and marks the contact as unsubscribed', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'sequence_running' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', email: 'ali@example.com', emailStatus: 'valid' })],
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
        subject: 'Re: Bearing Series',
        bodyText: 'Please remove me from your list.',
        receivedAt: '2026-06-18T11:00:00.000Z'
      },
      createContext()
    );

    assert.equal(result.messages[0].messageType, 'unsubscribe_hint');
    assert.equal(store.contacts[0].emailStatus, 'unsubscribed');
    assert.equal(store.accounts[0].status, 'blocked');
    assert.equal(store.enrollments[0].status, 'replied');
    assert.equal(store.enrollments[0].runVersion, 4);
    assert.equal(store.blacklists.length, 1);
    assert.equal(store.blacklists[0].organizationId, 'org-1');
    assert.equal(store.blacklists[0].emailHash, 'hash-1');
    assert.equal(store.blacklists[0].reason, 'unsubscribe');
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'customer_unsubscribed');
  });

  it('classifies delivery failure replies and marks the contact as unreachable', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'sequence_running' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', email: 'ali@example.com', emailStatus: 'valid' })],
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
    const notificationCreates: Array<{ title: string; content: string; type: string; metadata?: unknown }> = [];
    const service = new CrmService(store, undefined, undefined, undefined, {
      async create(input: { title: string; content: string; type: string; metadata?: unknown }) {
        notificationCreates.push(input);
        return input as never;
      }
    } as never);

    const result = await service.mockCustomerReply(
      'message-1',
      {
        subject: 'Delivery Status Notification (Failure)',
        bodyText: 'The message was not delivered. Diagnostic-Code: smtp; 550 5.1.1 User unknown',
        receivedAt: '2026-06-18T11:00:00.000Z'
      },
      createContext()
    );

    assert.equal(result.messages[0].messageType, 'bounce');
    assert.equal(store.contacts[0].emailStatus, 'unreachable');
    assert.equal(store.accounts[0].status, 'manual_review_pending');
    assert.equal(store.enrollments[0].status, 'replied');
    assert.equal(store.enrollments[0].runVersion, 4);
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'email_bounced');
    assert.equal(notificationCreates[0]?.title, '邮件退信');
    assert.equal(notificationCreates[0]?.content, 'Account / a***@example.com 邮件退信，请检查邮箱可达性');
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
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service);
    const adminContext = createContext({ organizationRole: 'admin' });
    const superContext = createContext({ roles: ['R_SUPER'], organizationRole: 'member' });

    const memberResult = await service.listInboxThreads(createContext());
    const adminResult = await service.listInboxThreads(adminContext);
    const superResult = await service.listInboxThreads(superContext);

    assert.deepEqual(
      memberResult.records.map(record => record.id),
      ['own-thread']
    );
    assert.deepEqual(
      adminResult.records.map(record => record.id),
      ['own-thread', 'peer-thread']
    );
    assert.equal(memberResult.records[0].lastMessageSnippet, 'Please send details.');
    assert.equal(adminResult.records.find(record => record.id === 'peer-thread')?.lastMessageSnippet, '');
    assert.equal((await service.getInboxThread('peer-thread', adminContext)).messages.length, 0);
    assert.equal(superResult.records.find(record => record.id === 'peer-thread')?.lastMessageSnippet, 'Please send details.');
    assert.equal((await service.getInboxThread('peer-thread', superContext)).messages.length, 1);
    assert.equal(logs.records.some(record => record.action === 'inbox-body-viewed-by-super-admin'), true);
    assert.equal(JSON.stringify(logs.records).includes('Please send details.'), false);

    await service.saveOrganizationConfig({ allowAdminViewMemberEmailBody: true }, adminContext);
    const adminAllowedResult = await service.listInboxThreads(adminContext);

    assert.equal(adminAllowedResult.records.find(record => record.id === 'peer-thread')?.lastMessageSnippet, 'Please send details.');
    assert.equal((await service.getInboxThread('peer-thread', adminContext)).messages.length, 1);
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

  it('sends a plain-text inbox reply through the owner mailbox and marks the thread handled', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'replied_pending' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      mailboxes: [
        createMailbox({ id: 'mailbox-1', emailAddress: 'sender@example.com', emailHash: hashTestEmail('sender@example.com') })
      ],
      inboxThreads: [
        createInboxThread({
          id: 'thread-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          mailboxId: 'mailbox-1',
          status: 'pending',
          unreadCount: 2,
          subject: 'Re: Bearings'
        })
      ],
      inboxMessages: [
        createInboxMessage({
          id: 'inbound-1',
          threadId: 'thread-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          mailboxId: 'mailbox-1',
          subject: 'Re: Bearings',
          bodyText: 'Please send details.',
          receivedAt: new Date('2026-06-18T09:30:00.000Z')
        })
      ]
    });
    const replyCalls: Array<{ subject: string; bodyText: string; mailboxId: string }> = [];
    const sendGateway: CrmEmailSendGateway = {
      async sendPlainText() {
        return { providerMessageId: 'mock:first-message' };
      },
      async replyPlainText(input) {
        replyCalls.push({
          subject: input.subject,
          bodyText: input.bodyText,
          mailboxId: input.mailbox.id
        });

        return { providerMessageId: 'mock:reply-1' };
      }
    };
    const service = new CrmService(store, undefined, undefined, undefined, undefined, sendGateway);

    const result = await service.replyInboxThread('thread-1', { bodyText: '  Thanks, I will send details today.  ' }, createContext());

    assert.deepEqual(replyCalls, [
      {
        subject: 'Re: Bearings',
        bodyText: 'Thanks, I will send details today.',
        mailboxId: 'mailbox-1'
      }
    ]);
    assert.equal(result.thread.status, 'handled');
    assert.equal(result.thread.unreadCount, 0);
    assert.equal(result.account.status, 'followed_up');
    assert.equal(result.messages.at(-1)?.direction, 'outbound');
    assert.equal(result.messages.at(-1)?.providerMessageId, 'mock:reply-1');
    assert.equal(result.timelineEvents[0].eventType, 'inbox_replied');
  });

  it('rejects empty inbox replies and peer inbox replies', async () => {
    const store = createStore([createAccount({ id: 'peer-account', ownerUserId: 'user-2' })], {
      contacts: [createContact({ id: 'peer-contact', accountId: 'peer-account', ownerUserId: 'user-2' })],
      mailboxes: [createMailbox({ id: 'peer-mailbox', ownerUserId: 'user-2' })],
      inboxThreads: [
        createInboxThread({
          id: 'peer-thread',
          accountId: 'peer-account',
          contactId: 'peer-contact',
          mailboxId: 'peer-mailbox',
          ownerUserId: 'user-2'
        })
      ]
    });
    const service = new CrmService(store);

    await assert.rejects(
      () => service.replyInboxThread('peer-thread', { bodyText: 'Hello' }, createContext()),
      NotFoundException
    );
    await assert.rejects(() => service.replyInboxThread('peer-thread', { bodyText: '   ' }, createContext()), BadRequestException);
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
    archivedFingerprints?: TestArchivedFingerprint[];
    contacts?: TestContact[];
    blacklists?: TestBlacklist[];
    timelineEvents?: TestTimelineEvent[];
    mailboxes?: TestMailbox[];
    productLines?: TestProductLine[];
    emailTemplateGroups?: TestEmailTemplateGroup[];
    sequencePolicies?: TestSequencePolicy[];
    enrollments?: TestEnrollment[];
    messages?: TestMessage[];
    inboxThreads?: TestInboxThread[];
    inboxMessages?: TestInboxMessage[];
    emailVerificationCaches?: TestEmailVerificationCache[];
    globalConfig?: TestGlobalConfig;
    organizationConfig?: TestOrganizationConfig | null;
  } = {}
): CrmStore & {
  accounts: TestAccount[];
  archivedFingerprints: TestArchivedFingerprint[];
  contacts: TestContact[];
  blacklists: TestBlacklist[];
  emailVerificationCaches: TestEmailVerificationCache[];
  timelineEvents: TestTimelineEvent[];
  mailboxes: TestMailbox[];
  productLines: TestProductLine[];
  emailTemplateGroups: TestEmailTemplateGroup[];
  sequencePolicies: TestSequencePolicy[];
  enrollments: TestEnrollment[];
  messages: TestMessage[];
  inboxThreads: TestInboxThread[];
  inboxMessages: TestInboxMessage[];
  globalConfig: TestGlobalConfig;
  organizationConfig: TestOrganizationConfig | null;
  mailboxUpdateCalls: Array<{ id: string; input: Parameters<CrmStore['updateMailbox']>[1] }>;
  productLineUpdateCalls: Array<{ id: string; organizationId: string; input: Partial<TestProductLine> }>;
  emailTemplateUpdateCalls: Array<{ id: string; organizationId: string; input: Parameters<CrmStore['updateEmailTemplateGroup']>[2] }>;
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
  lastEmailTemplateListArgs?: Parameters<CrmStore['listEmailTemplateGroups']>[0];
  lastEmailTemplateDetailArgs?: { id: string; organizationId: string };
  lastSequencePolicyListArgs?: Parameters<CrmStore['listSequencePolicies']>[0];
  lastSequencePolicyDetailArgs?: { id: string; organizationId: string };
  lastBlacklistListArgs?: Parameters<CrmStore['listBlacklistEntries']>[0];
  lastSequenceReviewListArgs?: Parameters<CrmStore['listSequenceReviewItems']>[0];
  lastSequenceReviewDetailArgs?: Parameters<CrmStore['getSequenceReviewItem']>[0];
  lastMessageDetailArgs?: Parameters<CrmStore['findMessageById']>[0];
} {
  const accounts = [...initialAccounts];
  const archivedFingerprints: TestArchivedFingerprint[] = [...(initialData.archivedFingerprints ?? [])];
  const contacts: TestContact[] = [...(initialData.contacts ?? [])];
  const blacklists: TestBlacklist[] = [...(initialData.blacklists ?? [])];
  const emailVerificationCaches: TestEmailVerificationCache[] = [...(initialData.emailVerificationCaches ?? [])];
  const timelineEvents: TestTimelineEvent[] = [...(initialData.timelineEvents ?? [])];
  const mailboxes: TestMailbox[] = [...(initialData.mailboxes ?? [])];
  const productLines: TestProductLine[] = [...(initialData.productLines ?? [])];
  const emailTemplateGroups: TestEmailTemplateGroup[] = [...(initialData.emailTemplateGroups ?? [])];
  const sequencePolicies: TestSequencePolicy[] = [...(initialData.sequencePolicies ?? [])];
  const enrollments: TestEnrollment[] = [...(initialData.enrollments ?? [])];
  const messages: TestMessage[] = [...(initialData.messages ?? [])];
  const inboxThreads: TestInboxThread[] = [...(initialData.inboxThreads ?? [])];
  const inboxMessages: TestInboxMessage[] = [...(initialData.inboxMessages ?? [])];
  const globalConfig = initialData.globalConfig ?? createGlobalConfig();
  let organizationConfig = initialData.organizationConfig ?? null;
  const mailboxUpdateCalls: Array<{ id: string; input: Parameters<CrmStore['updateMailbox']>[1] }> = [];
  const productLineUpdateCalls: Array<{ id: string; organizationId: string; input: Partial<TestProductLine> }> = [];
  const emailTemplateUpdateCalls: Array<{
    id: string;
    organizationId: string;
    input: Parameters<CrmStore['updateEmailTemplateGroup']>[2];
  }> = [];
  const enrollmentUpdateCalls: Array<{ id: string; organizationId: string; input: Partial<TestEnrollment> }> = [];
  const messageUpdateCalls: Array<{ id: string; organizationId: string; input: Partial<TestMessage> }> = [];

  return {
    accounts,
    archivedFingerprints,
    contacts,
    blacklists,
    emailVerificationCaches,
    timelineEvents,
    mailboxes,
    productLines,
    emailTemplateGroups,
    sequencePolicies,
    enrollments,
    messages,
    inboxThreads,
    inboxMessages,
    globalConfig,
    get organizationConfig() {
      return organizationConfig;
    },
    mailboxUpdateCalls,
    productLineUpdateCalls,
    emailTemplateUpdateCalls,
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
    async listAccountsForArchiveSlimming() {
      return [];
    },
    async slimArchivedAccount() {
      return null;
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
    async findEmailVerificationCache(args) {
      return emailVerificationCaches.find(cache => cache.emailHash === args.emailHash) || null;
    },
    async upsertEmailVerificationCache(input) {
      const existingCache = emailVerificationCaches.find(
        cache => cache.emailHash === input.emailHash
      );

      if (existingCache) {
        Object.assign(existingCache, input, { updatedAt: new Date('2026-06-18T10:00:00.000Z') });
        return existingCache;
      }

      const cache = createEmailVerificationCache({
        ...input,
        id: `email-verification-cache-${emailVerificationCaches.length + 1}`
      });
      emailVerificationCaches.push(cache);

      return cache;
    },
    async getGlobalConfig() {
      return globalConfig;
    },
    async saveGlobalConfig(input) {
      Object.assign(globalConfig, {
        emailVerificationCooldownDays: input.emailVerificationCooldownDays,
        followUpDelayDays: input.followUpDelayDays ?? globalConfig.followUpDelayDays,
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      });
      return globalConfig;
    },
    async getOrganizationConfig(organizationId) {
      return organizationConfig?.organizationId === organizationId ? organizationConfig : null;
    },
    async saveOrganizationConfig(input) {
      organizationConfig = createOrganizationConfig({
        ...organizationConfig,
        organizationId: input.organizationId,
        allowAdminViewMemberEmailBody: input.allowAdminViewMemberEmailBody,
        updatedById: input.updatedById ?? null,
        updatedByName: input.updatedByName ?? null,
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      });

      return organizationConfig;
    },
    async findArchivedFingerprints(input) {
      return archivedFingerprints.filter(fingerprint => {
        if (fingerprint.organizationId !== input.organizationId) return false;

        return input.fingerprints.some(
          item =>
            item.fingerprintType === fingerprint.fingerprintType &&
            item.fingerprintValue === fingerprint.fingerprintValue
        );
      });
    },
    async upsertArchivedFingerprint(input) {
      const existingFingerprint = archivedFingerprints.find(
        fingerprint =>
          fingerprint.organizationId === input.organizationId &&
          fingerprint.fingerprintType === input.fingerprintType &&
          fingerprint.fingerprintValue === input.fingerprintValue
      );

      if (existingFingerprint) {
        Object.assign(existingFingerprint, input, { updatedAt: new Date('2026-06-18T10:00:00.000Z') });
        return existingFingerprint;
      }

      const fingerprint = createArchivedFingerprint({
        ...input,
        id: `archived-fingerprint-${archivedFingerprints.length + 1}`
      });
      archivedFingerprints.push(fingerprint);
      return fingerprint;
    },
    async findBlacklistEntry(args) {
      return (
        blacklists.find(
          entry => entry.organizationId === args.organizationId && entry.emailHash === args.emailHash
        ) || null
      );
    },
    async upsertBlacklistEntry(input) {
      const existingEntry = blacklists.find(
        entry => entry.organizationId === input.organizationId && entry.emailHash === input.emailHash
      );

      if (existingEntry) {
        Object.assign(existingEntry, input, { updatedAt: new Date('2026-06-18T10:00:00.000Z') });
        return existingEntry;
      }

      const entry = createBlacklist({
        ...input,
        id: `blacklist-${blacklists.length + 1}`
      });
      blacklists.push(entry);
      return entry;
    },
    async listBlacklistEntries(args) {
      this.lastBlacklistListArgs = args;
      const records = blacklists.filter(entry => {
        if (entry.organizationId !== args.organizationId) return false;
        if (args.keyword) {
          const keyword = args.keyword.toLowerCase();
          return [entry.maskedEmail, entry.createdByName].some(value => value?.toLowerCase().includes(keyword));
        }

        return true;
      });

      return {
        records: records.slice(args.skip, args.skip + args.take),
        total: records.length
      };
    },
    async deleteBlacklistEntry(args) {
      const index = blacklists.findIndex(entry => entry.id === args.id && entry.organizationId === args.organizationId);
      if (index === -1) return null;

      const [entry] = blacklists.splice(index, 1);
      return entry;
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
    async listMailboxesForWatchRenewal(input) {
      return mailboxes
        .filter(mailbox => {
          if (mailbox.provider !== input.provider || mailbox.status !== 'active') return false;
          return !mailbox.watchExpiration || mailbox.watchExpiration <= input.renewBefore;
        })
        .slice(0, input.take);
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
    async listEmailTemplateGroups(args) {
      this.lastEmailTemplateListArgs = args;
      const records = emailTemplateGroups.filter(group => {
        if (group.organizationId !== args.organizationId) return false;
        if (args.status && group.status !== args.status) return false;
        if (!args.keyword) return true;
        const keyword = args.keyword.toLowerCase();
        return [group.name, group.description].some(value => value?.toLowerCase().includes(keyword));
      });

      return {
        records: records.slice(args.skip, args.skip + args.take),
        total: records.length
      };
    },
    async findEmailTemplateGroupByName(organizationId, name) {
      return emailTemplateGroups.find(group => group.organizationId === organizationId && group.name === name) ?? null;
    },
    async findEmailTemplateGroupById(args) {
      this.lastEmailTemplateDetailArgs = args;
      return (
        emailTemplateGroups.find(group => group.id === args.id && group.organizationId === args.organizationId) ?? null
      );
    },
    async findDefaultEmailTemplateGroup(organizationId) {
      return (
        emailTemplateGroups.find(
          group => group.organizationId === organizationId && group.status === 'active' && group.isDefault
        ) ?? null
      );
    },
    async createEmailTemplateGroup(input) {
      const group = createEmailTemplateGroup({
        id: `template-${emailTemplateGroups.length + 1}`,
        organizationId: input.organizationId,
        name: input.name,
        language: input.language,
        description: input.description,
        status: input.status,
        isDefault: input.isDefault,
        steps: input.steps.map((step, index) => createEmailTemplateStep(step, `template-${emailTemplateGroups.length + 1}`, index + 1)),
        createdById: input.createdById,
        createdByName: input.createdByName
      });
      emailTemplateGroups.push(group);
      return group;
    },
    async updateEmailTemplateGroup(id, organizationId, input) {
      emailTemplateUpdateCalls.push({ id, organizationId, input });
      const group = emailTemplateGroups.find(item => item.id === id && item.organizationId === organizationId);
      if (!group) return null;
      Object.assign(group, input, { updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      if (input.steps) {
        group.steps = input.steps.map((step, index) => createEmailTemplateStep(step, id, index + 1));
      }
      return group;
    },
    async setDefaultEmailTemplateGroup(id, organizationId) {
      const group = emailTemplateGroups.find(item => item.id === id && item.organizationId === organizationId);
      if (!group || group.status !== 'active') return null;
      for (const item of emailTemplateGroups) {
        if (item.organizationId === organizationId) {
          item.isDefault = item.id === id;
        }
      }
      return group;
    },
    async listSequencePolicies(args) {
      this.lastSequencePolicyListArgs = args;
      const records = sequencePolicies.filter(policy => {
        if (policy.organizationId !== args.organizationId) return false;
        if (args.status && policy.status !== args.status) return false;
        if (!args.keyword) return true;
        const keyword = args.keyword.toLowerCase();
        return [policy.name, policy.description].some(value => value?.toLowerCase().includes(keyword));
      });

      return {
        records: records.slice(args.skip, args.skip + args.take),
        total: records.length
      };
    },
    async findSequencePolicyByName(organizationId, name) {
      return sequencePolicies.find(policy => policy.organizationId === organizationId && policy.name === name) ?? null;
    },
    async findSequencePolicyById(args) {
      this.lastSequencePolicyDetailArgs = args;
      return (
        sequencePolicies.find(policy => policy.id === args.id && policy.organizationId === args.organizationId) ?? null
      );
    },
    async findDefaultSequencePolicy(organizationId) {
      return (
        sequencePolicies.find(
          policy => policy.organizationId === organizationId && policy.status === 'active' && policy.isDefault
        ) ?? null
      );
    },
    async createSequencePolicy(input) {
      const policy = createSequencePolicy({
        ...input,
        id: `policy-${sequencePolicies.length + 1}`
      });

      if (policy.isDefault) {
        for (const item of sequencePolicies) {
          if (item.organizationId === policy.organizationId) {
            item.isDefault = false;
          }
        }
      }

      sequencePolicies.push(policy);
      return policy;
    },
    async updateSequencePolicy(id, organizationId, input) {
      const policy = sequencePolicies.find(item => item.id === id && item.organizationId === organizationId);
      if (!policy) return null;

      Object.assign(policy, input, { updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      if (input.isDefault) {
        for (const item of sequencePolicies) {
          if (item.organizationId === organizationId && item.id !== id) {
            item.isDefault = false;
          }
        }
      }

      return policy;
    },
    async setDefaultSequencePolicy(id, organizationId) {
      const policy = sequencePolicies.find(item => item.id === id && item.organizationId === organizationId);
      if (!policy || policy.status !== 'active') return null;

      for (const item of sequencePolicies) {
        if (item.organizationId === organizationId) {
          item.isDefault = item.id === id;
        }
      }

      return policy;
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
    async findActiveEnrollmentByAccount(args) {
      return (
        enrollments.find(
          enrollment =>
            enrollment.organizationId === args.organizationId &&
            enrollment.ownerUserId === args.ownerUserId &&
            enrollment.accountId === args.accountId &&
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
        { accounts, contacts, productLines, mailboxes, sequencePolicies, messages }
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
        ? buildSequenceReviewRecords([enrollment], { accounts, contacts, productLines, mailboxes, sequencePolicies, messages })[0]
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
    async findSentMessageByProviderId(args) {
      return (
        messages.find(message => {
          if (message.organizationId !== args.organizationId) return false;
          if (message.ownerUserId !== args.ownerUserId) return false;
          if (message.mailboxId !== args.mailboxId) return false;
          if (message.providerMessageId !== args.providerMessageId) return false;
          return message.status === 'sent';
        }) ?? null
      );
    },
    async findSentMessageByProviderThreadId(args) {
      return (
        messages.find(message => {
          if (message.organizationId !== args.organizationId) return false;
          if (message.ownerUserId !== args.ownerUserId) return false;
          if (message.mailboxId !== args.mailboxId) return false;
          if (message.providerThreadId !== args.providerThreadId) return false;
          return message.status === 'sent';
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
    async claimFirstMessageSendDelivery(input) {
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
      const contact = enrollment ? contacts.find(item => item.id === enrollment.contactId) : null;
      const mailbox = enrollment?.mailboxId ? mailboxes.find(item => item.id === enrollment.mailboxId) : null;
      const productLine = enrollment?.productLineId
        ? productLines.find(item => item.id === enrollment.productLineId) || null
        : null;

      if (!enrollment || !message || !account || !contact || !mailbox || mailbox.status !== 'active') return null;

      return {
        enrollment,
        account,
        contact,
        productLine,
        mailbox,
        firstMessage: message,
        messages: [message]
      };
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

      const skippedMessages = messages.filter(
        item => item.enrollmentId === enrollment.id && item.organizationId === input.organizationId && item.status === 'queued'
      );

      for (const message of skippedMessages) {
        Object.assign(message, {
          status: 'skipped',
          bullJobId: null,
          updatedAt: new Date('2026-06-18T10:00:00.000Z')
        });
      }
      const message = skippedMessages[0] ?? null;

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

      Object.assign(message, {
        status: 'sent',
        sentAt: input.sentAt,
        providerMessageId: input.providerMessageId ?? null,
        providerThreadId: input.providerThreadId ?? null,
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      });
      const event = createTimelineEvent({
        accountId: enrollment.accountId,
        contactId: enrollment.contactId,
        eventType: 'message_sent',
        title: '首封开发信已发送',
        content: message.subject
      });
      const nextMessage = input.nextMessage
        ? createMessage({
            ...input.nextMessage,
            id: `message-${messages.length + 1}`,
            enrollmentId: enrollment.id
          })
        : null;

      if (nextMessage) {
        messages.push(nextMessage);
      }

      timelineEvents.push(event);

      return { enrollment, message, nextMessage, account, event };
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
    async markMailboxAuthorizationExpired(input) {
      const mailbox = mailboxes.find(
        item =>
          item.id === input.mailboxId &&
          item.organizationId === input.organizationId &&
          item.ownerUserId === input.ownerUserId
      );

      if (!mailbox) return null;

      Object.assign(mailbox, {
        status: 'auth_expired',
        watchExpiration: null,
        pausedAt: input.expiredAt,
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      });

      let pausedEnrollmentCount = 0;
      let resetMessageCount = 0;

      for (const enrollment of enrollments) {
        if (
          enrollment.organizationId === input.organizationId &&
          enrollment.ownerUserId === input.ownerUserId &&
          enrollment.mailboxId === input.mailboxId &&
          ['ready_to_send', 'sequence_running'].includes(enrollment.status)
        ) {
          Object.assign(enrollment, {
            status: 'paused',
            runVersion: enrollment.runVersion + 1,
            updatedAt: new Date('2026-06-18T10:00:00.000Z')
          });
          pausedEnrollmentCount += 1;
        }
      }

      for (const message of messages) {
        if (
          message.organizationId === input.organizationId &&
          message.ownerUserId === input.ownerUserId &&
          message.mailboxId === input.mailboxId &&
          message.status === 'queued'
        ) {
          Object.assign(message, {
            status: 'draft_ready',
            bullJobId: null,
            updatedAt: new Date('2026-06-18T10:00:00.000Z')
          });
          resetMessageCount += 1;
        }
      }

      return { mailbox, pausedEnrollmentCount, resetMessageCount };
    },
    async advanceMailboxHistoryId(input) {
      const mailbox = mailboxes.find(
        item =>
          item.id === input.mailboxId &&
          item.organizationId === input.organizationId &&
          item.ownerUserId === input.ownerUserId &&
          item.lastHistoryId === input.fromHistoryId
      );

      if (!mailbox) return null;

      Object.assign(mailbox, {
        lastHistoryId: input.toHistoryId,
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      });

      return mailbox;
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
        providerMessageId: input.providerMessageId ?? null,
        messageType: input.messageType ?? 'customer_reply'
      });
      inboxMessages.push(inboxMessage);
      const isUnsubscribeHint = inboxMessage.messageType === 'unsubscribe_hint';
      const isBounce = inboxMessage.messageType === 'bounce';
      if (isUnsubscribeHint) {
        await this.upsertBlacklistEntry({
          organizationId: input.organizationId,
          emailHash: contact.emailHash,
          maskedEmail: contact.maskedEmail,
          reason: 'unsubscribe',
          sourceAccountId: account.id,
          sourceContactId: contact.id,
          sourceMessageId: inboxMessage.id,
          createdById: input.ownerUserId,
          createdByName: mailbox?.ownerUserName ?? null
        });
      }
      Object.assign(account, {
        status: isUnsubscribeHint ? 'blocked' : isBounce ? 'manual_review_pending' : 'replied_pending',
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      });
      if (isUnsubscribeHint || isBounce) {
        Object.assign(contact, {
          emailStatus: isUnsubscribeHint ? 'unsubscribed' : 'unreachable',
          updatedAt: new Date('2026-06-18T10:00:00.000Z')
        });
      }

      for (const activeEnrollment of enrollments) {
        if (
          activeEnrollment.organizationId === input.organizationId &&
          activeEnrollment.ownerUserId === input.ownerUserId &&
          activeEnrollment.accountId === outboundMessage.accountId &&
          ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused'].includes(activeEnrollment.status)
        ) {
          Object.assign(activeEnrollment, {
            status: 'replied',
            runVersion: activeEnrollment.runVersion + 1,
            updatedAt: new Date('2026-06-18T10:00:00.000Z')
          });
        }
      }
      for (const queuedMessage of messages) {
        if (
          queuedMessage.organizationId === input.organizationId &&
          queuedMessage.ownerUserId === input.ownerUserId &&
          queuedMessage.accountId === outboundMessage.accountId &&
          queuedMessage.status === 'queued'
        ) {
          Object.assign(queuedMessage, {
            status: 'skipped',
            bullJobId: null,
            updatedAt: new Date('2026-06-18T10:00:00.000Z')
          });
        }
      }

      const event = createTimelineEvent({
        accountId: outboundMessage.accountId,
        contactId: outboundMessage.contactId,
        ownerUserId: input.ownerUserId,
        eventType: isUnsubscribeHint ? 'customer_unsubscribed' : isBounce ? 'email_bounced' : 'customer_replied',
        title: isUnsubscribeHint ? '客户要求停止联系' : isBounce ? '邮件退信' : '客户回信',
        content: input.subject,
        metadata: {
          enrollmentId: outboundMessage.enrollmentId,
          outboundMessageId: outboundMessage.id,
          inboxThreadId: thread.id,
          inboxMessageId: inboxMessage.id,
          messageType: inboxMessage.messageType
        }
      });
      timelineEvents.push(event);

      return { thread, message: inboxMessage, account, contact, mailbox: mailbox ?? null, enrollment: enrollment ?? null, event, isDuplicate: false };
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
    },
    async syncInboxThreadGmailState(input) {
      const thread = inboxThreads.find(item => {
        if (item.organizationId !== input.organizationId) return false;
        if (item.ownerUserId !== input.ownerUserId) return false;
        if (item.mailboxId !== input.mailboxId) return false;
        if (item.providerThreadId !== input.providerThreadId) return false;
        return true;
      });
      const account = thread ? accounts.find(item => item.id === thread.accountId) : null;

      if (!thread || !account) return null;

      const isArchived =
        input.changeType === 'message_deleted' ||
        (input.changeType === 'labels_removed' && input.labelIds.includes('INBOX')) ||
        (input.changeType === 'labels_added' && input.labelIds.includes('TRASH'));
      const nextStatus = isArchived
        ? 'archived'
        : input.changeType === 'labels_removed' && input.labelIds.includes('UNREAD')
          ? 'handled'
          : input.changeType === 'labels_added' && input.labelIds.includes('UNREAD')
            ? 'pending'
            : null;

      if (!nextStatus) return null;

      Object.assign(thread, {
        status: nextStatus,
        unreadCount: nextStatus === 'pending' ? Math.max(thread.unreadCount, 1) : 0,
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      });

      const event = createTimelineEvent({
        accountId: thread.accountId,
        contactId: thread.contactId,
        ownerUserId: input.ownerUserId,
        eventType: isArchived ? 'gmail_thread_archived' : 'gmail_label_synced',
        title: isArchived ? 'Gmail 状态同步为归档' : 'Gmail 标签状态同步',
        content: thread.subject,
        metadata: {
          providerMessageId: input.providerMessageId,
          providerThreadId: input.providerThreadId,
          changeType: input.changeType,
          labelIds: input.labelIds
        }
      });
      timelineEvents.push(event);

      return { thread, account, event };
    },
    async replyInboxThread(input) {
      const thread = inboxThreads.find(item => {
        if (item.id !== input.id) return false;
        if (item.organizationId !== input.organizationId) return false;
        if (item.ownerUserId !== input.ownerUserId) return false;
        return true;
      });
      const account = thread ? accounts.find(item => item.id === thread.accountId) : null;
      const contact = thread ? contacts.find(item => item.id === thread.contactId) : null;
      const mailbox = thread?.mailboxId ? mailboxes.find(item => item.id === thread.mailboxId) : null;
      const enrollment = thread?.enrollmentId ? enrollments.find(item => item.id === thread.enrollmentId) : null;

      if (!thread || !account || !contact || !mailbox || mailbox.status !== 'active') return null;

      const message = createInboxMessage({
        id: `outbox-message-${inboxMessages.length + 1}`,
        threadId: thread.id,
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        accountId: thread.accountId,
        contactId: thread.contactId,
        enrollmentId: thread.enrollmentId,
        mailboxId: thread.mailboxId,
        providerMessageId: input.providerMessageId ?? null,
        replyToMessageId: inboxMessages.filter(item => item.threadId === thread.id).at(-1)?.id ?? null,
        fromEmail: mailbox.emailAddress,
        fromEmailHash: mailbox.emailHash,
        maskedFromEmail: mailbox.maskedEmail,
        subject: input.subject,
        snippet: input.bodyText,
        bodyText: input.bodyText,
        receivedAt: input.sentAt,
        messageType: 'customer_reply'
      });
      inboxMessages.push(message);
      Object.assign(thread, {
        status: 'handled',
        unreadCount: 0,
        messageCount: thread.messageCount + 1,
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      });
      Object.assign(account, { status: 'followed_up', updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      const event = createTimelineEvent({
        accountId: thread.accountId,
        contactId: thread.contactId,
        ownerUserId: input.ownerUserId,
        eventType: 'inbox_replied',
        title: '已在系统内回复',
        content: input.subject,
        metadata: {
          threadId: thread.id,
          inboxMessageId: message.id,
          providerMessageId: input.providerMessageId ?? null
        }
      });
      timelineEvents.push(event);

      return { thread, message, account, contact, mailbox, enrollment: enrollment ?? null, event };
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
    archivedAt: input.archivedAt ?? null,
    archiveReason: input.archiveReason ?? null,
    archiveSlimmedAt: input.archiveSlimmedAt ?? null,
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

function createArchivedFingerprint(input: Partial<TestArchivedFingerprint> = {}): TestArchivedFingerprint {
  return {
    id: input.id || 'archived-fingerprint-1',
    organizationId: input.organizationId || 'org-1',
    fingerprintType: input.fingerprintType || 'domain',
    fingerprintValue: input.fingerprintValue || 'account.example',
    maskedValue: input.maskedValue ?? 'account.example',
    accountName: input.accountName ?? 'Account',
    normalizedName: input.normalizedName ?? 'account',
    country: input.country ?? null,
    sourceAccountId: input.sourceAccountId ?? 'account-1',
    sourceContactId: input.sourceContactId ?? null,
    sourceTaskId: input.sourceTaskId ?? null,
    archiveReason: input.archiveReason ?? null,
    archivedAt: input.archivedAt || new Date('2026-06-18T09:00:00.000Z'),
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createBlacklist(input: Partial<TestBlacklist> = {}): TestBlacklist {
  return {
    id: input.id || 'blacklist-1',
    organizationId: input.organizationId || 'org-1',
    emailHash: input.emailHash || 'hash-1',
    maskedEmail: input.maskedEmail || 'a***@example.com',
    reason: input.reason || 'unsubscribe',
    sourceAccountId: input.sourceAccountId ?? 'account-1',
    sourceContactId: input.sourceContactId ?? 'contact-1',
    sourceMessageId: input.sourceMessageId ?? null,
    createdById: input.createdById ?? 'user-1',
    createdByName: input.createdByName ?? 'Alice',
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createEmailVerificationCache(input: Partial<TestEmailVerificationCache> = {}): TestEmailVerificationCache {
  return {
    id: input.id || 'email-verification-cache-1',
    emailHash: input.emailHash || 'hash-1',
    maskedEmail: input.maskedEmail || 'a***@example.com',
    domain: input.domain ?? 'example.com',
    status: input.status || 'valid',
    reason: input.reason || 'mx_found',
    verifiedAt: input.verifiedAt || new Date('2026-06-18T09:00:00.000Z'),
    expiresAt: input.expiresAt || new Date('2026-07-18T09:00:00.000Z'),
    checkedById: input.checkedById ?? 'user-1',
    checkedByName: input.checkedByName ?? 'Alice',
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createGlobalConfig(input: Partial<TestGlobalConfig> = {}): TestGlobalConfig {
  return {
    configKey: input.configKey || 'default',
    emailVerificationCooldownDays: input.emailVerificationCooldownDays ?? 30,
    followUpDelayDays: input.followUpDelayDays ?? {
      step2Days: 3,
      step3Days: 7,
      step4Days: 14,
      step5Days: 21
    },
    updatedAt: input.updatedAt || new Date(0)
  };
}

function createOrganizationConfig(input: Partial<TestOrganizationConfig> = {}): TestOrganizationConfig {
  return {
    id: input.id || 'crm-organization-config-1',
    organizationId: input.organizationId || 'org-1',
    allowAdminViewMemberEmailBody: input.allowAdminViewMemberEmailBody ?? false,
    updatedById: input.updatedById ?? 'user-1',
    updatedByName: input.updatedByName ?? 'Alice',
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T10:00:00.000Z')
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
    encryptedRefreshToken: input.encryptedRefreshToken ?? null,
    watchExpiration: input.watchExpiration ?? null,
    lastHistoryId: input.lastHistoryId ?? null,
    syncIssueType: input.syncIssueType ?? null,
    syncIssueAt: input.syncIssueAt ?? null,
    syncIssueMessage: input.syncIssueMessage ?? null,
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

function createEmailTemplateStep(
  input: Partial<TestEmailTemplateGroup['steps'][number]> = {},
  templateGroupId = 'template-1',
  fallbackStepIndex = 1
): TestEmailTemplateGroup['steps'][number] {
  const stepIndex = input.stepIndex ?? fallbackStepIndex;

  return {
    id: input.id || `template-step-${stepIndex}`,
    organizationId: input.organizationId || 'org-1',
    templateGroupId: input.templateGroupId || templateGroupId,
    stepIndex,
    name: input.name || `Step ${stepIndex}`,
    threadMode: input.threadMode || (stepIndex === 2 ? 'same_thread' : 'new_subject'),
    delayDays: input.delayDays ?? (stepIndex === 1 ? 0 : stepIndex * 2),
    subjectTemplate: input.subjectTemplate ?? (stepIndex === 2 ? '' : `Subject ${stepIndex}`),
    bodyTemplate: input.bodyTemplate || `Body ${stepIndex}`,
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createEmailTemplateSteps(
  input: Partial<TestEmailTemplateGroup['steps'][number]> = {}
): TestEmailTemplateGroup['steps'] {
  return [1, 2, 3, 4, 5].map(stepIndex => createEmailTemplateStep({ ...input, stepIndex }, 'template-1', stepIndex));
}

function createEmailTemplateGroup(input: Partial<TestEmailTemplateGroup> = {}): TestEmailTemplateGroup {
  return {
    id: input.id || 'template-1',
    organizationId: input.organizationId || 'org-1',
    name: input.name || 'Default follow-up',
    language: input.language || 'en',
    description: input.description ?? null,
    status: input.status || 'active',
    isDefault: input.isDefault ?? false,
    steps: input.steps ?? createEmailTemplateSteps(),
    createdById: input.createdById || 'user-1',
    createdByName: input.createdByName ?? 'Alice',
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createEmailTemplatePayload(input: Partial<TestEmailTemplateGroup> = {}) {
  return {
    name: input.name || 'Starter sequence',
    language: input.language || 'en',
    description: input.description ?? 'Editable sequence',
    steps: (input.steps ?? createEmailTemplateSteps()).map(step => ({
      stepIndex: step.stepIndex,
      name: step.name,
      threadMode: step.threadMode,
      delayDays: step.delayDays,
      subjectTemplate: step.subjectTemplate,
      bodyTemplate: step.bodyTemplate
    }))
  };
}

function createSequencePolicy(input: Partial<TestSequencePolicy> = {}): TestSequencePolicy {
  return {
    id: input.id || 'policy-1',
    organizationId: input.organizationId || 'org-1',
    name: input.name || 'Default sequence policy',
    description: input.description ?? null,
    status: input.status || 'active',
    isDefault: input.isDefault ?? false,
    steps: input.steps ?? [
      { stepIndex: 1, delayDays: 0, threadMode: 'new_subject' },
      { stepIndex: 2, delayDays: 3, threadMode: 'same_thread' },
      { stepIndex: 3, delayDays: 7, threadMode: 'new_subject' },
      { stepIndex: 4, delayDays: 14, threadMode: 'new_subject' },
      { stepIndex: 5, delayDays: 21, threadMode: 'new_subject' }
    ],
    linkPolicy: input.linkPolicy || 'preserve_template_links',
    allowLowRiskAutoSend: input.allowLowRiskAutoSend ?? false,
    sameCompanyContactStrategy: input.sameCompanyContactStrategy || 'single_active_per_company',
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
    policyId: input.policyId ?? null,
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
    providerMessageId: input.providerMessageId ?? null,
    providerThreadId: input.providerThreadId ?? null,
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
    sequencePolicies?: TestSequencePolicy[];
    messages: TestMessage[];
  }
): CrmSequenceReviewRecord[] {
  return enrollments.map(enrollment => {
    const messages = data.messages
      .filter(message => message.enrollmentId === enrollment.id)
      .sort((left, right) => left.stepIndex - right.stepIndex || left.createdAt.getTime() - right.createdAt.getTime());

    return {
      enrollment,
      account: data.accounts.find(account => account.id === enrollment.accountId) || createAccount({ id: enrollment.accountId }),
      contact: data.contacts.find(contact => contact.id === enrollment.contactId) || createContact({ id: enrollment.contactId }),
      productLine: enrollment.productLineId
        ? data.productLines.find(productLine => productLine.id === enrollment.productLineId) || null
        : null,
      mailbox: enrollment.mailboxId ? data.mailboxes.find(mailbox => mailbox.id === enrollment.mailboxId) || null : null,
      policy: enrollment.policyId
        ? data.sequencePolicies?.find(policy => policy.id === enrollment.policyId) || null
        : null,
      firstMessage: messages.find(message => message.stepIndex === 1) || messages[0] || null,
      messages
    };
  });
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
type TestArchivedFingerprint = CrmArchivedFingerprintRecord;
type TestBlacklist = CrmBlacklistRecord;
type TestContact = Awaited<ReturnType<CrmStore['createContact']>>;
type TestEmailVerificationCache = CrmEmailVerificationCacheRecord;
type TestGlobalConfig = CrmGlobalConfigRecord;
type TestOrganizationConfig = CrmOrganizationConfigRecord;
type TestTimelineEvent = Awaited<ReturnType<CrmStore['createTimelineEvent']>>;
type TestMailbox = CrmMailboxRecord;
type TestEmailTemplateGroup = CrmEmailTemplateGroupRecord;
type TestSequencePolicy = CrmSequencePolicyRecord;
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

function createOAuthFlow(input: {
  mailbox?: Awaited<ReturnType<CrmGmailOAuthFlowPort['exchangeCodeForMailbox']>>;
} = {}) {
  const createUrlCalls: Array<{ organizationId: string; userId: string }> = [];
  const verifyStateCalls: Array<{ state: string; context: { organizationId: string; userId: string } }> = [];
  const exchangeCodeCalls: string[] = [];
  const flow: CrmGmailOAuthFlowPort & {
    createUrlCalls: typeof createUrlCalls;
    verifyStateCalls: typeof verifyStateCalls;
    exchangeCodeCalls: typeof exchangeCodeCalls;
  } = {
    createUrlCalls,
    verifyStateCalls,
    exchangeCodeCalls,
    createAuthorizationUrl(context) {
      createUrlCalls.push(context);

      return {
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=state-1',
        state: 'state-1'
      };
    },
    verifyState(state, context): CrmGmailOAuthStatePayload {
      verifyStateCalls.push({ state, context });

      return {
        organizationId: context.organizationId,
        userId: context.userId,
        issuedAt: '2026-06-19T08:00:00.000Z',
        nonce: 'nonce-1'
      };
    },
    async exchangeCodeForMailbox(code) {
      exchangeCodeCalls.push(code);

      return (
        input.mailbox ?? {
          emailAddress: 'alice@gmail.com',
          historyId: '1001',
          encryptedRefreshToken: 'encrypted-refresh-token-1'
        }
      );
    }
  };

  return flow;
}

function createSendQueue(
  error?: Error
): CrmSendQueuePort & { jobs: CrmSendQueueJob[]; options: Array<{ delayMs?: number }> } {
  const jobs: CrmSendQueueJob[] = [];
  const options: Array<{ delayMs?: number }> = [];

  return {
    jobs,
    options,
    async enqueueFirstMessage(input, enqueueOptions) {
      if (error) {
        throw error;
      }

      jobs.push(input);
      options.push(enqueueOptions ?? {});
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
