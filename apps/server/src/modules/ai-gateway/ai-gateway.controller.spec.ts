import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
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
});
