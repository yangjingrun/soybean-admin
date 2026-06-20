import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { SystemLogRecordInput, SystemLogRecorder } from '../system-log/system-log.types';
import type { CrmGmailOAuthFlowPort, CrmGmailOAuthStatePayload } from './crm-gmail-oauth-flow';
import { CrmGmailWatchService } from './crm-gmail-watch.service';
import { CrmAiDraftService } from './crm-ai-draft.service';
import type { CrmAiDraftPromptInput } from './crm-ai-draft.types';
import type { CrmAiDraftTaskQueueJob, CrmAiDraftTaskQueuePort } from './crm-ai-draft-task.types';
import type { CrmAiReplyDraftPromptInput } from './crm-ai-reply-draft.types';
import { CrmService } from './crm.service';
import { CrmDraftApprovalService } from './sequence/crm-draft-approval.service';
import { CrmDraftService } from './sequence/crm-draft.service';
import { CrmSequenceService } from './sequence/crm-sequence.service';
import { CrmLoggerService } from './shared/crm-logger.service';
import type {
  CrmArchivedFingerprintRecord,
  CrmAiDraftQueueConfigInput,
  CrmAiDraftQueueConfigRecord,
  CrmAiDraftTaskCreateInput,
  CrmAiDraftTaskItemRecord,
  CrmAiDraftTaskRecord,
  CrmBlacklistRecord,
  CrmEmailTemplateGroupRecord,
  CrmEmailVerificationCacheRecord,
  CrmGlobalConfigRecord,
  CrmInboxMessageRecord,
  CrmInboxThreadRecord,
  CrmMailboxRecord,
  CrmEmailSendGateway,
  CrmOrganizationConfigRecord,
  CrmPersonaProfileRecord,
  CrmProductLineAiPromptVersionRecord,
  CrmProductLineRecord,
  CrmSendQueueJob,
  CrmSendQueuePort,
  CrmSendPreferenceRecord,
  CrmSequencePolicyRecord,
  CrmSequenceReviewRecord,
  CrmStore,
  CrmUserContext
} from './crm.types';

describe('CrmService', () => {
  it('delegates account facade reads when the split account service is injected', async () => {
    const context = createContext();
    const query = { keyword: 'abc bearing' };
    const expected = { records: [] };
    const accountService = {
      async listAccounts(actualContext: CrmUserContext, actualQuery: typeof query) {
        assert.equal(actualContext, context);
        assert.equal(actualQuery, query);
        return expected;
      }
    };
    const service = createServiceWithSplitServices({ accountService });

    assert.equal(await service.listAccounts(context, query), expected);
  });

  it('delegates suppression facade reads when the split suppression service is injected', async () => {
    const context = createContext();
    const query = { keyword: 'blocked@example.com' };
    const expected = { records: [] };
    const suppressionService = {
      async listBlacklistEntries(actualContext: CrmUserContext, actualQuery: typeof query) {
        assert.equal(actualContext, context);
        assert.equal(actualQuery, query);
        return expected;
      }
    };
    const service = createServiceWithSplitServices({ suppressionService });

    assert.equal(await service.listBlacklistEntries(context, query), expected);
  });

  it('delegates mailbox facade reads when the split mailbox service is injected', async () => {
    const context = createContext();
    const query = { status: 'active' as const };
    const expected = { records: [] };
    const mailboxService = {
      async listMailboxes(actualContext: CrmUserContext, actualQuery: typeof query) {
        assert.equal(actualContext, context);
        assert.equal(actualQuery, query);
        return expected;
      }
    };
    const service = createServiceWithSplitServices({ mailboxService });

    assert.equal(await service.listMailboxes(context, query), expected);
  });

  it('delegates sequence review facade methods when the split sequence service is injected', async () => {
    const context = createContext();
    const createInput = { accountId: 'account-1', contactId: 'contact-1' };
    const query = { keyword: 'abc' };
    const created = { item: { id: 'created' } };
    const listed = { records: [] };
    const detail = { id: 'detail' };
    const calls: string[] = [];
    const sequenceService = {
      async createSequenceReviewItem(actualInput: typeof createInput, actualContext: CrmUserContext) {
        assert.equal(actualInput, createInput);
        assert.equal(actualContext, context);
        calls.push('create');
        return created;
      },
      async listSequenceReviewItems(actualContext: CrmUserContext, actualQuery: typeof query) {
        assert.equal(actualContext, context);
        assert.equal(actualQuery, query);
        calls.push('list');
        return listed;
      },
      async getSequenceReviewItem(actualId: string, actualContext: CrmUserContext) {
        assert.equal(actualId, 'enrollment-1');
        assert.equal(actualContext, context);
        calls.push('detail');
        return detail;
      }
    };
    const service = createServiceWithSplitServices({ sequenceService });

    assert.equal(await service.createSequenceReviewItem(createInput, context), created);
    assert.equal(await service.listSequenceReviewItems(context, query), listed);
    assert.equal(await service.getSequenceReviewItem('enrollment-1', context), detail);
    assert.deepEqual(calls, ['create', 'list', 'detail']);
  });

  it('delegates draft content facade methods when the split draft service is injected', async () => {
    const context = createContext();
    const updateInput = { subject: 'Subject', bodyText: 'Body' };
    const updated = { message: { id: 'updated' } };
    const regenerated = { message: { id: 'regenerated' } };
    const versions = { versions: [] };
    const restored = { message: { id: 'restored' } };
    const calls: string[] = [];
    const draftService = {
      async updateMessageDraft(id: string, input: typeof updateInput, actualContext: CrmUserContext) {
        assert.equal(id, 'message-1');
        assert.equal(input, updateInput);
        assert.equal(actualContext, context);
        calls.push('update');
        return updated;
      },
      async regenerateMessageAiDraft(id: string, actualContext: CrmUserContext) {
        assert.equal(id, 'message-1');
        assert.equal(actualContext, context);
        calls.push('regenerate');
        return regenerated;
      },
      async listMessageDraftVersions(id: string, actualContext: CrmUserContext) {
        assert.equal(id, 'message-1');
        assert.equal(actualContext, context);
        calls.push('versions');
        return versions;
      },
      async restoreMessageDraftVersion(id: string, versionId: string, actualContext: CrmUserContext) {
        assert.equal(id, 'message-1');
        assert.equal(versionId, 'draft-version-1');
        assert.equal(actualContext, context);
        calls.push('restore');
        return restored;
      }
    };
    const service = createServiceWithSplitServices({ draftService });

    assert.equal(await service.updateMessageDraft('message-1', updateInput, context), updated);
    assert.equal(await service.regenerateMessageAiDraft('message-1', context), regenerated);
    assert.equal(await service.listMessageDraftVersions('message-1', context), versions);
    assert.equal(await service.restoreMessageDraftVersion('message-1', 'draft-version-1', context), restored);
    assert.deepEqual(calls, ['update', 'regenerate', 'versions', 'restore']);
  });

  it('delegates first draft approval when the split draft approval service is injected', async () => {
    const context = createContext();
    const expected = { message: { id: 'approved' }, enrollment: { id: 'enrollment-1' } };
    const store = createStore([createAccount({ id: 'account-1' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      enrollments: [createEnrollment({ id: 'enrollment-1', accountId: 'account-1', contactId: 'contact-1' })],
      messages: [createMessage({ id: 'message-1', enrollmentId: 'enrollment-1', stepIndex: 1 })]
    });
    const draftApprovalService = {
      async approveInitialMessageDraft(id: string, actualContext: CrmUserContext) {
        assert.equal(id, 'message-1');
        assert.equal(actualContext, context);
        return expected;
      }
    };
    const service = createServiceWithSplitServices({ store, draftApprovalService });

    assert.equal(await service.approveMessageDraft('message-1', context), expected);
    assert.equal(store.sequenceReviewDetailCalls.length, 0);
  });

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
    assert.equal(
      store.timelineEvents.some(event => event.eventType === 'email_verified'),
      true
    );
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

  it('saves CRM global owner send concurrency and daily hard limits with sanitized business log metadata', async () => {
    const store = createStore();
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service);

    const saved = await service.saveGlobalConfig(
      {
        emailVerificationCooldownDays: 45,
        ownerConcurrentSendLimit: 8,
        ownerDailySendLimitMax: 120,
        followUpDelayDays: {
          step2Days: 2,
          step3Days: 4,
          step4Days: 8,
          step5Days: 16
        }
      },
      createContext({ roles: ['R_SUPER'] })
    );

    assert.equal(saved.ownerConcurrentSendLimit, 8);
    assert.equal(saved.ownerDailySendLimitMax, 120);
    assert.equal(store.globalConfig.ownerConcurrentSendLimit, 8);
    assert.equal(store.globalConfig.ownerDailySendLimitMax, 120);
    assert.equal(logs.records[0]?.action, 'save-global-config');
    const metadata = logs.records[0]?.metadata as
      | { ownerConcurrentSendLimit?: number; ownerDailySendLimitMax?: number }
      | undefined;

    assert.equal(metadata?.ownerConcurrentSendLimit, 8);
    assert.equal(metadata?.ownerDailySendLimitMax, 120);
  });

  it('saves current owner send preference within the platform daily hard limit', async () => {
    const store = createStore([], {
      globalConfig: createGlobalConfig({ ownerDailySendLimitMax: 80 })
    });
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service);

    const current = await service.getSendPreference(createContext());
    const saved = await service.saveSendPreference(
      {
        dailySendLimit: 60,
        followUpSharePercent: 75
      },
      createContext()
    );

    assert.equal(current.dailySendLimit, 50);
    assert.equal(current.ownerDailySendLimitMax, 80);
    assert.equal(saved.dailySendLimit, 60);
    assert.equal(saved.followUpSharePercent, 75);
    assert.equal(saved.ownerDailySendLimitMax, 80);
    assert.equal(store.sendPreferences[0].ownerUserId, 'user-1');
    assert.equal(logs.records[0]?.action, 'save-send-preference');
    await assert.rejects(
      () => service.saveSendPreference({ dailySendLimit: 81, followUpSharePercent: 70 }, createContext()),
      /不能超过平台硬上限 80 封/
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
    assert.equal(
      store.timelineEvents.some(event => event.eventType === 'email_verified'),
      true
    );
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
    assert.equal(
      store.timelineEvents.some(event => event.eventType === 'archived_fingerprint_matched'),
      true
    );
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

    await assert.rejects(
      () => service.addAccountNote('account-1', { content: '   ' }, createContext()),
      BadRequestException
    );
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
    const service = new CrmService(
      store,
      createDnsResolver([{ exchange: 'mx.example.com', priority: 10 }]),
      logs.service
    );

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
    assert.equal(
      (store.timelineEvents.at(-1)?.metadata as { reason: string } | undefined)?.reason,
      'dns_temporary_failure'
    );
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
    assert.equal(result.mailbox.lastHistoryId, '1001');
    assert.equal(result.mailbox.watchExpiration, '2026-06-26T08:00:00.000Z');
    assert.equal(store.mailboxes[0].lastHistoryId, '1001');
    assert.equal('lastHistoryId' in (store.mailboxUpdateCalls[0]?.input ?? {}), false);
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
    assert.deepEqual(
      logs.records.map(record => record.metadata),
      [
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
      ]
    );
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

  it('creates the initial AI prompt version when a product line starts with AI writing config', async () => {
    const store = createStore();
    const service = new CrmService(store);
    const aiWritingConfig = createAiWritingConfig();

    const result = await service.createProductLine(
      {
        name: 'Bearing Series',
        aiWritingConfig
      },
      createContext({ organizationRole: 'admin' })
    );

    assert.equal(result.productLine.aiWritingConfig?.enabled, true);
    assert.equal(store.productLinePromptVersions.length, 1);
    assert.equal(store.productLinePromptVersions[0].productLineId, 'product-line-1');
    assert.equal(store.productLinePromptVersions[0].version, 1);
    assert.deepEqual(store.productLinePromptVersions[0].aiWritingConfig, aiWritingConfig);
    assert.equal(store.productLinePromptVersions[0].editorId, 'user-1');
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

  it('adds a product line AI prompt version only when the normalized config changes', async () => {
    const aiWritingConfig = createAiWritingConfig();
    const store = createStore([], {
      productLines: [createProductLine({ id: 'line-1', aiWritingConfig })],
      productLinePromptVersions: [
        createProductLinePromptVersion({
          productLineId: 'line-1',
          version: 1,
          aiWritingConfig
        })
      ]
    });
    const service = new CrmService(store);
    const adminContext = createContext({ organizationRole: 'admin' });

    await service.updateProductLine(
      'line-1',
      {
        aiWritingConfig: {
          ...aiWritingConfig,
          commonRequirements: `  ${aiWritingConfig.commonRequirements}  `
        }
      },
      adminContext
    );
    await service.updateProductLine(
      'line-1',
      {
        aiWritingConfig: {
          ...aiWritingConfig,
          productEmphasis: 'Focus on sealed bearings.'
        }
      },
      adminContext
    );

    assert.equal(store.productLinePromptVersions.length, 2);
    assert.equal(store.productLinePromptVersions[1].version, 2);
    assert.equal(store.productLinePromptVersions[1].changeSummary, 'AI 写信配置更新');
    assert.equal(store.productLinePromptVersions[1].aiWritingConfig?.productEmphasis, 'Focus on sealed bearings.');
  });

  it('lists product line AI prompt versions for organization members in version descending order', async () => {
    const store = createStore([], {
      productLines: [createProductLine({ id: 'line-1' })],
      productLinePromptVersions: [
        createProductLinePromptVersion({ id: 'version-1', productLineId: 'line-1', version: 1 }),
        createProductLinePromptVersion({ id: 'version-2', productLineId: 'line-1', version: 2 })
      ]
    });
    const service = new CrmService(store);

    const result = await service.listProductLineAiPromptVersions('line-1', createContext());

    assert.deepEqual(
      result.records.map(record => record.version),
      [2, 1]
    );
    assert.deepEqual(store.lastProductLinePromptVersionListArgs, {
      organizationId: 'org-1',
      productLineId: 'line-1'
    });
  });

  it('restores a product line AI prompt version for admins and writes a sanitized business log', async () => {
    const currentConfig = createAiWritingConfig();
    const historicConfig = { ...currentConfig, productEmphasis: 'Restore historic emphasis.' };
    const store = createStore([], {
      productLines: [createProductLine({ id: 'line-1', aiWritingConfig: currentConfig })],
      productLinePromptVersions: [
        createProductLinePromptVersion({
          id: 'version-1',
          productLineId: 'line-1',
          version: 1,
          aiWritingConfig: historicConfig
        }),
        createProductLinePromptVersion({
          id: 'version-2',
          productLineId: 'line-1',
          version: 2,
          aiWritingConfig: currentConfig
        })
      ]
    });
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service);

    const result = await service.restoreProductLineAiPromptVersion(
      'line-1',
      'version-1',
      createContext({ organizationRole: 'admin' })
    );

    assert.equal(result.productLine.aiWritingConfig?.productEmphasis, 'Restore historic emphasis.');
    assert.equal(store.productLinePromptVersions.length, 3);
    assert.equal(store.productLinePromptVersions[2].version, 3);
    assert.equal(store.productLinePromptVersions[2].changeSummary, '恢复版本 1');
    assert.deepEqual(logs.records.at(-1)?.metadata, {
      organizationId: 'org-1',
      productLineId: 'line-1',
      restoredVersionId: 'version-1',
      restoredVersion: 1,
      newVersion: 3
    });
  });

  it('rejects member attempts to restore product line AI prompt versions', async () => {
    const store = createStore([], {
      productLines: [createProductLine({ id: 'line-1', aiWritingConfig: createAiWritingConfig() })],
      productLinePromptVersions: [createProductLinePromptVersion({ id: 'version-1', productLineId: 'line-1' })]
    });
    const service = new CrmService(store);

    await assert.rejects(
      () => service.restoreProductLineAiPromptVersion('line-1', 'version-1', createContext()),
      ForbiddenException
    );

    assert.equal(store.productLinePromptVersions.length, 1);
  });

  it('maps concurrent product line rename unique conflicts to business errors', async () => {
    const store = createStore([], {
      productLines: [createProductLine({ id: 'line-1', name: 'Bearing Series' })]
    });
    store.updateProductLine = async () => {
      throw createPrismaUniqueError();
    };
    const service = new CrmService(store);

    await assert.rejects(
      () => service.updateProductLine('line-1', { name: 'Premium Bearing Series' }, createContext()),
      {
        message: '产品资料名称已存在'
      }
    );
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
    assert.equal(
      result.personas.some(persona => persona.label === 'Purchasing Manager'),
      true
    );
  });

  it('lets organization admins manage persona profiles while members can only read them', async () => {
    const store = createStore([], {
      personaProfiles: [
        createPersonaProfile({
          id: 'persona-1',
          name: 'Procurement profile',
          titleKeywordsText: 'procurement\nbuyer',
          customerTypeKeywordsText: 'distributor',
          isDefault: true
        })
      ]
    });
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service);
    const adminContext = createContext({ organizationRole: 'admin' });

    const list = await service.listPersonaProfiles(createContext(), {
      keyword: ' procurement ',
      status: 'active'
    });
    const created = await service.createPersonaProfile(
      {
        name: '  Operations buyer  ',
        titleKeywordsText: '  ops\nsupply chain  ',
        customerTypeKeywordsText: '  wholesaler  ',
        painPoints: '  stockouts and late replenishment  ',
        focusText: '  replenishment speed and supply stability  ',
        avoidText: '  avoid overpromising delivery dates  '
      },
      adminContext
    );
    const defaulted = await service.setDefaultPersonaProfile(created.personaProfile.id, adminContext);
    const archived = await service.archivePersonaProfile(created.personaProfile.id, adminContext);

    assert.deepEqual(
      list.records.map(record => record.id),
      ['persona-1']
    );
    assert.deepEqual(store.lastPersonaProfileListArgs, {
      organizationId: 'org-1',
      skip: 0,
      take: 20,
      keyword: 'procurement',
      status: 'active'
    });
    assert.equal(created.personaProfile.name, 'Operations buyer');
    assert.equal(created.personaProfile.titleKeywordsText, 'ops\nsupply chain');
    assert.equal(defaulted.personaProfile.isDefault, true);
    assert.equal(archived.personaProfile.status, 'archived');
    assert.equal(archived.personaProfile.isDefault, false);
    assert.deepEqual(
      logs.records.map(record => record.action),
      ['persona-profile-create', 'persona-profile-default', 'persona-profile-archive']
    );
    await assert.rejects(
      () => service.createPersonaProfile({ name: 'Member profile' }, createContext()),
      ForbiddenException
    );
  });

  it('creates, lists, updates, defaults and archives organization email template groups', async () => {
    const store = createStore([], {
      emailTemplateGroups: [createEmailTemplateGroup({ id: 'template-1', name: 'Distributor follow-up' })]
    });
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service);

    const created = await service.createEmailTemplateGroup(
      createEmailTemplatePayload({ name: 'Starter sequence' }),
      createContext()
    );
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
    assert.deepEqual(
      logs.records.map(record => record.action),
      ['email-template-create', 'email-template-update', 'email-template-default', 'email-template-archive']
    );
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
    assert.deepEqual(
      logs.records.map(record => record.action),
      ['sequence-policy-create', 'sequence-policy-update', 'sequence-policy-default', 'sequence-policy-archive']
    );
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
            bodyTemplate:
              'Hi {{contact.name}},\n\nTemplate says {{persona.focus}} for {{account.name}}.\n\n{{sender.name}}'
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

  it('uses organization persona profiles before built-in persona rules when generating drafts', async () => {
    const store = createStore([createAccount({ id: 'account-1', name: 'ABC Trading', status: 'ready' })], {
      contacts: [
        createContact({
          id: 'contact-1',
          accountId: 'account-1',
          fullName: 'Ali Hassan',
          title: 'Head of Procurement',
          emailStatus: 'valid'
        })
      ],
      emailTemplateGroups: [
        createEmailTemplateGroup({
          isDefault: true,
          steps: createEmailTemplateSteps({
            subjectTemplate: '{{account.name}} supplier option',
            bodyTemplate:
              'Hi {{contact.name}},\n\nPersona focus: {{persona.focus}}\nPain points: {{persona.painPoints}}\nAvoid: {{persona.avoidText}}'
          })
        })
      ],
      personaProfiles: [
        createPersonaProfile({
          id: 'persona-procurement',
          name: 'Procurement lead',
          titleKeywordsText: 'procurement',
          customerTypeKeywordsText: 'distributor',
          painPoints: 'price volatility and supplier risk',
          focusText: 'landed cost, MOQ, lead time, payment terms',
          avoidText: 'avoid saying cheapest'
        })
      ]
    });
    const service = new CrmService(store);

    const result = await service.createSequenceReviewItem(
      {
        accountId: 'account-1',
        contactId: 'contact-1'
      },
      createContext()
    );

    assert.match(result.item.firstMessage?.bodyText ?? '', /landed cost, MOQ, lead time, payment terms/);
    assert.match(result.item.firstMessage?.bodyText ?? '', /price volatility and supplier risk/);
    assert.match(result.item.firstMessage?.bodyText ?? '', /avoid saying cheapest/);
    const metadata = store.timelineEvents.at(-1)?.metadata as { personaProfileId?: string } | undefined;
    assert.equal(metadata?.personaProfileId, 'persona-procurement');
  });

  it('explains organization persona profile matches by contact title keyword', async () => {
    const store = createStore([createAccount({ id: 'account-1', name: 'ABC Trading', status: 'ready' })], {
      contacts: [
        createContact({
          id: 'contact-1',
          accountId: 'account-1',
          title: 'Head of Procurement',
          emailStatus: 'valid'
        })
      ],
      personaProfiles: [
        createPersonaProfile({
          id: 'persona-procurement',
          name: 'Procurement lead',
          titleKeywordsText: 'procurement',
          customerTypeKeywordsText: 'distributor'
        })
      ]
    });
    const service = new CrmService(store);

    const result = await service.createSequenceReviewItem(
      { accountId: 'account-1', contactId: 'contact-1' },
      createContext()
    );

    assert.deepEqual(result.item.personaMatch, {
      persona: {
        id: 'persona-procurement',
        name: 'Procurement lead',
        source: 'organization'
      },
      matchMethod: 'title',
      matchedKeywords: ['procurement'],
      fallbackReason: null
    });
    assert.match(
      result.item.checklist.find(item => item.key === 'persona_focus')?.message ?? '',
      /职位关键词 procurement/
    );
  });

  it('explains organization persona profile matches by account customer type keyword', async () => {
    const store = createStore(
      [
        createAccount({ id: 'account-1', name: 'ABC Trading', status: 'ready', customerType: 'Industrial Distributor' })
      ],
      {
        contacts: [
          createContact({
            id: 'contact-1',
            accountId: 'account-1',
            title: 'Operations Assistant',
            emailStatus: 'valid'
          })
        ],
        personaProfiles: [
          createPersonaProfile({
            id: 'persona-distributor',
            name: 'Distributor buyer',
            titleKeywordsText: 'procurement',
            customerTypeKeywordsText: 'distributor'
          })
        ]
      }
    );
    const service = new CrmService(store);

    const result = await service.createSequenceReviewItem(
      { accountId: 'account-1', contactId: 'contact-1' },
      createContext()
    );

    assert.deepEqual(result.item.personaMatch, {
      persona: {
        id: 'persona-distributor',
        name: 'Distributor buyer',
        source: 'organization'
      },
      matchMethod: 'customer_type',
      matchedKeywords: ['distributor'],
      fallbackReason: null
    });
  });

  it('explains default persona profile fallback when keywords do not match', async () => {
    const store = createStore([createAccount({ id: 'account-1', name: 'ABC Trading', status: 'ready' })], {
      contacts: [
        createContact({
          id: 'contact-1',
          accountId: 'account-1',
          title: 'Warehouse Coordinator',
          emailStatus: 'valid'
        })
      ],
      personaProfiles: [
        createPersonaProfile({
          id: 'persona-default',
          name: 'General buyer',
          titleKeywordsText: 'procurement',
          customerTypeKeywordsText: 'distributor',
          isDefault: true
        })
      ]
    });
    const service = new CrmService(store);

    const result = await service.createSequenceReviewItem(
      { accountId: 'account-1', contactId: 'contact-1' },
      createContext()
    );

    assert.deepEqual(result.item.personaMatch, {
      persona: {
        id: 'persona-default',
        name: 'General buyer',
        source: 'organization'
      },
      matchMethod: 'default',
      matchedKeywords: [],
      fallbackReason: '未命中职位或客户类型关键词，使用默认画像'
    });
  });

  it('explains built-in persona fallback and no-persona fallback when organization profiles are absent', async () => {
    const builtInStore = createStore([createAccount({ id: 'account-1', name: 'ABC Trading', status: 'ready' })], {
      contacts: [
        createContact({
          id: 'contact-1',
          accountId: 'account-1',
          title: 'Purchasing Manager',
          emailStatus: 'valid'
        })
      ]
    });
    const noPersonaStore = createStore([createAccount({ id: 'account-2', name: 'XYZ Trading', status: 'ready' })], {
      contacts: [
        createContact({
          id: 'contact-2',
          accountId: 'account-2',
          title: 'Warehouse Coordinator',
          emailStatus: 'valid'
        })
      ]
    });

    const builtInResult = await new CrmService(builtInStore).createSequenceReviewItem(
      { accountId: 'account-1', contactId: 'contact-1' },
      createContext()
    );
    const noPersonaResult = await new CrmService(noPersonaStore).createSequenceReviewItem(
      { accountId: 'account-2', contactId: 'contact-2' },
      createContext()
    );

    assert.deepEqual(builtInResult.item.personaMatch, {
      persona: {
        id: null,
        name: 'Purchasing Manager',
        source: 'builtin'
      },
      matchMethod: 'builtin',
      matchedKeywords: ['purchasing manager'],
      fallbackReason: '未配置或未命中组织画像，使用内置职位画像'
    });
    assert.deepEqual(noPersonaResult.item.personaMatch, {
      persona: null,
      matchMethod: 'none',
      matchedKeywords: [],
      fallbackReason: '未命中组织画像或内置职位画像，按通用开发信生成'
    });
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
        message: '已匹配 Purchasing Manager：未配置或未命中组织画像，使用内置职位画像'
      }
    );
    assert.equal(store.accounts[0].status, 'manual_review_pending');
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'sequence_draft_generated');
    assert.equal((logs.records[0].metadata as Record<string, unknown>).messageId, 'message-1');
    assert.equal(JSON.stringify(logs.records[0].metadata).includes('stable supply'), false);
  });

  it('uses product line AI writing config when creating the first review draft', async () => {
    const store = createStore([createAccount({ id: 'account-1', name: 'ABC Trading', status: 'ready' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', title: 'Purchasing Manager' })],
      productLines: [
        createProductLine({
          id: 'line-ai',
          name: 'Bearing Series',
          coreSellingPoints: 'stable supply',
          leadTime: '15 days',
          aiWritingConfig: createAiWritingConfig()
        })
      ]
    });
    const aiCalls: CrmAiDraftPromptInput[] = [];
    const service = new CrmService(
      store,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      createAiDraftService(aiCalls)
    );

    const result = await service.createSequenceReviewItem(
      {
        accountId: 'account-1',
        contactId: 'contact-1',
        productLineId: 'line-ai'
      },
      createContext()
    );

    assert.equal(aiCalls[0].stepIndex, 1);
    assert.equal(aiCalls[0].writingConfig.steps[0].prompt, 'Prompt 1');
    assert.equal(result.item.firstMessage?.subject, 'AI subject step 1');
    assert.equal(result.item.firstMessage?.bodyText, 'AI body step 1');
    assert.equal(result.item.firstMessage?.aiDraft?.snapshot.productLineId, 'line-ai');
    assert.equal(Boolean((store.messages[0].metadata as { aiDraft?: unknown }).aiDraft), true);
    assert.equal(Boolean((store.timelineEvents.at(-1)?.metadata as { aiDraft?: unknown } | undefined)?.aiDraft), true);
  });

  it('previews an AI draft without creating messages or timeline events', async () => {
    const store = createStore([createAccount({ id: 'account-1', name: 'ABC Trading', status: 'ready' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', title: 'Purchasing Manager' })],
      productLines: [
        createProductLine({
          id: 'line-ai',
          name: 'Bearing Series',
          coreSellingPoints: 'stable supply',
          aiWritingConfig: createAiWritingConfig()
        })
      ]
    });
    const aiCalls: CrmAiDraftPromptInput[] = [];
    const service = new CrmService(
      store,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      createAiDraftService(aiCalls)
    );

    const result = await service.previewAiDraft(
      {
        accountId: 'account-1',
        contactId: 'contact-1',
        productLineId: 'line-ai',
        stepIndex: 2,
        previousMessages: [{ stepIndex: 1, subject: 'Previous subject', bodyText: 'Previous body' }]
      },
      createContext()
    );

    assert.equal(result.preview.subject, 'AI subject step 2');
    assert.equal(result.preview.bodyText, 'AI body step 2');
    assert.equal(result.preview.aiDraft?.snapshot.stepIndex, 2);
    assert.equal(aiCalls[0].previousMessages[0].subject, 'Previous subject');
    assert.equal(store.messages.length, 0);
    assert.equal(store.timelineEvents.length, 0);
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
    assert.equal(
      store.blacklists.some(entry => entry.id === 'blacklist-1'),
      false
    );
    assert.equal(
      store.blacklists.some(entry => entry.id === 'blacklist-2'),
      true
    );
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
      status: 'draft_review_pending',
      todoType: 'follow_up_draft_review',
      messageStatus: 'sent',
      dateScope: 'today'
    });

    assert.deepEqual(store.lastSequenceReviewListArgs, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      keyword: 'ABC',
      status: 'draft_review_pending',
      todoType: 'follow_up_draft_review',
      messageStatus: 'sent',
      dateScope: 'today',
      skip: 0,
      take: 20
    });
    assert.equal(result.records[0].firstMessage?.id, 'message-1');
    assert.deepEqual(
      result.records[0].messages.map(message => message.id),
      ['message-1', 'message-2']
    );
    assert.equal(
      result.records[0].checklist.every(item => item.passed),
      true
    );
  });

  it('creates first draft review items through split sequence service with scoped resources and log', async () => {
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
    const service = createSequenceService(store, {
      crmLogger: new CrmLoggerService(logs.service as never)
    });

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
    assert.equal(store.accounts[0].status, 'manual_review_pending');
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'sequence_draft_generated');
    assert.equal(logs.records.at(-1)?.action, 'sequence-review-create');
    assert.equal((logs.records.at(-1)?.metadata as Record<string, unknown>).messageId, 'message-1');
    assert.equal(JSON.stringify(logs.records.at(-1)?.metadata).includes('stable supply'), false);
  });

  it('lists sequence review items through split sequence service with member owner scope', async () => {
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
    const service = createSequenceService(store);

    const result = await service.listSequenceReviewItems(createContext(), {
      keyword: ' ABC ',
      status: 'draft_review_pending',
      todoType: 'draft_review_pending',
      dateScope: 'today'
    });

    assert.deepEqual(store.lastSequenceReviewListArgs, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      keyword: 'ABC',
      status: 'draft_review_pending',
      todoType: 'draft_review_pending',
      dateScope: 'today',
      skip: 0,
      take: 20
    });
    assert.equal(result.records[0].firstMessage?.id, 'message-1');
    assert.equal(
      result.records[0].checklist.every(item => item.passed),
      true
    );
  });

  it('reads sequence review detail through split sequence service with admin scope but draft operation remains owner-only', async () => {
    const store = createStore(
      [createAccount({ id: 'account-1', ownerUserId: 'user-2', name: 'Peer Trading' })],
      {
        contacts: [
          createContact({
            id: 'contact-1',
            accountId: 'account-1',
            ownerUserId: 'user-2',
            emailStatus: 'valid'
          })
        ],
        enrollments: [
          createEnrollment({
            id: 'enrollment-1',
            ownerUserId: 'user-2',
            accountId: 'account-1',
            contactId: 'contact-1'
          })
        ],
        messages: [
          createMessage({
            id: 'message-1',
            ownerUserId: 'user-2',
            accountId: 'account-1',
            contactId: 'contact-1',
            enrollmentId: 'enrollment-1'
          })
        ]
      }
    );
    const service = createSequenceService(store);

    const result = await service.getSequenceReviewItem(
      'enrollment-1',
      createContext({ organizationRole: 'admin', userId: 'user-1' })
    );

    assert.deepEqual(store.lastSequenceReviewDetailArgs, {
      id: 'enrollment-1',
      organizationId: 'org-1'
    });
    assert.equal(result.canOperateDraft, false);
    assert.equal(result.canControlSequence, true);
  });

  it('lists local strategy stats with owner scope for members', async () => {
    const store = createStore([createAccount({ id: 'account-1' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      enrollments: [createEnrollment({ id: 'enrollment-1', accountId: 'account-1', contactId: 'contact-1' })],
      messages: [createMessage({ id: 'message-1', enrollmentId: 'enrollment-1', status: 'draft_pending_review' })]
    });
    const service = new CrmService(store);

    const result = await service.listStrategyStats(createContext());

    assert.deepEqual(store.lastStrategyStatsArgs, {
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    assert.equal(result.rows.template[0].sequenceCount, 1);
    assert.equal(result.rows.template[0].draftPendingCount, 1);
  });

  it('lists local strategy stats with organization scope for admins', async () => {
    const store = createStore();
    const service = new CrmService(store);

    await service.listStrategyStats(createContext({ organizationRole: 'admin' }));

    assert.deepEqual(store.lastStrategyStatsArgs, {
      organizationId: 'org-1'
    });
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

  it('keeps draft version snapshots on each owner save and lists newest versions first', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'manual_review_pending' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      enrollments: [createEnrollment({ id: 'enrollment-1', accountId: 'account-1', contactId: 'contact-1' })],
      messages: [
        createMessage({
          id: 'message-1',
          enrollmentId: 'enrollment-1',
          subject: 'Initial subject',
          bodyText: 'Initial body'
        })
      ]
    });
    const service = new CrmService(store);

    await service.updateMessageDraft('message-1', { subject: 'First update', bodyText: 'First body' }, createContext());
    await service.updateMessageDraft(
      'message-1',
      { subject: 'Second update', bodyText: 'Second body' },
      createContext({ userName: 'Alice B' })
    );

    const result = await service.listMessageDraftVersions('message-1', createContext());

    assert.deepEqual(
      result.versions.map(version => [version.versionNo, version.subject, version.editorName]),
      [
        [2, 'Second update', 'Alice B'],
        [1, 'First update', 'Alice']
      ]
    );
    assert.equal(store.draftVersions[0].bodyText, 'First body');
    assert.equal(store.draftVersions[0].enrollmentId, 'enrollment-1');
    assert.equal(store.draftVersions[0].stepIndex, 1);
  });

  it('regenerates the owner pending draft and stores AI metadata with a version snapshot', async () => {
    const store = createStore(
      [createAccount({ id: 'account-1', name: 'ABC Trading', status: 'manual_review_pending' })],
      {
        contacts: [createContact({ id: 'contact-1', accountId: 'account-1', title: 'Purchasing Manager' })],
        productLines: [
          createProductLine({
            id: 'line-ai',
            name: 'Bearing Series',
            aiWritingConfig: createAiWritingConfig()
          })
        ],
        enrollments: [
          createEnrollment({
            id: 'enrollment-1',
            accountId: 'account-1',
            contactId: 'contact-1',
            productLineId: 'line-ai'
          })
        ],
        messages: [
          createMessage({
            id: 'message-1',
            enrollmentId: 'enrollment-1',
            subject: 'Old subject',
            bodyText: 'Old body',
            metadata: { keep: 'value' }
          })
        ]
      }
    );
    const aiCalls: CrmAiDraftPromptInput[] = [];
    const logs = createLogRecorder();
    const service = new CrmService(
      store,
      undefined,
      logs.service,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      createAiDraftService(aiCalls)
    );

    const result = await service.regenerateMessageAiDraft('message-1', createContext());
    const metadata = store.messages[0].metadata as { keep?: string; aiDraft?: { snapshot?: { stepIndex?: number } } };

    assert.equal(result.message.subject, 'AI subject step 1');
    assert.equal(result.message.bodyText, 'AI body step 1');
    assert.equal(store.messages[0].status, 'draft_pending_review');
    assert.equal(metadata.keep, 'value');
    assert.equal(metadata.aiDraft?.snapshot?.stepIndex, 1);
    assert.equal(store.draftVersions.at(-1)?.subject, 'AI subject step 1');
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'ai_draft_regenerated');
    assert.equal(logs.records.at(-1)?.action, 'ai-draft-regenerate');
    assert.equal(aiCalls[0].stepIndex, 1);
  });

  it('rejects AI draft regeneration for peer owners and non-pending messages', async () => {
    const store = createStore([createAccount({ id: 'account-1', ownerUserId: 'user-2' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', ownerUserId: 'user-2' })],
      productLines: [createProductLine({ id: 'line-ai', aiWritingConfig: createAiWritingConfig() })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          ownerUserId: 'user-2',
          productLineId: 'line-ai'
        })
      ],
      messages: [
        createMessage({
          id: 'message-peer',
          accountId: 'account-1',
          contactId: 'contact-1',
          ownerUserId: 'user-2',
          enrollmentId: 'enrollment-1'
        }),
        createMessage({
          id: 'message-ready',
          status: 'draft_ready'
        })
      ]
    });
    const service = new CrmService(
      store,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      createAiDraftService([])
    );

    await assert.rejects(
      () => service.regenerateMessageAiDraft('message-peer', createContext({ organizationRole: 'admin' })),
      NotFoundException
    );
    await assert.rejects(() => service.regenerateMessageAiDraft('message-ready', createContext()), BadRequestException);
  });

  it('restores an owner draft version only when the current message is still pending review', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'manual_review_pending' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      enrollments: [createEnrollment({ id: 'enrollment-1', accountId: 'account-1', contactId: 'contact-1' })],
      messages: [
        createMessage({
          id: 'message-1',
          enrollmentId: 'enrollment-1',
          subject: 'Current subject',
          bodyText: 'Current body'
        })
      ]
    });
    const service = new CrmService(store);

    await service.updateMessageDraft(
      'message-1',
      { subject: 'Saved subject', bodyText: 'Saved body' },
      createContext()
    );
    await service.updateMessageDraft(
      'message-1',
      { subject: 'Changed subject', bodyText: 'Changed body' },
      createContext()
    );
    const restored = await service.restoreMessageDraftVersion('message-1', 'draft-version-1', createContext());

    assert.equal(restored.message.subject, 'Saved subject');
    assert.equal(restored.message.bodyText, 'Saved body');
    assert.equal(store.messages[0].status, 'draft_pending_review');

    store.messages[0].status = 'draft_ready';
    await assert.rejects(
      () => service.restoreMessageDraftVersion('message-1', 'draft-version-2', createContext()),
      BadRequestException
    );
    assert.equal(store.messages[0].subject, 'Saved subject');
  });

  it('rejects admin attempts to restore another member draft version', async () => {
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
          ownerUserId: 'user-2',
          subject: 'Member subject'
        })
      ]
    });
    const service = new CrmService(store);

    store.draftVersions.push(
      createDraftVersion(store.messages[0], {
        id: 'draft-version-1',
        subject: 'Historic subject',
        versionNo: 1
      })
    );

    await assert.rejects(
      () =>
        service.restoreMessageDraftVersion(
          'message-1',
          'draft-version-1',
          createContext({ organizationRole: 'admin' })
        ),
      NotFoundException
    );
    assert.equal(store.messages[0].subject, 'Member subject');
  });

  it('rejects inbox reply polish when the user topic is empty', async () => {
    const store = createStore([createAccount({ id: 'account-1' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      inboxThreads: [createInboxThread({ id: 'inbox-thread-1', accountId: 'account-1', contactId: 'contact-1' })],
      inboxMessages: [
        createInboxMessage({ threadId: 'inbox-thread-1', accountId: 'account-1', contactId: 'contact-1' })
      ]
    });
    const aiReplyDraftCalls: CrmAiReplyDraftPromptInput[] = [];
    const service = new CrmService(
      store,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      createAiReplyDraftService(aiReplyDraftCalls)
    );

    await assert.rejects(
      () => service.polishInboxReplyDraft('inbox-thread-1', { topic: '   ' }, createContext()),
      BadRequestException
    );
    assert.equal(aiReplyDraftCalls.length, 0);
    assert.equal(store.inboxThreads[0].replyDraftBodyText, null);
  });

  it('lets the owner polish an inbox reply draft without sending Gmail or creating inbox messages', async () => {
    const store = createStore([createAccount({ id: 'account-1', name: 'ABC Trading', status: 'replied_pending' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', fullName: 'Ali Hassan' })],
      productLines: [
        createProductLine({
          id: 'product-line-1',
          name: 'Bearing Series',
          aiWritingConfig: createAiWritingConfig()
        })
      ],
      inboxThreads: [
        createInboxThread({
          id: 'inbox-thread-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          status: 'pending',
          unreadCount: 2,
          messageCount: 1
        })
      ],
      inboxMessages: [
        createInboxMessage({
          id: 'inbox-message-1',
          threadId: 'inbox-thread-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          bodyText: 'Please send catalogue and MOQ.'
        })
      ]
    });
    const aiReplyDraftCalls: CrmAiReplyDraftPromptInput[] = [];
    const sendGateway = createThrowingSendGateway();
    const service = new CrmService(
      store,
      undefined,
      createLogRecorder().service,
      undefined,
      undefined,
      sendGateway,
      undefined,
      undefined,
      undefined,
      createAiReplyDraftService(aiReplyDraftCalls)
    );

    const result = await service.polishInboxReplyDraft(
      'inbox-thread-1',
      { topic: 'send catalogue and ask annual usage', productLineId: 'product-line-1' },
      createContext()
    );

    assert.equal(result.replyDraft?.bodyText, 'Polished reply for send catalogue and ask annual usage');
    assert.equal(result.thread.status, 'pending');
    assert.equal(result.thread.unreadCount, 2);
    assert.equal(result.thread.messageCount, 1);
    assert.equal(store.inboxMessages.length, 1);
    assert.equal(store.inboxThreads[0].replyDraftTopic, 'send catalogue and ask annual usage');
    assert.equal(aiReplyDraftCalls.length, 1);
    assert.equal(aiReplyDraftCalls[0].latestInboundMessage.bodyText, 'Please send catalogue and MOQ.');
  });

  it('rejects admin and peer attempts to polish or save another owner inbox reply draft', async () => {
    const store = createStore([createAccount({ id: 'account-1', ownerUserId: 'user-2' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', ownerUserId: 'user-2' })],
      inboxThreads: [
        createInboxThread({
          id: 'inbox-thread-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          ownerUserId: 'user-2'
        })
      ],
      inboxMessages: [
        createInboxMessage({
          threadId: 'inbox-thread-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          ownerUserId: 'user-2'
        })
      ]
    });
    const aiReplyDraftCalls: CrmAiReplyDraftPromptInput[] = [];
    const service = new CrmService(
      store,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      createAiReplyDraftService(aiReplyDraftCalls)
    );

    await assert.rejects(
      () =>
        service.polishInboxReplyDraft(
          'inbox-thread-1',
          { topic: 'reply politely' },
          createContext({ organizationRole: 'admin' })
        ),
      NotFoundException
    );
    await assert.rejects(
      () =>
        service.saveInboxReplyDraft(
          'inbox-thread-1',
          { topic: 'manual topic', bodyText: 'Manual reply' },
          createContext({ userId: 'user-3' })
        ),
      NotFoundException
    );
    assert.equal(aiReplyDraftCalls.length, 0);
    assert.equal(store.inboxThreads[0].replyDraftBodyText, null);
  });

  it('returns owner reply draft in inbox detail but hides it from admin read-only detail', async () => {
    const store = createStore([createAccount({ id: 'account-1', ownerUserId: 'user-2' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', ownerUserId: 'user-2' })],
      inboxThreads: [
        createInboxThread({
          id: 'inbox-thread-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          ownerUserId: 'user-2',
          replyDraftTopic: 'send catalogue',
          replyDraftBodyText: 'Polished reply body',
          replyDraftMetadata: { generated: true, reason: 'polished', riskNotes: [] },
          replyDraftUpdatedAt: new Date('2026-06-18T12:00:00.000Z'),
          replyDraftUpdatedById: 'user-2',
          replyDraftUpdatedByName: 'Bob'
        })
      ],
      inboxMessages: [
        createInboxMessage({
          threadId: 'inbox-thread-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          ownerUserId: 'user-2'
        })
      ]
    });
    const service = new CrmService(store);

    const ownerDetail = await service.getInboxThread('inbox-thread-1', createContext({ userId: 'user-2' }));
    const adminDetail = await service.getInboxThread(
      'inbox-thread-1',
      createContext({ userId: 'admin-1', organizationRole: 'admin' })
    );

    assert.equal(ownerDetail.replyDraft?.bodyText, 'Polished reply body');
    assert.equal(adminDetail.replyDraft, null);
    assert.equal(adminDetail.canOperate, false);
  });

  it('saves an edited inbox reply draft without AI, Gmail or status changes', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'replied_pending' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      inboxThreads: [
        createInboxThread({
          id: 'inbox-thread-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          status: 'pending',
          unreadCount: 1,
          messageCount: 1
        })
      ],
      inboxMessages: [
        createInboxMessage({ threadId: 'inbox-thread-1', accountId: 'account-1', contactId: 'contact-1' })
      ]
    });
    const aiReplyDraftCalls: CrmAiReplyDraftPromptInput[] = [];
    const service = new CrmService(
      store,
      undefined,
      createLogRecorder().service,
      undefined,
      undefined,
      createThrowingSendGateway(),
      undefined,
      undefined,
      undefined,
      createAiReplyDraftService(aiReplyDraftCalls)
    );

    const result = await service.saveInboxReplyDraft(
      'inbox-thread-1',
      { topic: 'catalogue', bodyText: 'Manual polished reply' },
      createContext()
    );

    assert.equal(result.replyDraft?.bodyText, 'Manual polished reply');
    assert.equal(result.thread.status, 'pending');
    assert.equal(result.thread.unreadCount, 1);
    assert.equal(result.thread.messageCount, 1);
    assert.equal(store.accounts[0].status, 'replied_pending');
    assert.equal(store.inboxMessages.length, 1);
    assert.equal(aiReplyDraftCalls.length, 0);
  });

  it('approves follow-up drafts into the local send scheduling pool', async () => {
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
    assert.equal(approved.message.status, 'draft_ready');
    assert.equal(store.messages[1].scheduledAt?.toISOString(), scheduledAt.toISOString());
    assert.equal(store.messages[1].bullJobId, null);
    assert.equal(sendQueue.jobs.length, 0);
  });

  it('does not check queued concurrency while approving follow-up drafts into the scheduling pool', async () => {
    const scheduledAt = new Date('2030-06-21T10:00:00.000Z');
    const store = createStore([createAccount({ id: 'account-1', status: 'sequence_running' })], {
      globalConfig: createGlobalConfig({ ownerConcurrentSendLimit: 1 }),
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
        }),
        createMessage({
          id: 'message-queued',
          enrollmentId: 'enrollment-1',
          status: 'queued',
          stepIndex: 3
        })
      ]
    });
    const sendQueue = createSendQueue();
    const service = new CrmService(store, undefined, undefined, sendQueue);

    const approved = await service.approveMessageDraft('message-2', createContext());

    assert.equal(approved.message.status, 'draft_ready');
    assert.equal(sendQueue.jobs.length, 0);
    assert.equal(store.messages.find(message => message.id === 'message-2')?.status, 'draft_ready');
  });

  it('approves locally generated follow-up drafts without queueing send jobs before Gmail starts', async () => {
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
          status: 'draft_ready',
          stepIndex: 1
        }),
        createMessage({
          id: 'message-2',
          enrollmentId: 'enrollment-1',
          status: 'draft_pending_review',
          stepIndex: 2,
          scheduledAt: new Date('2030-06-21T10:00:00.000Z')
        })
      ]
    });
    const logs = createLogRecorder();
    const sendQueue = createSendQueue();
    const service = new CrmService(store, undefined, logs.service, sendQueue);

    const approved = await service.approveMessageDraft('message-2', createContext());

    assert.equal(approved.enrollment.status, 'ready_to_send');
    assert.equal(approved.message.status, 'draft_ready');
    assert.equal(store.accounts[0].status, 'ready');
    assert.equal(sendQueue.jobs.length, 0);
    assert.equal(logs.records[0].action, 'follow-up-draft-approve-local');
  });

  it('generates the next follow-up draft locally without queueing Gmail send jobs', async () => {
    const store = createStore([createAccount({ id: 'account-1', name: 'ABC Trading', status: 'ready' })], {
      contacts: [
        createContact({
          id: 'contact-1',
          accountId: 'account-1',
          fullName: 'Ali Hassan',
          title: 'Purchasing Manager'
        })
      ],
      mailboxes: [createMailbox({ id: 'mailbox-1', status: 'active' })],
      productLines: [
        createProductLine({
          id: 'product-line-1',
          name: 'Bearing Series',
          coreSellingPoints: 'stable supply'
        })
      ],
      sequencePolicies: [
        createSequencePolicy({
          id: 'policy-1',
          steps: [
            { stepIndex: 1, delayDays: 0, threadMode: 'new_subject' },
            { stepIndex: 2, delayDays: 5, threadMode: 'same_thread' },
            { stepIndex: 3, delayDays: 9, threadMode: 'new_subject' },
            { stepIndex: 4, delayDays: 13, threadMode: 'new_subject' },
            { stepIndex: 5, delayDays: 17, threadMode: 'new_subject' }
          ]
        })
      ],
      emailTemplateGroups: [
        createEmailTemplateGroup({
          isDefault: true,
          steps: createEmailTemplateSteps({
            subjectTemplate: '{{product.name}} follow-up for {{account.name}}',
            bodyTemplate: 'Hi {{contact.name}},\n\n{{product.name}} can support {{persona.focus}}.\n\n{{sender.name}}'
          })
        })
      ],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          mailboxId: 'mailbox-1',
          productLineId: 'product-line-1',
          policyId: 'policy-1',
          status: 'ready_to_send',
          totalSteps: 5
        })
      ],
      messages: [
        createMessage({
          id: 'message-1',
          enrollmentId: 'enrollment-1',
          mailboxId: 'mailbox-1',
          status: 'draft_ready',
          stepIndex: 1,
          providerThreadId: null
        })
      ]
    });
    const sendQueue = createSendQueue();
    const service = new CrmService(store, undefined, undefined, sendQueue);

    const beforeGenerate = Date.now();
    const generated = await service.generateNextDraft('enrollment-1', createContext());
    const afterGenerate = Date.now();
    const scheduledAtMs = new Date(generated.message.scheduledAt!).getTime();

    assert.equal(generated.message.stepIndex, 2);
    assert.equal(generated.enrollment.status, 'ready_to_send');
    assert.equal(generated.message.status, 'draft_pending_review');
    assert.equal(generated.message.threadMode, 'same_thread');
    assert.equal(generated.message.subject, 'Bearing Series follow-up for ABC Trading');
    assert.match(generated.message.bodyText, /price, MOQ, lead time, and payment terms/);
    assert.equal(generated.message.providerThreadId, null);
    assert.ok(scheduledAtMs >= beforeGenerate + 5 * 24 * 60 * 60 * 1000);
    assert.ok(scheduledAtMs <= afterGenerate + 5 * 24 * 60 * 60 * 1000);
    assert.equal(sendQueue.jobs.length, 0);
    assert.equal(store.messages[0].status, 'draft_ready');
  });

  it('uses product line AI writing config when generating the next local draft', async () => {
    const store = createStore([createAccount({ id: 'account-1', name: 'ABC Trading', status: 'ready' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', title: 'Purchasing Manager' })],
      productLines: [
        createProductLine({
          id: 'line-ai',
          name: 'Bearing Series',
          coreSellingPoints: 'stable supply',
          leadTime: '15 days',
          aiWritingConfig: createAiWritingConfig()
        })
      ],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          productLineId: 'line-ai',
          status: 'ready_to_send',
          currentStep: 1
        })
      ],
      messages: [
        createMessage({
          id: 'message-1',
          enrollmentId: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          stepIndex: 1,
          status: 'sent',
          subject: 'Previous subject',
          bodyText: 'Previous body'
        })
      ]
    });
    const aiCalls: CrmAiDraftPromptInput[] = [];
    const service = new CrmService(
      store,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      createAiDraftService(aiCalls)
    );

    const result = await service.generateNextDraft('enrollment-1', createContext());

    assert.equal(aiCalls[0].stepIndex, 2);
    assert.equal(aiCalls[0].previousMessages[0].bodyText, 'Previous body');
    assert.equal(result.message.subject, 'AI subject step 2');
    assert.equal(result.message.bodyText, 'AI body step 2');
    assert.equal(result.message.aiDraft?.snapshot.stepIndex, 2);
    assert.equal(Boolean((store.messages.at(-1)?.metadata as { aiDraft?: unknown } | undefined)?.aiDraft), true);
  });

  it('removes template links from generated follow-up drafts when the policy blocks new links', async () => {
    const store = createStore([createAccount({ id: 'account-1', name: 'ABC Trading', status: 'ready' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', fullName: 'Ali Hassan', title: 'Buyer' })],
      sequencePolicies: [
        createSequencePolicy({
          id: 'policy-1',
          linkPolicy: 'block_new_links',
          steps: [
            { stepIndex: 1, delayDays: 0, threadMode: 'new_subject' },
            { stepIndex: 2, delayDays: 3, threadMode: 'same_thread' },
            { stepIndex: 3, delayDays: 7, threadMode: 'new_subject' },
            { stepIndex: 4, delayDays: 14, threadMode: 'new_subject' },
            { stepIndex: 5, delayDays: 21, threadMode: 'new_subject' }
          ]
        })
      ],
      emailTemplateGroups: [
        createEmailTemplateGroup({
          isDefault: true,
          steps: createEmailTemplateSteps({
            bodyTemplate:
              'Hi {{contact.name}},\n\nCatalog: https://example.com/catalog.pdf\nWebsite: www.example.com\n\nBest,\n{{sender.name}}'
          })
        })
      ],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          policyId: 'policy-1',
          status: 'ready_to_send',
          totalSteps: 5
        })
      ],
      messages: [
        createMessage({
          id: 'message-1',
          enrollmentId: 'enrollment-1',
          status: 'draft_ready',
          stepIndex: 1
        })
      ]
    });
    const service = new CrmService(store);

    const generated = await service.generateNextDraft('enrollment-1', createContext());

    assert.doesNotMatch(generated.message.bodyText, /https?:\/\//);
    assert.doesNotMatch(generated.message.bodyText, /\bwww\./);
    assert.match(generated.message.bodyText, /Catalog:/);
    assert.match(generated.message.bodyText, /Website:/);
  });

  it('rejects duplicate or non-owner next draft generation', async () => {
    const store = createStore([createAccount({ id: 'account-1', ownerUserId: 'user-2', status: 'sequence_running' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1', ownerUserId: 'user-2' })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          ownerUserId: 'user-2',
          status: 'sequence_running',
          totalSteps: 5
        })
      ],
      messages: [
        createMessage({
          id: 'message-1',
          enrollmentId: 'enrollment-1',
          ownerUserId: 'user-2',
          accountId: 'account-1',
          contactId: 'contact-1',
          status: 'sent',
          stepIndex: 1
        }),
        createMessage({
          id: 'message-2',
          enrollmentId: 'enrollment-1',
          ownerUserId: 'user-2',
          accountId: 'account-1',
          contactId: 'contact-1',
          status: 'draft_pending_review',
          stepIndex: 2
        })
      ]
    });
    const service = new CrmService(store);

    await assert.rejects(
      () => service.generateNextDraft('enrollment-1', createContext({ organizationRole: 'admin' })),
      NotFoundException
    );
    await assert.rejects(
      () => service.generateNextDraft('enrollment-1', createContext({ userId: 'user-2' })),
      /已存在下一步草稿或待发送消息/
    );
    assert.equal(store.messages.length, 2);
  });

  it('batch-generates next drafts for eligible owner sequences and skips the rest', async () => {
    const store = createStore(
      [
        createAccount({ id: 'account-ready', name: 'Ready Co', status: 'ready' }),
        createAccount({ id: 'account-blocked', name: 'Blocked Co', status: 'ready' }),
        createAccount({ id: 'account-member', name: 'Member Co', ownerUserId: 'user-2', status: 'ready' })
      ],
      {
        contacts: [
          createContact({ id: 'contact-ready', accountId: 'account-ready', fullName: 'Ready Buyer' }),
          createContact({ id: 'contact-blocked', accountId: 'account-blocked', fullName: 'Blocked Buyer' }),
          createContact({
            id: 'contact-member',
            accountId: 'account-member',
            ownerUserId: 'user-2',
            fullName: 'Member Buyer'
          })
        ],
        emailTemplateGroups: [createEmailTemplateGroup({ isDefault: true })],
        enrollments: [
          createEnrollment({
            id: 'enrollment-ready',
            accountId: 'account-ready',
            contactId: 'contact-ready',
            status: 'sequence_running',
            totalSteps: 5
          }),
          createEnrollment({
            id: 'enrollment-blocked',
            accountId: 'account-blocked',
            contactId: 'contact-blocked',
            status: 'sequence_running',
            totalSteps: 5
          }),
          createEnrollment({
            id: 'enrollment-member',
            accountId: 'account-member',
            contactId: 'contact-member',
            ownerUserId: 'user-2',
            status: 'sequence_running',
            totalSteps: 5
          })
        ],
        messages: [
          createMessage({
            id: 'message-ready-1',
            accountId: 'account-ready',
            contactId: 'contact-ready',
            enrollmentId: 'enrollment-ready',
            status: 'sent',
            stepIndex: 1
          }),
          createMessage({
            id: 'message-blocked-1',
            accountId: 'account-blocked',
            contactId: 'contact-blocked',
            enrollmentId: 'enrollment-blocked',
            status: 'sent',
            stepIndex: 1
          }),
          createMessage({
            id: 'message-blocked-2',
            accountId: 'account-blocked',
            contactId: 'contact-blocked',
            enrollmentId: 'enrollment-blocked',
            status: 'draft_pending_review',
            stepIndex: 2
          }),
          createMessage({
            id: 'message-member-1',
            accountId: 'account-member',
            contactId: 'contact-member',
            enrollmentId: 'enrollment-member',
            ownerUserId: 'user-2',
            status: 'sent',
            stepIndex: 1
          })
        ]
      }
    );
    const service = new CrmService(store);

    const result = await service.batchGenerateNextDrafts(
      { ids: ['enrollment-ready', 'enrollment-blocked', 'enrollment-member'] },
      createContext({ organizationRole: 'admin' })
    );

    assert.deepEqual(
      result.results.map(item => [item.id, item.status]),
      [
        ['enrollment-ready', 'success'],
        ['enrollment-blocked', 'skipped'],
        ['enrollment-member', 'skipped']
      ]
    );
    assert.equal(result.totalCount, 3);
    assert.equal(result.successCount, 1);
    assert.equal(result.skippedCount, 2);
    assert.equal(result.failedCount, 0);
    assert.ok(store.messages.some(message => message.enrollmentId === 'enrollment-ready' && message.stepIndex === 2));
    assert.equal(store.messages.filter(message => message.enrollmentId === 'enrollment-blocked').length, 2);
    assert.equal(store.messages.filter(message => message.enrollmentId === 'enrollment-member').length, 1);
  });

  it('preloads batch next draft review items without per-item detail reads', async () => {
    const store = createStore(
      [
        createAccount({ id: 'account-ready', name: 'Ready Co', status: 'ready' }),
        createAccount({ id: 'account-blocked', name: 'Blocked Co', status: 'ready' }),
        createAccount({ id: 'account-member', name: 'Member Co', ownerUserId: 'user-2', status: 'ready' })
      ],
      {
        contacts: [
          createContact({ id: 'contact-ready', accountId: 'account-ready', fullName: 'Ready Buyer' }),
          createContact({ id: 'contact-blocked', accountId: 'account-blocked', fullName: 'Blocked Buyer' }),
          createContact({
            id: 'contact-member',
            accountId: 'account-member',
            ownerUserId: 'user-2',
            fullName: 'Member Buyer'
          })
        ],
        emailTemplateGroups: [createEmailTemplateGroup({ isDefault: true })],
        enrollments: [
          createEnrollment({
            id: 'enrollment-ready',
            accountId: 'account-ready',
            contactId: 'contact-ready',
            status: 'sequence_running',
            totalSteps: 5
          }),
          createEnrollment({
            id: 'enrollment-blocked',
            accountId: 'account-blocked',
            contactId: 'contact-blocked',
            status: 'sequence_running',
            totalSteps: 5
          }),
          createEnrollment({
            id: 'enrollment-member',
            accountId: 'account-member',
            contactId: 'contact-member',
            ownerUserId: 'user-2',
            status: 'sequence_running',
            totalSteps: 5
          })
        ],
        messages: [
          createMessage({
            id: 'message-ready-1',
            accountId: 'account-ready',
            contactId: 'contact-ready',
            enrollmentId: 'enrollment-ready',
            status: 'sent',
            stepIndex: 1
          }),
          createMessage({
            id: 'message-blocked-1',
            accountId: 'account-blocked',
            contactId: 'contact-blocked',
            enrollmentId: 'enrollment-blocked',
            status: 'sent',
            stepIndex: 1
          }),
          createMessage({
            id: 'message-blocked-2',
            accountId: 'account-blocked',
            contactId: 'contact-blocked',
            enrollmentId: 'enrollment-blocked',
            status: 'draft_pending_review',
            stepIndex: 2
          }),
          createMessage({
            id: 'message-member-1',
            accountId: 'account-member',
            contactId: 'contact-member',
            enrollmentId: 'enrollment-member',
            ownerUserId: 'user-2',
            status: 'sent',
            stepIndex: 1
          })
        ]
      }
    );
    const service = new CrmService(store);

    const result = await service.batchGenerateNextDrafts(
      { ids: ['enrollment-ready', 'enrollment-blocked', 'enrollment-member'] },
      createContext({ organizationRole: 'admin' })
    );

    assert.equal(store.sequenceReviewDetailCalls.length, 0);
    assert.deepEqual(
      result.results.map(item => [item.id, item.status]),
      [
        ['enrollment-ready', 'success'],
        ['enrollment-blocked', 'skipped'],
        ['enrollment-member', 'skipped']
      ]
    );
  });

  it('batch-approves only owner pending drafts and skips non-pending or member sequences', async () => {
    const store = createStore(
      [
        createAccount({ id: 'account-owned', status: 'manual_review_pending' }),
        createAccount({ id: 'account-ready', status: 'ready' }),
        createAccount({ id: 'account-member', ownerUserId: 'user-2', status: 'manual_review_pending' })
      ],
      {
        contacts: [
          createContact({ id: 'contact-owned', accountId: 'account-owned' }),
          createContact({ id: 'contact-ready', accountId: 'account-ready' }),
          createContact({ id: 'contact-member', accountId: 'account-member', ownerUserId: 'user-2' })
        ],
        enrollments: [
          createEnrollment({
            id: 'enrollment-owned',
            accountId: 'account-owned',
            contactId: 'contact-owned',
            status: 'draft_review_pending'
          }),
          createEnrollment({
            id: 'enrollment-ready',
            accountId: 'account-ready',
            contactId: 'contact-ready',
            status: 'ready_to_send'
          }),
          createEnrollment({
            id: 'enrollment-member',
            accountId: 'account-member',
            contactId: 'contact-member',
            ownerUserId: 'user-2',
            status: 'draft_review_pending'
          })
        ],
        messages: [
          createMessage({
            id: 'message-owned',
            accountId: 'account-owned',
            contactId: 'contact-owned',
            enrollmentId: 'enrollment-owned',
            status: 'draft_pending_review'
          }),
          createMessage({
            id: 'message-ready',
            accountId: 'account-ready',
            contactId: 'contact-ready',
            enrollmentId: 'enrollment-ready',
            status: 'draft_ready'
          }),
          createMessage({
            id: 'message-member',
            accountId: 'account-member',
            contactId: 'contact-member',
            enrollmentId: 'enrollment-member',
            ownerUserId: 'user-2',
            status: 'draft_pending_review'
          })
        ]
      }
    );
    const queue = createSendQueue();
    const service = new CrmService(store, undefined, undefined, queue);

    const result = await service.batchApproveMessageDrafts(
      { ids: ['enrollment-owned', 'enrollment-ready', 'enrollment-member'] },
      createContext({ organizationRole: 'admin' })
    );

    assert.deepEqual(
      result.results.map(item => [item.id, item.status]),
      [
        ['enrollment-owned', 'success'],
        ['enrollment-ready', 'skipped'],
        ['enrollment-member', 'skipped']
      ]
    );
    assert.equal(result.successCount, 1);
    assert.equal(result.skippedCount, 2);
    assert.equal(result.failedCount, 0);
    assert.equal(store.sequenceReviewDetailCalls.length, 0);
    assert.equal(store.enrollments.find(item => item.id === 'enrollment-owned')?.status, 'ready_to_send');
    assert.equal(store.messages.find(item => item.id === 'message-owned')?.status, 'draft_ready');
    assert.equal(store.enrollments.find(item => item.id === 'enrollment-member')?.status, 'draft_review_pending');
    assert.equal(store.messages.find(item => item.id === 'message-member')?.status, 'draft_pending_review');
    assert.equal(queue.jobs.length, 0);
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

  it('updates, lists and restores draft versions through split draft service', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'manual_review_pending' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      enrollments: [createEnrollment({ id: 'enrollment-1', accountId: 'account-1', contactId: 'contact-1' })],
      messages: [
        createMessage({
          id: 'message-1',
          enrollmentId: 'enrollment-1',
          subject: 'Initial subject',
          bodyText: 'Initial body'
        })
      ]
    });
    const service = createDraftService(store);

    await service.updateMessageDraft('message-1', { subject: 'First update', bodyText: 'First body' }, createContext());
    await service.updateMessageDraft(
      'message-1',
      { subject: 'Second update', bodyText: 'Second body' },
      createContext({ userName: 'Alice B' })
    );
    const versions = await service.listMessageDraftVersions('message-1', createContext());
    const restored = await service.restoreMessageDraftVersion('message-1', 'draft-version-1', createContext());

    assert.deepEqual(
      versions.versions.map(version => [version.versionNo, version.subject, version.editorName]),
      [
        [2, 'Second update', 'Alice B'],
        [1, 'First update', 'Alice']
      ]
    );
    assert.equal(restored.message.subject, 'First update');
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'draft_version_restored');
  });

  it('regenerates owner pending drafts through split draft service with AI metadata and sanitized log', async () => {
    const store = createStore(
      [createAccount({ id: 'account-1', name: 'ABC Trading', status: 'manual_review_pending' })],
      {
        contacts: [createContact({ id: 'contact-1', accountId: 'account-1', title: 'Purchasing Manager' })],
        productLines: [
          createProductLine({
            id: 'line-ai',
            name: 'Bearing Series',
            aiWritingConfig: createAiWritingConfig()
          })
        ],
        enrollments: [
          createEnrollment({
            id: 'enrollment-1',
            accountId: 'account-1',
            contactId: 'contact-1',
            productLineId: 'line-ai'
          })
        ],
        messages: [
          createMessage({
            id: 'message-1',
            enrollmentId: 'enrollment-1',
            subject: 'Old subject',
            bodyText: 'Old body',
            metadata: { keep: 'value' }
          })
        ]
      }
    );
    const aiCalls: CrmAiDraftPromptInput[] = [];
    const logs = createLogRecorder();
    const service = createDraftService(store, {
      aiDraftService: createAiDraftService(aiCalls),
      crmLogger: new CrmLoggerService(logs.service as never)
    });

    const result = await service.regenerateMessageAiDraft('message-1', createContext());
    const metadata = store.messages[0].metadata as { keep?: string; aiDraft?: { snapshot?: { stepIndex?: number } } };

    assert.equal(result.message.subject, 'AI subject step 1');
    assert.equal(result.message.bodyText, 'AI body step 1');
    assert.equal(metadata.keep, 'value');
    assert.equal(metadata.aiDraft?.snapshot?.stepIndex, 1);
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'ai_draft_regenerated');
    assert.equal(logs.records.at(-1)?.action, 'ai-draft-regenerate');
    assert.equal(aiCalls[0].stepIndex, 1);
  });

  it('keeps split draft service writes owner-only for organization admins', async () => {
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
    const service = createDraftService(store);

    await assert.rejects(
      () =>
        service.updateMessageDraft(
          'message-1',
          { subject: 'Admin edit', bodyText: 'Body' },
          createContext({ organizationRole: 'admin' })
        ),
      NotFoundException
    );
    assert.equal(store.messages[0].status, 'draft_pending_review');
  });

  it('approves first owner drafts through split draft approval service', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'manual_review_pending' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      enrollments: [createEnrollment({ id: 'enrollment-1', accountId: 'account-1', contactId: 'contact-1' })],
      messages: [
        createMessage({
          id: 'message-1',
          enrollmentId: 'enrollment-1',
          subject: 'Ready subject'
        })
      ]
    });
    const logs = createLogRecorder();
    const service = createDraftApprovalService(store, {
      crmLogger: new CrmLoggerService(logs.service as never)
    });

    const approved = await service.approveInitialMessageDraft('message-1', createContext());

    assert.equal(approved.message.status, 'draft_ready');
    assert.equal(approved.enrollment.status, 'ready_to_send');
    assert.equal(store.messages[0].status, 'draft_ready');
    assert.equal(store.enrollments[0].status, 'ready_to_send');
    assert.equal(store.accounts[0].status, 'ready');
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'draft_approved');
    assert.equal(logs.records.at(-1)?.action, 'draft-approve');
    assert.equal((logs.records.at(-1)?.metadata as Record<string, unknown>).messageId, 'message-1');
  });

  it('keeps split first draft approval owner-only and rejects follow-up drafts', async () => {
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
        }),
        createMessage({
          id: 'message-2',
          enrollmentId: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          stepIndex: 2
        })
      ]
    });
    const service = createDraftApprovalService(store);

    await assert.rejects(
      () => service.approveInitialMessageDraft('message-1', createContext({ organizationRole: 'admin' })),
      NotFoundException
    );
    await assert.rejects(
      () => service.approveInitialMessageDraft('message-2', createContext()),
      /当前草稿不是首封开发信/
    );
    assert.equal(store.messages[0].status, 'draft_pending_review');
    assert.equal(store.messages[1].status, 'draft_pending_review');
  });

  it('starts an approved first message into the local send scheduling pool', async () => {
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
    assert.equal(result.message.status, 'draft_ready');
    assert.equal(store.messages[0].scheduledAt instanceof Date, true);
    assert.equal(store.messages[0].bullJobId, null);
    assert.equal(queue.jobs.length, 0);
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

  it('does not check queued concurrency while moving first messages into the scheduling pool', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'ready' })], {
      globalConfig: createGlobalConfig({ ownerConcurrentSendLimit: 1 }),
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      mailboxes: [createMailbox({ id: 'mailbox-1' })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          mailboxId: 'mailbox-1',
          status: 'ready_to_send'
        }),
        createEnrollment({
          id: 'enrollment-queued',
          accountId: 'account-1',
          contactId: 'contact-1',
          mailboxId: 'mailbox-1',
          status: 'sequence_running'
        })
      ],
      messages: [
        createMessage({
          id: 'message-1',
          enrollmentId: 'enrollment-1',
          mailboxId: 'mailbox-1',
          status: 'draft_ready'
        }),
        createMessage({
          id: 'message-queued',
          enrollmentId: 'enrollment-queued',
          mailboxId: 'mailbox-1',
          status: 'queued'
        })
      ]
    });
    const queue = createSendQueue();
    const service = new CrmService(store, undefined, undefined, queue);

    const result = await service.startFirstMessageSend('enrollment-1', createContext());

    assert.equal(result.message.status, 'draft_ready');
    assert.equal(queue.jobs.length, 0);
    assert.equal(store.messages.find(message => message.id === 'message-1')?.status, 'draft_ready');
  });

  it('does not call the send queue while moving first messages into the scheduling pool', async () => {
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

    const result = await service.startFirstMessageSend('enrollment-1', createContext());

    assert.equal(result.enrollment.status, 'sequence_running');
    assert.equal(result.message.status, 'draft_ready');
    assert.equal(store.enrollments[0].status, 'sequence_running');
    assert.equal(store.messages[0].status, 'draft_ready');
    assert.equal(store.accounts[0].status, 'sequence_running');
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'message_send_scheduled');
  });

  it('reconciles queued messages whose BullMQ jobs no longer exist', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'sequence_running' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      mailboxes: [createMailbox({ id: 'mailbox-1' })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          mailboxId: 'mailbox-1',
          status: 'sequence_running'
        })
      ],
      messages: [
        createMessage({
          id: 'message-missing-job',
          enrollmentId: 'enrollment-1',
          mailboxId: 'mailbox-1',
          status: 'queued',
          bullJobId: 'send-job-missing',
          scheduledAt: new Date('2026-06-18T10:00:00.000Z')
        }),
        createMessage({
          id: 'message-existing-job',
          enrollmentId: 'enrollment-1',
          mailboxId: 'mailbox-1',
          status: 'queued',
          bullJobId: 'send-job-existing',
          scheduledAt: new Date('2026-06-18T10:01:00.000Z')
        }),
        createMessage({
          id: 'message-fresh',
          enrollmentId: 'enrollment-1',
          mailboxId: 'mailbox-1',
          status: 'queued',
          bullJobId: 'send-job-fresh',
          scheduledAt: new Date('2026-06-18T10:58:00.000Z')
        })
      ]
    });
    const logs = createLogRecorder();
    const service = new CrmService(store, undefined, logs.service, {
      async enqueueFirstMessage() {
        return { jobId: 'unused' };
      },
      async hasJob(jobId) {
        return jobId === 'send-job-existing';
      }
    });

    const result = await service.reconcileSendQueue(
      { now: new Date('2026-06-18T11:00:00.000Z'), staleMinutes: 10, take: 10 },
      createContext({ roles: ['R_SUPER'] })
    );

    assert.deepEqual(result, { scannedCount: 2, repairedCount: 1, skippedCount: 1 });
    assert.equal(store.messages.find(message => message.id === 'message-missing-job')?.status, 'draft_ready');
    assert.equal(store.messages.find(message => message.id === 'message-missing-job')?.bullJobId, null);
    assert.equal(store.messages.find(message => message.id === 'message-existing-job')?.status, 'queued');
    assert.equal(store.messages.find(message => message.id === 'message-fresh')?.status, 'queued');
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'send_queue_reconciled');
    assert.equal(logs.records.at(-1)?.action, 'send-queue-reconcile');
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

  it('batch-stops only owner sequences and returns per-item skipped results', async () => {
    const store = createStore(
      [
        createAccount({ id: 'account-owned', status: 'sequence_running' }),
        createAccount({ id: 'account-terminal', status: 'ready' }),
        createAccount({ id: 'account-member', ownerUserId: 'user-2', status: 'sequence_running' })
      ],
      {
        contacts: [
          createContact({ id: 'contact-owned', accountId: 'account-owned' }),
          createContact({ id: 'contact-terminal', accountId: 'account-terminal' }),
          createContact({ id: 'contact-member', accountId: 'account-member', ownerUserId: 'user-2' })
        ],
        enrollments: [
          createEnrollment({
            id: 'enrollment-owned',
            accountId: 'account-owned',
            contactId: 'contact-owned',
            status: 'sequence_running',
            runVersion: 2
          }),
          createEnrollment({
            id: 'enrollment-terminal',
            accountId: 'account-terminal',
            contactId: 'contact-terminal',
            status: 'stopped',
            runVersion: 1
          }),
          createEnrollment({
            id: 'enrollment-member',
            accountId: 'account-member',
            contactId: 'contact-member',
            ownerUserId: 'user-2',
            status: 'sequence_running',
            runVersion: 4
          })
        ],
        messages: [
          createMessage({
            id: 'message-owned-1',
            accountId: 'account-owned',
            contactId: 'contact-owned',
            enrollmentId: 'enrollment-owned',
            status: 'queued',
            bullJobId: 'job-owned'
          }),
          createMessage({
            id: 'message-member-1',
            accountId: 'account-member',
            contactId: 'contact-member',
            enrollmentId: 'enrollment-member',
            ownerUserId: 'user-2',
            status: 'queued',
            bullJobId: 'job-member'
          })
        ]
      }
    );
    const service = new CrmService(store);

    const result = await service.batchStopSequenceEnrollments(
      { ids: ['enrollment-owned', 'enrollment-terminal', 'enrollment-member'] },
      createContext({ organizationRole: 'admin' })
    );

    assert.deepEqual(
      result.results.map(item => [item.id, item.status]),
      [
        ['enrollment-owned', 'success'],
        ['enrollment-terminal', 'skipped'],
        ['enrollment-member', 'skipped']
      ]
    );
    assert.equal(result.successCount, 1);
    assert.equal(result.skippedCount, 2);
    assert.equal(store.enrollments.find(item => item.id === 'enrollment-owned')?.status, 'stopped');
    assert.equal(store.enrollments.find(item => item.id === 'enrollment-owned')?.runVersion, 3);
    assert.equal(store.messages.find(item => item.id === 'message-owned-1')?.status, 'skipped');
    assert.equal(store.enrollments.find(item => item.id === 'enrollment-member')?.status, 'sequence_running');
    assert.equal(store.messages.find(item => item.id === 'message-member-1')?.status, 'queued');
  });

  it('creates a CRM AI draft task for eligible owner sequences and stores invalid selections as skipped items', async () => {
    const store = createStore(
      [
        createAccount({ id: 'account-1', name: 'ABC Trading', status: 'ready' }),
        createAccount({ id: 'account-2', name: 'Blocked Trading', status: 'ready' })
      ],
      {
        contacts: [
          createContact({ id: 'contact-1', accountId: 'account-1', fullName: 'Ali Hassan' }),
          createContact({ id: 'contact-2', accountId: 'account-2', fullName: 'Sara Buyer' })
        ],
        productLines: [createProductLine({ id: 'product-line-1', aiWritingConfig: createAiWritingConfig() })],
        enrollments: [
          createEnrollment({
            id: 'enrollment-1',
            accountId: 'account-1',
            contactId: 'contact-1',
            productLineId: 'product-line-1',
            status: 'ready_to_send'
          }),
          createEnrollment({
            id: 'blocked-enrollment',
            accountId: 'account-2',
            contactId: 'contact-2',
            productLineId: 'product-line-1',
            status: 'ready_to_send'
          })
        ],
        messages: [
          createMessage({
            id: 'message-1',
            accountId: 'account-1',
            contactId: 'contact-1',
            enrollmentId: 'enrollment-1',
            status: 'sent',
            stepIndex: 1
          }),
          createMessage({
            id: 'blocked-message-1',
            accountId: 'account-2',
            contactId: 'contact-2',
            enrollmentId: 'blocked-enrollment',
            status: 'draft_pending_review',
            stepIndex: 2
          })
        ]
      }
    );
    const logs = createLogRecorder();
    const aiDraftCalls: CrmAiDraftPromptInput[] = [];
    const aiDraftService = createAiDraftService(aiDraftCalls);
    const sendQueue = createSendQueue();
    const service = new CrmService(
      store,
      undefined,
      logs.service,
      sendQueue,
      undefined,
      undefined,
      undefined,
      undefined,
      aiDraftService
    );

    const result = await service.createAiDraftTask(
      { enrollmentIds: ['enrollment-1', 'blocked-enrollment', 'missing-enrollment', 'enrollment-1'] },
      createContext()
    );

    assert.equal(result.task.requestedCount, 3);
    assert.equal(result.task.pendingCount, 1);
    assert.equal(result.task.skippedCount, 2);
    assert.equal(store.aiDraftTasks.length, 1);
    assert.deepEqual(
      store.aiDraftTaskItems.map(item => ({
        enrollmentId: item.enrollmentId,
        status: item.status,
        stepIndex: item.stepIndex,
        accountId: item.accountId,
        contactId: item.contactId,
        productLineId: item.productLineId,
        messageId: item.messageId,
        reason: item.failureReason
      })),
      [
        {
          enrollmentId: 'enrollment-1',
          status: 'pending',
          stepIndex: 2,
          accountId: 'account-1',
          contactId: 'contact-1',
          productLineId: 'product-line-1',
          messageId: null,
          reason: null
        },
        {
          enrollmentId: 'blocked-enrollment',
          status: 'skipped',
          stepIndex: 0,
          accountId: 'account-2',
          contactId: 'contact-2',
          productLineId: 'product-line-1',
          messageId: null,
          reason: '已存在下一步草稿或待发送消息，请先处理后再生成'
        },
        {
          enrollmentId: 'missing-enrollment',
          status: 'skipped',
          stepIndex: 0,
          accountId: null,
          contactId: null,
          productLineId: null,
          messageId: null,
          reason: '邮件序列不存在或无权操作'
        }
      ]
    );
    assert.equal(aiDraftCalls.length, 0);
    assert.equal(sendQueue.jobs.length, 0);
    assert.equal(logs.records.at(-1)?.action, 'ai-draft-task-create');
    assert.deepEqual(logs.records.at(-1)?.metadata, {
      taskId: 'ai-draft-task-1',
      requestedCount: 3,
      pendingCount: 1,
      skippedCount: 2
    });
  });

  it('enqueues pending CRM AI draft tasks and persists the BullMQ job id without sending Gmail', async () => {
    const store = createStore([createAccount({ id: 'account-1', name: 'ABC Trading', status: 'ready' })], {
      contacts: [createContact({ id: 'contact-1', accountId: 'account-1' })],
      productLines: [createProductLine({ id: 'product-line-1', aiWritingConfig: createAiWritingConfig() })],
      enrollments: [
        createEnrollment({
          id: 'enrollment-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          productLineId: 'product-line-1',
          status: 'ready_to_send'
        })
      ],
      messages: [
        createMessage({
          id: 'message-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          enrollmentId: 'enrollment-1',
          status: 'sent',
          stepIndex: 1
        })
      ]
    });
    const sendQueue = createSendQueue();
    const aiDraftTaskQueue = createAiDraftTaskQueue();
    const service = new CrmService(
      store,
      undefined,
      undefined,
      sendQueue,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      aiDraftTaskQueue
    );

    const result = await service.createAiDraftTask({ enrollmentIds: ['enrollment-1'] }, createContext());

    assert.equal(result.task.status, 'queued');
    assert.deepEqual(aiDraftTaskQueue.jobs, [
      {
        taskId: 'ai-draft-task-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        runVersion: 1
      }
    ]);
    assert.equal(store.aiDraftTasks[0].bullJobId, 'ai-draft-task-1:1');
    assert.equal(sendQueue.jobs.length, 0);
  });

  it('skips CRM AI draft task items when contact is unsubscribed, blacklisted or AI config is incomplete', async () => {
    const aiWritingConfig = createAiWritingConfig();
    const store = createStore(
      [
        createAccount({ id: 'account-unsubscribed', name: 'Unsubscribed Buyer', status: 'ready' }),
        createAccount({ id: 'account-blacklisted', name: 'Blacklisted Buyer', status: 'ready' }),
        createAccount({ id: 'account-incomplete', name: 'Incomplete Config Buyer', status: 'ready' })
      ],
      {
        contacts: [
          createContact({
            id: 'contact-unsubscribed',
            accountId: 'account-unsubscribed',
            emailStatus: 'unsubscribed'
          }),
          createContact({
            id: 'contact-blacklisted',
            accountId: 'account-blacklisted',
            emailHash: 'blacklisted-hash'
          }),
          createContact({ id: 'contact-incomplete', accountId: 'account-incomplete' })
        ],
        blacklists: [createBlacklist({ emailHash: 'blacklisted-hash' })],
        productLines: [
          createProductLine({ id: 'product-line-complete', aiWritingConfig }),
          createProductLine({
            id: 'product-line-incomplete',
            aiWritingConfig: {
              ...aiWritingConfig,
              steps: aiWritingConfig.steps.map(step => (step.stepIndex === 2 ? { ...step, prompt: '' } : step))
            }
          })
        ],
        enrollments: [
          createEnrollment({
            id: 'enrollment-unsubscribed',
            accountId: 'account-unsubscribed',
            contactId: 'contact-unsubscribed',
            productLineId: 'product-line-complete',
            status: 'ready_to_send'
          }),
          createEnrollment({
            id: 'enrollment-blacklisted',
            accountId: 'account-blacklisted',
            contactId: 'contact-blacklisted',
            productLineId: 'product-line-complete',
            status: 'ready_to_send'
          }),
          createEnrollment({
            id: 'enrollment-incomplete',
            accountId: 'account-incomplete',
            contactId: 'contact-incomplete',
            productLineId: 'product-line-incomplete',
            status: 'ready_to_send'
          })
        ],
        messages: [
          createMessage({
            id: 'message-unsubscribed',
            accountId: 'account-unsubscribed',
            contactId: 'contact-unsubscribed',
            enrollmentId: 'enrollment-unsubscribed',
            status: 'sent',
            stepIndex: 1
          }),
          createMessage({
            id: 'message-blacklisted',
            accountId: 'account-blacklisted',
            contactId: 'contact-blacklisted',
            enrollmentId: 'enrollment-blacklisted',
            status: 'sent',
            stepIndex: 1
          }),
          createMessage({
            id: 'message-incomplete',
            accountId: 'account-incomplete',
            contactId: 'contact-incomplete',
            enrollmentId: 'enrollment-incomplete',
            status: 'sent',
            stepIndex: 1
          })
        ]
      }
    );
    const notificationCreates: Array<{ title: string; content: string; type: string; metadata?: unknown }> = [];
    const service = new CrmService(store, undefined, undefined, undefined, {
      async create(input: { title: string; content: string; type: string; metadata?: unknown }) {
        notificationCreates.push(input);
        return input as never;
      }
    } as never);

    const result = await service.createAiDraftTask(
      { enrollmentIds: ['enrollment-unsubscribed', 'enrollment-blacklisted', 'enrollment-incomplete'] },
      createContext()
    );

    assert.equal(result.task.status, 'completed');
    assert.equal(result.task.pendingCount, 0);
    assert.equal(result.task.skippedCount, 3);
    assert.deepEqual(result.task.resultSummary, {
      requestedCount: 3,
      successCount: 0,
      skippedCount: 3,
      failedCount: 0
    });
    assert.equal(result.task.readAt, null);
    assert.equal(notificationCreates.length, 1);
    assert.equal(notificationCreates[0].type, 'crm_ai_draft_task_completed');
    assert.deepEqual(notificationCreates[0].metadata, {
      taskId: 'ai-draft-task-1',
      resultSummary: {
        requestedCount: 3,
        successCount: 0,
        skippedCount: 3,
        failedCount: 0
      }
    });
    assert.deepEqual(
      store.aiDraftTaskItems.map(item => [item.enrollmentId, item.failureReason]),
      [
        ['enrollment-unsubscribed', '联系人已退订，不能继续开发'],
        ['enrollment-blacklisted', '该邮箱已在组织黑名单中，不能继续开发'],
        ['enrollment-incomplete', 'AI 写信第 2 封提示词不能为空']
      ]
    );
  });

  it('preloads CRM AI draft task review items and blacklists without per-item reads', async () => {
    const aiWritingConfig = createAiWritingConfig();
    const store = createStore(
      [
        createAccount({ id: 'account-1', name: 'First Buyer', status: 'ready' }),
        createAccount({ id: 'account-2', name: 'Second Buyer', status: 'ready' }),
        createAccount({ id: 'account-3', name: 'Third Buyer', status: 'ready' })
      ],
      {
        contacts: [
          createContact({ id: 'contact-1', accountId: 'account-1' }),
          createContact({ id: 'contact-2', accountId: 'account-2', emailHash: 'blacklisted-hash' }),
          createContact({ id: 'contact-3', accountId: 'account-3' })
        ],
        blacklists: [createBlacklist({ emailHash: 'blacklisted-hash' })],
        productLines: [createProductLine({ id: 'product-line-1', aiWritingConfig })],
        enrollments: [
          createEnrollment({
            id: 'enrollment-1',
            accountId: 'account-1',
            contactId: 'contact-1',
            productLineId: 'product-line-1',
            status: 'ready_to_send'
          }),
          createEnrollment({
            id: 'enrollment-2',
            accountId: 'account-2',
            contactId: 'contact-2',
            productLineId: 'product-line-1',
            status: 'ready_to_send'
          }),
          createEnrollment({
            id: 'enrollment-3',
            accountId: 'account-3',
            contactId: 'contact-3',
            productLineId: 'product-line-1',
            status: 'ready_to_send'
          })
        ],
        messages: [
          createMessage({ id: 'message-1', accountId: 'account-1', contactId: 'contact-1', enrollmentId: 'enrollment-1', status: 'sent', stepIndex: 1 }),
          createMessage({ id: 'message-2', accountId: 'account-2', contactId: 'contact-2', enrollmentId: 'enrollment-2', status: 'sent', stepIndex: 1 }),
          createMessage({ id: 'message-3', accountId: 'account-3', contactId: 'contact-3', enrollmentId: 'enrollment-3', status: 'sent', stepIndex: 1 })
        ]
      }
    );
    const service = new CrmService(store);

    await service.createAiDraftTask(
      { enrollmentIds: ['enrollment-1', 'enrollment-2', 'enrollment-3'] },
      createContext()
    );

    assert.equal(store.sequenceReviewDetailCalls.length, 0);
    assert.equal(store.blacklistLookupCalls.length, 0);
    assert.deepEqual(
      store.aiDraftTaskItems.map(item => [item.enrollmentId, item.status, item.failureReason]),
      [
        ['enrollment-1', 'pending', null],
        ['enrollment-2', 'skipped', '该邮箱已在组织黑名单中，不能继续开发'],
        ['enrollment-3', 'pending', null]
      ]
    );
  });

  it('rejects CRM AI draft task creation when the current user already has an active task', async () => {
    const store = createStore([], {
      aiDraftTasks: [createAiDraftTask({ id: 'active-task-1', status: 'queued' })]
    });
    const service = new CrmService(store);

    await assert.rejects(
      () => service.createAiDraftTask({ enrollmentIds: ['enrollment-1'] }, createContext()),
      BadRequestException
    );
  });

  it('rejects CRM AI draft task creation when organization active task cap is reached', async () => {
    const store = createStore([], {
      aiDraftQueueConfig: createAiDraftQueueConfig({ maxActiveTasksPerUser: 2, maxActiveTasksPerOrg: 1 }),
      aiDraftTasks: [createAiDraftTask({ id: 'org-task-1', ownerUserId: 'user-2', status: 'running' })]
    });
    const service = new CrmService(store);

    await assert.rejects(
      () => service.createAiDraftTask({ enrollmentIds: ['enrollment-1'] }, createContext()),
      BadRequestException
    );
  });

  it('retries only retryable failed CRM AI draft task items with a new run version', async () => {
    const store = createStore([], {
      aiDraftTasks: [
        createAiDraftTask({
          id: 'ai-draft-task-1',
          status: 'failed',
          runVersion: 2,
          pendingCount: 0,
          failedCount: 2,
          failureReason: '部分草稿生成失败'
        })
      ],
      aiDraftTaskItems: [
        createAiDraftTaskItem({
          id: 'retryable-item',
          status: 'failed',
          attemptCount: 3,
          failureType: 'retryable',
          failureReason: 'rate limit',
          metadata: { nextRetryAt: '2026-06-20T10:00:00.000Z' }
        }),
        createAiDraftTaskItem({
          id: 'fatal-item',
          enrollmentId: 'enrollment-2',
          status: 'failed',
          failureType: 'fatal',
          failureReason: 'bad payload'
        })
      ]
    });
    const aiDraftTaskQueue = createAiDraftTaskQueue();
    const service = new CrmService(
      store,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      aiDraftTaskQueue
    );

    const result = await service.retryFailedAiDraftTask('ai-draft-task-1', createContext());

    assert.equal(result.task.status, 'queued');
    assert.equal(result.task.runVersion, 3);
    assert.equal(store.aiDraftTaskItems[0].status, 'pending');
    assert.equal(store.aiDraftTaskItems[0].attemptCount, 0);
    assert.equal(store.aiDraftTaskItems[1].status, 'failed');
    assert.deepEqual(aiDraftTaskQueue.jobs, [
      {
        taskId: 'ai-draft-task-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        runVersion: 3
      }
    ]);
  });

  it('cancels active CRM AI draft tasks and invalidates the queued job', async () => {
    const store = createStore([], {
      aiDraftTasks: [
        createAiDraftTask({
          id: 'ai-draft-task-1',
          status: 'running',
          runVersion: 2,
          bullJobId: 'ai-draft-task-1:2',
          pendingCount: 1,
          runningCount: 1
        })
      ],
      aiDraftTaskItems: [
        createAiDraftTaskItem({ id: 'pending-item', status: 'pending' }),
        createAiDraftTaskItem({ id: 'running-item', enrollmentId: 'enrollment-2', status: 'running' })
      ]
    });
    const aiDraftTaskQueue = createAiDraftTaskQueue();
    const service = new CrmService(
      store,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      aiDraftTaskQueue
    );

    const result = await service.cancelAiDraftTask('ai-draft-task-1', createContext());

    assert.equal(result.task.status, 'cancelled');
    assert.equal(result.task.runVersion, 3);
    assert.equal(result.task.pendingCount, 0);
    assert.equal(result.task.skippedCount, 2);
    assert.equal(
      store.aiDraftTaskItems.every(item => item.status === 'skipped'),
      true
    );
    assert.deepEqual(aiDraftTaskQueue.removedJobIds, ['ai-draft-task-1:2']);
  });

  it('marks finished CRM AI draft tasks as read and clears related notifications', async () => {
    const store = createStore([], {
      aiDraftTasks: [
        createAiDraftTask({
          id: 'ai-draft-task-1',
          status: 'completed',
          pendingCount: 0,
          successCount: 1,
          readAt: null
        })
      ]
    });
    const markedTargets: Array<[string, string, string]> = [];
    const service = new CrmService(store, undefined, undefined, undefined, {
      async markTargetReadForUser(targetType: string, targetId: string, userId: string) {
        markedTargets.push([targetType, targetId, userId]);
        return { count: 1 };
      }
    } as never);

    const result = await service.markAiDraftTaskRead('ai-draft-task-1', createContext());

    assert.ok(result.task.readAt);
    assert.deepEqual(markedTargets, [['crmAiDraftTask', 'ai-draft-task-1', 'user-1']]);
  });

  it('saves CRM AI draft queue config and applies queue concurrency for super admin', async () => {
    const store = createStore();
    const logs = createLogRecorder();
    const aiDraftTaskQueue = createAiDraftTaskQueue();
    const service = new CrmService(
      store,
      undefined,
      logs.service,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      aiDraftTaskQueue
    );

    const result = await service.saveAiDraftQueueConfig(
      { itemConcurrency: 5, maxItemConcurrency: 5, maxActiveTasksPerOrg: 4, maxAttempts: 2 },
      createContext({ roles: ['R_SUPER'] })
    );

    assert.equal(result.itemConcurrency, 5);
    assert.equal(result.maxActiveTasksPerOrg, 4);
    assert.deepEqual(aiDraftTaskQueue.globalConcurrencies, [4]);
    assert.equal(logs.records.at(-1)?.action, 'ai-draft-queue-config-save');
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
      contacts: [
        createContact({ id: 'contact-1', accountId: 'account-1', email: 'ali@example.com', emailStatus: 'valid' })
      ],
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
      contacts: [
        createContact({ id: 'contact-1', accountId: 'account-1', email: 'ali@example.com', emailStatus: 'valid' })
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

  it('keeps vague unsubscribe replies pending for owner confirmation', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'sequence_running' })], {
      contacts: [
        createContact({ id: 'contact-1', accountId: 'account-1', email: 'ali@example.com', emailStatus: 'valid' })
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
        bodyText: 'Not interested right now, thanks.',
        receivedAt: '2026-06-18T11:00:00.000Z'
      },
      createContext()
    );

    assert.equal(result.messages[0].messageType, 'unsubscribe_review_pending');
    assert.equal(store.contacts[0].emailStatus, 'valid');
    assert.equal(store.accounts[0].status, 'replied_pending');
    assert.equal(store.blacklists.length, 0);
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'customer_replied');
  });

  it('confirms a pending unsubscribe review before blacklisting and skipping queued messages', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'sequence_running' })], {
      contacts: [
        createContact({ id: 'contact-1', accountId: 'account-1', email: 'ali@example.com', emailStatus: 'valid' })
      ],
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
          id: 'message-queued',
          accountId: 'account-1',
          contactId: 'contact-1',
          enrollmentId: 'enrollment-1',
          mailboxId: 'mailbox-1',
          status: 'queued',
          bullJobId: 'send-job-queued'
        })
      ],
      inboxThreads: [
        createInboxThread({
          id: 'inbox-thread-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          enrollmentId: 'enrollment-1',
          mailboxId: 'mailbox-1'
        })
      ],
      inboxMessages: [
        createInboxMessage({
          id: 'inbox-message-1',
          threadId: 'inbox-thread-1',
          accountId: 'account-1',
          contactId: 'contact-1',
          enrollmentId: 'enrollment-1',
          mailboxId: 'mailbox-1',
          fromEmail: 'ali@example.com',
          fromEmailHash: 'hash-1',
          maskedFromEmail: 'a***@example.com',
          messageType: 'unsubscribe_review_pending'
        })
      ]
    });
    const service = new CrmService(store);

    const result = await service.confirmInboxMessageUnsubscribe('inbox-message-1', createContext());

    assert.equal(result.message.messageType, 'unsubscribe_hint');
    assert.equal(store.contacts[0].emailStatus, 'unsubscribed');
    assert.equal(store.accounts[0].status, 'blocked');
    assert.equal(store.enrollments[0].status, 'replied');
    assert.equal(store.enrollments[0].runVersion, 4);
    assert.equal(store.messages[0].status, 'skipped');
    assert.equal(store.messages[0].bullJobId, null);
    assert.equal(store.blacklists.length, 1);
    assert.equal(store.timelineEvents.at(-1)?.eventType, 'customer_unsubscribed');
  });

  it('classifies delivery failure replies and marks the contact as unreachable', async () => {
    const store = createStore([createAccount({ id: 'account-1', status: 'sequence_running' })], {
      contacts: [
        createContact({ id: 'contact-1', accountId: 'account-1', email: 'ali@example.com', emailStatus: 'valid' })
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
    assert.equal(
      superResult.records.find(record => record.id === 'peer-thread')?.lastMessageSnippet,
      'Please send details.'
    );
    assert.equal((await service.getInboxThread('peer-thread', superContext)).messages.length, 1);
    assert.equal(
      logs.records.some(record => record.action === 'inbox-body-viewed-by-super-admin'),
      true
    );
    assert.equal(JSON.stringify(logs.records).includes('Please send details.'), false);

    await service.saveOrganizationConfig({ allowAdminViewMemberEmailBody: true }, adminContext);
    const adminAllowedResult = await service.listInboxThreads(adminContext);

    assert.equal(
      adminAllowedResult.records.find(record => record.id === 'peer-thread')?.lastMessageSnippet,
      'Please send details.'
    );
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
        createMailbox({
          id: 'mailbox-1',
          emailAddress: 'sender@example.com',
          emailHash: hashTestEmail('sender@example.com')
        })
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

    const result = await service.replyInboxThread(
      'thread-1',
      { bodyText: '  Thanks, I will send details today.  ' },
      createContext()
    );

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
    await assert.rejects(
      () => service.replyInboxThread('peer-thread', { bodyText: '   ' }, createContext()),
      BadRequestException
    );
  });

  it('loads the workbench overview with current user owner scope even for organization admins', async () => {
    const store = createStore();
    const service = new CrmService(store);
    const now = new Date('2026-06-20T09:00:00.000Z');

    const overview = await service.getWorkbenchOverview(createContext({ organizationRole: 'admin' }), now);

    assert.equal(overview.today.pendingReplyCount, 3);
    assert.deepEqual(store.lastWorkbenchOverviewArgs, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      now
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
    archivedFingerprints?: TestArchivedFingerprint[];
    contacts?: TestContact[];
    blacklists?: TestBlacklist[];
    timelineEvents?: TestTimelineEvent[];
    mailboxes?: TestMailbox[];
    productLines?: TestProductLine[];
    productLinePromptVersions?: TestProductLinePromptVersion[];
    emailTemplateGroups?: TestEmailTemplateGroup[];
    sequencePolicies?: TestSequencePolicy[];
    enrollments?: TestEnrollment[];
    messages?: TestMessage[];
    draftVersions?: TestDraftVersion[];
    sendPreferences?: TestSendPreference[];
    inboxThreads?: TestInboxThread[];
    inboxMessages?: TestInboxMessage[];
    aiDraftTasks?: TestAiDraftTask[];
    aiDraftTaskItems?: TestAiDraftTaskItem[];
    aiDraftQueueConfig?: TestAiDraftQueueConfig;
    emailVerificationCaches?: TestEmailVerificationCache[];
    globalConfig?: TestGlobalConfig;
    organizationConfig?: TestOrganizationConfig | null;
    personaProfiles?: TestPersonaProfile[];
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
  productLinePromptVersions: TestProductLinePromptVersion[];
  emailTemplateGroups: TestEmailTemplateGroup[];
  sequencePolicies: TestSequencePolicy[];
  enrollments: TestEnrollment[];
  messages: TestMessage[];
  draftVersions: TestDraftVersion[];
  sendPreferences: TestSendPreference[];
  inboxThreads: TestInboxThread[];
  inboxMessages: TestInboxMessage[];
  aiDraftTasks: TestAiDraftTask[];
  aiDraftTaskItems: TestAiDraftTaskItem[];
  aiDraftQueueConfig: TestAiDraftQueueConfig;
  globalConfig: TestGlobalConfig;
  organizationConfig: TestOrganizationConfig | null;
  personaProfiles: TestPersonaProfile[];
  mailboxUpdateCalls: Array<{ id: string; input: Parameters<CrmStore['updateMailbox']>[1] }>;
  productLineUpdateCalls: Array<{ id: string; organizationId: string; input: Partial<TestProductLine> }>;
  emailTemplateUpdateCalls: Array<{
    id: string;
    organizationId: string;
    input: Parameters<CrmStore['updateEmailTemplateGroup']>[2];
  }>;
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
  lastProductLinePromptVersionListArgs?: { organizationId: string; productLineId: string };
  lastPersonaProfileListArgs?: Parameters<CrmStore['listPersonaProfiles']>[0];
  lastPersonaProfileDetailArgs?: { id: string; organizationId: string };
  lastEmailTemplateListArgs?: Parameters<CrmStore['listEmailTemplateGroups']>[0];
  lastEmailTemplateDetailArgs?: { id: string; organizationId: string };
  lastSequencePolicyListArgs?: Parameters<CrmStore['listSequencePolicies']>[0];
  lastSequencePolicyDetailArgs?: { id: string; organizationId: string };
  lastBlacklistListArgs?: Parameters<CrmStore['listBlacklistEntries']>[0];
  lastSequenceReviewListArgs?: Parameters<CrmStore['listSequenceReviewItems']>[0];
  lastStrategyStatsArgs?: Parameters<CrmStore['listStrategyStats']>[0];
  lastWorkbenchOverviewArgs?: Parameters<CrmStore['getWorkbenchOverview']>[0];
  lastSequenceReviewDetailArgs?: Parameters<CrmStore['getSequenceReviewItem']>[0];
  sequenceReviewDetailCalls: Parameters<CrmStore['getSequenceReviewItem']>[0][];
  blacklistLookupCalls: Parameters<CrmStore['findBlacklistEntry']>[0][];
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
  const productLinePromptVersions: TestProductLinePromptVersion[] = [...(initialData.productLinePromptVersions ?? [])];
  const emailTemplateGroups: TestEmailTemplateGroup[] = [...(initialData.emailTemplateGroups ?? [])];
  const sequencePolicies: TestSequencePolicy[] = [...(initialData.sequencePolicies ?? [])];
  const enrollments: TestEnrollment[] = [...(initialData.enrollments ?? [])];
  const messages: TestMessage[] = [...(initialData.messages ?? [])];
  const draftVersions: TestDraftVersion[] = [...(initialData.draftVersions ?? [])];
  const sendPreferences: TestSendPreference[] = [...(initialData.sendPreferences ?? [])];
  const inboxThreads: TestInboxThread[] = [...(initialData.inboxThreads ?? [])];
  const inboxMessages: TestInboxMessage[] = [...(initialData.inboxMessages ?? [])];
  const aiDraftTasks: TestAiDraftTask[] = [...(initialData.aiDraftTasks ?? [])];
  const aiDraftTaskItems: TestAiDraftTaskItem[] = [...(initialData.aiDraftTaskItems ?? [])];
  let aiDraftQueueConfig = initialData.aiDraftQueueConfig ?? createAiDraftQueueConfig();
  const globalConfig = initialData.globalConfig ?? createGlobalConfig();
  let organizationConfig = initialData.organizationConfig ?? null;
  const personaProfiles: TestPersonaProfile[] = [...(initialData.personaProfiles ?? [])];
  const mailboxUpdateCalls: Array<{ id: string; input: Parameters<CrmStore['updateMailbox']>[1] }> = [];
  const productLineUpdateCalls: Array<{ id: string; organizationId: string; input: Partial<TestProductLine> }> = [];
  const emailTemplateUpdateCalls: Array<{
    id: string;
    organizationId: string;
    input: Parameters<CrmStore['updateEmailTemplateGroup']>[2];
  }> = [];
  const enrollmentUpdateCalls: Array<{ id: string; organizationId: string; input: Partial<TestEnrollment> }> = [];
  const messageUpdateCalls: Array<{ id: string; organizationId: string; input: Partial<TestMessage> }> = [];
  const sequenceReviewDetailCalls: Parameters<CrmStore['getSequenceReviewItem']>[0][] = [];
  const blacklistLookupCalls: Parameters<CrmStore['findBlacklistEntry']>[0][] = [];

  return {
    accounts,
    archivedFingerprints,
    contacts,
    blacklists,
    emailVerificationCaches,
    timelineEvents,
    mailboxes,
    productLines,
    productLinePromptVersions,
    emailTemplateGroups,
    sequencePolicies,
    personaProfiles,
    enrollments,
    messages,
    draftVersions,
    sendPreferences,
    inboxThreads,
    inboxMessages,
    aiDraftTasks,
    aiDraftTaskItems,
    get aiDraftQueueConfig() {
      return aiDraftQueueConfig;
    },
    globalConfig,
    get organizationConfig() {
      return organizationConfig;
    },
    mailboxUpdateCalls,
    productLineUpdateCalls,
    emailTemplateUpdateCalls,
    enrollmentUpdateCalls,
    messageUpdateCalls,
    sequenceReviewDetailCalls,
    blacklistLookupCalls,
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
      const existingCache = emailVerificationCaches.find(cache => cache.emailHash === input.emailHash);

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
        ownerConcurrentSendLimit: input.ownerConcurrentSendLimit ?? globalConfig.ownerConcurrentSendLimit,
        ownerDailySendLimitMax: input.ownerDailySendLimitMax ?? globalConfig.ownerDailySendLimitMax,
        followUpDelayDays: input.followUpDelayDays ?? globalConfig.followUpDelayDays,
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      });
      return globalConfig;
    },
    async createAiDraftTask(input: CrmAiDraftTaskCreateInput) {
      const activeUserTaskCount = await this.countActiveAiDraftTasksForUser({
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId
      });
      const activeOrgTaskCount = await this.countActiveAiDraftTasksForOrg({ organizationId: input.organizationId });

      if (activeUserTaskCount >= aiDraftQueueConfig.maxActiveTasksPerUser) {
        return { task: null, limitReason: 'user_active_limit' as const };
      }

      if (activeOrgTaskCount >= aiDraftQueueConfig.maxActiveTasksPerOrg) {
        return { task: null, limitReason: 'organization_active_limit' as const };
      }

      const maxAttempts = aiDraftQueueConfig.maxAttempts;
      const task = createAiDraftTask({
        id: `ai-draft-task-${aiDraftTasks.length + 1}`,
        organizationId: input.organizationId,
        organizationRole: input.organizationRole ?? null,
        ownerUserId: input.ownerUserId,
        ownerUserName: input.ownerUserName ?? null,
        status: input.items.some(item => (item.status ?? 'pending') === 'pending') ? 'queued' : 'completed',
        requestedCount: input.requestedCount,
        pendingCount: input.items.filter(item => (item.status ?? 'pending') === 'pending').length,
        skippedCount: input.items.filter(item => item.status === 'skipped').length,
        effectiveConcurrency: Math.min(aiDraftQueueConfig.itemConcurrency, aiDraftQueueConfig.maxItemConcurrency),
        maxAttempts,
        finishedAt: input.items.some(item => (item.status ?? 'pending') === 'pending')
          ? null
          : new Date('2026-06-20T09:00:00.000Z')
      });
      const items = input.items.map((item, index) =>
        createAiDraftTaskItem({
          ...item,
          id: `ai-draft-task-item-${aiDraftTaskItems.length + index + 1}`,
          taskId: task.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: item.status ?? 'pending',
          maxAttempts
        })
      );
      aiDraftTasks.push(task);
      aiDraftTaskItems.push(...items);

      return { task };
    },
    async countActiveAiDraftTasksForUser(input) {
      return aiDraftTasks.filter(
        task =>
          task.organizationId === input.organizationId &&
          task.ownerUserId === input.ownerUserId &&
          ['queued', 'running'].includes(task.status)
      ).length;
    },
    async countActiveAiDraftTasksForOrg(input) {
      return aiDraftTasks.filter(
        task => task.organizationId === input.organizationId && ['queued', 'running'].includes(task.status)
      ).length;
    },
    async findCurrentAiDraftTaskForUser(input) {
      return (
        aiDraftTasks.find(
          task =>
            task.organizationId === input.organizationId &&
            task.ownerUserId === input.ownerUserId &&
            (['queued', 'running'].includes(task.status) ||
              ((task.status === 'completed' || task.status === 'failed') && !task.readAt))
        ) ?? null
      );
    },
    async findAiDraftTaskById(input) {
      return (
        aiDraftTasks.find(task => {
          if (task.id !== input.id) return false;
          if (task.organizationId !== input.organizationId) return false;
          if (input.ownerUserId && task.ownerUserId !== input.ownerUserId) return false;
          return true;
        }) ?? null
      );
    },
    async listAiDraftTasks(input) {
      const records = aiDraftTasks.filter(task => {
        if (task.organizationId !== input.organizationId) return false;
        if (input.ownerUserId && task.ownerUserId !== input.ownerUserId) return false;
        return true;
      });

      return {
        records: records.slice(input.skip, input.skip + input.take),
        total: records.length
      };
    },
    async listAiDraftTaskItems(input) {
      return aiDraftTaskItems.filter(item => item.taskId === input.taskId);
    },
    async updateAiDraftTask(id, patch, guard) {
      const task = aiDraftTasks.find(item => {
        if (item.id !== id) return false;
        if (guard?.organizationId && item.organizationId !== guard.organizationId) return false;
        if (guard?.ownerUserId && item.ownerUserId !== guard.ownerUserId) return false;
        if (guard?.runVersion && item.runVersion !== guard.runVersion) return false;
        if (guard?.status) {
          const statuses = Array.isArray(guard.status) ? guard.status : [guard.status];
          if (!statuses.includes(item.status)) return false;
        }
        return true;
      });
      if (!task) return null;
      Object.assign(task, patch, { updatedAt: new Date('2026-06-20T10:00:00.000Z') });
      return task;
    },
    async updateAiDraftTaskItem(id, patch, guard) {
      const item = aiDraftTaskItems.find(taskItem => {
        if (taskItem.id !== id) return false;
        if (guard?.taskId && taskItem.taskId !== guard.taskId) return false;
        if (guard?.organizationId && taskItem.organizationId !== guard.organizationId) return false;
        if (guard?.ownerUserId && taskItem.ownerUserId !== guard.ownerUserId) return false;
        if (guard?.status) {
          const statuses = Array.isArray(guard.status) ? guard.status : [guard.status];
          if (!statuses.includes(taskItem.status)) return false;
        }
        return true;
      });
      if (!item) return null;
      Object.assign(item, patch, { updatedAt: new Date('2026-06-20T10:00:00.000Z') });
      return item;
    },
    async getAiDraftQueueConfig() {
      return aiDraftQueueConfig;
    },
    async saveAiDraftQueueConfig(input: CrmAiDraftQueueConfigInput) {
      aiDraftQueueConfig = createAiDraftQueueConfig({
        ...aiDraftQueueConfig,
        ...input,
        updatedAt: new Date('2026-06-20T10:00:00.000Z')
      });
      return aiDraftQueueConfig;
    },
    async getSendPreference(args) {
      return (
        sendPreferences.find(
          preference => preference.organizationId === args.organizationId && preference.ownerUserId === args.ownerUserId
        ) ?? null
      );
    },
    async saveSendPreference(input) {
      const existing = sendPreferences.find(
        preference => preference.organizationId === input.organizationId && preference.ownerUserId === input.ownerUserId
      );

      if (existing) {
        Object.assign(existing, {
          ownerUserName: input.ownerUserName ?? null,
          dailySendLimit: input.dailySendLimit,
          followUpSharePercent: input.followUpSharePercent,
          updatedById: input.updatedById ?? null,
          updatedByName: input.updatedByName ?? null,
          updatedAt: new Date('2026-06-18T10:00:00.000Z')
        });

        return existing;
      }

      const record = createSendPreference({
        id: `send-preference-${sendPreferences.length + 1}`,
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        ownerUserName: input.ownerUserName ?? null,
        dailySendLimit: input.dailySendLimit,
        followUpSharePercent: input.followUpSharePercent,
        updatedById: input.updatedById ?? null,
        updatedByName: input.updatedByName ?? null
      });
      sendPreferences.push(record);

      return record;
    },
    async countOwnerQueuedMessages(args) {
      return messages.filter(
        message =>
          message.organizationId === args.organizationId &&
          message.ownerUserId === args.ownerUserId &&
          message.status === 'queued'
      ).length;
    },
    async countDispatchedMessages(input) {
      return messages.filter(message => {
        if (message.organizationId !== input.organizationId) return false;
        if (input.ownerUserId && message.ownerUserId !== input.ownerUserId) return false;
        if (input.mailboxId && message.mailboxId !== input.mailboxId) return false;
        if (input.stepKind === 'first_touch' && message.stepIndex !== 1) return false;
        if (input.stepKind === 'follow_up' && message.stepIndex <= 1) return false;

        if (message.status === 'queued') {
          return Boolean(message.scheduledAt && message.scheduledAt >= input.from && message.scheduledAt < input.to);
        }

        if (message.status === 'sent') {
          return Boolean(message.sentAt && message.sentAt >= input.from && message.sentAt < input.to);
        }

        return false;
      }).length;
    },
    async listOwnerSendStates(input) {
      return input.owners.map(owner => {
        const ownerMessages = messages.filter(
          message => message.organizationId === owner.organizationId && message.ownerUserId === owner.ownerUserId
        );
        const dispatchedMessages = ownerMessages.filter(message => {
          if (message.status === 'queued') {
            return Boolean(message.scheduledAt && message.scheduledAt >= input.from && message.scheduledAt < input.to);
          }

          if (message.status === 'sent') {
            return Boolean(message.sentAt && message.sentAt >= input.from && message.sentAt < input.to);
          }

          return false;
        });

        return {
          organizationId: owner.organizationId,
          ownerUserId: owner.ownerUserId,
          preference:
            sendPreferences.find(
              preference =>
                preference.organizationId === owner.organizationId && preference.ownerUserId === owner.ownerUserId
            ) ?? null,
          queuedCount: ownerMessages.filter(message => message.status === 'queued').length,
          dailyCount: dispatchedMessages.length,
          firstTouchCount: dispatchedMessages.filter(message => message.stepIndex === 1).length,
          followUpCount: dispatchedMessages.filter(message => message.stepIndex > 1).length
        };
      });
    },
    async listMailboxSendStates(input) {
      return input.mailboxes.map(mailbox => {
        const mailboxMessages = messages.filter(
          message => message.organizationId === mailbox.organizationId && message.mailboxId === mailbox.mailboxId
        );
        const countInRange = (from: Date, to: Date) =>
          mailboxMessages.filter(message => {
            if (message.status === 'queued') {
              return Boolean(message.scheduledAt && message.scheduledAt >= from && message.scheduledAt < to);
            }

            if (message.status === 'sent') {
              return Boolean(message.sentAt && message.sentAt >= from && message.sentAt < to);
            }

            return false;
          }).length;

        return {
          organizationId: mailbox.organizationId,
          mailboxId: mailbox.mailboxId,
          dailyCount: countInRange(input.day.from, input.day.to),
          hourlyCount: countInRange(input.hour.from, input.hour.to)
        };
      });
    },
    async listDueSendCandidates() {
      return [];
    },
    async listStaleQueuedMessages(input) {
      return messages
        .filter(message => {
          if (message.status !== 'queued') return false;
          if (!message.bullJobId) return false;
          if (!message.scheduledAt || message.scheduledAt > input.before) return false;
          return true;
        })
        .toSorted(
          (left, right) =>
            (left.scheduledAt?.getTime() ?? 0) - (right.scheduledAt?.getTime() ?? 0) ||
            left.updatedAt.getTime() - right.updatedAt.getTime()
        )
        .slice(0, input.take);
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
      blacklistLookupCalls.push(args);
      return (
        blacklists.find(entry => entry.organizationId === args.organizationId && entry.emailHash === args.emailHash) ||
        null
      );
    },
    async listBlacklistEntriesByEmailHashes(args) {
      return blacklists.filter(entry => entry.organizationId === args.organizationId && args.emailHashes.includes(entry.emailHash));
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
        productLines.find(productLine => productLine.organizationId === organizationId && productLine.name === name) ??
        null
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
    async createProductLineAiPromptVersion(input) {
      const latestVersion =
        productLinePromptVersions
          .filter(
            version => version.organizationId === input.organizationId && version.productLineId === input.productLineId
          )
          .toSorted((left, right) => right.version - left.version)[0]?.version ?? 0;
      const version = createProductLinePromptVersion({
        ...input,
        id: `product-line-prompt-version-${productLinePromptVersions.length + 1}`,
        version: latestVersion + 1
      });
      productLinePromptVersions.push(version);
      return version;
    },
    async listProductLineAiPromptVersions(args) {
      this.lastProductLinePromptVersionListArgs = args;
      return productLinePromptVersions
        .filter(
          version => version.organizationId === args.organizationId && version.productLineId === args.productLineId
        )
        .toSorted(
          (left, right) => right.version - left.version || right.createdAt.getTime() - left.createdAt.getTime()
        );
    },
    async restoreProductLineAiPromptVersion(input) {
      const historicVersion = productLinePromptVersions.find(
        version =>
          version.id === input.versionId &&
          version.organizationId === input.organizationId &&
          version.productLineId === input.productLineId
      );
      const productLine = productLines.find(
        item => item.id === input.productLineId && item.organizationId === input.organizationId
      );

      if (!historicVersion || !productLine) return null;

      Object.assign(productLine, {
        aiWritingConfig: historicVersion.aiWritingConfig,
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      });

      const latestVersion =
        productLinePromptVersions
          .filter(
            version => version.organizationId === input.organizationId && version.productLineId === input.productLineId
          )
          .toSorted((left, right) => right.version - left.version)[0]?.version ?? 0;
      const newVersion = createProductLinePromptVersion({
        organizationId: input.organizationId,
        productLineId: input.productLineId,
        version: latestVersion + 1,
        aiWritingConfig: historicVersion.aiWritingConfig,
        editorId: input.editorId,
        editorName: input.editorName,
        changeSummary: input.changeSummary ?? `恢复版本 ${historicVersion.version}`
      });
      productLinePromptVersions.push(newVersion);

      return {
        productLine,
        restoredVersion: historicVersion,
        currentVersion: newVersion
      };
    },
    async listPersonaProfiles(args) {
      this.lastPersonaProfileListArgs = args;
      const records = personaProfiles.filter(profile => {
        if (profile.organizationId !== args.organizationId) return false;
        if (args.status && profile.status !== args.status) return false;
        if (!args.keyword) return true;
        const keyword = args.keyword.toLowerCase();
        return [
          profile.name,
          profile.description,
          profile.titleKeywordsText,
          profile.customerTypeKeywordsText,
          profile.painPoints,
          profile.focusText,
          profile.avoidText
        ].some(value => value?.toLowerCase().includes(keyword));
      });

      return {
        records: records.slice(args.skip, args.skip + args.take),
        total: records.length
      };
    },
    async listActivePersonaProfiles(organizationId) {
      return personaProfiles.filter(
        profile => profile.organizationId === organizationId && profile.status === 'active'
      );
    },
    async findPersonaProfileByName(organizationId, name) {
      return (
        personaProfiles.find(profile => profile.organizationId === organizationId && profile.name === name) ?? null
      );
    },
    async findPersonaProfileById(args) {
      this.lastPersonaProfileDetailArgs = args;
      return (
        personaProfiles.find(profile => profile.id === args.id && profile.organizationId === args.organizationId) ??
        null
      );
    },
    async createPersonaProfile(input) {
      const profile = createPersonaProfile({
        ...input,
        id: `persona-profile-${personaProfiles.length + 1}`
      });
      personaProfiles.push(profile);
      return profile;
    },
    async updatePersonaProfile(id, organizationId, input) {
      const profile = personaProfiles.find(item => item.id === id && item.organizationId === organizationId);
      if (!profile) return null;
      Object.assign(profile, input, { updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      if (input.isDefault) {
        for (const item of personaProfiles) {
          if (item.organizationId === organizationId && item.id !== id) {
            item.isDefault = false;
          }
        }
      }
      return profile;
    },
    async setDefaultPersonaProfile(id, organizationId) {
      const profile = personaProfiles.find(item => item.id === id && item.organizationId === organizationId);
      if (!profile || profile.status !== 'active') return null;

      for (const item of personaProfiles) {
        if (item.organizationId === organizationId) {
          item.isDefault = item.id === id;
        }
      }

      return profile;
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
        steps: input.steps.map((step, index) =>
          createEmailTemplateStep(step, `template-${emailTemplateGroups.length + 1}`, index + 1)
        ),
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
    async createFollowUpDraftBundle(input) {
      const enrollment = enrollments.find(
        item =>
          item.id === input.enrollmentId &&
          item.organizationId === input.organizationId &&
          item.ownerUserId === input.ownerUserId
      );

      if (!enrollment) return null;
      if (input.expectedEnrollmentStatus) {
        const statuses = Array.isArray(input.expectedEnrollmentStatus)
          ? input.expectedEnrollmentStatus
          : [input.expectedEnrollmentStatus];
        if (!statuses.includes(enrollment.status)) return null;
      }
      if (
        messages.some(
          message =>
            message.enrollmentId === enrollment.id &&
            (message.stepIndex === input.message.stepIndex ||
              Boolean(input.blockingMessageStatuses?.includes(message.status)))
        )
      ) {
        return null;
      }

      const message = createMessage({
        ...input.message,
        id: `message-${messages.length + 1}`,
        enrollmentId: enrollment.id
      });
      const metadata = input.timelineEvent.metadata as Record<string, unknown>;
      const event = createTimelineEvent({
        ...input.timelineEvent,
        metadata: {
          ...metadata,
          messageId: message.id
        }
      });
      messages.push(message);
      timelineEvents.push(event);

      return { enrollment, message, event };
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
    async listStrategyStats(args) {
      this.lastStrategyStatsArgs = args;
      const rows: Awaited<ReturnType<CrmStore['listStrategyStats']>>['rows'] = {
        template: [],
        policy: [],
        persona: [],
        productLine: []
      };
      const scopedEnrollments = enrollments.filter(enrollment => {
        if (enrollment.organizationId !== args.organizationId) return false;
        if (args.ownerUserId && enrollment.ownerUserId !== args.ownerUserId) return false;
        return true;
      });

      for (const enrollment of scopedEnrollments) {
        const relatedMessages = messages.filter(message => message.enrollmentId === enrollment.id);
        const statRows = [
          getOrCreateTestStrategyStatRow(rows.template, 'template', 'default_template', '默认模板'),
          getOrCreateTestStrategyStatRow(rows.policy, 'policy', enrollment.policyId ?? 'none', '未设置策略'),
          getOrCreateTestStrategyStatRow(rows.persona, 'persona', 'unknown', '未匹配画像'),
          getOrCreateTestStrategyStatRow(
            rows.productLine,
            'productLine',
            enrollment.productLineId ?? 'none',
            '未设置产品线'
          )
        ];

        for (const row of statRows) {
          row.sequenceCount += 1;
          if (enrollment.status === 'replied') row.repliedCount += 1;
          if (enrollment.status === 'stopped') row.stoppedCount += 1;

          for (const message of relatedMessages) {
            if (message.status === 'draft_pending_review') row.draftPendingCount += 1;
            if (message.status === 'draft_ready') row.readyCount += 1;
            if (message.status === 'queued') row.queuedCount += 1;
            if (message.status === 'sent') row.sentCount += 1;
            if (message.status === 'failed') row.failedCount += 1;
          }
        }
      }

      return {
        generatedAt: new Date('2026-06-20T08:00:00.000Z'),
        rows
      };
    },
    async getWorkbenchOverview(args) {
      this.lastWorkbenchOverviewArgs = args;

      return {
        generatedAt: args.now,
        today: {
          sentCount: 12,
          queuedCount: 4,
          failedCount: 1,
          pendingReplyCount: 3,
          totalReplyCount: 5,
          draftReviewCount: 8,
          firstDraftReviewCount: 5,
          followUpDraftReviewCount: 3,
          riskyDraftReviewCount: 2,
          issueCount: 2,
          sendFailedCount: 1,
          mailboxIssueCount: 1,
          missingContactCount: 6,
          emailVerificationPendingCount: 4,
          riskyEmailCount: 2,
          aiLeadTaskPendingCount: 1
        },
        yesterday: {
          sentCount: 10,
          totalReplyCount: 2
        },
        trend: [{ date: '2026-06-20', sentCount: 12, replyCount: 5 }],
        runningTasks: []
      };
    },
    async getSequenceReviewItem(args) {
      this.lastSequenceReviewDetailArgs = args;
      sequenceReviewDetailCalls.push(args);
      const enrollment = enrollments.find(item => {
        if (item.id !== args.id) return false;
        if (item.organizationId !== args.organizationId) return false;
        if (args.ownerUserId && item.ownerUserId !== args.ownerUserId) return false;
        return true;
      });
      return enrollment
        ? buildSequenceReviewRecords([enrollment], {
            accounts,
            contacts,
            productLines,
            mailboxes,
            sequencePolicies,
            messages
          })[0]
        : null;
    },
    async listSequenceReviewItemsByIds(args) {
      const scopedEnrollments = enrollments.filter(item => {
        if (!args.ids.includes(item.id)) return false;
        if (item.organizationId !== args.organizationId) return false;
        if (args.ownerUserId && item.ownerUserId !== args.ownerUserId) return false;
        return true;
      });

      return buildSequenceReviewRecords(scopedEnrollments, {
        accounts,
        contacts,
        productLines,
        mailboxes,
        sequencePolicies,
        messages
      });
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
    async createMessageDraftVersion(input) {
      const version = createDraftVersion(input, {
        id: `draft-version-${draftVersions.length + 1}`,
        versionNo: draftVersions.filter(item => item.messageId === input.messageId).length + 1
      });
      draftVersions.push(version);
      return version;
    },
    async listMessageDraftVersions(args) {
      return draftVersions
        .filter(version => {
          if (version.messageId !== args.messageId) return false;
          if (version.organizationId !== args.organizationId) return false;
          if (args.ownerUserId && version.ownerUserId !== args.ownerUserId) return false;
          return true;
        })
        .sort(
          (left, right) => right.versionNo - left.versionNo || right.createdAt.getTime() - left.createdAt.getTime()
        );
    },
    async restoreMessageDraftVersion(args) {
      const message = messages.find(item => {
        if (item.id !== args.messageId) return false;
        if (item.organizationId !== args.organizationId) return false;
        if (item.ownerUserId !== args.ownerUserId) return false;
        if (item.status !== 'draft_pending_review') return false;
        return true;
      });
      const version = draftVersions.find(item => {
        if (item.id !== args.versionId) return false;
        if (item.messageId !== args.messageId) return false;
        if (item.organizationId !== args.organizationId) return false;
        if (item.ownerUserId !== args.ownerUserId) return false;
        return true;
      });

      if (!message || !version) return null;

      Object.assign(message, {
        subject: version.subject,
        bodyText: version.bodyText,
        updatedAt: new Date('2026-06-18T10:00:00.000Z')
      });

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
        eventType: 'message_send_scheduled',
        title: '首封开发信等待发送调度',
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
          (!input.ownerUserId || item.ownerUserId === input.ownerUserId) &&
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
        item =>
          item.enrollmentId === enrollment.id &&
          item.organizationId === input.organizationId &&
          item.status === 'queued'
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
    async confirmInboxMessageUnsubscribe(input) {
      const inboxMessage = inboxMessages.find(
        message =>
          message.id === input.messageId &&
          message.organizationId === input.organizationId &&
          message.ownerUserId === input.ownerUserId &&
          ['unsubscribe_hint', 'unsubscribe_review_pending'].includes(message.messageType)
      );
      const thread = inboxMessage ? inboxThreads.find(item => item.id === inboxMessage.threadId) : null;
      const account = inboxMessage ? accounts.find(item => item.id === inboxMessage.accountId) : null;
      const contact = inboxMessage ? contacts.find(item => item.id === inboxMessage.contactId) : null;
      const mailbox = inboxMessage?.mailboxId ? mailboxes.find(item => item.id === inboxMessage.mailboxId) : null;
      const enrollment = inboxMessage?.enrollmentId
        ? enrollments.find(item => item.id === inboxMessage.enrollmentId)
        : null;

      if (!inboxMessage || !thread || !account || !contact) return null;

      Object.assign(inboxMessage, { messageType: 'unsubscribe_hint' });
      await this.upsertBlacklistEntry({
        organizationId: input.organizationId,
        emailHash: contact.emailHash,
        maskedEmail: contact.maskedEmail,
        reason: 'unsubscribe',
        sourceAccountId: account.id,
        sourceContactId: contact.id,
        sourceMessageId: inboxMessage.id,
        createdById: input.confirmedById,
        createdByName: input.confirmedByName ?? null
      });
      Object.assign(account, { status: 'blocked', updatedAt: new Date('2026-06-18T10:00:00.000Z') });
      Object.assign(contact, { emailStatus: 'unsubscribed', updatedAt: new Date('2026-06-18T10:00:00.000Z') });

      for (const activeEnrollment of enrollments) {
        if (
          activeEnrollment.organizationId === input.organizationId &&
          activeEnrollment.ownerUserId === input.ownerUserId &&
          activeEnrollment.accountId === account.id &&
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
          queuedMessage.accountId === account.id &&
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
        accountId: account.id,
        contactId: contact.id,
        ownerUserId: input.ownerUserId,
        eventType: 'customer_unsubscribed',
        title: '确认客户退订',
        content: inboxMessage.subject,
        metadata: {
          inboxThreadId: thread.id,
          inboxMessageId: inboxMessage.id,
          confirmedAt: input.confirmedAt.toISOString()
        }
      });
      timelineEvents.push(event);

      return {
        thread,
        message: inboxMessage,
        account,
        contact,
        mailbox: mailbox ?? null,
        enrollment: enrollment ?? null,
        event
      };
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

      return {
        thread,
        message: inboxMessage,
        account,
        contact,
        mailbox: mailbox ?? null,
        enrollment: enrollment ?? null,
        event,
        isDuplicate: false
      };
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
          return [
            thread.subject,
            account?.name,
            account?.domain,
            contact?.fullName,
            contact?.title,
            contact?.maskedEmail
          ].some(value => value?.toLowerCase().includes(keyword));
        })
        .toSorted((left, right) => right.lastInboundAt.getTime() - left.lastInboundAt.getTime());

      return {
        records: records
          .slice(args.skip, args.skip + args.take)
          .map(thread =>
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
    async saveInboxThreadReplyDraft(input) {
      const thread = inboxThreads.find(item => {
        if (item.id !== input.id) return false;
        if (item.organizationId !== input.organizationId) return false;
        if (item.ownerUserId !== input.ownerUserId) return false;
        return true;
      });

      if (!thread) return null;

      Object.assign(thread, {
        replyDraftBodyText: input.bodyText,
        replyDraftTopic: input.topic,
        replyDraftMetadata: input.metadata ?? null,
        replyDraftUpdatedAt: input.updatedAt,
        replyDraftUpdatedById: input.updatedById,
        replyDraftUpdatedByName: input.updatedByName ?? null,
        updatedAt: input.updatedAt
      });

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
    ownerConcurrentSendLimit: input.ownerConcurrentSendLimit ?? 5,
    ownerDailySendLimitMax: input.ownerDailySendLimitMax ?? 200,
    followUpDelayDays: input.followUpDelayDays ?? {
      step2Days: 3,
      step3Days: 7,
      step4Days: 14,
      step5Days: 21
    },
    updatedAt: input.updatedAt || new Date(0)
  };
}

function createAiDraftQueueConfig(input: Partial<TestAiDraftQueueConfig> = {}): TestAiDraftQueueConfig {
  return {
    configKey: input.configKey || 'crm-ai-draft',
    itemConcurrency: input.itemConcurrency ?? 3,
    maxItemConcurrency: input.maxItemConcurrency ?? 5,
    maxActiveTasksPerUser: input.maxActiveTasksPerUser ?? 1,
    maxActiveTasksPerOrg: input.maxActiveTasksPerOrg ?? 2,
    maxAttempts: input.maxAttempts ?? 3,
    retryBackoffSeconds: input.retryBackoffSeconds ?? null,
    updatedById: input.updatedById ?? null,
    updatedByName: input.updatedByName ?? null,
    updatedAt: input.updatedAt || new Date('2026-06-20T09:00:00.000Z')
  };
}

function createAiDraftTask(input: Partial<TestAiDraftTask> = {}): TestAiDraftTask {
  return {
    id: input.id || 'ai-draft-task-1',
    organizationId: input.organizationId || 'org-1',
    organizationRole: input.organizationRole ?? 'member',
    ownerUserId: input.ownerUserId || 'user-1',
    ownerUserName: input.ownerUserName ?? 'Alice',
    status: input.status || 'queued',
    runVersion: input.runVersion ?? 1,
    bullJobId: input.bullJobId ?? null,
    requestedCount: input.requestedCount ?? 1,
    successCount: input.successCount ?? 0,
    skippedCount: input.skippedCount ?? 0,
    failedCount: input.failedCount ?? 0,
    retryingCount: input.retryingCount ?? 0,
    runningCount: input.runningCount ?? 0,
    pendingCount: input.pendingCount ?? 1,
    effectiveConcurrency: input.effectiveConcurrency ?? 3,
    maxAttempts: input.maxAttempts ?? 3,
    failureReason: input.failureReason ?? null,
    progressState: input.progressState ?? null,
    resultSummary: input.resultSummary ?? null,
    readAt: input.readAt ?? null,
    notifiedAt: input.notifiedAt ?? null,
    startedAt: input.startedAt ?? null,
    finishedAt: input.finishedAt ?? null,
    createdAt: input.createdAt || new Date('2026-06-20T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-20T09:00:00.000Z')
  };
}

function createAiDraftTaskItem(input: Partial<TestAiDraftTaskItem> = {}): TestAiDraftTaskItem {
  return {
    id: input.id || 'ai-draft-task-item-1',
    taskId: input.taskId || 'ai-draft-task-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    enrollmentId: input.enrollmentId || 'enrollment-1',
    messageId: input.messageId ?? null,
    contactId: input.contactId ?? null,
    accountId: input.accountId ?? null,
    productLineId: input.productLineId ?? null,
    stepIndex: input.stepIndex ?? 1,
    status: input.status || 'pending',
    attemptCount: input.attemptCount ?? 0,
    maxAttempts: input.maxAttempts ?? 3,
    failureType: input.failureType ?? null,
    failureReason: input.failureReason ?? null,
    draftSubject: input.draftSubject ?? null,
    draftBodyText: input.draftBodyText ?? null,
    metadata: input.metadata ?? null,
    startedAt: input.startedAt ?? null,
    finishedAt: input.finishedAt ?? null,
    createdAt: input.createdAt || new Date('2026-06-20T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-20T09:00:00.000Z')
  };
}

function createSendPreference(input: Partial<TestSendPreference> = {}): TestSendPreference {
  return {
    id: input.id || 'send-preference-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    ownerUserName: input.ownerUserName ?? 'Alice',
    dailySendLimit: input.dailySendLimit ?? 50,
    followUpSharePercent: input.followUpSharePercent ?? 70,
    updatedById: input.updatedById ?? 'user-1',
    updatedByName: input.updatedByName ?? 'Alice',
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
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
    aiWritingConfig: input.aiWritingConfig ?? null,
    status: input.status || 'active',
    createdById: input.createdById || 'user-1',
    createdByName: input.createdByName ?? 'Alice',
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createProductLinePromptVersion(
  input: Partial<TestProductLinePromptVersion> & {
    organizationId?: string;
    productLineId?: string;
    aiWritingConfig?: CrmProductLineRecord['aiWritingConfig'];
  } = {}
): TestProductLinePromptVersion {
  return {
    id: input.id || 'product-line-prompt-version-1',
    organizationId: input.organizationId || 'org-1',
    productLineId: input.productLineId || 'product-line-1',
    version: input.version ?? 1,
    aiWritingConfig: Object.prototype.hasOwnProperty.call(input, 'aiWritingConfig')
      ? (input.aiWritingConfig ?? null)
      : createAiWritingConfig(),
    editorId: input.editorId ?? 'user-1',
    editorName: input.editorName ?? 'Alice',
    changeSummary: input.changeSummary ?? 'AI 写信配置更新',
    createdAt: input.createdAt || new Date('2026-06-18T10:00:00.000Z')
  };
}

function createPersonaProfile(input: Partial<TestPersonaProfile> = {}): TestPersonaProfile {
  return {
    id: input.id || 'persona-profile-1',
    organizationId: input.organizationId || 'org-1',
    name: input.name || 'Purchasing Manager',
    description: input.description ?? null,
    titleKeywordsText: input.titleKeywordsText ?? 'purchasing manager\nbuyer',
    customerTypeKeywordsText: input.customerTypeKeywordsText ?? 'distributor',
    painPoints: input.painPoints ?? 'price and delivery uncertainty',
    focusText: input.focusText ?? 'price, MOQ, lead time, and payment terms',
    avoidText: input.avoidText ?? null,
    status: input.status || 'active',
    isDefault: input.isDefault ?? false,
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
    metadata: input.metadata ?? null,
    createdAt: input.createdAt || new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-06-18T09:00:00.000Z')
  };
}

function createAiWritingConfig(): NonNullable<CrmProductLineRecord['aiWritingConfig']> {
  return {
    enabled: true,
    commonRequirements: 'Write concise B2B emails.',
    forbiddenClaims: 'Do not invent prices.',
    productEmphasis: 'Focus on supply reliability.',
    steps: [1, 2, 3, 4, 5].map(stepIndex => ({
      stepIndex: stepIndex as 1 | 2 | 3 | 4 | 5,
      prompt: `Prompt ${stepIndex}`
    }))
  };
}

function createAiDraftService(calls: CrmAiDraftPromptInput[]): CrmAiDraftService {
  return {
    async generateDraft(input: CrmAiDraftPromptInput) {
      calls.push(input);

      return {
        subject: `AI subject step ${input.stepIndex}`,
        bodyText: `AI body step ${input.stepIndex}`,
        reason: `Reason step ${input.stepIndex}`,
        riskNotes: ['需要人工确认'],
        metadata: {
          generated: true,
          reason: `Reason step ${input.stepIndex}`,
          riskNotes: ['需要人工确认'],
          snapshot: {
            productLineId: input.productLine.id,
            productLineName: input.productLine.name,
            stepIndex: input.stepIndex,
            writingConfig: input.writingConfig,
            reason: `Reason step ${input.stepIndex}`,
            riskNotes: ['需要人工确认'],
            generatedAt: '2026-06-18T09:00:00.000Z'
          }
        }
      };
    }
  } as CrmAiDraftService;
}

function createAiReplyDraftService(calls: CrmAiReplyDraftPromptInput[]) {
  return {
    async polishReplyDraft(input: CrmAiReplyDraftPromptInput) {
      calls.push(input);

      return {
        bodyText: `Polished reply for ${input.userTopicOrOutline}`,
        reason: '根据用户主题润色扩写',
        riskNotes: ['人工确认后再发送'],
        metadata: {
          generated: true,
          reason: '根据用户主题润色扩写',
          riskNotes: ['人工确认后再发送'],
          productLineId: input.productLine?.id ?? null,
          productLineName: input.productLine?.name ?? null,
          generatedAt: '2026-06-18T12:00:00.000Z'
        }
      };
    }
  };
}

function createThrowingSendGateway(): CrmEmailSendGateway {
  return {
    async sendPlainText() {
      throw new Error('sendPlainText should not be called');
    },
    async replyPlainText() {
      throw new Error('replyPlainText should not be called');
    }
  };
}

function getOrCreateTestStrategyStatRow(
  rows: TestStrategyStatRow[],
  dimension: TestStrategyStatRow['dimension'],
  key: string,
  name: string
): TestStrategyStatRow {
  const existing = rows.find(row => row.key === key);

  if (existing) return existing;

  const row: TestStrategyStatRow = {
    dimension,
    key,
    name,
    sequenceCount: 0,
    draftPendingCount: 0,
    readyCount: 0,
    queuedCount: 0,
    sentCount: 0,
    failedCount: 0,
    repliedCount: 0,
    stoppedCount: 0
  };
  rows.push(row);

  return row;
}

function createDraftVersion(
  message: {
    id?: string;
    messageId?: string;
    organizationId: string;
    ownerUserId: string;
    accountId: string;
    contactId: string;
    enrollmentId: string;
    mailboxId?: string | null;
    stepIndex: number;
    subject: string;
    bodyText: string;
    editorId?: string;
    editorName?: string | null;
  },
  input: Partial<TestDraftVersion> = {}
): TestDraftVersion {
  const messageId = input.messageId ?? message.messageId ?? message.id;

  if (!messageId) {
    throw new Error('Draft version test data requires a message id');
  }

  return {
    id: input.id || 'draft-version-1',
    organizationId: input.organizationId || message.organizationId,
    ownerUserId: input.ownerUserId || message.ownerUserId,
    accountId: input.accountId || message.accountId,
    contactId: input.contactId || message.contactId,
    enrollmentId: input.enrollmentId || message.enrollmentId,
    messageId,
    mailboxId: input.mailboxId ?? message.mailboxId ?? null,
    stepIndex: input.stepIndex ?? message.stepIndex,
    versionNo: input.versionNo ?? 1,
    subject: input.subject || message.subject,
    bodyText: input.bodyText || message.bodyText,
    editorId: input.editorId ?? message.editorId ?? 'user-1',
    editorName: input.editorName ?? message.editorName ?? 'Alice',
    createdAt: input.createdAt || new Date('2026-06-18T10:00:00.000Z')
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
    replyDraftBodyText: input.replyDraftBodyText ?? null,
    replyDraftTopic: input.replyDraftTopic ?? null,
    replyDraftMetadata: input.replyDraftMetadata ?? null,
    replyDraftUpdatedAt: input.replyDraftUpdatedAt ?? null,
    replyDraftUpdatedById: input.replyDraftUpdatedById ?? null,
    replyDraftUpdatedByName: input.replyDraftUpdatedByName ?? null,
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
      account:
        data.accounts.find(account => account.id === enrollment.accountId) ||
        createAccount({ id: enrollment.accountId }),
      contact:
        data.contacts.find(contact => contact.id === enrollment.contactId) ||
        createContact({ id: enrollment.contactId }),
      productLine: enrollment.productLineId
        ? data.productLines.find(productLine => productLine.id === enrollment.productLineId) || null
        : null,
      mailbox: enrollment.mailboxId
        ? data.mailboxes.find(mailbox => mailbox.id === enrollment.mailboxId) || null
        : null,
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
type TestAiDraftQueueConfig = CrmAiDraftQueueConfigRecord;
type TestAiDraftTask = CrmAiDraftTaskRecord;
type TestAiDraftTaskItem = CrmAiDraftTaskItemRecord;
type TestSendPreference = CrmSendPreferenceRecord;
type TestOrganizationConfig = CrmOrganizationConfigRecord;
type TestTimelineEvent = Awaited<ReturnType<CrmStore['createTimelineEvent']>>;
type TestMailbox = CrmMailboxRecord;
type TestEmailTemplateGroup = CrmEmailTemplateGroupRecord;
type TestPersonaProfile = CrmPersonaProfileRecord;
type TestProductLinePromptVersion = CrmProductLineAiPromptVersionRecord;
type TestSequencePolicy = CrmSequencePolicyRecord;
type TestEnrollment = Awaited<ReturnType<CrmStore['createSequenceEnrollment']>>;
type TestMessage = Awaited<ReturnType<CrmStore['createMessage']>>;
type TestStrategyStatRow = Awaited<ReturnType<CrmStore['listStrategyStats']>>['rows']['template'][number];
type TestDraftVersion = {
  id: string;
  organizationId: string;
  ownerUserId: string;
  accountId: string;
  contactId: string;
  enrollmentId: string;
  messageId: string;
  mailboxId: string | null;
  stepIndex: number;
  versionNo: number;
  subject: string;
  bodyText: string;
  editorId: string;
  editorName: string | null;
  createdAt: Date;
};
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
  aiWritingConfig: CrmProductLineRecord['aiWritingConfig'];
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

function createOAuthFlow(
  input: {
    mailbox?: Awaited<ReturnType<CrmGmailOAuthFlowPort['exchangeCodeForMailbox']>>;
  } = {}
) {
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
    },
    async hasJob(jobId) {
      const jobIndex = Number(jobId.replace(/^send-job-/, ''));

      return Number.isInteger(jobIndex) && jobIndex > 0 && jobIndex <= jobs.length;
    }
  };
}

function createAiDraftTaskQueue(
  error?: Error
): CrmAiDraftTaskQueuePort & {
  jobs: CrmAiDraftTaskQueueJob[];
  removedJobIds: string[];
  globalConcurrencies: number[];
} {
  const jobs: CrmAiDraftTaskQueueJob[] = [];
  const removedJobIds: string[] = [];
  const globalConcurrencies: number[] = [];

  return {
    jobs,
    removedJobIds,
    globalConcurrencies,
    async enqueueTask(input) {
      if (error) {
        throw error;
      }

      jobs.push(input);

      return { jobId: `${input.taskId}:${input.runVersion}` };
    },
    async removeTaskJob(jobId) {
      removedJobIds.push(jobId);
    },
    async applyGlobalConcurrency(concurrency) {
      globalConcurrencies.push(concurrency);
    }
  };
}

function createServiceWithSplitServices(options: {
  store?: CrmStore;
  suppressionService?: unknown;
  accountService?: unknown;
  mailboxService?: unknown;
  sequenceService?: unknown;
  draftService?: unknown;
  draftApprovalService?: unknown;
}) {
  return new CrmService(
    options.store ?? ({} as CrmStore),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    options.suppressionService as never,
    options.accountService as never,
    options.mailboxService as never,
    options.sequenceService as never,
    options.draftService as never,
    options.draftApprovalService as never
  );
}

function createDraftApprovalService(store: CrmStore, options: { crmLogger?: CrmLoggerService } = {}) {
  return new CrmDraftApprovalService(store, options.crmLogger);
}

function createDraftService(
  store: CrmStore,
  options: { aiDraftService?: CrmAiDraftService | null; crmLogger?: CrmLoggerService } = {}
) {
  return new CrmDraftService(store, options.aiDraftService, options.crmLogger);
}

function createSequenceService(
  store: CrmStore,
  options: { aiDraftService?: CrmAiDraftService | null; crmLogger?: CrmLoggerService } = {}
) {
  return new CrmSequenceService(
    store,
    store,
    store,
    store,
    store,
    options.aiDraftService,
    options.crmLogger
  );
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
