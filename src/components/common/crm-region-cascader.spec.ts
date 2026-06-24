import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const componentSource = readFileSync(new URL('./crm-region-cascader.vue', import.meta.url), 'utf8');

describe('crm region cascader component', () => {
  it('keeps country nodes selectable while filtering', () => {
    assert.doesNotMatch(componentSource, /check-strategy="child"/);
  });
});
