import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const pageSource = readFileSync(new URL('./index.vue', import.meta.url), 'utf8');

/** Reads the explicit Naive UI button size for a toolbar button by one stable source marker. */
function getButtonSizeByMarker(marker: string) {
  const markerIndex = pageSource.lastIndexOf(marker);

  assert.notEqual(markerIndex, -1, `Expected to find button marker: ${marker}`);

  const buttonStartIndex = pageSource.lastIndexOf('<NButton', markerIndex);
  const buttonEndIndex = pageSource.indexOf('>', buttonStartIndex);
  const openingTag = pageSource.slice(buttonStartIndex, buttonEndIndex);
  const sizeMatch = openingTag.match(/\ssize="([^"]+)"/);

  return sizeMatch?.[1] ?? 'default';
}

describe('AI leads toolbar', () => {
  it('keeps primary workflow action buttons at the same size', () => {
    const buttonSizes = ['handleGenerate', 'handleSearchCustomers', 'handleClear'].map(getButtonSizeByMarker);

    assert.deepEqual(buttonSizes, ['small', 'small', 'small']);
  });

  it('keeps task read action out of the primary toolbar copy', () => {
    assert.equal(pageSource.includes('确认结果'), false);
    assert.match(pageSource, /继续采集更多/);
    assert.match(pageSource, /开始新任务/);
  });
});
