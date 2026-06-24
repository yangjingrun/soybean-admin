import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as leadShared from './shared.js';
import {
  buildLeadQueueStats,
  buildLeadSearchParams,
  buildLeadExpandedContactView,
  buildLeadRowContactView,
  canCreateSequenceFromLeadContact,
  crmLeadPageGuide,
  formatArchivedFingerprintTypeLabel,
  formatLeadWebsiteDisplay,
  getLeadNextAction,
  getArchivedFingerprintMatchEvents,
  getLeadTimelineItemType,
  leadStatusLabelMap,
  readArchivedFingerprintMatches,
  createDefaultLeadImportForm,
  normalizeLeadImportPayload
} from './shared.js';
describe('crm lead shared helpers', () => {
  it('uses plain business wording for AI leads handoff', () => {
    assert.equal(crmLeadPageGuide.title, '客户管理承接 AI 获客结果');
    assert.match(crmLeadPageGuide.description, /可开发客户创建开发任务/);
    assert.match(crmLeadPageGuide.description, /暂不开发客户/);
    assert.equal(leadStatusLabelMap.archived, '暂不开发');
    assert.equal(leadStatusLabelMap.sequence_running, '开发中');
  });
  it('creates an empty manual lead import form', () => {
    assert.deepEqual(createDefaultLeadImportForm(), {
      name: '',
      websiteUrl: '',
      country: '',
      city: '',
      address: '',
      timeZone: '',
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
        city: ' Dubai ',
        address: ' Office 12, Trade Center ',
        timeZone: ' Asia/Dubai ',
        customerType: ' distributor ',
        contactFullName: '',
        contactTitle: ' ',
        contactEmail: ''
      }),
      {
        name: 'ABC Trading',
        websiteUrl: 'https://abc.example',
        country: 'AE',
        city: 'Dubai',
        address: 'Office 12, Trade Center',
        timeZone: 'Asia/Dubai',
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
        city: '',
        address: '',
        timeZone: '',
        customerType: '',
        contactFullName: ' Ali Hassan ',
        contactTitle: ' Buyer ',
        contactEmail: ' ali@example.com '
      }),
      {
        name: 'ABC Trading',
        websiteUrl: '',
        country: '',
        city: '',
        address: '',
        timeZone: '',
        customerType: '',
        contact: {
          fullName: 'Ali Hassan',
          title: 'Buyer',
          email: 'ali@example.com'
        }
      }
    );
  });
  it('builds trimmed account update payload with editable address fields', () => {
    assert.deepEqual(
      leadShared.buildLeadAccountUpdatePayload({
        name: ' ABC Trading ',
        normalizedName: ' abc trading ',
        websiteUrl: ' https://abc.example ',
        country: ' AE ',
        city: ' Dubai ',
        address: ' Office 12, Trade Center ',
        timeZone: ' Asia/Dubai ',
        customerType: ' distributor '
      }),
      {
        name: 'ABC Trading',
        normalizedName: 'abc trading',
        websiteUrl: 'https://abc.example',
        country: 'AE',
        city: 'Dubai',
        address: 'Office 12, Trade Center',
        timeZone: 'Asia/Dubai',
        customerType: 'distributor'
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
          contactTitle: '',
          customerType: '',
          region: '',
          status: 'missing_contact',
          sourceTaskId: ' task-1 ',
          updatedAtRange: null
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
      label: '创建开发任务',
      description: '检查邮件后加入发送队列',
      type: 'success'
    });
    assert.deepEqual(getLeadNextAction('sequence_running'), {
      label: '查看开发任务',
      description: '检查待处理邮件和发送进度',
      type: 'primary'
    });
    assert.deepEqual(getLeadNextAction('replied_pending'), {
      label: '处理回信',
      description: '优先进入客户回信处理',
      type: 'info'
    });
    assert.deepEqual(getLeadNextAction('customer'), {
      label: '维护客户',
      description: '沉淀客户关系和后续机会',
      type: 'success'
    });
    assert.deepEqual(getLeadNextAction('invalid'), {
      label: '暂不开发',
      description: '移出日常开发队列',
      type: 'error'
    });
    assert.deepEqual(getLeadNextAction('archived'), {
      label: '重新开发',
      description: '需要时恢复到候选线索',
      type: 'default'
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
  it('builds lead search params from field filters', () => {
    const params = buildLeadSearchParams({
      current: 1,
      size: 10,
      filterModel: {
        keyword: ' ABC ',
        contactTitle: ' buyer ',
        customerType: ' distributor ',
        region: ' Riyadh ',
        status: 'ready',
        sourceTaskId: null,
        updatedAtRange: [Date.UTC(2026, 5, 1), Date.UTC(2026, 5, 24)]
      }
    });
    assert.equal(params.keyword, 'ABC');
    assert.equal(params.contactTitle, 'buyer');
    assert.equal(params.customerType, 'distributor');
    assert.equal(params.region, 'Riyadh');
    assert.equal(params.status, 'ready');
    assert.ok(params.updatedFrom);
    assert.ok(params.updatedTo);
  });
  it('builds country region keyword params from cascader filters', () => {
    const params = buildLeadSearchParams({
      current: 1,
      size: 10,
      filterModel: {
        keyword: '',
        contactTitle: '',
        customerType: '',
        region: 'country:TW:%E5%8F%B0%E6%B9%BE',
        status: null,
        sourceTaskId: null,
        updatedAtRange: null
      }
    });
    assert.equal(params.region, undefined);
    assert.equal(params.regionKeywords, '台湾');
  });
  it('builds expanded contact table state from cached account detail', () => {
    const contact = createLeadContact({ id: 'contact-1', accountId: 'lead-1' });
    const loadedView = buildLeadExpandedContactView({
      accountId: 'lead-1',
      detail: {
        account: createLeadRecord({ id: 'lead-1' }),
        contacts: [contact],
        enrichmentHistories: [],
        timelineEvents: []
      },
      loadingIds: [],
      failedIds: []
    });
    assert.deepEqual(loadedView, {
      status: 'loaded',
      contacts: [contact]
    });
    assert.deepEqual(
      buildLeadExpandedContactView({
        accountId: 'lead-2',
        detail: null,
        loadingIds: ['lead-2'],
        failedIds: []
      }),
      {
        status: 'loading',
        contacts: []
      }
    );
    assert.deepEqual(
      buildLeadExpandedContactView({
        accountId: 'lead-3',
        detail: null,
        loadingIds: [],
        failedIds: ['lead-3']
      }),
      {
        status: 'error',
        contacts: []
      }
    );
  });
  it('builds list-row contact display state from contact summary', () => {
    const primaryContact = createLeadContact({ id: 'contact-1', accountId: 'lead-1' });
    assert.deepEqual(buildLeadRowContactView(createLeadRecord({ contactCount: 0, primaryContact: null })), {
      type: 'empty',
      primaryContact: null
    });
    assert.deepEqual(buildLeadRowContactView(createLeadRecord({ contactCount: 1, primaryContact })), {
      type: 'single',
      primaryContact
    });
    assert.deepEqual(buildLeadRowContactView(createLeadRecord({ contactCount: 3, primaryContact })), {
      type: 'multiple',
      primaryContact,
      count: 3
    });
  });
  it('prevents starting sequences for unreachable or unsubscribed contacts', () => {
    assert.equal(canCreateSequenceFromLeadContact(createLeadContact({ emailStatus: 'valid' })), true);
    assert.equal(canCreateSequenceFromLeadContact(createLeadContact({ emailStatus: 'invalid' })), false);
    assert.equal(canCreateSequenceFromLeadContact(createLeadContact({ emailStatus: 'unreachable' })), false);
    assert.equal(canCreateSequenceFromLeadContact(createLeadContact({ emailStatus: 'unsubscribed' })), false);
  });
  it('builds city region keyword params from cascader filters', () => {
    const params = buildLeadSearchParams({
      current: 1,
      size: 10,
      filterModel: {
        keyword: '',
        contactTitle: '',
        customerType: '',
        region: 'city:US:Los%20Angeles:Los%20Angeles',
        status: null,
        sourceTaskId: null,
        updatedAtRange: null
      }
    });
    assert.equal(params.region, undefined);
    assert.equal(params.regionKeywords, 'Los Angeles');
  });
});
function createTimelineEvent(input = {}) {
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
function createLeadRecord(input = {}) {
  return {
    id: input.id ?? 'lead-1',
    organizationId: input.organizationId ?? 'org-1',
    ownerUserId: input.ownerUserId ?? 'user-1',
    name: input.name ?? 'ABC Trading',
    normalizedName: input.normalizedName ?? 'abc trading',
    websiteUrl: input.websiteUrl ?? null,
    domain: input.domain ?? null,
    country: input.country ?? null,
    city: input.city ?? null,
    address: input.address ?? null,
    customerType: input.customerType ?? null,
    status: input.status ?? 'candidate',
    sourceTaskId: input.sourceTaskId ?? null,
    archivedAt: input.archivedAt ?? null,
    archiveReason: input.archiveReason ?? null,
    archiveSlimmedAt: input.archiveSlimmedAt ?? null,
    createdAt: input.createdAt ?? '2026-06-19T00:00:00.000Z',
    updatedAt: input.updatedAt ?? '2026-06-19T00:00:00.000Z',
    contactCount: input.contactCount ?? 0,
    primaryContact: input.primaryContact ?? null
  };
}
function createLeadContact(input = {}) {
  return {
    id: input.id ?? 'contact-1',
    organizationId: input.organizationId ?? 'org-1',
    accountId: input.accountId ?? 'lead-1',
    ownerUserId: input.ownerUserId ?? 'user-1',
    fullName: input.fullName ?? 'Alex Buyer',
    title: input.title ?? 'Buyer',
    email: input.email ?? 'alex@example.com',
    emailHash: input.emailHash ?? 'hash-1',
    maskedEmail: input.maskedEmail ?? 'a***@example.com',
    isPublicEmail: input.isPublicEmail ?? false,
    emailStatus: input.emailStatus ?? 'unchecked',
    sourceTaskId: input.sourceTaskId ?? null,
    createdAt: input.createdAt ?? '2026-06-19T00:00:00.000Z',
    updatedAt: input.updatedAt ?? '2026-06-19T00:00:00.000Z'
  };
}
