import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const pageSource = readFileSync(new URL('./index.vue', import.meta.url), 'utf8');

/** Reads the explicit Naive UI button size for a toolbar button label. */
function getButtonSizeByLabel(label: string) {
  const labelIndex = pageSource.indexOf(label);

  assert.notEqual(labelIndex, -1, `Expected to find button label: ${label}`);

  const buttonStartIndex = pageSource.lastIndexOf('<NButton', labelIndex);
  const buttonEndIndex = pageSource.indexOf('>', buttonStartIndex);
  const openingTag = pageSource.slice(buttonStartIndex, buttonEndIndex);
  const sizeMatch = openingTag.match(/\ssize="([^"]+)"/);

  return sizeMatch?.[1] ?? 'default';
}

describe('AI leads toolbar', () => {
  it('keeps primary workflow action buttons at the same size', () => {
    const buttonSizes = ['优化关键词', '开始搜索采集', '清空'].map(getButtonSizeByLabel);

    assert.deepEqual(buttonSizes, ['default', 'default', 'default']);
  });
});
