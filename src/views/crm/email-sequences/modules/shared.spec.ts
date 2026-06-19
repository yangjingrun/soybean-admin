import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDraftReviewOperationPayload,
  getCurrentSequenceMessage,
  getNextScheduledReviewMessage,
  getPendingReviewMessage,
  getSequenceChecklistSummary,
  getSequenceNextAction,
  getSequenceProgressText
} from './shared';

function createMessage(overrides: Partial<Api.Crm.MessageRecord>): Api.Crm.MessageRecord {
  return {
    id: overrides.id ?? 'message-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    enrollmentId: 'enrollment-1',
    mailboxId: 'mailbox-1',
    stepIndex: overrides.stepIndex ?? 1,
    threadMode: overrides.threadMode ?? 'new_subject',
    subject: overrides.subject ?? 'Subject',
    bodyText: overrides.bodyText ?? 'Body',
    status: overrides.status ?? 'draft_pending_review',
    scheduledAt: overrides.scheduledAt ?? null,
    sentAt: overrides.sentAt ?? null,
    bullJobId: overrides.bullJobId ?? null,
    providerMessageId: overrides.providerMessageId ?? null,
    providerThreadId: overrides.providerThreadId ?? null,
    createdAt: overrides.createdAt ?? '2026-06-19T01:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-19T01:00:00.000Z'
  };
}

function createSequenceItem(overrides: {
  enrollment?: Partial<Api.Crm.SequenceEnrollmentRecord>;
  firstMessage?: Api.Crm.MessageRecord | null;
  messages?: Api.Crm.MessageRecord[];
  checklist?: Api.Crm.SequenceReviewChecklistItem[];
} = {}): Api.Crm.SequenceReviewItem {
  const firstMessage = overrides.firstMessage === undefined ? createMessage({}) : overrides.firstMessage;
  const messages = overrides.messages ?? (firstMessage ? [firstMessage] : []);

  return {
    enrollment: {
      id: 'enrollment-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      accountId: 'account-1',
      contactId: 'contact-1',
      productLineId: null,
      mailboxId: 'mailbox-1',
      name: 'ABC - Ali',
      status: 'draft_review_pending',
      currentStep: 1,
      totalSteps: 5,
      runVersion: 1,
      createdById: 'user-1',
      createdByName: 'Alice',
      createdAt: '2026-06-19T01:00:00.000Z',
      updatedAt: '2026-06-19T01:00:00.000Z',
      ...overrides.enrollment
    },
    account: {
      id: 'account-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      name: 'ABC',
      normalizedName: 'abc',
      websiteUrl: null,
      domain: 'abc.example',
      country: null,
      customerType: null,
      status: 'manual_review_pending',
      sourceTaskId: null,
      createdAt: '2026-06-19T01:00:00.000Z',
      updatedAt: '2026-06-19T01:00:00.000Z'
    },
    contact: {
      id: 'contact-1',
      organizationId: 'org-1',
      accountId: 'account-1',
      ownerUserId: 'user-1',
      fullName: 'Ali',
      title: 'Buyer',
      email: 'ali@example.com',
      emailHash: 'hash-1',
      maskedEmail: 'a***@example.com',
      isPublicEmail: false,
      emailStatus: 'valid',
      sourceTaskId: null,
      createdAt: '2026-06-19T01:00:00.000Z',
      updatedAt: '2026-06-19T01:00:00.000Z'
    },
    productLine: null,
    mailbox: null,
    firstMessage,
    messages,
    canOperateDraft: true,
    canControlSequence: true,
    checklist: overrides.checklist ?? [
      {
        key: 'email',
        label: '邮箱',
        passed: true,
        message: '邮箱有效'
      }
    ]
  };
}

describe('email sequence review shared helpers', () => {
  it('builds draft operation payload with the selected message id', () => {
    const payload = buildDraftReviewOperationPayload('message-2', {
      subject: ' Follow up ',
      bodyText: ' Hi '
    });

    assert.deepEqual(payload, {
      messageId: 'message-2',
      draft: {
        subject: 'Follow up',
        bodyText: 'Hi'
      }
    });
  });

  it('selects the current pending review message instead of always using the first message', () => {
    const messages = [
      createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
      createMessage({ id: 'message-2', stepIndex: 2, status: 'draft_pending_review' })
    ];

    assert.equal(getPendingReviewMessage(messages)?.id, 'message-2');
    assert.equal(getSequenceProgressText({ currentStep: 2, totalSteps: 5 }), '第 2 / 5 封');
  });

  it('selects the nearest scheduled pending or queued message', () => {
    const messages = [
      createMessage({
        id: 'message-1',
        stepIndex: 1,
        status: 'sent',
        scheduledAt: '2026-06-19T06:00:00.000Z'
      }),
      createMessage({
        id: 'message-2',
        stepIndex: 2,
        status: 'queued',
        scheduledAt: '2026-06-20T06:00:00.000Z'
      }),
      createMessage({
        id: 'message-3',
        stepIndex: 3,
        status: 'draft_pending_review',
        scheduledAt: '2026-06-19T08:00:00.000Z'
      })
    ];

    assert.equal(getNextScheduledReviewMessage(messages)?.id, 'message-3');
  });

  it('summarizes checklist warnings for table scanning', () => {
    const summary = getSequenceChecklistSummary(
      createSequenceItem({
        checklist: [
          { key: 'email', label: '邮箱', passed: true, message: '邮箱有效' },
          { key: 'risk', label: '风险', passed: false, message: '公共邮箱需确认' }
        ]
      })
    );

    assert.deepEqual(summary, {
      failedCount: 1,
      passedCount: 1,
      total: 2
    });
  });

  it('describes the next sequence action from current message and enrollment state', () => {
    const pending = createSequenceItem({
      messages: [
        createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
        createMessage({ id: 'message-2', stepIndex: 2, status: 'draft_pending_review' })
      ],
      enrollment: { status: 'sequence_running', currentStep: 1 }
    });
    const ready = createSequenceItem({
      firstMessage: createMessage({ status: 'draft_ready' }),
      messages: [createMessage({ status: 'draft_ready' })],
      enrollment: { status: 'ready_to_send' }
    });
    const failed = createSequenceItem({
      firstMessage: createMessage({ status: 'sent' }),
      messages: [
        createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
        createMessage({ id: 'message-2', stepIndex: 2, status: 'failed' })
      ],
      enrollment: { status: 'sequence_running', currentStep: 2 }
    });
    const replied = createSequenceItem({
      firstMessage: createMessage({ status: 'sent' }),
      messages: [createMessage({ status: 'sent' })],
      enrollment: { status: 'replied' }
    });

    assert.equal(getCurrentSequenceMessage(pending)?.id, 'message-2');
    assert.equal(getSequenceNextAction(pending).label, '审核草稿');
    assert.equal(getSequenceNextAction(ready).label, '启动首封');
    assert.equal(getSequenceNextAction(failed).label, '处理失败');
    assert.equal(getSequenceNextAction(replied).description, '同公司当前序列已停发');
  });
});
