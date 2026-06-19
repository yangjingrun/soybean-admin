import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDraftReviewOperationPayload,
  buildDraftVersionListItems,
  buildSequenceMessageTimelineItems,
  buildSequenceReviewSearchParams,
  buildSequencePolicyReviewHints,
  createDefaultSequenceCreateForm,
  createDefaultSequenceFilterModel,
  getCurrentSequenceMessage,
  getFailedSequenceMessages,
  getMaxSequenceMessageStep,
  getNextScheduledReviewMessage,
  getPendingReviewMessage,
  getSequenceChecklistSummary,
  getSequenceNextAction,
  getSequenceProgressText,
  getSequenceSendAuditSummary,
  canGenerateNextSequenceDraft,
  canStopSequenceInBatch,
  summarizeSequenceBatchSelection,
  normalizeSequenceCreatePayload
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

function createSequenceItem(
  overrides: {
    enrollment?: Partial<Api.Crm.SequenceEnrollmentRecord>;
    firstMessage?: Api.Crm.MessageRecord | null;
    messages?: Api.Crm.MessageRecord[];
    checklist?: Api.Crm.SequenceReviewChecklistItem[];
  } = {}
): Api.Crm.SequenceReviewItem {
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
      archivedAt: null,
      archiveReason: null,
      archiveSlimmedAt: null,
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
    policy: null,
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

function createSequencePolicy(
  overrides: Partial<Api.Crm.SequencePolicyRecord> = {}
): Api.Crm.SequencePolicyRecord {
  return {
    id: 'policy-1',
    organizationId: 'org-1',
    name: 'Conservative follow-up',
    description: null,
    status: 'active',
    isDefault: true,
    steps: [
      { stepIndex: 1, delayDays: 0, threadMode: 'new_subject' },
      { stepIndex: 2, delayDays: 3, threadMode: 'same_thread' },
      { stepIndex: 3, delayDays: 7, threadMode: 'new_subject' },
      { stepIndex: 4, delayDays: 14, threadMode: 'new_subject' },
      { stepIndex: 5, delayDays: 21, threadMode: 'new_subject' }
    ],
    linkPolicy: 'preserve_template_links',
    allowLowRiskAutoSend: false,
    sameCompanyContactStrategy: 'single_active_per_company',
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: '2026-06-19T01:00:00.000Z',
    updatedAt: '2026-06-19T01:00:00.000Z',
    ...overrides
  };
}

describe('email sequence review shared helpers', () => {
  it('normalizes selected sequence policy into the create payload', () => {
    const form = {
      ...createDefaultSequenceCreateForm(),
      accountId: 'account-1',
      contactId: 'contact-1',
      mailboxId: 'mailbox-1',
      policyId: 'policy-1',
      productLineId: 'product-line-1'
    };

    assert.deepEqual(normalizeSequenceCreatePayload(form), {
      accountId: 'account-1',
      contactId: 'contact-1',
      mailboxId: 'mailbox-1',
      policyId: 'policy-1',
      productLineId: 'product-line-1'
    });
    assert.equal(createDefaultSequenceCreateForm().policyId, null);
  });

  it('builds sequence review search params with status and todo filters', () => {
    const filterModel = createDefaultSequenceFilterModel();
    filterModel.keyword = ' ABC ';
    filterModel.status = 'sequence_running';
    filterModel.todoType = 'can_generate_next';

    assert.deepEqual(
      buildSequenceReviewSearchParams({
        current: 2,
        size: 50,
        filterModel
      }),
      {
        current: 2,
        size: 50,
        keyword: 'ABC',
        status: 'sequence_running',
        todoType: 'can_generate_next'
      }
    );
    assert.equal(createDefaultSequenceFilterModel().todoType, null);
  });

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

  it('builds draft version list items newest first with subject summaries', () => {
    const versions: Api.Crm.MessageDraftVersionRecord[] = [
      {
        id: 'draft-version-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        accountId: 'account-1',
        contactId: 'contact-1',
        enrollmentId: 'enrollment-1',
        messageId: 'message-1',
        mailboxId: null,
        stepIndex: 1,
        versionNo: 1,
        subject: '  First saved subject  ',
        bodyText: 'First body',
        editorId: 'user-1',
        editorName: 'Alice',
        createdAt: '2026-06-18T10:00:00.000Z'
      },
      {
        id: 'draft-version-2',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        accountId: 'account-1',
        contactId: 'contact-1',
        enrollmentId: 'enrollment-1',
        messageId: 'message-1',
        mailboxId: null,
        stepIndex: 1,
        versionNo: 2,
        subject: 'Second saved subject that should be shortened for the compact version panel',
        bodyText: 'Second body',
        editorId: 'user-1',
        editorName: null,
        createdAt: '2026-06-18T11:00:00.000Z'
      }
    ];

    assert.deepEqual(
      buildDraftVersionListItems(versions).map(item => ({
        id: item.id,
        editorName: item.editorName,
        subjectSummary: item.subjectSummary,
        versionLabel: item.versionLabel
      })),
      [
        {
          id: 'draft-version-2',
          editorName: '-',
          subjectSummary: 'Second saved subject that should be shortened for the compact...',
          versionLabel: '版本 2'
        },
        {
          id: 'draft-version-1',
          editorName: 'Alice',
          subjectSummary: 'First saved subject',
          versionLabel: '版本 1'
        }
      ]
    );
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

  it('builds sequence message timeline items for drawer navigation', () => {
    const items = buildSequenceMessageTimelineItems(
      [
        createMessage({
          id: 'message-3',
          stepIndex: 3,
          status: 'draft_pending_review',
          subject: 'Third',
          updatedAt: '2026-06-21T06:00:00.000Z'
        }),
        createMessage({
          id: 'message-1',
          stepIndex: 1,
          status: 'sent',
          subject: 'First',
          sentAt: '2026-06-19T06:00:00.000Z'
        }),
        createMessage({
          id: 'message-2',
          stepIndex: 2,
          status: 'queued',
          subject: 'Second',
          scheduledAt: '2026-06-20T06:00:00.000Z'
        })
      ],
      'message-2'
    );

    assert.deepEqual(
      items.map(item => [item.id, item.title, item.statusLabel, item.selected]),
      [
        ['message-1', '第 1 封', '已发送', false],
        ['message-2', '第 2 封', '队列中', true],
        ['message-3', '第 3 封', '草稿待审', false]
      ]
    );
    assert.match(items[0].metaText, /^已发送 /);
    assert.match(items[1].metaText, /^计划发送 /);
    assert.match(items[2].metaText, /^更新于 /);
    assert.equal(items[2].subject, 'Third');
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

  it('prioritizes failed messages in the send audit summary', () => {
    const item = createSequenceItem({
      firstMessage: createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
      messages: [
        createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
        createMessage({ id: 'message-3', stepIndex: 3, status: 'failed' }),
        createMessage({ id: 'message-2', stepIndex: 2, status: 'failed' })
      ],
      checklist: [
        { key: 'mailbox', label: '邮箱', passed: true, message: '邮箱可用' },
        { key: 'content', label: '正文', passed: false, message: '正文需复核' }
      ]
    });

    assert.deepEqual(
      getFailedSequenceMessages(item.messages).map(message => message.id),
      ['message-2', 'message-3']
    );
    assert.equal(getSequenceSendAuditSummary(item).label, '发送失败');
    assert.equal(getSequenceSendAuditSummary(item).failedMessageCount, 2);
    assert.equal(getSequenceSendAuditSummary(item).failedCheckCount, 1);
    assert.equal(getCurrentSequenceMessage(item)?.id, 'message-2');
  });

  it('describes checklist-only send audit warnings before sending', () => {
    const warning = createSequenceItem({
      checklist: [
        { key: 'mailbox', label: '邮箱', passed: true, message: '邮箱可用' },
        { key: 'risk', label: '风险', passed: false, message: '公共邮箱需确认' }
      ]
    });
    const passed = createSequenceItem({
      checklist: [{ key: 'mailbox', label: '邮箱', passed: true, message: '邮箱可用' }]
    });

    assert.equal(getSequenceSendAuditSummary(warning).label, '1 项待确认');
    assert.equal(getSequenceSendAuditSummary(warning).tagType, 'warning');
    assert.equal(getSequenceSendAuditSummary(passed).label, '1 项通过');
    assert.equal(getSequenceSendAuditSummary(passed).tagType, 'success');
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
    const canGenerateNext = createSequenceItem({
      firstMessage: createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
      messages: [createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' })],
      enrollment: { status: 'sequence_running', totalSteps: 5 }
    });
    const reachedLastStep = createSequenceItem({
      firstMessage: createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
      messages: [
        createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
        createMessage({ id: 'message-5', stepIndex: 5, status: 'sent' })
      ],
      enrollment: { status: 'sequence_running', totalSteps: 5 }
    });

    assert.equal(getCurrentSequenceMessage(pending)?.id, 'message-2');
    assert.equal(getSequenceNextAction(pending).label, '审核草稿');
    assert.equal(getSequenceNextAction(ready).label, '启动首封');
    assert.equal(getSequenceNextAction(failed).label, '处理失败');
    assert.equal(getSequenceNextAction(canGenerateNext).label, '生成下一封');
    assert.equal(getSequenceNextAction(canGenerateNext).buttonLabel, '生成');
    assert.equal(getSequenceNextAction(reachedLastStep).label, '已到最后一封');
    assert.equal(getSequenceNextAction(replied).description, '同公司当前序列已停发');
  });

  it('gets the largest sequence message step from existing messages', () => {
    assert.equal(
      getMaxSequenceMessageStep([
        createMessage({ id: 'message-1', stepIndex: 1 }),
        createMessage({ id: 'message-3', stepIndex: 3 }),
        createMessage({ id: 'message-2', stepIndex: 2 })
      ]),
      3
    );
    assert.equal(getMaxSequenceMessageStep([]), 0);
  });

  it('allows generating the next draft only while the sequence can accept another review draft', () => {
    const ready = createSequenceItem({
      enrollment: { status: 'ready_to_send', totalSteps: 5 },
      messages: [
        createMessage({ id: 'message-1', stepIndex: 1, status: 'draft_ready' }),
        createMessage({ id: 'message-2', stepIndex: 2, status: 'sent' })
      ]
    });
    const running = createSequenceItem({
      enrollment: { status: 'sequence_running', totalSteps: 5 },
      messages: [
        createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
        createMessage({ id: 'message-2', stepIndex: 2, status: 'sent' })
      ]
    });
    const hasPendingDraft = createSequenceItem({
      enrollment: { status: 'sequence_running', totalSteps: 5 },
      messages: [
        createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
        createMessage({ id: 'message-2', stepIndex: 2, status: 'draft_pending_review' })
      ]
    });
    const hasQueuedMessage = createSequenceItem({
      enrollment: { status: 'sequence_running', totalSteps: 5 },
      messages: [
        createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
        createMessage({ id: 'message-2', stepIndex: 2, status: 'queued' })
      ]
    });
    const hasFailedMessage = createSequenceItem({
      enrollment: { status: 'sequence_running', totalSteps: 5 },
      messages: [
        createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
        createMessage({ id: 'message-2', stepIndex: 2, status: 'failed' })
      ]
    });
    const reachedLastStep = createSequenceItem({
      enrollment: { status: 'sequence_running', totalSteps: 2 },
      messages: [
        createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
        createMessage({ id: 'message-2', stepIndex: 2, status: 'sent' })
      ]
    });
    const stopped = createSequenceItem({
      enrollment: { status: 'stopped', totalSteps: 5 },
      messages: [createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' })]
    });
    const forbidden = createSequenceItem({
      enrollment: { status: 'sequence_running', totalSteps: 5 },
      messages: [createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' })]
    });
    forbidden.canOperateDraft = false;

    assert.equal(canGenerateNextSequenceDraft(ready), true);
    assert.equal(canGenerateNextSequenceDraft(running), true);
    assert.equal(canGenerateNextSequenceDraft(hasPendingDraft), false);
    assert.equal(canGenerateNextSequenceDraft(hasQueuedMessage), false);
    assert.equal(canGenerateNextSequenceDraft(hasFailedMessage), false);
    assert.equal(canGenerateNextSequenceDraft(reachedLastStep), false);
    assert.equal(canGenerateNextSequenceDraft(stopped), false);
    assert.equal(canGenerateNextSequenceDraft(forbidden), false);
  });

  it('summarizes selected rows for owner-only batch actions', () => {
    const generateReady = createSequenceItem({
      enrollment: { id: 'enrollment-1', status: 'sequence_running', totalSteps: 5 },
      messages: [createMessage({ id: 'message-1', status: 'sent', stepIndex: 1 })]
    });
    const stoppable = createSequenceItem({
      enrollment: { id: 'enrollment-2', status: 'paused' },
      messages: [createMessage({ id: 'message-2', enrollmentId: 'enrollment-2', status: 'queued' })]
    });
    const adminVisibleMember = createSequenceItem({
      enrollment: { id: 'enrollment-3', status: 'sequence_running' },
      messages: [createMessage({ id: 'message-3', enrollmentId: 'enrollment-3', status: 'sent' })]
    });
    adminVisibleMember.canOperateDraft = false;
    adminVisibleMember.canControlSequence = true;
    const terminal = createSequenceItem({
      enrollment: { id: 'enrollment-4', status: 'stopped' },
      messages: [createMessage({ id: 'message-4', enrollmentId: 'enrollment-4', status: 'sent' })]
    });

    assert.equal(canStopSequenceInBatch(stoppable), true);
    assert.equal(canStopSequenceInBatch(adminVisibleMember), false);
    assert.equal(canStopSequenceInBatch(terminal), false);
    assert.deepEqual(summarizeSequenceBatchSelection([generateReady, stoppable, adminVisibleMember, terminal]), {
      selectedCount: 4,
      generateNextDraftCount: 1,
      stopCount: 2,
      skippedCount: 2
    });
  });

  it('builds policy review hints for blocked links and manual-only sending', () => {
    const item = createSequenceItem() as Api.Crm.SequenceReviewItem & { policy: Api.Crm.SequencePolicyRecord };
    item.policy = createSequencePolicy({
      linkPolicy: 'block_new_links',
      allowLowRiskAutoSend: false
    });

    const hints = buildSequencePolicyReviewHints(item, createMessage({ bodyText: 'See https://example.com' }));

    assert.deepEqual(
      hints.map(hint => [hint.label, hint.tagType]),
      [
        ['链接策略', 'warning'],
        ['自动发送', 'default']
      ]
    );
    assert.match(hints[0].description, /阻止新增链接/);
    assert.match(hints[0].description, /仍包含链接/);
    assert.match(hints[1].description, /只能人工确认/);
  });
});
