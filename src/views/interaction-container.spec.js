import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
const userPageSource = readFileSync(new URL('./manage/user/index.vue', import.meta.url), 'utf8');
const rolePageSource = readFileSync(new URL('./manage/role/index.vue', import.meta.url), 'utf8');
const productLineManagerSource = readFileSync(
  new URL('./crm/settings/modules/ProductLineManager.vue', import.meta.url),
  'utf8'
);
const operationsPanelSource = readFileSync(
  new URL('./crm/settings/modules/CrmOperationsPanel.vue', import.meta.url),
  'utf8'
);
describe('management interaction containers', () => {
  it('uses modal containers for short user and role edit forms', () => {
    assert.match(userPageSource, /UserOperateModal/);
    assert.doesNotMatch(userPageSource, /UserOperateDrawer/);
    assert.match(rolePageSource, /RoleOperateModal/);
    assert.doesNotMatch(rolePageSource, /RoleOperateDrawer/);
  });
  it('uses a drawer container for the dense CRM product line form', () => {
    assert.match(productLineManagerSource, /ProductLineFormDrawer/);
    assert.doesNotMatch(productLineManagerSource, /ProductLineFormModal/);
  });
  it('keeps CRM operation details wide enough for diagnostics fields', () => {
    assert.match(operationsPanelSource, /<NDrawer v-model:show="detailVisible" :width="560" placement="right">/);
  });
});
