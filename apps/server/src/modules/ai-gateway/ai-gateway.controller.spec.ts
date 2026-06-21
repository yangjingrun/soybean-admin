import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { aiSettingsPromptManagePermission } from '@soybean/shared';
import type { RequestUserContext } from '../../shared/request-context';
import { AiGatewayController } from './ai-gateway.controller';

describe('AiGatewayController', () => {
  it('returns unauthorized when a super-only endpoint has no request context', async () => {
    const controller = new AiGatewayController({
      async getPrompt() {
        throw new Error('should not load prompt');
      }
    } as never);

    await assert.rejects(() => controller.getPrompt({ promptKey: 'lead-keyword-optimize' }, null), UnauthorizedException);
  });

  it('requires prompt permission before reading the built-in default prompt draft', async () => {
    let called = false;
    const controller = new AiGatewayController({
      async getDefaultPromptDraft() {
        called = true;
        return { promptKey: 'lead_search_result_decide' };
      }
    } as never);

    await assert.rejects(
      () => controller.getDefaultPrompt({ promptKey: 'lead_search_result_decide' }, createUser()),
      ForbiddenException
    );
    assert.equal(called, false);
  });

  it('allows platform super users to read the built-in default prompt draft', async () => {
    const controller = new AiGatewayController({
      async getDefaultPromptDraft(promptKey: string) {
        return { promptKey, systemPrompt: 'default prompt' };
      }
    } as never);

    const response = await controller.getDefaultPrompt({ promptKey: 'lead_search_result_decide' }, createSuperUser());

    assert.deepEqual(response.data, {
      promptKey: 'lead_search_result_decide',
      systemPrompt: 'default prompt'
    });
  });

  it('requires platform super role before saving platform model config', async () => {
    let called = false;
    const controller = new AiGatewayController({
      async saveModelConfig() {
        called = true;
        return { configKey: 'default' };
      }
    } as never);

    await assert.rejects(
      () =>
        controller.saveModelConfig(
          {
            configKey: 'default',
            title: '默认模型',
            providerName: 'openrouter',
            apiBase: 'https://openrouter.ai/api/v1',
            apiKey: 'sk-test',
            model: 'openai/gpt-4o-mini'
          },
          createUser()
        ),
      ForbiddenException
    );
    assert.equal(called, false);
  });

  it('allows platform super users to save legacy platform model config', async () => {
    const controller = new AiGatewayController({
      async saveModelConfig() {
        return { configKey: 'default' };
      }
    } as never);

    const response = await controller.saveModelConfig(
      {
        configKey: 'default',
        title: '默认模型',
        providerName: 'openrouter',
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-test',
        model: 'openai/gpt-4o-mini'
      },
      createSuperUser()
    );

    assert.deepEqual(response.data, { configKey: 'default' });
  });

  it('allows logged-in users to read their personal model config without platform model permission', async () => {
    const receivedUsers: RequestUserContext[] = [];
    const controller = new AiGatewayController({
      async getMyModelConfigDraft(user: RequestUserContext) {
        receivedUsers.push(user);
        return { providerName: 'openrouter' };
      }
    } as never);

    const response = await controller.getMyModelConfig(createUser());

    assert.equal(receivedUsers[0]?.userId, 'u-1');
    assert.deepEqual(response.data, { providerName: 'openrouter' });
  });

  it('allows logged-in users to save their personal model config without platform model permission', async () => {
    const receivedUsers: RequestUserContext[] = [];
    const controller = new AiGatewayController({
      async saveMyModelConfig(_dto: unknown, user: RequestUserContext) {
        receivedUsers.push(user);
        return { providerName: 'openrouter', model: 'openai/gpt-4o-mini' };
      }
    } as never);

    const response = await controller.saveMyModelConfig(
      {
        providerName: 'openrouter',
        apiBase: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-test',
        model: 'openai/gpt-4o-mini'
      },
      createUser()
    );

    assert.equal(receivedUsers[0]?.userId, 'u-1');
    assert.deepEqual(response.data, { providerName: 'openrouter', model: 'openai/gpt-4o-mini' });
  });

  it('allows logged-in users to manage personal Serper config without platform permissions', async () => {
    const receivedUsers: RequestUserContext[] = [];
    const controller = new AiGatewayController({
      async saveMySerperConfig(_dto: unknown, user: RequestUserContext) {
        receivedUsers.push(user);
        return { title: 'Serper 搜索' };
      },
      async getMySerperConfigDraft(user: RequestUserContext) {
        receivedUsers.push(user);
        return { title: 'Serper 搜索' };
      },
      async testMySerperConfig(_dto: unknown, user: RequestUserContext) {
        receivedUsers.push(user);
        return { ok: true };
      }
    } as never);

    assert.deepEqual((await controller.getMySerperConfig(createUser())).data, { title: 'Serper 搜索' });
    assert.deepEqual(
      (
        await controller.saveMySerperConfig(
          { title: 'Serper 搜索', apiBase: 'https://google.serper.dev', apiKey: 'serper-key' },
          createUser()
        )
      ).data,
      { title: 'Serper 搜索' }
    );
    assert.deepEqual(
      (
        await controller.testMySerperConfig(
          { title: 'Serper 搜索', apiBase: 'https://google.serper.dev', apiKey: 'serper-key' },
          createUser()
        )
      ).data,
      { ok: true }
    );
    assert.deepEqual(
      receivedUsers.map(user => user.userId),
      ['u-1', 'u-1', 'u-1']
    );
  });

  it('allows logged-in users to manage personal Hunter config without platform permissions', async () => {
    const receivedUsers: RequestUserContext[] = [];
    const controller = new AiGatewayController({
      async saveMyHunterConfig(_dto: unknown, user: RequestUserContext) {
        receivedUsers.push(user);
        return { title: 'Hunter 邮箱补全' };
      },
      async getMyHunterConfigDraft(user: RequestUserContext) {
        receivedUsers.push(user);
        return { title: 'Hunter 邮箱补全' };
      },
      async testMyHunterConfig(_dto: unknown, user: RequestUserContext) {
        receivedUsers.push(user);
        return { ok: true };
      }
    } as never);

    assert.deepEqual((await controller.getMyHunterConfig(createUser())).data, { title: 'Hunter 邮箱补全' });
    assert.deepEqual(
      (
        await controller.saveMyHunterConfig(
          { title: 'Hunter 邮箱补全', apiBase: 'https://api.hunter.io/v2', apiKey: 'hunter-key' },
          createUser()
        )
      ).data,
      { title: 'Hunter 邮箱补全' }
    );
    assert.deepEqual(
      (
        await controller.testMyHunterConfig(
          { title: 'Hunter 邮箱补全', apiBase: 'https://api.hunter.io/v2', apiKey: 'hunter-key' },
          createUser()
        )
      ).data,
      { ok: true }
    );
    assert.deepEqual(
      receivedUsers.map(user => user.userId),
      ['u-1', 'u-1', 'u-1']
    );
  });

  it('keeps legacy platform Serper and Hunter config endpoints super-only', async () => {
    const controller = new AiGatewayController({
      async saveSerperConfig() {
        return {};
      },
      async getSerperConfigDraft() {
        return {};
      },
      async testSerperConfig() {
        return {};
      },
      async saveHunterConfig() {
        return {};
      },
      async getHunterConfigDraft() {
        return {};
      },
      async testHunterConfig() {
        return {};
      }
    } as never);
    const serperDto = { configKey: 'default', title: 'Serper', apiBase: 'https://google.serper.dev', apiKey: 'key' };
    const hunterDto = { configKey: 'default', title: 'Hunter', apiBase: 'https://api.hunter.io/v2', apiKey: 'key' };

    await assert.rejects(() => controller.saveSerperConfig(serperDto, createUser()), ForbiddenException);
    await assert.rejects(() => controller.getSerperConfig({ configKey: 'default' }, createUser()), ForbiddenException);
    await assert.rejects(() => controller.testSerperConfig(serperDto, createUser()), ForbiddenException);
    await assert.rejects(() => controller.saveHunterConfig(hunterDto, createUser()), ForbiddenException);
    await assert.rejects(() => controller.getHunterConfig({ configKey: 'default' }, createUser()), ForbiddenException);
    await assert.rejects(() => controller.testHunterConfig(hunterDto, createUser()), ForbiddenException);
  });

  it('returns unauthorized when reading personal model config without request context', async () => {
    const controller = new AiGatewayController({
      async getMyModelConfigDraft() {
        throw new Error('should not read personal model config');
      }
    } as never);

    await assert.rejects(() => controller.getMyModelConfig(null), UnauthorizedException);
  });

  it('requires prompt permission before saving a prompt draft', async () => {
    let called = false;
    const controller = new AiGatewayController({
      async savePromptDraft() {
        called = true;
        return {};
      }
    } as never);

    await assert.rejects(
      () =>
        controller.savePromptDraft(
          {
            promptKey: 'lead_maps_keyword_optimize',
            title: '地图关键词优化',
            systemPrompt: 'prompt'
          },
          createUser()
        ),
      ForbiddenException
    );
    assert.equal(called, false);
  });

  it('passes the current user context through prompt workbench actions', async () => {
    const receivedUsers: string[] = [];
    const controller = new AiGatewayController({
      async listPromptWorkbenchSteps() {
        return [{ promptKey: 'lead_maps_keyword_optimize' }];
      },
      async getPromptWorkbenchDetail(promptKey: string) {
        return { promptKey };
      },
      validatePromptDraft(promptKey: string) {
        return { ok: true, items: [{ key: promptKey }] };
      },
      async savePromptDraft(_dto: unknown, user: RequestUserContext) {
        receivedUsers.push(user.userId);
        return { lifecycle: 'draft' };
      },
      async testPromptDraft(_dto: unknown, user: RequestUserContext) {
        receivedUsers.push(user.userId);
        return { success: true };
      },
      async publishPromptDraft(_dto: unknown, user: RequestUserContext) {
        receivedUsers.push(user.userId);
        return { version: 1 };
      },
      async rollbackPromptVersion(_dto: unknown, user: RequestUserContext) {
        receivedUsers.push(user.userId);
        return { version: 2 };
      }
    } as never);
    const user = createUser([aiSettingsPromptManagePermission]);

    assert.deepEqual((await controller.listPromptWorkbenchSteps(user)).data, [
      { promptKey: 'lead_maps_keyword_optimize' }
    ]);
    assert.deepEqual(
      (await controller.getPromptWorkbenchDetail({ promptKey: 'lead_maps_keyword_optimize' }, user)).data,
      { promptKey: 'lead_maps_keyword_optimize' }
    );
    assert.deepEqual(
      (
        await controller.validatePromptDraft({
          promptKey: 'lead_maps_keyword_optimize',
          systemPrompt: 'prompt'
        }, user)
      ).data,
      { ok: true, items: [{ key: 'lead_maps_keyword_optimize' }] }
    );
    assert.deepEqual(
      (
        await controller.savePromptDraft(
          {
            promptKey: 'lead_maps_keyword_optimize',
            title: '地图关键词优化',
            systemPrompt: 'prompt'
          },
          user
        )
      ).data,
      { lifecycle: 'draft' }
    );
    assert.deepEqual(
      (
        await controller.testPromptDraft(
          {
            promptKey: 'lead_maps_keyword_optimize',
            systemPrompt: 'prompt',
            inputPrompt: '找纽约轴承经销商'
          },
          user
        )
      ).data,
      { success: true }
    );
    assert.deepEqual(
      (
        await controller.publishPromptDraft(
          {
            promptKey: 'lead_maps_keyword_optimize',
            changeNote: '发布'
          },
          user
        )
      ).data,
      { version: 1 }
    );
    assert.deepEqual(
      (
        await controller.rollbackPromptVersion(
          {
            promptKey: 'lead_maps_keyword_optimize',
            versionId: 'version-1',
            changeNote: '回滚'
          },
          user
        )
      ).data,
      { version: 2 }
    );
    assert.deepEqual(receivedUsers, ['u-1', 'u-1', 'u-1', 'u-1']);
  });
});

function createUser(buttons: string[] = []): RequestUserContext {
  return {
    userId: 'u-1',
    userName: 'User',
    roles: ['R_USER'],
    buttons,
    organizationId: 'org-1',
    organizationRole: 'member'
  };
}

function createSuperUser(): RequestUserContext {
  return {
    ...createUser(),
    roles: ['R_SUPER'],
    organizationRole: 'admin'
  };
}
