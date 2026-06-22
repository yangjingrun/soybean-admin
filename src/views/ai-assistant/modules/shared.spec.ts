import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAssistantCapacitySummary,
  buildAssistantQueueViews,
  buildAssistantRecommendationReason,
  getAssistantLeadAction,
  getAssistantQueueDescription,
  getAssistantQueueLabel,
  resolveAssistantQueueKey,
  type AssistantQueueKey
} from './shared';

const baseLead: Api.Crm.LeadRecord = {
  id: 'lead-1',
  organizationId: 'org-1',
  ownerUserId: 'user-1',
  name: 'Example Trading',
  normalizedName: 'example trading',
  websiteUrl: 'https://example.com',
  domain: 'example.com',
  country: 'US',
  customerType: 'Importer',
  status: 'ready',
  sourceTaskId: null,
  archivedAt: null,
  archiveReason: null,
  archiveSlimmedAt: null,
  createdAt: '2026-06-22T00:00:00.000Z',
  updatedAt: '2026-06-22T00:00:00.000Z'
};

function createLead(status: Api.Crm.CrmAccountStatus, id: string = status): Api.Crm.LeadRecord {
  return {
    ...baseLead,
    id,
    status
  };
}

describe('ai assistant queue helpers', () => {
  it('maps CRM statuses into assistant queues', () => {
    const cases: Array<[Api.Crm.CrmAccountStatus, AssistantQueueKey]> = [
      ['ready', 'recommended'],
      ['sequence_running', 'following'],
      ['replied_pending', 'replied'],
      ['missing_contact', 'needs_data'],
      ['paused', 'paused'],
      ['archived', 'archived']
    ];

    for (const [status, queueKey] of cases) {
      assert.equal(resolveAssistantQueueKey(status), queueKey);
    }
  });

  it('builds queue views for recommended, running, replied, needs-data, paused and archived leads', () => {
    const records = [
      createLead('ready', 'ready-1'),
      createLead('sequence_running', 'running-1'),
      createLead('replied_pending', 'reply-1'),
      createLead('missing_contact', 'missing-contact-1'),
      createLead('paused', 'paused-1'),
      createLead('archived', 'archived-1')
    ];

    const views = buildAssistantQueueViews(records);
    const getIds = (key: AssistantQueueKey) =>
      views.find(view => view.key === key)?.records.map(record => record.id);

    assert.deepEqual(getIds('recommended'), ['ready-1']);
    assert.deepEqual(getIds('following'), ['running-1']);
    assert.deepEqual(getIds('replied'), ['reply-1']);
    assert.deepEqual(getIds('needs_data'), ['missing-contact-1']);
    assert.deepEqual(getIds('paused'), ['paused-1']);
    assert.deepEqual(getIds('archived'), ['archived-1']);
  });

  it('counts queue capacity summary from the same queue mapping', () => {
    const records = [
      createLead('ready', 'ready-1'),
      createLead('ready', 'ready-2'),
      createLead('sequence_running', 'running-1'),
      createLead('followed_up', 'followed-up-1'),
      createLead('replied_pending', 'reply-1'),
      createLead('missing_contact', 'missing-contact-1'),
      createLead('email_verification_pending', 'email-verification-1'),
      createLead('paused', 'paused-1'),
      createLead('archived', 'archived-1')
    ];

    const summary = buildAssistantCapacitySummary(records, { dailySendLimit: 37 });

    assert.deepEqual(summary, {
      dailyLimit: 37,
      recommendedCount: 2,
      followingCount: 2,
      repliedCount: 1,
      needsDataCount: 2,
      pausedCount: 1,
      archivedCount: 1,
      totalCount: 9
    });
  });

  it('uses backend send preference only when it is provided', () => {
    const summary = buildAssistantCapacitySummary([createLead('ready')], null);

    assert.equal(summary.dailyLimit, 0);
    assert.equal(summary.totalCount, 1);
  });

  it('returns queue copy, action copy and recommendation reason', () => {
    assert.equal(getAssistantQueueLabel('recommended'), '今日推荐');
    assert.match(getAssistantQueueDescription('archived'), /保留记录/);
    assert.equal(getAssistantLeadAction('ready').label, '开始跟进');
    assert.match(buildAssistantRecommendationReason(baseLead), /Importer \/ US \/ example\.com/);
  });
});
