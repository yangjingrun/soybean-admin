import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CrmGmailWatchService } from './crm-gmail-watch.service';
import { CrmGmailAuthorizationExpiredError, type CrmGmailWatchGateway } from './crm-gmail-watch.gateway';
import type { CrmGmailWatchRepository } from './crm-gmail-watch.repository';
import type { CrmGmailHistorySyncQueueJob, CrmMailboxRecord, CrmUserContext } from './crm.types';

describe('CrmGmailWatchService', () => {
  it('renews an active mailbox watch without advancing an existing checkpoint', async () => {
    const mailbox = createMailbox({ lastHistoryId: '100' });
    const store = createStore([mailbox]);
    const logs = createLogRecorder();
    const gatewayCalls: Parameters<CrmGmailWatchGateway['renewWatch']>[0][] = [];
    const service = new CrmGmailWatchService(
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

    const result = await service.renewMailboxWatch('mailbox-1', createContext());

    assert.equal(result.mailbox.watchExpiration, '2026-06-26T08:00:00.000Z');
    assert.equal(result.mailbox.lastHistoryId, '100');
    assert.deepEqual(result.watch, {
      historyId: '150',
      watchExpiration: '2026-06-26T08:00:00.000Z'
    });
    assert.equal(gatewayCalls[0].mailbox.id, 'mailbox-1');
    assert.deepEqual(store.lastMailboxDetailArgs, {
      id: 'mailbox-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    assert.deepEqual(store.mailboxUpdateCalls[0], {
      id: 'mailbox-1',
      input: {
        watchExpiration: new Date('2026-06-26T08:00:00.000Z')
      }
    });
    assert.deepEqual(logs.records[0].metadata, {
      organizationId: 'org-1',
      mailboxId: 'mailbox-1',
      provider: 'gmail',
      maskedEmail: 'a***@gmail.com',
      historyId: '150',
      watchExpiration: '2026-06-26T08:00:00.000Z'
    });
  });

  it('initializes checkpoint when renewing an active mailbox with no history id', async () => {
    const mailbox = createMailbox({ lastHistoryId: null });
    const store = createStore([mailbox]);
    const service = new CrmGmailWatchService(store, createGateway());

    const result = await service.renewMailboxWatch('mailbox-1', createContext());

    assert.equal(result.mailbox.lastHistoryId, '150');
    assert.deepEqual(store.mailboxUpdateCalls[0], {
      id: 'mailbox-1',
      input: {
        watchExpiration: new Date('2026-06-26T08:00:00.000Z'),
        lastHistoryId: '150'
      }
    });
  });

  it('rejects mailboxes outside the member scope before calling the gateway', async () => {
    const store = createStore([createMailbox({ id: 'peer-mailbox', ownerUserId: 'user-2' })]);
    let gatewayCalled = false;
    const service = new CrmGmailWatchService(store, {
      async renewWatch() {
        gatewayCalled = true;

        return {
          historyId: '150',
          watchExpiration: new Date('2026-06-26T08:00:00.000Z')
        };
      }
    });

    await assert.rejects(() => service.renewMailboxWatch('peer-mailbox', createContext()), NotFoundException);

    assert.equal(gatewayCalled, false);
  });

  it('allows organization admins to renew organization mailbox watches', async () => {
    const store = createStore([createMailbox({ id: 'peer-mailbox', ownerUserId: 'user-2' })]);
    const service = new CrmGmailWatchService(store, createGateway());

    await service.renewMailboxWatch('peer-mailbox', createContext({ organizationRole: 'admin' }));

    assert.deepEqual(store.lastMailboxDetailArgs, {
      id: 'peer-mailbox',
      organizationId: 'org-1'
    });
  });

  it('renews watch and enqueues an immediate sync without advancing the checkpoint early', async () => {
    const mailbox = createMailbox({ lastHistoryId: '100' });
    const store = createStore([mailbox]);
    const queued: CrmGmailHistorySyncQueueJob[] = [];
    const service = new CrmGmailWatchService(store, createGateway(), undefined, undefined, {
      async enqueueHistorySync(input) {
        queued.push(input);

        return { jobId: 'mailbox-1:150:manual' };
      }
    });

    const result = await service.syncMailboxNow('mailbox-1', createContext());

    assert.equal(result.sync.queued, true);
    assert.equal(result.sync.fromHistoryId, '100');
    assert.equal(result.sync.toHistoryId, '150');
    assert.equal(result.mailbox.lastHistoryId, '100');
    assert.deepEqual(store.mailboxUpdateCalls[0], {
      id: 'mailbox-1',
      input: {
        watchExpiration: new Date('2026-06-26T08:00:00.000Z')
      }
    });
    assert.deepEqual(queued, [
      {
        mailboxId: 'mailbox-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        emailAddress: 'alice@gmail.com',
        emailHash: 'email-hash-1',
        historyId: '150',
        pubsubMessageId: null,
        publishTime: null
      }
    ]);
  });

  it('initializes the manual sync checkpoint when a mailbox has no history id yet', async () => {
    const mailbox = createMailbox({ lastHistoryId: null });
    const store = createStore([mailbox]);
    let queueCalled = false;
    const service = new CrmGmailWatchService(store, createGateway(), undefined, undefined, {
      async enqueueHistorySync() {
        queueCalled = true;

        return { jobId: 'job-1' };
      }
    });

    const result = await service.syncMailboxNow('mailbox-1', createContext());

    assert.deepEqual(result.sync, {
      queued: false,
      reason: 'checkpoint_initialized',
      fromHistoryId: null,
      toHistoryId: '150'
    });
    assert.equal(result.mailbox.lastHistoryId, '150');
    assert.equal(queueCalled, false);
    assert.deepEqual(store.mailboxUpdateCalls[0], {
      id: 'mailbox-1',
      input: {
        watchExpiration: new Date('2026-06-26T08:00:00.000Z'),
        lastHistoryId: '150'
      }
    });
  });

  it('reinitializes the checkpoint and clears history expired issues on manual sync recovery', async () => {
    const mailbox = createMailbox({
      lastHistoryId: '100',
      syncIssueType: 'history_expired',
      syncIssueAt: new Date('2026-06-19T08:00:00.000Z'),
      syncIssueMessage: 'Gmail History checkpoint 已过期，需要人工处理'
    });
    const store = createStore([mailbox]);
    let queueCalled = false;
    const service = new CrmGmailWatchService(store, createGateway(), undefined, undefined, {
      async enqueueHistorySync() {
        queueCalled = true;

        return { jobId: 'job-1' };
      }
    });

    const result = await service.syncMailboxNow('mailbox-1', createContext());

    assert.deepEqual(result.sync, {
      queued: false,
      reason: 'checkpoint_reinitialized',
      fromHistoryId: '100',
      toHistoryId: '150'
    });
    assert.equal(result.mailbox.lastHistoryId, '150');
    assert.equal(result.mailbox.lastSyncIssue, null);
    assert.equal(queueCalled, false);
    assert.deepEqual(store.mailboxUpdateCalls[0], {
      id: 'mailbox-1',
      input: {
        watchExpiration: new Date('2026-06-26T08:00:00.000Z'),
        lastHistoryId: '150',
        syncIssueType: null,
        syncIssueAt: null,
        syncIssueMessage: null
      }
    });
  });

  it('rejects inactive mailboxes before calling the gateway', async () => {
    const store = createStore([createMailbox({ status: 'paused' })]);
    let gatewayCalled = false;
    const service = new CrmGmailWatchService(store, {
      async renewWatch() {
        gatewayCalled = true;

        return {
          historyId: '150',
          watchExpiration: new Date('2026-06-26T08:00:00.000Z')
        };
      }
    });

    await assert.rejects(() => service.renewMailboxWatch('mailbox-1', createContext()), BadRequestException);

    assert.equal(gatewayCalled, false);
    assert.equal(store.mailboxUpdateCalls.length, 0);
  });

  it('marks the owner mailbox auth expired and notifies the owner when Gmail rejects authorization', async () => {
    const store = createStore([createMailbox({ ownerUserId: 'user-2', ownerUserName: 'Bob' })]);
    const logs = createLogRecorder();
    const notifications = createNotificationRecorder();
    const service = new CrmGmailWatchService(
      store,
      {
        async renewWatch() {
          throw new CrmGmailAuthorizationExpiredError('invalid_grant');
        }
      },
      logs.service,
      notifications.service as never
    );

    await assert.rejects(
      () => service.renewMailboxWatch('mailbox-1', createContext({ organizationRole: 'admin' })),
      BadRequestException
    );

    assert.equal(store.mailboxes[0].status, 'auth_expired');
    assert.equal(store.mailboxes[0].watchExpiration, null);
    assert.deepEqual(store.mailboxUpdateCalls[0], {
      id: 'mailbox-1',
      input: {
        status: 'auth_expired',
        watchExpiration: null
      }
    });
    assert.deepEqual(notifications.records[0], {
      userId: 'user-2',
      userName: 'Bob',
      module: 'crm',
      type: 'crm_mailbox_auth_expired',
      title: 'Gmail 授权已失效',
      content: 'a***@gmail.com 授权已失效，请重新授权后再继续发送和同步。',
      targetType: 'crmMailbox',
      targetId: 'mailbox-1',
      routePath: '/crm/settings',
      metadata: {
        organizationId: 'org-1',
        mailboxId: 'mailbox-1',
        provider: 'gmail',
        maskedEmail: 'a***@gmail.com'
      }
    });
    assert.deepEqual(logs.records[0], {
      level: 'warn',
      status: 'failed',
      action: 'gmail-auth-expired',
      errorMessage: 'invalid_grant',
      metadata: {
        organizationId: 'org-1',
        mailboxId: 'mailbox-1',
        provider: 'gmail',
        maskedEmail: 'a***@gmail.com',
        toStatus: 'auth_expired'
      }
    });
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

function createStore(mailboxes: CrmMailboxRecord[]) {
  const mailboxUpdateCalls: Array<{ id: string; input: Parameters<CrmGmailWatchRepository['updateMailbox']>[1] }> =
    [];
  let lastMailboxDetailArgs: Parameters<CrmGmailWatchRepository['findMailboxById']>[0] | undefined;

  return {
    mailboxes,
    mailboxUpdateCalls,
    get lastMailboxDetailArgs() {
      return lastMailboxDetailArgs;
    },
    async findMailboxById(args) {
      lastMailboxDetailArgs = args;

      return (
        mailboxes.find(mailbox => {
          if (mailbox.id !== args.id) return false;
          if (mailbox.organizationId !== args.organizationId) return false;
          if (args.ownerUserId && mailbox.ownerUserId !== args.ownerUserId) return false;
          return true;
        }) ?? null
      );
    },
    async updateMailbox(id, input) {
      mailboxUpdateCalls.push({ id, input });
      const mailbox = mailboxes.find(item => item.id === id);
      if (!mailbox) return null;
      Object.assign(mailbox, input, { updatedAt: new Date('2026-06-19T08:30:00.000Z') });
      return mailbox;
    }
  } as Pick<CrmGmailWatchRepository, 'findMailboxById' | 'updateMailbox'> as CrmGmailWatchRepository & {
    mailboxes: CrmMailboxRecord[];
    mailboxUpdateCalls: Array<{ id: string; input: Parameters<CrmGmailWatchRepository['updateMailbox']>[1] }>;
    lastMailboxDetailArgs?: Parameters<CrmGmailWatchRepository['findMailboxById']>[0];
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
    encryptedRefreshToken: input.encryptedRefreshToken ?? null,
    watchExpiration: null,
    lastHistoryId: null,
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
