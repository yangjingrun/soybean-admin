import { Module } from '@nestjs/common';
import { resolveMx } from 'node:dns/promises';
import { AppConfigService } from '../app-config/app-config.service';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { SystemLogModule } from '../system-log/system-log.module';
import { SystemNotificationModule } from '../system-notification/system-notification.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { CrmController } from './crm.controller';
import { CrmAiDraftService } from './crm-ai-draft.service';
import { CrmAiDraftTaskQueueService } from './crm-ai-draft-task-queue.service';
import { CrmAiDraftTaskWorkerHost } from './crm-ai-draft-task-worker-host.service';
import { CrmAiDraftTaskWorkerService } from './crm-ai-draft-task-worker.service';
import { CrmAiReplyDraftService } from './crm-ai-reply-draft.service';
import { CrmArchiveSlimmingService } from './crm-archive-slimming.service';
import { CrmGmailHistorySyncQueueService } from './crm-gmail-history-sync-queue.service';
import { CrmGmailHistorySyncWorkerHost } from './crm-gmail-history-sync-worker-host.service';
import { CrmGmailHistorySyncWorkerService } from './crm-gmail-history-sync-worker.service';
import { createCrmGmailIntegrationProviders } from './crm-gmail-provider.factory';
import { CrmGmailWatchRenewalService } from './crm-gmail-watch-renewal.service';
import { CrmGmailWatchService } from './crm-gmail-watch.service';
import { CrmGmailPubSubOidcVerifier } from './crm-gmail-pubsub-oidc.verifier';
import { CrmGmailWebhookController } from './crm-gmail-webhook.controller';
import { CrmGmailWebhookService } from './crm-gmail-webhook.service';
import { CrmSendQueueService } from './crm-send-queue.service';
import { CrmSendSchedulerHost } from './crm-send-scheduler-host.service';
import { CrmSendSchedulerService } from './crm-send-scheduler.service';
import { CrmSendWorkerHost } from './crm-send-worker-host.service';
import { CrmSendWorkerService } from './crm-send-worker.service';
import { CrmService } from './crm.service';
import {
  CRM_EMAIL_DNS_RESOLVER,
  CRM_AI_DRAFT_TASK_QUEUE,
  CRM_EMAIL_SEND_GATEWAY,
  CRM_GMAIL_HISTORY_GATEWAY,
  CRM_GMAIL_HISTORY_SYNC_QUEUE,
  CRM_GMAIL_OAUTH_FLOW,
  CRM_GMAIL_WATCH_GATEWAY,
  CRM_SEND_QUEUE,
  CRM_STORE
} from './crm.tokens';
import { PrismaCrmStore } from './store/prisma-crm.store';

@Module({
  imports: [AuthModule, DatabaseModule, RedisModule, SystemLogModule, SystemNotificationModule, AiGatewayModule],
  controllers: [CrmController, CrmGmailWebhookController],
  providers: [
    CrmService,
    CrmAiDraftService,
    CrmAiDraftTaskQueueService,
    CrmAiDraftTaskWorkerService,
    CrmAiDraftTaskWorkerHost,
    CrmAiReplyDraftService,
    CrmArchiveSlimmingService,
    CrmGmailPubSubOidcVerifier,
    CrmGmailWebhookService,
    CrmSendQueueService,
    CrmGmailHistorySyncQueueService,
    CrmGmailHistorySyncWorkerService,
    CrmGmailHistorySyncWorkerHost,
    CrmGmailWatchService,
    CrmGmailWatchRenewalService,
    CrmSendSchedulerService,
    CrmSendSchedulerHost,
    CrmSendWorkerService,
    CrmSendWorkerHost,
    {
      provide: CRM_STORE,
      useClass: PrismaCrmStore
    },
    {
      provide: CRM_SEND_QUEUE,
      useExisting: CrmSendQueueService
    },
    {
      provide: CRM_GMAIL_HISTORY_SYNC_QUEUE,
      useExisting: CrmGmailHistorySyncQueueService
    },
    {
      provide: CRM_AI_DRAFT_TASK_QUEUE,
      useExisting: CrmAiDraftTaskQueueService
    },
    {
      provide: CRM_GMAIL_HISTORY_GATEWAY,
      useFactory: (appConfigService: AppConfigService) =>
        createCrmGmailIntegrationProviders(appConfigService.config.crmGmailIntegrationEnv).historyGateway,
      inject: [AppConfigService]
    },
    {
      provide: CRM_GMAIL_WATCH_GATEWAY,
      useFactory: (appConfigService: AppConfigService) =>
        createCrmGmailIntegrationProviders(appConfigService.config.crmGmailIntegrationEnv).watchGateway,
      inject: [AppConfigService]
    },
    {
      provide: CRM_GMAIL_OAUTH_FLOW,
      useFactory: (appConfigService: AppConfigService) =>
        createCrmGmailIntegrationProviders(appConfigService.config.crmGmailIntegrationEnv).oauthFlow,
      inject: [AppConfigService]
    },
    {
      provide: CRM_EMAIL_SEND_GATEWAY,
      useFactory: (appConfigService: AppConfigService) =>
        createCrmGmailIntegrationProviders(appConfigService.config.crmGmailIntegrationEnv).emailSendGateway,
      inject: [AppConfigService]
    },
    {
      provide: CRM_EMAIL_DNS_RESOLVER,
      useValue: { resolveMx }
    }
  ],
  exports: [CrmService]
})
export class CrmModule {}
