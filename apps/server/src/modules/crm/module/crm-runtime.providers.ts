import type { Provider } from '@nestjs/common';
import { resolveMx } from 'node:dns/promises';
import { AppConfigService } from '../../app-config/app-config.service';
import { CrmAiDraftTaskQueueService } from '../crm-ai-draft-task-queue.service';
import { CrmAiDraftTaskWorkerHost } from '../crm-ai-draft-task-worker-host.service';
import { createCrmGmailIntegrationProviders } from '../crm-gmail-provider.factory';
import { CrmGmailHistorySyncQueueService } from '../crm-gmail-history-sync-queue.service';
import { CrmGmailHistorySyncWorkerHost } from '../crm-gmail-history-sync-worker-host.service';
import { CrmSendQueueService } from '../crm-send-queue.service';
import { CrmSendSchedulerHost } from '../crm-send-scheduler-host.service';
import { CrmSendWorkerHost } from '../crm-send-worker-host.service';
import {
  CRM_AI_DRAFT_TASK_QUEUE,
  CRM_EMAIL_DNS_RESOLVER,
  CRM_EMAIL_SEND_GATEWAY,
  CRM_EMAIL_SMTP_VERIFIER,
  CRM_GMAIL_HISTORY_GATEWAY,
  CRM_GMAIL_HISTORY_SYNC_QUEUE,
  CRM_GMAIL_OAUTH_FLOW,
  CRM_GMAIL_WATCH_GATEWAY,
  CRM_SEND_QUEUE
} from '../crm.tokens';
import { CrmSmtpEmailVerifier } from '../shared/crm-smtp-email-verifier';

export const crmIntegrationServices: Provider[] = [];

export const crmWorkerServices: Provider[] = [
  CrmAiDraftTaskQueueService,
  CrmAiDraftTaskWorkerHost,
  CrmSendQueueService,
  CrmGmailHistorySyncQueueService,
  CrmGmailHistorySyncWorkerHost,
  CrmSendSchedulerHost,
  CrmSendWorkerHost
];

export const crmQueueProviders: Provider[] = [
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
  }
];

export const crmIntegrationProviders: Provider[] = [
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
  },
  {
    provide: CRM_EMAIL_SMTP_VERIFIER,
    useClass: CrmSmtpEmailVerifier
  }
];
