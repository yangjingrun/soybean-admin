import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaCrmDashboardStore } from './prisma-crm-dashboard.store';

describe('PrismaCrmDashboardStore', () => {
  it('builds a personal CRM workbench overview with today metrics and seven day trend', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmDashboardStore(prisma as never);
    const now = new Date('2026-06-20T09:30:00.000Z');

    const overview = await store.getWorkbenchOverview({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      now
    });

    assert.equal(overview.generatedAt, now);
    assert.deepEqual(overview.today, {
      sentCount: 5,
      queuedCount: 2,
      failedCount: 1,
      pendingReplyCount: 3,
      totalReplyCount: 4,
      draftReviewCount: 6,
      firstDraftReviewCount: 2,
      followUpDraftReviewCount: 4,
      riskyDraftReviewCount: 1,
      issueCount: 2,
      sendFailedCount: 1,
      mailboxIssueCount: 1,
      missingContactCount: 7,
      emailVerificationPendingCount: 8,
      riskyEmailCount: 9,
      aiLeadTaskPendingCount: 1
    });
    assert.equal(overview.trend.length, 7);
    assert.equal(overview.trend[0].date, '2026-06-14');
    assert.equal(overview.trend.at(-1)?.date, '2026-06-20');
    assert.deepEqual(overview.trend.at(-1), {
      date: '2026-06-20',
      sentCount: 2,
      replyCount: 1
    });
    assert.equal(overview.runningTasks[0]?.type, 'ai_draft');
    assert.equal(overview.runningTasks.find(task => task.type === 'ai_leads')?.progressPercent, 46);
    assert.equal(overview.runningTasks.find(task => task.type === 'send')?.failedCount, 1);
    assert.deepEqual(prisma.crmMessage.countCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: 'sent',
      sentAt: {
        gte: new Date('2026-06-19T16:00:00.000Z'),
        lt: new Date('2026-06-20T16:00:00.000Z')
      }
    });
    assert.deepEqual(prisma.crmInboxThread.countCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: 'pending'
    });
    assert.deepEqual(prisma.crmMailbox.countCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      status: { in: ['paused', 'auth_expired'] }
    });
    assert.deepEqual(prisma.aiLeadSearchTask.countCalls[0].where, {
      organizationId: 'org-1',
      userId: 'user-1',
      status: 'completed',
      readAt: null
    });
  });

  it('uses the CRM business day instead of UTC midnight for workbench date ranges', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmDashboardStore(prisma as never);
    const now = new Date('2026-06-20T01:30:00.000Z');

    const overview = await store.getWorkbenchOverview({
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      now
    });

    assert.equal(overview.trend[0].date, '2026-06-14');
    assert.equal(overview.trend.at(-1)?.date, '2026-06-20');
    assert.deepEqual(prisma.crmMessage.countCalls[0].where.sentAt, {
      gte: new Date('2026-06-19T16:00:00.000Z'),
      lt: new Date('2026-06-20T16:00:00.000Z')
    });
  });

  it('aggregates local strategy stats from enrollments, messages and timeline metadata', async () => {
    const prisma = createPrisma();
    const store = new PrismaCrmDashboardStore(prisma as never);

    const result = await store.listStrategyStats({
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });

    assert.deepEqual(prisma.crmSequenceEnrollment.findManyCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1'
    });
    assert.deepEqual(prisma.crmTimelineEvent.findManyCalls[0].where, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
      eventType: { in: ['sequence_draft_generated', 'sequence_follow_up_draft_generated'] }
    });
    assert.equal(result.rows.template[0].key, 'default_template');
    assert.equal(result.rows.template[0].sequenceCount, 2);
    assert.equal(result.rows.template[0].queuedCount, 1);
    assert.equal(result.rows.template[0].sentCount, 1);
    assert.equal(result.rows.policy[0].key, 'policy-1');
    assert.equal(result.rows.policy[0].draftPendingCount, 1);
    assert.equal(result.rows.persona[0].key, 'persona-1');
    assert.equal(result.rows.productLine[0].key, 'product-line-1');
  });
});

function createPrisma() {
  const messageCounts = [5, 2, 1, 6, 2, 4, 1, 1];
  const inboxMessageCounts = [4, 1];
  const contactCounts = [8, 9];

  return {
    crmMessage: {
      countCalls: [] as Array<{ where: Record<string, unknown> }>,
      findManyCalls: [] as Array<{ where: Record<string, unknown>; select: Record<string, unknown> }>,
      async count(args: { where: Record<string, unknown> }) {
        this.countCalls.push(args);
        return messageCounts.shift() ?? 0;
      },
      async findMany(args: { where: Record<string, unknown>; select: Record<string, unknown> }) {
        this.findManyCalls.push(args);
        return [{ sentAt: new Date('2026-06-20T08:00:00.000Z') }, { sentAt: new Date('2026-06-20T09:00:00.000Z') }];
      }
    },
    crmInboxThread: {
      countCalls: [] as Array<{ where: Record<string, unknown> }>,
      async count(args: { where: Record<string, unknown> }) {
        this.countCalls.push(args);
        return 3;
      }
    },
    crmInboxMessage: {
      countCalls: [] as Array<{ where: Record<string, unknown> }>,
      findManyCalls: [] as Array<{ where: Record<string, unknown>; select: Record<string, unknown> }>,
      async count(args: { where: Record<string, unknown> }) {
        this.countCalls.push(args);
        return inboxMessageCounts.shift() ?? 0;
      },
      async findMany(args: { where: Record<string, unknown>; select: Record<string, unknown> }) {
        this.findManyCalls.push(args);
        return [{ receivedAt: new Date('2026-06-20T10:00:00.000Z') }];
      }
    },
    crmMailbox: {
      countCalls: [] as Array<{ where: Record<string, unknown> }>,
      async count(args: { where: Record<string, unknown> }) {
        this.countCalls.push(args);
        return 1;
      }
    },
    crmAccount: {
      countCalls: [] as Array<{ where: Record<string, unknown> }>,
      async count(args: { where: Record<string, unknown> }) {
        this.countCalls.push(args);
        return 7;
      }
    },
    crmContact: {
      countCalls: [] as Array<{ where: Record<string, unknown> }>,
      async count(args: { where: Record<string, unknown> }) {
        this.countCalls.push(args);
        return contactCounts.shift() ?? 0;
      }
    },
    crmAiDraftTask: {
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        orderBy: Array<Record<string, unknown>>;
        take: number;
      }>,
      async findMany(args: { where: Record<string, unknown>; orderBy: Array<Record<string, unknown>>; take: number }) {
        this.findManyCalls.push(args);
        return [
          {
            id: 'ai-draft-task-1',
            status: 'running',
            requestedCount: 10,
            successCount: 2,
            failedCount: 1,
            pendingCount: 4,
            runningCount: 2,
            retryingCount: 1,
            updatedAt: new Date('2026-06-20T09:00:00.000Z')
          }
        ];
      }
    },
    aiLeadSearchTask: {
      countCalls: [] as Array<{ where: Record<string, unknown> }>,
      findFirstCalls: [] as Array<{ where: Record<string, unknown>; orderBy: Record<string, unknown> }>,
      async count(args: { where: Record<string, unknown> }) {
        this.countCalls.push(args);
        return 1;
      },
      async findFirst(args: { where: Record<string, unknown>; orderBy: Record<string, unknown> }) {
        this.findFirstCalls.push(args);
        return {
          id: 'ai-lead-task-1',
          status: 'running',
          targetLeadCount: 20,
          progressState: { type: 'step_progress', progressPercent: 46 },
          updatedAt: new Date('2026-06-20T09:00:00.000Z')
        };
      }
    },
    crmSequenceEnrollment: {
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        orderBy: Record<string, unknown>;
        include: Record<string, unknown>;
      }>,
      async findMany(args: {
        where: Record<string, unknown>;
        orderBy: Record<string, unknown>;
        include: Record<string, unknown>;
      }) {
        this.findManyCalls.push(args);
        return [
          createEnrollment({
            id: 'enrollment-1',
            status: 'sequence_running',
            messages: [createMessage({ status: 'queued' }), createMessage({ id: 'message-2', status: 'sent' })]
          }),
          createEnrollment({
            id: 'enrollment-2',
            status: 'draft_review_pending',
            messages: [createMessage({ id: 'message-3', status: 'draft_pending_review' })]
          })
        ];
      }
    },
    crmTimelineEvent: {
      findManyCalls: [] as Array<{
        where: Record<string, unknown>;
        orderBy: Record<string, unknown>;
      }>,
      async findMany(args: { where: Record<string, unknown>; orderBy: Record<string, unknown> }) {
        this.findManyCalls.push(args);
        return [
          {
            id: 'timeline-1',
            organizationId: 'org-1',
            ownerUserId: 'user-1',
            eventType: 'sequence_draft_generated',
            metadata: {
              enrollmentId: 'enrollment-1',
              personaProfileId: 'persona-1',
              personaProfileName: 'Procurement lead'
            },
            createdAt: new Date('2026-06-20T09:00:00.000Z')
          }
        ];
      }
    }
  };
}

function createEnrollment(input: Record<string, unknown> = {}) {
  return {
    id: 'enrollment-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    status: 'sequence_running',
    productLine: {
      id: 'product-line-1',
      name: 'Bearing Series'
    },
    policy: {
      id: 'policy-1',
      name: 'Default policy'
    },
    messages: [createMessage()],
    updatedAt: new Date('2026-06-20T09:00:00.000Z'),
    ...input
  };
}

function createMessage(input: Record<string, unknown> = {}) {
  return {
    id: 'message-1',
    status: 'queued',
    createdAt: new Date('2026-06-20T09:00:00.000Z'),
    ...input
  };
}
