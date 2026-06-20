import type { Provider } from '@nestjs/common';
import { resolveMx } from 'node:dns/promises';
import { AppConfigService } from '../app-config/app-config.service';
import { CrmAccountService } from './accounts/crm-account.service';
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
import { CrmGmailPubSubOidcVerifier } from './crm-gmail-pubsub-oidc.verifier';
import { CrmGmailWatchRenewalService } from './crm-gmail-watch-renewal.service';
import { CrmGmailWatchService } from './crm-gmail-watch.service';
import { CrmGmailWebhookController } from './crm-gmail-webhook.controller';
import { CrmGmailWebhookService } from './crm-gmail-webhook.service';
import { CrmSendQueueService } from './crm-send-queue.service';
import { CrmSendSchedulerHost } from './crm-send-scheduler-host.service';
import { CrmSendSchedulerService } from './crm-send-scheduler.service';
import { CrmSendWorkerHost } from './crm-send-worker-host.service';
import { CrmSendWorkerService } from './crm-send-worker.service';
import { CrmAiDraftTaskService } from './ai-draft-task/crm-ai-draft-task.service';
import { CrmAccountController } from './controllers/crm-account.controller';
import { CrmInboxController } from './controllers/crm-inbox.controller';
import { CrmMailboxController } from './controllers/crm-mailbox.controller';
import { CrmSequenceController } from './controllers/crm-sequence.controller';
import { CrmSettingsController } from './controllers/crm-settings.controller';
import { CrmDashboardService } from './dashboard/crm-dashboard.service';
import { CrmInboxService } from './inbox/crm-inbox.service';
import { CrmMailboxService } from './mailbox/crm-mailbox.service';
import { CRM_PERSONA_PROFILE_REPOSITORY } from './persona-profiles/crm-persona-profile.repository';
import { CrmPersonaProfileService } from './persona-profiles/crm-persona-profile.service';
import { CRM_PRODUCT_LINE_REPOSITORY } from './product-lines/crm-product-line.repository';
import { CrmProductLineService } from './product-lines/crm-product-line.service';
import { CrmBatchDraftApprovalService } from './sequence/crm-batch-draft-approval.service';
import { CrmBatchSequenceStopService } from './sequence/crm-batch-sequence-stop.service';
import { CrmDraftApprovalService } from './sequence/crm-draft-approval.service';
import { CrmDraftPreviewService } from './sequence/crm-draft-preview.service';
import { CrmDraftService } from './sequence/crm-draft.service';
import { CrmFollowUpApprovalService } from './sequence/crm-follow-up-approval.service';
import { CrmMessageDraftApprovalRouterService } from './sequence/crm-message-draft-approval-router.service';
import { CrmNextDraftService } from './sequence/crm-next-draft.service';
import { CrmSendQueueReconcileService } from './sequence/crm-send-queue-reconcile.service';
import { CrmSequenceControlService } from './sequence/crm-sequence-control.service';
import { CrmSequenceReviewCreationService } from './sequence/crm-sequence-review-creation.service';
import { CrmSequenceService } from './sequence/crm-sequence.service';
import { CRM_SEQUENCE_POLICY_REPOSITORY } from './sequence-policies/crm-sequence-policy.repository';
import { CrmSequencePolicyService } from './sequence-policies/crm-sequence-policy.service';
import { CrmSettingsService } from './settings/crm-settings.service';
import { CrmLoggerService } from './shared/crm-logger.service';
import { CrmSuppressionService } from './suppression/crm-suppression.service';
import { CRM_EMAIL_TEMPLATE_GROUP_REPOSITORY } from './template-groups/crm-email-template-group.repository';
import { CrmEmailTemplateGroupService } from './template-groups/crm-email-template-group.service';
import {
  CRM_ACCOUNT_REPOSITORY,
  CRM_AI_DRAFT_TASK_QUEUE,
  CRM_AI_DRAFT_TASK_REPOSITORY,
  CRM_DASHBOARD_REPOSITORY,
  CRM_EMAIL_DNS_RESOLVER,
  CRM_EMAIL_SEND_GATEWAY,
  CRM_GMAIL_HISTORY_GATEWAY,
  CRM_GMAIL_HISTORY_SYNC_QUEUE,
  CRM_GMAIL_OAUTH_FLOW,
  CRM_GMAIL_WATCH_GATEWAY,
  CRM_INBOX_REPOSITORY,
  CRM_MAILBOX_REPOSITORY,
  CRM_SEND_QUEUE,
  CRM_SEQUENCE_REPOSITORY,
  CRM_SETTINGS_REPOSITORY,
  CRM_STORE,
  CRM_SUPPRESSION_REPOSITORY
} from './crm.tokens';
import { PrismaCrmStore } from './store/prisma-crm.store';

export const crmControllers = [
  CrmAccountController,
  CrmMailboxController,
  CrmSettingsController,
  CrmSequenceController,
  CrmInboxController,
  CrmGmailWebhookController
];

export const crmDomainServices: Provider[] = [
  CrmAccountService,
  CrmAiDraftTaskService,
  CrmDashboardService,
  CrmInboxService,
  CrmMailboxService,
  CrmPersonaProfileService,
  CrmProductLineService,
  CrmBatchDraftApprovalService,
  CrmBatchSequenceStopService,
  CrmDraftApprovalService,
  CrmDraftPreviewService,
  CrmDraftService,
  CrmFollowUpApprovalService,
  CrmMessageDraftApprovalRouterService,
  CrmNextDraftService,
  CrmSendQueueReconcileService,
  CrmSequenceControlService,
  CrmSequenceReviewCreationService,
  CrmSequenceService,
  CrmSequencePolicyService,
  CrmSettingsService,
  CrmSuppressionService,
  CrmEmailTemplateGroupService,
  CrmLoggerService
];

export const crmIntegrationServices: Provider[] = [
  CrmAiDraftService,
  CrmAiReplyDraftService,
  CrmGmailPubSubOidcVerifier,
  CrmGmailWebhookService,
  CrmGmailWatchService,
  CrmGmailWatchRenewalService
];

export const crmWorkerServices: Provider[] = [
  CrmAiDraftTaskQueueService,
  CrmAiDraftTaskWorkerService,
  CrmAiDraftTaskWorkerHost,
  CrmArchiveSlimmingService,
  CrmSendQueueService,
  CrmGmailHistorySyncQueueService,
  CrmGmailHistorySyncWorkerService,
  CrmGmailHistorySyncWorkerHost,
  CrmSendSchedulerService,
  CrmSendSchedulerHost,
  CrmSendWorkerService,
  CrmSendWorkerHost
];

export const crmRepositoryProviders: Provider[] = [
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
    provide: CRM_PERSONA_PROFILE_REPOSITORY,
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
    provide: CRM_AI_DRAFT_TASK_REPOSITORY,
    useExisting: CRM_STORE
  },
  {
    provide: CRM_SEQUENCE_POLICY_REPOSITORY,
    useExisting: CRM_STORE
  },
  {
    provide: CRM_EMAIL_TEMPLATE_GROUP_REPOSITORY,
    useExisting: CRM_STORE
  },
  {
    provide: CRM_INBOX_REPOSITORY,
    useExisting: CRM_STORE
  },
  {
    provide: CRM_DASHBOARD_REPOSITORY,
    useExisting: CRM_STORE
  }
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
  }
];
