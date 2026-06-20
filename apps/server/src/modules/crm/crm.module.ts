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
import { CrmAccountService } from './accounts/crm-account.service';
import { CrmAiDraftTaskService } from './ai-draft-task/crm-ai-draft-task.service';
import { CrmInboxService } from './inbox/crm-inbox.service';
import { CrmMailboxService } from './mailbox/crm-mailbox.service';
import { CRM_PRODUCT_LINE_REPOSITORY } from './product-lines/crm-product-line.repository';
import { CrmProductLineService } from './product-lines/crm-product-line.service';
import { CrmBatchDraftApprovalService } from './sequence/crm-batch-draft-approval.service';
import { CrmBatchSequenceStopService } from './sequence/crm-batch-sequence-stop.service';
import { CrmDraftApprovalService } from './sequence/crm-draft-approval.service';
import { CrmDraftService } from './sequence/crm-draft.service';
import { CrmFollowUpApprovalService } from './sequence/crm-follow-up-approval.service';
import { CrmNextDraftService } from './sequence/crm-next-draft.service';
import { CrmSequenceService } from './sequence/crm-sequence.service';
import { CrmSettingsService } from './settings/crm-settings.service';
import { CrmLoggerService } from './shared/crm-logger.service';
import { CrmSuppressionService } from './suppression/crm-suppression.service';
import {
  CRM_EMAIL_DNS_RESOLVER,
  CRM_AI_DRAFT_TASK_QUEUE,
  CRM_ACCOUNT_REPOSITORY,
  CRM_DASHBOARD_REPOSITORY,
  CRM_EMAIL_SEND_GATEWAY,
  CRM_GMAIL_HISTORY_GATEWAY,
  CRM_GMAIL_HISTORY_SYNC_QUEUE,
  CRM_GMAIL_OAUTH_FLOW,
  CRM_GMAIL_WATCH_GATEWAY,
  CRM_INBOX_REPOSITORY,
  CRM_MAILBOX_REPOSITORY,
  CRM_SEQUENCE_REPOSITORY,
  CRM_SEND_QUEUE,
  CRM_SETTINGS_REPOSITORY,
  CRM_SUPPRESSION_REPOSITORY,
  CRM_STORE
} from './crm.tokens';
import { PrismaCrmStore } from './store/prisma-crm.store';

@Module({
  imports: [AuthModule, DatabaseModule, RedisModule, SystemLogModule, SystemNotificationModule, AiGatewayModule],
  controllers: [CrmController, CrmGmailWebhookController],
  providers: [
    CrmService,
    CrmAccountService,
    CrmAiDraftTaskService,
    CrmInboxService,
    CrmMailboxService,
    CrmProductLineService,
    CrmBatchDraftApprovalService,
    CrmBatchSequenceStopService,
    CrmDraftApprovalService,
    CrmDraftService,
    CrmFollowUpApprovalService,
    CrmNextDraftService,
    CrmSequenceService,
    CrmSettingsService,
    CrmSuppressionService,
    CrmLoggerService,
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
      provide: CRM_ACCOUNT_REPOSITORY,
      useExisting: CRM_STORE
    },
    {
      provide: CRM_SETTINGS_REPOSITORY,
      useExisting: CRM_STORE
    },
    {
      provide: CRM_PRODUCT_LINE_REPOSITORY,
      useExisting: CRM_STORE
    },
    {
      provide: CRM_SUPPRESSION_REPOSITORY,
      useExisting: CRM_STORE
    },
    {
      provide: CRM_MAILBOX_REPOSITORY,
      useExisting: CRM_STORE
    },
    {
      provide: CRM_SEQUENCE_REPOSITORY,
      useExisting: CRM_STORE
    },
    {
      provide: CRM_INBOX_REPOSITORY,
      useExisting: CRM_STORE
    },
    {
      provide: CRM_DASHBOARD_REPOSITORY,
      useExisting: CRM_STORE
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
