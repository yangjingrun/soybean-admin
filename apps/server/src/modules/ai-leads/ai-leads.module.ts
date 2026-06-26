import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { AuthModule } from '../auth/auth.module';
import { CrmModule } from '../crm/crm.module';
import { DatabaseModule } from '../database/database.module';
import { SystemLogModule } from '../system-log/system-log.module';
import { SystemNotificationModule } from '../system-notification/system-notification.module';
import { AiLeadHunterEnrichmentService } from './ai-lead-hunter-enrichment.service';
import { AiLeadCrmPrecheckService } from './ai-lead-crm-precheck.service';
import { AiLeadSearchOrchestrator } from './ai-lead-search-orchestrator.service';
import { AiLeadSearchTaskQueueService } from './ai-lead-search-task-queue.service';
import { AiLeadSearchTaskService } from './ai-lead-search-task.service';
import { AiLeadSearchTaskWorkerHost } from './ai-lead-search-task-worker-host.service';
import { AiLeadSearchTaskWorkerService } from './ai-lead-search-task-worker.service';
import { AiLeadPrecisionAnalysisService } from './ai-lead-precision-analysis.service';
import { AiLeadDirectorySourceRuleService } from './ai-lead-directory-source-rule.service';
import { AiLeadWebsiteCrawlerService } from './ai-lead-website-crawler.service';
import { AiLeadsController } from './ai-leads.controller';
import { AiLeadsService } from './ai-leads.service';
import {
  AI_LEAD_DIRECTORY_SOURCE_RULE_STORE,
  AI_LEAD_KEYWORD_HISTORY_STORE,
  AI_LEAD_QUEUE_CONFIG_STORE,
  AI_LEAD_SEARCH_TASK_QUEUE,
  AI_LEAD_SEARCH_TASK_STORE
} from './ai-leads.tokens';
import { PrismaAiLeadQueueConfigStore } from './prisma-ai-lead-queue-config.store';
import { PrismaAiLeadDirectorySourceRuleStore } from './prisma-ai-lead-directory-source-rule.store';
import { PrismaAiLeadKeywordHistoryStore } from './prisma-ai-lead-keyword-history.store';
import { PrismaAiLeadSearchTaskStore } from './prisma-ai-lead-search-task.store';

@Module({
  imports: [AiGatewayModule, AuthModule, CrmModule, DatabaseModule, SystemLogModule, SystemNotificationModule],
  controllers: [AiLeadsController],
  providers: [
    AiLeadsService,
    AiLeadCrmPrecheckService,
    AiLeadSearchOrchestrator,
    AiLeadHunterEnrichmentService,
    AiLeadSearchTaskService,
    AiLeadSearchTaskQueueService,
    AiLeadSearchTaskWorkerService,
    AiLeadSearchTaskWorkerHost,
    AiLeadWebsiteCrawlerService,
    AiLeadPrecisionAnalysisService,
    AiLeadDirectorySourceRuleService,
    {
      provide: AI_LEAD_KEYWORD_HISTORY_STORE,
      useClass: PrismaAiLeadKeywordHistoryStore
    },
    {
      provide: AI_LEAD_SEARCH_TASK_STORE,
      useClass: PrismaAiLeadSearchTaskStore
    },
    {
      provide: AI_LEAD_QUEUE_CONFIG_STORE,
      useClass: PrismaAiLeadQueueConfigStore
    },
    {
      provide: AI_LEAD_DIRECTORY_SOURCE_RULE_STORE,
      useClass: PrismaAiLeadDirectorySourceRuleStore
    },
    {
      provide: AI_LEAD_SEARCH_TASK_QUEUE,
      useExisting: AiLeadSearchTaskQueueService
    }
  ]
})
export class AiLeadsModule {}
