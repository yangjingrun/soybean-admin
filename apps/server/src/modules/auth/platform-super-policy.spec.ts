import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AiGatewayController } from '../ai-gateway/ai-gateway.controller';
import { AiLeadsController } from '../ai-leads/ai-leads.controller';
import { CrmController } from '../crm/crm.controller';
import { SystemLogController } from '../system-log/system-log.controller';
import { SystemUserController } from '../system-user/system-user.controller';
import { AUTH_POLICY_KEY, OrganizationAdminOnly, ROLE_DENIED_MESSAGE_KEY, ROLES_KEY } from './auth.decorators';

describe('platform super route policy', () => {
  it('declares system management controllers as platform-super-only', () => {
    assertSuperOnly(SystemUserController, '无权访问用户管理');
    assertSuperOnly(SystemLogController, '无权访问后端日志');
  });

  it('declares AI config and queue config endpoints as platform-super-only', () => {
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
      assertSuperOnly(getMethod(AiGatewayController, method), '无权维护 AI 配置');
    }

    assertSuperOnly(getMethod(AiLeadsController, 'getQueueConfig'), '无权维护 AI 获客任务配置');
    assertSuperOnly(getMethod(AiLeadsController, 'saveQueueConfig'), '无权维护 AI 获客任务配置');
  });

  it('declares CRM platform maintenance endpoints as platform-super-only without touching resource routes', () => {
    for (const method of [
      'getGlobalConfig',
      'saveGlobalConfig',
      'getAiDraftQueueConfig',
      'saveAiDraftQueueConfig',
      'reconcileSendQueue'
    ]) {
      assertSuperOnly(getMethod(CrmController, method), '无权维护 CRM 全局配置');
    }

    assertSuperOnly(getMethod(CrmController, 'mockAuthorizeMailbox'), '无权使用 CRM mock 接口');
    assertSuperOnly(getMethod(CrmController, 'mockCustomerReply'), '无权使用 CRM mock 接口');
    assert.equal(Reflect.getMetadata(ROLES_KEY, getMethod(CrmController, 'listAccounts')), undefined);
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

function getMethod(controller: { prototype: object }, method: string) {
  const value = Reflect.get(controller.prototype, method);

  assert.equal(typeof value, 'function');

  return value;
}
