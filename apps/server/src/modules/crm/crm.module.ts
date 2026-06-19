import { Module } from '@nestjs/common';
import { resolveMx } from 'node:dns/promises';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { SystemLogModule } from '../system-log/system-log.module';
import { SystemNotificationModule } from '../system-notification/system-notification.module';
import { MockCrmEmailSendGateway } from './crm-email-send.gateway';
import { CrmController } from './crm.controller';
import { MockCrmGmailHistoryGateway } from './crm-gmail-history.gateway';
import { CrmGmailHistorySyncQueueService } from './crm-gmail-history-sync-queue.service';
import { CrmGmailHistorySyncWorkerHost } from './crm-gmail-history-sync-worker-host.service';
import { CrmGmailHistorySyncWorkerService } from './crm-gmail-history-sync-worker.service';
import { MockCrmGmailWatchGateway } from './crm-gmail-watch.gateway';
import { CrmGmailWatchService } from './crm-gmail-watch.service';
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
    CrmGmailWebhookService,
    CrmSendQueueService,
    CrmGmailHistorySyncQueueService,
    CrmGmailHistorySyncWorkerService,
    CrmGmailHistorySyncWorkerHost,
    CrmGmailWatchService,
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
      useClass: MockCrmGmailHistoryGateway
    },
    {
      provide: CRM_GMAIL_WATCH_GATEWAY,
      useClass: MockCrmGmailWatchGateway
    },
    {
      provide: CRM_EMAIL_SEND_GATEWAY,
      useClass: MockCrmEmailSendGateway
    },
    {
      provide: CRM_EMAIL_DNS_RESOLVER,
      useValue: { resolveMx }
    }
  ],
  exports: [CrmService]
})
export class CrmModule {}
