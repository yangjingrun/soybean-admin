import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createAiResultFromSearchTask,
  createStartingSearchProgressState,
  shouldRestoreSearchTaskAfterCreateRequestError
} from './useAiLeadSearchTask';

function createTask(overrides: Partial<Api.AiLeads.TaskRecord> = {}): Api.AiLeads.TaskRecord {
  return {
    id: 'task-1',
    userId: 'user-1',
    userName: 'Alice',
    organizationId: 'org-1',
    organizationRole: 'member',
    requirement: 'Find buyers',
    targetLeadCount: 20,
    productLineId: 'product-line-1',
    productLineSnapshot: {
      id: 'product-line-1',
      name: 'Bearing line'
    },
    keywordPlan: {
      resolvedProductKeywords: 'bearing',
      resolvedTargetRegions: 'Saudi Arabia',
      resolvedTargetCustomerProfile: 'importer',
      resolvedTargetLeadCount: 20,
      structuredRequirement: 'Find bearing importers',
      buyerSegments: [],
      serperSearchQueries: [],
      searchExecutionRules: {
        keep: [],
        exclude: [],
        websiteCheckPages: [],
        dedupeKeys: []
      }
    },
    status: 'running',
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
    createdAt: '2026-06-20T01:00:00.000Z',
    updatedAt: '2026-06-20T01:00:00.000Z',
    ...overrides
  };
}

describe('AI lead search task helpers', () => {
  it('creates the starting progress state for a submitted background task', () => {
    assert.deepEqual(createStartingSearchProgressState().status, 'running');
    assert.equal(createStartingSearchProgressState().progressPercent, 3);
  });

  it('creates an AI text result from a restored search task keyword plan', () => {
    const result = createAiResultFromSearchTask(createTask());

    assert.equal(result.finishReason, 'running');
    assert.match(result.text, /resolvedTargetLeadCount/);
    assert.equal(result.usage.totalTokens, null);
  });

  it('restores only pending tasks after create request errors', () => {
    assert.equal(shouldRestoreSearchTaskAfterCreateRequestError(createTask({ status: 'queued' })), true);
    assert.equal(shouldRestoreSearchTaskAfterCreateRequestError(createTask({ status: 'running' })), true);
    assert.equal(
      shouldRestoreSearchTaskAfterCreateRequestError(
        createTask({ status: 'failed', errorMessage: 'Custom Id cannot contain :' })
      ),
      false
    );
  });
});
