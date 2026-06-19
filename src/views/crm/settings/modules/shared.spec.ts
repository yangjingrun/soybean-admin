import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import dayjs from 'dayjs';
import {
  buildBlacklistSearchParams,
  buildEmailTemplateSearchParams,
  collectOperationQueueRows,
  createDefaultBlacklistFilterModel,
  createDefaultEmailTemplateFilterModel,
  createDefaultEmailTemplateForm,
  createDefaultFollowUpDelayDays,
  createDefaultGlobalConfigForm,
  createEmailTemplateFormFromRecord,
  isValidEmailVerificationCooldownDays,
  isValidFollowUpDelayDays,
  normalizeEmailTemplatePayload,
  summarizeMailboxSyncHealth
} from './shared';

describe('crm settings shared helpers', () => {
  it('creates the platform global config form with the documented cooldown default', () => {
    assert.deepEqual(createDefaultGlobalConfigForm(), {
      emailVerificationCooldownDays: 30,
      followUpDelayDays: {
        step2Days: 3,
        step3Days: 7,
        step4Days: 14,
        step5Days: 21
      }
    });
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

  it('collects queued and failed messages for the operations queue', () => {
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
      })
    ]);

    assert.deepEqual(
      rows.map(row => ({ accountName: row.accountName, id: row.id, status: row.status })),
      [
        { accountName: 'Beta', id: 'msg-failed', status: 'failed' },
        { accountName: 'Acme', id: 'msg-queued', status: 'queued' }
      ]
    );
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

  it('counts mailbox history sync issues as operation attention', () => {
    assert.deepEqual(
      summarizeMailboxSyncHealth([
        createMailbox({
          id: 'mailbox-history-expired',
          lastSyncIssue: {
            type: 'history_expired',
            message: 'Gmail History checkpoint 已过期，需要人工处理',
            happenedAt: '2026-06-19T08:00:00.000Z'
          }
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
});

function createSequenceReviewItem(options: {
  accountName: string;
  contactEmail: string;
  messages: Api.Crm.MessageRecord[];
}): Api.Crm.SequenceReviewItem {
  return {
    account: { name: options.accountName } as Api.Crm.LeadRecord,
    canControlSequence: true,
    canOperateDraft: true,
    checklist: [],
    contact: { email: options.contactEmail, fullName: '' } as Api.Crm.LeadContact,
    enrollment: { runVersion: 3 } as Api.Crm.SequenceEnrollmentRecord,
    firstMessage: null,
    mailbox: { maskedEmail: 'm***@example.com' } as Api.Crm.MailboxRecord,
    messages: options.messages,
    productLine: null
  };
}

function createMessage(options: {
  id: string;
  status: Api.Crm.MessageStatus;
  updatedAt: string;
}): Api.Crm.MessageRecord {
  return {
    bullJobId: options.status === 'queued' ? 'job-1' : null,
    id: options.id,
    scheduledAt: null,
    sentAt: null,
    status: options.status,
    stepIndex: 1,
    updatedAt: options.updatedAt
  } as Api.Crm.MessageRecord;
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

function createMailbox(options: Partial<Api.Crm.MailboxRecord> & { id: string }): Api.Crm.MailboxRecord {
  return {
    lastHistoryId: null,
    status: 'active',
    watchExpiration: '2026-06-20T12:00:00.000Z',
    ...options
  } as Api.Crm.MailboxRecord;
}
