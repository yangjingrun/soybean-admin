import type { Provider } from '@nestjs/common';
import { CRM_PERSONA_PROFILE_REPOSITORY } from '../persona-profiles/crm-persona-profile.repository';
import { CRM_PRODUCT_LINE_REPOSITORY } from '../product-lines/crm-product-line.repository';
import { CRM_SEQUENCE_POLICY_REPOSITORY } from '../sequence-policies/crm-sequence-policy.repository';
import { CRM_EMAIL_TEMPLATE_GROUP_REPOSITORY } from '../template-groups/crm-email-template-group.repository';
import {
  CRM_ACCOUNT_REPOSITORY,
  CRM_AI_DRAFT_TASK_REPOSITORY,
  CRM_AI_DRAFT_TASK_SOURCE_REPOSITORY,
  CRM_AI_DRAFT_WORKER_REPOSITORY,
  CRM_ARCHIVE_SLIMMING_REPOSITORY,
  CRM_DASHBOARD_REPOSITORY,
  CRM_GMAIL_HISTORY_SYNC_REPOSITORY,
  CRM_GMAIL_WATCH_REPOSITORY,
  CRM_INBOX_REPOSITORY,
  CRM_MAILBOX_REPOSITORY,
  CRM_SEND_QUEUE_RECONCILE_REPOSITORY,
  CRM_SEND_SCHEDULER_REPOSITORY,
  CRM_SEND_WORKER_REPOSITORY,
  CRM_SEQUENCE_APPROVAL_REPOSITORY,
  CRM_SEQUENCE_CONTROL_REPOSITORY,
  CRM_SEQUENCE_DRAFT_REPOSITORY,
  CRM_SEQUENCE_NEXT_DRAFT_REPOSITORY,
  CRM_SEQUENCE_REPOSITORY,
  CRM_SETTINGS_REPOSITORY,
  CRM_SUPPRESSION_REPOSITORY
} from '../crm.tokens';
import { PrismaCrmAccountStore } from '../store/prisma-crm-account.store';
import { PrismaCrmAiDraftTaskSourceStore } from '../store/prisma-crm-ai-draft-task-source.store';
import { PrismaCrmAiDraftTaskStore } from '../store/prisma-crm-ai-draft-task.store';
import { PrismaCrmAiDraftWorkerStore } from '../store/prisma-crm-ai-draft-worker.store';
import { PrismaCrmArchiveSlimmingStore } from '../store/prisma-crm-archive-slimming.store';
import { PrismaCrmDashboardStore } from '../store/prisma-crm-dashboard.store';
import { PrismaCrmEmailTemplateGroupStore } from '../store/prisma-crm-email-template-group.store';
import { PrismaCrmGmailHistorySyncStore } from '../store/prisma-crm-gmail-history-sync.store';
import { PrismaCrmGmailWatchStore } from '../store/prisma-crm-gmail-watch.store';
import { PrismaCrmInboxStore } from '../store/prisma-crm-inbox.store';
import { PrismaCrmMailboxStore } from '../store/prisma-crm-mailbox.store';
import { PrismaCrmPersonaStore } from '../store/prisma-crm-persona.store';
import { PrismaCrmProductLineStore } from '../store/prisma-crm-product-line.store';
import { PrismaCrmSendQueueReconcileStore } from '../store/prisma-crm-send-queue-reconcile.store';
import { PrismaCrmSendSchedulerStore } from '../store/prisma-crm-send-scheduler.store';
import { PrismaCrmSendWorkerStore } from '../store/prisma-crm-send-worker.store';
import { PrismaCrmSequenceApprovalStore } from '../store/prisma-crm-sequence-approval.store';
import { PrismaCrmSequenceControlStore } from '../store/prisma-crm-sequence-control.store';
import { PrismaCrmSequenceDraftStore } from '../store/prisma-crm-sequence-draft.store';
import { PrismaCrmSequenceNextDraftStore } from '../store/prisma-crm-sequence-next-draft.store';
import { PrismaCrmSequencePolicyStore } from '../store/prisma-crm-sequence-policy.store';
import { PrismaCrmSequenceStore } from '../store/prisma-crm-sequence.store';
import { PrismaCrmSettingsStore } from '../store/prisma-crm-settings.store';
import { PrismaCrmSuppressionStore } from '../store/prisma-crm-suppression.store';

export const crmRepositoryProviders: Provider[] = [
  {
    provide: CRM_ACCOUNT_REPOSITORY,
    useClass: PrismaCrmAccountStore
  },
  {
    provide: CRM_SETTINGS_REPOSITORY,
    useClass: PrismaCrmSettingsStore
  },
  {
    provide: CRM_PRODUCT_LINE_REPOSITORY,
    useClass: PrismaCrmProductLineStore
  },
  {
    provide: CRM_PERSONA_PROFILE_REPOSITORY,
    useClass: PrismaCrmPersonaStore
  },
  {
    provide: CRM_SUPPRESSION_REPOSITORY,
    useClass: PrismaCrmSuppressionStore
  },
  {
    provide: CRM_MAILBOX_REPOSITORY,
    useClass: PrismaCrmMailboxStore
  },
  {
    provide: CRM_SEQUENCE_REPOSITORY,
    useClass: PrismaCrmSequenceStore
  },
  {
    provide: CRM_SEQUENCE_APPROVAL_REPOSITORY,
    useClass: PrismaCrmSequenceApprovalStore
  },
  {
    provide: CRM_SEQUENCE_CONTROL_REPOSITORY,
    useClass: PrismaCrmSequenceControlStore
  },
  {
    provide: CRM_SEQUENCE_DRAFT_REPOSITORY,
    useClass: PrismaCrmSequenceDraftStore
  },
  {
    provide: CRM_SEQUENCE_NEXT_DRAFT_REPOSITORY,
    useClass: PrismaCrmSequenceNextDraftStore
  },
  {
    provide: CRM_SEND_QUEUE_RECONCILE_REPOSITORY,
    useClass: PrismaCrmSendQueueReconcileStore
  },
  {
    provide: CRM_SEND_SCHEDULER_REPOSITORY,
    useClass: PrismaCrmSendSchedulerStore
  },
  {
    provide: CRM_SEND_WORKER_REPOSITORY,
    useClass: PrismaCrmSendWorkerStore
  },
  {
    provide: CRM_AI_DRAFT_TASK_REPOSITORY,
    useClass: PrismaCrmAiDraftTaskStore
  },
  {
    provide: CRM_AI_DRAFT_TASK_SOURCE_REPOSITORY,
    useClass: PrismaCrmAiDraftTaskSourceStore
  },
  {
    provide: CRM_AI_DRAFT_WORKER_REPOSITORY,
    useClass: PrismaCrmAiDraftWorkerStore
  },
  {
    provide: CRM_SEQUENCE_POLICY_REPOSITORY,
    useClass: PrismaCrmSequencePolicyStore
  },
  {
    provide: CRM_EMAIL_TEMPLATE_GROUP_REPOSITORY,
    useClass: PrismaCrmEmailTemplateGroupStore
  },
  {
    provide: CRM_INBOX_REPOSITORY,
    useClass: PrismaCrmInboxStore
  },
  {
    provide: CRM_GMAIL_HISTORY_SYNC_REPOSITORY,
    useClass: PrismaCrmGmailHistorySyncStore
  },
  {
    provide: CRM_GMAIL_WATCH_REPOSITORY,
    useClass: PrismaCrmGmailWatchStore
  },
  {
    provide: CRM_ARCHIVE_SLIMMING_REPOSITORY,
    useClass: PrismaCrmArchiveSlimmingStore
  },
  {
    provide: CRM_DASHBOARD_REPOSITORY,
    useClass: PrismaCrmDashboardStore
  }
];
