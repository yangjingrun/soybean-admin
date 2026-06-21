import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aiLeadsKeywordStrategyManagePermission,
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
});
