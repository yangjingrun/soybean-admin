import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AiGatewayController } from '../ai-gateway/ai-gateway.controller';
import { AiLeadsController } from '../ai-leads/ai-leads.controller';
import { CrmAccountController } from '../crm/controllers/crm-account.controller';
import { CrmInboxController } from '../crm/controllers/crm-inbox.controller';
import { CrmMailboxController } from '../crm/controllers/crm-mailbox.controller';
import { CrmSettingsController } from '../crm/controllers/crm-settings.controller';
import { SystemLogController } from '../system-log/system-log.controller';
import { SystemUserController } from '../system-user/system-user.controller';
import { AUTH_POLICY_KEY, OrganizationAdminOnly, ROLE_DENIED_MESSAGE_KEY, ROLES_KEY } from './auth.decorators';

describe('platform super route policy', () => {
  it('declares system management controllers as platform-super-only', () => {
    assertSuperOnly(SystemUserController, '无权访问用户管理');
    assertSuperOnly(SystemLogController, '无权访问后端日志');
  });

  it('lets AI config and queue config endpoints use dynamic product permissions', () => {
    const aiConfigMethods = [
      'savePrompt',
      'getPrompt',
      'saveModelConfig',
      'getModelConfig',
      'saveSerperConfig',
      'getSerperConfig',
      'testSerperConfig',
      'saveHunterConfig',
      'getHunterConfig',
      'testHunterConfig'
    ];

    for (const method of aiConfigMethods) {
      assertNotSuperOnly(getMethod(AiGatewayController, method));
    }

    assertNotSuperOnly(getMethod(AiLeadsController, 'getQueueConfig'));
    assertNotSuperOnly(getMethod(AiLeadsController, 'saveQueueConfig'));
  });

  it('lets CRM platform maintenance endpoints use dynamic product permissions without touching resource routes', () => {
    for (const method of [
      'getGlobalConfig',
      'saveGlobalConfig',
      'getAiDraftQueueConfig',
      'saveAiDraftQueueConfig',
      'reconcileSendQueue'
    ]) {
      assertNotSuperOnly(getMethod(CrmSettingsController, method));
    }

    assertSuperOnly(getMethod(CrmMailboxController, 'mockAuthorizeMailbox'), '无权使用 CRM mock 接口');
    assertSuperOnly(getMethod(CrmInboxController, 'mockCustomerReply'), '无权使用 CRM mock 接口');
    assert.equal(Reflect.getMetadata(ROLES_KEY, getMethod(CrmAccountController, 'listAccounts')), undefined);
  });

  it('keeps organization-admin policy metadata available for future route-level policies', () => {
    class ExampleController {
      @OrganizationAdminOnly('需要组织管理员权限')
      handle() {}
    }

    assert.deepEqual(Reflect.getMetadata(AUTH_POLICY_KEY, getMethod(ExampleController, 'handle')), {
      anyRoles: ['R_SUPER'],
      anyOrganizationRoles: ['admin'],
      deniedMessage: '需要组织管理员权限'
    });
  });
});

function assertSuperOnly(target: object, message: string) {
  assert.deepEqual(Reflect.getMetadata(AUTH_POLICY_KEY, target), { anyRoles: ['R_SUPER'], deniedMessage: message });
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, target), ['R_SUPER']);
  assert.equal(Reflect.getMetadata(ROLE_DENIED_MESSAGE_KEY, target), message);
}

function assertNotSuperOnly(target: object) {
  assert.equal(Reflect.getMetadata(AUTH_POLICY_KEY, target), undefined);
  assert.equal(Reflect.getMetadata(ROLES_KEY, target), undefined);
}

function getMethod(controller: { prototype: object }, method: string) {
  const value = Reflect.get(controller.prototype, method);

  assert.equal(typeof value, 'function');

  return value;
}
