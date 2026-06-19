import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import type { CrmUserContext, ImportCrmLeadInput } from './crm.types';

type CrmAccountView = Awaited<ReturnType<CrmService['listAccounts']>>['records'][number];
type CrmMailboxView = Awaited<ReturnType<CrmService['listMailboxes']>>['records'][number];
type CrmTimelineEventView = Awaited<ReturnType<CrmService['addAccountNote']>>['event'];
type CrmEmailVerificationView = Awaited<ReturnType<CrmService['verifyContactEmail']>>;
type CrmSequenceReviewItemView = Awaited<ReturnType<CrmService['getSequenceReviewItem']>>;
type CrmEnrollmentView = Awaited<ReturnType<CrmService['approveMessageDraft']>>['enrollment'];
type CrmMessageView = Awaited<ReturnType<CrmService['approveMessageDraft']>>['message'];
type CrmSendStartView = Awaited<ReturnType<CrmService['startFirstMessageSend']>>;
type CrmSequenceStopView = Awaited<ReturnType<CrmService['stopSequenceEnrollment']>>;
type CrmInboxThreadView = Awaited<ReturnType<CrmService['listInboxThreads']>>['records'][number];
type CrmInboxThreadDetailView = Awaited<ReturnType<CrmService['getInboxThread']>>;

describe('CrmController', () => {
  it('lists accounts with the current organization context', async () => {
    const calls: Array<{ context: CrmUserContext; query: unknown }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async listAccounts(context, query) {
          calls.push({ context, query });

          return {
            current: 1,
            size: 20,
            total: 0,
            records: []
          };
        }
      })
    );

    const query = { current: 1, size: 20, keyword: 'abc', status: 'ready' as const };
    const result = await controller.listAccounts('Bearer token', query);

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

  it('imports one lead account for the current user', async () => {
    const calls: Array<{ input: ImportCrmLeadInput; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
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
              createdAt: new Date('2026-06-18T09:00:00.000Z'),
              updatedAt: new Date('2026-06-18T09:00:00.000Z')
            },
            contact: null
          };
        }
      })
    );

    const result = await controller.importLead('Bearer token', {
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

  it('gets account detail with the current user context', async () => {
    const calls: Array<{ id: string; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async getAccountDetail(id, context) {
          calls.push({ id, context });

          return {
            account: createAccountView({ id }),
            contacts: [],
            timelineEvents: []
          };
        }
      })
    );

    const result = await controller.getAccountDetail('Bearer token', 'account-1');

    assert.equal(result.code, '0000');
    assert.equal(calls[0].id, 'account-1');
    assert.equal(calls[0].context.userId, 'user-1');
  });

  it('changes account status with the current user context', async () => {
    const calls: Array<{ id: string; dto: unknown; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async updateAccountStatus(id, dto, context) {
          calls.push({ id, dto, context });

          return {
            account: createAccountView({ id, status: dto.status }),
            event: createTimelineEventView({ accountId: id, eventType: 'status_changed' })
          };
        }
      })
    );

    const dto = { status: 'ready' as const, remark: 'verified' };
    const result = await controller.updateAccountStatus('Bearer token', 'account-1', dto);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].id, 'account-1');
    assert.equal(calls[0].dto, dto);
    assert.equal(calls[0].context.organizationId, 'org-1');
  });

  it('adds account notes with the current user context', async () => {
    const calls: Array<{ id: string; dto: unknown; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async addAccountNote(id, dto, context) {
          calls.push({ id, dto, context });

          return { event: createTimelineEventView({ id: 'event-1', accountId: id, content: dto.content }) };
        }
      })
    );

    const dto = { content: 'Call next week.' };
    const result = await controller.addAccountNote('Bearer token', 'account-1', dto);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].id, 'account-1');
    assert.equal(calls[0].dto, dto);
    assert.equal(calls[0].context.userId, 'user-1');
  });

  it('archives accounts with the current user context', async () => {
    const calls: Array<{ id: string; dto: unknown; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async archiveAccount(id, dto, context) {
          calls.push({ id, dto, context });

          return {
            account: createAccountView({ id, status: 'archived' }),
            event: createTimelineEventView({ accountId: id, eventType: 'account_archived' })
          };
        }
      })
    );

    const dto = { reason: 'Not a fit' };
    const result = await controller.archiveAccount('Bearer token', 'account-1', dto);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].id, 'account-1');
    assert.equal(calls[0].dto, dto);
    assert.equal(calls[0].context.organizationId, 'org-1');
  });

  it('verifies contact email with the current user context', async () => {
    const calls: Array<{ id: string; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async verifyContactEmail(id, context) {
          calls.push({ id, context });

          return createEmailVerificationView({ contactId: id });
        }
      })
    );

    const result = await controller.verifyContactEmail('Bearer token', 'contact-1');

    assert.equal(result.code, '0000');
    assert.equal(calls[0].id, 'contact-1');
    assert.equal(calls[0].context.userId, 'user-1');
    assert.equal(result.data.contact.id, 'contact-1');
    assert.equal(result.data.event.eventType, 'email_verified');
  });

  it('mock authorizes mailbox with the current user context', async () => {
    const calls: Array<{ dto: { emailAddress: string }; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async mockAuthorizeMailbox(dto, context) {
          calls.push({ dto, context });

          return { mailbox: createMailboxView({ emailAddress: dto.emailAddress.toLowerCase() }) };
        }
      })
    );

    const dto = { emailAddress: 'Alice@Gmail.COM' };
    const result = await controller.mockAuthorizeMailbox('Bearer token', dto);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].dto, dto);
    assert.equal(calls[0].context.organizationId, 'org-1');
    assert.equal(result.data.mailbox.emailAddress, 'alice@gmail.com');
  });

  it('lists mailboxes with the current organization context', async () => {
    const calls: Array<{ context: CrmUserContext; query: unknown }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async listMailboxes(context, query) {
          calls.push({ context, query });

          return {
            current: 1,
            size: 20,
            total: 1,
            records: [createMailboxView()]
          };
        }
      })
    );

    const query = { current: 1, size: 20, keyword: 'gmail', status: 'active' as const };
    const result = await controller.listMailboxes('Bearer token', query);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].query, query);
    assert.equal(calls[0].context.userId, 'user-1');
    assert.equal(result.data.records[0].provider, 'gmail');
  });

  it('pauses and resumes mailboxes with the current user context', async () => {
    const calls: Array<{ action: string; id: string; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async pauseMailbox(id, context) {
          calls.push({ action: 'pause', id, context });

          return { mailbox: createMailboxView({ id, status: 'paused' }) };
        },
        async resumeMailbox(id, context) {
          calls.push({ action: 'resume', id, context });

          return { mailbox: createMailboxView({ id, status: 'active' }) };
        }
      })
    );

    const paused = await controller.pauseMailbox('Bearer token', 'mailbox-1');
    const resumed = await controller.resumeMailbox('Bearer token', 'mailbox-1');

    assert.equal(paused.data.mailbox.status, 'paused');
    assert.equal(resumed.data.mailbox.status, 'active');
    assert.deepEqual(
      calls.map(call => ({ action: call.action, id: call.id, userId: call.context.userId })),
      [
        { action: 'pause', id: 'mailbox-1', userId: 'user-1' },
        { action: 'resume', id: 'mailbox-1', userId: 'user-1' }
      ]
    );
  });

  it('lists product lines with the current organization context', async () => {
    const calls: Array<{ context: CrmUserContext; query: unknown }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async listProductLines(context, query) {
          calls.push({ context, query });

          return {
            current: 1,
            size: 20,
            total: 1,
            records: [createProductLineView()]
          };
        }
      })
    );

    const query = { current: 1, size: 20, keyword: 'bearing', status: 'active' as const };
    const result = await controller.listProductLines('Bearer token', query);

    assert.equal(result.code, '0000');
    assert.equal(calls[0].context.organizationId, 'org-1');
    assert.equal(calls[0].query, query);
    assert.equal(result.data.records[0].name, 'Bearing Series');
  });

  it('creates, updates and archives product lines with the current organization context', async () => {
    const calls: Array<{ action: string; id?: string; dto?: unknown; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async createProductLine(dto, context) {
          calls.push({ action: 'create', dto, context });

          return { productLine: createProductLineView({ name: dto.name }) };
        },
        async updateProductLine(id, dto, context) {
          calls.push({ action: 'update', id, dto, context });

          return { productLine: createProductLineView({ id, name: dto.name ?? 'Bearing Series' }) };
        },
        async archiveProductLine(id, context) {
          calls.push({ action: 'archive', id, context });

          return { productLine: createProductLineView({ id, status: 'archived' }) };
        }
      })
    );

    const createDto = { name: 'Bearing Series' };
    const updateDto = { name: 'Premium Bearing Series', status: 'active' as const };
    const created = await controller.createProductLine('Bearer token', createDto);
    const updated = await controller.updateProductLine('Bearer token', 'line-1', updateDto);
    const archived = await controller.archiveProductLine('Bearer token', 'line-1');

    assert.equal(created.data.productLine.name, 'Bearing Series');
    assert.equal(updated.data.productLine.name, 'Premium Bearing Series');
    assert.equal(archived.data.productLine.status, 'archived');
    assert.deepEqual(
      calls.map(call => ({ action: call.action, id: call.id, organizationId: call.context.organizationId })),
      [
        { action: 'create', id: undefined, organizationId: 'org-1' },
        { action: 'update', id: 'line-1', organizationId: 'org-1' },
        { action: 'archive', id: 'line-1', organizationId: 'org-1' }
      ]
    );
  });

  it('gets read-only template defaults with the current organization context', async () => {
    const calls: CrmUserContext[] = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        getTemplateDefaults(context) {
          calls.push(context);

          return createTemplateDefaultsView();
        }
      })
    );

    const result = await controller.getTemplateDefaults('Bearer token');

    assert.equal(result.code, '0000');
    assert.equal(calls[0].organizationId, 'org-1');
    assert.equal(result.data.templateGroup.steps.length, 5);
    assert.equal(result.data.personas[0].label, 'Purchasing Manager');
  });

  it('creates, lists and reads sequence review items with the current user context', async () => {
    const calls: Array<{ action: string; payload: unknown; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
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
      })
    );

    const dto = { accountId: 'account-1', contactId: 'contact-1', productLineId: 'line-1', mailboxId: 'mailbox-1' };
    const created = await controller.createSequenceReviewItem('Bearer token', dto);
    const listed = await controller.listSequenceReviewItems('Bearer token', {
      current: 1,
      size: 20,
      status: 'draft_review_pending'
    });
    const detail = await controller.getSequenceReviewItem('Bearer token', 'enrollment-1');

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
  });

  it('updates, approves, starts and stops message drafts with the current user context', async () => {
    const calls: Array<{ action: string; id: string; payload?: unknown; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
        async updateMessageDraft(id, dto, context) {
          calls.push({ action: 'update', id, payload: dto, context });

          return { message: createMessageView({ id, subject: dto.subject, bodyText: dto.bodyText }) };
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
        async stopSequenceEnrollment(id, context) {
          calls.push({ action: 'stop', id, context });

          return createSequenceStopView({ id });
        }
      })
    );

    const updated = await controller.updateMessageDraft('Bearer token', 'message-1', {
      subject: 'Hello',
      bodyText: 'Body'
    });
    const approved = await controller.approveMessageDraft('Bearer token', 'message-1');
    const queued = await controller.startFirstMessageSend('Bearer token', 'enrollment-1');
    const stopped = await controller.stopSequenceEnrollment('Bearer token', 'enrollment-1');

    assert.equal(updated.data.message.subject, 'Hello');
    assert.equal(approved.data.enrollment.status, 'ready_to_send');
    assert.equal(queued.data.message.status, 'queued');
    assert.equal(stopped.data.enrollment.status, 'stopped');
    assert.deepEqual(
      calls.map(call => [call.action, call.id, call.context.organizationId]),
      [
        ['update', 'message-1', 'org-1'],
        ['approve', 'message-1', 'org-1'],
        ['start-send', 'enrollment-1', 'org-1'],
        ['stop', 'enrollment-1', 'org-1']
      ]
    );
  });

  it('lists, reads, updates and mock-ingests inbox replies with the current user context', async () => {
    const calls: Array<{ action: string; id?: string; payload?: unknown; context: CrmUserContext }> = [];
    const controller = new CrmController(
      createAuthService(),
      createCrmService({
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
            account: createAccountView({ status: dto.status === 'handled' ? 'followed_up' : 'replied_pending' }),
            event: createTimelineEventView({ eventType: 'inbox_status_changed' })
          };
        },
        async mockCustomerReply(id, dto, context) {
          calls.push({ action: 'mock-reply', id, payload: dto, context });

          return createInboxThreadDetailView({ id: 'inbox-thread-1' });
        }
      })
    );

    const listed = await controller.listInboxThreads('Bearer token', { current: '1', size: '20', status: 'pending' });
    const detail = await controller.getInboxThread('Bearer token', 'inbox-thread-1');
    const status = await controller.updateInboxThreadStatus('Bearer token', 'inbox-thread-1', { status: 'handled' });
    const reply = await controller.mockCustomerReply('Bearer token', 'message-1', { bodyText: 'Please send details.' });

    assert.equal(listed.data.records[0].id, 'inbox-thread-1');
    assert.equal(detail.data.thread.id, 'inbox-thread-1');
    assert.equal(status.data.thread.status, 'handled');
    assert.equal(reply.data.messages[0].direction, 'inbound');
    assert.deepEqual(
      calls.map(call => [call.action, call.id ?? null, call.context.organizationId]),
      [
        ['list-inbox', null, 'org-1'],
        ['detail-inbox', 'inbox-thread-1', 'org-1'],
        ['status-inbox', 'inbox-thread-1', 'org-1'],
        ['mock-reply', 'message-1', 'org-1']
      ]
    );
  });

  it('rejects anonymous users', async () => {
    const controller = new CrmController(createAuthService(null), createCrmService());

    await assert.rejects(() => controller.listAccounts('', {}), UnauthorizedException);
  });
});

function createAuthService(user: ReturnType<typeof createUser> | null = createUser()): AuthService {
  return {
    getUserByAccessToken() {
      return user;
    }
  } as unknown as AuthService;
}

function createUser() {
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

function createMailboxView(overrides: Partial<CrmMailboxView> = {}) {
  return {
    id: 'mailbox-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    ownerUserName: 'Alice',
    provider: 'gmail' as const,
    emailAddress: 'alice@gmail.com',
    emailHash: 'hash-1',
    maskedEmail: 'a***@gmail.com',
    status: 'active' as const,
    dailyLimit: 50,
    hourlyLimit: 10,
    warmupStage: 'new' as const,
    watchExpiration: null,
    lastHistoryId: null,
    authorizedAt: '2026-06-18T09:00:00.000Z',
    pausedAt: null,
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T09:00:00.000Z',
    ...overrides
  };
}

function createProductLineView(overrides: Partial<{
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
  createdAt: string;
  updatedAt: string;
}> = {}) {
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
    status: 'active' as const,
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
        { key: 'persona.focus', label: '职位画像侧重点', source: '内置职位画像' }
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

function createEnrollmentView(overrides: Partial<CrmEnrollmentView> = {}): CrmEnrollmentView {
  return {
    id: 'enrollment-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    productLineId: 'product-line-1',
    mailboxId: 'mailbox-1',
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
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T09:00:00.000Z',
    ...overrides
  };
}

function createSendStartView(overrides: { id?: string } = {}): CrmSendStartView {
  return {
    enrollment: createEnrollmentView({ id: overrides.id ?? 'enrollment-1', status: 'sequence_running' }),
    message: createMessageView({ status: 'queued', bullJobId: 'send-job-1' }),
    account: createAccountView({ status: 'sequence_running' }),
    event: createTimelineEventView({ eventType: 'message_queued' })
  };
}

function createSequenceStopView(overrides: { id?: string } = {}): CrmSequenceStopView {
  return {
    enrollment: createEnrollmentView({ id: overrides.id ?? 'enrollment-1', status: 'stopped' }),
    message: createMessageView({ status: 'skipped' }),
    account: createAccountView({ status: 'paused' }),
    event: createTimelineEventView({ eventType: 'sequence_stopped' })
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
    canOperate: true,
    ...overrides,
    provider: 'gmail'
  };
}

function createInboxThreadDetailView(overrides: Partial<CrmInboxThreadView> = {}): CrmInboxThreadDetailView {
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
    canOperate: true
  };
}

function createSequenceReviewItemView(overrides: { id?: string } = {}): CrmSequenceReviewItemView {
  return {
    enrollment: createEnrollmentView({ id: overrides.id ?? 'enrollment-1' }),
    account: createAccountView(),
    contact: createContactView(),
    productLine: createProductLineView(),
    mailbox: createMailboxView(),
    firstMessage: createMessageView(),
    canOperateDraft: true,
    canControlSequence: true,
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

function createCrmService(partial: Partial<CrmService> = {}): CrmService {
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
    async mockAuthorizeMailbox() {
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
    async createProductLine() {
      return { productLine: createProductLineView() };
    },
    async updateProductLine() {
      return { productLine: createProductLineView() };
    },
    async archiveProductLine() {
      return { productLine: createProductLineView({ status: 'archived' }) };
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
    async stopSequenceEnrollment() {
      return createSequenceStopView();
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
    async mockCustomerReply() {
      return createInboxThreadDetailView();
    },
    ...partial
  } as unknown as CrmService;
}
