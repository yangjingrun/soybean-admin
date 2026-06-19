import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmGmailWatchRenewalService } from './crm-gmail-watch-renewal.service';
import { CrmGmailAuthorizationExpiredError, type CrmGmailWatchGateway } from './crm-gmail-watch.gateway';
import type { CrmMailboxRecord, CrmStore } from './crm.types';

describe('CrmGmailWatchRenewalService', () => {
  it('renews due active Gmail watches without advancing an existing history checkpoint', async () => {
    const mailbox = createMailbox({
      lastHistoryId: '100',
      watchExpiration: new Date('2026-06-19T12:00:00.000Z')
    });
    const store = createStore([mailbox]);
    const logs = createLogRecorder();
    const gatewayCalls: Parameters<CrmGmailWatchGateway['renewWatch']>[0][] = [];
    const service = new CrmGmailWatchRenewalService(
      store,
      {
        async renewWatch(input) {
          gatewayCalls.push(input);

          return {
            historyId: '150',
            watchExpiration: new Date('2026-06-26T08:00:00.000Z')
          };
        }
      },
      logs.service
    );

    const result = await service.renewDueMailboxWatches(new Date('2026-06-19T08:00:00.000Z'));

    assert.deepEqual(result, {
      checkedCount: 1,
      renewedCount: 1,
      authorizationExpiredCount: 0,
      failedCount: 0
    });
    assert.equal(gatewayCalls[0].mailbox.id, 'mailbox-1');
    assert.deepEqual(store.renewalListCalls[0], {
      provider: 'gmail',
      renewBefore: new Date('2026-06-20T08:00:00.000Z'),
      take: 50
    });
    assert.deepEqual(store.mailboxUpdateCalls[0], {
      id: 'mailbox-1',
      input: {
        watchExpiration: new Date('2026-06-26T08:00:00.000Z')
      }
    });
    assert.equal(store.mailboxes[0].lastHistoryId, '100');
    assert.equal(store.mailboxes[0].watchExpiration?.toISOString(), '2026-06-26T08:00:00.000Z');
    assert.equal(logs.records.some(record => record.action === 'gmail-watch-auto-renew'), true);
    assert.equal(logs.records.some(record => record.action === 'gmail-watch-auto-renew-summary'), true);
  });

  it('initializes the checkpoint only when a due mailbox has no last history id', async () => {
    const store = createStore([createMailbox({ lastHistoryId: null, watchExpiration: null })]);
    const service = new CrmGmailWatchRenewalService(store, createGateway());

    await service.renewDueMailboxWatches(new Date('2026-06-19T08:00:00.000Z'));

    assert.deepEqual(store.mailboxUpdateCalls[0], {
      id: 'mailbox-1',
      input: {
        watchExpiration: new Date('2026-06-26T08:00:00.000Z'),
        lastHistoryId: '150'
      }
    });
    assert.equal(store.mailboxes[0].lastHistoryId, '150');
  });

  it('marks authorization expired and notifies the owner without stopping the batch', async () => {
    const store = createStore([
      createMailbox({ id: 'mailbox-1', ownerUserId: 'user-1', ownerUserName: 'Alice' }),
      createMailbox({ id: 'mailbox-2', ownerUserId: 'user-2', ownerUserName: 'Bob', emailHash: 'email-hash-2' })
    ]);
    const notifications = createNotificationRecorder();
    const service = new CrmGmailWatchRenewalService(
      store,
      {
        async renewWatch(input) {
          if (input.mailbox.id === 'mailbox-1') {
            throw new CrmGmailAuthorizationExpiredError('invalid_grant');
          }

          return {
            historyId: '150',
            watchExpiration: new Date('2026-06-26T08:00:00.000Z')
          };
        }
      },
      undefined,
      notifications.service as never
    );

    const result = await service.renewDueMailboxWatches(new Date('2026-06-19T08:00:00.000Z'));

    assert.deepEqual(result, {
      checkedCount: 2,
      renewedCount: 1,
      authorizationExpiredCount: 1,
      failedCount: 0
    });
    assert.deepEqual(store.authorizationExpiredCalls[0], {
      mailboxId: 'mailbox-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      reason: 'invalid_grant'
    });
    assert.equal(store.mailboxes[0].status, 'auth_expired');
    assert.equal(store.mailboxes[1].watchExpiration?.toISOString(), '2026-06-26T08:00:00.000Z');
    assert.deepEqual(notifications.records[0], {
      userId: 'user-1',
      userName: 'Alice',
      module: 'crm',
      type: 'crm_mailbox_auth_expired',
      title: 'Gmail 授权已失效',
      content: 'a***@gmail.com 授权已失效，已暂停该邮箱待发送邮件，请重新授权后再继续发送和同步。',
      targetType: 'crmMailbox',
      targetId: 'mailbox-1',
      routePath: '/crm/settings',
      metadata: {
        organizationId: 'org-1',
        mailboxId: 'mailbox-1',
        provider: 'gmail',
        maskedEmail: 'a***@gmail.com',
        pausedEnrollmentCount: 2,
        resetMessageCount: 3
      }
    });
  });

  it('records non-auth renewal failures and continues renewing the remaining mailboxes', async () => {
    const store = createStore([
      createMailbox({ id: 'mailbox-1' }),
      createMailbox({ id: 'mailbox-2', emailHash: 'email-hash-2' })
    ]);
    const logs = createLogRecorder();
    const service = new CrmGmailWatchRenewalService(
      store,
      {
        async renewWatch(input) {
          if (input.mailbox.id === 'mailbox-1') {
            throw new Error('temporary gmail failure');
          }

          return {
            historyId: '150',
            watchExpiration: new Date('2026-06-26T08:00:00.000Z')
          };
        }
      },
      logs.service
    );

    const result = await service.renewDueMailboxWatches(new Date('2026-06-19T08:00:00.000Z'));

    assert.equal(result.failedCount, 1);
    assert.equal(result.renewedCount, 1);
    assert.equal(logs.records.some(record => record.action === 'gmail-watch-auto-renew-failed'), true);
    assert.equal(store.mailboxes[1].watchExpiration?.toISOString(), '2026-06-26T08:00:00.000Z');
  });
});

function createGateway(): CrmGmailWatchGateway {
  return {
    async renewWatch() {
      return {
        historyId: '150',
        watchExpiration: new Date('2026-06-26T08:00:00.000Z')
      };
    }
  };
}

function createStore(mailboxes: CrmMailboxRecord[]) {
  const renewalListCalls: Array<Parameters<CrmStore['listMailboxesForWatchRenewal']>[0]> = [];
  const mailboxUpdateCalls: Array<{ id: string; input: Parameters<CrmStore['updateMailbox']>[1] }> = [];
  const authorizationExpiredCalls: Array<{
    mailboxId: string;
    organizationId: string;
    ownerUserId: string;
    reason: string;
  }> = [];

  return {
    mailboxes,
    renewalListCalls,
    mailboxUpdateCalls,
    authorizationExpiredCalls,
    async listMailboxesForWatchRenewal(input) {
      renewalListCalls.push(input);

      return mailboxes.filter(mailbox => {
        if (mailbox.provider !== input.provider || mailbox.status !== 'active') return false;
        return !mailbox.watchExpiration || mailbox.watchExpiration <= input.renewBefore;
      });
    },
    async updateMailbox(id, input) {
      mailboxUpdateCalls.push({ id, input });
      const mailbox = mailboxes.find(item => item.id === id);
      if (!mailbox) return null;
      Object.assign(mailbox, input, { updatedAt: new Date('2026-06-19T08:30:00.000Z') });
      return mailbox;
    },
    async markMailboxAuthorizationExpired(input) {
      authorizationExpiredCalls.push({
        mailboxId: input.mailboxId,
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        reason: input.reason
      });
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
        updatedAt: new Date('2026-06-19T08:30:00.000Z')
      });

      return {
        mailbox,
        pausedEnrollmentCount: 2,
        resetMessageCount: 3
      };
    }
  } as Pick<CrmStore, 'listMailboxesForWatchRenewal' | 'updateMailbox' | 'markMailboxAuthorizationExpired'> as CrmStore & {
    mailboxes: CrmMailboxRecord[];
    renewalListCalls: Array<Parameters<CrmStore['listMailboxesForWatchRenewal']>[0]>;
    mailboxUpdateCalls: Array<{ id: string; input: Parameters<CrmStore['updateMailbox']>[1] }>;
    authorizationExpiredCalls: Array<{
      mailboxId: string;
      organizationId: string;
      ownerUserId: string;
      reason: string;
    }>;
  };
}

function createMailbox(input: Partial<CrmMailboxRecord> = {}): CrmMailboxRecord {
  return {
    id: 'mailbox-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    ownerUserName: 'Alice',
    provider: 'gmail',
    emailAddress: 'alice@gmail.com',
    emailHash: 'email-hash-1',
    maskedEmail: 'a***@gmail.com',
    status: 'active',
    dailyLimit: 50,
    hourlyLimit: 10,
    warmupStage: 'new',
    encryptedRefreshToken: 'encrypted-refresh-token',
    watchExpiration: new Date('2026-06-19T12:00:00.000Z'),
    lastHistoryId: '100',
    authorizedAt: new Date('2026-06-18T09:00:00.000Z'),
    pausedAt: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...input
  };
}

function createLogRecorder() {
  const records: Array<{
    level?: string;
    status?: string;
    action?: string;
    errorMessage?: string;
    metadata: unknown;
  }> = [];

  return {
    records,
    service: {
      async record(input: {
        level?: string;
        status?: string;
        action?: string;
        errorMessage?: string;
        metadata?: unknown;
      }) {
        records.push({
          level: input.level,
          status: input.status,
          action: input.action,
          errorMessage: input.errorMessage,
          metadata: input.metadata
        });
      }
    }
  };
}

function createNotificationRecorder() {
  const records: Array<{
    userId: string;
    userName?: string | null;
    module: string;
    type: string;
    title: string;
    content: string;
    targetType?: string | null;
    targetId?: string | null;
    routePath?: string | null;
    metadata?: unknown | null;
  }> = [];

  return {
    records,
    service: {
      async create(input: (typeof records)[number]) {
        records.push(input);
      }
    }
  };
}
