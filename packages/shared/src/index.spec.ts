import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aiSettingsHunterManagePermission,
  aiSettingsModelManagePermission,
  aiSettingsSerperManagePermission,
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

    assert.equal(permissionMap.get(aiSettingsModelManagePermission)?.pageLabel, '模型配置');
    assert.equal(permissionMap.get(aiSettingsModelManagePermission)?.label, '配置模型通道');
    assert.equal(permissionMap.get(aiSettingsSerperManagePermission)?.functionLabel, 'Serper 搜索配置');
    assert.equal(permissionMap.get(aiSettingsHunterManagePermission)?.functionLabel, 'Hunter 邮箱补全');
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

  it('uses one permission for each AI settings function', () => {
    const aiSettingsConfigPermissions = crmPermissionDefinitions.filter(item => item.group.startsWith('ai_settings_'));

    assert.deepEqual(
      aiSettingsConfigPermissions.map(item => item.code),
      [
        'ai:settings:model:manage',
        'ai:settings:serper:manage',
        'ai:settings:hunter:manage',
        'ai:settings:prompt:manage'
      ]
    );
  });
});
