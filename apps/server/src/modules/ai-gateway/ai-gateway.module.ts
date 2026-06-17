import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SystemLogModule } from '../system-log/system-log.module';
import { AiGatewayController } from './ai-gateway.controller';
import { AiGatewayService } from './ai-gateway.service';
import { AiSdkTextGenerator } from './ai-sdk-text-generator.service';
import { AI_MODEL_CONFIG_STORE, AI_PROMPT_STORE, AI_TEXT_GENERATOR } from './ai-gateway.tokens';
import { PrismaAiModelConfigStore } from './prisma-ai-model-config.store';
import { PrismaAiPromptStore } from './prisma-ai-prompt.store';

@Module({
  imports: [AuthModule, DatabaseModule, SystemLogModule],
  controllers: [AiGatewayController],
  providers: [
    AiGatewayService,
    {
      provide: AI_TEXT_GENERATOR,
      useClass: AiSdkTextGenerator
    },
    {
      provide: AI_PROMPT_STORE,
      useClass: PrismaAiPromptStore
    },
    {
      provide: AI_MODEL_CONFIG_STORE,
      useClass: PrismaAiModelConfigStore
    }
  ],
  exports: [AiGatewayService]
})
export class AiGatewayModule {}
