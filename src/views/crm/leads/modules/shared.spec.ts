import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildLeadQueueStats,
  buildLeadSearchParams,
  formatArchivedFingerprintTypeLabel,
  formatLeadWebsiteDisplay,
  getLeadNextAction,
  getArchivedFingerprintMatchEvents,
  getLeadTimelineItemType,
  readArchivedFingerprintMatches,
  createDefaultLeadImportForm,
  normalizeLeadImportPayload
} from './shared';

describe('crm lead shared helpers', () => {
  it('creates an empty manual lead import form', () => {
    assert.deepEqual(createDefaultLeadImportForm(), {
      name: '',
      websiteUrl: '',
      country: '',
      customerType: '',
      contactFullName: '',
      contactTitle: '',
      contactEmail: ''
    });
  });

  it('normalizes manual lead import payload and omits empty contact data', () => {
    assert.deepEqual(
      normalizeLeadImportPayload({
        name: '  ABC Trading  ',
        websiteUrl: ' https://abc.example ',
        country: ' AE ',
        customerType: ' distributor ',
        contactFullName: '',
        contactTitle: ' ',
        contactEmail: ''
      }),
      {
        name: 'ABC Trading',
        websiteUrl: 'https://abc.example',
        country: 'AE',
        customerType: 'distributor'
      }
    );
  });

  it('normalizes manual lead import contact fields when any contact field exists', () => {
    assert.deepEqual(
      normalizeLeadImportPayload({
        name: 'ABC Trading',
        websiteUrl: '',
        country: '',
        customerType: '',
        contactFullName: ' Ali Hassan ',
        contactTitle: ' Buyer ',
        contactEmail: ' ali@example.com '
      }),
      {
        name: 'ABC Trading',
        websiteUrl: '',
        country: '',
        customerType: '',
        contact: {
          fullName: 'Ali Hassan',
          title: 'Buyer',
          email: 'ali@example.com'
        }
      }
    );
  });

  it('builds lead search params with trimmed keyword filter', () => {
    assert.deepEqual(
      buildLeadSearchParams({
        current: 1,
        size: 20,
        filterModel: {
          keyword: ' bearing ',
          status: 'missing_contact',
          sourceTaskId: ' task-1 '
        }
      }),
      {
        current: 1,
        size: 20,
        keyword: 'bearing',
        status: 'missing_contact',
        sourceTaskId: 'task-1'
      }
    );
  });

  it('extracts archived fingerprint match events from account timeline', () => {
    const events = [
      createTimelineEvent({ id: 'event-1', eventType: 'account_imported' }),
      createTimelineEvent({
        id: 'event-2',
        eventType: 'archived_fingerprint_matched',
        metadata: {
          matchedFingerprints: [
            {
              fingerprintType: 'domain',
              maskedValue: 'buyer.example',
              archivedAt: '2026-06-18T09:00:00.000Z',
              accountName: 'Archived Buyer'
            }
          ]
        }
      })
    ];

    assert.deepEqual(
      getArchivedFingerprintMatchEvents(events).map(event => event.id),
      ['event-2']
    );
    assert.deepEqual(readArchivedFingerprintMatches(events[1]), [
      {
        fingerprintType: 'domain',
        maskedValue: 'buyer.example',
        archivedAt: '2026-06-18T09:00:00.000Z',
        accountName: 'Archived Buyer'
      }
    ]);
  });

  it('formats archived fingerprint timeline display helpers', () => {
    assert.equal(formatArchivedFingerprintTypeLabel('domain'), '域名');
    assert.equal(formatArchivedFingerprintTypeLabel('email_hash'), '邮箱');
    assert.equal(
      getLeadTimelineItemType(createTimelineEvent({ eventType: 'archived_fingerprint_matched' })),
      'warning'
    );
    assert.equal(getLeadTimelineItemType(createTimelineEvent({ eventType: 'note_added' })), 'default');
  });

  it('builds business queue stats from visible lead statuses', () => {
    const stats = buildLeadQueueStats(
      [
        createLeadRecord({ id: 'lead-1', status: 'candidate' }),
        createLeadRecord({ id: 'lead-2', status: 'replied_pending' }),
        createLeadRecord({ id: 'lead-3', status: 'ready' }),
        createLeadRecord({ id: 'lead-4', status: 'sequence_running' }),
        createLeadRecord({ id: 'lead-5', status: 'customer' })
      ],
      23
    );

    assert.deepEqual(
      stats.map(stat => [stat.label, stat.value]),
      [
        ['匹配客户', 23],
        ['待处理', 2],
        ['可开发', 1],
        ['跟进中', 2]
      ]
    );
  });

  it('maps lead statuses to queue-oriented next actions', () => {
    assert.deepEqual(getLeadNextAction('candidate'), {
      label: '人工复核',
      description: '确认公司信息和开发优先级',
      type: 'warning'
    });
    assert.deepEqual(getLeadNextAction('missing_contact'), {
      label: '缺联系人',
      description: '补齐联系人或重新获取客户信息',
      type: 'warning'
    });
    assert.deepEqual(getLeadNextAction('email_verification_pending'), {
      label: '验证邮箱',
      description: '先确认邮箱可达性',
      type: 'warning'
    });
    assert.deepEqual(getLeadNextAction('ready'), {
      label: '创建开发信',
      description: '进入邮件序列审核',
      type: 'success'
    });
    assert.deepEqual(getLeadNextAction('sequence_running'), {
      label: '查看序列',
      description: '跟踪当前开发节奏',
      type: 'primary'
    });
    assert.deepEqual(getLeadNextAction('replied_pending'), {
      label: '处理回信',
      description: '优先进入收件箱跟进',
      type: 'info'
    });
    assert.deepEqual(getLeadNextAction('customer'), {
      label: '维护客户',
      description: '沉淀客户关系和后续机会',
      type: 'success'
    });
    assert.deepEqual(getLeadNextAction('invalid'), {
      label: '归档',
      description: '从开发队列移出',
      type: 'error'
    });
  });

  it('formats lead website display with readable domain text', () => {
    assert.equal(
      formatLeadWebsiteDisplay({
        websiteUrl: 'https://m.pump-shop.kr/product/%ED%8E%8C%ED%94%84%EC%83%B5-kbc-6203/category/266/display/1/',
        domain: 'm.pump-shop.kr'
      }),
      'm.pump-shop.kr'
    );
    assert.equal(
      formatLeadWebsiteDisplay({
        websiteUrl: 'https://kr.misumi-ec.com/vona2/detail/221000058301/',
        domain: null
      }),
      'kr.misumi-ec.com'
    );
    assert.equal(formatLeadWebsiteDisplay({ websiteUrl: null, domain: null }), '-');
  });
});

function createTimelineEvent(input: Partial<Api.Crm.LeadTimelineEvent> = {}): Api.Crm.LeadTimelineEvent {
  return {
    id: input.id ?? 'event-1',
    organizationId: input.organizationId ?? 'org-1',
    accountId: input.accountId ?? 'account-1',
    contactId: input.contactId ?? null,
    ownerUserId: input.ownerUserId ?? 'user-1',
    eventType: input.eventType ?? 'note_added',
    title: input.title ?? '备注',
    content: input.content ?? null,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? '2026-06-19T00:00:00.000Z'
  };
}

function createLeadRecord(input: Partial<Api.Crm.LeadRecord> = {}): Api.Crm.LeadRecord {
  return {
    id: input.id ?? 'lead-1',
    organizationId: input.organizationId ?? 'org-1',
    ownerUserId: input.ownerUserId ?? 'user-1',
    name: input.name ?? 'ABC Trading',
    normalizedName: input.normalizedName ?? 'abc trading',
    websiteUrl: input.websiteUrl ?? null,
    domain: input.domain ?? null,
    country: input.country ?? null,
    customerType: input.customerType ?? null,
    status: input.status ?? 'candidate',
    sourceTaskId: input.sourceTaskId ?? null,
    archivedAt: input.archivedAt ?? null,
    archiveReason: input.archiveReason ?? null,
    archiveSlimmedAt: input.archiveSlimmedAt ?? null,
    createdAt: input.createdAt ?? '2026-06-19T00:00:00.000Z',
    updatedAt: input.updatedAt ?? '2026-06-19T00:00:00.000Z'
  };
}
