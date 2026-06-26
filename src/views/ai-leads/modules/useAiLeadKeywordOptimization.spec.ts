import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDefaultLeadSearchForm } from './useAiLeadKeywordOptimization';

describe('AI lead keyword optimization state helpers', () => {
  it('creates an empty requirement form with the default target lead count', () => {
    assert.deepEqual(createDefaultLeadSearchForm(20), {
      productLineId: null,
      requirement: '',
      targetLeadCount: 20,
      leadSourceMode: 'search'
    });
  });
});
