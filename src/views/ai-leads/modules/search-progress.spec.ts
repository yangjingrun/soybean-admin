import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canReturnToKeywordOptimizationStep,
  createLeadSearchProgressState,
  getMetricDisplayText,
  isSearchWorkflowFinished,
  reduceLeadSearchProgressEvent
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
        candidates: [{ title: 'Bearing House', website: 'https://bearing.example.com', sourceLabel: '公开线索' }]
      }
    });

    assert.equal(state.status, 'completed');
    assert.equal(state.result?.summary.candidateCount, 18);
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
});
