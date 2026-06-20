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
  toAccountListWhere,
  toMailboxListWhere,
  toProductLineListWhere,
  toPersonaProfileListWhere,
  toEmailTemplateGroupListWhere,
  toSequencePolicyListWhere,
  toBlacklistListWhere,
  toUniqueStrings,
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
  toAccountKeywordFilter,
  toMailboxKeywordFilter,
  toProductLineKeywordFilter,
  toPersonaProfileKeywordFilter,
  toEmailTemplateKeywordFilter,
  toSequencePolicyKeywordFilter,
  toBlacklistKeywordFilter,
  toSequenceEnrollmentKeywordFilter,
  toSequenceReviewInclude,
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
  type CrmMessageDraftVersionRaw,
  toMessageDraftVersionRecord,
  toSequenceReviewRecord,
  reserveMailboxSendQuota,
  reserveMailboxSendQuotaBucket,
  releaseMailboxSendQuotaBucket,
  toMailboxSendQuotaBuckets,
  isPrismaConcurrentTaskCreateConflict
} from './prisma-crm-store.helpers';
import { PrismaCrmAccountStore } from './prisma-crm-account.store';
import { PrismaCrmAiDraftTaskStore } from './prisma-crm-ai-draft-task.store';
import { PrismaCrmDashboardStore } from './prisma-crm-dashboard.store';
import { PrismaCrmInboxStore } from './prisma-crm-inbox.store';
import { PrismaCrmMailboxStore } from './prisma-crm-mailbox.store';
import { PrismaCrmSendScheduleStore } from './prisma-crm-send-schedule.store';
import { PrismaCrmSettingsStore } from './prisma-crm-settings.store';
import { PrismaCrmSuppressionStore } from './prisma-crm-suppression.store';
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

@Injectable()
export class PrismaCrmStore implements CrmStore {
  private readonly accountStore: PrismaCrmAccountStore;
  private readonly aiDraftTaskStore: PrismaCrmAiDraftTaskStore;
  private readonly dashboardStore: PrismaCrmDashboardStore;
  private readonly inboxStore: PrismaCrmInboxStore;
  private readonly mailboxStore: PrismaCrmMailboxStore;
  private readonly sendScheduleStore: PrismaCrmSendScheduleStore;
  private readonly settingsStore: PrismaCrmSettingsStore;
  private readonly suppressionStore: PrismaCrmSuppressionStore;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    this.accountStore = new PrismaCrmAccountStore(prisma);
    this.aiDraftTaskStore = new PrismaCrmAiDraftTaskStore(prisma);
    this.dashboardStore = new PrismaCrmDashboardStore(prisma);
    this.inboxStore = new PrismaCrmInboxStore(prisma);
    this.mailboxStore = new PrismaCrmMailboxStore(prisma);
    this.sendScheduleStore = new PrismaCrmSendScheduleStore(prisma);
    this.settingsStore = new PrismaCrmSettingsStore(prisma);
    this.suppressionStore = new PrismaCrmSuppressionStore(prisma);
  }
  findAccountByDomain(
    ...args: Parameters<PrismaCrmAccountStore['findAccountByDomain']>
  ): ReturnType<PrismaCrmAccountStore['findAccountByDomain']> {
    return this.accountStore.findAccountByDomain(...args);
  }
  createAccount(
    ...args: Parameters<PrismaCrmAccountStore['createAccount']>
  ): ReturnType<PrismaCrmAccountStore['createAccount']> {
    return this.accountStore.createAccount(...args);
  }
  updateAccount(
    ...args: Parameters<PrismaCrmAccountStore['updateAccount']>
  ): ReturnType<PrismaCrmAccountStore['updateAccount']> {
    return this.accountStore.updateAccount(...args);
  }
  listAccountsForArchiveSlimming(
    ...args: Parameters<PrismaCrmAccountStore['listAccountsForArchiveSlimming']>
  ): ReturnType<PrismaCrmAccountStore['listAccountsForArchiveSlimming']> {
    return this.accountStore.listAccountsForArchiveSlimming(...args);
  }
  slimArchivedAccount(
    ...args: Parameters<PrismaCrmAccountStore['slimArchivedAccount']>
  ): ReturnType<PrismaCrmAccountStore['slimArchivedAccount']> {
    return this.accountStore.slimArchivedAccount(...args);
  }
  findContactByEmailHash(
    ...args: Parameters<PrismaCrmAccountStore['findContactByEmailHash']>
  ): ReturnType<PrismaCrmAccountStore['findContactByEmailHash']> {
    return this.accountStore.findContactByEmailHash(...args);
  }
  createContact(
    ...args: Parameters<PrismaCrmAccountStore['createContact']>
  ): ReturnType<PrismaCrmAccountStore['createContact']> {
    return this.accountStore.createContact(...args);
  }
  updateContact(
    ...args: Parameters<PrismaCrmAccountStore['updateContact']>
  ): ReturnType<PrismaCrmAccountStore['updateContact']> {
    return this.accountStore.updateContact(...args);
  }
  findContactById(
    ...args: Parameters<PrismaCrmAccountStore['findContactById']>
  ): ReturnType<PrismaCrmAccountStore['findContactById']> {
    return this.accountStore.findContactById(...args);
  }
  updateContactEmailStatus(
    ...args: Parameters<PrismaCrmAccountStore['updateContactEmailStatus']>
  ): ReturnType<PrismaCrmAccountStore['updateContactEmailStatus']> {
    return this.accountStore.updateContactEmailStatus(...args);
  }
  findEmailVerificationCache(
    ...args: Parameters<PrismaCrmAccountStore['findEmailVerificationCache']>
  ): ReturnType<PrismaCrmAccountStore['findEmailVerificationCache']> {
    return this.accountStore.findEmailVerificationCache(...args);
  }
  upsertEmailVerificationCache(
    ...args: Parameters<PrismaCrmAccountStore['upsertEmailVerificationCache']>
  ): ReturnType<PrismaCrmAccountStore['upsertEmailVerificationCache']> {
    return this.accountStore.upsertEmailVerificationCache(...args);
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
  createAiDraftTask(
    ...args: Parameters<PrismaCrmAiDraftTaskStore['createAiDraftTask']>
  ): ReturnType<PrismaCrmAiDraftTaskStore['createAiDraftTask']> {
    return this.aiDraftTaskStore.createAiDraftTask(...args);
  }
  countActiveAiDraftTasksForUser(
    ...args: Parameters<PrismaCrmAiDraftTaskStore['countActiveAiDraftTasksForUser']>
  ): ReturnType<PrismaCrmAiDraftTaskStore['countActiveAiDraftTasksForUser']> {
    return this.aiDraftTaskStore.countActiveAiDraftTasksForUser(...args);
  }
  countActiveAiDraftTasksForOrg(
    ...args: Parameters<PrismaCrmAiDraftTaskStore['countActiveAiDraftTasksForOrg']>
  ): ReturnType<PrismaCrmAiDraftTaskStore['countActiveAiDraftTasksForOrg']> {
    return this.aiDraftTaskStore.countActiveAiDraftTasksForOrg(...args);
  }
  findCurrentAiDraftTaskForUser(
    ...args: Parameters<PrismaCrmAiDraftTaskStore['findCurrentAiDraftTaskForUser']>
  ): ReturnType<PrismaCrmAiDraftTaskStore['findCurrentAiDraftTaskForUser']> {
    return this.aiDraftTaskStore.findCurrentAiDraftTaskForUser(...args);
  }
  findAiDraftTaskById(
    ...args: Parameters<PrismaCrmAiDraftTaskStore['findAiDraftTaskById']>
  ): ReturnType<PrismaCrmAiDraftTaskStore['findAiDraftTaskById']> {
    return this.aiDraftTaskStore.findAiDraftTaskById(...args);
  }
  listAiDraftTasks(
    ...args: Parameters<PrismaCrmAiDraftTaskStore['listAiDraftTasks']>
  ): ReturnType<PrismaCrmAiDraftTaskStore['listAiDraftTasks']> {
    return this.aiDraftTaskStore.listAiDraftTasks(...args);
  }
  listAiDraftTaskItems(
    ...args: Parameters<PrismaCrmAiDraftTaskStore['listAiDraftTaskItems']>
  ): ReturnType<PrismaCrmAiDraftTaskStore['listAiDraftTaskItems']> {
    return this.aiDraftTaskStore.listAiDraftTaskItems(...args);
  }
  updateAiDraftTask(
    ...args: Parameters<PrismaCrmAiDraftTaskStore['updateAiDraftTask']>
  ): ReturnType<PrismaCrmAiDraftTaskStore['updateAiDraftTask']> {
    return this.aiDraftTaskStore.updateAiDraftTask(...args);
  }
  updateAiDraftTaskItem(
    ...args: Parameters<PrismaCrmAiDraftTaskStore['updateAiDraftTaskItem']>
  ): ReturnType<PrismaCrmAiDraftTaskStore['updateAiDraftTaskItem']> {
    return this.aiDraftTaskStore.updateAiDraftTaskItem(...args);
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

  countOwnerQueuedMessages(
    ...args: Parameters<PrismaCrmSendScheduleStore['countOwnerQueuedMessages']>
  ): ReturnType<PrismaCrmSendScheduleStore['countOwnerQueuedMessages']> {
    return this.sendScheduleStore.countOwnerQueuedMessages(...args);
  }

  countDispatchedMessages(
    ...args: Parameters<PrismaCrmSendScheduleStore['countDispatchedMessages']>
  ): ReturnType<PrismaCrmSendScheduleStore['countDispatchedMessages']> {
    return this.sendScheduleStore.countDispatchedMessages(...args);
  }

  listOwnerSendStates(
    ...args: Parameters<PrismaCrmSendScheduleStore['listOwnerSendStates']>
  ): ReturnType<PrismaCrmSendScheduleStore['listOwnerSendStates']> {
    return this.sendScheduleStore.listOwnerSendStates(...args);
  }

  listMailboxSendStates(
    ...args: Parameters<PrismaCrmSendScheduleStore['listMailboxSendStates']>
  ): ReturnType<PrismaCrmSendScheduleStore['listMailboxSendStates']> {
    return this.sendScheduleStore.listMailboxSendStates(...args);
  }

  getWorkbenchOverview(
    ...args: Parameters<PrismaCrmDashboardStore['getWorkbenchOverview']>
  ): ReturnType<PrismaCrmDashboardStore['getWorkbenchOverview']> {
    return this.dashboardStore.getWorkbenchOverview(...args);
  }

  listDueSendCandidates(
    ...args: Parameters<PrismaCrmSendScheduleStore['listDueSendCandidates']>
  ): ReturnType<PrismaCrmSendScheduleStore['listDueSendCandidates']> {
    return this.sendScheduleStore.listDueSendCandidates(...args);
  }

  listStaleQueuedMessages(
    ...args: Parameters<PrismaCrmSendScheduleStore['listStaleQueuedMessages']>
  ): ReturnType<PrismaCrmSendScheduleStore['listStaleQueuedMessages']> {
    return this.sendScheduleStore.listStaleQueuedMessages(...args);
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
  findBlacklistEntry(
    ...args: Parameters<PrismaCrmSuppressionStore['findBlacklistEntry']>
  ): ReturnType<PrismaCrmSuppressionStore['findBlacklistEntry']> {
    return this.suppressionStore.findBlacklistEntry(...args);
  }
  listBlacklistEntriesByEmailHashes(
    ...args: Parameters<PrismaCrmSuppressionStore['listBlacklistEntriesByEmailHashes']>
  ): ReturnType<PrismaCrmSuppressionStore['listBlacklistEntriesByEmailHashes']> {
    return this.suppressionStore.listBlacklistEntriesByEmailHashes(...args);
  }
  upsertBlacklistEntry(
    ...args: Parameters<PrismaCrmSuppressionStore['upsertBlacklistEntry']>
  ): ReturnType<PrismaCrmSuppressionStore['upsertBlacklistEntry']> {
    return this.suppressionStore.upsertBlacklistEntry(...args);
  }
  listBlacklistEntries(
    ...args: Parameters<PrismaCrmSuppressionStore['listBlacklistEntries']>
  ): ReturnType<PrismaCrmSuppressionStore['listBlacklistEntries']> {
    return this.suppressionStore.listBlacklistEntries(...args);
  }
  deleteBlacklistEntry(
    ...args: Parameters<PrismaCrmSuppressionStore['deleteBlacklistEntry']>
  ): ReturnType<PrismaCrmSuppressionStore['deleteBlacklistEntry']> {
    return this.suppressionStore.deleteBlacklistEntry(...args);
  }
  findArchivedFingerprints(
    ...args: Parameters<PrismaCrmAccountStore['findArchivedFingerprints']>
  ): ReturnType<PrismaCrmAccountStore['findArchivedFingerprints']> {
    return this.accountStore.findArchivedFingerprints(...args);
  }
  upsertArchivedFingerprint(
    ...args: Parameters<PrismaCrmAccountStore['upsertArchivedFingerprint']>
  ): ReturnType<PrismaCrmAccountStore['upsertArchivedFingerprint']> {
    return this.accountStore.upsertArchivedFingerprint(...args);
  }
  listAccounts(
    ...args: Parameters<PrismaCrmAccountStore['listAccounts']>
  ): ReturnType<PrismaCrmAccountStore['listAccounts']> {
    return this.accountStore.listAccounts(...args);
  }
  getAccountDetail(
    ...args: Parameters<PrismaCrmAccountStore['getAccountDetail']>
  ): ReturnType<PrismaCrmAccountStore['getAccountDetail']> {
    return this.accountStore.getAccountDetail(...args);
  }
  createTimelineEvent(
    ...args: Parameters<PrismaCrmAccountStore['createTimelineEvent']>
  ): ReturnType<PrismaCrmAccountStore['createTimelineEvent']> {
    return this.accountStore.createTimelineEvent(...args);
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

  ingestCustomerReply(
    ...args: Parameters<PrismaCrmInboxStore['ingestCustomerReply']>
  ): ReturnType<PrismaCrmInboxStore['ingestCustomerReply']> {
    return this.inboxStore.ingestCustomerReply(...args);
  }

  listInboxThreads(
    ...args: Parameters<PrismaCrmInboxStore['listInboxThreads']>
  ): ReturnType<PrismaCrmInboxStore['listInboxThreads']> {
    return this.inboxStore.listInboxThreads(...args);
  }

  getInboxThread(
    ...args: Parameters<PrismaCrmInboxStore['getInboxThread']>
  ): ReturnType<PrismaCrmInboxStore['getInboxThread']> {
    return this.inboxStore.getInboxThread(...args);
  }

  saveInboxThreadReplyDraft(
    ...args: Parameters<PrismaCrmInboxStore['saveInboxThreadReplyDraft']>
  ): ReturnType<PrismaCrmInboxStore['saveInboxThreadReplyDraft']> {
    return this.inboxStore.saveInboxThreadReplyDraft(...args);
  }

  updateInboxThreadStatus(
    ...args: Parameters<PrismaCrmInboxStore['updateInboxThreadStatus']>
  ): ReturnType<PrismaCrmInboxStore['updateInboxThreadStatus']> {
    return this.inboxStore.updateInboxThreadStatus(...args);
  }

  syncInboxThreadGmailState(
    ...args: Parameters<PrismaCrmInboxStore['syncInboxThreadGmailState']>
  ): ReturnType<PrismaCrmInboxStore['syncInboxThreadGmailState']> {
    return this.inboxStore.syncInboxThreadGmailState(...args);
  }

  confirmInboxMessageUnsubscribe(
    ...args: Parameters<PrismaCrmInboxStore['confirmInboxMessageUnsubscribe']>
  ): ReturnType<PrismaCrmInboxStore['confirmInboxMessageUnsubscribe']> {
    return this.inboxStore.confirmInboxMessageUnsubscribe(...args);
  }

  replyInboxThread(
    ...args: Parameters<PrismaCrmInboxStore['replyInboxThread']>
  ): ReturnType<PrismaCrmInboxStore['replyInboxThread']> {
    return this.inboxStore.replyInboxThread(...args);
  }
}
