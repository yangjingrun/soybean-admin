import type { CrmAiDraftTaskStore } from './crm-ai-draft-task.types';
import type {
  CrmAccountCreateInput,
  CrmAccountDetailRecord,
  CrmAccountRecord,
  CrmAccountStatus,
  CrmAccountUpdateInput,
  CrmArchiveSlimInput,
  CrmArchiveSlimmingListInput,
  CrmArchivedFingerprintLookupInput,
  CrmArchivedFingerprintRecord,
  CrmArchivedFingerprintUpsertInput,
  CrmBlacklistDeleteInput,
  CrmBlacklistListInput,
  CrmBlacklistRecord,
  CrmBlacklistUpsertInput,
  CrmContactCreateInput,
  CrmContactRecord,
  CrmContactUpdateInput,
  CrmCustomerReplyIngestInput,
  CrmCustomerReplyIngestRecord,
  CrmDispatchedMessageCountInput,
  CrmDraftApprovalInput,
  CrmDraftApprovalRecord,
  CrmDueSendCandidateListInput,
  CrmDueSendCandidateRecord,
  CrmEmailStatus,
  CrmEmailTemplateGroupCreateInput,
  CrmEmailTemplateGroupListInput,
  CrmEmailTemplateGroupRecord,
  CrmEmailTemplateGroupUpdateInput,
  CrmEmailVerificationCacheRecord,
  CrmEmailVerificationCacheUpsertInput,
  CrmFollowUpDraftBundleCreateInput,
  CrmFollowUpDraftBundleRecord,
  CrmGlobalConfigInput,
  CrmGlobalConfigRecord,
  CrmInboxReplyDraftSaveInput,
  CrmInboxThreadDetailRecord,
  CrmInboxThreadGmailStateSyncInput,
  CrmInboxThreadListRecord,
  CrmInboxThreadReplyInput,
  CrmInboxThreadReplyRecord,
  CrmInboxThreadStatus,
  CrmInboxThreadStatusUpdateInput,
  CrmInboxThreadStatusUpdateRecord,
  CrmInboxUnsubscribeConfirmInput,
  CrmInboxUnsubscribeConfirmRecord,
  CrmMailboxAuthorizationExpiredInput,
  CrmMailboxAuthorizationExpiredRecord,
  CrmMailboxCreateInput,
  CrmMailboxHistoryAdvanceInput,
  CrmMailboxProvider,
  CrmMailboxRecord,
  CrmMailboxSendStateBatchInput,
  CrmMailboxSendStateRecord,
  CrmMailboxStatus,
  CrmMailboxUpdateInput,
  CrmMailboxWatchRenewalListInput,
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
  CrmOwnerSendStateRecord,
  CrmPersonaProfileCreateInput,
  CrmPersonaProfileListInput,
  CrmPersonaProfileRecord,
  CrmPersonaProfileUpdateInput,
  CrmProductLineAiPromptVersionCreateInput,
  CrmProductLineAiPromptVersionRecord,
  CrmProductLineAiPromptVersionRestoreInput,
  CrmProductLineAiPromptVersionRestoreRecord,
  CrmProductLineCreateInput,
  CrmProductLineRecord,
  CrmProductLineStatus,
  CrmProductLineUpdateInput,
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
  CrmSequenceDraftBundleCreateInput,
  CrmSequenceDraftBundleRecord,
  CrmSequenceEnrollmentCreateInput,
  CrmSequenceEnrollmentRecord,
  CrmSequenceEnrollmentStatus,
  CrmSequenceEnrollmentUpdateInput,
  CrmSequencePolicyCreateInput,
  CrmSequencePolicyListInput,
  CrmSequencePolicyRecord,
  CrmSequencePolicyUpdateInput,
  CrmSequenceReviewRecord,
  CrmSequenceReviewTodoType,
  CrmSequenceStopInput,
  CrmSequenceStopRecord,
  CrmStrategyStatsRecord,
  CrmTimelineEventCreateInput,
  CrmTimelineEventRecord,
  CrmWorkbenchOverviewRecord
} from './crm.types';

export interface CrmStore extends CrmAiDraftTaskStore {
  findAccountByDomain(organizationId: string, ownerUserId: string, domain: string): Promise<CrmAccountRecord | null>;
  createAccount(input: CrmAccountCreateInput): Promise<CrmAccountRecord>;
  updateAccount(id: string, input: CrmAccountUpdateInput): Promise<CrmAccountRecord | null>;
  listAccountsForArchiveSlimming(input: CrmArchiveSlimmingListInput): Promise<CrmAccountRecord[]>;
  slimArchivedAccount(input: CrmArchiveSlimInput): Promise<CrmAccountRecord | null>;
  findContactByEmailHash(
    organizationId: string,
    ownerUserId: string,
    emailHash: string
  ): Promise<CrmContactRecord | null>;
  createContact(input: CrmContactCreateInput): Promise<CrmContactRecord>;
  updateContact(id: string, input: CrmContactUpdateInput): Promise<CrmContactRecord | null>;
  findContactById(args: { id: string; organizationId: string; ownerUserId?: string }): Promise<CrmContactRecord | null>;
  updateContactEmailStatus(id: string, emailStatus: CrmEmailStatus): Promise<CrmContactRecord | null>;
  findEmailVerificationCache(args: { emailHash: string }): Promise<CrmEmailVerificationCacheRecord | null>;
  upsertEmailVerificationCache(input: CrmEmailVerificationCacheUpsertInput): Promise<CrmEmailVerificationCacheRecord>;
  getGlobalConfig(): Promise<CrmGlobalConfigRecord>;
  saveGlobalConfig(input: CrmGlobalConfigInput): Promise<CrmGlobalConfigRecord>;
  getSendPreference(args: { organizationId: string; ownerUserId: string }): Promise<CrmSendPreferenceRecord | null>;
  saveSendPreference(input: CrmSendPreferenceInput): Promise<CrmSendPreferenceRecord>;
  countOwnerQueuedMessages(args: { organizationId: string; ownerUserId: string }): Promise<number>;
  countDispatchedMessages(input: CrmDispatchedMessageCountInput): Promise<number>;
  listOwnerSendStates(input: CrmOwnerSendStateBatchInput): Promise<CrmOwnerSendStateRecord[]>;
  listMailboxSendStates(input: CrmMailboxSendStateBatchInput): Promise<CrmMailboxSendStateRecord[]>;
  listDueSendCandidates(input: CrmDueSendCandidateListInput): Promise<CrmDueSendCandidateRecord[]>;
  listStaleQueuedMessages(input: { before: Date; take: number }): Promise<CrmMessageRecord[]>;
  getOrganizationConfig(organizationId: string): Promise<CrmOrganizationConfigRecord | null>;
  saveOrganizationConfig(input: CrmOrganizationConfigInput): Promise<CrmOrganizationConfigRecord>;
  findBlacklistEntry(args: { organizationId: string; emailHash: string }): Promise<CrmBlacklistRecord | null>;
  /** Batch loads organization blacklist entries by normalized email hashes. */
  listBlacklistEntriesByEmailHashes(args: {
    organizationId: string;
    emailHashes: string[];
  }): Promise<CrmBlacklistRecord[]>;
  upsertBlacklistEntry(input: CrmBlacklistUpsertInput): Promise<CrmBlacklistRecord>;
  listBlacklistEntries(input: CrmBlacklistListInput): Promise<{ records: CrmBlacklistRecord[]; total: number }>;
  deleteBlacklistEntry(input: CrmBlacklistDeleteInput): Promise<CrmBlacklistRecord | null>;
  findArchivedFingerprints(input: CrmArchivedFingerprintLookupInput): Promise<CrmArchivedFingerprintRecord[]>;
  upsertArchivedFingerprint(input: CrmArchivedFingerprintUpsertInput): Promise<CrmArchivedFingerprintRecord>;
  listAccounts(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmAccountStatus;
    skip: number;
    take: number;
  }): Promise<{ records: CrmAccountRecord[]; total: number }>;
  getAccountDetail(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmAccountDetailRecord | null>;
  createTimelineEvent(input: CrmTimelineEventCreateInput): Promise<CrmTimelineEventRecord>;
  findMailboxByProviderAndEmailHash(provider: CrmMailboxProvider, emailHash: string): Promise<CrmMailboxRecord | null>;
  createMailbox(input: CrmMailboxCreateInput): Promise<CrmMailboxRecord>;
  listMailboxes(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmMailboxStatus;
    skip: number;
    take: number;
  }): Promise<{ records: CrmMailboxRecord[]; total: number }>;
  findMailboxById(args: { id: string; organizationId: string; ownerUserId?: string }): Promise<CrmMailboxRecord | null>;
  updateMailbox(id: string, input: CrmMailboxUpdateInput): Promise<CrmMailboxRecord | null>;
  listMailboxesForWatchRenewal(input: CrmMailboxWatchRenewalListInput): Promise<CrmMailboxRecord[]>;
  listProductLines(args: {
    organizationId: string;
    keyword?: string;
    status?: CrmProductLineStatus;
    skip: number;
    take: number;
  }): Promise<{ records: CrmProductLineRecord[]; total: number }>;
  findProductLineByName(organizationId: string, name: string): Promise<CrmProductLineRecord | null>;
  findProductLineById(args: { id: string; organizationId: string }): Promise<CrmProductLineRecord | null>;
  createProductLine(input: CrmProductLineCreateInput): Promise<CrmProductLineRecord>;
  updateProductLine(
    id: string,
    organizationId: string,
    input: CrmProductLineUpdateInput
  ): Promise<CrmProductLineRecord | null>;
  createProductLineAiPromptVersion(
    input: CrmProductLineAiPromptVersionCreateInput
  ): Promise<CrmProductLineAiPromptVersionRecord>;
  listProductLineAiPromptVersions(args: {
    organizationId: string;
    productLineId: string;
  }): Promise<CrmProductLineAiPromptVersionRecord[]>;
  restoreProductLineAiPromptVersion(
    input: CrmProductLineAiPromptVersionRestoreInput
  ): Promise<CrmProductLineAiPromptVersionRestoreRecord | null>;
  listPersonaProfiles(
    input: CrmPersonaProfileListInput
  ): Promise<{ records: CrmPersonaProfileRecord[]; total: number }>;
  listActivePersonaProfiles(organizationId: string): Promise<CrmPersonaProfileRecord[]>;
  findPersonaProfileByName(organizationId: string, name: string): Promise<CrmPersonaProfileRecord | null>;
  findPersonaProfileById(args: { id: string; organizationId: string }): Promise<CrmPersonaProfileRecord | null>;
  createPersonaProfile(input: CrmPersonaProfileCreateInput): Promise<CrmPersonaProfileRecord>;
  updatePersonaProfile(
    id: string,
    organizationId: string,
    input: CrmPersonaProfileUpdateInput
  ): Promise<CrmPersonaProfileRecord | null>;
  setDefaultPersonaProfile(id: string, organizationId: string): Promise<CrmPersonaProfileRecord | null>;
  listEmailTemplateGroups(
    input: CrmEmailTemplateGroupListInput
  ): Promise<{ records: CrmEmailTemplateGroupRecord[]; total: number }>;
  findEmailTemplateGroupByName(organizationId: string, name: string): Promise<CrmEmailTemplateGroupRecord | null>;
  findEmailTemplateGroupById(args: { id: string; organizationId: string }): Promise<CrmEmailTemplateGroupRecord | null>;
  findDefaultEmailTemplateGroup(organizationId: string): Promise<CrmEmailTemplateGroupRecord | null>;
  createEmailTemplateGroup(input: CrmEmailTemplateGroupCreateInput): Promise<CrmEmailTemplateGroupRecord>;
  updateEmailTemplateGroup(
    id: string,
    organizationId: string,
    input: CrmEmailTemplateGroupUpdateInput
  ): Promise<CrmEmailTemplateGroupRecord | null>;
  setDefaultEmailTemplateGroup(id: string, organizationId: string): Promise<CrmEmailTemplateGroupRecord | null>;
  listSequencePolicies(
    input: CrmSequencePolicyListInput
  ): Promise<{ records: CrmSequencePolicyRecord[]; total: number }>;
  findSequencePolicyByName(organizationId: string, name: string): Promise<CrmSequencePolicyRecord | null>;
  findSequencePolicyById(args: { id: string; organizationId: string }): Promise<CrmSequencePolicyRecord | null>;
  findDefaultSequencePolicy(organizationId: string): Promise<CrmSequencePolicyRecord | null>;
  createSequencePolicy(input: CrmSequencePolicyCreateInput): Promise<CrmSequencePolicyRecord>;
  updateSequencePolicy(
    id: string,
    organizationId: string,
    input: CrmSequencePolicyUpdateInput
  ): Promise<CrmSequencePolicyRecord | null>;
  setDefaultSequencePolicy(id: string, organizationId: string): Promise<CrmSequencePolicyRecord | null>;
  findActiveEnrollmentByContact(args: {
    organizationId: string;
    ownerUserId: string;
    contactId: string;
    statuses: CrmSequenceEnrollmentStatus[];
  }): Promise<CrmSequenceEnrollmentRecord | null>;
  findActiveEnrollmentByAccount(args: {
    organizationId: string;
    ownerUserId: string;
    accountId: string;
    statuses: CrmSequenceEnrollmentStatus[];
  }): Promise<CrmSequenceEnrollmentRecord | null>;
  createSequenceEnrollment(input: CrmSequenceEnrollmentCreateInput): Promise<CrmSequenceEnrollmentRecord>;
  createSequenceDraftBundle(input: CrmSequenceDraftBundleCreateInput): Promise<CrmSequenceDraftBundleRecord>;
  createFollowUpDraftBundle(input: CrmFollowUpDraftBundleCreateInput): Promise<CrmFollowUpDraftBundleRecord | null>;
  listSequenceReviewItems(args: {
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
  }): Promise<{ records: CrmSequenceReviewRecord[]; total: number }>;
  listStrategyStats(args: { organizationId: string; ownerUserId?: string }): Promise<CrmStrategyStatsRecord>;
  getWorkbenchOverview(args: {
    organizationId: string;
    ownerUserId: string;
    now: Date;
  }): Promise<CrmWorkbenchOverviewRecord>;
  getSequenceReviewItem(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmSequenceReviewRecord | null>;
  /** Batch loads sequence review records by ids inside one organization and optional owner scope. */
  listSequenceReviewItemsByIds(args: {
    ids: string[];
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmSequenceReviewRecord[]>;
  updateSequenceEnrollment(
    id: string,
    organizationId: string,
    input: CrmSequenceEnrollmentUpdateInput
  ): Promise<CrmSequenceEnrollmentRecord | null>;
  createMessage(input: CrmMessageCreateInput): Promise<CrmMessageRecord>;
  findMessageById(args: { id: string; organizationId: string; ownerUserId?: string }): Promise<CrmMessageRecord | null>;
  findSentMessageByProviderId(args: {
    organizationId: string;
    ownerUserId: string;
    mailboxId: string | null;
    providerMessageId: string;
  }): Promise<CrmMessageRecord | null>;
  findSentMessageByProviderThreadId(args: {
    organizationId: string;
    ownerUserId: string;
    mailboxId: string | null;
    providerThreadId: string;
  }): Promise<CrmMessageRecord | null>;
  updateMessage(
    id: string,
    organizationId: string,
    input: CrmMessageUpdateInput,
    guard?: CrmMessageDraftUpdateGuard
  ): Promise<CrmMessageRecord | null>;
  createMessageDraftVersion(input: CrmMessageDraftVersionCreateInput): Promise<CrmMessageDraftVersionRecord>;
  listMessageDraftVersions(args: {
    messageId: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmMessageDraftVersionRecord[]>;
  restoreMessageDraftVersion(input: CrmMessageDraftVersionRestoreInput): Promise<CrmMessageRecord | null>;
  approveMessageDraft(input: CrmDraftApprovalInput): Promise<CrmDraftApprovalRecord | null>;
  startFirstMessageSend(input: CrmSendStartInput): Promise<CrmSendStartRecord | null>;
  claimFirstMessageSendDelivery(input: CrmSendDeliveryClaimInput): Promise<CrmSendDeliveryClaimRecord | null>;
  stopSequenceEnrollment(input: CrmSequenceStopInput): Promise<CrmSequenceStopRecord | null>;
  completeFirstMessageSend(input: CrmSendCompletionInput): Promise<CrmSendCompletionRecord | null>;
  failFirstMessageSend(input: CrmSendFailureInput): Promise<CrmSendFailureRecord | null>;
  markMailboxAuthorizationExpired(
    input: CrmMailboxAuthorizationExpiredInput
  ): Promise<CrmMailboxAuthorizationExpiredRecord | null>;
  advanceMailboxHistoryId(input: CrmMailboxHistoryAdvanceInput): Promise<CrmMailboxRecord | null>;
  ingestCustomerReply(input: CrmCustomerReplyIngestInput): Promise<CrmCustomerReplyIngestRecord | null>;
  listInboxThreads(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmInboxThreadStatus;
    mailboxId?: string;
    skip: number;
    take: number;
  }): Promise<{ records: CrmInboxThreadListRecord[]; total: number }>;
  getInboxThread(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmInboxThreadDetailRecord | null>;
  updateInboxThreadStatus(input: CrmInboxThreadStatusUpdateInput): Promise<CrmInboxThreadStatusUpdateRecord | null>;
  syncInboxThreadGmailState(input: CrmInboxThreadGmailStateSyncInput): Promise<CrmInboxThreadStatusUpdateRecord | null>;
  confirmInboxMessageUnsubscribe(
    input: CrmInboxUnsubscribeConfirmInput
  ): Promise<CrmInboxUnsubscribeConfirmRecord | null>;
  saveInboxThreadReplyDraft(input: CrmInboxReplyDraftSaveInput): Promise<CrmInboxThreadDetailRecord | null>;
  replyInboxThread(input: CrmInboxThreadReplyInput): Promise<CrmInboxThreadReplyRecord | null>;
}
