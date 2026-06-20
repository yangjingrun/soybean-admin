import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadAppConfig } from '../app-config/app-config.loader';
import type { SystemLogRecordInput } from '../system-log/system-log.types';
import { CrmArchiveSlimmingService } from './crm-archive-slimming.service';
import type { CrmAccountRecord, CrmStore } from './crm.types';

describe('CrmArchiveSlimmingService', () => {
  it('slims archived accounts after the recovery window', async () => {
    const store = createStore({
      dueAccounts: [
        createAccount({
          id: 'account-1',
          archivedAt: new Date('2026-05-01T00:00:00.000Z'),
          websiteUrl: 'https://buyer.example',
          country: 'AE',
          customerType: 'distributor',
          sourceTaskId: 'task-1'
        })
      ]
    });
    const logger = createLogRecorder();
    const service = new CrmArchiveSlimmingService(store as never, logger);

    const result = await service.slimDueArchivedAccounts(new Date('2026-06-19T00:00:00.000Z'));

    assert.deepEqual(result, {
      checkedCount: 1,
      failedCount: 0,
      slimmedCount: 1
    });
    assert.deepEqual(store.listCalls[0], {
      archivedBefore: new Date('2026-05-20T00:00:00.000Z'),
      take: 100
    });
    assert.deepEqual(store.slimCalls[0], {
      id: 'account-1',
      organizationId: 'org-1',
      archivedBefore: new Date('2026-05-20T00:00:00.000Z'),
      slimmedAt: new Date('2026-06-19T00:00:00.000Z')
    });
    assert.equal(store.accounts[0].websiteUrl, null);
    assert.equal(store.accounts[0].domain, 'buyer.example');
    assert.equal(store.accounts[0].country, 'AE');
    assert.equal(store.accounts[0].sourceTaskId, 'task-1');
    assert.equal(store.accounts[0].archiveSlimmedAt?.toISOString(), '2026-06-19T00:00:00.000Z');
    assert.equal(logger.records[0]?.action, 'archive-slimming-summary');
  });

  it('does not start the slimming timer in API-only runtime role', () => {
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    let intervalStarted = false;
    const store = createStore({ dueAccounts: [createAccount()] });
    const service = new CrmArchiveSlimmingService(
      store as never,
      undefined,
      { config: loadAppConfig({ SERVER_RUNTIME_ROLE: 'api' }) } as never
    );

    globalThis.setInterval = ((callback: () => void) => {
      intervalStarted = true;

      return {
        unref() {}
      };
    }) as typeof setInterval;
    globalThis.clearInterval = originalClearInterval;

    try {
      service.onModuleInit();

      assert.equal(intervalStarted, false);
      assert.equal(store.listCalls.length, 0);
    } finally {
      service.onModuleDestroy();
      globalThis.setInterval = originalSetInterval;
      globalThis.clearInterval = originalClearInterval;
    }
  });
});

function createStore(options: { dueAccounts?: CrmAccountRecord[] } = {}) {
  const accounts = [...(options.dueAccounts ?? [])];
  const listCalls: Array<Parameters<CrmStore['listAccountsForArchiveSlimming']>[0]> = [];
  const slimCalls: Array<Parameters<CrmStore['slimArchivedAccount']>[0]> = [];

  return {
    accounts,
    listCalls,
    slimCalls,
    async listAccountsForArchiveSlimming(input: Parameters<CrmStore['listAccountsForArchiveSlimming']>[0]) {
      listCalls.push(input);

      return accounts;
    },
    async slimArchivedAccount(input: Parameters<CrmStore['slimArchivedAccount']>[0]) {
      slimCalls.push(input);
      const account = accounts.find(item => item.id === input.id && item.organizationId === input.organizationId);

      if (!account) {
        return null;
      }

      Object.assign(account, {
        archiveSlimmedAt: input.slimmedAt,
        customerType: null,
        websiteUrl: null
      });

      return account;
    }
  };
}

function createLogRecorder() {
  const records: Array<{ action: string; metadata?: unknown }> = [];

  return {
    records,
    async record(input: SystemLogRecordInput) {
      records.push(input);
    }
  };
}

function createAccount(input: Partial<CrmAccountRecord> = {}): CrmAccountRecord {
  return {
    id: input.id || 'account-1',
    organizationId: input.organizationId || 'org-1',
    ownerUserId: input.ownerUserId || 'user-1',
    name: input.name || 'Buyer LLC',
    normalizedName: input.normalizedName || 'buyer llc',
    websiteUrl: input.websiteUrl ?? null,
    domain: input.domain ?? 'buyer.example',
    country: input.country ?? null,
    customerType: input.customerType ?? null,
    status: input.status || 'archived',
    sourceTaskId: input.sourceTaskId ?? null,
    archivedAt: input.archivedAt ?? new Date('2026-05-01T00:00:00.000Z'),
    archiveReason: input.archiveReason ?? 'Not a fit',
    archiveSlimmedAt: input.archiveSlimmedAt ?? null,
    createdAt: input.createdAt || new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: input.updatedAt || new Date('2026-05-01T00:00:00.000Z')
  };
}
