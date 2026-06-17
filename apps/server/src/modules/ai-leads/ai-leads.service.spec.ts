import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { UserInfo } from '../auth/auth.types';
import type { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import type { GenerateAiTextDto } from '../ai-gateway/dto/generate-ai-text.dto';
import { defaultAiModelConfigKey, leadKeywordOptimizePromptKey } from '../ai-gateway/ai-gateway.constants';
import { AiLeadsService } from './ai-leads.service';

describe('AiLeadsService', () => {
  it('uses the fixed keyword optimization prompt for AI leads requirement text', async () => {
    const user: UserInfo = {
      userId: 'u-1',
      userName: 'Super',
      roles: ['R_SUPER'],
      buttons: []
    };
    let capturedDto: GenerateAiTextDto | null = null;
    let capturedContext: unknown = null;
    const aiGatewayService = {
      async generateText(dto: GenerateAiTextDto, context: unknown) {
        capturedDto = dto;
        capturedContext = context;

        return {
          text: '关键词优化结果',
          finishReason: 'stop',
          usage: {
            inputTokens: 12,
            outputTokens: 8,
            totalTokens: 20
          }
        };
      }
    } as unknown as AiGatewayService;
    const service = new AiLeadsService(aiGatewayService);

    const result = await service.optimizeKeywords(
      {
        requirement: '  我是河北卖轴承的，想找沙特进口商  '
      },
      { user }
    );

    assert.deepEqual(capturedDto, {
      modelConfigKey: defaultAiModelConfigKey,
      promptKey: leadKeywordOptimizePromptKey,
      prompt: '我是河北卖轴承的，想找沙特进口商'
    });
    assert.deepEqual(capturedContext, { user });
    assert.equal(result.text, '关键词优化结果');
  });
});
