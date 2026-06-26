import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aiLeadsKeywordStrategyManagePermission,
  aiLeadsQueueConfigManagePermission,
  crmPermissionCodes,
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

    assert.equal(permissionMap.get(aiLeadsQueueConfigManagePermission)?.pageLabel, '模型配置');
  });

  it('does not expose personal provider channels as assignable role permissions', () => {
    assert.equal(crmPermissionCodes.map(String).includes('ai:settings:model:manage'), false);
    assert.equal(crmPermissionCodes.map(String).includes('ai:settings:serper:manage'), false);
    assert.equal(crmPermissionCodes.map(String).includes('ai:settings:hunter:manage'), false);
    assert.equal(crmPermissionDefinitions.map<string>(item => item.group).includes('ai_settings_model'), false);
    assert.equal(crmPermissionDefinitions.map<string>(item => item.group).includes('ai_settings_serper'), false);
    assert.equal(crmPermissionDefinitions.map<string>(item => item.group).includes('ai_settings_hunter'), false);
    assert.equal(getDefaultPermissionCodesByRoles(['R_SUPER']).map(String).includes('ai:settings:model:manage'), false);
    assert.equal(
      getDefaultPermissionCodesByRoles(['R_SUPER']).map(String).includes('ai:settings:serper:manage'),
      false
    );
    assert.equal(
      getDefaultPermissionCodesByRoles(['R_SUPER']).map(String).includes('ai:settings:hunter:manage'),
      false
    );
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

  it('grants ordinary users only the CRM read permissions required by email sequences', () => {
    assert.deepEqual(getDefaultPermissionCodesByRoles(['R_USER']), [
      'crm:settings:assets:read',
      'crm:settings:rules:read'
    ]);
    assert.equal(hasPermission({ roles: ['R_USER'], buttons: [] }, 'crm:settings:assets:read'), true);
    assert.equal(hasPermission({ roles: ['R_USER'], buttons: [] }, 'crm:settings:rules:read'), true);
    assert.equal(hasPermission({ roles: ['R_USER'], buttons: [] }, 'crm:settings:assets:write'), false);
    assert.equal(hasPermission({ roles: ['R_USER'], buttons: [] }, 'crm:settings:rules:write'), false);
  });

  it('uses one permission for each AI settings function', () => {
    const aiSettingsConfigPermissions = crmPermissionDefinitions.filter(item => item.group.startsWith('ai_settings_'));

    assert.deepEqual(
      aiSettingsConfigPermissions.map(item => item.code),
      ['ai:settings:prompt:manage']
    );
  });
});
