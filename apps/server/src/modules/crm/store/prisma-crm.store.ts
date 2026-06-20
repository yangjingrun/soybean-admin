import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../generated/prisma/client';
import type { CrmAccountModel } from '../../../generated/prisma/models/CrmAccount';
import type { CrmAiDraftQueueConfigModel } from '../../../generated/prisma/models/CrmAiDraftQueueConfig';
import type { CrmAiDraftTaskModel } from '../../../generated/prisma/models/CrmAiDraftTask';
import type { CrmAiDraftTaskItemModel } from '../../../generated/prisma/models/CrmAiDraftTaskItem';
import type { CrmArchivedFingerprintModel } from '../../../generated/prisma/models/CrmArchivedFingerprint';
import type { CrmBlacklistModel } from '../../../generated/prisma/models/CrmBlacklist';
import type { CrmContactModel } from '../../../generated/prisma/models/CrmContact';
import type { CrmEmailTemplateGroupModel } from '../../../generated/prisma/models/CrmEmailTemplateGroup';
import type { CrmEmailTemplateStepModel } from '../../../generated/prisma/models/CrmEmailTemplateStep';
import type { CrmEmailVerificationCacheModel } from '../../../generated/prisma/models/CrmEmailVerificationCache';
import type { CrmGlobalConfigModel } from '../../../generated/prisma/models/CrmGlobalConfig';
import type { CrmInboxMessageModel } from '../../../generated/prisma/models/CrmInboxMessage';
import type { CrmInboxThreadModel } from '../../../generated/prisma/models/CrmInboxThread';
import type { CrmMailboxModel } from '../../../generated/prisma/models/CrmMailbox';
import type { CrmMessageModel } from '../../../generated/prisma/models/CrmMessage';
import type { CrmOrganizationConfigModel } from '../../../generated/prisma/models/CrmOrganizationConfig';
import type { CrmPersonaProfileModel } from '../../../generated/prisma/models/CrmPersonaProfile';
import type { CrmProductLineAiPromptVersionModel } from '../../../generated/prisma/models/CrmProductLineAiPromptVersion';
import type { CrmProductLineModel } from '../../../generated/prisma/models/CrmProductLine';
import type { CrmSequenceEnrollmentModel } from '../../../generated/prisma/models/CrmSequenceEnrollment';
import type { CrmSequencePolicyModel } from '../../../generated/prisma/models/CrmSequencePolicy';
import type { CrmTimelineEventModel } from '../../../generated/prisma/models/CrmTimelineEvent';
import type { CrmUserSendPreferenceModel } from '../../../generated/prisma/models/CrmUserSendPreference';
import { PrismaService } from '../../database/prisma.service';
import {
  toAccountIdentityWhere,
  toContactIdentityWhere,
  toMailboxIdentityWhere,
  toProductLineIdentityWhere,
  toSequenceEnrollmentIdentityWhere,
  toMessageIdentityWhere,
  toInboxThreadIdentityWhere,
  toAccountListWhere,
  toMailboxListWhere,
  toProductLineListWhere,
  toPersonaProfileListWhere,
  toEmailTemplateGroupListWhere,
  toSequencePolicyListWhere,
  toBlacklistListWhere,
  toUniqueOwnerPairs,
  toOwnerPairFilters,
  toDispatchedMessageRangeWhere,
  toOwnerPairKey,
  toUniqueMailboxPairs,
  toMailboxPairFilters,
  toMailboxCountMap,
  toMailboxPairKey,
  toUniqueStrings,
  toCrmBlacklistPairKey,
  toScopedOrganizationWhere,
  startOfCrmBusinessDay,
  addCrmBusinessDays,
  toDateRange,
  formatCrmBusinessDateKey,
  readProgressPercent,
  countDates,
  isDate,
  createEmptyStrategyRows,
  getOrCreateStrategyStatRow,
  applyEnrollmentStat,
  applyMessageStat,
  sortStrategyRows,
  buildPersonaStatMap,
  toSequenceEnrollmentListWhere,
  toSequenceEnrollmentMessageWhere,
  toSequenceEnrollmentTodoTypeWhere,
  toInboxThreadListWhere,
  toAccountKeywordFilter,
  toMailboxKeywordFilter,
  toProductLineKeywordFilter,
  toPersonaProfileKeywordFilter,
  toEmailTemplateKeywordFilter,
  toSequencePolicyKeywordFilter,
  toBlacklistKeywordFilter,
  toSequenceEnrollmentKeywordFilter,
  toInboxThreadKeywordFilter,
  toSequenceReviewInclude,
  toInboxThreadListInclude,
  toInboxThreadDetailInclude,
  toAccountRecord,
  toArchivedFingerprintRecord,
  toBlacklistRecord,
  toContactRecord,
  toEmailVerificationCacheRecord,
  createDefaultGlobalConfig,
  toGlobalConfigRecord,
  toSendPreferenceRecord,
  toStepKindWhere,
  toOrganizationConfigRecord,
  toTimelineEventRecord,
  toMailboxRecord,
  toProductLineRecord,
  toProductLineAiWritingConfig,
  toProductLineAiPromptVersionJson,
  toNullableJsonInput,
  countAiDraftTaskItems,
  toStatusWhere,
  createDefaultAiDraftQueueConfig,
  toAiDraftQueueConfigRecord,
  toAiDraftTaskRecord,
  toAiDraftTaskItemRecord,
  toAiDraftTaskUpdateData,
  toAiDraftTaskItemUpdateData,
  normalizePositiveConfigInteger,
  toProductLineAiPromptVersionRecord,
  toPersonaProfileRecord,
  toEmailTemplateStepRecord,
  toEmailTemplateGroupRecord,
  toEmailTemplateStepCreateManyInput,
  toSequencePolicyRecord,
  toPersonaProfileCreateInput,
  toPersonaProfileUpdateInput,
  toSequencePolicyCreateInput,
  toSequencePolicyUpdateInput,
  toSequenceEnrollmentRecord,
  toMessageRecord,
  toInboxThreadRecord,
  toInboxReplyDraftMetadata,
  toInboxMessageRecord,
  type CrmMessageDraftVersionRaw,
  toMessageDraftVersionRecord,
  toSequenceReviewRecord,
  toInboxThreadListRecord,
  toInboxThreadDetailRecord,
  reserveMailboxSendQuota,
  reserveMailboxSendQuotaBucket,
  releaseMailboxSendQuotaBucket,
  toMailboxSendQuotaBuckets,
  toSnippet,
  resolveGmailThreadStateUpdate,
  isPrismaUniqueConflict,
  isPrismaConcurrentTaskCreateConflict
} from './prisma-crm-store.helpers';
import { PrismaCrmDashboardStore } from './prisma-crm-dashboard.store';
import { PrismaCrmMailboxStore } from './prisma-crm-mailbox.store';
import { PrismaCrmSettingsStore } from './prisma-crm-settings.store';
import type {
  CrmAccountCreateInput,
  CrmAccountRecord,
  CrmAccountStatus,
  CrmAccountUpdateInput,
  CrmAiDraftQueueConfigInput,
  CrmAiDraftQueueConfigRecord,
  CrmAiDraftTaskCreateInput,
  CrmAiDraftTaskItemRecord,
  CrmAiDraftTaskItemUpdateGuard,
  CrmAiDraftTaskItemUpdateInput,
  CrmAiDraftTaskRecord,
  CrmAiDraftTaskUpdateGuard,
  CrmAiDraftTaskUpdateInput,
  CrmArchiveSlimInput,
  CrmArchiveSlimmingListInput,
  CrmArchivedFingerprintLookupInput,
  CrmArchivedFingerprintRecord,
  CrmArchivedFingerprintUpsertInput,
  CrmBlacklistDeleteInput,
  CrmBlacklistListInput,
  CrmBlacklistRecord,
  CrmBlacklistUpsertInput,
  CrmMailboxCreateInput,
  CrmMailboxAuthorizationExpiredInput,
  CrmMailboxAuthorizationExpiredRecord,
  CrmMailboxSendStateBatchInput,
  CrmMailboxProvider,
  CrmMailboxRecord,
  CrmMailboxStatus,
  CrmMailboxHistoryAdvanceInput,
  CrmMailboxUpdateInput,
  CrmMailboxWatchRenewalListInput,
  CrmContactCreateInput,
  CrmContactRecord,
  CrmContactUpdateInput,
  CrmCustomerReplyIngestInput,
  CrmCustomerReplyIngestRecord,
  CrmDispatchedMessageCountInput,
  CrmDueSendCandidateListInput,
  CrmDueSendCandidateRecord,
  CrmEmailTemplateGroupCreateInput,
  CrmEmailTemplateGroupListInput,
  CrmEmailTemplateGroupRecord,
  CrmEmailTemplateGroupUpdateInput,
  CrmEmailTemplateStepInput,
  CrmEmailTemplateStepRecord,
  CrmEmailVerificationCacheRecord,
  CrmEmailVerificationCacheUpsertInput,
  CrmGlobalConfigInput,
  CrmGlobalConfigRecord,
  CrmEmailStatus,
  CrmInboxThreadDetailRecord,
  CrmInboxThreadListRecord,
  CrmInboxMessageRecord,
  CrmInboxThreadRecord,
  CrmInboxThreadGmailStateSyncInput,
  CrmInboxUnsubscribeConfirmInput,
  CrmInboxUnsubscribeConfirmRecord,
  CrmInboxReplyDraftSaveInput,
  CrmInboxThreadReplyInput,
  CrmInboxThreadReplyRecord,
  CrmInboxThreadStatus,
  CrmInboxThreadStatusUpdateInput,
  CrmInboxThreadStatusUpdateRecord,
  CrmProductLineAiPromptVersionCreateInput,
  CrmProductLineAiPromptVersionRecord,
  CrmProductLineAiPromptVersionRestoreInput,
  CrmProductLineAiWritingConfig,
  CrmProductLineCreateInput,
  CrmProductLineRecord,
  CrmProductLineStatus,
  CrmProductLineUpdateInput,
  CrmMessageCreateInput,
  CrmMessageDraftUpdateGuard,
  CrmMessageDraftVersionCreateInput,
  CrmMessageDraftVersionRecord,
  CrmMessageDraftVersionRestoreInput,
  CrmMessageRecord,
  CrmMessageStatus,
  CrmMessageUpdateInput,
  CrmOrganizationConfigInput,
  CrmOrganizationConfigRecord,
  CrmOwnerSendStateBatchInput,
  CrmPersonaProfileCreateInput,
  CrmPersonaProfileListInput,
  CrmPersonaProfileRecord,
  CrmPersonaProfileUpdateInput,
  CrmDraftApprovalInput,
  CrmDraftApprovalRecord,
  CrmFollowUpDraftBundleCreateInput,
  CrmFollowUpDraftBundleRecord,
  CrmSequenceEnrollmentCreateInput,
  CrmSequenceEnrollmentRecord,
  CrmSequenceEnrollmentStatus,
  CrmSequenceEnrollmentUpdateInput,
  CrmSequenceDraftBundleCreateInput,
  CrmSequencePolicyCreateInput,
  CrmSequencePolicyListInput,
  CrmSequencePolicyRecord,
  CrmSequencePolicyUpdateInput,
  CrmSequenceDraftBundleRecord,
  CrmSequenceReviewRecord,
  CrmSequenceReviewTodoType,
  CrmSendCompletionInput,
  CrmSendCompletionRecord,
  CrmSendDeliveryClaimInput,
  CrmSendDeliveryClaimRecord,
  CrmSendFailureInput,
  CrmSendFailureRecord,
  CrmSendPreferenceInput,
  CrmSendPreferenceRecord,
  CrmSendStartInput,
  CrmScheduledMessageStepKind,
  CrmSendStartRecord,
  CrmSequenceStopInput,
  CrmSequenceStopRecord,
  CrmStore,
  CrmStrategyStatDimension,
  CrmStrategyStatRow,
  CrmStrategyStatsRecord,
  CrmTimelineEventCreateInput,
  CrmTimelineEventRecord,
  CrmWorkbenchOverviewRecord
} from '../crm.types';
import {
  crmAiDraftActiveTaskStatuses,
  defaultCrmAiDraftItemConcurrency,
  defaultCrmAiDraftMaxAttempts,
  defaultCrmAiDraftRetryBackoffSeconds,
  maxCrmAiDraftItemConcurrency,
  normalizeCrmAiDraftItemConcurrency,
  normalizeCrmAiDraftMaxAttempts,
  normalizeCrmAiDraftRetryBackoffSeconds
} from '../crm-ai-draft-task-state';
import {
  crmGlobalConfigKey,
  defaultEmailVerificationCooldownDays,
  defaultFollowUpDelayDays,
  defaultOwnerConcurrentSendLimit,
  defaultOwnerDailySendLimitMax,
  normalizeEmailVerificationCooldownDays,
  normalizeFollowUpDelayDays,
  normalizeOwnerConcurrentSendLimit,
  normalizeOwnerDailySendLimitMax,
  serializeFollowUpDelayDays
} from '../crm-global-config';
import {
  normalizeSequencePolicyLinkPolicy,
  normalizeSequencePolicySameCompanyStrategy,
  normalizeSequencePolicyStatus,
  parseSequencePolicySteps,
  serializeSequencePolicyStepDelayDays,
  serializeSequencePolicyThreadModes
} from '../crm-sequence-policy';

const crmAiDraftQueueConfigKey = 'crm-ai-draft';
@Injectable()
export class PrismaCrmStore implements CrmStore {
  private readonly dashboardStore: PrismaCrmDashboardStore;
  private readonly mailboxStore: PrismaCrmMailboxStore;
  private readonly settingsStore: PrismaCrmSettingsStore;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    this.dashboardStore = new PrismaCrmDashboardStore(prisma);
    this.mailboxStore = new PrismaCrmMailboxStore(prisma);
    this.settingsStore = new PrismaCrmSettingsStore(prisma);
  }

  findAccountByDomain(organizationId: string, ownerUserId: string, domain: string) {
    return this.prisma.crmAccount
      .findUnique({
        where: {
          organizationId_ownerUserId_domain: {
            organizationId,
            ownerUserId,
            domain
          }
        }
      })
      .then(record => (record ? toAccountRecord(record) : null));
  }

  async createAccount(input: CrmAccountCreateInput) {
    try {
      const record = await this.prisma.crmAccount.create({
        data: input as Prisma.CrmAccountUncheckedCreateInput
      });

      return toAccountRecord(record);
    } catch (error) {
      if (isPrismaUniqueConflict(error) && input.domain) {
        const existingAccount = await this.findAccountByDomain(input.organizationId, input.ownerUserId, input.domain);

        if (existingAccount) return existingAccount;
      }

      throw error;
    }
  }

  async updateAccount(id: string, input: CrmAccountUpdateInput) {
    const records = await this.prisma.crmAccount.updateManyAndReturn({
      where: { id },
      data: input,
      limit: 1
    });

    return records[0] ? toAccountRecord(records[0]) : null;
  }

  async listAccountsForArchiveSlimming(input: CrmArchiveSlimmingListInput) {
    const records = await this.prisma.crmAccount.findMany({
      where: {
        status: 'archived',
        archiveSlimmedAt: null,
        archivedAt: {
          lte: input.archivedBefore
        }
      },
      orderBy: { archivedAt: 'asc' },
      take: input.take
    });

    return records.map(toAccountRecord);
  }

  async slimArchivedAccount(input: CrmArchiveSlimInput) {
    const records = await this.prisma.crmAccount.updateManyAndReturn({
      where: {
        id: input.id,
        organizationId: input.organizationId,
        status: 'archived',
        archiveSlimmedAt: null,
        archivedAt: {
          lte: input.archivedBefore
        }
      },
      data: {
        archiveSlimmedAt: input.slimmedAt,
        customerType: null,
        websiteUrl: null
      },
      limit: 1
    });

    return records[0] ? toAccountRecord(records[0]) : null;
  }

  findContactByEmailHash(organizationId: string, ownerUserId: string, emailHash: string) {
    return this.prisma.crmContact
      .findUnique({
        where: {
          organizationId_ownerUserId_emailHash: {
            organizationId,
            ownerUserId,
            emailHash
          }
        }
      })
      .then(record => (record ? toContactRecord(record) : null));
  }

  async createContact(input: CrmContactCreateInput) {
    try {
      const record = await this.prisma.crmContact.create({
        data: input as Prisma.CrmContactUncheckedCreateInput
      });

      return toContactRecord(record);
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        const existingContact = await this.findContactByEmailHash(
          input.organizationId,
          input.ownerUserId,
          input.emailHash
        );

        if (existingContact) return existingContact;
      }

      throw error;
    }
  }

  async updateContact(id: string, input: CrmContactUpdateInput) {
    const records = await this.prisma.crmContact.updateManyAndReturn({
      where: { id },
      data: input,
      limit: 1
    });

    return records[0] ? toContactRecord(records[0]) : null;
  }

  findContactById(args: { id: string; organizationId: string; ownerUserId?: string }) {
    return this.prisma.crmContact
      .findFirst({
        where: toContactIdentityWhere(args)
      })
      .then(record => (record ? toContactRecord(record) : null));
  }

  async updateContactEmailStatus(id: string, emailStatus: CrmEmailStatus) {
    const records = await this.prisma.crmContact.updateManyAndReturn({
      where: { id },
      data: { emailStatus },
      limit: 1
    });

    return records[0] ? toContactRecord(records[0]) : null;
  }

  findEmailVerificationCache(args: { emailHash: string }) {
    return this.prisma.crmEmailVerificationCache
      .findUnique({
        where: {
          emailHash: args.emailHash
        }
      })
      .then(record => (record ? toEmailVerificationCacheRecord(record) : null));
  }

  async upsertEmailVerificationCache(input: CrmEmailVerificationCacheUpsertInput) {
    const record = await this.prisma.crmEmailVerificationCache.upsert({
      where: {
        emailHash: input.emailHash
      },
      create: input,
      update: {
        maskedEmail: input.maskedEmail,
        domain: input.domain,
        status: input.status,
        reason: input.reason,
        verifiedAt: input.verifiedAt,
        expiresAt: input.expiresAt,
        checkedById: input.checkedById,
        checkedByName: input.checkedByName
      }
    });

    return toEmailVerificationCacheRecord(record);
  }
  getGlobalConfig(
    ...args: Parameters<PrismaCrmSettingsStore['getGlobalConfig']>
  ): ReturnType<PrismaCrmSettingsStore['getGlobalConfig']> {
    return this.settingsStore.getGlobalConfig(...args);
  }
  saveGlobalConfig(
    ...args: Parameters<PrismaCrmSettingsStore['saveGlobalConfig']>
  ): ReturnType<PrismaCrmSettingsStore['saveGlobalConfig']> {
    return this.settingsStore.saveGlobalConfig(...args);
  }

  async createAiDraftTask(input: CrmAiDraftTaskCreateInput) {
    try {
      return await this.prisma.$transaction(async tx => this.createAiDraftTaskInsideTransaction(tx, input), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });
    } catch (error) {
      // Serializable conflicts mean another creator won the same capacity window.
      if (isPrismaConcurrentTaskCreateConflict(error)) {
        return {
          task: null,
          limitReason: 'concurrent_create_conflict' as const
        };
      }

      throw error;
    }
  }

  /** Checks queue capacity and creates the task in one serializable transaction. */
  private async createAiDraftTaskInsideTransaction(tx: Prisma.TransactionClient, input: CrmAiDraftTaskCreateInput) {
    const configRecord = await tx.crmAiDraftQueueConfig.findUnique({
      where: { configKey: crmAiDraftQueueConfigKey }
    });
    const config = configRecord ? toAiDraftQueueConfigRecord(configRecord) : createDefaultAiDraftQueueConfig();
    const [activeUserTaskCount, activeOrgTaskCount] = await Promise.all([
      tx.crmAiDraftTask.count({
        where: {
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: { in: crmAiDraftActiveTaskStatuses }
        }
      }),
      tx.crmAiDraftTask.count({
        where: {
          organizationId: input.organizationId,
          status: { in: crmAiDraftActiveTaskStatuses }
        }
      })
    ]);

    if (activeUserTaskCount >= config.maxActiveTasksPerUser) {
      return { task: null, limitReason: 'user_active_limit' as const };
    }

    if (activeOrgTaskCount >= config.maxActiveTasksPerOrg) {
      return { task: null, limitReason: 'organization_active_limit' as const };
    }

    const counts = countAiDraftTaskItems(input.items);
    const status = input.status ?? (counts.pendingCount > 0 ? 'queued' : 'completed');
    const now = new Date();
    const effectiveConcurrency = normalizeCrmAiDraftItemConcurrency(config.itemConcurrency, config.maxItemConcurrency);
    const maxAttempts = normalizeCrmAiDraftMaxAttempts(config.maxAttempts);
    const task = await tx.crmAiDraftTask.create({
      data: {
        organizationId: input.organizationId,
        organizationRole: input.organizationRole ?? null,
        ownerUserId: input.ownerUserId,
        ownerUserName: input.ownerUserName ?? null,
        status,
        requestedCount: input.requestedCount,
        successCount: counts.successCount,
        skippedCount: counts.skippedCount,
        failedCount: counts.failedCount,
        retryingCount: counts.retryingCount,
        runningCount: counts.runningCount,
        pendingCount: counts.pendingCount,
        effectiveConcurrency,
        maxAttempts,
        finishedAt: counts.pendingCount > 0 ? null : now
      } as Prisma.CrmAiDraftTaskUncheckedCreateInput
    });

    if (input.items.length > 0) {
      await tx.crmAiDraftTaskItem.createMany({
        data: input.items.map(item => ({
          taskId: task.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          enrollmentId: item.enrollmentId,
          messageId: item.messageId ?? null,
          contactId: item.contactId ?? null,
          accountId: item.accountId ?? null,
          productLineId: item.productLineId ?? null,
          stepIndex: item.stepIndex,
          status: item.status ?? 'pending',
          maxAttempts,
          failureType: item.failureType ?? null,
          failureReason: item.failureReason ?? null,
          metadata: item.metadata === undefined ? undefined : toNullableJsonInput(item.metadata)
        })) as Prisma.CrmAiDraftTaskItemCreateManyInput[]
      });
    }

    return { task: toAiDraftTaskRecord(task) };
  }

  countActiveAiDraftTasksForUser(input: { organizationId: string; ownerUserId: string }) {
    return this.prisma.crmAiDraftTask.count({
      where: {
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        status: { in: ['queued', 'running'] }
      }
    });
  }

  countActiveAiDraftTasksForOrg(input: { organizationId: string }) {
    return this.prisma.crmAiDraftTask.count({
      where: {
        organizationId: input.organizationId,
        status: { in: ['queued', 'running'] }
      }
    });
  }

  async findCurrentAiDraftTaskForUser(input: { organizationId: string; ownerUserId: string }) {
    const record = await this.prisma.crmAiDraftTask.findFirst({
      where: {
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        OR: [{ status: { in: ['queued', 'running'] } }, { status: { in: ['completed', 'failed'] }, readAt: null }]
      },
      orderBy: { updatedAt: 'desc' }
    });

    return record ? toAiDraftTaskRecord(record) : null;
  }

  async findAiDraftTaskById(input: { id: string; organizationId: string; ownerUserId?: string }) {
    const record = await this.prisma.crmAiDraftTask.findFirst({
      where: {
        id: input.id,
        organizationId: input.organizationId,
        ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {})
      }
    });

    return record ? toAiDraftTaskRecord(record) : null;
  }

  async listAiDraftTasks(input: { organizationId: string; ownerUserId?: string; skip: number; take: number }) {
    const where = {
      organizationId: input.organizationId,
      ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {})
    };
    const [records, total] = await Promise.all([
      this.prisma.crmAiDraftTask.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.crmAiDraftTask.count({ where })
    ]);

    return {
      records: records.map(toAiDraftTaskRecord),
      total
    };
  }

  async listAiDraftTaskItems(input: { taskId: string }) {
    const records = await this.prisma.crmAiDraftTaskItem.findMany({
      where: { taskId: input.taskId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });

    return records.map(toAiDraftTaskItemRecord);
  }

  async updateAiDraftTask(id: string, patch: CrmAiDraftTaskUpdateInput, guard: CrmAiDraftTaskUpdateGuard = {}) {
    const records = await this.prisma.crmAiDraftTask.updateManyAndReturn({
      where: {
        id,
        ...(guard.organizationId ? { organizationId: guard.organizationId } : {}),
        ...(guard.ownerUserId ? { ownerUserId: guard.ownerUserId } : {}),
        ...(guard.runVersion ? { runVersion: guard.runVersion } : {}),
        ...(guard.status ? { status: toStatusWhere(guard.status) } : {})
      },
      data: toAiDraftTaskUpdateData(patch),
      limit: 1
    });

    return records[0] ? toAiDraftTaskRecord(records[0]) : null;
  }

  async updateAiDraftTaskItem(
    id: string,
    patch: CrmAiDraftTaskItemUpdateInput,
    guard: CrmAiDraftTaskItemUpdateGuard = {}
  ) {
    const records = await this.prisma.crmAiDraftTaskItem.updateManyAndReturn({
      where: {
        id,
        ...(guard.taskId ? { taskId: guard.taskId } : {}),
        ...(guard.organizationId ? { organizationId: guard.organizationId } : {}),
        ...(guard.ownerUserId ? { ownerUserId: guard.ownerUserId } : {}),
        ...(guard.status ? { status: toStatusWhere(guard.status) } : {})
      },
      data: toAiDraftTaskItemUpdateData(patch),
      limit: 1
    });

    return records[0] ? toAiDraftTaskItemRecord(records[0]) : null;
  }
  getAiDraftQueueConfig(
    ...args: Parameters<PrismaCrmSettingsStore['getAiDraftQueueConfig']>
  ): ReturnType<PrismaCrmSettingsStore['getAiDraftQueueConfig']> {
    return this.settingsStore.getAiDraftQueueConfig(...args);
  }
  saveAiDraftQueueConfig(
    ...args: Parameters<PrismaCrmSettingsStore['saveAiDraftQueueConfig']>
  ): ReturnType<PrismaCrmSettingsStore['saveAiDraftQueueConfig']> {
    return this.settingsStore.saveAiDraftQueueConfig(...args);
  }
  getSendPreference(
    ...args: Parameters<PrismaCrmSettingsStore['getSendPreference']>
  ): ReturnType<PrismaCrmSettingsStore['getSendPreference']> {
    return this.settingsStore.getSendPreference(...args);
  }
  saveSendPreference(
    ...args: Parameters<PrismaCrmSettingsStore['saveSendPreference']>
  ): ReturnType<PrismaCrmSettingsStore['saveSendPreference']> {
    return this.settingsStore.saveSendPreference(...args);
  }

  async countOwnerQueuedMessages(args: { organizationId: string; ownerUserId: string }) {
    return this.prisma.crmMessage.count({
      where: {
        organizationId: args.organizationId,
        ownerUserId: args.ownerUserId,
        status: 'queued'
      }
    });
  }

  async countDispatchedMessages(input: CrmDispatchedMessageCountInput) {
    return this.prisma.crmMessage.count({
      where: {
        organizationId: input.organizationId,
        ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
        ...(input.mailboxId ? { mailboxId: input.mailboxId } : {}),
        ...toStepKindWhere(input.stepKind),
        OR: [
          {
            status: 'queued',
            scheduledAt: {
              gte: input.from,
              lt: input.to
            }
          },
          {
            status: 'sent',
            sentAt: {
              gte: input.from,
              lt: input.to
            }
          }
        ]
      }
    });
  }

  /** Batch loads owner-level send scheduler state to avoid per-owner count queries. */
  async listOwnerSendStates(input: CrmOwnerSendStateBatchInput) {
    const owners = toUniqueOwnerPairs(input.owners);

    if (owners.length === 0) {
      return [];
    }

    const ownerFilters = toOwnerPairFilters(owners);
    const [preferences, queuedRows, dispatchedRows] = await Promise.all([
      this.prisma.crmUserSendPreference.findMany({
        where: {
          OR: ownerFilters
        }
      }),
      this.prisma.crmMessage.groupBy({
        by: ['organizationId', 'ownerUserId'],
        where: {
          AND: [{ OR: ownerFilters }, { status: 'queued' }]
        },
        _count: {
          _all: true
        }
      }),
      this.prisma.crmMessage.groupBy({
        by: ['organizationId', 'ownerUserId', 'stepIndex'],
        where: {
          AND: [{ OR: ownerFilters }, toDispatchedMessageRangeWhere(input.from, input.to)]
        },
        _count: {
          _all: true
        }
      })
    ]);
    const preferencesByOwner = new Map(
      preferences.map(preference => [toOwnerPairKey(preference.organizationId, preference.ownerUserId), preference])
    );
    const queuedCountByOwner = new Map(
      queuedRows.map(row => [toOwnerPairKey(row.organizationId, row.ownerUserId), row._count._all])
    );
    const dispatchedCountByOwner = new Map<
      string,
      {
        dailyCount: number;
        firstTouchCount: number;
        followUpCount: number;
      }
    >();

    for (const row of dispatchedRows) {
      const key = toOwnerPairKey(row.organizationId, row.ownerUserId);
      const count = row._count._all;
      const current = dispatchedCountByOwner.get(key) ?? {
        dailyCount: 0,
        firstTouchCount: 0,
        followUpCount: 0
      };

      current.dailyCount += count;
      if (row.stepIndex === 1) {
        current.firstTouchCount += count;
      } else {
        current.followUpCount += count;
      }
      dispatchedCountByOwner.set(key, current);
    }

    return owners.map(owner => {
      const key = toOwnerPairKey(owner.organizationId, owner.ownerUserId);
      const dispatchedCount = dispatchedCountByOwner.get(key);
      const preference = preferencesByOwner.get(key);

      return {
        organizationId: owner.organizationId,
        ownerUserId: owner.ownerUserId,
        preference: preference ? toSendPreferenceRecord(preference) : null,
        queuedCount: queuedCountByOwner.get(key) ?? 0,
        dailyCount: dispatchedCount?.dailyCount ?? 0,
        firstTouchCount: dispatchedCount?.firstTouchCount ?? 0,
        followUpCount: dispatchedCount?.followUpCount ?? 0
      };
    });
  }

  /** Batch loads mailbox daily and hourly send counters for scheduler capacity checks. */
  async listMailboxSendStates(input: CrmMailboxSendStateBatchInput) {
    const mailboxes = toUniqueMailboxPairs(input.mailboxes);

    if (mailboxes.length === 0) {
      return [];
    }

    const mailboxFilters = toMailboxPairFilters(mailboxes);
    const [dailyRows, hourlyRows] = await Promise.all([
      this.prisma.crmMessage.groupBy({
        by: ['organizationId', 'mailboxId'],
        where: {
          AND: [{ OR: mailboxFilters }, toDispatchedMessageRangeWhere(input.day.from, input.day.to)]
        },
        _count: {
          _all: true
        }
      }),
      this.prisma.crmMessage.groupBy({
        by: ['organizationId', 'mailboxId'],
        where: {
          AND: [{ OR: mailboxFilters }, toDispatchedMessageRangeWhere(input.hour.from, input.hour.to)]
        },
        _count: {
          _all: true
        }
      })
    ]);
    const dailyCountByMailbox = toMailboxCountMap(dailyRows);
    const hourlyCountByMailbox = toMailboxCountMap(hourlyRows);

    return mailboxes.map(mailbox => {
      const key = toMailboxPairKey(mailbox.organizationId, mailbox.mailboxId);

      return {
        organizationId: mailbox.organizationId,
        mailboxId: mailbox.mailboxId,
        dailyCount: dailyCountByMailbox.get(key) ?? 0,
        hourlyCount: hourlyCountByMailbox.get(key) ?? 0
      };
    });
  }
  getWorkbenchOverview(
    ...args: Parameters<PrismaCrmDashboardStore['getWorkbenchOverview']>
  ): ReturnType<PrismaCrmDashboardStore['getWorkbenchOverview']> {
    return this.dashboardStore.getWorkbenchOverview(...args);
  }

  async listDueSendCandidates(input: CrmDueSendCandidateListInput): Promise<CrmDueSendCandidateRecord[]> {
    const records = await this.prisma.crmMessage.findMany({
      where: {
        status: 'draft_ready',
        scheduledAt: {
          lte: input.now
        },
        mailboxId: {
          not: null
        },
        mailbox: {
          is: {
            status: 'active'
          }
        },
        enrollment: {
          status: 'sequence_running'
        },
        contact: {
          emailStatus: {
            not: 'unsubscribed'
          }
        }
      },
      include: {
        account: true,
        contact: true,
        mailbox: true,
        enrollment: {
          include: {
            productLine: true
          }
        }
      },
      orderBy: [{ scheduledAt: 'asc' }, { updatedAt: 'asc' }],
      take: input.take
    });
    const blacklistedContactKeys = await this.findBlacklistedDueCandidateKeys(records);
    const candidates: CrmDueSendCandidateRecord[] = [];

    for (const record of records) {
      if (!record.mailbox || record.mailbox.status !== 'active') {
        continue;
      }

      if (record.enrollment.status !== 'sequence_running' || record.contact.emailStatus === 'unsubscribed') {
        continue;
      }

      if (blacklistedContactKeys.has(toCrmBlacklistPairKey(record.organizationId, record.contact.emailHash))) {
        continue;
      }

      candidates.push({
        enrollment: toSequenceEnrollmentRecord(record.enrollment),
        account: toAccountRecord(record.account),
        contact: toContactRecord(record.contact),
        productLine: record.enrollment.productLine ? toProductLineRecord(record.enrollment.productLine) : null,
        mailbox: toMailboxRecord(record.mailbox),
        firstMessage: record.stepIndex === 1 ? toMessageRecord(record) : null,
        messages: [toMessageRecord(record)],
        message: toMessageRecord(record),
        stepKind: record.stepIndex === 1 ? 'first_touch' : 'follow_up'
      });
    }

    return candidates;
  }

  /** Batch loads blacklist keys for due send candidates to avoid per-message blacklist lookups. */
  private async findBlacklistedDueCandidateKeys(
    records: Array<{ organizationId: string; contact: { emailHash: string } }>
  ) {
    const blacklistPairs = Array.from(
      new Map(
        records.map(record => [
          toCrmBlacklistPairKey(record.organizationId, record.contact.emailHash),
          {
            organizationId: record.organizationId,
            emailHash: record.contact.emailHash
          }
        ])
      ).values()
    );

    if (blacklistPairs.length === 0) {
      return new Set<string>();
    }

    const blacklists = await this.prisma.crmBlacklist.findMany({
      where: {
        OR: blacklistPairs
      },
      select: {
        organizationId: true,
        emailHash: true
      }
    });

    return new Set(blacklists.map(record => toCrmBlacklistPairKey(record.organizationId, record.emailHash)));
  }

  async listStaleQueuedMessages(input: { before: Date; take: number }): Promise<CrmMessageRecord[]> {
    const records = await this.prisma.crmMessage.findMany({
      where: {
        status: 'queued',
        bullJobId: {
          not: null
        },
        scheduledAt: {
          lte: input.before
        }
      },
      orderBy: [{ scheduledAt: 'asc' }, { updatedAt: 'asc' }],
      take: input.take
    });

    return records.map(toMessageRecord);
  }
  getOrganizationConfig(
    ...args: Parameters<PrismaCrmSettingsStore['getOrganizationConfig']>
  ): ReturnType<PrismaCrmSettingsStore['getOrganizationConfig']> {
    return this.settingsStore.getOrganizationConfig(...args);
  }
  saveOrganizationConfig(
    ...args: Parameters<PrismaCrmSettingsStore['saveOrganizationConfig']>
  ): ReturnType<PrismaCrmSettingsStore['saveOrganizationConfig']> {
    return this.settingsStore.saveOrganizationConfig(...args);
  }

  findBlacklistEntry(args: { organizationId: string; emailHash: string }) {
    return this.prisma.crmBlacklist
      .findUnique({
        where: {
          organizationId_emailHash: {
            organizationId: args.organizationId,
            emailHash: args.emailHash
          }
        }
      })
      .then(record => (record ? toBlacklistRecord(record) : null));
  }

  async listBlacklistEntriesByEmailHashes(args: { organizationId: string; emailHashes: string[] }) {
    const emailHashes = toUniqueStrings(args.emailHashes);

    if (emailHashes.length === 0) {
      return [];
    }

    const records = await this.prisma.crmBlacklist.findMany({
      where: {
        organizationId: args.organizationId,
        emailHash: { in: emailHashes }
      }
    });

    return records.map(toBlacklistRecord);
  }

  async upsertBlacklistEntry(input: CrmBlacklistUpsertInput) {
    const record = await this.prisma.crmBlacklist.upsert({
      where: {
        organizationId_emailHash: {
          organizationId: input.organizationId,
          emailHash: input.emailHash
        }
      },
      create: input,
      update: {
        maskedEmail: input.maskedEmail,
        reason: input.reason,
        sourceAccountId: input.sourceAccountId ?? null,
        sourceContactId: input.sourceContactId ?? null,
        sourceMessageId: input.sourceMessageId ?? null,
        createdById: input.createdById ?? null,
        createdByName: input.createdByName ?? null
      }
    });

    return toBlacklistRecord(record);
  }

  async listBlacklistEntries(input: CrmBlacklistListInput) {
    const where = toBlacklistListWhere(input);
    const [records, total] = await Promise.all([
      this.prisma.crmBlacklist.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: { updatedAt: 'desc' }
      }),
      this.prisma.crmBlacklist.count({ where })
    ]);

    return {
      records: records.map(toBlacklistRecord),
      total
    };
  }

  async deleteBlacklistEntry(input: CrmBlacklistDeleteInput) {
    const record = await this.prisma.crmBlacklist.findFirst({
      where: {
        id: input.id,
        organizationId: input.organizationId
      }
    });

    if (!record) {
      return null;
    }

    await this.prisma.crmBlacklist.delete({
      where: {
        id: record.id
      }
    });

    return toBlacklistRecord(record);
  }

  async findArchivedFingerprints(input: CrmArchivedFingerprintLookupInput) {
    if (input.fingerprints.length === 0) {
      return [];
    }

    const records = await this.prisma.crmArchivedFingerprint.findMany({
      where: {
        organizationId: input.organizationId,
        OR: input.fingerprints.map(fingerprint => ({
          fingerprintType: fingerprint.fingerprintType,
          fingerprintValue: fingerprint.fingerprintValue
        }))
      },
      orderBy: {
        archivedAt: 'desc'
      }
    });

    return records.map(toArchivedFingerprintRecord);
  }

  async upsertArchivedFingerprint(input: CrmArchivedFingerprintUpsertInput) {
    const record = await this.prisma.crmArchivedFingerprint.upsert({
      where: {
        organizationId_fingerprintType_fingerprintValue: {
          organizationId: input.organizationId,
          fingerprintType: input.fingerprintType,
          fingerprintValue: input.fingerprintValue
        }
      },
      create: input,
      update: {
        maskedValue: input.maskedValue ?? null,
        accountName: input.accountName ?? null,
        normalizedName: input.normalizedName ?? null,
        country: input.country ?? null,
        sourceAccountId: input.sourceAccountId ?? null,
        sourceContactId: input.sourceContactId ?? null,
        sourceTaskId: input.sourceTaskId ?? null,
        archiveReason: input.archiveReason ?? null,
        archivedAt: input.archivedAt
      }
    });

    return toArchivedFingerprintRecord(record);
  }

  async listAccounts(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmAccountStatus;
    skip: number;
    take: number;
  }) {
    const where = toAccountListWhere(args);
    const [records, total] = await Promise.all([
      this.prisma.crmAccount.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: { updatedAt: 'desc' }
      }),
      this.prisma.crmAccount.count({ where })
    ]);

    return {
      records: records.map(toAccountRecord),
      total
    };
  }

  async getAccountDetail(args: { id: string; organizationId: string; ownerUserId?: string }) {
    const account = await this.prisma.crmAccount.findFirst({
      where: toAccountIdentityWhere(args)
    });

    if (!account) return null;

    const [contacts, timelineEvents] = await Promise.all([
      this.prisma.crmContact.findMany({
        where: {
          organizationId: args.organizationId,
          accountId: account.id
        },
        orderBy: {
          createdAt: 'asc'
        }
      }),
      this.prisma.crmTimelineEvent.findMany({
        where: {
          organizationId: args.organizationId,
          accountId: account.id
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    ]);

    return {
      account: toAccountRecord(account),
      contacts: contacts.map(toContactRecord),
      timelineEvents: timelineEvents.map(toTimelineEventRecord)
    };
  }

  async createTimelineEvent(input: CrmTimelineEventCreateInput) {
    const record = await this.prisma.crmTimelineEvent.create({
      data: {
        organizationId: input.organizationId,
        accountId: input.accountId,
        contactId: input.contactId,
        ownerUserId: input.ownerUserId,
        eventType: input.eventType,
        title: input.title,
        content: input.content,
        metadata: input.metadata as Prisma.CrmTimelineEventCreateInput['metadata']
      }
    });

    return toTimelineEventRecord(record);
  }
  findMailboxByProviderAndEmailHash(
    ...args: Parameters<PrismaCrmMailboxStore['findMailboxByProviderAndEmailHash']>
  ): ReturnType<PrismaCrmMailboxStore['findMailboxByProviderAndEmailHash']> {
    return this.mailboxStore.findMailboxByProviderAndEmailHash(...args);
  }
  createMailbox(
    ...args: Parameters<PrismaCrmMailboxStore['createMailbox']>
  ): ReturnType<PrismaCrmMailboxStore['createMailbox']> {
    return this.mailboxStore.createMailbox(...args);
  }
  listMailboxes(
    ...args: Parameters<PrismaCrmMailboxStore['listMailboxes']>
  ): ReturnType<PrismaCrmMailboxStore['listMailboxes']> {
    return this.mailboxStore.listMailboxes(...args);
  }
  findMailboxById(
    ...args: Parameters<PrismaCrmMailboxStore['findMailboxById']>
  ): ReturnType<PrismaCrmMailboxStore['findMailboxById']> {
    return this.mailboxStore.findMailboxById(...args);
  }
  updateMailbox(
    ...args: Parameters<PrismaCrmMailboxStore['updateMailbox']>
  ): ReturnType<PrismaCrmMailboxStore['updateMailbox']> {
    return this.mailboxStore.updateMailbox(...args);
  }
  listMailboxesForWatchRenewal(
    ...args: Parameters<PrismaCrmMailboxStore['listMailboxesForWatchRenewal']>
  ): ReturnType<PrismaCrmMailboxStore['listMailboxesForWatchRenewal']> {
    return this.mailboxStore.listMailboxesForWatchRenewal(...args);
  }
  advanceMailboxHistoryId(
    ...args: Parameters<PrismaCrmMailboxStore['advanceMailboxHistoryId']>
  ): ReturnType<PrismaCrmMailboxStore['advanceMailboxHistoryId']> {
    return this.mailboxStore.advanceMailboxHistoryId(...args);
  }
  listProductLines(
    ...args: Parameters<PrismaCrmSettingsStore['listProductLines']>
  ): ReturnType<PrismaCrmSettingsStore['listProductLines']> {
    return this.settingsStore.listProductLines(...args);
  }
  findProductLineByName(
    ...args: Parameters<PrismaCrmSettingsStore['findProductLineByName']>
  ): ReturnType<PrismaCrmSettingsStore['findProductLineByName']> {
    return this.settingsStore.findProductLineByName(...args);
  }
  findProductLineById(
    ...args: Parameters<PrismaCrmSettingsStore['findProductLineById']>
  ): ReturnType<PrismaCrmSettingsStore['findProductLineById']> {
    return this.settingsStore.findProductLineById(...args);
  }
  createProductLine(
    ...args: Parameters<PrismaCrmSettingsStore['createProductLine']>
  ): ReturnType<PrismaCrmSettingsStore['createProductLine']> {
    return this.settingsStore.createProductLine(...args);
  }
  updateProductLine(
    ...args: Parameters<PrismaCrmSettingsStore['updateProductLine']>
  ): ReturnType<PrismaCrmSettingsStore['updateProductLine']> {
    return this.settingsStore.updateProductLine(...args);
  }
  createProductLineAiPromptVersion(
    ...args: Parameters<PrismaCrmSettingsStore['createProductLineAiPromptVersion']>
  ): ReturnType<PrismaCrmSettingsStore['createProductLineAiPromptVersion']> {
    return this.settingsStore.createProductLineAiPromptVersion(...args);
  }
  listProductLineAiPromptVersions(
    ...args: Parameters<PrismaCrmSettingsStore['listProductLineAiPromptVersions']>
  ): ReturnType<PrismaCrmSettingsStore['listProductLineAiPromptVersions']> {
    return this.settingsStore.listProductLineAiPromptVersions(...args);
  }
  restoreProductLineAiPromptVersion(
    ...args: Parameters<PrismaCrmSettingsStore['restoreProductLineAiPromptVersion']>
  ): ReturnType<PrismaCrmSettingsStore['restoreProductLineAiPromptVersion']> {
    return this.settingsStore.restoreProductLineAiPromptVersion(...args);
  }
  listPersonaProfiles(
    ...args: Parameters<PrismaCrmSettingsStore['listPersonaProfiles']>
  ): ReturnType<PrismaCrmSettingsStore['listPersonaProfiles']> {
    return this.settingsStore.listPersonaProfiles(...args);
  }
  listActivePersonaProfiles(
    ...args: Parameters<PrismaCrmSettingsStore['listActivePersonaProfiles']>
  ): ReturnType<PrismaCrmSettingsStore['listActivePersonaProfiles']> {
    return this.settingsStore.listActivePersonaProfiles(...args);
  }
  findPersonaProfileByName(
    ...args: Parameters<PrismaCrmSettingsStore['findPersonaProfileByName']>
  ): ReturnType<PrismaCrmSettingsStore['findPersonaProfileByName']> {
    return this.settingsStore.findPersonaProfileByName(...args);
  }
  findPersonaProfileById(
    ...args: Parameters<PrismaCrmSettingsStore['findPersonaProfileById']>
  ): ReturnType<PrismaCrmSettingsStore['findPersonaProfileById']> {
    return this.settingsStore.findPersonaProfileById(...args);
  }
  createPersonaProfile(
    ...args: Parameters<PrismaCrmSettingsStore['createPersonaProfile']>
  ): ReturnType<PrismaCrmSettingsStore['createPersonaProfile']> {
    return this.settingsStore.createPersonaProfile(...args);
  }
  updatePersonaProfile(
    ...args: Parameters<PrismaCrmSettingsStore['updatePersonaProfile']>
  ): ReturnType<PrismaCrmSettingsStore['updatePersonaProfile']> {
    return this.settingsStore.updatePersonaProfile(...args);
  }
  setDefaultPersonaProfile(
    ...args: Parameters<PrismaCrmSettingsStore['setDefaultPersonaProfile']>
  ): ReturnType<PrismaCrmSettingsStore['setDefaultPersonaProfile']> {
    return this.settingsStore.setDefaultPersonaProfile(...args);
  }
  listEmailTemplateGroups(
    ...args: Parameters<PrismaCrmSettingsStore['listEmailTemplateGroups']>
  ): ReturnType<PrismaCrmSettingsStore['listEmailTemplateGroups']> {
    return this.settingsStore.listEmailTemplateGroups(...args);
  }
  findEmailTemplateGroupByName(
    ...args: Parameters<PrismaCrmSettingsStore['findEmailTemplateGroupByName']>
  ): ReturnType<PrismaCrmSettingsStore['findEmailTemplateGroupByName']> {
    return this.settingsStore.findEmailTemplateGroupByName(...args);
  }
  findEmailTemplateGroupById(
    ...args: Parameters<PrismaCrmSettingsStore['findEmailTemplateGroupById']>
  ): ReturnType<PrismaCrmSettingsStore['findEmailTemplateGroupById']> {
    return this.settingsStore.findEmailTemplateGroupById(...args);
  }
  findDefaultEmailTemplateGroup(
    ...args: Parameters<PrismaCrmSettingsStore['findDefaultEmailTemplateGroup']>
  ): ReturnType<PrismaCrmSettingsStore['findDefaultEmailTemplateGroup']> {
    return this.settingsStore.findDefaultEmailTemplateGroup(...args);
  }
  createEmailTemplateGroup(
    ...args: Parameters<PrismaCrmSettingsStore['createEmailTemplateGroup']>
  ): ReturnType<PrismaCrmSettingsStore['createEmailTemplateGroup']> {
    return this.settingsStore.createEmailTemplateGroup(...args);
  }
  updateEmailTemplateGroup(
    ...args: Parameters<PrismaCrmSettingsStore['updateEmailTemplateGroup']>
  ): ReturnType<PrismaCrmSettingsStore['updateEmailTemplateGroup']> {
    return this.settingsStore.updateEmailTemplateGroup(...args);
  }
  setDefaultEmailTemplateGroup(
    ...args: Parameters<PrismaCrmSettingsStore['setDefaultEmailTemplateGroup']>
  ): ReturnType<PrismaCrmSettingsStore['setDefaultEmailTemplateGroup']> {
    return this.settingsStore.setDefaultEmailTemplateGroup(...args);
  }
  listSequencePolicies(
    ...args: Parameters<PrismaCrmSettingsStore['listSequencePolicies']>
  ): ReturnType<PrismaCrmSettingsStore['listSequencePolicies']> {
    return this.settingsStore.listSequencePolicies(...args);
  }
  findSequencePolicyByName(
    ...args: Parameters<PrismaCrmSettingsStore['findSequencePolicyByName']>
  ): ReturnType<PrismaCrmSettingsStore['findSequencePolicyByName']> {
    return this.settingsStore.findSequencePolicyByName(...args);
  }
  findSequencePolicyById(
    ...args: Parameters<PrismaCrmSettingsStore['findSequencePolicyById']>
  ): ReturnType<PrismaCrmSettingsStore['findSequencePolicyById']> {
    return this.settingsStore.findSequencePolicyById(...args);
  }
  findDefaultSequencePolicy(
    ...args: Parameters<PrismaCrmSettingsStore['findDefaultSequencePolicy']>
  ): ReturnType<PrismaCrmSettingsStore['findDefaultSequencePolicy']> {
    return this.settingsStore.findDefaultSequencePolicy(...args);
  }
  createSequencePolicy(
    ...args: Parameters<PrismaCrmSettingsStore['createSequencePolicy']>
  ): ReturnType<PrismaCrmSettingsStore['createSequencePolicy']> {
    return this.settingsStore.createSequencePolicy(...args);
  }
  updateSequencePolicy(
    ...args: Parameters<PrismaCrmSettingsStore['updateSequencePolicy']>
  ): ReturnType<PrismaCrmSettingsStore['updateSequencePolicy']> {
    return this.settingsStore.updateSequencePolicy(...args);
  }
  setDefaultSequencePolicy(
    ...args: Parameters<PrismaCrmSettingsStore['setDefaultSequencePolicy']>
  ): ReturnType<PrismaCrmSettingsStore['setDefaultSequencePolicy']> {
    return this.settingsStore.setDefaultSequencePolicy(...args);
  }

  findActiveEnrollmentByContact(args: {
    organizationId: string;
    ownerUserId: string;
    contactId: string;
    statuses: CrmSequenceEnrollmentStatus[];
  }) {
    return this.prisma.crmSequenceEnrollment
      .findFirst({
        where: {
          organizationId: args.organizationId,
          ownerUserId: args.ownerUserId,
          contactId: args.contactId,
          status: { in: args.statuses }
        },
        orderBy: { updatedAt: 'desc' }
      })
      .then(record => (record ? toSequenceEnrollmentRecord(record) : null));
  }

  findActiveEnrollmentByAccount(args: {
    organizationId: string;
    ownerUserId: string;
    accountId: string;
    statuses: CrmSequenceEnrollmentStatus[];
  }) {
    return this.prisma.crmSequenceEnrollment
      .findFirst({
        where: {
          organizationId: args.organizationId,
          ownerUserId: args.ownerUserId,
          accountId: args.accountId,
          status: { in: args.statuses }
        },
        orderBy: { updatedAt: 'desc' }
      })
      .then(record => (record ? toSequenceEnrollmentRecord(record) : null));
  }

  async createSequenceEnrollment(input: CrmSequenceEnrollmentCreateInput) {
    const record = await this.prisma.crmSequenceEnrollment.create({
      data: input as Prisma.CrmSequenceEnrollmentUncheckedCreateInput
    });

    return toSequenceEnrollmentRecord(record);
  }

  async createSequenceDraftBundle(input: CrmSequenceDraftBundleCreateInput): Promise<CrmSequenceDraftBundleRecord> {
    return this.prisma.$transaction(async tx => {
      const enrollment = await tx.crmSequenceEnrollment.create({
        data: input.enrollment as Prisma.CrmSequenceEnrollmentUncheckedCreateInput
      });
      const message = await tx.crmMessage.create({
        data: {
          ...input.message,
          enrollmentId: enrollment.id
        } as Prisma.CrmMessageUncheckedCreateInput
      });
      const account = await tx.crmAccount.update({
        where: { id: input.enrollment.accountId },
        data: { status: input.accountStatus }
      });
      const event = await tx.crmTimelineEvent.create({
        data: {
          organizationId: input.timelineEvent.organizationId,
          accountId: input.timelineEvent.accountId,
          contactId: input.timelineEvent.contactId,
          ownerUserId: input.timelineEvent.ownerUserId,
          eventType: input.timelineEvent.eventType,
          title: input.timelineEvent.title,
          content: input.timelineEvent.content,
          metadata: {
            ...input.timelineEvent.metadata,
            enrollmentId: enrollment.id,
            messageId: message.id
          } as Prisma.InputJsonValue
        }
      });

      return {
        enrollment: toSequenceEnrollmentRecord(enrollment),
        message: toMessageRecord(message),
        account: toAccountRecord(account),
        event: toTimelineEventRecord(event)
      };
    });
  }

  async createFollowUpDraftBundle(
    input: CrmFollowUpDraftBundleCreateInput
  ): Promise<CrmFollowUpDraftBundleRecord | null> {
    return this.prisma.$transaction(async tx => {
      if (input.taskGuard) {
        const task = await tx.crmAiDraftTask.findFirst({
          where: {
            id: input.taskGuard.taskId,
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            runVersion: input.taskGuard.runVersion,
            status: toStatusWhere(input.taskGuard.status)
          }
        });

        if (!task) {
          return null;
        }
      }

      const enrollment = await tx.crmSequenceEnrollment.findFirst({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          ...(input.expectedEnrollmentStatus ? { status: toStatusWhere(input.expectedEnrollmentStatus) } : {})
        }
      });

      if (!enrollment) {
        return null;
      }

      const existingMessage = await tx.crmMessage.findFirst({
        where: {
          enrollmentId: enrollment.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          OR: [
            { stepIndex: input.message.stepIndex },
            ...(input.blockingMessageStatuses?.length ? [{ status: { in: input.blockingMessageStatuses } }] : [])
          ]
        }
      });

      if (existingMessage) {
        return null;
      }

      const message = await tx.crmMessage.create({
        data: {
          ...input.message,
          enrollmentId: enrollment.id
        } as Prisma.CrmMessageUncheckedCreateInput
      });
      const metadata = input.timelineEvent.metadata as Record<string, unknown>;
      const event = await tx.crmTimelineEvent.create({
        data: {
          ...input.timelineEvent,
          metadata: {
            ...metadata,
            messageId: message.id
          }
        } as Prisma.CrmTimelineEventUncheckedCreateInput
      });

      return {
        enrollment: toSequenceEnrollmentRecord(enrollment),
        message: toMessageRecord(message),
        event: toTimelineEventRecord(event)
      };
    });
  }

  async listSequenceReviewItems(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmSequenceEnrollmentStatus;
    todoType?: CrmSequenceReviewTodoType;
    messageStatus?: CrmMessageStatus;
    dateScope?: 'today';
    now?: Date;
    skip: number;
    take: number;
  }) {
    const where = toSequenceEnrollmentListWhere(args);
    const [records, total] = await Promise.all([
      this.prisma.crmSequenceEnrollment.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: { updatedAt: 'desc' },
        include: toSequenceReviewInclude()
      }),
      this.prisma.crmSequenceEnrollment.count({ where })
    ]);

    return {
      records: records.map(toSequenceReviewRecord),
      total
    };
  }
  listStrategyStats(
    ...args: Parameters<PrismaCrmDashboardStore['listStrategyStats']>
  ): ReturnType<PrismaCrmDashboardStore['listStrategyStats']> {
    return this.dashboardStore.listStrategyStats(...args);
  }

  async getSequenceReviewItem(args: { id: string; organizationId: string; ownerUserId?: string }) {
    const record = await this.prisma.crmSequenceEnrollment.findFirst({
      where: toSequenceEnrollmentIdentityWhere(args),
      include: toSequenceReviewInclude()
    });

    return record ? toSequenceReviewRecord(record) : null;
  }

  async listSequenceReviewItemsByIds(args: { ids: string[]; organizationId: string; ownerUserId?: string }) {
    const ids = toUniqueStrings(args.ids);

    if (ids.length === 0) {
      return [];
    }

    const records = await this.prisma.crmSequenceEnrollment.findMany({
      where: {
        id: { in: ids },
        organizationId: args.organizationId,
        ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
      },
      include: toSequenceReviewInclude()
    });

    return records.map(toSequenceReviewRecord);
  }

  async updateSequenceEnrollment(id: string, organizationId: string, input: CrmSequenceEnrollmentUpdateInput) {
    const records = await this.prisma.crmSequenceEnrollment.updateManyAndReturn({
      where: {
        id,
        organizationId
      },
      data: input,
      limit: 1
    });

    return records[0] ? toSequenceEnrollmentRecord(records[0]) : null;
  }

  async createMessage(input: CrmMessageCreateInput) {
    const record = await this.prisma.crmMessage.create({
      data: input as Prisma.CrmMessageUncheckedCreateInput
    });

    return toMessageRecord(record);
  }

  findMessageById(args: { id: string; organizationId: string; ownerUserId?: string }) {
    return this.prisma.crmMessage
      .findFirst({
        where: toMessageIdentityWhere(args)
      })
      .then(record => (record ? toMessageRecord(record) : null));
  }

  findSentMessageByProviderId(args: {
    organizationId: string;
    ownerUserId: string;
    mailboxId: string | null;
    providerMessageId: string;
  }) {
    return this.prisma.crmMessage
      .findFirst({
        where: {
          organizationId: args.organizationId,
          ownerUserId: args.ownerUserId,
          mailboxId: args.mailboxId,
          providerMessageId: args.providerMessageId,
          status: 'sent'
        }
      })
      .then(record => (record ? toMessageRecord(record) : null));
  }

  findSentMessageByProviderThreadId(args: {
    organizationId: string;
    ownerUserId: string;
    mailboxId: string | null;
    providerThreadId: string;
  }) {
    return this.prisma.crmMessage
      .findFirst({
        where: {
          organizationId: args.organizationId,
          ownerUserId: args.ownerUserId,
          mailboxId: args.mailboxId,
          providerThreadId: args.providerThreadId,
          status: 'sent'
        }
      })
      .then(record => (record ? toMessageRecord(record) : null));
  }

  async updateMessage(
    id: string,
    organizationId: string,
    input: CrmMessageUpdateInput,
    guard?: CrmMessageDraftUpdateGuard
  ) {
    const records = await this.prisma.crmMessage.updateManyAndReturn({
      where: {
        id,
        organizationId,
        ...(guard ? { status: guard.status } : {})
      },
      data: input as Prisma.CrmMessageUpdateManyMutationInput,
      limit: 1
    });

    return records[0] ? toMessageRecord(records[0]) : null;
  }

  async createMessageDraftVersion(input: CrmMessageDraftVersionCreateInput) {
    const records = await this.prisma.$queryRaw<CrmMessageDraftVersionRaw[]>`
      WITH next_version AS (
        SELECT COALESCE(MAX("versionNo"), 0) + 1 AS "versionNo"
        FROM "CrmMessageDraftVersion"
        WHERE "messageId" = ${input.messageId}
      )
      INSERT INTO "CrmMessageDraftVersion" (
        "id",
        "organizationId",
        "ownerUserId",
        "accountId",
        "contactId",
        "enrollmentId",
        "messageId",
        "mailboxId",
        "stepIndex",
        "versionNo",
        "subject",
        "bodyText",
        "editorId",
        "editorName"
      )
      SELECT
        ${randomUUID()},
        ${input.organizationId},
        ${input.ownerUserId},
        ${input.accountId},
        ${input.contactId},
        ${input.enrollmentId},
        ${input.messageId},
        ${input.mailboxId ?? null},
        ${input.stepIndex},
        next_version."versionNo",
        ${input.subject},
        ${input.bodyText},
        ${input.editorId},
        ${input.editorName ?? null}
      FROM next_version
      RETURNING *
    `;

    const record = records[0];

    if (!record) {
      throw new Error('CRM draft version insert returned no record');
    }

    return toMessageDraftVersionRecord(record);
  }

  async listMessageDraftVersions(args: { messageId: string; organizationId: string; ownerUserId?: string }) {
    const records = args.ownerUserId
      ? await this.prisma.$queryRaw<CrmMessageDraftVersionRaw[]>`
          SELECT *
          FROM "CrmMessageDraftVersion"
          WHERE "messageId" = ${args.messageId}
            AND "organizationId" = ${args.organizationId}
            AND "ownerUserId" = ${args.ownerUserId}
          ORDER BY "versionNo" DESC, "createdAt" DESC
        `
      : await this.prisma.$queryRaw<CrmMessageDraftVersionRaw[]>`
          SELECT *
          FROM "CrmMessageDraftVersion"
          WHERE "messageId" = ${args.messageId}
            AND "organizationId" = ${args.organizationId}
          ORDER BY "versionNo" DESC, "createdAt" DESC
        `;

    return records.map(toMessageDraftVersionRecord);
  }

  async restoreMessageDraftVersion(input: CrmMessageDraftVersionRestoreInput) {
    return this.prisma.$transaction(async tx => {
      const versions = await tx.$queryRaw<CrmMessageDraftVersionRaw[]>`
        SELECT *
        FROM "CrmMessageDraftVersion"
        WHERE "id" = ${input.versionId}
          AND "messageId" = ${input.messageId}
          AND "organizationId" = ${input.organizationId}
          AND "ownerUserId" = ${input.ownerUserId}
        LIMIT 1
      `;
      const version = versions[0];

      if (!version) {
        return null;
      }

      const records = await tx.crmMessage.updateManyAndReturn({
        where: {
          id: input.messageId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: 'draft_pending_review'
        },
        data: {
          subject: version.subject,
          bodyText: version.bodyText
        },
        limit: 1
      });

      return records[0] ? toMessageRecord(records[0]) : null;
    });
  }

  async approveMessageDraft(input: CrmDraftApprovalInput): Promise<CrmDraftApprovalRecord | null> {
    return this.prisma.$transaction(async tx => {
      const [targetMessage, targetEnrollment] = await Promise.all([
        tx.crmMessage.findFirst({
          where: {
            id: input.messageId,
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            status: input.fromMessageStatus
          }
        }),
        tx.crmSequenceEnrollment.findFirst({
          where: {
            id: input.enrollmentId,
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            status: input.fromEnrollmentStatus
          }
        })
      ]);

      if (!targetMessage || !targetEnrollment) {
        return null;
      }

      const messages = await tx.crmMessage.updateManyAndReturn({
        where: {
          id: input.messageId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: input.fromMessageStatus
        },
        data: { status: input.toMessageStatus },
        limit: 1
      });
      const message = messages[0];

      if (!message) {
        return null;
      }

      const enrollments = await tx.crmSequenceEnrollment.updateManyAndReturn({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: input.fromEnrollmentStatus
        },
        data: { status: input.toEnrollmentStatus },
        limit: 1
      });
      const enrollment = enrollments[0];

      if (!enrollment) {
        return null;
      }

      const account = await tx.crmAccount.update({
        where: { id: input.accountId },
        data: { status: input.accountStatus }
      });
      const event = await tx.crmTimelineEvent.create({
        data: {
          organizationId: input.organizationId,
          accountId: input.accountId,
          contactId: input.contactId,
          ownerUserId: input.ownerUserId,
          eventType: 'draft_approved',
          title: '首封开发信人工确认',
          content: message.subject,
          metadata: {
            enrollmentId: enrollment.id,
            messageId: message.id,
            fromStatus: input.fromEnrollmentStatus,
            toStatus: input.toEnrollmentStatus
          }
        }
      });

      return {
        enrollment: toSequenceEnrollmentRecord(enrollment),
        message: toMessageRecord(message),
        account: toAccountRecord(account),
        event: toTimelineEventRecord(event)
      };
    });
  }

  async startFirstMessageSend(input: CrmSendStartInput): Promise<CrmSendStartRecord | null> {
    return this.prisma.$transaction(async tx => {
      const targetEnrollment = await tx.crmSequenceEnrollment.findFirst({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: input.fromEnrollmentStatus
        }
      });

      if (!targetEnrollment?.mailboxId) {
        return null;
      }

      const [targetMessage, contact, mailbox] = await Promise.all([
        tx.crmMessage.findFirst({
          where: {
            enrollmentId: targetEnrollment.id,
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            stepIndex: 1,
            status: input.fromMessageStatus
          }
        }),
        tx.crmContact.findUnique({ where: { id: targetEnrollment.contactId } }),
        tx.crmMailbox.findUnique({ where: { id: targetEnrollment.mailboxId } })
      ]);

      if (!targetMessage || !contact || !mailbox || mailbox.status !== 'active') {
        return null;
      }

      const enrollments = await tx.crmSequenceEnrollment.updateManyAndReturn({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: input.fromEnrollmentStatus
        },
        data: { status: input.toEnrollmentStatus },
        limit: 1
      });
      const enrollment = enrollments[0];

      if (!enrollment) {
        return null;
      }

      const messages = await tx.crmMessage.updateManyAndReturn({
        where: {
          enrollmentId: enrollment.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          stepIndex: 1,
          status: input.fromMessageStatus
        },
        data: {
          status: input.toMessageStatus,
          scheduledAt: input.scheduledAt
        },
        limit: 1
      });
      const message = messages[0];

      if (!message) {
        return null;
      }

      const [account, event] = await Promise.all([
        tx.crmAccount.update({
          where: { id: enrollment.accountId },
          data: { status: input.accountStatus }
        }),
        tx.crmTimelineEvent.create({
          data: {
            organizationId: input.organizationId,
            accountId: enrollment.accountId,
            contactId: enrollment.contactId,
            ownerUserId: input.ownerUserId,
            eventType: 'message_send_scheduled',
            title: '首封开发信等待发送调度',
            content: message.subject,
            metadata: {
              enrollmentId: enrollment.id,
              messageId: message.id,
              runVersion: enrollment.runVersion
            }
          }
        })
      ]);

      return {
        enrollment: toSequenceEnrollmentRecord(enrollment),
        message: toMessageRecord(message),
        account: toAccountRecord(account),
        contact: toContactRecord(contact),
        mailbox: toMailboxRecord(mailbox),
        event: toTimelineEventRecord(event)
      };
    });
  }

  async claimFirstMessageSendDelivery(input: CrmSendDeliveryClaimInput): Promise<CrmSendDeliveryClaimRecord | null> {
    return this.prisma.$transaction(async tx => {
      const record = await tx.crmSequenceEnrollment.findFirst({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          runVersion: input.runVersion,
          status: 'sequence_running'
        },
        include: toSequenceReviewInclude()
      });

      if (!record) {
        return null;
      }

      const reviewItem = toSequenceReviewRecord(record);
      const targetMessage = reviewItem.messages.find(message => message.id === input.messageId) ?? null;

      if (
        !targetMessage ||
        targetMessage.status !== 'queued' ||
        !reviewItem.mailbox ||
        reviewItem.mailbox.status !== 'active'
      ) {
        return null;
      }

      const blacklistEntry = await tx.crmBlacklist.findUnique({
        where: {
          organizationId_emailHash: {
            organizationId: input.organizationId,
            emailHash: reviewItem.contact.emailHash
          }
        }
      });

      if (blacklistEntry) {
        await Promise.all([
          tx.crmSequenceEnrollment.updateMany({
            where: {
              id: input.enrollmentId,
              organizationId: input.organizationId,
              ownerUserId: input.ownerUserId,
              runVersion: input.runVersion,
              status: 'sequence_running'
            },
            data: {
              status: 'stopped',
              runVersion: { increment: 1 }
            }
          }),
          tx.crmMessage.updateMany({
            where: {
              id: input.messageId,
              organizationId: input.organizationId,
              ownerUserId: input.ownerUserId,
              status: 'queued'
            },
            data: {
              status: 'skipped',
              bullJobId: null
            }
          })
        ]);

        return null;
      }

      const reserved = await reserveMailboxSendQuota(tx, {
        organizationId: input.organizationId,
        mailboxId: reviewItem.mailbox.id,
        dailyLimit: reviewItem.mailbox.dailyLimit,
        hourlyLimit: reviewItem.mailbox.hourlyLimit,
        at: input.claimedAt
      });

      if (!reserved) {
        return null;
      }

      return {
        ...reviewItem,
        mailbox: reviewItem.mailbox,
        firstMessage: targetMessage
      };
    });
  }

  async stopSequenceEnrollment(input: CrmSequenceStopInput): Promise<CrmSequenceStopRecord | null> {
    return this.prisma.$transaction(async tx => {
      const enrollments = await tx.crmSequenceEnrollment.updateManyAndReturn({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
          status: { in: input.fromStatuses }
        },
        data: {
          status: 'stopped',
          runVersion: { increment: 1 }
        },
        limit: 1
      });
      const enrollment = enrollments[0];

      if (!enrollment) {
        return null;
      }

      const skippedMessages = await tx.crmMessage.updateManyAndReturn({
        where: {
          enrollmentId: enrollment.id,
          organizationId: input.organizationId,
          status: 'queued'
        },
        data: {
          status: 'skipped',
          bullJobId: null
        }
      });
      const [account, event] = await Promise.all([
        tx.crmAccount.update({
          where: { id: enrollment.accountId },
          data: { status: input.accountStatus }
        }),
        tx.crmTimelineEvent.create({
          data: {
            organizationId: input.organizationId,
            accountId: enrollment.accountId,
            contactId: enrollment.contactId,
            ownerUserId: input.actorUserId,
            eventType: 'sequence_stopped',
            title: '开发信序列已停止',
            content: enrollment.name,
            metadata: {
              enrollmentId: enrollment.id,
              fromStatuses: input.fromStatuses,
              toStatus: 'stopped',
              runVersion: enrollment.runVersion
            }
          }
        })
      ]);

      return {
        enrollment: toSequenceEnrollmentRecord(enrollment),
        message: skippedMessages[0] ? toMessageRecord(skippedMessages[0]) : null,
        account: toAccountRecord(account),
        event: toTimelineEventRecord(event)
      };
    });
  }

  async completeFirstMessageSend(input: CrmSendCompletionInput): Promise<CrmSendCompletionRecord | null> {
    return this.prisma.$transaction(async tx => {
      const targetMessage = await tx.crmMessage.findFirst({
        where: {
          id: input.messageId,
          enrollmentId: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: 'queued'
        }
      });

      if (!targetMessage) {
        return null;
      }

      const enrollments = await tx.crmSequenceEnrollment.updateManyAndReturn({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          runVersion: input.runVersion,
          status: 'sequence_running'
        },
        data: { currentStep: targetMessage.stepIndex },
        limit: 1
      });
      const enrollment = enrollments[0];

      if (!enrollment) {
        return null;
      }

      const messages = await tx.crmMessage.updateManyAndReturn({
        where: {
          id: input.messageId,
          enrollmentId: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: 'queued'
        },
        data: {
          status: 'sent',
          sentAt: input.sentAt,
          providerMessageId: input.providerMessageId ?? null,
          providerThreadId: input.providerThreadId ?? null
        },
        limit: 1
      });
      const message = messages[0];

      if (!message) {
        return null;
      }

      let nextMessage: CrmMessageModel | null = null;

      if (input.nextMessage) {
        nextMessage = await tx.crmMessage.findFirst({
          where: {
            enrollmentId: enrollment.id,
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            stepIndex: input.nextMessage.stepIndex
          }
        });

        if (!nextMessage) {
          nextMessage = await tx.crmMessage.create({
            data: {
              ...input.nextMessage,
              enrollmentId: enrollment.id
            } as Prisma.CrmMessageUncheckedCreateInput
          });
        }
      }

      const account = await tx.crmAccount.update({
        where: { id: enrollment.accountId },
        data: { status: 'sequence_running' }
      });
      const event = await tx.crmTimelineEvent.create({
        data: {
          organizationId: input.organizationId,
          accountId: enrollment.accountId,
          contactId: enrollment.contactId,
          ownerUserId: input.ownerUserId,
          eventType: 'message_sent',
          title: '首封开发信已发送',
          content: message.subject,
          metadata: {
            enrollmentId: enrollment.id,
            messageId: message.id,
            runVersion: enrollment.runVersion,
            nextMessageId: nextMessage?.id ?? null,
            nextStepIndex: nextMessage?.stepIndex ?? null
          }
        }
      });

      return {
        enrollment: toSequenceEnrollmentRecord(enrollment),
        message: toMessageRecord(message),
        nextMessage: nextMessage ? toMessageRecord(nextMessage) : null,
        account: toAccountRecord(account),
        event: toTimelineEventRecord(event)
      };
    });
  }

  async failFirstMessageSend(input: CrmSendFailureInput): Promise<CrmSendFailureRecord | null> {
    return this.prisma.$transaction(async tx => {
      const enrollments = await tx.crmSequenceEnrollment.updateManyAndReturn({
        where: {
          id: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          runVersion: input.runVersion,
          status: 'sequence_running'
        },
        data: { status: 'ready_to_send' },
        limit: 1
      });
      const enrollment = enrollments[0];

      if (!enrollment) {
        return null;
      }

      const messages = await tx.crmMessage.updateManyAndReturn({
        where: {
          id: input.messageId,
          enrollmentId: input.enrollmentId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: 'queued'
        },
        data: {
          status: 'draft_ready',
          bullJobId: null
        },
        limit: 1
      });
      const message = messages[0];

      if (!message) {
        return null;
      }

      const account = await tx.crmAccount.update({
        where: { id: enrollment.accountId },
        data: { status: 'ready' }
      });
      const event = await tx.crmTimelineEvent.create({
        data: {
          organizationId: input.organizationId,
          accountId: enrollment.accountId,
          contactId: enrollment.contactId,
          ownerUserId: input.ownerUserId,
          eventType: 'message_send_failed',
          title: '首封开发信发送失败',
          content: input.reason,
          metadata: {
            enrollmentId: enrollment.id,
            messageId: message.id,
            runVersion: enrollment.runVersion
          }
        }
      });

      return {
        enrollment: toSequenceEnrollmentRecord(enrollment),
        message: toMessageRecord(message),
        account: toAccountRecord(account),
        event: toTimelineEventRecord(event)
      };
    });
  }
  markMailboxAuthorizationExpired(
    ...args: Parameters<PrismaCrmMailboxStore['markMailboxAuthorizationExpired']>
  ): ReturnType<PrismaCrmMailboxStore['markMailboxAuthorizationExpired']> {
    return this.mailboxStore.markMailboxAuthorizationExpired(...args);
  }

  async ingestCustomerReply(input: CrmCustomerReplyIngestInput): Promise<CrmCustomerReplyIngestRecord | null> {
    try {
      return await this.prisma.$transaction(async tx => {
        const outboundMessage = await tx.crmMessage.findFirst({
          where: {
            id: input.outboundMessageId,
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            status: 'sent'
          },
          include: {
            account: true,
            contact: true,
            enrollment: true,
            mailbox: true
          }
        });

        if (!outboundMessage) {
          return null;
        }

        if (input.providerMessageId) {
          const existingMessage = await tx.crmInboxMessage.findFirst({
            where: {
              organizationId: input.organizationId,
              ownerUserId: input.ownerUserId,
              mailboxId: outboundMessage.mailboxId,
              providerMessageId: input.providerMessageId
            },
            include: { thread: true }
          });

          if (existingMessage) {
            return {
              thread: toInboxThreadRecord(existingMessage.thread),
              message: toInboxMessageRecord(existingMessage),
              account: toAccountRecord(outboundMessage.account),
              contact: toContactRecord(outboundMessage.contact),
              mailbox: outboundMessage.mailbox ? toMailboxRecord(outboundMessage.mailbox) : null,
              enrollment: outboundMessage.enrollment ? toSequenceEnrollmentRecord(outboundMessage.enrollment) : null,
              event: null,
              isDuplicate: true
            };
          }
        }

        const providerThreadId = input.providerThreadId ?? outboundMessage.enrollmentId;
        const threadIdentity = {
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          accountId: outboundMessage.accountId,
          contactId: outboundMessage.contactId,
          enrollmentId: outboundMessage.enrollmentId,
          mailboxId: outboundMessage.mailboxId
        };
        const existingThread = await tx.crmInboxThread.findFirst({
          where: input.providerThreadId
            ? {
                organizationId: input.organizationId,
                ownerUserId: input.ownerUserId,
                mailboxId: outboundMessage.mailboxId,
                providerThreadId: input.providerThreadId
              }
            : threadIdentity
        });
        const thread =
          existingThread ??
          (await tx.crmInboxThread.create({
            data: {
              ...threadIdentity,
              provider: 'gmail',
              providerThreadId,
              subject: input.subject,
              status: 'pending',
              lastInboundAt: input.receivedAt,
              unreadCount: 0,
              messageCount: 0
            } as Prisma.CrmInboxThreadUncheckedCreateInput
          }));
        const messageType = input.messageType ?? 'customer_reply';
        const inboxMessage = await tx.crmInboxMessage.create({
          data: {
            threadId: thread.id,
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            accountId: outboundMessage.accountId,
            contactId: outboundMessage.contactId,
            enrollmentId: outboundMessage.enrollmentId,
            mailboxId: outboundMessage.mailboxId,
            provider: 'gmail',
            providerMessageId: input.providerMessageId ?? null,
            replyToMessageId: outboundMessage.id,
            fromEmail: outboundMessage.contact.email,
            fromEmailHash: outboundMessage.contact.emailHash,
            maskedFromEmail: outboundMessage.contact.maskedEmail,
            subject: input.subject,
            snippet: toSnippet(input.bodyText),
            bodyText: input.bodyText,
            receivedAt: input.receivedAt,
            messageType
          } as Prisma.CrmInboxMessageUncheckedCreateInput
        });
        const updatedThread = await tx.crmInboxThread.update({
          where: { id: thread.id },
          data: {
            subject: input.subject,
            status: 'pending',
            lastInboundAt: input.receivedAt,
            unreadCount: { increment: 1 },
            messageCount: { increment: 1 }
          }
        });

        // 客户回信后，同公司当前开发序列统一停发，避免其他联系人继续跟进。
        await tx.crmSequenceEnrollment.updateMany({
          where: {
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            accountId: outboundMessage.accountId,
            status: {
              in: ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused']
            }
          },
          data: {
            status: 'replied',
            runVersion: { increment: 1 }
          }
        });
        await tx.crmMessage.updateMany({
          where: {
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            accountId: outboundMessage.accountId,
            status: 'queued'
          },
          data: {
            status: 'skipped',
            bullJobId: null
          }
        });
        const isUnsubscribeHint = messageType === 'unsubscribe_hint';
        const isBounce = messageType === 'bounce';
        if (isUnsubscribeHint) {
          await tx.crmBlacklist.upsert({
            where: {
              organizationId_emailHash: {
                organizationId: input.organizationId,
                emailHash: outboundMessage.contact.emailHash
              }
            },
            create: {
              organizationId: input.organizationId,
              emailHash: outboundMessage.contact.emailHash,
              maskedEmail: outboundMessage.contact.maskedEmail,
              reason: 'unsubscribe',
              sourceAccountId: outboundMessage.accountId,
              sourceContactId: outboundMessage.contactId,
              sourceMessageId: inboxMessage.id,
              createdById: input.ownerUserId,
              createdByName: outboundMessage.mailbox?.ownerUserName ?? null
            },
            update: {
              maskedEmail: outboundMessage.contact.maskedEmail,
              reason: 'unsubscribe',
              sourceAccountId: outboundMessage.accountId,
              sourceContactId: outboundMessage.contactId,
              sourceMessageId: inboxMessage.id,
              createdById: input.ownerUserId,
              createdByName: outboundMessage.mailbox?.ownerUserName ?? null
            }
          });
        }
        const [account, contact] = await Promise.all([
          tx.crmAccount.update({
            where: { id: outboundMessage.accountId },
            data: {
              status: isUnsubscribeHint ? 'blocked' : isBounce ? 'manual_review_pending' : 'replied_pending'
            }
          }),
          isUnsubscribeHint || isBounce
            ? tx.crmContact.update({
                where: { id: outboundMessage.contactId },
                data: {
                  emailStatus: isUnsubscribeHint ? 'unsubscribed' : 'unreachable'
                }
              })
            : Promise.resolve(outboundMessage.contact)
        ]);
        const event = await tx.crmTimelineEvent.create({
          data: {
            organizationId: input.organizationId,
            accountId: outboundMessage.accountId,
            contactId: outboundMessage.contactId,
            ownerUserId: input.ownerUserId,
            eventType: isUnsubscribeHint ? 'customer_unsubscribed' : isBounce ? 'email_bounced' : 'customer_replied',
            title: isUnsubscribeHint ? '客户要求停止联系' : isBounce ? '邮件退信' : '客户回信',
            content: input.subject,
            metadata: {
              enrollmentId: outboundMessage.enrollmentId,
              outboundMessageId: outboundMessage.id,
              inboxThreadId: updatedThread.id,
              inboxMessageId: inboxMessage.id,
              messageType
            }
          }
        });

        return {
          thread: toInboxThreadRecord(updatedThread),
          message: toInboxMessageRecord(inboxMessage),
          account: toAccountRecord(account),
          contact: toContactRecord(contact),
          mailbox: outboundMessage.mailbox ? toMailboxRecord(outboundMessage.mailbox) : null,
          enrollment: outboundMessage.enrollment ? toSequenceEnrollmentRecord(outboundMessage.enrollment) : null,
          event: toTimelineEventRecord(event),
          isDuplicate: false
        };
      });
    } catch (error) {
      if (input.providerMessageId && isPrismaUniqueConflict(error)) {
        const existingMessage = await this.findIngestedCustomerReplyByProviderMessage(input);

        if (existingMessage) return existingMessage;
      }

      throw error;
    }
  }

  /** Reads an already ingested provider message after duplicate delivery or a unique conflict. */
  private async findIngestedCustomerReplyByProviderMessage(
    input: CrmCustomerReplyIngestInput
  ): Promise<CrmCustomerReplyIngestRecord | null> {
    const outboundMessage = await this.prisma.crmMessage.findFirst({
      where: {
        id: input.outboundMessageId,
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        status: 'sent'
      },
      select: { mailboxId: true }
    });

    if (!outboundMessage) return null;

    const inboxMessage = await this.prisma.crmInboxMessage.findFirst({
      where: {
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        mailboxId: outboundMessage.mailboxId,
        providerMessageId: input.providerMessageId
      },
      include: {
        thread: true,
        account: true,
        contact: true,
        mailbox: true,
        enrollment: true
      }
    });

    if (!inboxMessage) return null;

    return {
      thread: toInboxThreadRecord(inboxMessage.thread),
      message: toInboxMessageRecord(inboxMessage),
      account: toAccountRecord(inboxMessage.account),
      contact: toContactRecord(inboxMessage.contact),
      mailbox: inboxMessage.mailbox ? toMailboxRecord(inboxMessage.mailbox) : null,
      enrollment: inboxMessage.enrollment ? toSequenceEnrollmentRecord(inboxMessage.enrollment) : null,
      event: null,
      isDuplicate: true
    };
  }

  async listInboxThreads(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmInboxThreadStatus;
    mailboxId?: string;
    skip: number;
    take: number;
  }): Promise<{ records: CrmInboxThreadListRecord[]; total: number }> {
    const where = toInboxThreadListWhere(args);
    const [records, total] = await Promise.all([
      this.prisma.crmInboxThread.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: { lastInboundAt: 'desc' },
        include: toInboxThreadListInclude()
      }),
      this.prisma.crmInboxThread.count({ where })
    ]);

    return {
      records: records.map(toInboxThreadListRecord),
      total
    };
  }

  async getInboxThread(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmInboxThreadDetailRecord | null> {
    const record = await this.prisma.crmInboxThread.findFirst({
      where: toInboxThreadIdentityWhere(args),
      include: toInboxThreadDetailInclude()
    });

    if (!record) {
      return null;
    }

    const timelineEvents = await this.prisma.crmTimelineEvent.findMany({
      where: {
        organizationId: args.organizationId,
        accountId: record.accountId
      },
      orderBy: { createdAt: 'desc' }
    });

    return toInboxThreadDetailRecord(record, timelineEvents);
  }

  async saveInboxThreadReplyDraft(input: CrmInboxReplyDraftSaveInput): Promise<CrmInboxThreadDetailRecord | null> {
    return this.prisma.$transaction(async tx => {
      const threads = await tx.crmInboxThread.updateManyAndReturn({
        where: {
          id: input.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId
        },
        data: {
          replyDraftTopic: input.topic,
          replyDraftBodyText: input.bodyText,
          replyDraftMetadata: toNullableJsonInput(input.metadata ?? null),
          replyDraftUpdatedAt: input.updatedAt,
          replyDraftUpdatedById: input.updatedById,
          replyDraftUpdatedByName: input.updatedByName ?? null
        },
        limit: 1
      });
      const thread = threads[0];

      if (!thread) {
        return null;
      }

      const record = await tx.crmInboxThread.findFirst({
        where: {
          id: thread.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId
        },
        include: toInboxThreadDetailInclude()
      });

      if (!record) {
        return null;
      }

      const timelineEvents = await tx.crmTimelineEvent.findMany({
        where: {
          organizationId: input.organizationId,
          accountId: record.accountId
        },
        orderBy: { createdAt: 'desc' }
      });

      return toInboxThreadDetailRecord(record, timelineEvents);
    });
  }

  async updateInboxThreadStatus(
    input: CrmInboxThreadStatusUpdateInput
  ): Promise<CrmInboxThreadStatusUpdateRecord | null> {
    return this.prisma.$transaction(async tx => {
      const data: Prisma.CrmInboxThreadUpdateManyMutationInput = {
        status: input.toStatus,
        ...(input.toStatus === 'pending' ? {} : { unreadCount: 0 })
      };
      const threads = await tx.crmInboxThread.updateManyAndReturn({
        where: {
          id: input.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          ...(input.fromStatus ? { status: input.fromStatus } : {})
        },
        data,
        limit: 1
      });
      const thread = threads[0];

      if (!thread) {
        return null;
      }

      const account = input.accountStatus
        ? await tx.crmAccount.update({
            where: { id: thread.accountId },
            data: { status: input.accountStatus }
          })
        : await tx.crmAccount.findUnique({ where: { id: thread.accountId } });

      if (!account) {
        return null;
      }

      const event = await tx.crmTimelineEvent.create({
        data: {
          organizationId: input.organizationId,
          accountId: thread.accountId,
          contactId: thread.contactId,
          ownerUserId: input.ownerUserId,
          eventType: 'inbox_status_changed',
          title: '收件箱处理状态变更',
          content: thread.subject,
          metadata: {
            threadId: thread.id,
            fromStatus: input.fromStatus ?? null,
            toStatus: input.toStatus
          }
        }
      });

      return {
        thread: toInboxThreadRecord(thread),
        account: toAccountRecord(account),
        event: toTimelineEventRecord(event)
      };
    });
  }

  async syncInboxThreadGmailState(
    input: CrmInboxThreadGmailStateSyncInput
  ): Promise<CrmInboxThreadStatusUpdateRecord | null> {
    return this.prisma.$transaction(async tx => {
      const thread = await tx.crmInboxThread.findFirst({
        where: {
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          mailboxId: input.mailboxId,
          providerThreadId: input.providerThreadId
        }
      });

      if (!thread) {
        return null;
      }

      const threadRecord = toInboxThreadRecord(thread);
      const update = resolveGmailThreadStateUpdate(threadRecord, input);
      if (!update) {
        return null;
      }

      const account = await tx.crmAccount.findUnique({
        where: { id: thread.accountId }
      });
      if (!account) {
        return null;
      }

      const [updatedThread, event] = await Promise.all([
        tx.crmInboxThread.update({
          where: { id: thread.id },
          data: update.data
        }),
        tx.crmTimelineEvent.create({
          data: {
            organizationId: input.organizationId,
            accountId: thread.accountId,
            contactId: thread.contactId,
            ownerUserId: input.ownerUserId,
            eventType: update.eventType,
            title: update.title,
            content: thread.subject,
            metadata: {
              providerMessageId: input.providerMessageId,
              providerThreadId: input.providerThreadId,
              changeType: input.changeType,
              labelIds: input.labelIds,
              fromStatus: thread.status,
              toStatus: update.nextStatus
            }
          }
        })
      ]);

      return {
        thread: toInboxThreadRecord(updatedThread),
        account: toAccountRecord(account),
        event: toTimelineEventRecord(event)
      };
    });
  }

  async confirmInboxMessageUnsubscribe(
    input: CrmInboxUnsubscribeConfirmInput
  ): Promise<CrmInboxUnsubscribeConfirmRecord | null> {
    return this.prisma.$transaction(async tx => {
      const inboxMessage = await tx.crmInboxMessage.findFirst({
        where: {
          id: input.messageId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          messageType: {
            in: ['unsubscribe_hint', 'unsubscribe_review_pending']
          }
        },
        include: {
          thread: true,
          account: true,
          contact: true,
          mailbox: true,
          enrollment: true
        }
      });

      if (!inboxMessage) {
        return null;
      }

      const message =
        inboxMessage.messageType === 'unsubscribe_hint'
          ? inboxMessage
          : await tx.crmInboxMessage.update({
              where: { id: inboxMessage.id },
              data: { messageType: 'unsubscribe_hint' },
              include: {
                thread: true,
                account: true,
                contact: true,
                mailbox: true,
                enrollment: true
              }
            });

      await tx.crmBlacklist.upsert({
        where: {
          organizationId_emailHash: {
            organizationId: input.organizationId,
            emailHash: inboxMessage.contact.emailHash
          }
        },
        create: {
          organizationId: input.organizationId,
          emailHash: inboxMessage.contact.emailHash,
          maskedEmail: inboxMessage.contact.maskedEmail,
          reason: 'unsubscribe',
          sourceAccountId: inboxMessage.accountId,
          sourceContactId: inboxMessage.contactId,
          sourceMessageId: inboxMessage.id,
          createdById: input.confirmedById,
          createdByName: input.confirmedByName ?? null
        },
        update: {
          maskedEmail: inboxMessage.contact.maskedEmail,
          reason: 'unsubscribe',
          sourceAccountId: inboxMessage.accountId,
          sourceContactId: inboxMessage.contactId,
          sourceMessageId: inboxMessage.id,
          createdById: input.confirmedById,
          createdByName: input.confirmedByName ?? null
        }
      });

      await Promise.all([
        tx.crmSequenceEnrollment.updateMany({
          where: {
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            accountId: inboxMessage.accountId,
            status: {
              in: ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused']
            }
          },
          data: {
            status: 'replied',
            runVersion: { increment: 1 }
          }
        }),
        tx.crmMessage.updateMany({
          where: {
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            accountId: inboxMessage.accountId,
            status: 'queued'
          },
          data: {
            status: 'skipped',
            bullJobId: null
          }
        })
      ]);

      const [account, contact, enrollment, event] = await Promise.all([
        tx.crmAccount.update({
          where: { id: inboxMessage.accountId },
          data: { status: 'blocked' }
        }),
        tx.crmContact.update({
          where: { id: inboxMessage.contactId },
          data: { emailStatus: 'unsubscribed' }
        }),
        inboxMessage.enrollmentId
          ? tx.crmSequenceEnrollment.findUnique({
              where: { id: inboxMessage.enrollmentId }
            })
          : null,
        tx.crmTimelineEvent.create({
          data: {
            organizationId: input.organizationId,
            accountId: inboxMessage.accountId,
            contactId: inboxMessage.contactId,
            ownerUserId: input.ownerUserId,
            eventType: 'customer_unsubscribed',
            title: '确认客户退订',
            content: inboxMessage.subject,
            metadata: {
              inboxThreadId: inboxMessage.threadId,
              inboxMessageId: inboxMessage.id,
              confirmedAt: input.confirmedAt.toISOString(),
              confirmedById: input.confirmedById
            }
          }
        })
      ]);

      return {
        thread: toInboxThreadRecord(message.thread),
        message: toInboxMessageRecord(message),
        account: toAccountRecord(account),
        contact: toContactRecord(contact),
        mailbox: message.mailbox ? toMailboxRecord(message.mailbox) : null,
        enrollment: enrollment ? toSequenceEnrollmentRecord(enrollment) : null,
        event: toTimelineEventRecord(event)
      };
    });
  }

  async replyInboxThread(input: CrmInboxThreadReplyInput): Promise<CrmInboxThreadReplyRecord | null> {
    return this.prisma.$transaction(async tx => {
      const record = await tx.crmInboxThread.findFirst({
        where: {
          id: input.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId
        },
        include: {
          account: true,
          contact: true,
          mailbox: true,
          enrollment: true,
          messages: {
            orderBy: { receivedAt: 'desc' },
            take: 1
          }
        }
      });

      if (!record?.mailbox || record.mailbox.status !== 'active') {
        return null;
      }

      const inboxMessage = await tx.crmInboxMessage.create({
        data: {
          threadId: record.id,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          accountId: record.accountId,
          contactId: record.contactId,
          enrollmentId: record.enrollmentId,
          mailboxId: record.mailboxId,
          provider: record.provider,
          providerMessageId: input.providerMessageId ?? null,
          replyToMessageId: record.messages[0]?.id ?? null,
          fromEmail: record.mailbox.emailAddress,
          fromEmailHash: record.mailbox.emailHash,
          maskedFromEmail: record.mailbox.maskedEmail,
          subject: input.subject,
          snippet: toSnippet(input.bodyText),
          bodyText: input.bodyText,
          receivedAt: input.sentAt,
          messageType: 'customer_reply'
        } as Prisma.CrmInboxMessageUncheckedCreateInput
      });
      const [thread, account, event] = await Promise.all([
        tx.crmInboxThread.update({
          where: { id: record.id },
          data: {
            status: 'handled',
            unreadCount: 0,
            messageCount: { increment: 1 }
          }
        }),
        tx.crmAccount.update({
          where: { id: record.accountId },
          data: { status: 'followed_up' }
        }),
        tx.crmTimelineEvent.create({
          data: {
            organizationId: input.organizationId,
            accountId: record.accountId,
            contactId: record.contactId,
            ownerUserId: input.ownerUserId,
            eventType: 'inbox_replied',
            title: '已在系统内回复',
            content: input.subject,
            metadata: {
              threadId: record.id,
              inboxMessageId: inboxMessage.id,
              providerMessageId: input.providerMessageId ?? null
            }
          }
        })
      ]);

      return {
        thread: toInboxThreadRecord(thread),
        message: toInboxMessageRecord(inboxMessage),
        account: toAccountRecord(account),
        contact: toContactRecord(record.contact),
        mailbox: toMailboxRecord(record.mailbox),
        enrollment: record.enrollment ? toSequenceEnrollmentRecord(record.enrollment) : null,
        event: toTimelineEventRecord(event)
      };
    });
  }
}
