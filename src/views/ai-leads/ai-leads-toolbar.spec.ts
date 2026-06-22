import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const pageSource = readFileSync(new URL('./index.vue', import.meta.url), 'utf8');
const pageComposableSource = readFileSync(new URL('./modules/useAiLeadPage.ts', import.meta.url), 'utf8');
const searchProgressPanelSource = readFileSync(new URL('./modules/SearchProgressPanel.vue', import.meta.url), 'utf8');

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
    const buttonSizes = ['data-action="generate"', 'handlePrimarySearchAction', 'handleClear'].map(
      getButtonSizeByMarker
    );

    assert.deepEqual(buttonSizes, ['small', 'small', 'small']);
  });

  it('uses the primary search button as the interrupt action while collecting', () => {
    assert.match(pageSource, /const isPrimarySearchInterruptAction = computed/);
    assert.match(pageSource, /handleSearchTaskAction\('interrupt'\)/);
    assert.match(
      pageSource,
      /const searchPrimaryButtonType = computed\(\(\) => \(isPrimarySearchInterruptAction\.value \? 'error' : 'primary'\)\);/
    );
    assert.equal(pageSource.includes("{ key: 'interrupt', label: '中断'"), false);
  });

  it('keeps task read action out of the primary toolbar copy', () => {
    assert.equal(pageSource.includes('确认结果'), false);
    assert.match(pageSource, /继续采集更多/);
    assert.match(pageSource, /开始新任务/);
  });

  it('does not expose keyword plan as a primary result tab', () => {
    assert.equal(pageSource.includes('<NTabs'), false);
    assert.equal(pageSource.includes('tab="关键词方案"'), false);
    assert.equal(pageSource.includes('tab="采集结果"'), false);
    assert.match(pageSource, /搜索策略已准备好/);
  });

  it('keeps search collection as the final visible workflow step', () => {
    assert.equal(pageSource.includes("title: '导入 CRM'"), false);
    assert.equal(pageSource.includes('采集完成后处理候选客户'), false);
    assert.match(pageSource, /title: '搜索采集'/);
  });

  it('guides completed search tasks into the CRM source-task lead queue', () => {
    assert.match(pageComposableSource, /handleProcessCollectedLeads/);
    assert.match(pageComposableSource, /sourceTaskId: task\.id/);
    assert.match(pageSource, /@process-collected-leads="handleProcessCollectedLeads"/);
    assert.match(searchProgressPanelSource, /处理本次客户/);
    assert.match(searchProgressPanelSource, /可用线索已自动沉淀到 CRM/);
    assert.equal(searchProgressPanelSource.includes('导入 CRM'), false);
  });

  it('makes restored keyword history visible before re-optimizing', () => {
    assert.match(pageComposableSource, /isRestoredKeywordHistory/);
    assert.match(pageSource, /已选中关键词历史/);
    assert.match(pageSource, /历史搜索策略已选中/);
    assert.match(pageSource, /重新优化/);
    assert.match(pageSource, /@positive-click="handleGenerate"/);
    assert.match(pageSource, /data-action="generate"/);
  });

  it('keeps debug details in the bottom-left result area', () => {
    assert.match(pageSource, /result-debug-footer/);
    assert.match(pageSource, /debug-collapse/);
    assert.match(pageSource, /\.result-debug-footer\s*\{[^}]*width: 100%;/);
  });

  it('opens and highlights debug details when editing keyword result', () => {
    assert.match(pageSource, /function handleStartKeywordResultEdit\(\)/);
    assert.match(pageSource, /v-model:expanded-names="debugExpandedNames"/);
    assert.match(pageSource, /:class="debugFooterClass"/);
    assert.match(pageSource, /is-editing-focus/);
    assert.match(pageSource, /正在编辑搜索策略调试信息/);
  });

  it('uses configurable keyword strategy permission for edit and debug controls', () => {
    assert.match(pageSource, /canManageKeywordStrategy/);
    assert.match(pageComposableSource, /aiLeadsKeywordStrategyManagePermission/);
    assert.match(
      pageComposableSource,
      /hasPermission\(authStore\.userInfo,\s*aiLeadsKeywordStrategyManagePermission\)/
    );
    assert.match(pageSource, /!hasSearchProgress && aiResult && canManageKeywordStrategy/);
    assert.match(pageSource, /v-if="canManageKeywordStrategy"/);
    assert.match(pageSource, /:show-serper-details="canManageKeywordStrategy"/);
  });

  it('keeps result content padded below the card header', () => {
    assert.match(pageSource, /\.result-card\s+:deep\(\.result-card-content\)\s*\{[^}]*padding: 16px;/);
  });
});
