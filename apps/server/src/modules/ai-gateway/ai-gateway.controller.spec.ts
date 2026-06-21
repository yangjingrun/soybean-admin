import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { aiSettingsModelManagePermission } from '@soybean/shared';
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

  it('requires dynamic model config permission before saving model config', async () => {
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

  it('allows assigned roles to save model config without platform super role', async () => {
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
      createUser([aiSettingsModelManagePermission])
    );

    assert.deepEqual(response.data, { configKey: 'default' });
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
