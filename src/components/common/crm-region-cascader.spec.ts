import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const componentSource = readFileSync(new URL('./crm-region-cascader.vue', import.meta.url), 'utf8');

describe('crm region cascader component', () => {
  it('keeps country nodes selectable while filtering', () => {
    assert.doesNotMatch(componentSource, /check-strategy="child"/);
  });

  it('explicitly keeps the picker in single-select non-cascade mode', () => {
    assert.match(componentSource, /:multiple="false"/);
    assert.match(componentSource, /:cascade="false"/);
    assert.doesNotMatch(componentSource, /<NCascader[\s\S]*\n\s+cascade\b/);
  });

  it('hides checkbox prefixes if Naive UI renders them from cached state', () => {
    assert.match(componentSource, /\.crm-region-cascader-menu \.n-cascader-option__prefix/);
    assert.match(componentSource, /\.crm-region-cascader-menu \.n-cascader-option \.n-checkbox/);
    assert.match(componentSource, /display:\s*none/);
    assert.match(componentSource, /:render-prefix="renderEmptyRegionPrefix"/);
  });

  it('keeps compact option spacing after checkbox prefixes are removed', () => {
    assert.match(componentSource, /\.crm-region-cascader-menu \.n-cascader-option\)/);
    assert.match(componentSource, /\.crm-region-cascader-menu \.n-cascader-option--show-prefix/);
    assert.match(componentSource, /padding-left:\s*8px/);
  });

  it('keeps filtered search menu height consistent with the default cascader menu', () => {
    assert.match(componentSource, /\.crm-region-cascader-menu \.n-base-select-menu \.n-scrollbar/);
    assert.match(componentSource, /\.crm-region-cascader-menu \.n-base-select-menu-option-wrapper/);
    assert.match(componentSource, /max-height:\s*var\(--n-menu-height\)/);
  });

  it('selects country nodes when clicking the rendered country label', () => {
    assert.match(componentSource, /function handleRegionLabelClick/);
    assert.match(componentSource, /option\.nodeType !== 'country'/);
    assert.match(componentSource, /event\.stopPropagation\(\)/);
    assert.match(componentSource, /handleRegionUpdate\(option\.value\)/);
    assert.match(componentSource, /onClick: \(event: MouseEvent\) => handleRegionLabelClick/);
  });
});
