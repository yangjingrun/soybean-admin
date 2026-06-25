import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDraftReviewOperationPayload,
  buildDraftVersionDiffSummary,
  buildDraftVersionListItems,
  buildAiDraftFactRows,
  buildAiDraftPromptSnapshotRows,
  buildAiDraftReviewTags,
  buildAiDraftSummaryRows,
  buildSequenceExportCsv,
  buildSequenceMessageTimelineItems,
  buildSequenceReviewSearchParams,
  buildSequencePolicyReviewHints,
  createDefaultSequenceCreateForm,
  createDefaultSequenceFilterModel,
  getCurrentSequenceMessage,
  getDefaultSequenceReviewMessageId,
  getFailedSequenceMessages,
  getMaxSequenceMessageStep,
  getMessageStatusView,
  getNextScheduledReviewMessage,
  getPendingReviewMessage,
  getSequenceChecklistSummary,
  getSequenceNextAction,
  getSequenceProgressText,
  getSequenceSendAuditSummary,
  isFirstOutreachGenerating,
  shouldQueueFirstMessageAfterApproval,
  buildSequenceBatchResultDisplayItems,
  buildSequenceBatchResultDisplayMap,
  buildSequenceReviewFilterTags,
  formatSequenceBatchResultText,
  canGenerateNextSequenceDraft,
  canRegenerateAiDraft,
  canOperateSelectedSequenceDraft,
  canApproveSequenceDraftInBatch,
  canCreateAiDraftTaskForSequence,
  canStopSequenceInBatch,
  getStoppableSequenceIds,
  isDraftBlockedBySequencePolicy,
  messageStatusLabelMap,
  sequencePageGuide,
  sequenceStatusLabelMap,
  sequenceTodoTypeOptions,
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
      city: null,
      address: null,
      customerType: null,
      status: 'manual_review_pending',
      sourceTaskId: null,
      archivedAt: null,
      archiveReason: null,
      archiveSlimmedAt: null,
      createdAt: '2026-06-19T01:00:00.000Z',
      updatedAt: '2026-06-19T01:00:00.000Z',
      contactCount: 0,
      primaryContact: null
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
      emailProgressStatus: 'not_generated',
      emailProgressLabel: '首封待生成',
      emailProgressAt: null,
      emailProgressMessageId: null,
      emailProgressStepIndex: null,
      emailProgressTotalSteps: null,
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
    personaMatch: {
      persona: null,
      matchMethod: 'none',
      matchedKeywords: [],
      fallbackReason: null
    },
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

function createSequencePolicy(overrides: Partial<Api.Crm.SequencePolicyRecord> = {}): Api.Crm.SequencePolicyRecord {
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

function createAiDraftMetadata(): Api.Crm.AiDraftMetadata {
  return {
    generated: true,
    reason: 'Focused on sourcing.',
    riskNotes: ['产品交期未配置'],
    snapshot: {
      productLineId: 'line-1',
      productLineName: 'Bearings',
      stepIndex: 1,
      writingConfig: {
        enabled: true,
        steps: [1, 2, 3, 4, 5].map(stepIndex => ({
          stepIndex: stepIndex as Api.Crm.AiWritingStepIndex,
          prompt: `Step ${stepIndex}`
        }))
      },
      reason: 'Focused on sourcing.',
      riskNotes: ['产品交期未配置'],
      selectedModules: [
        {
          promptKey: 'crm_outreach_base_rules',
          title: 'Base rules',
          reason: 'Required'
        }
      ],
      publicFacts: [{ id: 'account.name', label: 'Account name', value: 'ABC Trading', source: 'account' }],
      usedFacts: ['account.name'],
      nextReviewHints: ['确认职位'],
      qualityFlags: ['主题可再缩短'],
      polishChanges: ['删除模板开头'],
      generatedAt: '2026-06-24T00:00:00.000Z'
    }
  };
}

describe('email sequence review shared helpers', () => {
  it('builds a CSV export with customer info and five sequence email slots', () => {
    const item = createSequenceItem({
      enrollment: { status: 'sequence_running', createdAt: '2026-06-19T01:00:00.000Z' },
      messages: [
        createMessage({
          stepIndex: 1,
          status: 'sent',
          subject: 'First outreach',
          bodyText: 'Hello Ali',
          sentAt: '2026-06-19T02:00:00.000Z'
        }),
        createMessage({
          stepIndex: 5,
          status: 'draft_ready',
          subject: 'Follow "up", please',
          bodyText: 'Line 1\nLine 2',
          scheduledAt: '2026-06-26T02:00:00.000Z'
        })
      ]
    });

    const csv = buildSequenceExportCsv([item]);

    assert.match(csv, /^"客户名称","客户域名"/);
    assert.match(csv, /"第 5 封状态","第 5 封主题","第 5 封正文"/);
    assert.match(csv, /"ABC","abc\.example"/);
    assert.match(csv, /"已发送","First outreach","Hello Ali"/);
    assert.match(csv, /"等待发送","Follow ""up"", please","Line 1\nLine 2"/);
  });

  it('builds AI draft rows for selected modules, facts, review hints and quality flags', () => {
    const aiDraft = createAiDraftMetadata();

    assert.deepEqual(buildAiDraftSummaryRows(aiDraft), [
      { key: 'product-line', label: '产品线', value: 'Bearings' },
      { key: 'step', label: 'Step', value: '第 1 封' },
      { key: 'generated-at', label: '生成时间', value: '2026-06-24 08:00:00' },
      { key: 'reason', label: '生成说明', value: 'Focused on sourcing.' }
    ]);
    assert.deepEqual(buildAiDraftReviewTags(aiDraft), [
      { key: 'risk-0-产品交期未配置', label: '风险：产品交期未配置', type: 'warning' },
      { key: 'quality-0-主题可再缩短', label: '质量：主题可再缩短', type: 'warning' }
    ]);
    assert.deepEqual(
      buildAiDraftPromptSnapshotRows(aiDraft).map(row => row.key),
      [
        'step-prompt',
        'selected-modules',
        'public-facts',
        'used-facts',
        'review-hints',
        'quality-flags',
        'polish-changes'
      ]
    );
  });

  it('builds AI draft step task and fact display rows', () => {
    const rows = buildAiDraftFactRows({
      generated: true,
      reason: 'Used company product fact.',
      riskNotes: ['客户地区信息缺失'],
      snapshot: {
        productLineId: 'line-1',
        productLineName: 'Bearings',
        stepIndex: 1,
        writingConfig: {
          enabled: true,
          steps: []
        },
        reason: 'Used company product fact.',
        riskNotes: ['客户地区信息缺失'],
        stepStrategy: {
          taskDescription: '建立相关性',
          newValue: '公司事实 + 职位价值',
          wordRange: { min: 50, max: 100 },
          requiredFactGroups: ['company_profile']
        },
        usedFacts: ['account.name', 'source_snapshot.website_product_fact'],
        qualityFlags: ['正文过长'],
        selectedModules: [],
        generatedAt: '2026-06-24T00:00:00.000Z'
      }
    });

    assert.ok(rows.some(row => row.label === '本封任务'));
    assert.ok(rows.some(row => row.label === '使用事实'));
    assert.ok(rows.some(row => row.value.includes('source_snapshot.website_product_fact')));
  });

  it('uses business wording for development email follow-up', () => {
    assert.equal(sequencePageGuide.title, '开发信任务承接可开发客户');
    assert.match(sequencePageGuide.description, /确认邮件内容/);
    assert.match(sequencePageGuide.description, /客户回信/);
    assert.equal(sequenceStatusLabelMap.draft_review_pending, '待确认发送');
    assert.equal(sequenceStatusLabelMap.ready_to_send, '等待发送');
    assert.equal(sequenceStatusLabelMap.sequence_running, '跟进中');
    assert.equal(sequenceStatusLabelMap.stopped, '已停止跟进');
    assert.equal(messageStatusLabelMap.draft_pending_review, '待确认发送');
    assert.equal(messageStatusLabelMap.queued, '发送中');
    assert.equal(sequenceTodoTypeOptions[0]?.label, '待确认发送');
  });

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

  it('labels placeholder first outreach sequences as background generation', () => {
    const item = createSequenceItem({
      firstMessage: null,
      messages: [],
      enrollment: { status: 'draft_review_pending' }
    });

    assert.equal(isFirstOutreachGenerating(item), true);
    assert.equal(getSequenceNextAction(item).label, '后台生成中');
    assert.equal(getSequenceSendAuditSummary(item).label, '后台生成中');
  });

  it('builds sequence review search params with status and todo filters', () => {
    const filterModel = createDefaultSequenceFilterModel();
    filterModel.keyword = ' ABC ';
    filterModel.currentStep = 2;
    filterModel.status = 'sequence_running';
    filterModel.todoType = 'can_generate_next';
    filterModel.messageStatus = 'sent';
    filterModel.dateScope = 'today';
    filterModel.createdAtScope = 'last_7_days';

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
        currentStep: 2,
        status: 'sequence_running',
        todoType: 'can_generate_next',
        messageStatus: 'sent',
        dateScope: 'today',
        createdAtScope: 'last_7_days'
      }
    );
    assert.equal(createDefaultSequenceFilterModel().currentStep, null);
    assert.equal(createDefaultSequenceFilterModel().todoType, null);
    assert.equal(createDefaultSequenceFilterModel().messageStatus, null);
    assert.equal(createDefaultSequenceFilterModel().createdAtScope, null);
  });

  it('builds user-facing filter tags for workbench route context', () => {
    const filterModel = createDefaultSequenceFilterModel();
    filterModel.keyword = ' ABC ';
    filterModel.currentStep = 3;
    filterModel.todoType = 'draft_review_pending';
    filterModel.messageStatus = 'sent';
    filterModel.dateScope = 'today';
    filterModel.createdAtScope = 'last_30_days';

    assert.deepEqual(buildSequenceReviewFilterTags(filterModel), [
      { key: 'keyword', label: '公司域名：ABC' },
      { key: 'currentStep', label: '跟进进度：第 3 封' },
      { key: 'todoType', label: '待办：待确认发送' },
      { key: 'messageStatus', label: '邮件：已发送' },
      { key: 'dateScope', label: '时间：今天' },
      { key: 'createdAtScope', label: '创建时间：最近一月' }
    ]);
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

  it('summarizes subject changed draft version diffs', () => {
    const summary = buildDraftVersionDiffSummary(
      {
        subject: 'Current subject',
        bodyText: 'Same body'
      },
      {
        subject: 'Saved subject',
        bodyText: 'Same body'
      }
    );

    assert.equal(summary.hasChanges, true);
    assert.equal(summary.changedFieldCount, 1);
    assert.equal(summary.addedLineCount, 0);
    assert.equal(summary.removedLineCount, 0);
    assert.equal(summary.changedLineCount, 1);
    assert.deepEqual(
      summary.fields.map(field => [field.key, field.changeType, field.summary]),
      [['subject', 'modified', '主题将从「Current subject」恢复为「Saved subject」']]
    );
    assert.equal(summary.summaryText, '将恢复 1 项：改 1 行');
  });

  it('summarizes body changed draft version diffs', () => {
    const summary = buildDraftVersionDiffSummary(
      {
        subject: 'Same subject',
        bodyText: ['Hi Ali,', 'Current offer', 'Regards'].join('\n')
      },
      {
        subject: 'Same subject',
        bodyText: ['Hi Ali,', 'Saved offer', 'Regards', 'Catalog attached'].join('\n')
      }
    );

    assert.equal(summary.hasChanges, true);
    assert.equal(summary.changedFieldCount, 1);
    assert.equal(summary.addedLineCount, 1);
    assert.equal(summary.removedLineCount, 0);
    assert.equal(summary.changedLineCount, 1);
    assert.deepEqual(summary.previewLines, ['正文：新增 1 行，改 1 行']);
    assert.equal(summary.summaryText, '将恢复 1 项：新增 1 行，改 1 行');
  });

  it('summarizes unchanged draft version diffs', () => {
    const summary = buildDraftVersionDiffSummary(
      {
        subject: 'Same subject',
        bodyText: 'Same body'
      },
      {
        subject: 'Same subject',
        bodyText: 'Same body'
      }
    );

    assert.equal(summary.hasChanges, false);
    assert.equal(summary.changedFieldCount, 0);
    assert.equal(summary.addedLineCount, 0);
    assert.equal(summary.removedLineCount, 0);
    assert.equal(summary.changedLineCount, 0);
    assert.deepEqual(summary.fields, []);
    assert.equal(summary.summaryText, '与当前草稿一致');
  });

  it('summarizes empty current draft version diffs', () => {
    const summary = buildDraftVersionDiffSummary(
      {
        subject: '',
        bodyText: ''
      },
      {
        subject: 'Saved subject',
        bodyText: ['Line one', 'Line two'].join('\n')
      }
    );

    assert.equal(summary.hasChanges, true);
    assert.equal(summary.changedFieldCount, 2);
    assert.equal(summary.addedLineCount, 3);
    assert.equal(summary.removedLineCount, 0);
    assert.equal(summary.changedLineCount, 0);
    assert.deepEqual(summary.previewLines, ['主题：新增 1 行', '正文：新增 2 行']);
    assert.equal(summary.summaryText, '将恢复 2 项：新增 3 行');
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

  it('uses the row current message as the default detail selection', () => {
    const item = createSequenceItem({
      firstMessage: createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
      messages: [
        createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
        createMessage({
          id: 'message-2',
          stepIndex: 2,
          status: 'draft_ready',
          scheduledAt: '2026-06-20T06:00:00.000Z'
        })
      ],
      enrollment: { status: 'sequence_running', currentStep: 2 }
    });

    assert.equal(getDefaultSequenceReviewMessageId(item), 'message-2');
  });

  it('displays scheduled ready running messages separately from queued messages', () => {
    const scheduledReady = createMessage({
      id: 'message-2',
      status: 'draft_ready',
      scheduledAt: '2026-06-20T06:00:00.000Z'
    });
    const queued = createMessage({
      id: 'message-3',
      status: 'queued',
      scheduledAt: '2026-06-20T07:00:00.000Z'
    });

    assert.deepEqual(getMessageStatusView(scheduledReady, 'sequence_running'), {
      label: '等待发送',
      tagType: 'warning'
    });
    assert.deepEqual(getMessageStatusView(queued, 'sequence_running'), {
      label: '发送中',
      tagType: 'info'
    });
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
        ['message-2', '第 2 封', '发送中', true],
        ['message-3', '第 3 封', '待确认发送', false]
      ]
    );
    assert.match(items[0].metaText, /^已发送 /);
    assert.match(items[1].metaText, /^将在 .* 自动发送$/);
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
    assert.match(getSequenceSendAuditSummary(item).description, /修改后再发送|直接重试/);
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

    assert.equal(getSequenceSendAuditSummary(warning).label, '1 项需确认');
    assert.equal(getSequenceSendAuditSummary(warning).tagType, 'warning');
    assert.equal(getSequenceSendAuditSummary(passed).label, '1 项通过');
    assert.equal(getSequenceSendAuditSummary(passed).tagType, 'success');
  });

  it('shows scheduled current follow-up instead of stale checklist warnings', () => {
    const item = createSequenceItem({
      firstMessage: createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
      messages: [
        createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
        createMessage({
          id: 'message-2',
          stepIndex: 2,
          status: 'draft_ready',
          scheduledAt: '2026-06-20T06:00:00.000Z'
        })
      ],
      enrollment: { status: 'sequence_running', currentStep: 2 },
      checklist: [
        { key: 'mailbox', label: '邮箱', passed: true, message: '邮箱可用' },
        { key: 'risk', label: '风险', passed: false, message: '公共邮箱需确认' }
      ]
    });

    assert.equal(getSequenceSendAuditSummary(item).label, '已排期');
    assert.equal(getSequenceSendAuditSummary(item).tagType, 'info');
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
    const scheduledRunning = createSequenceItem({
      firstMessage: createMessage({ status: 'sent' }),
      messages: [
        createMessage({ id: 'message-1', stepIndex: 1, status: 'sent' }),
        createMessage({
          id: 'message-2',
          stepIndex: 2,
          status: 'draft_ready',
          scheduledAt: '2026-06-20T06:00:00.000Z'
        })
      ],
      enrollment: { status: 'sequence_running', currentStep: 2 }
    });
    const replied = createSequenceItem({
      firstMessage: createMessage({ status: 'sent' }),
      messages: [createMessage({ status: 'sent' })],
      enrollment: { status: 'replied' }
    });
    const stopped = createSequenceItem({
      firstMessage: createMessage({ status: 'skipped' }),
      messages: [createMessage({ status: 'skipped' })],
      enrollment: { status: 'stopped' }
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
    assert.equal(getSequenceNextAction(pending).label, '确认发送');
    assert.equal(getSequenceNextAction(pending).buttonLabel, '确认发送');
    assert.equal(getSequenceNextAction(ready).label, '确认发送');
    assert.equal(getSequenceNextAction(ready).buttonLabel, '安排发送');
    assert.equal(getSequenceNextAction(failed).label, '修改后再发送');
    assert.equal(getSequenceNextAction(failed).buttonLabel, '处理');
    assert.equal(getSequenceNextAction(scheduledRunning).label, '等待发送');
    assert.equal(getSequenceNextAction(scheduledRunning).description, '已确认，等待系统按发送规则执行');
    assert.equal(getSequenceNextAction(stopped).label, '已停止，可恢复');
    assert.equal(getSequenceNextAction(stopped).buttonLabel, '恢复');
    assert.equal(getSequenceNextAction(canGenerateNext).label, '生成下一封');
    assert.equal(getSequenceNextAction(canGenerateNext).buttonLabel, '生成');
    assert.equal(getSequenceNextAction(reachedLastStep).label, '已到最后一封');
    assert.equal(getSequenceNextAction(replied).description, '同公司开发信已停止');
  });

  it('queues the first message immediately after approval when backend returns ready state', () => {
    assert.equal(
      shouldQueueFirstMessageAfterApproval(
        { status: 'ready_to_send' },
        createMessage({ stepIndex: 1, status: 'draft_ready' })
      ),
      true
    );
    assert.equal(
      shouldQueueFirstMessageAfterApproval(
        { status: 'sequence_running' },
        createMessage({ stepIndex: 2, status: 'draft_ready' })
      ),
      false
    );
    assert.equal(
      shouldQueueFirstMessageAfterApproval(
        { status: 'ready_to_send' },
        createMessage({ stepIndex: 1, status: 'queued' })
      ),
      false
    );
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

  it('allows regenerating one pending AI draft only when the current draft is still operable', () => {
    const aiEnabledProductLine = {
      id: 'product-line-1',
      organizationId: 'org-1',
      name: '轴承',
      targetCustomerType: null,
      coreSellingPoints: null,
      moq: null,
      leadTime: null,
      paymentTerms: null,
      certifications: null,
      catalogUrl: null,
      websiteUrl: null,
      commonModelsText: null,
      aiWritingConfig: {
        enabled: true,
        steps: [1, 2, 3, 4, 5].map(stepIndex => ({
          stepIndex: stepIndex as 1 | 2 | 3 | 4 | 5,
          prompt: `Step ${stepIndex}`
        }))
      },
      status: 'active',
      createdById: 'user-1',
      createdByName: 'Alice',
      createdAt: '2026-06-19T01:00:00.000Z',
      updatedAt: '2026-06-19T01:00:00.000Z'
    } satisfies Api.Crm.ProductLineRecord;
    const firstDraftPending = createSequenceItem({
      enrollment: { status: 'draft_review_pending' },
      messages: [createMessage({ id: 'message-1', stepIndex: 1, status: 'draft_pending_review' })]
    });
    const followUpPending = createSequenceItem({
      enrollment: { status: 'sequence_running' },
      messages: [createMessage({ id: 'message-2', stepIndex: 2, status: 'draft_pending_review' })]
    });
    const pausedFollowUp = createSequenceItem({
      enrollment: { status: 'paused' },
      messages: [createMessage({ id: 'message-3', stepIndex: 2, status: 'draft_pending_review' })]
    });
    const notAiDraft = createSequenceItem({
      messages: [createMessage({ id: 'message-4', stepIndex: 1, status: 'draft_pending_review' })]
    });
    const stoppedFirstDraft = createSequenceItem({
      enrollment: { status: 'stopped' },
      messages: [createMessage({ id: 'message-6', stepIndex: 1, status: 'draft_pending_review' })]
    });
    firstDraftPending.productLine = aiEnabledProductLine;
    followUpPending.productLine = aiEnabledProductLine;
    pausedFollowUp.productLine = aiEnabledProductLine;
    stoppedFirstDraft.productLine = aiEnabledProductLine;
    notAiDraft.productLine = {
      ...aiEnabledProductLine,
      aiWritingConfig: null
    };

    assert.equal(canRegenerateAiDraft(firstDraftPending, firstDraftPending.messages[0]), true);
    assert.equal(canRegenerateAiDraft(followUpPending, followUpPending.messages[0]), true);
    assert.equal(canRegenerateAiDraft(pausedFollowUp, pausedFollowUp.messages[0]), false);
    assert.equal(canRegenerateAiDraft(stoppedFirstDraft, stoppedFirstDraft.messages[0]), false);
    assert.equal(canRegenerateAiDraft(notAiDraft, notAiDraft.messages[0]), false);
    assert.equal(
      canRegenerateAiDraft(firstDraftPending, createMessage({ id: 'message-5', stepIndex: 1, status: 'sent' })),
      false
    );
  });

  it('allows detail modal draft operations only while the sequence status matches the selected draft step', () => {
    const firstDraftPending = createSequenceItem({
      enrollment: { status: 'draft_review_pending' },
      messages: [createMessage({ id: 'message-1', stepIndex: 1, status: 'draft_pending_review' })]
    });
    const readyFirstDraftPending = createSequenceItem({
      enrollment: { status: 'ready_to_send' },
      messages: [createMessage({ id: 'message-5', stepIndex: 1, status: 'draft_pending_review' })]
    });
    const stoppedFirstDraft = createSequenceItem({
      enrollment: { status: 'stopped' },
      messages: [createMessage({ id: 'message-2', stepIndex: 1, status: 'draft_pending_review' })]
    });
    const runningFollowUp = createSequenceItem({
      enrollment: { status: 'sequence_running' },
      messages: [createMessage({ id: 'message-3', stepIndex: 2, status: 'draft_pending_review' })]
    });
    const pausedFollowUp = createSequenceItem({
      enrollment: { status: 'paused' },
      messages: [createMessage({ id: 'message-4', stepIndex: 2, status: 'draft_pending_review' })]
    });

    assert.equal(canOperateSelectedSequenceDraft(firstDraftPending, firstDraftPending.messages[0]), true);
    assert.equal(canOperateSelectedSequenceDraft(readyFirstDraftPending, readyFirstDraftPending.messages[0]), true);
    assert.equal(canOperateSelectedSequenceDraft(stoppedFirstDraft, stoppedFirstDraft.messages[0]), false);
    assert.equal(canOperateSelectedSequenceDraft(runningFollowUp, runningFollowUp.messages[0]), true);
    assert.equal(canOperateSelectedSequenceDraft(pausedFollowUp, pausedFollowUp.messages[0]), false);
  });

  it('summarizes selected rows for owner-only batch actions', () => {
    const approvable = createSequenceItem({
      enrollment: { id: 'enrollment-0', status: 'draft_review_pending' },
      messages: [createMessage({ id: 'message-0', enrollmentId: 'enrollment-0', status: 'draft_pending_review' })]
    });
    const generateReady = createSequenceItem({
      enrollment: { id: 'enrollment-1', status: 'sequence_running', totalSteps: 5 },
      messages: [createMessage({ id: 'message-1', status: 'sent', stepIndex: 1 })]
    });
    generateReady.productLine = { aiWritingConfig: { enabled: true } } as Api.Crm.ProductLineRecord;
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

    assert.equal(canApproveSequenceDraftInBatch(approvable), true);
    assert.equal(canApproveSequenceDraftInBatch(adminVisibleMember), false);
    assert.equal(canApproveSequenceDraftInBatch(terminal), false);
    assert.equal(canCreateAiDraftTaskForSequence(generateReady), true);
    assert.equal(canCreateAiDraftTaskForSequence(stoppable), false);
    assert.equal(canStopSequenceInBatch(stoppable), true);
    assert.equal(canStopSequenceInBatch(adminVisibleMember), false);
    assert.equal(canStopSequenceInBatch(terminal), false);
    assert.deepEqual(
      summarizeSequenceBatchSelection([approvable, generateReady, stoppable, adminVisibleMember, terminal]),
      {
        selectedCount: 5,
        aiDraftTaskCount: 1,
        approveDraftCount: 1,
        generateNextDraftCount: 1,
        stopCount: 3,
        skippedCount: 2
      }
    );
  });

  it('returns only owner-operable sequence ids for batch stop requests', () => {
    const stoppable = createSequenceItem({
      enrollment: { id: 'enrollment-stoppable', status: 'paused' },
      messages: [createMessage({ id: 'message-stoppable', enrollmentId: 'enrollment-stoppable', status: 'queued' })]
    });
    const adminVisibleMember = createSequenceItem({
      enrollment: { id: 'enrollment-admin-visible', status: 'sequence_running' },
      messages: [
        createMessage({ id: 'message-admin-visible', enrollmentId: 'enrollment-admin-visible', status: 'sent' })
      ]
    });
    adminVisibleMember.canOperateDraft = false;
    adminVisibleMember.canControlSequence = true;
    const terminal = createSequenceItem({
      enrollment: { id: 'enrollment-terminal', status: 'stopped' },
      messages: [createMessage({ id: 'message-terminal', enrollmentId: 'enrollment-terminal', status: 'sent' })]
    });

    assert.deepEqual(getStoppableSequenceIds([stoppable, adminVisibleMember, terminal]), ['enrollment-stoppable']);
  });

  it('blocks draft approval when link policy forbids remaining links', () => {
    const item = createSequenceItem({
      messages: [createMessage({ id: 'message-link', bodyText: 'Read https://example.com/catalog' })]
    }) as Api.Crm.SequenceReviewItem & { policy: Api.Crm.SequencePolicyRecord };
    item.policy = createSequencePolicy({ linkPolicy: 'block_new_links' });

    assert.equal(isDraftBlockedBySequencePolicy(item, item.messages[0]), true);
    assert.equal(canApproveSequenceDraftInBatch(item), false);
  });

  it('formats batch operation summary counts for toolbar messages', () => {
    const text = formatSequenceBatchResultText('批量生成下一封', {
      totalCount: 4,
      successCount: 1,
      skippedCount: 2,
      failedCount: 1,
      results: []
    });

    assert.equal(text, '批量生成下一封完成：成功 1 条，跳过 2 条，失败 1 条');
  });

  it('builds per-row batch result display items by enrollment id', () => {
    const displayItems = buildSequenceBatchResultDisplayItems({
      totalCount: 3,
      successCount: 1,
      skippedCount: 1,
      failedCount: 1,
      results: [
        {
          id: 'input-1',
          enrollmentId: 'enrollment-1',
          messageId: 'message-2',
          stepIndex: 2,
          status: 'success',
          message: '第 2 封开发信已生成'
        },
        {
          id: 'enrollment-2',
          status: 'skipped',
          message: '当前序列没有可生成的后续开发信'
        },
        {
          id: 'input-3',
          enrollmentId: 'enrollment-3',
          status: 'failed',
          message: 'AI 服务暂时不可用'
        }
      ]
    });

    assert.deepEqual(
      displayItems.map(item => ({
        enrollmentId: item.enrollmentId,
        message: item.message,
        statusLabel: item.statusLabel,
        stepText: item.stepText,
        tagType: item.tagType
      })),
      [
        {
          enrollmentId: 'enrollment-1',
          message: '第 2 封开发信已生成',
          statusLabel: '成功',
          stepText: '第 2 封',
          tagType: 'success'
        },
        {
          enrollmentId: 'enrollment-2',
          message: '当前序列没有可生成的后续开发信',
          statusLabel: '跳过',
          stepText: null,
          tagType: 'warning'
        },
        {
          enrollmentId: 'enrollment-3',
          message: 'AI 服务暂时不可用',
          statusLabel: '失败',
          stepText: null,
          tagType: 'error'
        }
      ]
    );

    const displayMap = buildSequenceBatchResultDisplayMap(displayItems);
    assert.equal(displayMap.get('enrollment-1')?.message, '第 2 封开发信已生成');
    assert.equal(displayMap.get('enrollment-2')?.statusLabel, '跳过');
    assert.equal(displayMap.get('enrollment-3')?.tagType, 'error');
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
