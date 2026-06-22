import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildWorkbenchMetricCards,
  buildWorkbenchRecommendation,
  buildWorkbenchTodoItems,
  buildWorkbenchTrendOption,
  createWorkbenchLoadingTracker,
  formatTaskCountMeta,
  formatTaskProgress,
  shouldPollWorkbench
} from './shared';
describe('home workbench shared helpers', () => {
  it('prioritizes pending customer replies in the recommendation', () => {
    const recommendation = buildWorkbenchRecommendation(
      createWorkbenchOverview({
        today: {
          pendingReplyCount: 3,
          failedCount: 2,
          draftReviewCount: 4
        }
      })
    );
    assert.equal(recommendation.title, '先处理客户回信');
    assert.equal(recommendation.routePath, '/crm/inbox');
    assert.deepEqual(recommendation.query, { status: 'pending' });
  });
  it('builds the four top metric cards with yesterday comparison', () => {
    const cards = buildWorkbenchMetricCards(
      createWorkbenchOverview({
        today: {
          sentCount: 12,
          totalReplyCount: 5,
          pendingReplyCount: 2,
          queuedCount: 4,
          failedCount: 1,
          sendFailedCount: 1,
          draftReviewCount: 3
        },
        yesterday: {
          sentCount: 8,
          totalReplyCount: 4
        }
      })
    );
    assert.deepEqual(
      cards.map(card => [card.key, card.value, card.description]),
      [
        ['pending-replies', 2, '今日共 5 封，较昨天 +1'],
        ['sent-today', 12, '队列 4 封，失败 1 封，较昨天 +4'],
        ['draft-review', 3, '首封 0 封，跟进 0 封'],
        ['send-exceptions', 1, '发送失败 1 封，邮箱异常 0 个']
      ]
    );
  });
  it('orders todo items from replies to data issues and AI lead results', () => {
    const items = buildWorkbenchTodoItems(
      createWorkbenchOverview({
        today: {
          pendingReplyCount: 2,
          failedCount: 1,
          sendFailedCount: 1,
          draftReviewCount: 3,
          firstDraftReviewCount: 1,
          followUpDraftReviewCount: 2,
          missingContactCount: 4,
          emailVerificationPendingCount: 5,
          riskyEmailCount: 6,
          aiLeadTaskPendingCount: 7
        }
      })
    );
    assert.deepEqual(
      items.map(item => item.key),
      ['pending-replies', 'send-failed', 'draft-review', 'lead-quality', 'ai-lead-results']
    );
  });
  it('polls only when a running task is queued or running', () => {
    assert.equal(
      shouldPollWorkbench(
        createWorkbenchOverview({
          runningTasks: [{ status: 'running' }]
        })
      ),
      true
    );
    assert.equal(
      shouldPollWorkbench(
        createWorkbenchOverview({
          runningTasks: [{ status: 'completed' }]
        })
      ),
      false
    );
  });
  it('uses backend task progress percent when present', () => {
    const [task] = createWorkbenchOverview({
      runningTasks: [
        {
          progressPercent: 46,
          totalCount: 20,
          completedCount: 0,
          failedCount: 0,
          pendingCount: 20
        }
      ]
    }).runningTasks;
    assert.equal(formatTaskProgress(task), 46);
  });
  it('derives AI lead task count text from backend progress percent', () => {
    const [task] = createWorkbenchOverview({
      runningTasks: [
        {
          type: 'ai_leads',
          progressPercent: 46,
          totalCount: 20,
          completedCount: 0,
          failedCount: 0,
          pendingCount: 20
        }
      ]
    }).runningTasks;
    assert.deepEqual(formatTaskCountMeta(task), {
      completedCount: 9,
      failedCount: 0,
      pendingCount: 11,
      totalCount: 20
    });
  });
  it('keeps loading flags scoped to the request mode that started them', () => {
    const tracker = createWorkbenchLoadingTracker();
    const finishInitial = tracker.start('initial');
    const finishRefresh = tracker.start('refresh');
    finishInitial();
    assert.equal(tracker.loading.value, false);
    assert.equal(tracker.refreshing.value, true);
    finishRefresh();
    assert.equal(tracker.loading.value, false);
    assert.equal(tracker.refreshing.value, false);
  });
  it('builds the seven day sent and reply trend option', () => {
    const option = buildWorkbenchTrendOption(
      createWorkbenchOverview({
        trend: [
          { date: '2026-06-19', sentCount: 3, replyCount: 1 },
          { date: '2026-06-20', sentCount: 5, replyCount: 2 }
        ]
      }).trend
    );
    assert.deepEqual(option.legend?.data, ['发送邮件', '客户回复']);
    assert.deepEqual(option.xAxis?.data, ['06-19', '06-20']);
  });
});
function createWorkbenchOverview(overrides = {}) {
  return {
    generatedAt: overrides.generatedAt ?? '2026-06-20T09:00:00.000Z',
    today: {
      sentCount: 0,
      queuedCount: 0,
      failedCount: 0,
      pendingReplyCount: 0,
      totalReplyCount: 0,
      draftReviewCount: 0,
      firstDraftReviewCount: 0,
      followUpDraftReviewCount: 0,
      riskyDraftReviewCount: 0,
      issueCount: 0,
      sendFailedCount: 0,
      mailboxIssueCount: 0,
      missingContactCount: 0,
      emailVerificationPendingCount: 0,
      riskyEmailCount: 0,
      aiLeadTaskPendingCount: 0,
      ...overrides.today
    },
    yesterday: {
      sentCount: 0,
      totalReplyCount: 0,
      ...overrides.yesterday
    },
    trend: overrides.trend ?? [],
    runningTasks: (overrides.runningTasks ?? []).map((task, index) => ({
      id: task.id ?? `task-${index}`,
      type: task.type ?? 'ai_draft',
      title: task.title ?? '生成草稿',
      status: task.status ?? 'running',
      totalCount: task.totalCount ?? 10,
      completedCount: task.completedCount ?? 4,
      failedCount: task.failedCount ?? 1,
      pendingCount: task.pendingCount ?? 5,
      progressPercent: task.progressPercent,
      routePath: task.routePath ?? '/crm/email-sequences'
    }))
  };
}
