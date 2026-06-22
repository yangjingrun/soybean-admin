import type { Provider } from '@nestjs/common';
import { CrmAccountService } from '../accounts/crm-account.service';
import { CrmAiDraftTaskWorkerService } from '../crm-ai-draft-task-worker.service';
import { CrmAiDraftService } from '../crm-ai-draft.service';
import { CrmAiReplyDraftService } from '../crm-ai-reply-draft.service';
import { CrmArchiveSlimmingService } from '../crm-archive-slimming.service';
import { CrmGmailHistorySyncWorkerService } from '../crm-gmail-history-sync-worker.service';
import { CrmGmailPubSubOidcVerifier } from '../crm-gmail-pubsub-oidc.verifier';
import { CrmGmailWatchRenewalService } from '../crm-gmail-watch-renewal.service';
import { CrmGmailWatchService } from '../crm-gmail-watch.service';
import { CrmGmailWebhookService } from '../crm-gmail-webhook.service';
import { CrmSendSchedulerService } from '../crm-send-scheduler.service';
import { CrmSendWorkerService } from '../crm-send-worker.service';
import { CrmAiDraftTaskService } from '../ai-draft-task/crm-ai-draft-task.service';
import { CrmDashboardService } from '../dashboard/crm-dashboard.service';
import { CrmInboxService } from '../inbox/crm-inbox.service';
import { CrmMailboxService } from '../mailbox/crm-mailbox.service';
import { CrmPersonaProfileService } from '../persona-profiles/crm-persona-profile.service';
import { CrmProductLineService } from '../product-lines/crm-product-line.service';
import { CrmBatchDraftApprovalService } from '../sequence/crm-batch-draft-approval.service';
import { CrmBatchSequenceStopService } from '../sequence/crm-batch-sequence-stop.service';
import { CrmDraftApprovalService } from '../sequence/crm-draft-approval.service';
import { CrmDraftPreviewService } from '../sequence/crm-draft-preview.service';
import { CrmDraftService } from '../sequence/crm-draft.service';
import { CrmFollowUpApprovalService } from '../sequence/crm-follow-up-approval.service';
import { CrmMessageDraftApprovalRouterService } from '../sequence/crm-message-draft-approval-router.service';
import { CrmNextDraftService } from '../sequence/crm-next-draft.service';
import { CrmSendQueueReconcileService } from '../sequence/crm-send-queue-reconcile.service';
import { CrmSequenceControlService } from '../sequence/crm-sequence-control.service';
import { CrmSequenceEligibilityService } from '../sequence/crm-sequence-eligibility.service';
import { CrmSequenceReviewCreationService } from '../sequence/crm-sequence-review-creation.service';
import { CrmSequenceService } from '../sequence/crm-sequence.service';
import { CrmSequencePolicyService } from '../sequence-policies/crm-sequence-policy.service';
import { CrmSettingsService } from '../settings/crm-settings.service';
import { CrmLoggerService } from '../shared/crm-logger.service';
import { CrmSuppressionService } from '../suppression/crm-suppression.service';
import { CrmEmailTemplateGroupService } from '../template-groups/crm-email-template-group.service';

export const crmBusinessDomainProviders = {
  lead: [CrmAccountService, CrmArchiveSlimmingService, CrmDashboardService],
  settingsCatalog: [
    CrmSettingsService,
    CrmProductLineService,
    CrmPersonaProfileService,
    CrmSequencePolicyService,
    CrmEmailTemplateGroupService,
    CrmSuppressionService
  ],
  outreach: [
    CrmSequenceEligibilityService,
    CrmSequenceService,
    CrmSequenceReviewCreationService,
    CrmDraftPreviewService,
    CrmDraftService,
    CrmDraftApprovalService,
    CrmFollowUpApprovalService,
    CrmMessageDraftApprovalRouterService,
    CrmNextDraftService,
    CrmBatchDraftApprovalService,
    CrmBatchSequenceStopService,
    CrmSequenceControlService,
    CrmSendQueueReconcileService,
    CrmSendSchedulerService,
    CrmSendWorkerService
  ],
  mailbox: [
    CrmMailboxService,
    CrmGmailPubSubOidcVerifier,
    CrmGmailWebhookService,
    CrmGmailWatchService,
    CrmGmailWatchRenewalService,
    CrmGmailHistorySyncWorkerService
  ],
  inbox: [CrmInboxService, CrmAiReplyDraftService],
  aiDraft: [CrmAiDraftService, CrmAiDraftTaskService, CrmAiDraftTaskWorkerService]
} as const satisfies Record<string, Provider[]>;

export const crmDomainServices: Provider[] = [...Object.values(crmBusinessDomainProviders).flat(), CrmLoggerService];
