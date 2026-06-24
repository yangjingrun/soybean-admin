import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import 'reflect-metadata';
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
} from './crm.tokens';
import { crmBusinessDomainProviders, crmRepositoryProviders } from './crm-module.providers';
import { CrmSequenceControlService } from './sequence/crm-sequence-control.service';
import { CrmSequenceEligibilityService } from './sequence/crm-sequence-eligibility.service';
import { CrmSequenceReviewCreationService } from './sequence/crm-sequence-review-creation.service';
import { CrmSendAvailabilityService } from './crm-send-availability.service';
import { CrmSendSchedulerService } from './crm-send-scheduler.service';
import { CRM_PERSONA_PROFILE_REPOSITORY } from './persona-profiles/crm-persona-profile.repository';
import { CRM_PRODUCT_LINE_REPOSITORY } from './product-lines/crm-product-line.repository';
import { CRM_SEQUENCE_POLICY_REPOSITORY } from './sequence-policies/crm-sequence-policy.repository';
import { PrismaCrmAccountStore } from './store/prisma-crm-account.store';
import { PrismaCrmAiDraftTaskSourceStore } from './store/prisma-crm-ai-draft-task-source.store';
import { PrismaCrmAiDraftTaskStore } from './store/prisma-crm-ai-draft-task.store';
import { PrismaCrmAiDraftWorkerStore } from './store/prisma-crm-ai-draft-worker.store';
import { PrismaCrmArchiveSlimmingStore } from './store/prisma-crm-archive-slimming.store';
import { PrismaCrmDashboardStore } from './store/prisma-crm-dashboard.store';
import { PrismaCrmEmailTemplateGroupStore } from './store/prisma-crm-email-template-group.store';
import { PrismaCrmGmailHistorySyncStore } from './store/prisma-crm-gmail-history-sync.store';
import { PrismaCrmGmailWatchStore } from './store/prisma-crm-gmail-watch.store';
import { PrismaCrmInboxStore } from './store/prisma-crm-inbox.store';
import { PrismaCrmMailboxStore } from './store/prisma-crm-mailbox.store';
import { PrismaCrmPersonaStore } from './store/prisma-crm-persona.store';
import { PrismaCrmProductLineStore } from './store/prisma-crm-product-line.store';
import { PrismaCrmSendQueueReconcileStore } from './store/prisma-crm-send-queue-reconcile.store';
import { PrismaCrmSendSchedulerStore } from './store/prisma-crm-send-scheduler.store';
import { PrismaCrmSendWorkerStore } from './store/prisma-crm-send-worker.store';
import { PrismaCrmSequenceApprovalStore } from './store/prisma-crm-sequence-approval.store';
import { PrismaCrmSequenceControlStore } from './store/prisma-crm-sequence-control.store';
import { PrismaCrmSequenceDraftStore } from './store/prisma-crm-sequence-draft.store';
import { PrismaCrmSequenceNextDraftStore } from './store/prisma-crm-sequence-next-draft.store';
import { PrismaCrmSequencePolicyStore } from './store/prisma-crm-sequence-policy.store';
import { PrismaCrmSequenceStore } from './store/prisma-crm-sequence.store';
import { PrismaCrmSettingsStore } from './store/prisma-crm-settings.store';
import { PrismaCrmSuppressionStore } from './store/prisma-crm-suppression.store';
import { PrismaService } from '../database/prisma.service';
import { CRM_EMAIL_TEMPLATE_GROUP_REPOSITORY } from './template-groups/crm-email-template-group.repository';

const domainRepositoryTokens = [
  CRM_ACCOUNT_REPOSITORY,
  CRM_SETTINGS_REPOSITORY,
  CRM_PRODUCT_LINE_REPOSITORY,
  CRM_PERSONA_PROFILE_REPOSITORY,
  CRM_SUPPRESSION_REPOSITORY,
  CRM_MAILBOX_REPOSITORY,
  CRM_SEQUENCE_REPOSITORY,
  CRM_SEQUENCE_APPROVAL_REPOSITORY,
  CRM_SEQUENCE_CONTROL_REPOSITORY,
  CRM_SEQUENCE_DRAFT_REPOSITORY,
  CRM_SEQUENCE_NEXT_DRAFT_REPOSITORY,
  CRM_SEND_QUEUE_RECONCILE_REPOSITORY,
  CRM_SEND_SCHEDULER_REPOSITORY,
  CRM_SEND_WORKER_REPOSITORY,
  CRM_AI_DRAFT_TASK_REPOSITORY,
  CRM_AI_DRAFT_TASK_SOURCE_REPOSITORY,
  CRM_AI_DRAFT_WORKER_REPOSITORY,
  CRM_SEQUENCE_POLICY_REPOSITORY,
  CRM_EMAIL_TEMPLATE_GROUP_REPOSITORY,
  CRM_INBOX_REPOSITORY,
  CRM_GMAIL_HISTORY_SYNC_REPOSITORY,
  CRM_GMAIL_WATCH_REPOSITORY,
  CRM_ARCHIVE_SLIMMING_REPOSITORY,
  CRM_DASHBOARD_REPOSITORY
];

describe('crmRepositoryProviders', () => {
  it('keeps domain repositories behind their own adapter classes', () => {
    for (const token of domainRepositoryTokens) {
      const provider = crmRepositoryProviders.find(item => 'provide' in item && item.provide === token);

      assert.ok(provider, `missing provider for ${String(token)}`);
      assert.equal('useClass' in provider, true, `${String(token)} should use a repository class`);
      assert.equal('useExisting' in provider, false, `${String(token)} should not alias another repository`);
    }
  });

  it('binds migrated domain repositories directly to Prisma stores', () => {
    const migratedBindings = new Map<symbol, unknown>([
      [CRM_ACCOUNT_REPOSITORY, PrismaCrmAccountStore],
      [CRM_SETTINGS_REPOSITORY, PrismaCrmSettingsStore],
      [CRM_PRODUCT_LINE_REPOSITORY, PrismaCrmProductLineStore],
      [CRM_PERSONA_PROFILE_REPOSITORY, PrismaCrmPersonaStore],
      [CRM_SUPPRESSION_REPOSITORY, PrismaCrmSuppressionStore],
      [CRM_MAILBOX_REPOSITORY, PrismaCrmMailboxStore],
      [CRM_SEQUENCE_REPOSITORY, PrismaCrmSequenceStore],
      [CRM_SEQUENCE_APPROVAL_REPOSITORY, PrismaCrmSequenceApprovalStore],
      [CRM_SEQUENCE_CONTROL_REPOSITORY, PrismaCrmSequenceControlStore],
      [CRM_SEQUENCE_DRAFT_REPOSITORY, PrismaCrmSequenceDraftStore],
      [CRM_SEQUENCE_NEXT_DRAFT_REPOSITORY, PrismaCrmSequenceNextDraftStore],
      [CRM_SEND_QUEUE_RECONCILE_REPOSITORY, PrismaCrmSendQueueReconcileStore],
      [CRM_SEND_SCHEDULER_REPOSITORY, PrismaCrmSendSchedulerStore],
      [CRM_SEND_WORKER_REPOSITORY, PrismaCrmSendWorkerStore],
      [CRM_AI_DRAFT_TASK_REPOSITORY, PrismaCrmAiDraftTaskStore],
      [CRM_AI_DRAFT_TASK_SOURCE_REPOSITORY, PrismaCrmAiDraftTaskSourceStore],
      [CRM_AI_DRAFT_WORKER_REPOSITORY, PrismaCrmAiDraftWorkerStore],
      [CRM_SEQUENCE_POLICY_REPOSITORY, PrismaCrmSequencePolicyStore],
      [CRM_EMAIL_TEMPLATE_GROUP_REPOSITORY, PrismaCrmEmailTemplateGroupStore],
      [CRM_INBOX_REPOSITORY, PrismaCrmInboxStore],
      [CRM_GMAIL_HISTORY_SYNC_REPOSITORY, PrismaCrmGmailHistorySyncStore],
      [CRM_GMAIL_WATCH_REPOSITORY, PrismaCrmGmailWatchStore],
      [CRM_ARCHIVE_SLIMMING_REPOSITORY, PrismaCrmArchiveSlimmingStore],
      [CRM_DASHBOARD_REPOSITORY, PrismaCrmDashboardStore]
    ]);

    for (const [token, repositoryClass] of migratedBindings) {
      const provider = crmRepositoryProviders.find(item => 'provide' in item && item.provide === token);

      assert.ok(provider, `missing provider for ${String(token)}`);
      assert.equal('useClass' in provider, true);
      const classProvider = provider as { useClass: unknown };
      assert.equal(classProvider.useClass, repositoryClass);
    }
  });

  it('uses explicit PrismaService injection for Prisma repository adapters', () => {
    const prismaRepositoryClasses = [
      PrismaCrmAccountStore,
      PrismaCrmSettingsStore,
      PrismaCrmProductLineStore,
      PrismaCrmPersonaStore,
      PrismaCrmSuppressionStore,
      PrismaCrmMailboxStore,
      PrismaCrmSequenceStore,
      PrismaCrmSequenceApprovalStore,
      PrismaCrmSequenceControlStore,
      PrismaCrmSequenceDraftStore,
      PrismaCrmSequenceNextDraftStore,
      PrismaCrmSendQueueReconcileStore,
      PrismaCrmSendSchedulerStore,
      PrismaCrmSendWorkerStore,
      PrismaCrmAiDraftTaskStore,
      PrismaCrmAiDraftTaskSourceStore,
      PrismaCrmAiDraftWorkerStore,
      PrismaCrmSequencePolicyStore,
      PrismaCrmEmailTemplateGroupStore,
      PrismaCrmInboxStore,
      PrismaCrmGmailHistorySyncStore,
      PrismaCrmGmailWatchStore,
      PrismaCrmArchiveSlimmingStore,
      PrismaCrmDashboardStore
    ];

    for (const repositoryClass of prismaRepositoryClasses) {
      const injectedParams = Reflect.getMetadata('self:paramtypes', repositoryClass) as
        | Array<{ index: number; param: unknown }>
        | undefined;

      assert.ok(
        injectedParams?.some(item => item.index === 0 && item.param === PrismaService),
        `${repositoryClass.name} should explicitly inject PrismaService`
      );
    }
  });
});

describe('crmBusinessDomainProviders', () => {
  it('keeps sequence eligibility inside the outreach business domain', () => {
    assert.ok(crmBusinessDomainProviders.outreach.includes(CrmSequenceEligibilityService));
    assert.ok(crmBusinessDomainProviders.outreach.includes(CrmSequenceReviewCreationService));
  });

  it('does not register one provider in multiple business domains', () => {
    const providers = Object.values(crmBusinessDomainProviders).flat();
    const duplicatedProviders = providers.filter((provider, index) => providers.indexOf(provider) !== index);

    assert.deepEqual(duplicatedProviders, []);
  });

  it('uses explicit availability injection for runtime send schedulers', () => {
    const injectedParams = Reflect.getMetadata('self:paramtypes', CrmSendSchedulerService) as
      | Array<{ index: number; param: unknown }>
      | undefined;

    assert.ok(
      injectedParams?.some(item => item.index === 2 && item.param === CrmSendAvailabilityService),
      'CrmSendSchedulerService should explicitly inject CrmSendAvailabilityService'
    );
  });

  it('uses explicit availability injection before writing first-send schedule times', () => {
    const creationParams = Reflect.getMetadata('self:paramtypes', CrmSequenceReviewCreationService) as
      | Array<{ index: number; param: unknown }>
      | undefined;
    const controlParams = Reflect.getMetadata('self:paramtypes', CrmSequenceControlService) as
      | Array<{ index: number; param: unknown }>
      | undefined;

    assert.ok(
      creationParams?.some(item => item.index === 5 && item.param === CrmSendAvailabilityService),
      'CrmSequenceReviewCreationService should explicitly inject CrmSendAvailabilityService'
    );
    assert.ok(
      controlParams?.some(item => item.index === 2 && item.param === CrmSendAvailabilityService),
      'CrmSequenceControlService should explicitly inject CrmSendAvailabilityService'
    );
  });
});
