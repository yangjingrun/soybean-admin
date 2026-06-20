import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CrmGmailOAuthFlowPort } from '../crm-gmail-oauth-flow';
import type { CrmMailboxRecord, CrmUserContext } from '../crm.types';
import { toMailboxView } from '../shared/crm-view-mappers';
import { CrmMailboxService } from './crm-mailbox.service';
import type { CrmMailboxRepository } from './crm-mailbox.repository';

describe('CrmMailboxService', () => {
  it('lists member mailboxes with owner scope and hides mailbox secrets', async () => {
    const mailbox = createMailbox({ encryptedRefreshToken: 'secret-token' });
    const repository = createRepository({
      async listMailboxes(args) {
        assert.deepEqual(args, {
          organizationId: 'org-1',
          ownerUserId: 'user-1',
          keyword: 'sales',
          status: 'active',
          skip: 20,
          take: 20
        });

        return { records: [mailbox], total: 1 };
      }
    });
    const service = new CrmMailboxService(repository);
    const result = await service.listMailboxes(createContext(), {
      current: 2,
      size: 20,
      keyword: ' sales ',
      status: 'active'
    });

    assert.equal(result.total, 1);
    assert.equal(result.records[0].maskedEmail, 's***@gmail.com');
    assert.equal('encryptedRefreshToken' in result.records[0], false);
    assert.equal('emailHash' in result.records[0], false);
  });

  it('creates a mock mailbox without OAuth token fields', async () => {
    const repository = createRepository({
      async findMailboxByProviderAndEmailHash() {
        return null;
      },
      async createMailbox(input) {
        assert.equal(input.emailAddress, 'sales@gmail.com');
        assert.equal('encryptedRefreshToken' in input, false);
        return createMailbox(input);
      }
    });
    const service = new CrmMailboxService(repository);
    const result = await service.mockAuthorizeMailbox({ emailAddress: ' Sales@Gmail.com ' }, createContext());

    assert.equal(result.mailbox.emailAddress, 'sales@gmail.com');
    assert.equal('encryptedRefreshToken' in result.mailbox, false);
    assert.equal('emailHash' in result.mailbox, false);
  });

  it('rejects mock authorization when the Gmail address belongs to another owner without writing success logs', async () => {
    const records: unknown[] = [];
    const repository = createRepository({
      async findMailboxByProviderAndEmailHash() {
        return createMailbox({ ownerUserId: 'other-user' });
      }
    });
    const service = new CrmMailboxService(repository, null, null, createLogger(records));

    await assert.rejects(
      () => service.mockAuthorizeMailbox({ emailAddress: 'sales@gmail.com' }, createContext()),
      /该 Gmail 地址已绑定/
    );
    assert.equal(records.length, 0);
  });

  it('updates an owned Gmail OAuth mailbox and renews watch after authorization', async () => {
    const existingMailbox = createMailbox({ status: 'paused' });
    const updatedMailbox = createMailbox({ status: 'active', lastHistoryId: 'history-2' });
    const repository = createRepository({
      async findMailboxByProviderAndEmailHash() {
        return existingMailbox;
      },
      async updateMailbox(id, input) {
        assert.equal(id, existingMailbox.id);
        assert.equal(input.status, 'active');
        assert.equal(input.encryptedRefreshToken, 'encrypted-refresh-token');
        assert.equal(input.lastHistoryId, 'history-2');
        return updatedMailbox;
      }
    });
    const flow: CrmGmailOAuthFlowPort = {
      createAuthorizationUrl() {
        throw new Error('not used');
      },
      verifyState(state, context) {
        assert.equal(state, 'state-1');
        assert.deepEqual(context, { organizationId: 'org-1', userId: 'user-1' });
        return {
          organizationId: context.organizationId,
          userId: context.userId,
          issuedAt: '2026-06-20T00:00:00.000Z',
          nonce: 'nonce-1'
        };
      },
      async exchangeCodeForMailbox(code) {
        assert.equal(code, 'code-1');
        return {
          emailAddress: 'sales@gmail.com',
          encryptedRefreshToken: 'encrypted-refresh-token',
          historyId: 'history-2'
        };
      }
    };
    const watch = {
      async renewMailboxWatch(id: string, context: CrmUserContext) {
        assert.equal(id, updatedMailbox.id);
        assert.equal(context.userId, 'user-1');
        return {
          mailbox: toMailboxView(updatedMailbox),
          watch: {
            historyId: 'history-2',
            watchExpiration: '2026-06-21T00:00:00.000Z'
          }
        };
      }
    };
    const service = new CrmMailboxService(repository, flow, watch);

    const result = await service.completeGmailOAuthAuthorization({ code: 'code-1', state: 'state-1' }, createContext());

    assert.equal(result.mailbox.id, updatedMailbox.id);
    assert.equal('watch' in result, true);
    if (!('watch' in result)) return;
    assert.equal(result.watch.historyId, 'history-2');
  });

  it('creates Gmail OAuth URLs bound to the current organization and user', () => {
    const flow: CrmGmailOAuthFlowPort = {
      createAuthorizationUrl(context) {
        assert.deepEqual(context, { organizationId: 'org-1', userId: 'user-1' });
        return { authorizationUrl: 'https://accounts.example/auth', state: 'state-1' };
      },
      verifyState() {
        throw new Error('not used');
      },
      exchangeCodeForMailbox() {
        throw new Error('not used');
      }
    };
    const service = new CrmMailboxService(createRepository(), flow);

    assert.deepEqual(service.createGmailOAuthAuthorizationUrl(createContext()), {
      authorizationUrl: 'https://accounts.example/auth',
      state: 'state-1'
    });
  });

  it('rejects a newly created OAuth mailbox when concurrent unique handling returns another owner', async () => {
    const repository = createRepository({
      async findMailboxByProviderAndEmailHash() {
        return null;
      },
      async createMailbox(input) {
        return createMailbox({ ...input, ownerUserId: 'other-user' });
      }
    });
    const service = new CrmMailboxService(repository, createOAuthFlow());

    await assert.rejects(
      () => service.completeGmailOAuthAuthorization({ code: 'code-1', state: 'state-1' }, createContext()),
      /该 Gmail 地址已绑定/
    );
  });

  it('rejects pausing a mailbox outside the current member owner scope', async () => {
    const repository = createRepository({
      async findMailboxById(args) {
        assert.deepEqual(args, {
          id: 'mailbox-1',
          organizationId: 'org-1',
          ownerUserId: 'user-1'
        });
        return null;
      }
    });
    const service = new CrmMailboxService(repository);

    await assert.rejects(() => service.pauseMailbox('mailbox-1', createContext()), /邮箱不存在/);
  });
});

function createContext(overrides: Partial<CrmUserContext> = {}): CrmUserContext {
  return {
    userId: 'user-1',
    userName: 'Member',
    roles: ['R_USER'],
    organizationId: 'org-1',
    organizationRole: 'member',
    ...overrides
  };
}

function createMailbox(overrides: Partial<CrmMailboxRecord> = {}): CrmMailboxRecord {
  const now = new Date('2026-06-20T00:00:00.000Z');

  return {
    id: 'mailbox-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    ownerUserName: 'Member',
    provider: 'gmail',
    emailAddress: 'sales@gmail.com',
    emailHash: 'email-hash',
    maskedEmail: 's***@gmail.com',
    status: 'active',
    dailyLimit: 50,
    hourlyLimit: 10,
    warmupStage: 'new',
    encryptedRefreshToken: null,
    watchExpiration: null,
    lastHistoryId: null,
    syncIssueType: null,
    syncIssueAt: null,
    syncIssueMessage: null,
    authorizedAt: now,
    pausedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createRepository(overrides: Partial<CrmMailboxRepository> = {}): CrmMailboxRepository {
  const notImplemented = () => {
    throw new Error('not implemented');
  };

  return {
    findMailboxByProviderAndEmailHash: notImplemented,
    createMailbox: notImplemented,
    listMailboxes: notImplemented,
    findMailboxById: notImplemented,
    updateMailbox: notImplemented,
    listMailboxesForWatchRenewal: notImplemented,
    markMailboxAuthorizationExpired: notImplemented,
    advanceMailboxHistoryId: notImplemented,
    ...overrides
  };
}

function createOAuthFlow(): CrmGmailOAuthFlowPort {
  return {
    createAuthorizationUrl() {
      throw new Error('not used');
    },
    verifyState(state, context) {
      assert.equal(state, 'state-1');
      return {
        organizationId: context.organizationId,
        userId: context.userId,
        issuedAt: '2026-06-20T00:00:00.000Z',
        nonce: 'nonce-1'
      };
    },
    async exchangeCodeForMailbox(code) {
      assert.equal(code, 'code-1');
      return {
        emailAddress: 'sales@gmail.com',
        encryptedRefreshToken: 'encrypted-refresh-token',
        historyId: 'history-2'
      };
    }
  };
}

function createLogger(records: unknown[]) {
  return {
    async record(...args: unknown[]) {
      records.push(args);
    }
  } as never;
}
