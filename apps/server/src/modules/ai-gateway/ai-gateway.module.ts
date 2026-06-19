import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SystemLogModule } from '../system-log/system-log.module';
import { AiGatewayController } from './ai-gateway.controller';
import { AiGatewayService } from './ai-gateway.service';
import { AiSdkTextGenerator } from './ai-sdk-text-generator.service';
import {
  AI_MODEL_CONFIG_STORE,
  AI_PROMPT_STORE,
  AI_TEXT_GENERATOR,
  HUNTER_CONFIG_STORE,
  SERPER_CONFIG_STORE
} from './ai-gateway.tokens';
import { PrismaAiModelConfigStore } from './prisma-ai-model-config.store';
import { PrismaAiPromptStore } from './prisma-ai-prompt.store';
import { PrismaHunterConfigStore } from './prisma-hunter-config.store';
import { PrismaSerperConfigStore } from './prisma-serper-config.store';
import { HunterClient } from './hunter-client.service';
import { SerperClient } from './serper-client.service';

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
    },
    {
      provide: SERPER_CONFIG_STORE,
      useClass: PrismaSerperConfigStore
    },
    {
      provide: HUNTER_CONFIG_STORE,
      useClass: PrismaHunterConfigStore
    },
    {
      provide: HunterClient,
      useFactory: () => new HunterClient()
    },
    {
      provide: SerperClient,
      useFactory: () => new SerperClient()
    }
  ],
  exports: [AiGatewayService, HunterClient, SerperClient]
})
export class AiGatewayModule {}
