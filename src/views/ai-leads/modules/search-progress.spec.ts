import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canReturnToKeywordOptimizationStep,
  createLeadSearchProgressStateFromTask,
  createLeadSearchProgressState,
  getLeadSearchTaskActionState,
  getMetricDisplayText,
  isLeadSearchTaskPending,
  isSearchWorkflowFinished,
  reduceLeadSearchProgressEvent,
  shouldClearSearchTaskAfterAction
} from './search-progress';

describe('ai leads search progress state', () => {
  it('adds dynamic steps from incoming events without a fixed workflow list', () => {
    let state = createLeadSearchProgressState();

    state = reduceLeadSearchProgressEvent(state, {
      type: 'step_started',
      runId: 'run-1',
      sequence: 1,
      emittedAt: '2026-06-18T00:00:00.000Z',
      stepKey: 'collect_public_leads',
      title: '采集公开线索',
      description: '正在采集公开线索',
      progressPercent: 25
    });

    assert.equal(state.steps.length, 1);
    assert.deepEqual(state.steps[0], {
      key: 'collect_public_leads',
      title: '采集公开线索',
      description: '正在采集公开线索',
      status: 'active',
      sequence: 1
    });
    assert.equal(state.currentTitle, '采集公开线索');
    assert.equal(state.progressPercent, 25);
  });

  it('updates metrics and completes steps by step key', () => {
    let state = createLeadSearchProgressState();

    state = reduceLeadSearchProgressEvent(state, {
      type: 'step_started',
      runId: 'run-1',
      sequence: 1,
      emittedAt: '2026-06-18T00:00:00.000Z',
      stepKey: 'collect_public_leads',
      title: '采集公开线索'
    });
    state = reduceLeadSearchProgressEvent(state, {
      type: 'step_progress',
      runId: 'run-1',
      sequence: 2,
      emittedAt: '2026-06-18T00:00:01.000Z',
      stepKey: 'collect_public_leads',
      title: '采集公开线索',
      description: '已完成 6 个采集动作',
      metrics: [{ key: 'actionCount', label: '采集动作', value: 6, total: 20 }]
    });
    state = reduceLeadSearchProgressEvent(state, {
      type: 'step_completed',
      runId: 'run-1',
      sequence: 3,
      emittedAt: '2026-06-18T00:00:02.000Z',
      stepKey: 'collect_public_leads',
      title: '采集公开线索'
    });

    assert.equal(state.steps[0].status, 'completed');
    assert.equal(state.currentDescription, '已完成 6 个采集动作');
    assert.equal(state.metrics[0].label, '采集动作');
    assert.equal(getMetricDisplayText(state.metrics[0]), '采集动作 6/20');
  });

  it('stores public result and marks workflow finished on completion', () => {
    let state = createLeadSearchProgressState();

    state = reduceLeadSearchProgressEvent(state, {
      type: 'workflow_completed',
      runId: 'run-1',
      sequence: 4,
      emittedAt: '2026-06-18T00:00:03.000Z',
      title: '搜索采集完成',
      result: {
        summary: {
          actionCount: 6,
          qualityCheckCount: 5,
          candidateCount: 18,
          stopReason: '已达到目标线索数量'
        },
        candidates: [{ title: 'Bearing House', website: 'https://bearing.example.com', sourceLabel: '公开线索' }],
        serperResults: [
          {
            endpoint: 'search',
            requestBody: { q: 'bearing distributor Saudi Arabia', page: 1 },
            result: {
              organic: [
                {
                  title: 'Bearing House',
                  link: 'https://bearing.example.com',
                  sitelinks: [{ title: 'Products', link: 'https://bearing.example.com/products' }]
                }
              ]
            }
          }
        ]
      }
    });

    assert.equal(state.status, 'completed');
    assert.equal(state.result?.summary.candidateCount, 18);
    assert.deepEqual(state.result?.serperResults[0].result, {
      organic: [
        {
          title: 'Bearing House',
          link: 'https://bearing.example.com',
          sitelinks: [{ title: 'Products', link: 'https://bearing.example.com/products' }]
        }
      ]
    });
    assert.equal(isSearchWorkflowFinished(state), true);
  });

  it('stores failure message and marks workflow failed', () => {
    const state = reduceLeadSearchProgressEvent(createLeadSearchProgressState(), {
      type: 'workflow_failed',
      runId: 'run-1',
      sequence: 2,
      emittedAt: '2026-06-18T00:00:02.000Z',
      title: '搜索采集失败',
      errorMessage: '搜索采集失败，请稍后重试'
    });

    assert.equal(state.status, 'failed');
    assert.equal(state.errorMessage, '搜索采集失败，请稍后重试');
    assert.equal(isSearchWorkflowFinished(state), true);
  });

  it('allows returning to keyword optimization only after search workflow stops', () => {
    const idleState = createLeadSearchProgressState();
    const runningState = reduceLeadSearchProgressEvent(idleState, {
      type: 'workflow_started',
      runId: 'run-1',
      sequence: 1,
      emittedAt: '2026-06-18T00:00:00.000Z',
      title: '准备搜索采集'
    });
    const failedState = reduceLeadSearchProgressEvent(runningState, {
      type: 'workflow_failed',
      runId: 'run-1',
      sequence: 2,
      emittedAt: '2026-06-18T00:00:02.000Z',
      title: '搜索采集失败'
    });

    assert.equal(canReturnToKeywordOptimizationStep(idleState, false), false);
    assert.equal(canReturnToKeywordOptimizationStep(runningState, true), false);
    assert.equal(canReturnToKeywordOptimizationStep(failedState, true), false);
    assert.equal(canReturnToKeywordOptimizationStep(failedState, false), true);
  });

  it('restores queued task as a running progress panel with queue copy', () => {
    const state = createLeadSearchProgressStateFromTask(
      createTaskRecord({
        status: 'queued',
        progressState: null
      })
    );

    assert.equal(state.status, 'running');
    assert.equal(state.currentTitle, '采集任务已排队');
    assert.equal(state.currentDescription, '任务正在等待后台 worker 执行。');
    assert.equal(state.progressPercent, 3);
    assert.equal(isLeadSearchTaskPending('queued'), true);
  });

  it('restores running task from persisted progress event', () => {
    const state = createLeadSearchProgressStateFromTask(
      createTaskRecord({
        status: 'running',
        progressState: {
          type: 'step_progress',
          runId: 'run-1',
          sequence: 2,
          emittedAt: '2026-06-18T00:00:01.000Z',
          stepKey: 'collect_public_leads',
          title: '采集公开线索',
          description: '已完成 6 个采集动作',
          progressPercent: 35
        }
      })
    );

    assert.equal(state.status, 'running');
    assert.equal(state.currentTitle, '采集公开线索');
    assert.equal(state.steps[0].key, 'collect_public_leads');
    assert.equal(state.progressPercent, 35);
  });

  it('restores completed task result into public search summary', () => {
    const state = createLeadSearchProgressStateFromTask(
      createTaskRecord({
        status: 'completed',
        result: {
          keywordOptimization: createKeywordPlan(),
          keywordOptimizationText: JSON.stringify(createKeywordPlan()),
          serperRequests: [{ endpoint: 'search', requestBody: { q: 'bearing supplier Riyadh' } }],
          serperResults: [
            {
              endpoint: 'search',
              requestBody: { q: 'bearing supplier Riyadh' },
              result: { organic: [{ title: 'Bearing House' }] }
            }
          ],
          decisions: [{ accepted: true }],
          candidates: [{ title: 'Bearing House', website: 'https://bearing.example.com', sourceLabel: '公开线索' }],
          stopReason: '已达到目标线索数量',
          qualityWarnings: ['部分线索缺少电话']
        }
      })
    );

    assert.equal(state.status, 'completed');
    assert.equal(
      state.currentDescription,
      '后台采集任务已完成，可用线索已进入 CRM。下一步处理本次客户，补齐联系人并创建开发信。'
    );
    assert.equal(state.result?.summary.actionCount, 1);
    assert.equal(state.result?.summary.qualityCheckCount, 1);
    assert.equal(state.result?.summary.candidateCount, 1);
    assert.equal(state.result?.warnings?.[0], '部分线索缺少电话');
  });

  it('normalizes raw organic task candidates into public candidate fields', () => {
    const state = createLeadSearchProgressStateFromTask(
      createTaskRecord({
        status: 'completed',
        result: {
          keywordOptimization: createKeywordPlan(),
          keywordOptimizationText: JSON.stringify(createKeywordPlan()),
          serperRequests: [{ endpoint: 'search', requestBody: { q: 'bearing supplier Riyadh' } }],
          serperResults: [],
          decisions: [{ accepted: true }],
          candidates: [
            {
              sourceType: 'organic',
              title: 'Bearing House',
              url: 'https://bearing.example.com',
              snippet: 'bearing distributor'
            }
          ],
          stopReason: '所有查询已完成'
        }
      })
    );

    assert.deepEqual(state.result?.candidates[0], {
      title: 'Bearing House',
      website: 'https://bearing.example.com',
      snippet: 'bearing distributor',
      country: undefined,
      city: undefined,
      address: undefined,
      phoneNumber: undefined,
      sourceType: 'organic',
      sourceLabel: '公开线索',
      sourceUrl: 'https://bearing.example.com',
      score: undefined,
      reason: undefined
    });
  });

  it('keeps failed task status when the persisted progress state is an earlier running event', () => {
    const state = createLeadSearchProgressStateFromTask(
      createTaskRecord({
        status: 'failed',
        errorMessage: 'Serper 调用失败',
        progressState: {
          type: 'step_progress',
          runId: 'run-1',
          sequence: 3,
          emittedAt: '2026-06-18T00:00:02.000Z',
          stepKey: 'collect_public_leads',
          title: '采集公开线索',
          progressPercent: 46
        }
      })
    );

    assert.equal(state.status, 'failed');
    assert.equal(state.errorMessage, 'Serper 调用失败');
    assert.equal(state.progressPercent, 46);
  });

  it('keeps interrupted task status when the persisted progress state is an earlier running event', () => {
    const state = createLeadSearchProgressStateFromTask(
      createTaskRecord({
        status: 'interrupted',
        progressState: {
          type: 'step_progress',
          runId: 'run-1',
          sequence: 3,
          emittedAt: '2026-06-18T00:00:02.000Z',
          stepKey: 'collect_public_leads',
          title: '采集公开线索',
          progressPercent: 46
        }
      })
    );

    assert.equal(state.status, 'interrupted');
    assert.equal(state.currentTitle, '采集任务已中断');
    assert.equal(state.progressPercent, 46);
  });

  it('exposes task action availability by backend task status', () => {
    assert.deepEqual(getLeadSearchTaskActionState('queued'), {
      canInterrupt: false,
      canResume: false,
      canRetry: false,
      canDiscard: true,
      canMarkRead: false
    });
    assert.deepEqual(getLeadSearchTaskActionState('running'), {
      canInterrupt: true,
      canResume: false,
      canRetry: false,
      canDiscard: false,
      canMarkRead: false
    });
    assert.deepEqual(getLeadSearchTaskActionState('interrupted'), {
      canInterrupt: false,
      canResume: true,
      canRetry: false,
      canDiscard: true,
      canMarkRead: false
    });
    assert.deepEqual(getLeadSearchTaskActionState('failed'), {
      canInterrupt: false,
      canResume: false,
      canRetry: true,
      canDiscard: true,
      canMarkRead: false
    });
    assert.deepEqual(getLeadSearchTaskActionState('completed'), {
      canInterrupt: false,
      canResume: false,
      canRetry: false,
      canDiscard: false,
      canMarkRead: true
    });
    assert.equal(isLeadSearchTaskPending('completed'), false);
  });

  it('hides read action after a completed task has already been read', () => {
    assert.deepEqual(getLeadSearchTaskActionState('completed', '2026-06-18T00:30:00.000Z'), {
      canInterrupt: false,
      canResume: false,
      canRetry: false,
      canDiscard: false,
      canMarkRead: false
    });
  });

  it('clears task context after read or discard actions are accepted', () => {
    assert.equal(shouldClearSearchTaskAfterAction('read'), true);
    assert.equal(shouldClearSearchTaskAfterAction('discard'), true);
    assert.equal(shouldClearSearchTaskAfterAction('retry'), false);
    assert.equal(shouldClearSearchTaskAfterAction('resume'), false);
    assert.equal(shouldClearSearchTaskAfterAction('interrupt'), false);
  });
});

function createTaskRecord(overrides: Partial<Api.AiLeads.TaskRecord> = {}): Api.AiLeads.TaskRecord {
  return {
    id: 'task-1',
    userId: 'u-1',
    userName: 'AI外贸管理系统',
    organizationId: 'org-1',
    organizationRole: 'admin',
    requirement: '找沙特轴承进口商',
    targetLeadCount: 20,
    keywordPlan: createKeywordPlan(),
    status: 'queued',
    priority: 0,
    runVersion: 1,
    progressState: null,
    result: null,
    errorMessage: null,
    bullJobId: null,
    readAt: null,
    notifiedAt: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-06-18T00:00:00.000Z',
    updatedAt: '2026-06-18T00:00:00.000Z',
    ...overrides
  };
}

function createKeywordPlan(): Api.AiLeads.OptimizedKeywordPlan {
  return {
    resolvedProductKeywords: '6204 bearing',
    resolvedTargetRegions: '沙特阿拉伯',
    resolvedTargetCustomerProfile: '进口商',
    resolvedTargetLeadCount: 20,
    structuredRequirement: '找沙特轴承进口商',
    buyerSegments: [],
    serperSearchQueries: [],
    searchExecutionRules: {
      keep: [],
      exclude: [],
      websiteCheckPages: [],
      dedupeKeys: []
    }
  };
}
