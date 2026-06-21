import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildRolePermissionChangePreview,
  buildSystemRoleSearchParams,
  createDefaultRoleFilterModel,
  getPermissionLabel,
  rolePermissionModules,
  rolePermissionGroups,
  roleStatusLabelMap
} from './shared';

describe('system role shared helpers', () => {
  it('builds role search params and skips empty filters', () => {
    assert.deepEqual(
      buildSystemRoleSearchParams({
        current: 2,
        size: 20,
        filterModel: {
          keyword: ' admin ',
          status: 'enabled'
        }
      }),
      {
        current: 2,
        size: 20,
        keyword: 'admin',
        status: 'enabled'
      }
    );

    assert.deepEqual(
      buildSystemRoleSearchParams({
        current: 1,
        size: 10,
        filterModel: createDefaultRoleFilterModel()
      }),
      {
        current: 1,
        size: 10
      }
    );
  });

  it('exposes permission groups and role status labels', () => {
    assert.equal(roleStatusLabelMap.enabled, '启用');
    assert.equal(roleStatusLabelMap.disabled, '禁用');
    assert.equal(getPermissionLabel('crm:settings:assets:write'), '维护写信资料');
    assert.equal(rolePermissionGroups.some(group => group.key === 'crm_settings_assets'), true);
  });

  it('groups permissions by module and page for readable role authorization', () => {
    const aiModule = rolePermissionModules.find(module => module.key === 'ai_platform');
    const modelPage = aiModule?.pages.find(page => page.key === 'ai_platform_model_config');

    assert.equal(aiModule?.label, 'AI 平台配置');
    assert.equal(modelPage?.label, '模型配置');
    assert.equal(modelPage?.groups.some(group => group.key === 'ai_settings_model'), false);
    assert.equal(modelPage?.groups.some(group => group.key === 'ai_settings_serper'), true);
    assert.equal(modelPage?.groups.some(group => group.key === 'ai_settings_hunter'), true);
  });

  it('builds normalized role permission change previews', () => {
    const preview = buildRolePermissionChangePreview(
      ['crm:settings:assets:read'],
      ['crm:settings:assets:write']
    );

    assert.equal(preview.changed, true);
    assert.deepEqual(preview.added, ['crm:settings:assets:write']);
    assert.deepEqual(preview.removed, []);
  });
});
