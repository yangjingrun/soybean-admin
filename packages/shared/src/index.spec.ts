import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aiSettingsHunterWritePermission,
  aiSettingsModelWritePermission,
  aiSettingsSerperWritePermission,
  aiLeadsKeywordStrategyManagePermission,
  aiLeadsQueueConfigManagePermission,
  crmPermissionDefinitions,
  getDefaultPermissionCodesByRoles,
  hasPermission
} from './index';

describe('shared permissions', () => {
  it('defines configurable AI leads keyword strategy maintenance permission', () => {
    const permission = crmPermissionDefinitions.find(item => item.code === aiLeadsKeywordStrategyManagePermission);

    assert.equal(permission?.label, '维护 AI 获客搜索策略');
    assert.equal(permission?.group, 'ai_leads');
    assert.equal(permission?.groupLabel, 'AI 获客');
    assert.equal(permission?.moduleLabel, 'AI 获客');
    assert.equal(permission?.pageLabel, 'AI 获客');
    assert.equal(permission?.functionLabel, '搜索策略');
  });

  it('defines page-aware AI platform configuration permissions', () => {
    const permissionMap = new Map(crmPermissionDefinitions.map(item => [item.code, item]));

    assert.equal(permissionMap.get(aiSettingsModelWritePermission)?.pageLabel, '模型配置');
    assert.equal(permissionMap.get(aiSettingsSerperWritePermission)?.functionLabel, 'Serper 搜索配置');
    assert.equal(permissionMap.get(aiSettingsHunterWritePermission)?.functionLabel, 'Hunter 邮箱补全');
    assert.equal(permissionMap.get(aiLeadsQueueConfigManagePermission)?.pageLabel, '模型配置');
  });

  it('grants AI leads keyword strategy maintenance to super users and configurable roles', () => {
    assert.equal(getDefaultPermissionCodesByRoles(['R_SUPER']).includes(aiLeadsKeywordStrategyManagePermission), true);
    assert.equal(getDefaultPermissionCodesByRoles(['R_ADMIN']).includes(aiLeadsKeywordStrategyManagePermission), false);
    assert.equal(
      hasPermission(
        {
          roles: ['R_USER'],
          buttons: [aiLeadsKeywordStrategyManagePermission]
        },
        aiLeadsKeywordStrategyManagePermission
      ),
      true
    );
  });

  it('keeps AI settings write permissions normalized with their read permissions', () => {
    assert.equal(
      hasPermission(
        {
          roles: ['R_USER'],
          buttons: [aiSettingsSerperWritePermission]
        },
        'ai:settings:serper:read'
      ),
      true
    );
  });
});
