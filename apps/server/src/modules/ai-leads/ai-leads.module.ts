import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SystemLogModule } from '../system-log/system-log.module';
import { AiLeadSearchOrchestrator } from './ai-lead-search-orchestrator.service';
import { AiLeadsController } from './ai-leads.controller';
import { AiLeadsService } from './ai-leads.service';
import { AI_LEAD_KEYWORD_HISTORY_STORE } from './ai-leads.tokens';
import { PrismaAiLeadKeywordHistoryStore } from './prisma-ai-lead-keyword-history.store';

@Module({
  imports: [AiGatewayModule, AuthModule, DatabaseModule, SystemLogModule],
  controllers: [AiLeadsController],
  providers: [
    AiLeadsService,
    AiLeadSearchOrchestrator,
    {
      provide: AI_LEAD_KEYWORD_HISTORY_STORE,
      useClass: PrismaAiLeadKeywordHistoryStore
    }
  ]
})
export class AiLeadsModule {}
