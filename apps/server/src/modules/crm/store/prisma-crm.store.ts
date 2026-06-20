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
  CrmMessageUpdateInput,
  CrmOrganizationConfigInput,
  CrmOrganizationConfigRecord,
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
  CrmTimelineEventRecord
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

type CrmEmailTemplateGroupModelWithSteps = CrmEmailTemplateGroupModel & {
  steps: CrmEmailTemplateStepModel[];
};

const emailTemplateGroupInclude = {
  steps: {
    orderBy: { stepIndex: 'asc' as const }
  }
};
const crmAiDraftQueueConfigKey = 'crm-ai-draft';

@Injectable()
export class PrismaCrmStore implements CrmStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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

  async getGlobalConfig() {
    const record = await this.prisma.crmGlobalConfig.findUnique({
      where: { configKey: crmGlobalConfigKey }
    });

    return record ? toGlobalConfigRecord(record) : createDefaultGlobalConfig();
  }

  async saveGlobalConfig(input: CrmGlobalConfigInput) {
    const emailVerificationCooldownDays = normalizeEmailVerificationCooldownDays(input.emailVerificationCooldownDays);
    const ownerConcurrentSendLimit = normalizeOwnerConcurrentSendLimit(input.ownerConcurrentSendLimit);
    const ownerDailySendLimitMax = normalizeOwnerDailySendLimitMax(input.ownerDailySendLimitMax);
    const followUpDelayDaysText = serializeFollowUpDelayDays(input.followUpDelayDays);
    const record = await this.prisma.crmGlobalConfig.upsert({
      where: { configKey: crmGlobalConfigKey },
      create: {
        configKey: crmGlobalConfigKey,
        emailVerificationCooldownDays,
        ownerConcurrentSendLimit,
        ownerDailySendLimitMax,
        followUpDelayDaysText,
        updatedById: input.updatedById,
        updatedByName: input.updatedByName
      },
      update: {
        emailVerificationCooldownDays,
        ownerConcurrentSendLimit,
        ownerDailySendLimitMax,
        followUpDelayDaysText,
        updatedById: input.updatedById,
        updatedByName: input.updatedByName
      }
    });

    return toGlobalConfigRecord(record);
  }

  async createAiDraftTask(input: CrmAiDraftTaskCreateInput) {
    try {
      return await this.prisma.$transaction(
        async tx => this.createAiDraftTaskInsideTransaction(tx, input),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );
    } catch (error) {
      // Serializable conflicts mean another creator won the same capacity window.
      if (isPrismaConcurrentTaskCreateConflict(error)) {
        return { task: null, limitReason: 'concurrent_create_conflict' as const };
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

  async getAiDraftQueueConfig() {
    const record = await this.prisma.crmAiDraftQueueConfig.findUnique({
      where: { configKey: crmAiDraftQueueConfigKey }
    });

    return record ? toAiDraftQueueConfigRecord(record) : createDefaultAiDraftQueueConfig();
  }

  async saveAiDraftQueueConfig(input: CrmAiDraftQueueConfigInput) {
    const maxItemConcurrency = normalizeCrmAiDraftItemConcurrency(
      input.maxItemConcurrency ?? maxCrmAiDraftItemConcurrency,
      maxCrmAiDraftItemConcurrency
    );
    const itemConcurrency = normalizeCrmAiDraftItemConcurrency(
      input.itemConcurrency ?? defaultCrmAiDraftItemConcurrency,
      maxItemConcurrency
    );
    const maxAttempts = normalizeCrmAiDraftMaxAttempts(input.maxAttempts ?? defaultCrmAiDraftMaxAttempts);
    const record = await this.prisma.crmAiDraftQueueConfig.upsert({
      where: { configKey: crmAiDraftQueueConfigKey },
      create: {
        configKey: crmAiDraftQueueConfigKey,
        itemConcurrency,
        maxItemConcurrency,
        maxActiveTasksPerUser: normalizePositiveConfigInteger(input.maxActiveTasksPerUser, 1),
        maxActiveTasksPerOrg: normalizePositiveConfigInteger(input.maxActiveTasksPerOrg, 2),
        maxAttempts,
        retryBackoffSeconds: toNullableJsonInput(
          input.retryBackoffSeconds ?? [...defaultCrmAiDraftRetryBackoffSeconds]
        ),
        updatedById: input.updatedById ?? null,
        updatedByName: input.updatedByName ?? null
      },
      update: {
        itemConcurrency,
        maxItemConcurrency,
        maxActiveTasksPerUser: normalizePositiveConfigInteger(input.maxActiveTasksPerUser, 1),
        maxActiveTasksPerOrg: normalizePositiveConfigInteger(input.maxActiveTasksPerOrg, 2),
        maxAttempts,
        retryBackoffSeconds: toNullableJsonInput(
          input.retryBackoffSeconds ?? [...defaultCrmAiDraftRetryBackoffSeconds]
        ),
        updatedById: input.updatedById ?? null,
        updatedByName: input.updatedByName ?? null
      }
    });

    return toAiDraftQueueConfigRecord(record);
  }

  async getSendPreference(args: { organizationId: string; ownerUserId: string }) {
    const record = await this.prisma.crmUserSendPreference.findUnique({
      where: {
        organizationId_ownerUserId: {
          organizationId: args.organizationId,
          ownerUserId: args.ownerUserId
        }
      }
    });

    return record ? toSendPreferenceRecord(record) : null;
  }

  async saveSendPreference(input: CrmSendPreferenceInput) {
    const record = await this.prisma.crmUserSendPreference.upsert({
      where: {
        organizationId_ownerUserId: {
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId
        }
      },
      create: {
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        ownerUserName: input.ownerUserName,
        dailySendLimit: input.dailySendLimit,
        followUpSharePercent: input.followUpSharePercent,
        updatedById: input.updatedById,
        updatedByName: input.updatedByName
      },
      update: {
        ownerUserName: input.ownerUserName,
        dailySendLimit: input.dailySendLimit,
        followUpSharePercent: input.followUpSharePercent,
        updatedById: input.updatedById,
        updatedByName: input.updatedByName
      }
    });

    return toSendPreferenceRecord(record);
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

  async listDueSendCandidates(input: CrmDueSendCandidateListInput): Promise<CrmDueSendCandidateRecord[]> {
    const records = await this.prisma.crmMessage.findMany({
      where: {
        status: 'draft_ready',
        scheduledAt: {
          lte: input.now
        },
        mailboxId: {
          not: null
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
    const candidates: CrmDueSendCandidateRecord[] = [];

    for (const record of records) {
      if (!record.mailbox || record.mailbox.status !== 'active') {
        continue;
      }

      if (record.enrollment.status !== 'sequence_running' || record.contact.emailStatus === 'unsubscribed') {
        continue;
      }

      const blacklist = await this.prisma.crmBlacklist.findUnique({
        where: {
          organizationId_emailHash: {
            organizationId: record.organizationId,
            emailHash: record.contact.emailHash
          }
        }
      });

      if (blacklist) {
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

  async getOrganizationConfig(organizationId: string) {
    const record = await this.prisma.crmOrganizationConfig.findUnique({
      where: { organizationId }
    });

    return record ? toOrganizationConfigRecord(record) : null;
  }

  async saveOrganizationConfig(input: CrmOrganizationConfigInput) {
    const record = await this.prisma.crmOrganizationConfig.upsert({
      where: { organizationId: input.organizationId },
      create: {
        organizationId: input.organizationId,
        allowAdminViewMemberEmailBody: input.allowAdminViewMemberEmailBody,
        updatedById: input.updatedById ?? null,
        updatedByName: input.updatedByName ?? null
      },
      update: {
        allowAdminViewMemberEmailBody: input.allowAdminViewMemberEmailBody,
        updatedById: input.updatedById ?? null,
        updatedByName: input.updatedByName ?? null
      }
    });

    return toOrganizationConfigRecord(record);
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

  findMailboxByProviderAndEmailHash(provider: CrmMailboxProvider, emailHash: string) {
    return this.prisma.crmMailbox
      .findUnique({
        where: {
          provider_emailHash: {
            provider,
            emailHash
          }
        }
      })
      .then(record => (record ? toMailboxRecord(record) : null));
  }

  async createMailbox(input: CrmMailboxCreateInput) {
    try {
      const record = await this.prisma.crmMailbox.create({
        data: input as Prisma.CrmMailboxUncheckedCreateInput
      });

      return toMailboxRecord(record);
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        const existingMailbox = await this.findMailboxByProviderAndEmailHash(input.provider, input.emailHash);

        if (existingMailbox) return existingMailbox;
      }

      throw error;
    }
  }

  async listMailboxes(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmMailboxStatus;
    skip: number;
    take: number;
  }) {
    const where = toMailboxListWhere(args);
    const [records, total] = await Promise.all([
      this.prisma.crmMailbox.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: { updatedAt: 'desc' }
      }),
      this.prisma.crmMailbox.count({ where })
    ]);

    return {
      records: records.map(toMailboxRecord),
      total
    };
  }

  findMailboxById(args: { id: string; organizationId: string; ownerUserId?: string }) {
    return this.prisma.crmMailbox
      .findFirst({
        where: toMailboxIdentityWhere(args)
      })
      .then(record => (record ? toMailboxRecord(record) : null));
  }

  async updateMailbox(id: string, input: CrmMailboxUpdateInput) {
    const records = await this.prisma.crmMailbox.updateManyAndReturn({
      where: { id },
      data: input,
      limit: 1
    });

    return records[0] ? toMailboxRecord(records[0]) : null;
  }

  async listMailboxesForWatchRenewal(input: CrmMailboxWatchRenewalListInput) {
    const records = await this.prisma.crmMailbox.findMany({
      where: {
        provider: input.provider,
        status: 'active',
        OR: [{ watchExpiration: null }, { watchExpiration: { lte: input.renewBefore } }]
      },
      orderBy: [{ watchExpiration: 'asc' }, { updatedAt: 'asc' }],
      take: input.take
    });

    return records.map(toMailboxRecord);
  }

  async advanceMailboxHistoryId(input: CrmMailboxHistoryAdvanceInput) {
    const records = await this.prisma.crmMailbox.updateManyAndReturn({
      where: {
        id: input.mailboxId,
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        lastHistoryId: input.fromHistoryId
      },
      data: {
        lastHistoryId: input.toHistoryId,
        syncIssueType: null,
        syncIssueAt: null,
        syncIssueMessage: null
      },
      limit: 1
    });

    return records[0] ? toMailboxRecord(records[0]) : null;
  }

  async listProductLines(args: {
    organizationId: string;
    keyword?: string;
    status?: CrmProductLineStatus;
    skip: number;
    take: number;
  }) {
    const where = toProductLineListWhere(args);
    const [records, total] = await Promise.all([
      this.prisma.crmProductLine.findMany({
        where,
        skip: args.skip,
        take: args.take,
        orderBy: { updatedAt: 'desc' }
      }),
      this.prisma.crmProductLine.count({ where })
    ]);

    return {
      records: records.map(toProductLineRecord),
      total
    };
  }

  findProductLineByName(organizationId: string, name: string) {
    return this.prisma.crmProductLine
      .findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name
          }
        }
      })
      .then(record => (record ? toProductLineRecord(record) : null));
  }

  findProductLineById(args: { id: string; organizationId: string }) {
    return this.prisma.crmProductLine
      .findFirst({
        where: toProductLineIdentityWhere(args)
      })
      .then(record => (record ? toProductLineRecord(record) : null));
  }

  async createProductLine(input: CrmProductLineCreateInput) {
    const record = await this.prisma.crmProductLine.create({
      data: input as Prisma.CrmProductLineUncheckedCreateInput
    });

    return toProductLineRecord(record);
  }

  async updateProductLine(id: string, organizationId: string, input: CrmProductLineUpdateInput) {
    const data = (
      input.aiWritingConfig === null ? { ...input, aiWritingConfig: Prisma.JsonNull } : input
    ) as Prisma.CrmProductLineUpdateManyMutationInput;
    const records = await this.prisma.crmProductLine.updateManyAndReturn({
      where: {
        id,
        organizationId
      },
      data,
      limit: 1
    });

    return records[0] ? toProductLineRecord(records[0]) : null;
  }

  async createProductLineAiPromptVersion(input: CrmProductLineAiPromptVersionCreateInput) {
    return this.prisma.$transaction(async tx => {
      const latestVersion = await tx.crmProductLineAiPromptVersion.findFirst({
        where: {
          organizationId: input.organizationId,
          productLineId: input.productLineId
        },
        orderBy: { version: 'desc' }
      });
      const record = await tx.crmProductLineAiPromptVersion.create({
        data: {
          organizationId: input.organizationId,
          productLineId: input.productLineId,
          version: (latestVersion?.version ?? 0) + 1,
          aiWritingConfig: toProductLineAiPromptVersionJson(input.aiWritingConfig),
          editorId: input.editorId,
          editorName: input.editorName ?? null,
          changeSummary: input.changeSummary ?? null
        }
      });

      return toProductLineAiPromptVersionRecord(record);
    });
  }

  async listProductLineAiPromptVersions(args: { organizationId: string; productLineId: string }) {
    const records = await this.prisma.crmProductLineAiPromptVersion.findMany({
      where: {
        organizationId: args.organizationId,
        productLineId: args.productLineId
      },
      orderBy: { version: 'desc' }
    });

    return records.map(toProductLineAiPromptVersionRecord);
  }

  async restoreProductLineAiPromptVersion(input: CrmProductLineAiPromptVersionRestoreInput) {
    return this.prisma.$transaction(async tx => {
      const restoredVersion = await tx.crmProductLineAiPromptVersion.findFirst({
        where: {
          id: input.versionId,
          organizationId: input.organizationId,
          productLineId: input.productLineId
        }
      });

      if (!restoredVersion) {
        return null;
      }

      const productLines = await tx.crmProductLine.updateManyAndReturn({
        where: {
          id: input.productLineId,
          organizationId: input.organizationId
        },
        data: {
          aiWritingConfig: toProductLineAiPromptVersionJson(toProductLineAiWritingConfig(restoredVersion.aiWritingConfig))
        },
        limit: 1
      });
      const productLine = productLines[0];

      if (!productLine) {
        return null;
      }

      const latestVersion = await tx.crmProductLineAiPromptVersion.findFirst({
        where: {
          organizationId: input.organizationId,
          productLineId: input.productLineId
        },
        orderBy: { version: 'desc' }
      });
      const currentVersion = await tx.crmProductLineAiPromptVersion.create({
        data: {
          organizationId: input.organizationId,
          productLineId: input.productLineId,
          version: (latestVersion?.version ?? restoredVersion.version) + 1,
          aiWritingConfig: toProductLineAiPromptVersionJson(toProductLineAiWritingConfig(restoredVersion.aiWritingConfig)),
          editorId: input.editorId,
          editorName: input.editorName ?? null,
          changeSummary: input.changeSummary ?? `恢复版本 ${restoredVersion.version}`
        }
      });

      return {
        productLine: toProductLineRecord(productLine),
        restoredVersion: toProductLineAiPromptVersionRecord(restoredVersion),
        currentVersion: toProductLineAiPromptVersionRecord(currentVersion)
      };
    });
  }

  async listPersonaProfiles(input: CrmPersonaProfileListInput) {
    const where = toPersonaProfileListWhere(input);
    const [records, total] = await Promise.all([
      this.prisma.crmPersonaProfile.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
      }),
      this.prisma.crmPersonaProfile.count({ where })
    ]);

    return {
      records: records.map(toPersonaProfileRecord),
      total
    };
  }

  listActivePersonaProfiles(organizationId: string) {
    return this.prisma.crmPersonaProfile
      .findMany({
        where: {
          organizationId,
          status: 'active'
        },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
      })
      .then(records => records.map(toPersonaProfileRecord));
  }

  findPersonaProfileByName(organizationId: string, name: string) {
    return this.prisma.crmPersonaProfile
      .findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name
          }
        }
      })
      .then(record => (record ? toPersonaProfileRecord(record) : null));
  }

  findPersonaProfileById(args: { id: string; organizationId: string }) {
    return this.prisma.crmPersonaProfile
      .findFirst({
        where: {
          id: args.id,
          organizationId: args.organizationId
        }
      })
      .then(record => (record ? toPersonaProfileRecord(record) : null));
  }

  async createPersonaProfile(input: CrmPersonaProfileCreateInput) {
    return this.prisma.$transaction(async tx => {
      if (input.isDefault) {
        await tx.crmPersonaProfile.updateMany({
          where: {
            organizationId: input.organizationId,
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      const record = await tx.crmPersonaProfile.create({
        data: toPersonaProfileCreateInput(input)
      });

      return toPersonaProfileRecord(record);
    });
  }

  async updatePersonaProfile(id: string, organizationId: string, input: CrmPersonaProfileUpdateInput) {
    return this.prisma.$transaction(async tx => {
      if (input.isDefault) {
        await tx.crmPersonaProfile.updateMany({
          where: {
            organizationId,
            id: { not: id },
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      const records = await tx.crmPersonaProfile.updateManyAndReturn({
        where: {
          id,
          organizationId
        },
        data: toPersonaProfileUpdateInput(input),
        limit: 1
      });

      return records[0] ? toPersonaProfileRecord(records[0]) : null;
    });
  }

  async setDefaultPersonaProfile(id: string, organizationId: string) {
    return this.prisma.$transaction(async tx => {
      const records = await tx.crmPersonaProfile.updateManyAndReturn({
        where: {
          id,
          organizationId,
          status: 'active'
        },
        data: { isDefault: true },
        limit: 1
      });

      if (!records[0]) {
        return null;
      }

      await tx.crmPersonaProfile.updateMany({
        where: {
          organizationId,
          id: { not: id },
          isDefault: true
        },
        data: { isDefault: false }
      });

      return toPersonaProfileRecord(records[0]);
    });
  }

  async listEmailTemplateGroups(input: CrmEmailTemplateGroupListInput) {
    const where = toEmailTemplateGroupListWhere(input);
    const [records, total] = await Promise.all([
      this.prisma.crmEmailTemplateGroup.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: { updatedAt: 'desc' },
        include: emailTemplateGroupInclude
      }),
      this.prisma.crmEmailTemplateGroup.count({ where })
    ]);

    return {
      records: records.map(toEmailTemplateGroupRecord),
      total
    };
  }

  findEmailTemplateGroupByName(organizationId: string, name: string) {
    return this.prisma.crmEmailTemplateGroup
      .findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name
          }
        },
        include: emailTemplateGroupInclude
      })
      .then(record => (record ? toEmailTemplateGroupRecord(record) : null));
  }

  findEmailTemplateGroupById(args: { id: string; organizationId: string }) {
    return this.prisma.crmEmailTemplateGroup
      .findFirst({
        where: {
          id: args.id,
          organizationId: args.organizationId
        },
        include: emailTemplateGroupInclude
      })
      .then(record => (record ? toEmailTemplateGroupRecord(record) : null));
  }

  findDefaultEmailTemplateGroup(organizationId: string) {
    return this.prisma.crmEmailTemplateGroup
      .findFirst({
        where: {
          organizationId,
          status: 'active',
          isDefault: true
        },
        include: emailTemplateGroupInclude,
        orderBy: { updatedAt: 'desc' }
      })
      .then(record => (record ? toEmailTemplateGroupRecord(record) : null));
  }

  async createEmailTemplateGroup(input: CrmEmailTemplateGroupCreateInput) {
    return this.prisma.$transaction(async tx => {
      const group = await tx.crmEmailTemplateGroup.create({
        data: {
          organizationId: input.organizationId,
          name: input.name,
          language: input.language,
          description: input.description ?? null,
          status: input.status,
          isDefault: input.isDefault,
          createdById: input.createdById,
          createdByName: input.createdByName ?? null
        }
      });

      await tx.crmEmailTemplateStep.createMany({
        data: toEmailTemplateStepCreateManyInput(input.organizationId, group.id, input.steps)
      });

      const record = await tx.crmEmailTemplateGroup.findUnique({
        where: { id: group.id },
        include: emailTemplateGroupInclude
      });

      return toEmailTemplateGroupRecord(record as CrmEmailTemplateGroupModelWithSteps);
    });
  }

  async updateEmailTemplateGroup(id: string, organizationId: string, input: CrmEmailTemplateGroupUpdateInput) {
    return this.prisma.$transaction(async tx => {
      const records = await tx.crmEmailTemplateGroup.updateManyAndReturn({
        where: {
          id,
          organizationId
        },
        data: {
          name: input.name,
          language: input.language,
          description: input.description,
          status: input.status,
          isDefault: input.isDefault
        },
        limit: 1
      });

      if (!records[0]) {
        return null;
      }

      if (input.steps) {
        await tx.crmEmailTemplateStep.deleteMany({
          where: {
            organizationId,
            templateGroupId: id
          }
        });
        await tx.crmEmailTemplateStep.createMany({
          data: toEmailTemplateStepCreateManyInput(organizationId, id, input.steps)
        });
      }

      const record = await tx.crmEmailTemplateGroup.findUnique({
        where: { id },
        include: emailTemplateGroupInclude
      });

      return record ? toEmailTemplateGroupRecord(record) : null;
    });
  }

  async setDefaultEmailTemplateGroup(id: string, organizationId: string) {
    return this.prisma.$transaction(async tx => {
      const records = await tx.crmEmailTemplateGroup.updateManyAndReturn({
        where: {
          id,
          organizationId,
          status: 'active'
        },
        data: { isDefault: true },
        limit: 1
      });

      if (!records[0]) {
        return null;
      }

      await tx.crmEmailTemplateGroup.updateMany({
        where: {
          organizationId,
          id: { not: id },
          isDefault: true
        },
        data: { isDefault: false }
      });

      const record = await tx.crmEmailTemplateGroup.findUnique({
        where: { id },
        include: emailTemplateGroupInclude
      });

      return record ? toEmailTemplateGroupRecord(record) : null;
    });
  }

  async listSequencePolicies(input: CrmSequencePolicyListInput) {
    const where = toSequencePolicyListWhere(input);
    const [records, total] = await Promise.all([
      this.prisma.crmSequencePolicy.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
      }),
      this.prisma.crmSequencePolicy.count({ where })
    ]);

    return {
      records: records.map(toSequencePolicyRecord),
      total
    };
  }

  findSequencePolicyByName(organizationId: string, name: string) {
    return this.prisma.crmSequencePolicy
      .findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name
          }
        }
      })
      .then(record => (record ? toSequencePolicyRecord(record) : null));
  }

  findSequencePolicyById(args: { id: string; organizationId: string }) {
    return this.prisma.crmSequencePolicy
      .findFirst({
        where: {
          id: args.id,
          organizationId: args.organizationId
        }
      })
      .then(record => (record ? toSequencePolicyRecord(record) : null));
  }

  findDefaultSequencePolicy(organizationId: string) {
    return this.prisma.crmSequencePolicy
      .findFirst({
        where: {
          organizationId,
          status: 'active',
          isDefault: true
        },
        orderBy: { updatedAt: 'desc' }
      })
      .then(record => (record ? toSequencePolicyRecord(record) : null));
  }

  async createSequencePolicy(input: CrmSequencePolicyCreateInput) {
    return this.prisma.$transaction(async tx => {
      if (input.isDefault) {
        await tx.crmSequencePolicy.updateMany({
          where: {
            organizationId: input.organizationId,
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      const record = await tx.crmSequencePolicy.create({
        data: toSequencePolicyCreateInput(input)
      });

      return toSequencePolicyRecord(record);
    });
  }

  async updateSequencePolicy(id: string, organizationId: string, input: CrmSequencePolicyUpdateInput) {
    return this.prisma.$transaction(async tx => {
      if (input.isDefault) {
        await tx.crmSequencePolicy.updateMany({
          where: {
            organizationId,
            id: { not: id },
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      const records = await tx.crmSequencePolicy.updateManyAndReturn({
        where: {
          id,
          organizationId
        },
        data: toSequencePolicyUpdateInput(input),
        limit: 1
      });

      return records[0] ? toSequencePolicyRecord(records[0]) : null;
    });
  }

  async setDefaultSequencePolicy(id: string, organizationId: string) {
    return this.prisma.$transaction(async tx => {
      const records = await tx.crmSequencePolicy.updateManyAndReturn({
        where: {
          id,
          organizationId,
          status: 'active'
        },
        data: { isDefault: true },
        limit: 1
      });

      if (!records[0]) {
        return null;
      }

      await tx.crmSequencePolicy.updateMany({
        where: {
          organizationId,
          id: { not: id },
          isDefault: true
        },
        data: { isDefault: false }
      });

      return toSequencePolicyRecord(records[0]);
    });
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
            ...(input.blockingMessageStatuses?.length
              ? [{ status: { in: input.blockingMessageStatuses } }]
              : [])
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

  async listStrategyStats(args: { organizationId: string; ownerUserId?: string }): Promise<CrmStrategyStatsRecord> {
    const where = toScopedOrganizationWhere(args);
    const [enrollments, personaEvents] = await Promise.all([
      this.prisma.crmSequenceEnrollment.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          productLine: true,
          policy: true,
          messages: {
            orderBy: [{ stepIndex: 'asc' as const }, { createdAt: 'asc' as const }]
          }
        }
      }),
      this.prisma.crmTimelineEvent.findMany({
        where: {
          ...where,
          eventType: { in: ['sequence_draft_generated', 'sequence_follow_up_draft_generated'] }
        },
        orderBy: { createdAt: 'asc' }
      })
    ]);
    const personaByEnrollmentId = buildPersonaStatMap(personaEvents);
    const rows = createEmptyStrategyRows();

    for (const enrollment of enrollments) {
      const statInputs: Array<{ dimension: CrmStrategyStatDimension; key: string; name: string }> = [
        { dimension: 'template', key: 'default_template', name: '默认模板' },
        {
          dimension: 'policy',
          key: enrollment.policy?.id ?? 'none',
          name: enrollment.policy?.name ?? '未设置策略'
        },
        {
          dimension: 'productLine',
          key: enrollment.productLine?.id ?? 'none',
          name: enrollment.productLine?.name ?? '未设置产品线'
        },
        {
          dimension: 'persona',
          key: personaByEnrollmentId.get(enrollment.id)?.key ?? 'unknown',
          name: personaByEnrollmentId.get(enrollment.id)?.name ?? '未匹配画像'
        }
      ];

      for (const input of statInputs) {
        const row = getOrCreateStrategyStatRow(rows[input.dimension], input);
        applyEnrollmentStat(row, enrollment.status as CrmSequenceEnrollmentStatus);

        // ready/queued/sent/failed 统计本地 message 状态，不依赖 Gmail 真实投递结果。
        for (const message of enrollment.messages) {
          applyMessageStat(row, message.status as CrmMessageRecord['status']);
        }
      }
    }

    return {
      generatedAt: new Date(),
      rows: {
        template: sortStrategyRows(rows.template),
        policy: sortStrategyRows(rows.policy),
        persona: sortStrategyRows(rows.persona),
        productLine: sortStrategyRows(rows.productLine)
      }
    };
  }

  async getSequenceReviewItem(args: { id: string; organizationId: string; ownerUserId?: string }) {
    const record = await this.prisma.crmSequenceEnrollment.findFirst({
      where: toSequenceEnrollmentIdentityWhere(args),
      include: toSequenceReviewInclude()
    });

    return record ? toSequenceReviewRecord(record) : null;
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

  async markMailboxAuthorizationExpired(
    input: CrmMailboxAuthorizationExpiredInput
  ): Promise<CrmMailboxAuthorizationExpiredRecord | null> {
    return this.prisma.$transaction(async tx => {
      const mailboxes = await tx.crmMailbox.updateManyAndReturn({
        where: {
          id: input.mailboxId,
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId
        },
        data: {
          status: 'auth_expired',
          watchExpiration: null,
          pausedAt: input.expiredAt
        },
        limit: 1
      });
      const mailbox = mailboxes[0];

      if (!mailbox) {
        return null;
      }

      const [pausedEnrollments, resetMessages] = await Promise.all([
        tx.crmSequenceEnrollment.updateMany({
          where: {
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            mailboxId: input.mailboxId,
            status: { in: ['ready_to_send', 'sequence_running'] }
          },
          data: {
            status: 'paused',
            runVersion: { increment: 1 }
          }
        }),
        tx.crmMessage.updateMany({
          where: {
            organizationId: input.organizationId,
            ownerUserId: input.ownerUserId,
            mailboxId: input.mailboxId,
            status: 'queued'
          },
          data: {
            status: 'draft_ready',
            bullJobId: null
          }
        })
      ]);

      return {
        mailbox: toMailboxRecord(mailbox),
        pausedEnrollmentCount: pausedEnrollments.count,
        resetMessageCount: resetMessages.count
      };
    });
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
            status: { in: ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused'] }
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
                data: { emailStatus: isUnsubscribeHint ? 'unsubscribed' : 'unreachable' }
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

      const account = await tx.crmAccount.findUnique({ where: { id: thread.accountId } });
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

/** Builds the scoped account identity filter used before detail reads and writes. */
function toAccountIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmAccountWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the scoped contact identity filter used before contact writes. */
function toContactIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmContactWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the scoped mailbox identity filter used before mailbox writes. */
function toMailboxIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmMailboxWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the scoped product line identity filter used before organization-level writes. */
function toProductLineIdentityWhere(args: { id: string; organizationId: string }): Prisma.CrmProductLineWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId
  };
}

/** Builds the scoped sequence identity filter used before sequence reads and writes. */
function toSequenceEnrollmentIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmSequenceEnrollmentWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the scoped message identity filter used before draft reads and writes. */
function toMessageIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmMessageWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the scoped inbox thread identity filter used before inbox detail and writes. */
function toInboxThreadIdentityWhere(args: {
  id: string;
  organizationId: string;
  ownerUserId?: string;
}): Prisma.CrmInboxThreadWhereInput {
  return {
    id: args.id,
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

/** Builds the Prisma account list scope and optional UI filters. */
function toAccountListWhere(args: {
  organizationId: string;
  ownerUserId?: string;
  keyword?: string;
  status?: CrmAccountStatus;
}): Prisma.CrmAccountWhereInput {
  const keywordFilter = args.keyword ? toAccountKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

/** Builds the Prisma mailbox list scope and optional UI filters. */
function toMailboxListWhere(args: {
  organizationId: string;
  ownerUserId?: string;
  keyword?: string;
  status?: CrmMailboxStatus;
}): Prisma.CrmMailboxWhereInput {
  const keywordFilter = args.keyword ? toMailboxKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

/** Builds the Prisma product line list scope and optional UI filters. */
function toProductLineListWhere(args: {
  organizationId: string;
  keyword?: string;
  status?: CrmProductLineStatus;
}): Prisma.CrmProductLineWhereInput {
  const keywordFilter = args.keyword ? toProductLineKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

/** Builds the Prisma persona profile list scope and optional UI filters. */
function toPersonaProfileListWhere(args: CrmPersonaProfileListInput): Prisma.CrmPersonaProfileWhereInput {
  const keywordFilter = args.keyword ? toPersonaProfileKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

/** Builds the Prisma email template group list scope and optional UI filters. */
function toEmailTemplateGroupListWhere(args: CrmEmailTemplateGroupListInput): Prisma.CrmEmailTemplateGroupWhereInput {
  const keywordFilter = args.keyword ? toEmailTemplateKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

/** Builds the Prisma sequence policy list scope and optional UI filters. */
function toSequencePolicyListWhere(args: CrmSequencePolicyListInput): Prisma.CrmSequencePolicyWhereInput {
  const keywordFilter = args.keyword ? toSequencePolicyKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

function toBlacklistListWhere(args: CrmBlacklistListInput): Prisma.CrmBlacklistWhereInput {
  const keywordFilter = args.keyword ? toBlacklistKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

function toScopedOrganizationWhere(args: {
  organizationId: string;
  ownerUserId?: string;
}): { organizationId: string; ownerUserId?: string } {
  return {
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {})
  };
}

function createEmptyStrategyRows(): Record<CrmStrategyStatDimension, CrmStrategyStatRow[]> {
  return {
    template: [],
    policy: [],
    persona: [],
    productLine: []
  };
}

function getOrCreateStrategyStatRow(
  rows: CrmStrategyStatRow[],
  input: { dimension: CrmStrategyStatDimension; key: string; name: string }
) {
  const existing = rows.find(row => row.key === input.key);

  if (existing) return existing;

  const row: CrmStrategyStatRow = {
    dimension: input.dimension,
    key: input.key,
    name: input.name,
    sequenceCount: 0,
    draftPendingCount: 0,
    readyCount: 0,
    queuedCount: 0,
    sentCount: 0,
    failedCount: 0,
    repliedCount: 0,
    stoppedCount: 0
  };
  rows.push(row);

  return row;
}

function applyEnrollmentStat(row: CrmStrategyStatRow, status: CrmSequenceEnrollmentStatus) {
  row.sequenceCount += 1;

  if (status === 'replied') {
    row.repliedCount += 1;
  }

  if (status === 'stopped') {
    row.stoppedCount += 1;
  }
}

function applyMessageStat(row: CrmStrategyStatRow, status: CrmMessageRecord['status']) {
  if (status === 'draft_pending_review') {
    row.draftPendingCount += 1;
  } else if (status === 'draft_ready') {
    row.readyCount += 1;
  } else if (status === 'queued') {
    row.queuedCount += 1;
  } else if (status === 'sent') {
    row.sentCount += 1;
  } else if (status === 'failed') {
    row.failedCount += 1;
  }
}

function sortStrategyRows(rows: CrmStrategyStatRow[]) {
  return [...rows].sort((left, right) => {
    if (right.sequenceCount !== left.sequenceCount) return right.sequenceCount - left.sequenceCount;
    return left.name.localeCompare(right.name);
  });
}

function buildPersonaStatMap(events: CrmTimelineEventModel[]) {
  const result = new Map<string, { key: string; name: string }>();

  for (const event of events) {
    const metadata = event.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) continue;

    const enrollmentId = (metadata as Record<string, unknown>).enrollmentId;
    if (typeof enrollmentId !== 'string' || result.has(enrollmentId)) continue;

    const personaProfileId = (metadata as Record<string, unknown>).personaProfileId;
    const personaProfileName = (metadata as Record<string, unknown>).personaProfileName;
    result.set(enrollmentId, {
      key: typeof personaProfileId === 'string' && personaProfileId ? personaProfileId : 'unknown',
      name: typeof personaProfileName === 'string' && personaProfileName ? personaProfileName : '未匹配画像'
    });
  }

  return result;
}

/** Builds the sequence review list scope and optional UI filters. */
function toSequenceEnrollmentListWhere(args: {
  organizationId: string;
  ownerUserId?: string;
  keyword?: string;
  status?: CrmSequenceEnrollmentStatus;
  todoType?: CrmSequenceReviewTodoType;
}): Prisma.CrmSequenceEnrollmentWhereInput {
  const keywordFilter = args.keyword ? toSequenceEnrollmentKeywordFilter(args.keyword) : undefined;
  const todoTypeFilter = toSequenceEnrollmentTodoTypeWhere(args.todoType);

  return {
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {}),
    ...(todoTypeFilter ? { AND: [todoTypeFilter] } : {})
  };
}

/** Maps sequence review workbench filters to relation-aware Prisma conditions. */
function toSequenceEnrollmentTodoTypeWhere(
  todoType?: CrmSequenceReviewTodoType
): Prisma.CrmSequenceEnrollmentWhereInput | undefined {
  if (!todoType) return undefined;

  if (todoType === 'draft_review_pending') {
    return { messages: { some: { status: 'draft_pending_review' } } };
  }

  if (todoType === 'follow_up_draft_review') {
    return { messages: { some: { stepIndex: { gt: 1 }, status: 'draft_pending_review' } } };
  }

  if (todoType === 'ready_to_start') {
    return { status: 'ready_to_send', messages: { some: { stepIndex: 1, status: 'draft_ready' } } };
  }

  if (todoType === 'can_generate_next') {
    return {
      status: { in: ['ready_to_send', 'sequence_running'] },
      messages: {
        none: {
          OR: [
            { status: { in: ['draft_pending_review', 'queued', 'failed'] } },
            { stepIndex: 5 }
          ]
        }
      }
    };
  }

  if (todoType === 'send_failed') {
    return { messages: { some: { status: 'failed' } } };
  }

  return { messages: { some: { stepIndex: 5 } } };
}

/** Builds the inbox thread list scope and optional UI filters. */
function toInboxThreadListWhere(args: {
  organizationId: string;
  ownerUserId?: string;
  keyword?: string;
  status?: CrmInboxThreadStatus;
  mailboxId?: string;
}): Prisma.CrmInboxThreadWhereInput {
  const keywordFilter = args.keyword ? toInboxThreadKeywordFilter(args.keyword) : undefined;

  return {
    organizationId: args.organizationId,
    ...(args.ownerUserId ? { ownerUserId: args.ownerUserId } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(args.mailboxId ? { mailboxId: args.mailboxId } : {}),
    ...(keywordFilter ? { OR: keywordFilter } : {})
  };
}

function toAccountKeywordFilter(keyword: string): Prisma.CrmAccountWhereInput[] {
  return ['name', 'domain', 'websiteUrl', 'country', 'customerType'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

function toMailboxKeywordFilter(keyword: string): Prisma.CrmMailboxWhereInput[] {
  return ['emailAddress', 'maskedEmail', 'ownerUserName'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

function toProductLineKeywordFilter(keyword: string): Prisma.CrmProductLineWhereInput[] {
  return [
    'name',
    'targetCustomerType',
    'coreSellingPoints',
    'moq',
    'leadTime',
    'paymentTerms',
    'certifications',
    'commonModelsText'
  ].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

function toPersonaProfileKeywordFilter(keyword: string): Prisma.CrmPersonaProfileWhereInput[] {
  return [
    'name',
    'description',
    'titleKeywordsText',
    'customerTypeKeywordsText',
    'painPoints',
    'focusText',
    'avoidText'
  ].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

function toEmailTemplateKeywordFilter(keyword: string): Prisma.CrmEmailTemplateGroupWhereInput[] {
  return ['name', 'description'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

function toSequencePolicyKeywordFilter(keyword: string): Prisma.CrmSequencePolicyWhereInput[] {
  return ['name', 'description'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

function toBlacklistKeywordFilter(keyword: string): Prisma.CrmBlacklistWhereInput[] {
  return ['maskedEmail', 'createdByName'].map(field => ({
    [field]: {
      contains: keyword,
      mode: 'insensitive'
    }
  }));
}

function toSequenceEnrollmentKeywordFilter(keyword: string): Prisma.CrmSequenceEnrollmentWhereInput[] {
  return [
    { name: { contains: keyword, mode: 'insensitive' } },
    { account: { name: { contains: keyword, mode: 'insensitive' } } },
    { account: { domain: { contains: keyword, mode: 'insensitive' } } },
    { contact: { fullName: { contains: keyword, mode: 'insensitive' } } },
    { contact: { title: { contains: keyword, mode: 'insensitive' } } },
    { contact: { maskedEmail: { contains: keyword, mode: 'insensitive' } } }
  ];
}

function toInboxThreadKeywordFilter(keyword: string): Prisma.CrmInboxThreadWhereInput[] {
  return [
    { subject: { contains: keyword, mode: 'insensitive' } },
    { account: { name: { contains: keyword, mode: 'insensitive' } } },
    { account: { domain: { contains: keyword, mode: 'insensitive' } } },
    { contact: { fullName: { contains: keyword, mode: 'insensitive' } } },
    { contact: { title: { contains: keyword, mode: 'insensitive' } } },
    { contact: { maskedEmail: { contains: keyword, mode: 'insensitive' } } }
  ];
}

function toSequenceReviewInclude() {
  return {
    account: true,
    contact: true,
    productLine: true,
    mailbox: true,
    policy: true,
    messages: {
      orderBy: [{ stepIndex: 'asc' as const }, { createdAt: 'asc' as const }]
    }
  };
}

function toInboxThreadListInclude() {
  return {
    account: true,
    contact: true,
    mailbox: true,
    enrollment: true,
    messages: {
      take: 1,
      orderBy: { receivedAt: 'desc' as const }
    }
  };
}

function toInboxThreadDetailInclude() {
  return {
    account: true,
    contact: true,
    mailbox: true,
    enrollment: true,
    messages: {
      orderBy: { receivedAt: 'asc' as const }
    }
  };
}

function toAccountRecord(record: CrmAccountModel): CrmAccountRecord {
  return {
    ...record,
    status: record.status as CrmAccountRecord['status']
  };
}

function toArchivedFingerprintRecord(record: CrmArchivedFingerprintModel): CrmArchivedFingerprintRecord {
  return {
    ...record,
    fingerprintType: record.fingerprintType as CrmArchivedFingerprintRecord['fingerprintType']
  };
}

function toBlacklistRecord(record: CrmBlacklistModel): CrmBlacklistRecord {
  return {
    ...record,
    reason: record.reason as CrmBlacklistRecord['reason']
  };
}

function toContactRecord(record: CrmContactModel): CrmContactRecord {
  return {
    ...record,
    emailStatus: record.emailStatus as CrmContactRecord['emailStatus']
  };
}

function toEmailVerificationCacheRecord(record: CrmEmailVerificationCacheModel): CrmEmailVerificationCacheRecord {
  return {
    ...record,
    status: record.status as CrmEmailVerificationCacheRecord['status'],
    reason: record.reason as CrmEmailVerificationCacheRecord['reason']
  };
}

function createDefaultGlobalConfig(): CrmGlobalConfigRecord {
  return {
    configKey: crmGlobalConfigKey,
    emailVerificationCooldownDays: defaultEmailVerificationCooldownDays,
    ownerConcurrentSendLimit: defaultOwnerConcurrentSendLimit,
    ownerDailySendLimitMax: defaultOwnerDailySendLimitMax,
    followUpDelayDays: { ...defaultFollowUpDelayDays },
    updatedAt: new Date(0)
  };
}

function toGlobalConfigRecord(record: CrmGlobalConfigModel): CrmGlobalConfigRecord {
  return {
    configKey: record.configKey,
    emailVerificationCooldownDays: normalizeEmailVerificationCooldownDays(record.emailVerificationCooldownDays),
    ownerConcurrentSendLimit: normalizeOwnerConcurrentSendLimit(record.ownerConcurrentSendLimit),
    ownerDailySendLimitMax: normalizeOwnerDailySendLimitMax(record.ownerDailySendLimitMax),
    followUpDelayDays: normalizeFollowUpDelayDays(record.followUpDelayDaysText),
    updatedAt: record.updatedAt
  };
}

function toSendPreferenceRecord(record: CrmUserSendPreferenceModel): CrmSendPreferenceRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    ownerUserId: record.ownerUserId,
    ownerUserName: record.ownerUserName,
    dailySendLimit: record.dailySendLimit,
    followUpSharePercent: record.followUpSharePercent,
    updatedById: record.updatedById,
    updatedByName: record.updatedByName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function toStepKindWhere(stepKind?: CrmScheduledMessageStepKind): Prisma.CrmMessageWhereInput {
  if (stepKind === 'first_touch') {
    return { stepIndex: 1 };
  }

  if (stepKind === 'follow_up') {
    return { stepIndex: { gt: 1 } };
  }

  return {};
}

function toOrganizationConfigRecord(record: CrmOrganizationConfigModel): CrmOrganizationConfigRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    allowAdminViewMemberEmailBody: record.allowAdminViewMemberEmailBody,
    updatedById: record.updatedById,
    updatedByName: record.updatedByName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function toTimelineEventRecord(record: CrmTimelineEventModel): CrmTimelineEventRecord {
  return record;
}

function toMailboxRecord(record: CrmMailboxModel): CrmMailboxRecord {
  return {
    ...record,
    provider: record.provider as CrmMailboxRecord['provider'],
    status: record.status as CrmMailboxRecord['status'],
    warmupStage: record.warmupStage as CrmMailboxRecord['warmupStage'],
    syncIssueType: record.syncIssueType as CrmMailboxRecord['syncIssueType']
  };
}

function toProductLineRecord(record: CrmProductLineModel): CrmProductLineRecord {
  return {
    ...record,
    aiWritingConfig: toProductLineAiWritingConfig(record.aiWritingConfig),
    status: record.status as CrmProductLineRecord['status']
  };
}

function toProductLineAiWritingConfig(value: unknown): CrmProductLineRecord['aiWritingConfig'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  return value as CrmProductLineRecord['aiWritingConfig'];
}

function toProductLineAiPromptVersionJson(config: CrmProductLineAiWritingConfig | null) {
  return config === null ? Prisma.JsonNull : (config as unknown as Prisma.InputJsonValue);
}

function toNullableJsonInput(value: unknown) {
  return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

function countAiDraftTaskItems(items: CrmAiDraftTaskCreateInput['items']) {
  return {
    successCount: items.filter(item => item.status === 'succeeded').length,
    skippedCount: items.filter(item => item.status === 'skipped').length,
    failedCount: items.filter(item => item.status === 'failed').length,
    retryingCount: items.filter(item => item.status === 'retrying').length,
    runningCount: items.filter(item => item.status === 'running').length,
    pendingCount: items.filter(item => (item.status ?? 'pending') === 'pending').length
  };
}

function toStatusWhere<T extends string>(status: T | T[]) {
  return Array.isArray(status) ? { in: status } : status;
}

function createDefaultAiDraftQueueConfig(): CrmAiDraftQueueConfigRecord {
  return {
    configKey: crmAiDraftQueueConfigKey,
    itemConcurrency: defaultCrmAiDraftItemConcurrency,
    maxItemConcurrency: maxCrmAiDraftItemConcurrency,
    maxActiveTasksPerUser: 1,
    maxActiveTasksPerOrg: 2,
    maxAttempts: defaultCrmAiDraftMaxAttempts,
    retryBackoffSeconds: [...defaultCrmAiDraftRetryBackoffSeconds],
    updatedById: null,
    updatedByName: null,
    updatedAt: new Date(0)
  };
}

function toAiDraftQueueConfigRecord(record: CrmAiDraftQueueConfigModel): CrmAiDraftQueueConfigRecord {
  return {
    configKey: record.configKey,
    itemConcurrency: normalizeCrmAiDraftItemConcurrency(record.itemConcurrency, record.maxItemConcurrency),
    maxItemConcurrency: normalizeCrmAiDraftItemConcurrency(record.maxItemConcurrency, maxCrmAiDraftItemConcurrency),
    maxActiveTasksPerUser: normalizePositiveConfigInteger(record.maxActiveTasksPerUser, 1),
    maxActiveTasksPerOrg: normalizePositiveConfigInteger(record.maxActiveTasksPerOrg, 2),
    maxAttempts: normalizeCrmAiDraftMaxAttempts(record.maxAttempts),
    retryBackoffSeconds: normalizeCrmAiDraftRetryBackoffSeconds(record.retryBackoffSeconds),
    updatedById: record.updatedById,
    updatedByName: record.updatedByName,
    updatedAt: record.updatedAt
  };
}

function toAiDraftTaskRecord(record: CrmAiDraftTaskModel): CrmAiDraftTaskRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    organizationRole: record.organizationRole,
    ownerUserId: record.ownerUserId,
    ownerUserName: record.ownerUserName,
    status: record.status as CrmAiDraftTaskRecord['status'],
    runVersion: record.runVersion,
    bullJobId: record.bullJobId,
    requestedCount: record.requestedCount,
    successCount: record.successCount,
    skippedCount: record.skippedCount,
    failedCount: record.failedCount,
    retryingCount: record.retryingCount,
    runningCount: record.runningCount,
    pendingCount: record.pendingCount,
    effectiveConcurrency: record.effectiveConcurrency,
    maxAttempts: record.maxAttempts,
    failureReason: record.failureReason,
    progressState: record.progressState as CrmAiDraftTaskRecord['progressState'],
    resultSummary: record.resultSummary as CrmAiDraftTaskRecord['resultSummary'],
    readAt: record.readAt,
    notifiedAt: record.notifiedAt,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function toAiDraftTaskItemRecord(record: CrmAiDraftTaskItemModel): CrmAiDraftTaskItemRecord {
  return {
    id: record.id,
    taskId: record.taskId,
    organizationId: record.organizationId,
    ownerUserId: record.ownerUserId,
    enrollmentId: record.enrollmentId,
    messageId: record.messageId,
    contactId: record.contactId,
    accountId: record.accountId,
    productLineId: record.productLineId,
    stepIndex: record.stepIndex,
    status: record.status as CrmAiDraftTaskItemRecord['status'],
    attemptCount: record.attemptCount,
    maxAttempts: record.maxAttempts,
    failureType: record.failureType as CrmAiDraftTaskItemRecord['failureType'],
    failureReason: record.failureReason,
    draftSubject: record.draftSubject,
    draftBodyText: record.draftBodyText,
    metadata: record.metadata as CrmAiDraftTaskItemRecord['metadata'],
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function toAiDraftTaskUpdateData(input: CrmAiDraftTaskUpdateInput): Prisma.CrmAiDraftTaskUncheckedUpdateInput {
  return {
    ...input,
    progressState: input.progressState === undefined ? undefined : toNullableJsonInput(input.progressState),
    resultSummary: input.resultSummary === undefined ? undefined : toNullableJsonInput(input.resultSummary)
  };
}

function toAiDraftTaskItemUpdateData(
  input: CrmAiDraftTaskItemUpdateInput
): Prisma.CrmAiDraftTaskItemUncheckedUpdateInput {
  return {
    ...input,
    metadata: input.metadata === undefined ? undefined : toNullableJsonInput(input.metadata)
  };
}

function normalizePositiveConfigInteger(value: unknown, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return fallback;
  }

  return numberValue;
}

function toProductLineAiPromptVersionRecord(
  record: CrmProductLineAiPromptVersionModel
): CrmProductLineAiPromptVersionRecord {
  return {
    ...record,
    aiWritingConfig: toProductLineAiWritingConfig(record.aiWritingConfig)
  };
}

function toPersonaProfileRecord(record: CrmPersonaProfileModel): CrmPersonaProfileRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    description: record.description,
    titleKeywordsText: record.titleKeywordsText,
    customerTypeKeywordsText: record.customerTypeKeywordsText,
    painPoints: record.painPoints,
    focusText: record.focusText,
    avoidText: record.avoidText,
    status: record.status as CrmPersonaProfileRecord['status'],
    isDefault: record.isDefault,
    createdById: record.createdById,
    createdByName: record.createdByName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function toEmailTemplateStepRecord(record: CrmEmailTemplateStepModel): CrmEmailTemplateStepRecord {
  return {
    ...record,
    threadMode: record.threadMode as CrmEmailTemplateStepRecord['threadMode']
  };
}

function toEmailTemplateGroupRecord(record: CrmEmailTemplateGroupModelWithSteps): CrmEmailTemplateGroupRecord {
  return {
    ...record,
    status: record.status as CrmEmailTemplateGroupRecord['status'],
    steps: record.steps.map(toEmailTemplateStepRecord)
  };
}

function toEmailTemplateStepCreateManyInput(
  organizationId: string,
  templateGroupId: string,
  steps: CrmEmailTemplateStepInput[]
) {
  return steps.map(step => ({
    organizationId,
    templateGroupId,
    stepIndex: step.stepIndex,
    name: step.name,
    threadMode: step.threadMode,
    delayDays: step.delayDays,
    subjectTemplate: step.subjectTemplate,
    bodyTemplate: step.bodyTemplate
  }));
}

function toSequencePolicyRecord(record: CrmSequencePolicyModel): CrmSequencePolicyRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    description: record.description,
    status: normalizeSequencePolicyStatus(record.status),
    isDefault: record.isDefault,
    steps: parseSequencePolicySteps(record.stepDelayDaysText, record.stepThreadModesText),
    linkPolicy: normalizeSequencePolicyLinkPolicy(record.linkPolicy),
    allowLowRiskAutoSend: record.allowLowRiskAutoSend,
    sameCompanyContactStrategy: normalizeSequencePolicySameCompanyStrategy(record.sameCompanyContactStrategy),
    createdById: record.createdById,
    createdByName: record.createdByName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function toPersonaProfileCreateInput(input: CrmPersonaProfileCreateInput): Prisma.CrmPersonaProfileUncheckedCreateInput {
  return {
    organizationId: input.organizationId,
    name: input.name,
    description: input.description ?? null,
    titleKeywordsText: input.titleKeywordsText ?? null,
    customerTypeKeywordsText: input.customerTypeKeywordsText ?? null,
    painPoints: input.painPoints ?? null,
    focusText: input.focusText ?? null,
    avoidText: input.avoidText ?? null,
    status: input.status,
    isDefault: input.isDefault,
    createdById: input.createdById,
    createdByName: input.createdByName ?? null
  };
}

function toPersonaProfileUpdateInput(input: CrmPersonaProfileUpdateInput): Prisma.CrmPersonaProfileUncheckedUpdateInput {
  return {
    name: input.name,
    description: input.description,
    titleKeywordsText: input.titleKeywordsText,
    customerTypeKeywordsText: input.customerTypeKeywordsText,
    painPoints: input.painPoints,
    focusText: input.focusText,
    avoidText: input.avoidText,
    status: input.status,
    isDefault: input.isDefault
  };
}

function toSequencePolicyCreateInput(
  input: CrmSequencePolicyCreateInput
): Prisma.CrmSequencePolicyUncheckedCreateInput {
  return {
    organizationId: input.organizationId,
    name: input.name,
    description: input.description ?? null,
    status: input.status,
    isDefault: input.isDefault,
    stepDelayDaysText: serializeSequencePolicyStepDelayDays(input.steps),
    stepThreadModesText: serializeSequencePolicyThreadModes(input.steps),
    linkPolicy: input.linkPolicy,
    allowLowRiskAutoSend: input.allowLowRiskAutoSend,
    sameCompanyContactStrategy: input.sameCompanyContactStrategy,
    createdById: input.createdById,
    createdByName: input.createdByName ?? null
  };
}

function toSequencePolicyUpdateInput(
  input: CrmSequencePolicyUpdateInput
): Prisma.CrmSequencePolicyUncheckedUpdateInput {
  return {
    name: input.name,
    description: input.description,
    status: input.status,
    isDefault: input.isDefault,
    ...(input.steps
      ? {
          stepDelayDaysText: serializeSequencePolicyStepDelayDays(input.steps),
          stepThreadModesText: serializeSequencePolicyThreadModes(input.steps)
        }
      : {}),
    linkPolicy: input.linkPolicy,
    allowLowRiskAutoSend: input.allowLowRiskAutoSend,
    sameCompanyContactStrategy: input.sameCompanyContactStrategy
  };
}

function toSequenceEnrollmentRecord(record: CrmSequenceEnrollmentModel): CrmSequenceEnrollmentRecord {
  return {
    ...record,
    status: record.status as CrmSequenceEnrollmentRecord['status']
  };
}

function toMessageRecord(record: CrmMessageModel): CrmMessageRecord {
  const message = record as CrmMessageModel & {
    providerMessageId?: string | null;
    providerThreadId?: string | null;
    metadata?: unknown | null;
  };

  return {
    ...message,
    threadMode: message.threadMode as CrmMessageRecord['threadMode'],
    status: message.status as CrmMessageRecord['status'],
    providerMessageId: message.providerMessageId ?? null,
    providerThreadId: message.providerThreadId ?? null,
    metadata: message.metadata ?? null
  };
}

function toInboxThreadRecord(record: CrmInboxThreadModel): CrmInboxThreadRecord {
  return {
    ...record,
    replyDraftMetadata: toInboxReplyDraftMetadata(record.replyDraftMetadata),
    provider: record.provider as CrmInboxThreadRecord['provider'],
    status: record.status as CrmInboxThreadRecord['status']
  };
}

function toInboxReplyDraftMetadata(value: unknown): CrmInboxThreadRecord['replyDraftMetadata'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Partial<NonNullable<CrmInboxThreadRecord['replyDraftMetadata']>>;

  return {
    generated: Boolean(record.generated),
    reason: typeof record.reason === 'string' ? record.reason : '',
    riskNotes: Array.isArray(record.riskNotes) ? record.riskNotes.filter(item => typeof item === 'string') : [],
    productLineId: typeof record.productLineId === 'string' ? record.productLineId : null,
    productLineName: typeof record.productLineName === 'string' ? record.productLineName : null,
    generatedAt: typeof record.generatedAt === 'string' ? record.generatedAt : undefined
  };
}

function toInboxMessageRecord(record: CrmInboxMessageModel): CrmInboxMessageRecord {
  return {
    ...record,
    provider: record.provider as CrmInboxMessageRecord['provider'],
    messageType: record.messageType as CrmInboxMessageRecord['messageType']
  };
}

type CrmMessageDraftVersionRaw = CrmMessageDraftVersionRecord;

function toMessageDraftVersionRecord(record: CrmMessageDraftVersionRaw): CrmMessageDraftVersionRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    ownerUserId: record.ownerUserId,
    accountId: record.accountId,
    contactId: record.contactId,
    enrollmentId: record.enrollmentId,
    messageId: record.messageId,
    mailboxId: record.mailboxId,
    stepIndex: record.stepIndex,
    versionNo: record.versionNo,
    subject: record.subject,
    bodyText: record.bodyText,
    editorId: record.editorId,
    editorName: record.editorName,
    createdAt: new Date(record.createdAt)
  };
}

function toSequenceReviewRecord(
  record: CrmSequenceEnrollmentModel & {
    account: CrmAccountModel;
    contact: CrmContactModel;
    productLine: CrmProductLineModel | null;
    mailbox: CrmMailboxModel | null;
    policy?: CrmSequencePolicyModel | null;
    messages: CrmMessageModel[];
  }
): CrmSequenceReviewRecord {
  const messages = record.messages.map(toMessageRecord);

  return {
    enrollment: toSequenceEnrollmentRecord(record),
    account: toAccountRecord(record.account),
    contact: toContactRecord(record.contact),
    productLine: record.productLine ? toProductLineRecord(record.productLine) : null,
    mailbox: record.mailbox ? toMailboxRecord(record.mailbox) : null,
    policy: record.policy ? toSequencePolicyRecord(record.policy) : null,
    firstMessage: messages.find(message => message.stepIndex === 1) || messages[0] || null,
    messages
  };
}

function toInboxThreadListRecord(
  record: CrmInboxThreadModel & {
    account: CrmAccountModel;
    contact: CrmContactModel;
    mailbox: CrmMailboxModel | null;
    enrollment: CrmSequenceEnrollmentModel | null;
    messages: CrmInboxMessageModel[];
  }
): CrmInboxThreadListRecord {
  return {
    thread: toInboxThreadRecord(record),
    account: toAccountRecord(record.account),
    contact: toContactRecord(record.contact),
    mailbox: record.mailbox ? toMailboxRecord(record.mailbox) : null,
    enrollment: record.enrollment ? toSequenceEnrollmentRecord(record.enrollment) : null,
    lastMessage: record.messages[0] ? toInboxMessageRecord(record.messages[0]) : null
  };
}

function toInboxThreadDetailRecord(
  record: CrmInboxThreadModel & {
    account: CrmAccountModel;
    contact: CrmContactModel;
    mailbox: CrmMailboxModel | null;
    enrollment: CrmSequenceEnrollmentModel | null;
    messages: CrmInboxMessageModel[];
  },
  timelineEvents: CrmTimelineEventModel[]
): CrmInboxThreadDetailRecord {
  return {
    ...toInboxThreadListRecord(record),
    messages: record.messages.map(toInboxMessageRecord),
    timelineEvents: timelineEvents.map(toTimelineEventRecord)
  };
}

type MailboxSendQuotaBucketType = 'daily' | 'hourly';

interface MailboxSendQuotaInput {
  organizationId: string;
  mailboxId: string;
  dailyLimit: number;
  hourlyLimit: number;
  at: Date;
}

interface MailboxSendQuotaBucketInput {
  organizationId: string;
  mailboxId: string;
  bucketType: MailboxSendQuotaBucketType;
  bucketKey: string;
  limit: number;
}

async function reserveMailboxSendQuota(tx: Prisma.TransactionClient, input: MailboxSendQuotaInput) {
  const buckets = toMailboxSendQuotaBuckets(input.at);
  const dailyReserved = await reserveMailboxSendQuotaBucket(tx, {
    organizationId: input.organizationId,
    mailboxId: input.mailboxId,
    bucketType: 'daily',
    bucketKey: buckets.daily,
    limit: input.dailyLimit
  });

  if (!dailyReserved) {
    return false;
  }

  const hourlyReserved = await reserveMailboxSendQuotaBucket(tx, {
    organizationId: input.organizationId,
    mailboxId: input.mailboxId,
    bucketType: 'hourly',
    bucketKey: buckets.hourly,
    limit: input.hourlyLimit
  });

  if (!hourlyReserved) {
    await releaseMailboxSendQuotaBucket(tx, {
      organizationId: input.organizationId,
      mailboxId: input.mailboxId,
      bucketType: 'daily',
      bucketKey: buckets.daily,
      limit: input.dailyLimit
    });
    return false;
  }

  return true;
}

async function reserveMailboxSendQuotaBucket(tx: Prisma.TransactionClient, input: MailboxSendQuotaBucketInput) {
  if (input.limit <= 0) {
    return false;
  }

  const updated = await tx.crmMailboxSendUsage.updateMany({
    where: {
      mailboxId: input.mailboxId,
      bucketType: input.bucketType,
      bucketKey: input.bucketKey,
      usedCount: { lt: input.limit }
    },
    data: {
      usedCount: { increment: 1 }
    }
  });

  if (updated.count > 0) {
    return true;
  }

  const existing = await tx.crmMailboxSendUsage.findUnique({
    where: {
      mailboxId_bucketType_bucketKey: {
        mailboxId: input.mailboxId,
        bucketType: input.bucketType,
        bucketKey: input.bucketKey
      }
    }
  });

  if (existing) {
    return false;
  }

  try {
    await tx.crmMailboxSendUsage.create({
      data: {
        organizationId: input.organizationId,
        mailboxId: input.mailboxId,
        bucketType: input.bucketType,
        bucketKey: input.bucketKey,
        usedCount: 1
      }
    });
    return true;
  } catch (error) {
    if (!isPrismaUniqueConflict(error)) {
      throw error;
    }

    // Another worker created the bucket first; retry the guarded increment.
    const retryUpdated = await tx.crmMailboxSendUsage.updateMany({
      where: {
        mailboxId: input.mailboxId,
        bucketType: input.bucketType,
        bucketKey: input.bucketKey,
        usedCount: { lt: input.limit }
      },
      data: {
        usedCount: { increment: 1 }
      }
    });

    return retryUpdated.count > 0;
  }
}

async function releaseMailboxSendQuotaBucket(tx: Prisma.TransactionClient, input: MailboxSendQuotaBucketInput) {
  await tx.crmMailboxSendUsage.updateMany({
    where: {
      mailboxId: input.mailboxId,
      bucketType: input.bucketType,
      bucketKey: input.bucketKey,
      usedCount: { gt: 0 }
    },
    data: {
      usedCount: { decrement: 1 }
    }
  });
}

function toMailboxSendQuotaBuckets(at: Date) {
  const iso = at.toISOString();

  return {
    daily: iso.slice(0, 10),
    hourly: iso.slice(0, 13)
  };
}

function toSnippet(bodyText: string) {
  const normalized = bodyText.replace(/\s+/g, ' ').trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function resolveGmailThreadStateUpdate(
  thread: Pick<CrmInboxThreadRecord, 'status' | 'unreadCount'>,
  input: Pick<CrmInboxThreadGmailStateSyncInput, 'changeType' | 'labelIds'>
) {
  const labelIds = new Set(input.labelIds);
  const isArchived =
    input.changeType === 'message_deleted' ||
    (input.changeType === 'labels_removed' && labelIds.has('INBOX')) ||
    (input.changeType === 'labels_added' && labelIds.has('TRASH'));

  if (isArchived) {
    if (thread.status === 'archived' && thread.unreadCount === 0) return null;

    return {
      nextStatus: 'archived' as CrmInboxThreadStatus,
      eventType: 'gmail_thread_archived',
      title: 'Gmail 状态同步为归档',
      data: {
        status: 'archived',
        unreadCount: 0
      }
    };
  }

  if (input.changeType === 'labels_removed' && labelIds.has('UNREAD')) {
    if (thread.status === 'handled' && thread.unreadCount === 0) return null;

    return {
      nextStatus: 'handled' as CrmInboxThreadStatus,
      eventType: 'gmail_label_synced',
      title: 'Gmail 状态同步为已读',
      data: {
        status: 'handled',
        unreadCount: 0
      }
    };
  }

  if (input.changeType === 'labels_added' && labelIds.has('UNREAD')) {
    if (thread.status === 'pending' && thread.unreadCount > 0) return null;

    return {
      nextStatus: 'pending' as CrmInboxThreadStatus,
      eventType: 'gmail_label_synced',
      title: 'Gmail 状态同步为未读',
      data: {
        status: 'pending',
        unreadCount: Math.max(thread.unreadCount, 1)
      }
    };
  }

  return null;
}

function isPrismaUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isPrismaConcurrentTaskCreateConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}
