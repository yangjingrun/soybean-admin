import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { UserInfo } from '../auth/auth.types';
import { CrmAccountService } from './accounts/crm-account.service';
import { CrmAiDraftTaskService } from './ai-draft-task/crm-ai-draft-task.service';
import { CrmAccountController } from './controllers/crm-account.controller';
import { CrmInboxController } from './controllers/crm-inbox.controller';
import { CrmMailboxController } from './controllers/crm-mailbox.controller';
import { CrmSequenceController } from './controllers/crm-sequence.controller';
import { CrmSettingsController } from './controllers/crm-settings.controller';
import { CrmDashboardService } from './dashboard/crm-dashboard.service';
import { CrmInboxService } from './inbox/crm-inbox.service';
import { CrmMailboxService } from './mailbox/crm-mailbox.service';
import { CrmPersonaProfileService } from './persona-profiles/crm-persona-profile.service';
import { CrmProductLineService } from './product-lines/crm-product-line.service';
import { CrmBatchDraftApprovalService } from './sequence/crm-batch-draft-approval.service';
import { CrmBatchSequenceStopService } from './sequence/crm-batch-sequence-stop.service';
import { CrmDraftPreviewService } from './sequence/crm-draft-preview.service';
import { CrmDraftService } from './sequence/crm-draft.service';
import { CrmMessageDraftApprovalRouterService } from './sequence/crm-message-draft-approval-router.service';
import { CrmNextDraftService } from './sequence/crm-next-draft.service';
import { CrmSendQueueReconcileService } from './sequence/crm-send-queue-reconcile.service';
import { CrmSequenceControlService } from './sequence/crm-sequence-control.service';
import { CrmSequenceService } from './sequence/crm-sequence.service';
import { CrmSequencePolicyService } from './sequence-policies/crm-sequence-policy.service';
import { CrmSettingsService } from './settings/crm-settings.service';
import { CrmSuppressionService } from './suppression/crm-suppression.service';
import { CrmEmailTemplateGroupService } from './template-groups/crm-email-template-group.service';
import type { CrmUserContext, ImportCrmLeadInput } from './crm.types';

type CrmAccountView = Record<string, unknown>;
type CrmMailboxView = Record<string, unknown>;
type CrmTimelineEventView = Record<string, unknown>;
type CrmEmailVerificationView = Record<string, unknown>;
type CrmSequenceReviewItemView = Record<string, unknown>;
type CrmEnrollmentView = Record<string, unknown>;
type CrmMessageView = Record<string, unknown>;
type CrmSendStartView = Record<string, unknown>;
type CrmSequenceStopView = Record<string, unknown>;
type CrmSequenceBatchOperateView = Record<string, unknown>;
type CrmInboxThreadView = Record<string, unknown> & {
  id: string;
  subject: string;
  account?: unknown;
  contact?: unknown;
  mailbox?: unknown;
  enrollment?: unknown;
};
type CrmInboxThreadDetailView = Record<string, unknown> & {
  thread: CrmInboxThreadView;
  account?: unknown;
  contact?: unknown;
  mailbox?: unknown;
  enrollment?: unknown;
  messages: Array<Record<string, unknown>>;
  replyDraft: unknown;
};
type CrmGlobalConfigView = Record<string, unknown>;
type CrmOrganizationConfigView = Record<string, unknown>;
type CrmPersonaProfileView = Record<string, unknown>;
type CrmProductLineView = Record<string, unknown>;
type CrmAiDraftPreviewView = Record<string, unknown>;
type CrmAiDraftTaskCreateView = Record<string, unknown>;
type CrmAiDraftQueueConfigView = Record<string, unknown>;
type CrmWorkbenchOverviewView = Record<string, unknown>;

type LooseServiceMethods<T> = {
  [K in keyof T as T[K] extends (...args: infer _Args) => unknown ? K : never]?: T[K] extends (
    ...args: infer Args
  ) => unknown
    ? (...args: Args) => unknown
    : never;
};
type CrmAccountControllerServiceStub = LooseServiceMethods<CrmAccountService>;
type CrmMailboxControllerServiceStub = LooseServiceMethods<CrmMailboxService>;
type CrmSettingsControllerServiceStub = LooseServiceMethods<CrmSettingsService> &
  LooseServiceMethods<CrmAiDraftTaskService> &
  LooseServiceMethods<CrmSendQueueReconcileService> &
  LooseServiceMethods<CrmSuppressionService> &
  LooseServiceMethods<CrmProductLineService> &
  LooseServiceMethods<CrmPersonaProfileService> &
  LooseServiceMethods<CrmEmailTemplateGroupService> &
  LooseServiceMethods<CrmSequencePolicyService> &
  LooseServiceMethods<CrmDashboardService>;
type CrmSequenceControllerServiceStub = LooseServiceMethods<CrmSequenceService> &
  LooseServiceMethods<CrmNextDraftService> &
  LooseServiceMethods<CrmAiDraftTaskService> &
  LooseServiceMethods<CrmBatchDraftApprovalService> &
  LooseServiceMethods<CrmBatchSequenceStopService> &
  LooseServiceMethods<CrmDraftPreviewService> &
  LooseServiceMethods<CrmDraftService> &
  LooseServiceMethods<CrmMessageDraftApprovalRouterService> &
  LooseServiceMethods<CrmSequenceControlService>;
type CrmInboxControllerServiceStub = LooseServiceMethods<CrmInboxService>;
type CrmControllerServiceStub =
  | CrmAccountControllerServiceStub
  | CrmMailboxControllerServiceStub
  | CrmSettingsControllerServiceStub
  | CrmSequenceControllerServiceStub
  | CrmInboxControllerServiceStub;

describe('CRM split controllers', () => {
  it('lists accounts with the current organization context', async () => {
    const calls: Array<{ context: CrmUserContext; query: unknown }> = [];
    const controller = createAccountController({
      async listAccounts(context, query) {
        calls.push({ context, query });

        return {
          current: 1,
          size: 20,
          total: 0,
          records: []
        };
      }
    });

    const query = {
      current: 1,
      size: 20,
      keyword: 'abc',
      contactTitle: 'buyer',
      customerType: 'distributor',
      region: 'Riyadh',
      updatedFrom: '2026-06-01T00:00:00.000Z',
      updatedTo: '2026-06-24T23:59:59.999Z',
      status: 'ready' as const
    };
    const result = await controller.listAccounts(createContext(), query);

    assert.equal(result.code, '0000');
    assert.deepEqual(calls[0].context, {
      userId: 'user-1',
      userName: 'Alice',
      roles: ['R_USER'],
      organizationId: 'org-1',
      organizationRole: 'member'
    });
    assert.equal(calls[0].query, query);
  });

  it('uses the shared request context without reading the authorization header', async () => {
    const calls: Array<{ context: CrmUserContext; query: unknown }> = [];
    const controller = createAccountController({
      async listAccounts(context, query) {
        calls.push({ context, query });

        return {
          current: 1,
          size: 20,
          total: 0,
          records: []
        };
      }
    });

    const query = { current: 2, size: 10 };
    const result = await controller.listAccounts(createContext(), query);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].context.userId, 'user-1');
    assert.equal(calls[0].query, query);
  });

  it('gets the CRM workbench overview with the current user context', async () => {
    const calls: CrmUserContext[] = [];
    const controller = createSettingsController({
      async getWorkbenchOverview(context) {
        calls.push(context);

        return createWorkbenchOverviewView();
      }
    });

    const result = await controller.getWorkbenchOverview(createContext());

    assert.equal(result.code, '0000');
    assert.equal(result.data.today.pendingReplyCount, 3);
    assert.deepEqual(calls[0], {
      userId: 'user-1',
      userName: 'Alice',
      roles: ['R_USER'],
      organizationId: 'org-1',
      organizationRole: 'member'
    });
  });

  it('imports one lead account for the current user', async () => {
    const calls: Array<{ input: ImportCrmLeadInput; context: CrmUserContext }> = [];
    const controller = createAccountController({
      async importAccountFromLead(input, context) {
        calls.push({ input, context });

        return {
          account: {
            id: 'account-1',
            organizationId: context.organizationId,
            ownerUserId: context.userId,
            name: input.name,
            normalizedName: 'abc trading',
            websiteUrl: input.websiteUrl ?? null,
            domain: 'abc.example',
            country: input.country ?? null,
            customerType: input.customerType ?? null,
            status: 'missing_contact',
            sourceTaskId: input.sourceTaskId ?? null,
            archivedAt: null,
            archiveReason: null,
            archiveSlimmedAt: null,
            createdAt: new Date('2026-06-18T09:00:00.000Z'),
            updatedAt: new Date('2026-06-18T09:00:00.000Z')
          },
          contact: null
        };
      }
    });

    const result = await controller.importLead(createContext(), {
      name: 'ABC Trading',
      websiteUrl: 'https://abc.example',
      country: 'AE',
      customerType: 'distributor',
      sourceTaskId: 'task-1'
    });

    assert.equal(result.code, '0000');
    assert.equal(calls[0].input.name, 'ABC Trading');
    assert.equal(calls[0].input.sourceTaskId, null);
    assert.equal(calls[0].context.organizationId, 'org-1');
  });

  it('updates one account profile with the current user context', async () => {
    const calls: Array<{ id: string; dto: Record<string, unknown>; context: CrmUserContext }> = [];
    const controller = createAccountController({
      async updateAccount(id, dto, context) {
        calls.push({ id, dto: dto as Record<string, unknown>, context });

        return {
          account: createAccountView({ id, name: 'ABC Trading Updated', websiteUrl: 'https://abc.example' }),
          event: createTimelineEventView({ title: '更新账户信息' })
        };
      }
    });

    const dto = {
      name: 'ABC Trading Updated',
      normalizedName: 'abc trading updated',
      websiteUrl: 'https://abc.example',
      country: 'AE',
      customerType: 'distributor'
    };
    const result = await controller.updateAccount(createContext(), 'account-1', dto);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].id, 'account-1');
    assert.deepEqual(calls[0].dto, dto);
    assert.equal(calls[0].context.userId, 'user-1');
    assert.equal((result.data.account as { name: string }).name, 'ABC Trading Updated');
  });

  it('creates, updates and deletes contacts with the current user context', async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const controller = createAccountController({
      async createContact(accountId, dto, context) {
        calls.push({ method: 'create', args: [accountId, dto, context] });
        return { contact: createContactView({ accountId }) };
      },
      async updateContact(contactId, dto, context) {
        calls.push({ method: 'update', args: [contactId, dto, context] });
        return { contact: createContactView({ id: contactId, email: 'buyer@example.com' }) };
      },
      async deleteContact(contactId, context) {
        calls.push({ method: 'delete', args: [contactId, context] });
        return { contact: createContactView({ id: contactId }) };
      }
    });

    const createResult = await controller.createContact(createContext(), 'account-1', {
      fullName: 'Alice',
      title: 'Buyer',
      email: 'alice@example.com'
    });
    const updateResult = await controller.updateContact(createContext(), 'contact-1', {
      fullName: 'Alice Buyer',
      email: 'buyer@example.com'
    });
    const deleteResult = await controller.deleteContact(createContext(), 'contact-1');

    assert.equal(createResult.code, '0000');
    assert.equal(updateResult.code, '0000');
    assert.equal(deleteResult.code, '0000');
    assert.equal(calls[0].method, 'create');
    assert.equal(calls[1].method, 'update');
    assert.equal(calls[2].method, 'delete');
  });

  it('gets account detail with the current user context', async () => {
    const calls: Array<{ id: string; context: CrmUserContext }> = [];
    const controller = createAccountController({
      async getAccountDetail(id, context) {
        calls.push({ id, context });

        return {
          account: createAccountView({ id }),
          contacts: [],
          timelineEvents: []
        };
      }
    });

    const result = await controller.getAccountDetail(createContext(), 'account-1');

    assert.equal(result.code, '0000');
    assert.equal(calls[0].id, 'account-1');
    assert.equal(calls[0].context.userId, 'user-1');
  });

  it('lists blacklist entries with the current organization context', async () => {
    const calls: Array<{ context: CrmUserContext; query: unknown }> = [];
    const controller = createSettingsController({
      async listBlacklistEntries(context, query) {
        calls.push({ context, query });

        return {
          current: 1,
          size: 20,
          total: 1,
          records: [createBlacklistView()]
        };
      }
    });

    const result = await controller.listBlacklistEntries(createContext(), {
      keyword: 'alice'
    });

    assert.equal(result.code, '0000');
    assert.equal(result.data.records[0].maskedEmail, 'a***@example.com');
    assert.equal(calls[0].context.organizationId, 'org-1');
    assert.deepEqual(calls[0].query, { keyword: 'alice' });
  });

  it('removes blacklist entries with the current user context', async () => {
    const calls: Array<{ id: string; dto: unknown; context: CrmUserContext }> = [];
    const controller = createSettingsController({
      async removeBlacklistEntry(id, dto, context) {
        calls.push({ id, dto, context });

        return {
          blacklistEntry: createBlacklistView({ id })
        };
      }
    });

    const result = await controller.removeBlacklistEntry(createContext(), 'blacklist-1', {
      reason: '客户确认恢复联系'
    });

    assert.equal(result.code, '0000');
    assert.equal(result.data.blacklistEntry.id, 'blacklist-1');
    assert.equal(calls[0].id, 'blacklist-1');
    assert.equal(calls[0].context.userId, 'user-1');
    assert.deepEqual(calls[0].dto, { reason: '客户确认恢复联系' });
  });

  it('changes account status with the current user context', async () => {
    const calls: Array<{ id: string; dto: unknown; context: CrmUserContext }> = [];
    const controller = createAccountController({
      async updateAccountStatus(id, dto, context) {
        calls.push({ id, dto, context });

        return {
          account: createAccountView({ id, status: dto.status }),
          event: createTimelineEventView({
            accountId: id,
            eventType: 'status_changed'
          })
        };
      }
    });

    const dto = { status: 'ready' as const, remark: 'verified' };
    const result = await controller.updateAccountStatus(createContext(), 'account-1', dto);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].id, 'account-1');
    assert.equal(calls[0].dto, dto);
    assert.equal(calls[0].context.organizationId, 'org-1');
  });

  it('adds account notes with the current user context', async () => {
    const calls: Array<{ id: string; dto: unknown; context: CrmUserContext }> = [];
    const controller = createAccountController({
      async addAccountNote(id, dto, context) {
        calls.push({ id, dto, context });

        return {
          event: createTimelineEventView({
            id: 'event-1',
            accountId: id,
            content: dto.content
          })
        };
      }
    });

    const dto = { content: 'Call next week.' };
    const result = await controller.addAccountNote(createContext(), 'account-1', dto);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].id, 'account-1');
    assert.equal(calls[0].dto, dto);
    assert.equal(calls[0].context.userId, 'user-1');
  });

  it('archives accounts with the current user context', async () => {
    const calls: Array<{ id: string; dto: unknown; context: CrmUserContext }> = [];
    const controller = createAccountController({
      async archiveAccount(id, dto, context) {
        calls.push({ id, dto, context });

        return {
          account: createAccountView({ id, status: 'archived' }),
          event: createTimelineEventView({
            accountId: id,
            eventType: 'account_archived'
          })
        };
      }
    });

    const dto = { reason: 'Not a fit' };
    const result = await controller.archiveAccount(createContext(), 'account-1', dto);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].id, 'account-1');
    assert.equal(calls[0].dto, dto);
    assert.equal(calls[0].context.organizationId, 'org-1');
  });

  it('restores archived accounts with the current user context', async () => {
    const calls: Array<{ id: string; context: CrmUserContext }> = [];
    const controller = createAccountController({
      async restoreAccount(id, context) {
        calls.push({ id, context });

        return {
          account: createAccountView({ id, status: 'candidate' }),
          event: createTimelineEventView({
            accountId: id,
            eventType: 'account_restored'
          })
        };
      }
    });

    const result = await controller.restoreAccount(createContext(), 'account-1');

    assert.equal(result.code, '0000');
    assert.equal(result.data.event.eventType, 'account_restored');
    assert.equal(calls[0].id, 'account-1');
    assert.equal(calls[0].context.organizationId, 'org-1');
  });

  it('verifies contact email with the current user context', async () => {
    const calls: Array<{ id: string; context: CrmUserContext }> = [];
    const controller = createAccountController({
      async verifyContactEmail(id, context) {
        calls.push({ id, context });

        return createEmailVerificationView({ contactId: id });
      }
    });

    const result = await controller.verifyContactEmail(createContext(), 'contact-1');

    assert.equal(result.code, '0000');
    assert.equal(calls[0].id, 'contact-1');
    assert.equal(calls[0].context.userId, 'user-1');
    assert.equal(result.data.contact.id, 'contact-1');
    assert.equal(result.data.event.eventType, 'email_verified');
  });

  it('mock authorizes mailbox with the current user context', async () => {
    const calls: Array<{
      dto: { emailAddress: string };
      context: CrmUserContext;
    }> = [];
    const controller = createMailboxController({
      async mockAuthorizeMailbox(dto, context) {
        calls.push({ dto, context });

        return {
          mailbox: createMailboxView({
            emailAddress: dto.emailAddress.toLowerCase()
          })
        };
      }
    });

    const dto = { emailAddress: 'Alice@Gmail.COM' };
    const result = await withCrmMockEndpointsEnabled(() =>
      controller.mockAuthorizeMailbox(createContext({ roles: ['R_SUPER'] }), dto)
    );

    assert.equal(result.code, '0000');
    assert.equal(calls[0].dto, dto);
    assert.equal(calls[0].context.organizationId, 'org-1');
    assert.equal(result.data.mailbox.emailAddress, 'alice@gmail.com');
  });

  it('rejects CRM mock endpoints unless explicitly enabled', async () => {
    const mailboxController = createMailboxController();
    const inboxController = createInboxController();

    await assert.rejects(
      () =>
        mailboxController.mockAuthorizeMailbox(createContext(), {
          emailAddress: 'alice@gmail.com'
        }),
      ForbiddenException
    );
    await assert.rejects(
      () =>
        inboxController.mockCustomerReply(createContext(), 'message-1', {
          bodyText: 'Please send details.'
        }),
      ForbiddenException
    );
  });

  it('rejects CRM mock endpoints for ordinary users even when enabled', async () => {
    const controller = createMailboxController();

    await assert.rejects(
      () =>
        withCrmMockEndpointsEnabled(() =>
          controller.mockAuthorizeMailbox(createContext(), {
            emailAddress: 'alice@gmail.com'
          })
        ),
      ForbiddenException
    );
  });

  it('rejects CRM mock endpoints in production even when the switch is enabled', async () => {
    const controller = createMailboxController();

    await assert.rejects(
      () =>
        withNodeEnv('production', () =>
          withCrmMockEndpointsEnabled(() =>
            controller.mockAuthorizeMailbox(createContext({ roles: ['R_SUPER'] }), { emailAddress: 'alice@gmail.com' })
          )
        ),
      ForbiddenException
    );
  });

  it('rejects CRM mock endpoints in production when app config is injected', async () => {
    const controller = createMailboxController(
      {},
      undefined,
      createCrmAppConfigService({
        crmEnableMockEndpoints: true,
        isProduction: true
      })
    );

    await assert.rejects(
      () => controller.mockAuthorizeMailbox(createContext({ roles: ['R_SUPER'] }), { emailAddress: 'alice@gmail.com' }),
      ForbiddenException
    );
  });

  it('creates a Gmail OAuth URL with the current user context', async () => {
    const calls: CrmUserContext[] = [];
    const controller = createMailboxController({
      createGmailOAuthAuthorizationUrl(context) {
        calls.push(context);

        return {
          authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=state-1',
          state: 'state-1'
        };
      }
    });

    const result = await controller.createGmailOAuthUrl(createContext());

    assert.equal(result.code, '0000');
    assert.equal(calls[0].userId, 'user-1');
    assert.equal(calls[0].organizationId, 'org-1');
    assert.equal(result.data.state, 'state-1');
  });

  it('completes Gmail OAuth callback with the current user context', async () => {
    const calls: Array<{
      dto: { code: string; state: string };
      context: CrmUserContext;
    }> = [];
    const controller = createMailboxController({
      async completeGmailOAuthAuthorization(dto, context) {
        calls.push({ dto, context });

        return {
          mailbox: createMailboxView({ emailAddress: 'alice@gmail.com' })
        };
      }
    });

    const dto = { code: 'code-1', state: 'state-1' };
    const result = await controller.completeGmailOAuthCallback(createContext(), dto);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].dto, dto);
    assert.equal(calls[0].context.userId, 'user-1');
    assert.equal(result.data.mailbox.emailAddress, 'alice@gmail.com');
  });

  it('lists mailboxes with the current organization context', async () => {
    const calls: Array<{ context: CrmUserContext; query: unknown }> = [];
    const controller = createMailboxController({
      async listMailboxes(context, query) {
        calls.push({ context, query });

        return {
          current: 1,
          size: 20,
          total: 1,
          records: [createMailboxView()]
        };
      }
    });

    const query = {
      current: 1,
      size: 20,
      keyword: 'gmail',
      status: 'active' as const
    };
    const result = await controller.listMailboxes(createContext(), query);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].query, query);
    assert.equal(calls[0].context.userId, 'user-1');
    assert.equal(result.data.records[0].provider, 'gmail');
  });

  it('pauses and resumes mailboxes with the current user context', async () => {
    const calls: Array<{
      action: string;
      id: string;
      context: CrmUserContext;
    }> = [];
    const controller = createMailboxController({
      async pauseMailbox(id, context) {
        calls.push({ action: 'pause', id, context });

        return { mailbox: createMailboxView({ id, status: 'paused' }) };
      },
      async resumeMailbox(id, context) {
        calls.push({ action: 'resume', id, context });

        return { mailbox: createMailboxView({ id, status: 'active' }) };
      }
    });

    const paused = await controller.pauseMailbox(createContext(), 'mailbox-1');
    const resumed = await controller.resumeMailbox(createContext(), 'mailbox-1');

    assert.equal(paused.data.mailbox.status, 'paused');
    assert.equal(resumed.data.mailbox.status, 'active');
    assert.deepEqual(
      calls.map(call => ({
        action: call.action,
        id: call.id,
        userId: call.context.userId
      })),
      [
        { action: 'pause', id: 'mailbox-1', userId: 'user-1' },
        { action: 'resume', id: 'mailbox-1', userId: 'user-1' }
      ]
    );
  });

  it('revokes mailbox authorization with the current user context', async () => {
    const calls: Array<{ context: CrmUserContext; id: string }> = [];
    const controller = createMailboxController({
      async revokeMailboxAuthorization(id, context) {
        calls.push({ context, id });

        return { mailbox: createMailboxView({ id, status: 'revoked' }) };
      }
    });

    const result = await controller.revokeMailboxAuthorization(createContext(), 'mailbox-1');

    assert.equal(result.code, '0000');
    assert.equal(result.data.mailbox.status, 'revoked');
    assert.deepEqual(
      calls.map(call => ({ id: call.id, userId: call.context.userId })),
      [{ id: 'mailbox-1', userId: 'user-1' }]
    );
  });

  it('deletes mailbox records with the current user context', async () => {
    const calls: Array<{ context: CrmUserContext; id: string }> = [];
    const controller = createMailboxController({
      async deleteMailbox(id, context) {
        calls.push({ context, id });

        return { mailbox: createMailboxView({ id, status: 'revoked' }) };
      }
    });

    const result = await controller.deleteMailbox(createContext(), 'mailbox-1');

    assert.equal(result.code, '0000');
    assert.equal(result.data.mailbox.id, 'mailbox-1');
    assert.deepEqual(
      calls.map(call => ({ id: call.id, userId: call.context.userId })),
      [{ id: 'mailbox-1', userId: 'user-1' }]
    );
  });

  it('renews Gmail watch with the current user context', async () => {
    const calls: Array<{ id: string; context: CrmUserContext }> = [];
    const controller = createMailboxController({}, {
      async renewMailboxWatch(id: string, context: CrmUserContext) {
        calls.push({ id, context });

        return {
          mailbox: createMailboxView({
            id,
            watchExpiration: '2026-06-26T08:00:00.000Z',
            lastHistoryId: '150'
          }),
          watch: {
            historyId: '150',
            watchExpiration: '2026-06-26T08:00:00.000Z'
          }
        };
      }
    } as never);

    const result = await controller.renewMailboxWatch(createContext(), 'mailbox-1');

    assert.equal(result.code, '0000');
    assert.ok(result.data);
    assert.equal(result.data.watch.historyId, '150');
    assert.deepEqual(
      calls.map(call => ({ id: call.id, userId: call.context.userId })),
      [{ id: 'mailbox-1', userId: 'user-1' }]
    );
  });

  it('enqueues an immediate Gmail sync with the current user context', async () => {
    const calls: Array<{ id: string; context: CrmUserContext }> = [];
    const controller = createMailboxController({}, {
      async syncMailboxNow(id: string, context: CrmUserContext) {
        calls.push({ id, context });

        return {
          mailbox: createMailboxView({
            id,
            watchExpiration: '2026-06-26T08:00:00.000Z',
            lastHistoryId: '100'
          }),
          watch: {
            historyId: '150',
            watchExpiration: '2026-06-26T08:00:00.000Z'
          },
          sync: {
            queued: true,
            jobId: 'mailbox-1:150:manual',
            fromHistoryId: '100',
            toHistoryId: '150'
          }
        };
      }
    } as never);

    const result = await controller.syncMailboxNow(createContext(), 'mailbox-1');

    assert.equal(result.code, '0000');
    assert.equal(result.data.sync.queued, true);
    assert.deepEqual(
      calls.map(call => ({ id: call.id, userId: call.context.userId })),
      [{ id: 'mailbox-1', userId: 'user-1' }]
    );
  });

  it('lists product lines with the current organization context', async () => {
    const calls: Array<{ context: CrmUserContext; query: unknown }> = [];
    const controller = createSettingsController({
      async listProductLines(context, query) {
        calls.push({ context, query });

        return {
          current: 1,
          size: 20,
          total: 1,
          records: [createProductLineView()]
        };
      }
    });

    const query = {
      current: 1,
      size: 20,
      keyword: 'bearing',
      status: 'active' as const
    };
    const result = await controller.listProductLines(createContext(), query);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].context.organizationId, 'org-1');
    assert.equal(calls[0].query, query);
    assert.equal(result.data.records[0].name, 'Bearing Series');
  });

  it('creates, updates and archives product lines with the current organization context', async () => {
    const calls: Array<{
      action: string;
      id?: string;
      dto?: unknown;
      context: CrmUserContext;
    }> = [];
    const controller = createSettingsController({
      async createProductLine(dto, context) {
        calls.push({ action: 'create', dto, context });

        return { productLine: createProductLineView({ name: dto.name }) };
      },
      async updateProductLine(id, dto, context) {
        calls.push({ action: 'update', id, dto, context });

        return {
          productLine: createProductLineView({
            id,
            name: dto.name ?? 'Bearing Series'
          })
        };
      },
      async archiveProductLine(id, context) {
        calls.push({ action: 'archive', id, context });

        return {
          productLine: createProductLineView({ id, status: 'archived' })
        };
      }
    });

    const createDto = { name: 'Bearing Series' };
    const updateDto = {
      name: 'Premium Bearing Series',
      status: 'active' as const
    };
    const created = await controller.createProductLine(createContext(), createDto);
    const updated = await controller.updateProductLine(createContext(), 'line-1', updateDto);
    const archived = await controller.archiveProductLine(createContext(), 'line-1');

    assert.equal(created.data.productLine.name, 'Bearing Series');
    assert.equal(updated.data.productLine.name, 'Premium Bearing Series');
    assert.equal(archived.data.productLine.status, 'archived');
    assert.deepEqual(
      calls.map(call => ({
        action: call.action,
        id: call.id,
        organizationId: call.context.organizationId
      })),
      [
        { action: 'create', id: undefined, organizationId: 'org-1' },
        { action: 'update', id: 'line-1', organizationId: 'org-1' },
        { action: 'archive', id: 'line-1', organizationId: 'org-1' }
      ]
    );
  });

  it('lists and restores product line AI prompt versions with the current organization context', async () => {
    const calls: Array<{
      action: string;
      id: string;
      versionId?: string;
      context: CrmUserContext;
    }> = [];
    const controller = createSettingsController({
      async listProductLineAiPromptVersions(id, context) {
        calls.push({ action: 'list', id, context });

        return {
          records: [
            {
              id: 'prompt-version-1',
              organizationId: context.organizationId,
              productLineId: id,
              version: 1,
              aiWritingConfig: createAiWritingConfigView(),
              editorId: 'user-1',
              editorName: 'Alice',
              changeSummary: '初始 AI 写信配置',
              createdAt: '2026-06-18T10:00:00.000Z'
            }
          ]
        };
      },
      async restoreProductLineAiPromptVersion(id, versionId, context) {
        calls.push({ action: 'restore', id, versionId, context });

        return {
          productLine: createProductLineView({
            id,
            aiWritingConfig: createAiWritingConfigView()
          }),
          version: {
            id: 'prompt-version-2',
            organizationId: context.organizationId,
            productLineId: id,
            version: 2,
            aiWritingConfig: createAiWritingConfigView(),
            editorId: context.userId,
            editorName: context.userName,
            changeSummary: '恢复版本 1',
            createdAt: '2026-06-18T10:00:00.000Z'
          }
        };
      }
    });

    const versions = await controller.listProductLineAiPromptVersions(createContext(), 'line-1');
    const restored = await controller.restoreProductLineAiPromptVersion(createContext(), 'line-1', 'prompt-version-1');

    assert.equal(versions.data.records[0].version, 1);
    assert.equal(restored.data.version.version, 2);
    assert.deepEqual(
      calls.map(call => [call.action, call.id, call.versionId, call.context.userId]),
      [
        ['list', 'line-1', undefined, 'user-1'],
        ['restore', 'line-1', 'prompt-version-1', 'user-1']
      ]
    );
  });

  it('manages persona profiles with the current organization context', async () => {
    const calls: Array<{
      action: string;
      id?: string;
      dto?: unknown;
      context: CrmUserContext;
    }> = [];
    const controller = createSettingsController({
      async listPersonaProfiles(context, query) {
        calls.push({ action: 'list', dto: query, context });

        return {
          current: 1,
          size: 20,
          total: 1,
          records: [createPersonaProfileView()]
        };
      },
      async createPersonaProfile(dto, context) {
        calls.push({ action: 'create', dto, context });

        return {
          personaProfile: createPersonaProfileView({ name: dto.name })
        };
      },
      async updatePersonaProfile(id, dto, context) {
        calls.push({ action: 'update', id, dto, context });

        return {
          personaProfile: createPersonaProfileView({
            id,
            name: dto.name ?? 'Purchasing Manager'
          })
        };
      },
      async archivePersonaProfile(id, context) {
        calls.push({ action: 'archive', id, context });

        return {
          personaProfile: createPersonaProfileView({
            id,
            status: 'archived'
          })
        };
      },
      async setDefaultPersonaProfile(id, context) {
        calls.push({ action: 'default', id, context });

        return {
          personaProfile: createPersonaProfileView({ id, isDefault: true })
        };
      }
    });

    const payload = {
      name: 'Procurement lead',
      description: 'Default buyer profile',
      titleKeywordsText: 'procurement',
      customerTypeKeywordsText: 'distributor',
      painPoints: 'price pressure',
      focusText: 'MOQ and lead time',
      avoidText: 'do not overpromise'
    };
    const listed = await controller.listPersonaProfiles(createContext(), {
      current: 1,
      size: 20,
      keyword: 'buyer'
    });
    const created = await controller.createPersonaProfile(createContext(), payload);
    const updated = await controller.updatePersonaProfile(createContext(), 'persona-1', { name: 'Buyer lead' });
    const archived = await controller.archivePersonaProfile(createContext(), 'persona-1');
    const defaulted = await controller.setDefaultPersonaProfile(createContext(), 'persona-1');

    assert.equal(listed.data.records.length, 1);
    assert.equal(created.data.personaProfile.name, 'Procurement lead');
    assert.equal(updated.data.personaProfile.name, 'Buyer lead');
    assert.equal(archived.data.personaProfile.status, 'archived');
    assert.equal(defaulted.data.personaProfile.isDefault, true);
    assert.deepEqual(
      calls.map(call => ({
        action: call.action,
        id: call.id,
        organizationId: call.context.organizationId
      })),
      [
        { action: 'list', id: undefined, organizationId: 'org-1' },
        { action: 'create', id: undefined, organizationId: 'org-1' },
        { action: 'update', id: 'persona-1', organizationId: 'org-1' },
        { action: 'archive', id: 'persona-1', organizationId: 'org-1' },
        { action: 'default', id: 'persona-1', organizationId: 'org-1' }
      ]
    );
  });

  it('gets read-only template defaults with the current organization context', async () => {
    const calls: CrmUserContext[] = [];
    const controller = createSettingsController({
      async getTemplateDefaults(context) {
        calls.push(context);

        return createTemplateDefaultsView();
      }
    });

    const result = await controller.getTemplateDefaults(createContext());

    assert.equal(result.code, '0000');
    assert.equal(calls[0].organizationId, 'org-1');
    assert.equal(result.data.templateGroup.steps.length, 5);
    assert.equal(result.data.personas[0].label, 'Purchasing Manager');
  });

  it('manages email template groups with the current organization context', async () => {
    const calls: Array<{
      action: string;
      id?: string;
      dto?: unknown;
      context: CrmUserContext;
    }> = [];
    const controller = createSettingsController({
      async listEmailTemplateGroups(context, query) {
        calls.push({ action: 'list', dto: query, context });

        return {
          current: 1,
          size: 20,
          total: 1,
          records: [createEmailTemplateGroupView()]
        };
      },
      async createEmailTemplateGroup(dto, context) {
        calls.push({ action: 'create', dto, context });

        return {
          templateGroup: createEmailTemplateGroupView({ name: dto.name })
        };
      },
      async updateEmailTemplateGroup(id, dto, context) {
        calls.push({ action: 'update', id, dto, context });

        return {
          templateGroup: createEmailTemplateGroupView({
            id,
            name: dto.name ?? 'Default follow-up'
          })
        };
      },
      async archiveEmailTemplateGroup(id, context) {
        calls.push({ action: 'archive', id, context });

        return {
          templateGroup: createEmailTemplateGroupView({
            id,
            status: 'archived'
          })
        };
      },
      async setDefaultEmailTemplateGroup(id, context) {
        calls.push({ action: 'default', id, context });

        return {
          templateGroup: createEmailTemplateGroupView({
            id,
            isDefault: true
          })
        };
      }
    });

    const payload = {
      name: 'Distributor sequence',
      language: 'en',
      steps: createEmailTemplateGroupView().steps.map(step => ({
        stepIndex: step.stepIndex,
        name: step.name,
        threadMode: step.threadMode,
        delayDays: step.delayDays,
        subjectTemplate: step.subjectTemplate,
        bodyTemplate: step.bodyTemplate
      }))
    };
    const listed = await controller.listEmailTemplateGroups(createContext(), {
      current: 1,
      size: 20
    });
    const created = await controller.createEmailTemplateGroup(createContext(), payload);
    const updated = await controller.updateEmailTemplateGroup(createContext(), 'template-1', {
      name: 'Updated sequence'
    });
    const archived = await controller.archiveEmailTemplateGroup(createContext(), 'template-1');
    const defaulted = await controller.setDefaultEmailTemplateGroup(createContext(), 'template-1');

    assert.equal(listed.data.records.length, 1);
    assert.equal(created.data.templateGroup.name, 'Distributor sequence');
    assert.equal(updated.data.templateGroup.name, 'Updated sequence');
    assert.equal(archived.data.templateGroup.status, 'archived');
    assert.equal(defaulted.data.templateGroup.isDefault, true);
    assert.deepEqual(
      calls.map(call => ({
        action: call.action,
        id: call.id,
        organizationId: call.context.organizationId
      })),
      [
        { action: 'list', id: undefined, organizationId: 'org-1' },
        { action: 'create', id: undefined, organizationId: 'org-1' },
        { action: 'update', id: 'template-1', organizationId: 'org-1' },
        { action: 'archive', id: 'template-1', organizationId: 'org-1' },
        { action: 'default', id: 'template-1', organizationId: 'org-1' }
      ]
    );
  });

  it('creates, lists and reads sequence review items with the current user context', async () => {
    const calls: Array<{
      action: string;
      payload: unknown;
      context: CrmUserContext;
    }> = [];
    const controller = createSequenceController({
      async createSequenceReviewItem(dto, context) {
        calls.push({ action: 'create', payload: dto, context });

        return { item: createSequenceReviewItemView({ id: 'enrollment-1' }) };
      },
      async listSequenceReviewItems(context, query) {
        calls.push({ action: 'list', payload: query, context });

        return {
          current: 1,
          size: 20,
          total: 1,
          records: [createSequenceReviewItemView({ id: 'enrollment-1' })]
        };
      },
      async getSequenceReviewItem(id, context) {
        calls.push({ action: 'detail', payload: id, context });

        return createSequenceReviewItemView({ id });
      }
    });

    const dto = {
      accountId: 'account-1',
      contactId: 'contact-1',
      productLineId: 'line-1',
      mailboxId: 'mailbox-1'
    };
    const created = await controller.createSequenceReviewItem(createContext(), dto);
    const listed = await controller.listSequenceReviewItems(createContext(), {
      current: 1,
      size: 20,
      currentStep: 2,
      status: 'draft_review_pending',
      messageStatus: 'sent',
      dateScope: 'today',
      createdAtScope: 'last_7_days'
    });
    const detail = await controller.getSequenceReviewItem(createContext(), 'enrollment-1');

    assert.equal(created.code, '0000');
    assert.equal(listed.data.records[0].enrollment.id, 'enrollment-1');
    assert.equal(detail.data.enrollment.id, 'enrollment-1');
    assert.deepEqual(
      calls.map(call => [call.action, call.context.userId]),
      [
        ['create', 'user-1'],
        ['list', 'user-1'],
        ['detail', 'user-1']
      ]
    );
    assert.deepEqual(calls[1].payload, {
      current: 1,
      size: 20,
      currentStep: 2,
      status: 'draft_review_pending',
      messageStatus: 'sent',
      dateScope: 'today',
      createdAtScope: 'last_7_days'
    });
  });

  it('creates CRM AI draft tasks with the current user context', async () => {
    const calls: Array<{
      dto: { enrollmentIds: string[] };
      context: CrmUserContext;
    }> = [];
    const controller = createSequenceController({
      async createAiDraftTask(dto, context) {
        calls.push({ dto, context });

        return createAiDraftTaskCreateView({
          requestedCount: dto.enrollmentIds.length,
          pendingCount: 1,
          skippedCount: 1
        });
      }
    });

    const dto = { enrollmentIds: ['enrollment-1', 'enrollment-2'] };
    const result = await controller.createAiDraftTask(createContext(), dto);

    assert.equal(result.code, '0000');
    assert.equal(result.data.task.requestedCount, 2);
    assert.equal(calls[0].dto, dto);
    assert.equal(calls[0].context.userId, 'user-1');
    assert.equal(calls[0].context.organizationId, 'org-1');
  });

  it('routes CRM AI draft task progress actions with the current user context', async () => {
    const calls: Array<{
      action: string;
      id?: string;
      context: CrmUserContext;
      query?: unknown;
    }> = [];
    const controller = createSequenceController({
      async getCurrentAiDraftTask(context) {
        calls.push({ action: 'current', context });
        return createAiDraftTaskCreateView();
      },
      async listAiDraftTasks(context, query) {
        calls.push({ action: 'list', context, query });
        return {
          current: 1,
          size: 20,
          total: 1,
          records: [createAiDraftTaskCreateView().task]
        };
      },
      async getAiDraftTaskDetail(id, context) {
        calls.push({ action: 'detail', id, context });
        return createAiDraftTaskCreateView();
      },
      async retryFailedAiDraftTask(id, context) {
        calls.push({ action: 'retry', id, context });
        return createAiDraftTaskCreateView({ status: 'queued' });
      },
      async cancelAiDraftTask(id, context) {
        calls.push({ action: 'cancel', id, context });
        return createAiDraftTaskCreateView({ status: 'cancelled' });
      },
      async markAiDraftTaskRead(id, context) {
        calls.push({ action: 'read', id, context });
        return {
          task: createAiDraftTaskCreateView({
            readAt: '2026-06-20T10:00:00.000Z'
          }).task
        };
      }
    });

    await controller.getCurrentAiDraftTask(createContext());
    await controller.listAiDraftTasks(createContext(), {
      current: 1,
      size: 20
    });
    await controller.getAiDraftTaskDetail(createContext(), 'ai-draft-task-1');
    await controller.retryFailedAiDraftTask(createContext(), 'ai-draft-task-1');
    await controller.cancelAiDraftTask(createContext(), 'ai-draft-task-1');
    const read = await controller.markAiDraftTaskRead(createContext(), 'ai-draft-task-1');

    assert.equal(read.data.task.readAt, '2026-06-20T10:00:00.000Z');
    assert.deepEqual(
      calls.map(call => call.action),
      ['current', 'list', 'detail', 'retry', 'cancel', 'read']
    );
    assert.equal(
      calls.every(call => call.context.userId === 'user-1'),
      true
    );
  });

  it('lists local strategy stats with the current user context', async () => {
    const calls: CrmUserContext[] = [];
    const controller = createSettingsController({
      async listStrategyStats(context) {
        calls.push(context);

        return {
          generatedAt: new Date('2026-06-20T08:00:00.000Z'),
          rows: {
            template: [],
            policy: [],
            persona: [],
            productLine: []
          }
        };
      }
    });

    const result = await controller.listStrategyStats(createContext());

    assert.equal(result.code, '0000');
    assert.equal(calls[0].userId, 'user-1');
    assert.deepEqual(Object.keys(result.data.rows), ['template', 'policy', 'persona', 'productLine']);
  });

  it('updates, approves, starts and stops message drafts with the current user context', async () => {
    const calls: Array<{
      action: string;
      id: string;
      payload?: unknown;
      context: CrmUserContext;
    }> = [];
    const controller = createSequenceController({
      async updateMessageDraft(id, dto, context) {
        calls.push({ action: 'update', id, payload: dto, context });

        return {
          message: createMessageView({
            id,
            subject: dto.subject,
            bodyText: dto.bodyText
          })
        };
      },
      async approveMessageDraft(id, context) {
        calls.push({ action: 'approve', id, context });

        return {
          enrollment: createEnrollmentView({ status: 'ready_to_send' }),
          message: createMessageView({ id, status: 'draft_ready' })
        };
      },
      async startFirstMessageSend(id, context) {
        calls.push({ action: 'start-send', id, context });

        return createSendStartView({ id });
      },
      async returnFirstMessageToEdit(id, context) {
        calls.push({ action: 'return-to-edit', id, context });

        return {
          ...createSendStartView({ id }),
          enrollment: createEnrollmentView({ id, status: 'draft_review_pending' }),
          message: createMessageView({ status: 'draft_pending_review' })
        };
      },
      async resumeSequenceEnrollment(id, context) {
        calls.push({ action: 'resume', id, context });

        return {
          ...createSequenceStopView({ id }),
          enrollment: createEnrollmentView({ id, status: 'ready_to_send' }),
          message: createMessageView({ status: 'draft_ready' })
        };
      },
      async retryFirstMessageSend(id, context) {
        calls.push({ action: 'retry-send', id, context });

        return createSendStartView({ id });
      },
      async generateNextDraft(id, context) {
        calls.push({ action: 'generate-next-draft', id, context });

        return {
          enrollment: createEnrollmentView({ id, status: 'ready_to_send' }),
          message: createMessageView({
            id: 'message-2',
            enrollmentId: id,
            stepIndex: 2,
            status: 'draft_pending_review'
          })
        };
      },
      async stopSequenceEnrollment(id, context) {
        calls.push({ action: 'stop', id, context });

        return createSequenceStopView({ id });
      }
    });

    const updated = await controller.updateMessageDraft(createContext(), 'message-1', {
      subject: 'Hello',
      bodyText: 'Body'
    });
    const approved = await controller.approveMessageDraft(createContext(), 'message-1');
    const queued = await controller.startFirstMessageSend(createContext(), 'enrollment-1');
    const returned = await controller.returnFirstMessageToEdit(createContext(), 'enrollment-1');
    const resumed = await controller.resumeSequenceEnrollment(createContext(), 'enrollment-1');
    const retried = await controller.retryFirstMessageSend(createContext(), 'enrollment-1');
    const generated = await controller.generateNextDraft(createContext(), 'enrollment-1');
    const stopped = await controller.stopSequenceEnrollment(createContext(), 'enrollment-1');

    assert.equal(updated.data.message.subject, 'Hello');
    assert.equal(approved.data.enrollment.status, 'ready_to_send');
    assert.equal(queued.data.message.status, 'queued');
    assert.equal(returned.data.message.status, 'draft_pending_review');
    assert.equal(resumed.data.enrollment.status, 'ready_to_send');
    assert.equal(retried.data.enrollment.status, 'sequence_running');
    assert.equal(generated.data.enrollment.status, 'ready_to_send');
    assert.equal(generated.data.message.stepIndex, 2);
    assert.equal(stopped.data.enrollment.status, 'stopped');
    assert.deepEqual(
      calls.map(call => [call.action, call.id, call.context.organizationId]),
      [
        ['update', 'message-1', 'org-1'],
        ['approve', 'message-1', 'org-1'],
        ['start-send', 'enrollment-1', 'org-1'],
        ['return-to-edit', 'enrollment-1', 'org-1'],
        ['resume', 'enrollment-1', 'org-1'],
        ['retry-send', 'enrollment-1', 'org-1'],
        ['generate-next-draft', 'enrollment-1', 'org-1'],
        ['stop', 'enrollment-1', 'org-1']
      ]
    );
  });

  it('lists and restores message draft versions with the current user context', async () => {
    const calls: Array<{
      action: string;
      id: string;
      versionId?: string;
      context: CrmUserContext;
    }> = [];
    const controller = createSequenceController({
      async listMessageDraftVersions(id, context) {
        calls.push({ action: 'list-versions', id, context });

        return {
          versions: [
            {
              id: 'draft-version-1',
              organizationId: context.organizationId,
              ownerUserId: context.userId,
              accountId: 'account-1',
              contactId: 'contact-1',
              enrollmentId: 'enrollment-1',
              messageId: id,
              mailboxId: null,
              stepIndex: 1,
              versionNo: 1,
              subject: 'Historic subject',
              bodyText: 'Historic body',
              editorId: context.userId,
              editorName: context.userName,
              createdAt: '2026-06-18T10:00:00.000Z'
            }
          ]
        };
      },
      async restoreMessageDraftVersion(id, versionId, context) {
        calls.push({ action: 'restore-version', id, versionId, context });

        return {
          message: createMessageView({
            id,
            subject: 'Historic subject',
            bodyText: 'Historic body'
          })
        };
      }
    });

    const versions = await controller.listMessageDraftVersions(createContext(), 'message-1');
    const restored = await controller.restoreMessageDraftVersion(createContext(), 'message-1', 'draft-version-1');

    assert.equal(versions.data.versions[0].versionNo, 1);
    assert.equal(restored.data.message.subject, 'Historic subject');
    assert.deepEqual(
      calls.map(call => [call.action, call.id, call.versionId ?? null, call.context.userId]),
      [
        ['list-versions', 'message-1', null, 'user-1'],
        ['restore-version', 'message-1', 'draft-version-1', 'user-1']
      ]
    );
  });

  it('routes AI draft preview and regeneration with the current user context', async () => {
    const calls: Array<{
      action: string;
      id?: string;
      input?: unknown;
      context: CrmUserContext;
    }> = [];
    const previewResult: CrmAiDraftPreviewView = {
      preview: {
        subject: 'AI subject step 2',
        bodyText: 'AI body step 2',
        aiDraft: {
          generated: true,
          reason: 'Focused on supply reliability.',
          riskNotes: ['需要人工确认'],
          snapshot: {
            productLineId: 'line-ai',
            productLineName: 'Bearing Series',
            stepIndex: 2,
            writingConfig: {
              enabled: true,
              steps: [{ stepIndex: 2, prompt: 'Prompt 2' }]
            },
            reason: 'Focused on supply reliability.',
            riskNotes: ['需要人工确认'],
            generatedAt: '2026-06-18T09:00:00.000Z'
          }
        }
      }
    };
    const controller = createSequenceController({
      async previewAiDraft(input, context) {
        calls.push({ action: 'preview', input, context });

        return previewResult;
      },
      async regenerateMessageAiDraft(id, context) {
        calls.push({ action: 'regenerate', id, context });

        return {
          message: createMessageView({
            id,
            subject: 'AI subject step 1',
            bodyText: 'AI body step 1'
          })
        };
      }
    });
    const input = {
      accountId: 'account-1',
      contactId: 'contact-1',
      productLineId: 'line-ai',
      stepIndex: 2 as const,
      previousMessages: [
        {
          stepIndex: 1,
          subject: 'Previous subject',
          bodyText: 'Previous body'
        }
      ]
    };

    const preview = await controller.previewAiDraft(createContext(), input);
    const regenerated = await controller.regenerateMessageAiDraft(createContext(), 'message-1');

    assert.equal(preview.data.preview.subject, 'AI subject step 2');
    assert.equal(regenerated.data.message.subject, 'AI subject step 1');
    assert.deepEqual(
      calls.map(call => [call.action, call.id ?? null, call.context.userId]),
      [
        ['preview', null, 'user-1'],
        ['regenerate', 'message-1', 'user-1']
      ]
    );
    assert.equal(calls[0].input, input);
  });

  it('routes sequence batch operations with ids and current user context', async () => {
    const calls: Array<{
      action: string;
      ids: string[];
      context: CrmUserContext;
    }> = [];
    const batchResult: CrmSequenceBatchOperateView = {
      totalCount: 2,
      successCount: 1,
      skippedCount: 1,
      failedCount: 0,
      results: [
        { id: 'enrollment-1', status: 'success', message: '已处理' },
        { id: 'enrollment-2', status: 'skipped', message: '已跳过' }
      ]
    };
    const controller = createSequenceController({
      async batchGenerateNextDrafts(dto, context) {
        calls.push({
          action: 'batch-generate-next-draft',
          ids: dto.ids,
          context
        });

        return batchResult;
      },
      async batchApproveMessageDrafts(dto, context) {
        calls.push({ action: 'batch-approve-draft', ids: dto.ids, context });

        return batchResult;
      },
      async batchStopSequenceEnrollments(dto, context) {
        calls.push({ action: 'batch-stop', ids: dto.ids, context });

        return batchResult;
      }
    });

    const generated = await controller.batchGenerateNextDrafts(createContext(), {
      ids: ['enrollment-1', 'enrollment-2']
    });
    const approved = await controller.batchApproveMessageDrafts(createContext(), {
      ids: ['enrollment-1', 'enrollment-2']
    });
    const stopped = await controller.batchStopSequenceEnrollments(createContext(), {
      ids: ['enrollment-1', 'enrollment-2']
    });

    assert.equal(generated.data.successCount, 1);
    assert.equal(approved.data.successCount, 1);
    assert.equal(stopped.data.skippedCount, 1);
    assert.deepEqual(
      calls.map(call => [call.action, call.ids, call.context.userId]),
      [
        ['batch-generate-next-draft', ['enrollment-1', 'enrollment-2'], 'user-1'],
        ['batch-approve-draft', ['enrollment-1', 'enrollment-2'], 'user-1'],
        ['batch-stop', ['enrollment-1', 'enrollment-2'], 'user-1']
      ]
    );
  });

  it('lists, reads, updates and mock-ingests inbox replies with the current user context', async () => {
    const calls: Array<{
      action: string;
      id?: string;
      payload?: unknown;
      context: CrmUserContext;
    }> = [];
    const controller = createInboxController({
      async listInboxThreads(context, query) {
        calls.push({ action: 'list-inbox', payload: query, context });

        return {
          current: 1,
          size: 20,
          total: 1,
          records: [createInboxThreadView()]
        };
      },
      async getInboxThread(id, context) {
        calls.push({ action: 'detail-inbox', id, context });

        return createInboxThreadDetailView({ id });
      },
      async updateInboxThreadStatus(id, dto, context) {
        calls.push({ action: 'status-inbox', id, payload: dto, context });

        return {
          thread: createInboxThreadView({ id, status: dto.status }),
          account: createAccountView({
            status: dto.status === 'handled' ? 'followed_up' : 'replied_pending'
          }),
          event: createTimelineEventView({
            eventType: 'inbox_status_changed'
          })
        };
      },
      async replyInboxThread(id, dto, context) {
        calls.push({ action: 'reply-inbox', id, payload: dto, context });
        const detail = createInboxThreadDetailView({ id });

        return {
          ...detail,
          thread: {
            ...detail.thread,
            status: 'handled' as const,
            unreadCount: 0
          },
          account: createAccountView({ status: 'followed_up' }),
          messages: [
            ...detail.messages,
            {
              ...detail.messages[0],
              id: 'outbound-reply-1',
              direction: 'outbound' as const,
              bodyText: dto.bodyText,
              sentAt: '2026-06-18T11:30:00.000Z',
              receivedAt: null
            }
          ]
        };
      },
      async polishInboxReplyDraft(id, dto, context) {
        calls.push({ action: 'reply-polish', id, payload: dto, context });

        return createInboxThreadDetailView({
          id,
          replyDraft: {
            topic: dto.topic,
            bodyText: `Polished ${dto.topic}`,
            metadata: { generated: true, reason: 'polished', riskNotes: [] },
            updatedAt: '2026-06-18T12:00:00.000Z',
            updatedById: context.userId,
            updatedByName: context.userName
          }
        });
      },
      async saveInboxReplyDraft(id, dto, context) {
        calls.push({ action: 'reply-draft-save', id, payload: dto, context });

        return createInboxThreadDetailView({
          id,
          replyDraft: {
            topic: dto.topic,
            bodyText: dto.bodyText,
            metadata: null,
            updatedAt: '2026-06-18T12:05:00.000Z',
            updatedById: context.userId,
            updatedByName: context.userName
          }
        });
      },
      async mockCustomerReply(id, dto, context) {
        calls.push({ action: 'mock-reply', id, payload: dto, context });

        return createInboxThreadDetailView({ id: 'inbox-thread-1' });
      }
    });

    const listed = await controller.listInboxThreads(createContext(), {
      current: '1',
      size: '20',
      status: 'pending'
    });
    const detail = await controller.getInboxThread(createContext(), 'inbox-thread-1');
    const status = await controller.updateInboxThreadStatus(createContext(), 'inbox-thread-1', { status: 'handled' });
    const sentReply = await controller.replyInboxThread(createContext(), 'inbox-thread-1', { bodyText: 'Thanks.' });
    const polishedDraft = await controller.polishInboxReplyDraft(createContext(), 'inbox-thread-1', {
      topic: 'send catalogue',
      productLineId: 'product-line-1'
    });
    const savedDraft = await controller.saveInboxReplyDraft(createContext(), 'inbox-thread-1', {
      topic: 'send catalogue',
      bodyText: 'Manual reply'
    });
    const reply = await withCrmMockEndpointsEnabled(() =>
      controller.mockCustomerReply(createContext({ roles: ['R_SUPER'] }), 'message-1', {
        bodyText: 'Please send details.'
      })
    );

    assert.equal(listed.data.records[0].id, 'inbox-thread-1');
    assert.equal(detail.data.thread.id, 'inbox-thread-1');
    assert.equal(status.data.thread.status, 'handled');
    assert.equal(sentReply.data.messages.at(-1)?.direction, 'outbound');
    assert.equal(polishedDraft.data.replyDraft?.bodyText, 'Polished send catalogue');
    assert.equal(savedDraft.data.replyDraft?.bodyText, 'Manual reply');
    assert.equal(reply.data.messages[0].direction, 'inbound');
    assert.deepEqual(
      calls.map(call => [call.action, call.id ?? null, call.context.organizationId]),
      [
        ['list-inbox', null, 'org-1'],
        ['detail-inbox', 'inbox-thread-1', 'org-1'],
        ['status-inbox', 'inbox-thread-1', 'org-1'],
        ['reply-inbox', 'inbox-thread-1', 'org-1'],
        ['reply-polish', 'inbox-thread-1', 'org-1'],
        ['reply-draft-save', 'inbox-thread-1', 'org-1'],
        ['mock-reply', 'message-1', 'org-1']
      ]
    );
  });

  it('rejects anonymous users', async () => {
    const controller = createAccountController();

    await assert.rejects(() => controller.listAccounts(null, {}), UnauthorizedException);
  });

  it('reads and saves organization CRM config with the current organization context', async () => {
    const calls: Array<{
      action: string;
      dto?: { allowAdminViewMemberEmailBody: boolean };
      context: CrmUserContext;
    }> = [];
    const controller = createSettingsController({
      async getOrganizationConfig(context) {
        calls.push({ action: 'get', context });

        return createOrganizationConfigView({
          allowAdminViewMemberEmailBody: false
        });
      },
      async saveOrganizationConfig(dto, context) {
        calls.push({ action: 'save', dto, context });

        return createOrganizationConfigView({
          allowAdminViewMemberEmailBody: dto.allowAdminViewMemberEmailBody
        });
      }
    });

    const adminContext = createContext({ organizationRole: 'admin' });
    const loaded = await controller.getOrganizationConfig(adminContext);
    const saved = await controller.saveOrganizationConfig(adminContext, {
      allowAdminViewMemberEmailBody: true
    });

    assert.equal(loaded.data.allowAdminViewMemberEmailBody, false);
    assert.equal(saved.data.allowAdminViewMemberEmailBody, true);
    assert.deepEqual(
      calls.map(call => [call.action, call.context.organizationId, call.context.organizationRole]),
      [
        ['get', 'org-1', 'admin'],
        ['save', 'org-1', 'admin']
      ]
    );
  });

  it('lets super admins read and save CRM global config', async () => {
    const calls: Array<{
      dto?: {
        emailVerificationCooldownDays: number;
        ownerConcurrentSendLimit?: number;
        followUpDelayDays?: CrmGlobalConfigView['followUpDelayDays'];
      };
      context?: CrmUserContext;
    }> = [];
    const controller = createSettingsController({
      async getGlobalConfig() {
        return createGlobalConfigView({ emailVerificationCooldownDays: 30 });
      },
      async saveGlobalConfig(dto, context) {
        calls.push({ dto, context });

        return createGlobalConfigView({
          emailVerificationCooldownDays: dto.emailVerificationCooldownDays
        });
      }
    });

    const superContext = createContext({ roles: ['R_SUPER'] });
    const loaded = await controller.getGlobalConfig(superContext);
    const saved = await controller.saveGlobalConfig(superContext, {
      emailVerificationCooldownDays: 45,
      ownerConcurrentSendLimit: 8,
      followUpDelayDays: {
        step2Days: 2,
        step3Days: 4,
        step4Days: 8,
        step5Days: 16
      }
    });

    assert.equal(loaded.data.emailVerificationCooldownDays, 30);
    assert.equal(saved.data.emailVerificationCooldownDays, 45);
    assert.equal(calls[0].dto?.ownerConcurrentSendLimit, 8);
    assert.deepEqual(calls[0].dto?.followUpDelayDays, {
      step2Days: 2,
      step3Days: 4,
      step4Days: 8,
      step5Days: 16
    });
    assert.equal(calls[0].context?.roles.includes('R_SUPER'), true);
  });

  it('rejects ordinary users from CRM global config endpoints', async () => {
    const controller = createSettingsController();

    await assert.rejects(() => controller.getGlobalConfig(createContext()), ForbiddenException);
    await assert.rejects(
      () =>
        controller.saveGlobalConfig(createContext(), {
          emailVerificationCooldownDays: 45
        }),
      ForbiddenException
    );
  });

  it('lets super admins read and save CRM AI draft queue config', async () => {
    const calls: Array<{
      dto?: { itemConcurrency?: number };
      context?: CrmUserContext;
    }> = [];
    const controller = createSettingsController({
      async getAiDraftQueueConfig() {
        return createAiDraftQueueConfigView({ itemConcurrency: 3 });
      },
      async saveAiDraftQueueConfig(dto, context) {
        calls.push({ dto, context });

        return createAiDraftQueueConfigView({
          itemConcurrency: dto.itemConcurrency
        });
      }
    });

    const superContext = createContext({ roles: ['R_SUPER'] });
    const loaded = await controller.getAiDraftQueueConfig(superContext);
    const saved = await controller.saveAiDraftQueueConfig(superContext, {
      itemConcurrency: 5
    });

    assert.equal(loaded.data.itemConcurrency, 3);
    assert.equal(saved.data.itemConcurrency, 5);
    assert.equal(calls[0].context?.roles.includes('R_SUPER'), true);
  });

  it('rejects ordinary users from CRM AI draft queue config endpoints', async () => {
    const controller = createSettingsController();

    await assert.rejects(() => controller.getAiDraftQueueConfig(createContext()), ForbiddenException);
    await assert.rejects(
      () =>
        controller.saveAiDraftQueueConfig(createContext(), {
          itemConcurrency: 5
        }),
      ForbiddenException
    );
  });
});

function createContext(overrides: Partial<CrmUserContext> = {}): CrmUserContext {
  const user = createUser();

  return {
    userId: user.userId,
    userName: user.userName,
    roles: user.roles,
    organizationId: user.organizationId,
    organizationRole: user.organizationRole,
    ...overrides
  };
}

function createUser(overrides: Partial<UserInfo> = {}) {
  return {
    ...createUserBase(),
    ...overrides
  };
}

function createUserBase() {
  return {
    userId: 'user-1',
    userName: 'Alice',
    roles: ['R_USER'],
    buttons: [],
    organizationId: 'org-1',
    organizationName: 'Org One',
    organizationRole: 'member' as const
  };
}

/** Creates the real account controller with the shared service stub. */
function createAccountController(partial: CrmAccountControllerServiceStub = {}) {
  return new CrmAccountController(createControllerService<CrmAccountService>(partial));
}

/** Creates the real mailbox controller and optional watch/config collaborators. */
function createMailboxController(
  partial: CrmMailboxControllerServiceStub = {},
  gmailWatchService?: ConstructorParameters<typeof CrmMailboxController>[1],
  appConfigService?: ConstructorParameters<typeof CrmMailboxController>[2]
) {
  return new CrmMailboxController(
    createControllerService<CrmMailboxService>(partial),
    gmailWatchService as ConstructorParameters<typeof CrmMailboxController>[1],
    appConfigService as ConstructorParameters<typeof CrmMailboxController>[2]
  );
}

/** Creates the minimal app config collaborator used by controller feature gates. */
function createCrmAppConfigService(config: {
  crmEnableMockEndpoints: boolean;
  isProduction: boolean;
}): ConstructorParameters<typeof CrmMailboxController>[2] {
  return { config } as unknown as ConstructorParameters<typeof CrmMailboxController>[2];
}

/** Creates the real settings controller with the shared service stub. */
function createSettingsController(partial: CrmSettingsControllerServiceStub = {}) {
  const service = createControllerStub(partial);

  return new CrmSettingsController(
    service as unknown as CrmSettingsService,
    service as unknown as CrmAiDraftTaskService,
    service as unknown as CrmSendQueueReconcileService,
    service as unknown as CrmSuppressionService,
    service as unknown as CrmProductLineService,
    service as unknown as CrmPersonaProfileService,
    service as unknown as CrmEmailTemplateGroupService,
    service as unknown as CrmSequencePolicyService,
    service as unknown as CrmDashboardService
  );
}

/** Creates the real sequence controller with the shared service stub. */
function createSequenceController(partial: CrmSequenceControllerServiceStub = {}) {
  const service = createControllerStub(partial);

  return new CrmSequenceController(
    service as unknown as CrmSequenceService,
    service as unknown as CrmNextDraftService,
    service as unknown as CrmAiDraftTaskService,
    service as unknown as CrmBatchDraftApprovalService,
    service as unknown as CrmBatchSequenceStopService,
    service as unknown as CrmDraftPreviewService,
    service as unknown as CrmDraftService,
    service as unknown as CrmMessageDraftApprovalRouterService,
    service as unknown as CrmSequenceControlService,
    undefined as unknown as ConstructorParameters<typeof CrmSequenceController>[9]
  );
}

/** Creates the real inbox controller and optional config collaborator. */
function createInboxController(
  partial: CrmInboxControllerServiceStub = {},
  appConfigService?: ConstructorParameters<typeof CrmInboxController>[1]
) {
  return new CrmInboxController(
    createControllerService<CrmInboxService>(partial),
    appConfigService as ConstructorParameters<typeof CrmInboxController>[1]
  );
}

/** Casts the existing method stub to the domain service currently injected by a split controller. */
function createControllerService<T>(partial: CrmControllerServiceStub = {}) {
  return createControllerStub(partial) as unknown as T;
}

function createAccountView(overrides: Partial<CrmAccountView> = {}) {
  return {
    id: 'account-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    name: 'ABC Trading',
    normalizedName: 'abc trading',
    websiteUrl: 'https://abc.example',
    domain: 'abc.example',
    country: 'AE',
    customerType: 'distributor',
    status: 'candidate' as const,
    sourceTaskId: null,
    archivedAt: null,
    archiveReason: null,
    archiveSlimmedAt: null,
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T09:00:00.000Z',
    ...overrides
  };
}

function createTimelineEventView(overrides: Partial<CrmTimelineEventView> = {}) {
  return {
    id: 'event-1',
    organizationId: 'org-1',
    accountId: 'account-1',
    contactId: null,
    ownerUserId: 'user-1',
    eventType: 'note_added',
    title: '新增备注',
    content: null,
    metadata: null,
    createdAt: '2026-06-18T09:00:00.000Z',
    ...overrides
  };
}

function createContactView(overrides: Partial<CrmEmailVerificationView['contact']> = {}) {
  return {
    id: 'contact-1',
    organizationId: 'org-1',
    accountId: 'account-1',
    ownerUserId: 'user-1',
    fullName: 'Ali Hassan',
    title: 'Buyer',
    email: 'ali@example.com',
    emailHash: 'hash-1',
    maskedEmail: 'a***@example.com',
    isPublicEmail: false,
    emailStatus: 'valid' as const,
    sourceTaskId: null,
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T10:00:00.000Z',
    ...overrides
  };
}

function createMailboxView(overrides: Partial<CrmMailboxView> = {}): CrmMailboxView {
  return {
    id: 'mailbox-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    ownerUserName: 'Alice',
    provider: 'gmail' as const,
    emailAddress: 'alice@gmail.com',
    maskedEmail: 'a***@gmail.com',
    status: 'active' as const,
    dailyLimit: 50,
    hourlyLimit: 10,
    warmupStage: 'new' as const,
    syncMode: 'full_sync' as const,
    watchExpiration: null,
    lastHistoryId: null,
    lastSyncIssue: null,
    authorizedAt: '2026-06-18T09:00:00.000Z',
    pausedAt: null,
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T09:00:00.000Z',
    ...overrides
  };
}

function createProductLineView(
  overrides: Partial<{
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
    aiWritingConfig: CrmProductLineView['aiWritingConfig'];
    status: 'active' | 'archived';
    createdById: string;
    createdByName: string | null;
    createdAt: string;
    updatedAt: string;
  }> = {}
) {
  return {
    id: 'product-line-1',
    organizationId: 'org-1',
    name: 'Bearing Series',
    targetCustomerType: null,
    coreSellingPoints: null,
    moq: null,
    leadTime: null,
    paymentTerms: null,
    certifications: null,
    catalogUrl: null,
    websiteUrl: null,
    commonModelsText: null,
    aiWritingConfig: null,
    status: 'active' as const,
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T09:00:00.000Z',
    ...overrides
  };
}

function createAiWritingConfigView(): NonNullable<CrmProductLineView['aiWritingConfig']> {
  return {
    enabled: true,
    steps: [1, 2, 3, 4, 5].map(stepIndex => ({
      stepIndex: stepIndex as 1 | 2 | 3 | 4 | 5,
      prompt: `Prompt ${stepIndex}`
    }))
  };
}

function createPersonaProfileView(overrides: Partial<CrmPersonaProfileView> = {}): CrmPersonaProfileView {
  return {
    id: 'persona-1',
    organizationId: 'org-1',
    name: 'Purchasing Manager',
    description: 'Default buyer profile',
    titleKeywordsText: 'purchasing manager\nbuyer',
    customerTypeKeywordsText: 'distributor',
    painPoints: 'price and delivery uncertainty',
    focusText: 'price, MOQ, lead time, and payment terms',
    avoidText: null,
    status: 'active',
    isDefault: false,
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T09:00:00.000Z',
    ...overrides
  };
}

function createTemplateDefaultsView() {
  return {
    templateGroup: {
      id: 'global-first-touch',
      name: '默认首封开发信',
      scope: 'global' as const,
      language: 'en',
      variables: [
        { key: 'account.name', label: '客户公司', source: '线索库' },
        {
          key: 'persona.focus',
          label: '职位画像侧重点',
          source: '内置职位画像'
        }
      ],
      steps: Array.from({ length: 5 }, (_, index) => ({
        stepIndex: index + 1,
        name: `第 ${index + 1} 封`,
        threadMode: index === 1 ? ('same_thread' as const) : ('new_subject' as const),
        delayDays: index === 0 ? 0 : [3, 7, 14, 21][index - 1],
        subjectTemplate: index === 0 ? '{{product.name}} for {{account.name}}' : '',
        bodyTemplate: 'Hi {{contact.name}},\n\n{{persona.focus}}'
      }))
    },
    personas: [
      {
        label: 'Purchasing Manager',
        aliases: ['buyer'],
        focusText: '价格、MOQ、交期、付款方式',
        draftFocusText: 'price, MOQ, lead time, and payment terms'
      }
    ]
  };
}

function createEmailTemplateGroupView(
  overrides: Partial<{
    id: string;
    organizationId: string;
    name: string;
    language: string;
    description: string | null;
    status: 'active' | 'archived';
    isDefault: boolean;
    createdById: string;
    createdByName: string | null;
    createdAt: string;
    updatedAt: string;
    steps: Array<{
      id: string;
      organizationId: string;
      templateGroupId: string;
      stepIndex: number;
      name: string;
      threadMode: 'new_subject' | 'same_thread';
      delayDays: number;
      subjectTemplate: string;
      bodyTemplate: string;
      createdAt: string;
      updatedAt: string;
    }>;
  }> = {}
) {
  return {
    id: 'template-1',
    organizationId: 'org-1',
    name: 'Default follow-up',
    language: 'en',
    description: null,
    status: 'active' as const,
    isDefault: false,
    steps: Array.from({ length: 5 }, (_, index) => ({
      id: `template-step-${index + 1}`,
      organizationId: 'org-1',
      templateGroupId: 'template-1',
      stepIndex: index + 1,
      name: `第 ${index + 1} 封`,
      threadMode: index === 1 ? ('same_thread' as const) : ('new_subject' as const),
      delayDays: index === 0 ? 0 : [3, 7, 14, 21][index - 1],
      subjectTemplate: index === 1 ? '' : `Subject ${index + 1}`,
      bodyTemplate: `Body ${index + 1}`,
      createdAt: '2026-06-18T09:00:00.000Z',
      updatedAt: '2026-06-18T09:00:00.000Z'
    })),
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T09:00:00.000Z',
    ...overrides
  };
}

function createEnrollmentView(overrides: Partial<CrmEnrollmentView> = {}): CrmEnrollmentView {
  return {
    id: 'enrollment-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    productLineId: 'product-line-1',
    mailboxId: 'mailbox-1',
    policyId: null,
    name: 'ABC Trading - Ali Hassan',
    status: 'draft_review_pending',
    currentStep: 1,
    totalSteps: 5,
    runVersion: 1,
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T09:00:00.000Z',
    ...overrides
  };
}

function createMessageView(overrides: Partial<CrmMessageView> = {}): CrmMessageView {
  return {
    id: 'message-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    enrollmentId: 'enrollment-1',
    mailboxId: 'mailbox-1',
    stepIndex: 1,
    threadMode: 'new_subject',
    subject: 'Bearing Series for ABC Trading',
    bodyText: 'Hi Ali,\n\nWould it be useful if I sent a short product list?\n\nBest regards,\nAlice',
    status: 'draft_pending_review',
    scheduledAt: null,
    sentAt: null,
    bullJobId: null,
    providerMessageId: null,
    providerThreadId: null,
    aiDraft: null,
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T09:00:00.000Z',
    ...overrides
  };
}

function createSendStartView(overrides: { id?: string } = {}): CrmSendStartView {
  return {
    enrollment: createEnrollmentView({
      id: overrides.id ?? 'enrollment-1',
      status: 'sequence_running'
    }),
    message: createMessageView({ status: 'queued', bullJobId: 'send-job-1' }),
    account: createAccountView({ status: 'sequence_running' }),
    event: createTimelineEventView({ eventType: 'message_queued' })
  };
}

function createSequenceStopView(overrides: { id?: string } = {}): CrmSequenceStopView {
  return {
    enrollment: createEnrollmentView({
      id: overrides.id ?? 'enrollment-1',
      status: 'stopped'
    }),
    message: createMessageView({ status: 'skipped' }),
    account: createAccountView({ status: 'paused' }),
    event: createTimelineEventView({ eventType: 'sequence_stopped' })
  };
}

function createSequenceBatchOperateView(): CrmSequenceBatchOperateView {
  return {
    totalCount: 1,
    successCount: 1,
    skippedCount: 0,
    failedCount: 0,
    results: [{ id: 'enrollment-1', status: 'success', message: '已处理' }]
  };
}

function createInboxThreadView(overrides: Partial<CrmInboxThreadView> = {}): CrmInboxThreadView {
  return {
    id: 'inbox-thread-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    enrollmentId: 'enrollment-1',
    mailboxId: 'mailbox-1',
    providerThreadId: 'enrollment-1',
    subject: 'Re: Bearing Series for ABC Trading',
    status: 'pending',
    lastInboundAt: '2026-06-18T11:00:00.000Z',
    unreadCount: 1,
    messageCount: 1,
    createdAt: '2026-06-18T11:00:00.000Z',
    updatedAt: '2026-06-18T11:00:00.000Z',
    account: createAccountView({ status: 'replied_pending' }),
    contact: createContactView(),
    mailbox: createMailboxView(),
    enrollment: createEnrollmentView({ status: 'replied' }),
    lastMessageSnippet: 'Please send details.',
    canReadBody: true,
    canOperate: true,
    ...overrides,
    provider: 'gmail'
  };
}

function createInboxThreadDetailView(
  overrides: Partial<CrmInboxThreadView> & { replyDraft?: unknown } = {}
): CrmInboxThreadDetailView {
  const thread = createInboxThreadView(overrides);

  return {
    thread,
    account: thread.account,
    contact: thread.contact,
    mailbox: thread.mailbox,
    enrollment: thread.enrollment,
    messages: [
      {
        id: 'inbox-message-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        accountId: 'account-1',
        contactId: 'contact-1',
        enrollmentId: 'enrollment-1',
        mailboxId: 'mailbox-1',
        provider: 'gmail',
        providerMessageId: null,
        replyToMessageId: 'message-1',
        fromEmail: 'ali@example.com',
        fromEmailHash: 'hash-1',
        maskedFromEmail: 'a***@example.com',
        threadId: thread.id,
        direction: 'inbound',
        subject: thread.subject,
        snippet: 'Please send details.',
        bodyText: 'Please send details.',
        messageType: 'customer_reply',
        sentAt: null,
        receivedAt: '2026-06-18T11:00:00.000Z',
        createdAt: '2026-06-18T11:00:00.000Z',
        updatedAt: '2026-06-18T11:00:00.000Z'
      }
    ],
    timelineEvents: [createTimelineEventView({ eventType: 'customer_replied' })],
    canOperate: true,
    replyDraft: overrides.replyDraft ?? null
  };
}

function createSequenceReviewItemView(overrides: { id?: string } = {}): CrmSequenceReviewItemView {
  return {
    enrollment: createEnrollmentView({ id: overrides.id ?? 'enrollment-1' }),
    account: createAccountView(),
    contact: createContactView(),
    productLine: createProductLineView(),
    mailbox: createMailboxView(),
    policy: null,
    firstMessage: createMessageView(),
    messages: [createMessageView()],
    canOperateDraft: true,
    canControlSequence: true,
    personaMatch: {
      persona: null,
      matchMethod: 'none',
      matchedKeywords: [],
      fallbackReason: null
    },
    checklist: [
      {
        key: 'draft_content',
        label: '首封草稿',
        passed: true,
        message: '已生成首封纯文本草稿'
      }
    ]
  };
}

function createEmailVerificationView(overrides: { contactId?: string } = {}): CrmEmailVerificationView {
  return {
    contact: createContactView({ id: overrides.contactId }),
    event: createTimelineEventView({
      accountId: 'account-1',
      contactId: overrides.contactId ?? 'contact-1',
      eventType: 'email_verified',
      title: '邮箱验证'
    })
  };
}

function createGlobalConfigView(overrides: Partial<CrmGlobalConfigView> = {}): CrmGlobalConfigView {
  return {
    configKey: 'default',
    emailVerificationCooldownDays: 30,
    ownerConcurrentSendLimit: 5,
    ownerDailySendLimitMax: 200,
    followUpDelayDays: {
      step2Days: 3,
      step3Days: 7,
      step4Days: 14,
      step5Days: 21
    },
    updatedAt: '1970-01-01T00:00:00.000Z',
    ...overrides
  };
}

function createAiDraftQueueConfigView(overrides: Partial<CrmAiDraftQueueConfigView> = {}): CrmAiDraftQueueConfigView {
  return {
    configKey: 'crm-ai-draft',
    itemConcurrency: 3,
    maxItemConcurrency: 5,
    maxActiveTasksPerUser: 1,
    maxActiveTasksPerOrg: 2,
    maxAttempts: 3,
    retryBackoffSeconds: [30, 60, 120],
    updatedById: null,
    updatedByName: null,
    updatedAt: '2026-06-20T09:00:00.000Z',
    ...overrides
  };
}

function createWorkbenchOverviewView(overrides: Partial<CrmWorkbenchOverviewView> = {}): CrmWorkbenchOverviewView {
  return {
    generatedAt: new Date('2026-06-20T09:00:00.000Z'),
    today: {
      sentCount: 12,
      scheduledTodayCount: 9,
      scheduledTomorrowCount: 6,
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
    runningTasks: [
      {
        id: 'ai-draft-task-1',
        type: 'ai_draft',
        title: 'AI 草稿生成',
        status: 'running',
        totalCount: 30,
        completedCount: 12,
        failedCount: 1,
        pendingCount: 17,
        routePath: '/crm/email-sequences'
      }
    ],
    ...overrides
  };
}

function createOrganizationConfigView(overrides: Partial<CrmOrganizationConfigView> = {}): CrmOrganizationConfigView {
  return {
    id: 'crm-organization-config-1',
    organizationId: 'org-1',
    allowAdminViewMemberEmailBody: false,
    updatedAt: '2026-06-18T10:00:00.000Z',
    ...overrides
  };
}

function createAiDraftTaskCreateView(
  overrides: Partial<CrmAiDraftTaskCreateView['task']> = {}
): CrmAiDraftTaskCreateView {
  return {
    task: {
      id: 'ai-draft-task-1',
      organizationId: 'org-1',
      organizationRole: 'member',
      ownerUserId: 'user-1',
      ownerUserName: 'Alice',
      status: 'queued',
      runVersion: 1,
      bullJobId: null,
      requestedCount: 1,
      successCount: 0,
      skippedCount: 0,
      failedCount: 0,
      retryingCount: 0,
      runningCount: 0,
      pendingCount: 1,
      effectiveConcurrency: 3,
      maxAttempts: 3,
      failureReason: null,
      progressState: null,
      resultSummary: null,
      readAt: null,
      notifiedAt: null,
      startedAt: null,
      finishedAt: null,
      createdAt: '2026-06-20T09:00:00.000Z',
      updatedAt: '2026-06-20T09:00:00.000Z',
      ...overrides
    },
    items: []
  };
}

function createBlacklistView(overrides: Record<string, unknown> = {}) {
  return {
    id: 'blacklist-1',
    organizationId: 'org-1',
    maskedEmail: 'a***@example.com',
    reason: 'unsubscribe' as const,
    sourceAccountId: 'account-1',
    sourceContactId: 'contact-1',
    sourceMessageId: 'inbox-message-1',
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T09:00:00.000Z',
    ...overrides
  };
}

async function withCrmMockEndpointsEnabled<T>(callback: () => Promise<T>) {
  const previousValue = process.env.CRM_ENABLE_MOCK_ENDPOINTS;
  process.env.CRM_ENABLE_MOCK_ENDPOINTS = 'true';

  try {
    return await callback();
  } finally {
    if (previousValue === undefined) {
      delete process.env.CRM_ENABLE_MOCK_ENDPOINTS;
    } else {
      process.env.CRM_ENABLE_MOCK_ENDPOINTS = previousValue;
    }
  }
}

async function withNodeEnv<T>(nodeEnv: string, callback: () => Promise<T>) {
  const previousValue = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;

  try {
    return await callback();
  } finally {
    if (previousValue === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousValue;
    }
  }
}

function createControllerStub(partial: CrmControllerServiceStub = {}): CrmControllerServiceStub {
  return {
    async listAccounts() {
      return {
        current: 1,
        size: 20,
        total: 0,
        records: []
      };
    },
    async importAccountFromLead() {
      return {
        account: null,
        contact: null
      };
    },
    async getAccountDetail() {
      return {
        account: null,
        contacts: [],
        timelineEvents: []
      };
    },
    async updateAccountStatus() {
      return {
        account: null
      };
    },
    async addAccountNote() {
      return {
        event: null
      };
    },
    async archiveAccount() {
      return {
        account: null
      };
    },
    async verifyContactEmail() {
      return createEmailVerificationView();
    },
    async getGlobalConfig() {
      return createGlobalConfigView();
    },
    async saveGlobalConfig() {
      return createGlobalConfigView();
    },
    async getAiDraftQueueConfig() {
      return createAiDraftQueueConfigView();
    },
    async saveAiDraftQueueConfig() {
      return createAiDraftQueueConfigView();
    },
    async getWorkbenchOverview() {
      return createWorkbenchOverviewView();
    },
    async getOrganizationConfig() {
      return createOrganizationConfigView();
    },
    async saveOrganizationConfig() {
      return createOrganizationConfigView();
    },
    async mockAuthorizeMailbox() {
      return { mailbox: createMailboxView() };
    },
    createGmailOAuthAuthorizationUrl() {
      return {
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=state-1',
        state: 'state-1'
      };
    },
    async completeGmailOAuthAuthorization() {
      return { mailbox: createMailboxView() };
    },
    async listMailboxes() {
      return {
        current: 1,
        size: 20,
        total: 0,
        records: []
      };
    },
    async pauseMailbox() {
      return { mailbox: createMailboxView({ status: 'paused' }) };
    },
    async resumeMailbox() {
      return { mailbox: createMailboxView({ status: 'active' }) };
    },
    async revokeMailboxAuthorization() {
      return { mailbox: createMailboxView({ status: 'revoked' }) };
    },
    async deleteMailbox() {
      return { mailbox: createMailboxView({ status: 'revoked' }) };
    },
    async listProductLines() {
      return {
        current: 1,
        size: 20,
        total: 0,
        records: []
      };
    },
    getTemplateDefaults() {
      return createTemplateDefaultsView();
    },
    async listEmailTemplateGroups() {
      return {
        current: 1,
        size: 20,
        total: 0,
        records: []
      };
    },
    async createEmailTemplateGroup() {
      return { templateGroup: createEmailTemplateGroupView() };
    },
    async updateEmailTemplateGroup() {
      return { templateGroup: createEmailTemplateGroupView() };
    },
    async archiveEmailTemplateGroup() {
      return {
        templateGroup: createEmailTemplateGroupView({ status: 'archived' })
      };
    },
    async setDefaultEmailTemplateGroup() {
      return {
        templateGroup: createEmailTemplateGroupView({ isDefault: true })
      };
    },
    async createProductLine() {
      return { productLine: createProductLineView() };
    },
    async updateProductLine() {
      return { productLine: createProductLineView() };
    },
    async archiveProductLine() {
      return { productLine: createProductLineView({ status: 'archived' }) };
    },
    async listProductLineAiPromptVersions() {
      return { records: [] };
    },
    async restoreProductLineAiPromptVersion() {
      return {
        productLine: createProductLineView({
          aiWritingConfig: createAiWritingConfigView()
        }),
        version: {
          id: 'prompt-version-1',
          organizationId: 'org-1',
          productLineId: 'product-line-1',
          version: 1,
          aiWritingConfig: createAiWritingConfigView(),
          editorId: 'user-1',
          editorName: 'Alice',
          changeSummary: '恢复版本 1',
          createdAt: '2026-06-18T10:00:00.000Z'
        }
      };
    },
    async listPersonaProfiles() {
      return {
        current: 1,
        size: 20,
        total: 0,
        records: []
      };
    },
    async createPersonaProfile() {
      return { personaProfile: createPersonaProfileView() };
    },
    async updatePersonaProfile() {
      return { personaProfile: createPersonaProfileView() };
    },
    async archivePersonaProfile() {
      return {
        personaProfile: createPersonaProfileView({ status: 'archived' })
      };
    },
    async setDefaultPersonaProfile() {
      return { personaProfile: createPersonaProfileView({ isDefault: true }) };
    },
    async createSequenceReviewItem() {
      return { item: createSequenceReviewItemView() };
    },
    async listSequenceReviewItems() {
      return {
        current: 1,
        size: 20,
        total: 0,
        records: []
      };
    },
    async getSequenceReviewItem() {
      return createSequenceReviewItemView();
    },
    async listStrategyStats() {
      return {
        generatedAt: new Date('2026-06-20T08:00:00.000Z'),
        rows: {
          template: [],
          policy: [],
          persona: [],
          productLine: []
        }
      };
    },
    async updateMessageDraft() {
      return { message: createMessageView() };
    },
    async approveMessageDraft() {
      return {
        enrollment: createEnrollmentView({ status: 'ready_to_send' }),
        message: createMessageView({ status: 'draft_ready' })
      };
    },
    async startFirstMessageSend() {
      return createSendStartView();
    },
    async batchGenerateNextDrafts() {
      return createSequenceBatchOperateView();
    },
    async createAiDraftTask() {
      return createAiDraftTaskCreateView();
    },
    async getCurrentAiDraftTask() {
      return createAiDraftTaskCreateView();
    },
    async listAiDraftTasks() {
      return {
        current: 1,
        size: 20,
        total: 0,
        records: []
      };
    },
    async getAiDraftTaskDetail() {
      return createAiDraftTaskCreateView();
    },
    async retryFailedAiDraftTask() {
      return createAiDraftTaskCreateView({ status: 'queued' });
    },
    async cancelAiDraftTask() {
      return createAiDraftTaskCreateView({ status: 'cancelled' });
    },
    async markAiDraftTaskRead() {
      return {
        task: createAiDraftTaskCreateView({
          readAt: '2026-06-20T10:00:00.000Z'
        }).task
      };
    },
    async batchApproveMessageDrafts() {
      return createSequenceBatchOperateView();
    },
    async stopSequenceEnrollment() {
      return createSequenceStopView();
    },
    async batchStopSequenceEnrollments() {
      return createSequenceBatchOperateView();
    },
    async listInboxThreads() {
      return {
        current: 1,
        size: 20,
        total: 0,
        records: []
      };
    },
    async getInboxThread() {
      return createInboxThreadDetailView();
    },
    async updateInboxThreadStatus() {
      return {
        thread: createInboxThreadView(),
        account: createAccountView(),
        event: createTimelineEventView({ eventType: 'inbox_status_changed' })
      };
    },
    async replyInboxThread() {
      return createInboxThreadDetailView();
    },
    async polishInboxReplyDraft() {
      return createInboxThreadDetailView({
        replyDraft: {
          topic: 'send catalogue',
          bodyText: 'Polished reply',
          metadata: { generated: true, reason: 'polished', riskNotes: [] },
          updatedAt: '2026-06-18T12:00:00.000Z',
          updatedById: 'user-1',
          updatedByName: 'Alice'
        }
      });
    },
    async saveInboxReplyDraft() {
      return createInboxThreadDetailView({
        replyDraft: {
          topic: 'send catalogue',
          bodyText: 'Manual reply',
          metadata: null,
          updatedAt: '2026-06-18T12:05:00.000Z',
          updatedById: 'user-1',
          updatedByName: 'Alice'
        }
      });
    },
    async mockCustomerReply() {
      return createInboxThreadDetailView();
    },
    ...partial
  } as unknown as CrmControllerServiceStub;
}
