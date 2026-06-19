import { Module } from '@nestjs/common';
import { resolveMx } from 'node:dns/promises';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { SystemLogModule } from '../system-log/system-log.module';
import { SystemNotificationModule } from '../system-notification/system-notification.module';
import { CrmController } from './crm.controller';
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
import { CrmSendWorkerHost } from './crm-send-worker-host.service';
import { CrmSendWorkerService } from './crm-send-worker.service';
import { CrmService } from './crm.service';
import {
  CRM_EMAIL_DNS_RESOLVER,
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
  imports: [AuthModule, DatabaseModule, RedisModule, SystemLogModule, SystemNotificationModule],
  controllers: [CrmController, CrmGmailWebhookController],
  providers: [
    CrmService,
    CrmArchiveSlimmingService,
    CrmGmailPubSubOidcVerifier,
    CrmGmailWebhookService,
    CrmSendQueueService,
    CrmGmailHistorySyncQueueService,
    CrmGmailHistorySyncWorkerService,
    CrmGmailHistorySyncWorkerHost,
    CrmGmailWatchService,
    CrmGmailWatchRenewalService,
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
      provide: CRM_GMAIL_HISTORY_GATEWAY,
      useFactory: () => createCrmGmailIntegrationProviders(process.env).historyGateway
    },
    {
      provide: CRM_GMAIL_WATCH_GATEWAY,
      useFactory: () => createCrmGmailIntegrationProviders(process.env).watchGateway
    },
    {
      provide: CRM_GMAIL_OAUTH_FLOW,
      useFactory: () => createCrmGmailIntegrationProviders(process.env).oauthFlow
    },
    {
      provide: CRM_EMAIL_SEND_GATEWAY,
      useFactory: () => createCrmGmailIntegrationProviders(process.env).emailSendGateway
    },
    {
      provide: CRM_EMAIL_DNS_RESOLVER,
      useValue: { resolveMx }
    }
  ],
  exports: [CrmService]
})
export class CrmModule {}
