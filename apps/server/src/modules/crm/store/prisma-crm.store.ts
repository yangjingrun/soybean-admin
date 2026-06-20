import { Inject, Injectable } from '@nestjs/common';
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
  toAccountListWhere,
  toMailboxListWhere,
  toProductLineListWhere,
  toPersonaProfileListWhere,
  toEmailTemplateGroupListWhere,
  toSequencePolicyListWhere,
  toBlacklistListWhere,
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
import { PrismaCrmSequenceStore } from './prisma-crm-sequence.store';
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
  CrmMessageDraftVersionRecord,
  CrmMessageRecord,
  CrmOrganizationConfigInput,
  CrmOrganizationConfigRecord,
  CrmPersonaProfileCreateInput,
  CrmPersonaProfileListInput,
  CrmPersonaProfileRecord,
  CrmPersonaProfileUpdateInput,
  CrmSequenceEnrollmentRecord,
  CrmSequencePolicyCreateInput,
  CrmSequencePolicyListInput,
  CrmSequencePolicyRecord,
  CrmSequencePolicyUpdateInput,
  CrmSequenceReviewRecord,
  CrmSendPreferenceInput,
  CrmSendPreferenceRecord,
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
  private readonly sequenceStore: PrismaCrmSequenceStore;
  private readonly settingsStore: PrismaCrmSettingsStore;
  private readonly suppressionStore: PrismaCrmSuppressionStore;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    this.accountStore = new PrismaCrmAccountStore(prisma);
    this.aiDraftTaskStore = new PrismaCrmAiDraftTaskStore(prisma);
    this.dashboardStore = new PrismaCrmDashboardStore(prisma);
    this.inboxStore = new PrismaCrmInboxStore(prisma);
    this.mailboxStore = new PrismaCrmMailboxStore(prisma);
    this.sendScheduleStore = new PrismaCrmSendScheduleStore(prisma);
    this.sequenceStore = new PrismaCrmSequenceStore(prisma);
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

  findActiveEnrollmentByContact(
    ...args: Parameters<PrismaCrmSequenceStore['findActiveEnrollmentByContact']>
  ): ReturnType<PrismaCrmSequenceStore['findActiveEnrollmentByContact']> {
    return this.sequenceStore.findActiveEnrollmentByContact(...args);
  }

  findActiveEnrollmentByAccount(
    ...args: Parameters<PrismaCrmSequenceStore['findActiveEnrollmentByAccount']>
  ): ReturnType<PrismaCrmSequenceStore['findActiveEnrollmentByAccount']> {
    return this.sequenceStore.findActiveEnrollmentByAccount(...args);
  }

  createSequenceEnrollment(
    ...args: Parameters<PrismaCrmSequenceStore['createSequenceEnrollment']>
  ): ReturnType<PrismaCrmSequenceStore['createSequenceEnrollment']> {
    return this.sequenceStore.createSequenceEnrollment(...args);
  }

  createSequenceDraftBundle(
    ...args: Parameters<PrismaCrmSequenceStore['createSequenceDraftBundle']>
  ): ReturnType<PrismaCrmSequenceStore['createSequenceDraftBundle']> {
    return this.sequenceStore.createSequenceDraftBundle(...args);
  }

  createFollowUpDraftBundle(
    ...args: Parameters<PrismaCrmSequenceStore['createFollowUpDraftBundle']>
  ): ReturnType<PrismaCrmSequenceStore['createFollowUpDraftBundle']> {
    return this.sequenceStore.createFollowUpDraftBundle(...args);
  }

  listSequenceReviewItems(
    ...args: Parameters<PrismaCrmSequenceStore['listSequenceReviewItems']>
  ): ReturnType<PrismaCrmSequenceStore['listSequenceReviewItems']> {
    return this.sequenceStore.listSequenceReviewItems(...args);
  }

  getSequenceReviewItem(
    ...args: Parameters<PrismaCrmSequenceStore['getSequenceReviewItem']>
  ): ReturnType<PrismaCrmSequenceStore['getSequenceReviewItem']> {
    return this.sequenceStore.getSequenceReviewItem(...args);
  }

  listSequenceReviewItemsByIds(
    ...args: Parameters<PrismaCrmSequenceStore['listSequenceReviewItemsByIds']>
  ): ReturnType<PrismaCrmSequenceStore['listSequenceReviewItemsByIds']> {
    return this.sequenceStore.listSequenceReviewItemsByIds(...args);
  }

  updateSequenceEnrollment(
    ...args: Parameters<PrismaCrmSequenceStore['updateSequenceEnrollment']>
  ): ReturnType<PrismaCrmSequenceStore['updateSequenceEnrollment']> {
    return this.sequenceStore.updateSequenceEnrollment(...args);
  }

  createMessage(
    ...args: Parameters<PrismaCrmSequenceStore['createMessage']>
  ): ReturnType<PrismaCrmSequenceStore['createMessage']> {
    return this.sequenceStore.createMessage(...args);
  }

  findMessageById(
    ...args: Parameters<PrismaCrmSequenceStore['findMessageById']>
  ): ReturnType<PrismaCrmSequenceStore['findMessageById']> {
    return this.sequenceStore.findMessageById(...args);
  }

  findSentMessageByProviderId(
    ...args: Parameters<PrismaCrmSequenceStore['findSentMessageByProviderId']>
  ): ReturnType<PrismaCrmSequenceStore['findSentMessageByProviderId']> {
    return this.sequenceStore.findSentMessageByProviderId(...args);
  }

  findSentMessageByProviderThreadId(
    ...args: Parameters<PrismaCrmSequenceStore['findSentMessageByProviderThreadId']>
  ): ReturnType<PrismaCrmSequenceStore['findSentMessageByProviderThreadId']> {
    return this.sequenceStore.findSentMessageByProviderThreadId(...args);
  }

  updateMessage(
    ...args: Parameters<PrismaCrmSequenceStore['updateMessage']>
  ): ReturnType<PrismaCrmSequenceStore['updateMessage']> {
    return this.sequenceStore.updateMessage(...args);
  }

  createMessageDraftVersion(
    ...args: Parameters<PrismaCrmSequenceStore['createMessageDraftVersion']>
  ): ReturnType<PrismaCrmSequenceStore['createMessageDraftVersion']> {
    return this.sequenceStore.createMessageDraftVersion(...args);
  }

  listMessageDraftVersions(
    ...args: Parameters<PrismaCrmSequenceStore['listMessageDraftVersions']>
  ): ReturnType<PrismaCrmSequenceStore['listMessageDraftVersions']> {
    return this.sequenceStore.listMessageDraftVersions(...args);
  }

  restoreMessageDraftVersion(
    ...args: Parameters<PrismaCrmSequenceStore['restoreMessageDraftVersion']>
  ): ReturnType<PrismaCrmSequenceStore['restoreMessageDraftVersion']> {
    return this.sequenceStore.restoreMessageDraftVersion(...args);
  }

  approveMessageDraft(
    ...args: Parameters<PrismaCrmSequenceStore['approveMessageDraft']>
  ): ReturnType<PrismaCrmSequenceStore['approveMessageDraft']> {
    return this.sequenceStore.approveMessageDraft(...args);
  }

  startFirstMessageSend(
    ...args: Parameters<PrismaCrmSequenceStore['startFirstMessageSend']>
  ): ReturnType<PrismaCrmSequenceStore['startFirstMessageSend']> {
    return this.sequenceStore.startFirstMessageSend(...args);
  }

  claimFirstMessageSendDelivery(
    ...args: Parameters<PrismaCrmSequenceStore['claimFirstMessageSendDelivery']>
  ): ReturnType<PrismaCrmSequenceStore['claimFirstMessageSendDelivery']> {
    return this.sequenceStore.claimFirstMessageSendDelivery(...args);
  }

  stopSequenceEnrollment(
    ...args: Parameters<PrismaCrmSequenceStore['stopSequenceEnrollment']>
  ): ReturnType<PrismaCrmSequenceStore['stopSequenceEnrollment']> {
    return this.sequenceStore.stopSequenceEnrollment(...args);
  }

  completeFirstMessageSend(
    ...args: Parameters<PrismaCrmSequenceStore['completeFirstMessageSend']>
  ): ReturnType<PrismaCrmSequenceStore['completeFirstMessageSend']> {
    return this.sequenceStore.completeFirstMessageSend(...args);
  }

  failFirstMessageSend(
    ...args: Parameters<PrismaCrmSequenceStore['failFirstMessageSend']>
  ): ReturnType<PrismaCrmSequenceStore['failFirstMessageSend']> {
    return this.sequenceStore.failFirstMessageSend(...args);
  }

  listStrategyStats(
    ...args: Parameters<PrismaCrmDashboardStore['listStrategyStats']>
  ): ReturnType<PrismaCrmDashboardStore['listStrategyStats']> {
    return this.dashboardStore.listStrategyStats(...args);
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
