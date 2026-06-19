import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import dayjs from 'dayjs';
import {
  buildMailboxOperationDetailItems,
  buildOperationLogDetailItems,
  buildOperationQueueDetailItems,
  buildStrategyStatSections,
  buildOperationLogSummaryRows,
  buildCrmSettingsOverview,
  buildBlacklistSearchParams,
  buildEmailTemplateSearchParams,
  buildPersonaProfileSearchParams,
  buildSequencePolicySearchParams,
  buildProductLineAiPromptVersionDiffItems,
  collectOperationQueueRows,
  collectRecentCrmOperationLogs,
  createDefaultBlacklistFilterModel,
  createDefaultEmailTemplateFilterModel,
  createDefaultEmailTemplateForm,
  createDefaultFollowUpDelayDays,
  createDefaultGlobalConfigForm,
  createDefaultSendPreferenceForm,
  createDefaultPersonaProfileFilterModel,
  createDefaultPersonaProfileForm,
  createDefaultProductLineAiWritingConfig,
  createDefaultSequencePolicyFilterModel,
  createDefaultSequencePolicyForm,
  createEmailTemplateFormFromRecord,
  createPersonaProfileFormFromRecord,
  createSequencePolicyFormFromRecord,
  getProductLineAiWritingStatus,
  formatMailboxSyncActionLabel,
  isValidEmailVerificationCooldownDays,
  isValidFollowUpDelayDays,
  isValidDailySendLimit,
  isValidFollowUpSharePercent,
  isValidOwnerConcurrentSendLimit,
  isValidOwnerDailySendLimitMax,
  normalizeEmailTemplatePayload,
  normalizePersonaProfilePayload,
  normalizeProductLineAiWritingConfig,
  normalizeSequencePolicyPayload,
  summarizeProductLineAiWritingConfig,
  validateProductLineAiWritingConfig,
  summarizeMailboxSyncHealth
} from './shared';

describe('crm settings shared helpers', () => {
  it('creates the platform global config form with the documented cooldown default', () => {
    assert.deepEqual(createDefaultGlobalConfigForm(), {
      emailVerificationCooldownDays: 30,
      ownerConcurrentSendLimit: 5,
      ownerDailySendLimitMax: 200,
      followUpDelayDays: {
        step2Days: 3,
        step3Days: 7,
        step4Days: 14,
        step5Days: 21
      }
    });
  });

  it('creates and validates current-owner send preference form values', () => {
    assert.deepEqual(createDefaultSendPreferenceForm(), {
      dailySendLimit: 50,
      followUpSharePercent: 70,
      ownerDailySendLimitMax: 200
    });
    assert.equal(isValidDailySendLimit(1, 200), true);
    assert.equal(isValidDailySendLimit(200, 200), true);
    assert.equal(isValidDailySendLimit(201, 200), false);
    assert.equal(isValidDailySendLimit(50.5, 200), false);
    assert.equal(isValidFollowUpSharePercent(0), true);
    assert.equal(isValidFollowUpSharePercent(100), true);
    assert.equal(isValidFollowUpSharePercent(101), false);
    assert.equal(isValidFollowUpSharePercent(null), false);
  });

  it('validates follow-up delay days for sequence policy config', () => {
    assert.deepEqual(createDefaultFollowUpDelayDays(), {
      step2Days: 3,
      step3Days: 7,
      step4Days: 14,
      step5Days: 21
    });
    assert.equal(isValidFollowUpDelayDays({ step2Days: 1, step3Days: 7, step4Days: 14, step5Days: 90 }), true);
    assert.equal(isValidFollowUpDelayDays({ step2Days: 0, step3Days: 7, step4Days: 14, step5Days: 21 }), false);
    assert.equal(isValidFollowUpDelayDays({ step2Days: 3, step3Days: 7.5, step4Days: 14, step5Days: 21 }), false);
    assert.equal(isValidFollowUpDelayDays({ step2Days: 3, step3Days: 7, step4Days: 14, step5Days: 91 }), false);
  });

  it('accepts only integer email verification cooldown days in the supported range', () => {
    assert.equal(isValidEmailVerificationCooldownDays(1), true);
    assert.equal(isValidEmailVerificationCooldownDays(365), true);
    assert.equal(isValidEmailVerificationCooldownDays(0), false);
    assert.equal(isValidEmailVerificationCooldownDays(366), false);
    assert.equal(isValidEmailVerificationCooldownDays(30.5), false);
    assert.equal(isValidEmailVerificationCooldownDays(null), false);
  });

  it('accepts only integer owner concurrent send limits in the supported range', () => {
    assert.equal(isValidOwnerConcurrentSendLimit(1), true);
    assert.equal(isValidOwnerConcurrentSendLimit(100), true);
    assert.equal(isValidOwnerConcurrentSendLimit(0), false);
    assert.equal(isValidOwnerConcurrentSendLimit(101), false);
    assert.equal(isValidOwnerConcurrentSendLimit(5.5), false);
    assert.equal(isValidOwnerConcurrentSendLimit(null), false);
  });

  it('accepts only positive integer owner daily send hard limits', () => {
    assert.equal(isValidOwnerDailySendLimitMax(1), true);
    assert.equal(isValidOwnerDailySendLimitMax(200), true);
    assert.equal(isValidOwnerDailySendLimitMax(0), false);
    assert.equal(isValidOwnerDailySendLimitMax(20.5), false);
    assert.equal(isValidOwnerDailySendLimitMax(null), false);
  });

  it('builds blacklist search params from trimmed keyword filters', () => {
    assert.deepEqual(createDefaultBlacklistFilterModel(), {
      keyword: ''
    });
    assert.deepEqual(
      buildBlacklistSearchParams({
        current: 1,
        size: 20,
        filterModel: { keyword: '  alice  ' }
      }),
      {
        current: 1,
        size: 20,
        keyword: 'alice'
      }
    );
  });

  it('creates and normalizes email template forms with five steps', () => {
    const form = createDefaultEmailTemplateForm();
    form.name = '  Distributor sequence  ';
    form.description = '  First touch  ';
    form.steps[0].subjectTemplate = '  Hello {{account.name}}  ';
    form.steps[0].bodyTemplate = '  Hi {{contact.name}}  ';

    assert.equal(form.steps.length, 5);
    assert.deepEqual(createDefaultEmailTemplateFilterModel(), {
      keyword: '',
      status: null
    });
    assert.deepEqual(
      buildEmailTemplateSearchParams({
        current: 1,
        size: 10,
        filterModel: { keyword: '  distributor  ', status: 'active' }
      }),
      {
        current: 1,
        size: 10,
        keyword: 'distributor',
        status: 'active'
      }
    );
    assert.equal(normalizeEmailTemplatePayload(form).name, 'Distributor sequence');
    assert.equal(normalizeEmailTemplatePayload(form).steps[0].subjectTemplate, 'Hello {{account.name}}');
    assert.equal(createEmailTemplateFormFromRecord(createEmailTemplateGroup()).steps[0].bodyTemplate, 'Body 1');
  });

  it('creates default product line form with disabled five-step AI writing config', () => {
    const config = createDefaultProductLineAiWritingConfig();

    assert.equal(config.enabled, false);
    assert.equal(config.steps.length, 5);
    assert.deepEqual(
      config.steps.map(step => step.stepIndex),
      [1, 2, 3, 4, 5]
    );
  });

  it('normalizes enabled product line AI writing config with five trimmed step prompts', () => {
    const config = createDefaultProductLineAiWritingConfig();
    config.enabled = true;
    config.commonRequirements = '  Natural English  ';
    config.forbiddenClaims = '  No fake certificates  ';
    config.productEmphasis = '  Stock models  ';
    config.steps[0].prompt = '  Step 1  ';
    config.steps[1].prompt = '  Step 2  ';
    config.steps[2].prompt = '  Step 3  ';
    config.steps[3].prompt = '  Step 4  ';
    config.steps[4].prompt = '  Step 5  ';

    const normalized = normalizeProductLineAiWritingConfig(config);

    assert.equal(normalized?.commonRequirements, 'Natural English');
    assert.equal(normalized?.steps[4].prompt, 'Step 5');
    assert.equal(validateProductLineAiWritingConfig(config), null);
  });

  it('rejects enabled product line AI writing config with empty step prompt', () => {
    const config = createDefaultProductLineAiWritingConfig();
    config.enabled = true;
    config.commonRequirements = 'Natural English';
    config.forbiddenClaims = 'No fake certificates';
    config.productEmphasis = 'Stock models';
    config.steps.forEach(step => {
      step.prompt = `Step ${step.stepIndex}`;
    });
    config.steps[2].prompt = '';

    assert.equal(validateProductLineAiWritingConfig(config), '请填写第 3 封 AI 写信提示词');
  });

  it('labels product line AI writing status for sequence creation hints', () => {
    const disabledConfig = createDefaultProductLineAiWritingConfig();
    const enabledConfig = createDefaultProductLineAiWritingConfig();
    enabledConfig.enabled = true;
    enabledConfig.commonRequirements = 'Natural English';
    enabledConfig.forbiddenClaims = 'No fake certificates';
    enabledConfig.productEmphasis = 'Stock models';
    enabledConfig.steps.forEach(step => {
      step.prompt = `Step ${step.stepIndex}`;
    });
    const incompleteConfig = createDefaultProductLineAiWritingConfig();
    incompleteConfig.enabled = true;
    incompleteConfig.commonRequirements = 'Natural English';
    incompleteConfig.forbiddenClaims = 'No fake certificates';
    incompleteConfig.productEmphasis = 'Stock models';

    assert.deepEqual(getProductLineAiWritingStatus(enabledConfig), {
      key: 'enabled',
      label: '已开启 AI 写信',
      tagType: 'success'
    });
    assert.deepEqual(getProductLineAiWritingStatus(disabledConfig), {
      key: 'disabled',
      label: '未开启 AI 写信',
      tagType: 'default'
    });
    assert.deepEqual(getProductLineAiWritingStatus(incompleteConfig), {
      key: 'incomplete',
      label: '配置不完整',
      tagType: 'warning'
    });
    assert.equal(getProductLineAiWritingStatus(null).label, '配置不完整');
  });

  it('summarizes product line AI writing config for prompt version history', () => {
    const config = createEnabledAiWritingConfig();
    config.commonRequirements = '  Natural English  ';
    config.steps[1].prompt = '  Follow up with inventory models  ';

    assert.deepEqual(summarizeProductLineAiWritingConfig(config), {
      enabledLabel: '已开启',
      commonRequirements: 'Natural English',
      forbiddenClaims: 'No fake certificates',
      productEmphasis: 'Stock models',
      steps: [
        { stepIndex: 1, prompt: 'Step 1', preview: 'Step 1' },
        { stepIndex: 2, prompt: 'Follow up with inventory models', preview: 'Follow up with inventory models' },
        { stepIndex: 3, prompt: 'Step 3', preview: 'Step 3' },
        { stepIndex: 4, prompt: 'Step 4', preview: 'Step 4' },
        { stepIndex: 5, prompt: 'Step 5', preview: 'Step 5' }
      ]
    });
  });

  it('builds prompt version diff items against the current form config', () => {
    const versionConfig = createEnabledAiWritingConfig();
    const currentConfig = createEnabledAiWritingConfig();
    currentConfig.commonRequirements = 'Short and direct';
    currentConfig.steps[1].prompt = 'Mention attached catalog';

    assert.deepEqual(buildProductLineAiPromptVersionDiffItems(versionConfig, currentConfig), [
      {
        key: 'commonRequirements',
        label: '通用要求',
        versionValue: 'Natural English',
        currentValue: 'Short and direct'
      },
      {
        key: 'step-2',
        label: '第 2 封 Prompt',
        versionValue: 'Step 2',
        currentValue: 'Mention attached catalog'
      }
    ]);
  });

  it('creates and normalizes sequence policy forms with five steps', () => {
    const form = createDefaultSequencePolicyForm();
    form.name = '  Conservative follow-up  ';
    form.description = '  Manual review first  ';
    form.isDefault = true;
    form.steps[1].delayDays = 2;
    form.steps[2].threadMode = 'same_thread';

    assert.deepEqual(createDefaultSequencePolicyFilterModel(), {
      keyword: '',
      status: null
    });
    assert.deepEqual(
      buildSequencePolicySearchParams({
        current: 2,
        size: 20,
        filterModel: { keyword: '  follow  ', status: 'active' }
      }),
      {
        current: 2,
        size: 20,
        keyword: 'follow',
        status: 'active'
      }
    );
    assert.equal(form.steps.length, 5);
    assert.equal(form.steps[0].delayDays, 0);
    assert.equal(form.steps[1].threadMode, 'same_thread');
    assert.equal(normalizeSequencePolicyPayload(form).name, 'Conservative follow-up');
    assert.equal(normalizeSequencePolicyPayload(form).steps[0].delayDays, 0);
    assert.equal(normalizeSequencePolicyPayload(form).steps[1].delayDays, 2);
    assert.equal(normalizeSequencePolicyPayload(form).steps[2].threadMode, 'same_thread');
    assert.equal(createSequencePolicyFormFromRecord(createSequencePolicy()).linkPolicy, 'block_new_links');
  });

  it('creates and normalizes persona profile forms for organization settings', () => {
    const form = createDefaultPersonaProfileForm();
    form.name = '  Procurement lead  ';
    form.description = '  Distributor buyer profile  ';
    form.titleKeywordsText = '  procurement\nbuyer  ';
    form.customerTypeKeywordsText = '  distributor  ';
    form.painPoints = '  price volatility  ';
    form.focusText = '  MOQ and lead time  ';
    form.avoidText = '  avoid overpromising delivery dates  ';

    assert.deepEqual(createDefaultPersonaProfileFilterModel(), {
      keyword: '',
      status: null
    });
    assert.deepEqual(
      buildPersonaProfileSearchParams({
        current: 1,
        size: 10,
        filterModel: { keyword: '  procurement  ', status: 'active' }
      }),
      {
        current: 1,
        size: 10,
        keyword: 'procurement',
        status: 'active'
      }
    );
    assert.deepEqual(normalizePersonaProfilePayload(form), {
      name: 'Procurement lead',
      description: 'Distributor buyer profile',
      titleKeywordsText: 'procurement\nbuyer',
      customerTypeKeywordsText: 'distributor',
      painPoints: 'price volatility',
      focusText: 'MOQ and lead time',
      avoidText: 'avoid overpromising delivery dates',
      isDefault: false
    });
    assert.equal(createPersonaProfileFormFromRecord(createPersonaProfile()).focusText, 'MOQ and lead time');
  });

  it('collects scheduled, queued and failed messages for the operations queue', () => {
    const rows = collectOperationQueueRows([
      createSequenceReviewItem({
        accountName: 'Acme',
        contactEmail: 'buyer@example.com',
        messages: [
          createMessage({ id: 'msg-draft', status: 'draft_ready', updatedAt: '2026-06-18T00:00:00.000Z' }),
          createMessage({ id: 'msg-queued', status: 'queued', updatedAt: '2026-06-18T01:00:00.000Z' })
        ]
      }),
      createSequenceReviewItem({
        accountName: 'Beta',
        contactEmail: 'owner@example.com',
        messages: [createMessage({ id: 'msg-failed', status: 'failed', updatedAt: '2026-06-18T02:00:00.000Z' })]
      }),
      createSequenceReviewItem({
        accountName: 'Delta',
        contactEmail: 'ops@example.com',
        enrollmentStatus: 'sequence_running',
        messages: [
          createMessage({
            id: 'msg-scheduled',
            scheduledAt: '2026-06-20T02:00:00.000Z',
            status: 'draft_ready',
            updatedAt: '2026-06-18T03:00:00.000Z'
          })
        ]
      })
    ]);

    assert.deepEqual(
      rows.map(row => ({ accountName: row.accountName, id: row.id, status: row.status })),
      [
        { accountName: 'Beta', id: 'msg-failed', status: 'failed' },
        { accountName: 'Acme', id: 'msg-queued', status: 'queued' },
        { accountName: 'Delta', id: 'msg-scheduled', status: 'scheduled' }
      ]
    );
  });

  it('builds top local strategy stat sections for CRM settings', () => {
    const sections = buildStrategyStatSections({
      generatedAt: '2026-06-20T08:00:00.000Z',
      rows: {
        template: [
          createStrategyStatRow({
            dimension: 'template',
            key: 'default_template',
            name: '默认模板',
            sequenceCount: 3,
            draftPendingCount: 1
          })
        ],
        policy: [
          createStrategyStatRow({
            dimension: 'policy',
            key: 'policy-fast',
            name: '快速跟进',
            queuedCount: 2
          })
        ],
        persona: [],
        productLine: [
          createStrategyStatRow({
            dimension: 'productLine',
            key: 'line-bearing',
            name: '轴承',
            sentCount: 4
          })
        ]
      }
    });

    assert.deepEqual(
      sections.map(section => [section.key, section.title, section.empty, section.rows[0]?.sequenceCount ?? 0]),
      [
        ['template', '模板效果', false, 3],
        ['policy', '策略效果', false, 0],
        ['persona', '画像效果', true, 0],
        ['productLine', '产品线效果', false, 0]
      ]
    );
    assert.equal(sections[1].rows[0].queuedCount, 2);
    assert.equal(sections[3].rows[0].sentCount, 4);
  });

  it('builds queue operation detail rows without exposing message body', () => {
    const row = collectOperationQueueRows([
      createSequenceReviewItem({
        accountName: 'Acme',
        contactEmail: 'buyer@example.com',
        messages: [
          createMessage({
            bullJobId: 'job-42',
            id: 'msg-failed',
            providerThreadId: 'gmail-thread-1',
            status: 'failed',
            subject: 'Bearing Series',
            updatedAt: '2026-06-18T02:00:00.000Z'
          })
        ]
      })
    ])[0];

    assert.deepEqual(buildOperationQueueDetailItems(row), [
      { label: '状态', value: '发送失败' },
      { label: '客户', value: 'Acme' },
      { label: '联系人', value: 'buyer@example.com' },
      { label: '发送邮箱', value: 'm***@example.com' },
      { label: '邮件主题', value: 'Bearing Series' },
      { label: '步骤', value: '第 1 封' },
      { label: '线程方式', value: '新主题' },
      { label: '队列 Job', value: 'job-42' },
      { label: '运行版本', value: 'run v3' },
      { label: 'Gmail Thread', value: 'gmail-thread-1' },
      { label: '计划发送', value: '-' },
      { label: '实际发送', value: '-' },
      { label: '更新时间', value: '2026-06-18 10:00:00' }
    ]);
  });

  it('builds mailbox operation detail rows for sync issue triage', () => {
    const mailbox = createMailbox({
      id: 'mailbox-history-expired',
      lastHistoryId: '1234567890',
      lastSyncIssue: {
        happenedAt: '2026-06-19T08:00:00.000Z',
        message: 'Gmail History checkpoint 已过期，需要人工处理',
        type: 'history_expired'
      },
      maskedEmail: 'a***@gmail.com',
      ownerUserName: 'Alice',
      watchExpiration: null
    });

    assert.deepEqual(buildMailboxOperationDetailItems(mailbox, dayjs('2026-06-19T12:00:00.000Z')), [
      { label: '邮箱', value: 'a***@gmail.com' },
      { label: '负责人', value: 'Alice' },
      { label: '授权状态', value: '启用' },
      { label: 'Gmail watch', value: '未开启' },
      { label: 'Watch 到期', value: '暂无 watch 到期时间' },
      { label: 'History checkpoint', value: '...34567890' },
      { label: '同步问题', value: 'Gmail History checkpoint 已过期，需要人工处理' },
      { label: '问题时间', value: '2026-06-19 16:00:00' },
      { label: '更新时间', value: '-' }
    ]);
  });

  it('collects recent CRM operation logs and builds detail rows', () => {
    const records = [
      createSystemLog({
        id: 'log-old',
        action: 'gmail-watch-renew',
        createdAt: '2026-06-18T08:00:00.000Z',
        module: 'crm'
      }),
      createSystemLog({
        id: 'log-auth',
        action: 'login',
        createdAt: '2026-06-19T09:00:00.000Z',
        module: 'auth'
      }),
      createSystemLog({
        id: 'log-new',
        action: 'gmail-history-expired',
        createdAt: '2026-06-19T10:00:00.000Z',
        errorMessage: 'checkpoint expired',
        level: 'warn',
        status: 'failed',
        metadata: {
          mailboxId: 'mailbox-1',
          maskedEmail: 'a***@gmail.com'
        },
        module: 'crm'
      })
    ];

    const rows = collectRecentCrmOperationLogs(records);

    assert.deepEqual(
      rows.map(row => row.id),
      ['log-new', 'log-old']
    );
    assert.deepEqual(buildOperationLogDetailItems(rows[0]), [
      { label: '等级', value: '警告' },
      { label: '状态', value: '失败' },
      { label: '模块', value: 'crm' },
      { label: '动作', value: 'gmail-history-expired' },
      { label: '摘要', value: 'CRM operation' },
      { label: '操作人', value: 'Alice' },
      { label: '错误', value: 'checkpoint expired' },
      { label: 'Metadata', value: '{\n  "mailboxId": "mailbox-1",\n  "maskedEmail": "a***@gmail.com"\n}' },
      { label: '时间', value: '2026-06-19 18:00:00' }
    ]);
  });

  it('builds webhook history watch and send operation summaries from existing data', () => {
    const rows = buildOperationLogSummaryRows({
      logs: [
        createSystemLog({
          id: 'log-webhook',
          action: 'gmail-pubsub-webhook',
          createdAt: '2026-06-19T09:00:00.000Z',
          message: 'Pub/Sub push 已入队',
          metadata: {
            jobId: 'history-job-1',
            maskedEmail: 'w***@gmail.com',
            pubsubMessageId: 'pubsub-1'
          }
        }),
        createSystemLog({
          id: 'log-history',
          action: 'gmail-history-expired',
          createdAt: '2026-06-19T10:00:00.000Z',
          errorMessage: 'checkpoint expired',
          level: 'warn',
          status: 'failed',
          metadata: {
            maskedEmail: 'h***@gmail.com',
            pubsubMessageId: 'pubsub-2'
          }
        }),
        createSystemLog({
          id: 'log-watch',
          action: 'gmail-watch-auto-renew-failed',
          createdAt: '2026-06-19T11:00:00.000Z',
          errorMessage: 'authorization expired',
          level: 'warn',
          status: 'failed',
          metadata: {
            maskedEmail: 'a***@gmail.com'
          }
        })
      ],
      mailboxes: [],
      queueRows: [
        {
          accountName: 'Acme',
          bullJobId: 'send-job-1',
          contactName: 'buyer@example.com',
          id: 'msg-failed',
          mailboxLabel: 's***@gmail.com',
          providerMessageId: null,
          providerThreadId: null,
          runVersion: 4,
          scheduledAt: '2026-06-19T11:30:00.000Z',
          sentAt: null,
          status: 'failed',
          stepIndex: 1,
          subject: 'Private subject',
          threadMode: 'new_subject',
          updatedAt: '2026-06-19T12:00:00.000Z'
        }
      ]
    });

    assert.deepEqual(
      rows.map(row => ({
        category: row.category,
        failureReason: row.failureReason,
        jobId: row.jobId,
        maskedEmail: row.maskedEmail,
        summary: row.summary,
        time: row.time
      })),
      [
        {
          category: 'webhook',
          failureReason: '-',
          jobId: 'history-job-1',
          maskedEmail: 'w***@gmail.com',
          summary: 'Pub/Sub push 已入队',
          time: '2026-06-19 17:00:00'
        },
        {
          category: 'history',
          failureReason: 'checkpoint expired',
          jobId: 'pubsub-2',
          maskedEmail: 'h***@gmail.com',
          summary: 'CRM operation',
          time: '2026-06-19 18:00:00'
        },
        {
          category: 'watch',
          failureReason: 'authorization expired',
          jobId: '-',
          maskedEmail: 'a***@gmail.com',
          summary: 'CRM operation',
          time: '2026-06-19 19:00:00'
        },
        {
          category: 'send',
          failureReason: '发送失败',
          jobId: 'send-job-1',
          maskedEmail: 's***@gmail.com',
          summary: 'Acme / buyer@example.com',
          time: '2026-06-19 20:00:00'
        }
      ]
    );
  });

  it('does not expose email body or secrets in operation log metadata details', () => {
    const items = buildOperationLogDetailItems(
      createSystemLog({
        id: 'log-sensitive',
        metadata: {
          apiKey: 'sk-live-secret',
          bodyText: 'Full email body',
          maskedEmail: 'a***@gmail.com',
          nested: {
            refreshToken: 'refresh-secret',
            subject: 'Visible subject'
          },
          token: 'access-secret'
        }
      })
    );

    const metadata = items.find(item => item.label === 'Metadata')?.value ?? '';

    assert.equal(metadata.includes('a***@gmail.com'), true);
    assert.equal(metadata.includes('Visible subject'), true);
    assert.equal(metadata.includes('Full email body'), false);
    assert.equal(metadata.includes('sk-live-secret'), false);
    assert.equal(metadata.includes('refresh-secret'), false);
    assert.equal(metadata.includes('access-secret'), false);
  });

  it('summarizes mailbox watch and sync health', () => {
    assert.deepEqual(
      summarizeMailboxSyncHealth(
        [
          createMailbox({ id: 'mailbox-normal', lastHistoryId: 'history-1', watchExpiration: '2026-06-21T12:00:00.000Z' }),
          createMailbox({
            id: 'mailbox-expired',
            status: 'auth_expired',
            watchExpiration: '2026-06-18T12:00:00.000Z'
          }),
          createMailbox({ id: 'mailbox-not-started', watchExpiration: null })
        ],
        // 固定 now，避免 watch 健康判断受运行日期影响。
        dayjs('2026-06-19T12:00:00.000Z')
      ),
      {
        authExpired: 1,
        syncIssues: 0,
        synced: 1,
        total: 3,
        watchNeedsAttention: 2
      }
    );
  });

  it('builds CRM settings overview from current mailbox list and template defaults', () => {
    assert.deepEqual(
      buildCrmSettingsOverview({
        mailboxes: [
          createMailbox({ id: 'mailbox-active', status: 'active' }),
          createMailbox({ id: 'mailbox-paused', status: 'paused' }),
          createMailbox({ id: 'mailbox-expired', status: 'auth_expired' })
        ],
        mailboxTotal: 12,
        templateDefaults: createTemplateDefaults(),
        now: dayjs('2026-06-19T12:00:00.000Z')
      }).map(item => ({
        key: item.key,
        value: item.value,
        tagType: item.tagType
      })),
      [
        { key: 'mailbox', value: '1 / 12', tagType: 'success' },
        { key: 'template', value: '默认模板', tagType: 'success' },
        { key: 'sendRule', value: '5 步序列', tagType: 'info' },
        { key: 'attention', value: '1 项', tagType: 'warning' }
      ]
    );
  });

  it('counts mailbox history sync issues as operation attention', () => {
    assert.deepEqual(
      summarizeMailboxSyncHealth([
        createMailbox({
          id: 'mailbox-history-expired',
          lastSyncIssue: {
            type: 'history_expired',
            message: 'Gmail History checkpoint 已过期，需要人工处理',
            happenedAt: '2026-06-19T08:00:00.000Z'
          },
          watchExpiration: '2026-06-22T12:00:00.000Z'
        } as Partial<Api.Crm.MailboxRecord> & { id: string })
      ]),
      {
        authExpired: 0,
        syncIssues: 1,
        synced: 0,
        total: 1,
        watchNeedsAttention: 0
      }
    );
  });

  it('labels history expired mailbox sync as a recovery action', () => {
    assert.equal(formatMailboxSyncActionLabel(createMailbox({ id: 'mailbox-normal' })), '立即同步');
    assert.equal(
      formatMailboxSyncActionLabel(
        createMailbox({
          id: 'mailbox-history-expired',
          lastSyncIssue: {
            type: 'history_expired',
            message: 'Gmail History checkpoint 已过期，需要人工处理',
            happenedAt: '2026-06-19T08:00:00.000Z'
          }
        })
      ),
      '恢复同步'
    );
  });
});

function createSequenceReviewItem(options: {
  accountName: string;
  contactEmail: string;
  enrollmentStatus?: Api.Crm.SequenceEnrollmentStatus;
  messages: Api.Crm.MessageRecord[];
}): Api.Crm.SequenceReviewItem {
  return {
    account: { name: options.accountName } as Api.Crm.LeadRecord,
    canControlSequence: true,
    canOperateDraft: true,
    checklist: [],
    contact: { email: options.contactEmail, fullName: '' } as Api.Crm.LeadContact,
    enrollment: { runVersion: 3, status: options.enrollmentStatus ?? 'ready_to_send' } as Api.Crm.SequenceEnrollmentRecord,
    firstMessage: null,
    mailbox: { maskedEmail: 'm***@example.com' } as Api.Crm.MailboxRecord,
    messages: options.messages,
    personaMatch: {
      persona: null,
      matchMethod: 'none',
      matchedKeywords: [],
      fallbackReason: null
    },
    policy: null,
    productLine: null
  };
}

function createMessage(options: {
  bullJobId?: string | null;
  id: string;
  providerThreadId?: string | null;
  scheduledAt?: string | null;
  status: Api.Crm.MessageStatus;
  subject?: string;
  updatedAt: string;
}): Api.Crm.MessageRecord {
  return {
    bullJobId: options.bullJobId ?? (options.status === 'queued' ? 'job-1' : null),
    id: options.id,
    providerMessageId: null,
    providerThreadId: options.providerThreadId ?? null,
    scheduledAt: options.scheduledAt ?? null,
    sentAt: null,
    status: options.status,
    stepIndex: 1,
    subject: options.subject ?? 'Subject',
    threadMode: 'new_subject',
    updatedAt: options.updatedAt
  } as Api.Crm.MessageRecord;
}

function createSystemLog(options: Partial<Api.SystemLog.SystemLogRecord> & { id: string }): Api.SystemLog.SystemLogRecord {
  const { id, ...overrides } = options;

  return {
    level: 'info',
    status: 'success',
    module: 'crm',
    action: 'gmail-watch-renew',
    message: 'CRM operation',
    userId: 'user-1',
    userName: 'Alice',
    errorCode: null,
    errorMessage: null,
    metadata: null,
    createdAt: '2026-06-19T08:00:00.000Z',
    ...overrides,
    id
  };
}

function createEmailTemplateGroup(): Api.Crm.EmailTemplateGroupRecord {
  return {
    id: 'template-1',
    organizationId: 'org-1',
    name: 'Default template',
    language: 'en',
    description: 'Reusable sequence',
    status: 'active',
    isDefault: false,
    steps: [1, 2, 3, 4, 5].map(stepIndex => ({
      id: `step-${stepIndex}`,
      organizationId: 'org-1',
      templateGroupId: 'template-1',
      stepIndex,
      name: `Step ${stepIndex}`,
      threadMode: stepIndex === 2 ? 'same_thread' : 'new_subject',
      delayDays: stepIndex === 1 ? 0 : stepIndex * 2,
      subjectTemplate: stepIndex === 2 ? '' : `Subject ${stepIndex}`,
      bodyTemplate: `Body ${stepIndex}`,
      createdAt: '2026-06-18T09:00:00.000Z',
      updatedAt: '2026-06-18T09:00:00.000Z'
    })),
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T09:00:00.000Z'
  };
}

function createEnabledAiWritingConfig(): Api.Crm.ProductLineAiWritingConfig {
  return {
    enabled: true,
    commonRequirements: 'Natural English',
    forbiddenClaims: 'No fake certificates',
    productEmphasis: 'Stock models',
    steps: [1, 2, 3, 4, 5].map(stepIndex => ({
      stepIndex: stepIndex as Api.Crm.AiWritingStepIndex,
      prompt: `Step ${stepIndex}`
    }))
  };
}

function createSequencePolicy(): Api.Crm.SequencePolicyRecord {
  return {
    id: 'policy-1',
    organizationId: 'org-1',
    name: 'Default sequence policy',
    description: 'Conservative policy',
    status: 'active',
    isDefault: false,
    steps: [1, 2, 3, 4, 5].map(stepIndex => ({
      stepIndex,
      delayDays: stepIndex === 1 ? 0 : stepIndex * 2,
      threadMode: stepIndex === 2 ? 'same_thread' : 'new_subject'
    })),
    linkPolicy: 'block_new_links',
    allowLowRiskAutoSend: false,
    sameCompanyContactStrategy: 'single_active_per_company',
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T09:00:00.000Z'
  };
}

function createPersonaProfile(): Api.Crm.PersonaProfileRecord {
  return {
    id: 'persona-1',
    organizationId: 'org-1',
    name: 'Procurement lead',
    description: 'Distributor buyer profile',
    titleKeywordsText: 'procurement\nbuyer',
    customerTypeKeywordsText: 'distributor',
    painPoints: 'price volatility',
    focusText: 'MOQ and lead time',
    avoidText: 'avoid overpromising delivery dates',
    status: 'active',
    isDefault: false,
    createdById: 'user-1',
    createdByName: 'Alice',
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T09:00:00.000Z'
  };
}

function createStrategyStatRow(input: Partial<Api.Crm.StrategyStatRow> = {}): Api.Crm.StrategyStatRow {
  return {
    dimension: 'template',
    key: 'default_template',
    name: '默认模板',
    sequenceCount: 0,
    draftPendingCount: 0,
    readyCount: 0,
    queuedCount: 0,
    sentCount: 0,
    failedCount: 0,
    repliedCount: 0,
    stoppedCount: 0,
    ...input
  };
}

function createTemplateDefaults(): Api.Crm.TemplateDefaults {
  return {
    templateGroup: {
      id: 'template-default',
      name: '默认模板',
      scope: 'organization',
      language: 'en',
      variables: [],
      steps: [1, 2, 3, 4, 5].map(stepIndex => ({
        stepIndex,
        name: `第 ${stepIndex} 封`,
        threadMode: stepIndex === 2 ? 'same_thread' : 'new_subject',
        delayDays: stepIndex === 1 ? 0 : stepIndex,
        subjectTemplate: `Subject ${stepIndex}`,
        bodyTemplate: `Body ${stepIndex}`
      }))
    },
    personas: []
  };
}

function createMailbox(options: Partial<Api.Crm.MailboxRecord> & { id: string }): Api.Crm.MailboxRecord {
  return {
    lastHistoryId: null,
    status: 'active',
    watchExpiration: '2026-06-20T12:00:00.000Z',
    ...options
  } as Api.Crm.MailboxRecord;
}
