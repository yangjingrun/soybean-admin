import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const componentSource = readFileSync(new URL('./crm-region-cascader.vue', import.meta.url), 'utf8');

describe('crm region cascader component', () => {
  it('keeps country nodes selectable while filtering', () => {
    assert.doesNotMatch(componentSource, /check-strategy="child"/);
  });

  it('keeps the picker single-select by default and allows opt-in multiple mode', () => {
    assert.match(componentSource, /multiple:\s*false/);
    assert.match(componentSource, /marketRegions:\s*false/);
    assert.match(componentSource, /:multiple="multiple"/);
    assert.match(componentSource, /marketRegions/);
    assert.match(componentSource, /:cascade="false"/);
    assert.doesNotMatch(componentSource, /<NCascader[\s\S]*\n\s+cascade\b/);
  });

  it('hides checkbox prefixes only for single-select menus', () => {
    assert.match(componentSource, /crm-region-cascader-menu--single/);
    assert.match(componentSource, /\.crm-region-cascader-menu--single \.n-cascader-option__prefix/);
    assert.match(componentSource, /\.crm-region-cascader-menu--single \.n-cascader-option \.n-checkbox/);
    assert.match(componentSource, /display:\s*none/);
    assert.match(componentSource, /:render-prefix="renderRegionPrefix"/);
    assert.match(componentSource, /props\.multiple \? node : null/);
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

  it('selects country and market region nodes when clicking the rendered label', () => {
    assert.match(componentSource, /function handleRegionLabelClick/);
    assert.match(componentSource, /function canSelectRegionByLabel/);
    assert.match(componentSource, /option\.nodeType === 'country'/);
    assert.match(componentSource, /option\.nodeType === 'marketRegion'/);
    assert.match(componentSource, /event\.stopPropagation\(\)/);
    assert.match(componentSource, /toggleSelectedRegionValue/);
    assert.match(componentSource, /emitRegionSelection/);
    assert.match(componentSource, /onClick: \(event: MouseEvent\) => handleRegionLabelClick/);
    assert.match(componentSource, /crm-region-cascader-selectable-label/);
  });

  it('emits selected path for form consumers that need country and province text', () => {
    assert.match(componentSource, /'update:selectedPath': \[path: CrmRegionCascaderOption\[\]\]/);
    assert.match(componentSource, /'update:selectedPaths': \[paths: CrmRegionCascaderOption\[\]\[\]\]/);
    assert.match(componentSource, /emit\('update:selectedPath', paths\[0\] \?\? \[\]\)/);
    assert.match(componentSource, /emit\('update:selectedPaths', paths\)/);
  });
});
