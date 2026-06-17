import { Module } from '@nestjs/common';
import { AiGatewayController } from './ai-gateway.controller';
import { AiGatewayService } from './ai-gateway.service';
import { AiSdkTextGenerator } from './ai-sdk-text-generator.service';
import { AI_MODEL_CONFIG_STORE, AI_PROMPT_STORE, AI_TEXT_GENERATOR } from './ai-gateway.tokens';
import { RedisAiModelConfigStore } from './redis-ai-model-config.store';
import { RedisAiPromptStore } from './redis-ai-prompt.store';

@Module({
  controllers: [AiGatewayController],
  providers: [
    AiGatewayService,
    {
      provide: AI_TEXT_GENERATOR,
      useClass: AiSdkTextGenerator
    },
    {
      provide: AI_PROMPT_STORE,
      useClass: RedisAiPromptStore
    },
    {
      provide: AI_MODEL_CONFIG_STORE,
      useClass: RedisAiModelConfigStore
    }
  ]
})
export class AiGatewayModule {}
