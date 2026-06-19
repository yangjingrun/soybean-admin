import type { CrmFollowUpDelayDays } from './crm-global-config';

export type OrganizationRole = 'member' | 'admin';

export const crmAccountStatuses = [
  'candidate',
  'missing_contact',
  'email_verification_pending',
  'manual_review_pending',
  'ready',
  'sequence_running',
  'replied_pending',
  'followed_up',
  'opportunity',
  'customer',
  'invalid',
  'paused',
  'blocked',
  'archived'
] as const;

export type CrmAccountStatus = (typeof crmAccountStatuses)[number];

export type CrmEmailStatus = 'unchecked' | 'valid' | 'invalid' | 'risky' | 'unreachable' | 'unsubscribed';
export type CrmEmailVerificationReason =
  | 'mx_found'
  | 'invalid_format'
  | 'no_mx'
  | 'dns_temporary_failure'
  | 'public_email';

export const crmMailboxStatuses = ['active', 'paused', 'auth_expired'] as const;
export const crmMailboxWarmupStages = ['new', 'warming', 'ready'] as const;
export const crmProductLineStatuses = ['active', 'archived'] as const;
export const crmSequenceEnrollmentStatuses = [
  'draft_review_pending',
  'ready_to_send',
  'sequence_running',
  'paused',
  'stopped',
  'replied',
  'archived'
] as const;
export const crmMessageStatuses = ['draft_pending_review', 'draft_ready', 'queued', 'sent', 'failed', 'skipped'] as const;
export const crmMessageThreadModes = ['new_subject', 'same_thread'] as const;
export const crmInboxThreadStatuses = ['pending', 'handled', 'archived'] as const;
export const crmInboxMessageTypes = ['customer_reply', 'bounce', 'unsubscribe_hint'] as const;

export type CrmMailboxProvider = 'gmail';
export type CrmArchivedFingerprintType = 'domain' | 'email_hash';
export type CrmMailboxStatus = (typeof crmMailboxStatuses)[number];
export type CrmMailboxWarmupStage = (typeof crmMailboxWarmupStages)[number];
export type CrmProductLineStatus = (typeof crmProductLineStatuses)[number];
export type CrmSequenceEnrollmentStatus = (typeof crmSequenceEnrollmentStatuses)[number];
export type CrmMessageStatus = (typeof crmMessageStatuses)[number];
export type CrmMessageThreadMode = (typeof crmMessageThreadModes)[number];
export type CrmInboxThreadStatus = (typeof crmInboxThreadStatuses)[number];
export type CrmInboxMessageType = (typeof crmInboxMessageTypes)[number];

export interface CrmUserContext {
  userId: string;
  userName: string;
  roles: string[];
  organizationId: string;
  organizationRole: OrganizationRole;
}

export interface ImportCrmLeadInput {
  name: string;
  websiteUrl?: string | null;
  country?: string | null;
  customerType?: string | null;
  sourceTaskId?: string | null;
  contact?: {
    fullName?: string | null;
    title?: string | null;
    email?: string | null;
  } | null;
}

export interface CrmAccountRecord {
  id: string;
  organizationId: string;
  ownerUserId: string;
  name: string;
  normalizedName: string;
  websiteUrl: string | null;
  domain: string | null;
  country: string | null;
  customerType: string | null;
  status: CrmAccountStatus;
  sourceTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmContactRecord {
  id: string;
  organizationId: string;
  accountId: string;
  ownerUserId: string;
  fullName: string | null;
  title: string | null;
  email: string;
  emailHash: string;
  maskedEmail: string;
  isPublicEmail: boolean;
  emailStatus: CrmEmailStatus;
  sourceTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmEmailVerificationCacheRecord {
  id: string;
  emailHash: string;
  maskedEmail: string;
  domain: string | null;
  status: CrmEmailStatus;
  reason: CrmEmailVerificationReason;
  verifiedAt: Date;
  expiresAt: Date;
  checkedById: string | null;
  checkedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmEmailVerificationCacheUpsertInput {
  emailHash: string;
  maskedEmail: string;
  domain: string | null;
  status: CrmEmailStatus;
  reason: CrmEmailVerificationReason;
  verifiedAt: Date;
  expiresAt: Date;
  checkedById: string;
  checkedByName: string | null;
}

export interface CrmGlobalConfigRecord {
  configKey: string;
  emailVerificationCooldownDays: number;
  followUpDelayDays: CrmFollowUpDelayDays;
  updatedAt: Date;
}

export interface CrmGlobalConfigInput {
  emailVerificationCooldownDays: number;
  followUpDelayDays?: CrmFollowUpDelayDays;
  updatedById?: string | null;
  updatedByName?: string | null;
}

export interface CrmBlacklistRecord {
  id: string;
  organizationId: string;
  emailHash: string;
  maskedEmail: string;
  reason: 'unsubscribe';
  sourceAccountId: string | null;
  sourceContactId: string | null;
  sourceMessageId: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmBlacklistUpsertInput {
  organizationId: string;
  emailHash: string;
  maskedEmail: string;
  reason: 'unsubscribe';
  sourceAccountId?: string | null;
  sourceContactId?: string | null;
  sourceMessageId?: string | null;
  createdById?: string | null;
  createdByName?: string | null;
}

export interface CrmBlacklistListInput {
  organizationId: string;
  keyword?: string;
  skip: number;
  take: number;
}

export interface CrmArchivedFingerprintRecord {
  id: string;
  organizationId: string;
  fingerprintType: CrmArchivedFingerprintType;
  fingerprintValue: string;
  maskedValue: string | null;
  accountName: string | null;
  normalizedName: string | null;
  country: string | null;
  sourceAccountId: string | null;
  sourceContactId: string | null;
  sourceTaskId: string | null;
  archiveReason: string | null;
  archivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmArchivedFingerprintLookupInput {
  organizationId: string;
  fingerprints: Array<{
    fingerprintType: CrmArchivedFingerprintType;
    fingerprintValue: string;
  }>;
}

export interface CrmArchivedFingerprintUpsertInput {
  organizationId: string;
  fingerprintType: CrmArchivedFingerprintType;
  fingerprintValue: string;
  maskedValue?: string | null;
  accountName?: string | null;
  normalizedName?: string | null;
  country?: string | null;
  sourceAccountId?: string | null;
  sourceContactId?: string | null;
  sourceTaskId?: string | null;
  archiveReason?: string | null;
  archivedAt: Date;
}

export interface CrmTimelineEventRecord {
  id: string;
  organizationId: string;
  accountId: string;
  contactId: string | null;
  ownerUserId: string;
  eventType: string;
  title: string;
  content: string | null;
  metadata: unknown;
  createdAt: Date;
}

export interface CrmMailboxRecord {
  id: string;
  organizationId: string;
  ownerUserId: string;
  ownerUserName: string | null;
  provider: CrmMailboxProvider;
  emailAddress: string;
  emailHash: string;
  maskedEmail: string;
  status: CrmMailboxStatus;
  dailyLimit: number;
  hourlyLimit: number;
  warmupStage: CrmMailboxWarmupStage;
  encryptedRefreshToken: string | null;
  watchExpiration: Date | null;
  lastHistoryId: string | null;
  authorizedAt: Date;
  pausedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmProductLineRecord {
  id: string;
  organizationId: string;
  name: string;
  targetCustomerType: string | null;
  coreSellingPoints: string | null;
  moq: string | null;
  leadTime: string | null;
  paymentTerms: string | null;
  certifications: string | null;
  catalogUrl: string | null;
  websiteUrl: string | null;
  commonModelsText: string | null;
  status: CrmProductLineStatus;
  createdById: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmSequenceEnrollmentRecord {
  id: string;
  organizationId: string;
  ownerUserId: string;
  accountId: string;
  contactId: string;
  productLineId: string | null;
  mailboxId: string | null;
  name: string;
  status: CrmSequenceEnrollmentStatus;
  currentStep: number;
  totalSteps: number;
  runVersion: number;
  createdById: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmMessageRecord {
  id: string;
  organizationId: string;
  ownerUserId: string;
  accountId: string;
  contactId: string;
  enrollmentId: string;
  mailboxId: string | null;
  stepIndex: number;
  threadMode: CrmMessageThreadMode;
  subject: string;
  bodyText: string;
  status: CrmMessageStatus;
  scheduledAt: Date | null;
  sentAt: Date | null;
  bullJobId: string | null;
  providerMessageId: string | null;
  providerThreadId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmInboxThreadRecord {
  id: string;
  organizationId: string;
  ownerUserId: string;
  accountId: string;
  contactId: string;
  enrollmentId: string | null;
  mailboxId: string | null;
  provider: CrmMailboxProvider;
  providerThreadId: string | null;
  subject: string;
  status: CrmInboxThreadStatus;
  lastInboundAt: Date;
  unreadCount: number;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmInboxMessageRecord {
  id: string;
  threadId: string;
  organizationId: string;
  ownerUserId: string;
  accountId: string;
  contactId: string;
  enrollmentId: string | null;
  mailboxId: string | null;
  provider: CrmMailboxProvider;
  providerMessageId: string | null;
  replyToMessageId: string | null;
  fromEmail: string;
  fromEmailHash: string;
  maskedFromEmail: string;
  subject: string;
  snippet: string | null;
  bodyText: string;
  receivedAt: Date;
  messageType: CrmInboxMessageType;
  createdAt: Date;
}

export interface CrmSequenceReviewRecord {
  enrollment: CrmSequenceEnrollmentRecord;
  account: CrmAccountRecord;
  contact: CrmContactRecord;
  productLine: CrmProductLineRecord | null;
  mailbox: CrmMailboxRecord | null;
  firstMessage: CrmMessageRecord | null;
  messages: CrmMessageRecord[];
}

export interface CrmInboxThreadListRecord {
  thread: CrmInboxThreadRecord;
  account: CrmAccountRecord;
  contact: CrmContactRecord;
  mailbox: CrmMailboxRecord | null;
  enrollment: CrmSequenceEnrollmentRecord | null;
  lastMessage: CrmInboxMessageRecord | null;
}

export interface CrmInboxThreadDetailRecord extends CrmInboxThreadListRecord {
  messages: CrmInboxMessageRecord[];
  timelineEvents: CrmTimelineEventRecord[];
}

export interface CrmAccountDetailRecord {
  account: CrmAccountRecord;
  contacts: CrmContactRecord[];
  timelineEvents: CrmTimelineEventRecord[];
}

export interface CrmAccountCreateInput {
  organizationId: string;
  ownerUserId: string;
  name: string;
  normalizedName: string;
  websiteUrl?: string | null;
  domain?: string | null;
  country?: string | null;
  customerType?: string | null;
  status: CrmAccountStatus;
  sourceTaskId?: string | null;
}

export interface CrmAccountUpdateInput {
  name?: string;
  normalizedName?: string;
  websiteUrl?: string | null;
  domain?: string | null;
  country?: string | null;
  customerType?: string | null;
  status?: CrmAccountStatus;
  sourceTaskId?: string | null;
}

export interface CrmContactCreateInput {
  organizationId: string;
  accountId: string;
  ownerUserId: string;
  fullName?: string | null;
  title?: string | null;
  email: string;
  emailHash: string;
  maskedEmail: string;
  isPublicEmail: boolean;
  emailStatus: CrmEmailStatus;
  sourceTaskId?: string | null;
}

export interface CrmContactUpdateInput {
  accountId?: string;
  fullName?: string | null;
  title?: string | null;
  sourceTaskId?: string | null;
}

export interface CrmTimelineEventCreateInput {
  organizationId: string;
  accountId: string;
  contactId?: string | null;
  ownerUserId: string;
  eventType: string;
  title: string;
  content?: string | null;
  metadata?: unknown;
}

export interface CrmMailboxCreateInput {
  organizationId: string;
  ownerUserId: string;
  ownerUserName?: string | null;
  provider: CrmMailboxProvider;
  emailAddress: string;
  emailHash: string;
  maskedEmail: string;
  status: CrmMailboxStatus;
  dailyLimit: number;
  hourlyLimit: number;
  warmupStage: CrmMailboxWarmupStage;
  encryptedRefreshToken?: string | null;
  watchExpiration?: Date | null;
  lastHistoryId?: string | null;
  authorizedAt: Date;
  pausedAt?: Date | null;
}

export interface CrmMailboxUpdateInput {
  status?: CrmMailboxStatus;
  dailyLimit?: number;
  hourlyLimit?: number;
  warmupStage?: CrmMailboxWarmupStage;
  encryptedRefreshToken?: string | null;
  watchExpiration?: Date | null;
  lastHistoryId?: string | null;
  authorizedAt?: Date;
  pausedAt?: Date | null;
}

export interface CrmMailboxWatchRenewalListInput {
  provider: CrmMailboxProvider;
  renewBefore: Date;
  take: number;
}

export interface CrmProductLineCreateInput {
  organizationId: string;
  name: string;
  targetCustomerType?: string | null;
  coreSellingPoints?: string | null;
  moq?: string | null;
  leadTime?: string | null;
  paymentTerms?: string | null;
  certifications?: string | null;
  catalogUrl?: string | null;
  websiteUrl?: string | null;
  commonModelsText?: string | null;
  status: CrmProductLineStatus;
  createdById: string;
  createdByName?: string | null;
}

export interface CrmProductLineUpdateInput {
  name?: string;
  targetCustomerType?: string | null;
  coreSellingPoints?: string | null;
  moq?: string | null;
  leadTime?: string | null;
  paymentTerms?: string | null;
  certifications?: string | null;
  catalogUrl?: string | null;
  websiteUrl?: string | null;
  commonModelsText?: string | null;
  status?: CrmProductLineStatus;
}

export interface CrmSequenceEnrollmentCreateInput {
  organizationId: string;
  ownerUserId: string;
  accountId: string;
  contactId: string;
  productLineId?: string | null;
  mailboxId?: string | null;
  name: string;
  status: CrmSequenceEnrollmentStatus;
  currentStep: number;
  totalSteps: number;
  runVersion: number;
  createdById: string;
  createdByName?: string | null;
}

export interface CrmSequenceEnrollmentUpdateInput {
  productLineId?: string | null;
  mailboxId?: string | null;
  name?: string;
  status?: CrmSequenceEnrollmentStatus;
  currentStep?: number;
  totalSteps?: number;
  runVersion?: number;
}

export interface CrmMessageCreateInput {
  organizationId: string;
  ownerUserId: string;
  accountId: string;
  contactId: string;
  enrollmentId: string;
  mailboxId?: string | null;
  stepIndex: number;
  threadMode: CrmMessageThreadMode;
  subject: string;
  bodyText: string;
  status: CrmMessageStatus;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
  bullJobId?: string | null;
  providerMessageId?: string | null;
  providerThreadId?: string | null;
}

export interface CrmMessageUpdateInput {
  mailboxId?: string | null;
  threadMode?: CrmMessageThreadMode;
  subject?: string;
  bodyText?: string;
  status?: CrmMessageStatus;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
  bullJobId?: string | null;
  providerMessageId?: string | null;
  providerThreadId?: string | null;
}

export interface CrmSequenceDraftBundleCreateInput {
  enrollment: CrmSequenceEnrollmentCreateInput;
  message: Omit<CrmMessageCreateInput, 'enrollmentId'>;
  timelineEvent: Omit<CrmTimelineEventCreateInput, 'metadata'> & {
    metadata: {
      productLineId: string | null;
      mailboxId: string | null;
    };
  };
  accountStatus: CrmAccountStatus;
}

export interface CrmSequenceDraftBundleRecord {
  enrollment: CrmSequenceEnrollmentRecord;
  message: CrmMessageRecord;
  account: CrmAccountRecord;
  event: CrmTimelineEventRecord;
}

export interface CrmMessageDraftUpdateGuard {
  status: CrmMessageStatus;
}

export interface CrmDraftApprovalInput {
  messageId: string;
  enrollmentId: string;
  organizationId: string;
  ownerUserId: string;
  accountId: string;
  contactId: string;
  fromEnrollmentStatus: CrmSequenceEnrollmentStatus;
  toEnrollmentStatus: CrmSequenceEnrollmentStatus;
  fromMessageStatus: CrmMessageStatus;
  toMessageStatus: CrmMessageStatus;
  accountStatus: CrmAccountStatus;
}

export interface CrmDraftApprovalRecord {
  enrollment: CrmSequenceEnrollmentRecord;
  message: CrmMessageRecord;
  account: CrmAccountRecord;
  event: CrmTimelineEventRecord;
}

export interface CrmSendQueueJob {
  enrollmentId: string;
  messageId: string;
  organizationId: string;
  ownerUserId: string;
  runVersion: number;
}

export interface CrmSendQueuePort {
  enqueueFirstMessage(input: CrmSendQueueJob, options?: { delayMs?: number }): Promise<{ jobId: string }>;
}

export interface CrmGmailHistorySyncQueueJob {
  mailboxId: string;
  organizationId: string;
  ownerUserId: string;
  emailAddress: string;
  emailHash: string;
  historyId: string;
  pubsubMessageId?: string | null;
  publishTime?: string | null;
}

export interface CrmGmailHistorySyncQueuePort {
  enqueueHistorySync(input: CrmGmailHistorySyncQueueJob): Promise<{ jobId: string }>;
}

export interface CrmGmailHistoryListInput {
  mailbox: CrmMailboxRecord;
  startHistoryId: string | null;
  targetHistoryId: string;
}

export interface CrmGmailHistoryMessage {
  providerMessageId: string;
  providerThreadId: string | null;
  replyToProviderMessageId: string | null;
  subject: string;
  bodyText: string;
  receivedAt: Date;
  messageType?: CrmInboxMessageType;
}

export interface CrmGmailHistoryListResult {
  nextHistoryId: string;
  messages: CrmGmailHistoryMessage[];
}

export interface CrmGmailHistoryGateway {
  listHistory(input: CrmGmailHistoryListInput): Promise<CrmGmailHistoryListResult>;
}

export interface CrmMailboxHistoryAdvanceInput {
  mailboxId: string;
  organizationId: string;
  ownerUserId: string;
  fromHistoryId: string | null;
  toHistoryId: string;
}

export interface CrmGmailHistorySyncResult {
  status: 'synced' | 'skipped';
  reason?:
    | 'mailbox_not_found'
    | 'mailbox_not_active'
    | 'stale_history'
    | 'checkpoint_conflict'
    | 'authorization_expired'
    | 'history_expired';
  mailboxId: string;
  fromHistoryId: string | null;
  toHistoryId: string;
  ingestedCount: number;
  skippedMessageCount: number;
}

export interface CrmGmailPubSubPushResult {
  queued: boolean;
  reason?: 'mailbox_not_found' | 'mailbox_not_active';
  mailboxId?: string;
  historyId: string;
  pubsubMessageId: string | null;
  jobId?: string;
}

export interface CrmEmailSendGatewayInput {
  enrollment: CrmSequenceEnrollmentRecord;
  message: CrmMessageRecord;
  account: CrmAccountRecord;
  contact: CrmContactRecord;
  mailbox: CrmMailboxRecord;
}

export interface CrmInboxReplySendGatewayInput {
  thread: CrmInboxThreadRecord;
  account: CrmAccountRecord;
  contact: CrmContactRecord;
  mailbox: CrmMailboxRecord;
  subject: string;
  bodyText: string;
}

export interface CrmEmailSendGatewayResult {
  providerMessageId?: string | null;
  providerThreadId?: string | null;
}

export interface CrmEmailSendGateway {
  sendPlainText(input: CrmEmailSendGatewayInput): Promise<CrmEmailSendGatewayResult>;
  replyPlainText(input: CrmInboxReplySendGatewayInput): Promise<CrmEmailSendGatewayResult>;
}

export interface CrmSendStartInput {
  enrollmentId: string;
  organizationId: string;
  ownerUserId: string;
  fromEnrollmentStatus: CrmSequenceEnrollmentStatus;
  toEnrollmentStatus: CrmSequenceEnrollmentStatus;
  fromMessageStatus: CrmMessageStatus;
  toMessageStatus: CrmMessageStatus;
  accountStatus: CrmAccountStatus;
  scheduledAt: Date;
}

export interface CrmSendStartRecord {
  enrollment: CrmSequenceEnrollmentRecord;
  message: CrmMessageRecord;
  account: CrmAccountRecord;
  contact: CrmContactRecord;
  mailbox: CrmMailboxRecord;
  event: CrmTimelineEventRecord;
}

export interface CrmSendDeliveryClaimInput extends CrmSendQueueJob {
  claimedAt: Date;
}

export interface CrmSendDeliveryClaimRecord extends Omit<CrmSequenceReviewRecord, 'mailbox' | 'firstMessage'> {
  mailbox: CrmMailboxRecord;
  firstMessage: CrmMessageRecord;
}

export interface CrmSequenceStopInput {
  enrollmentId: string;
  organizationId: string;
  fromStatuses: CrmSequenceEnrollmentStatus[];
  accountStatus: CrmAccountStatus;
  actorUserId: string;
}

export interface CrmSequenceStopRecord {
  enrollment: CrmSequenceEnrollmentRecord;
  message: CrmMessageRecord | null;
  account: CrmAccountRecord;
  event: CrmTimelineEventRecord;
}

export interface CrmSendCompletionInput {
  enrollmentId: string;
  messageId: string;
  organizationId: string;
  ownerUserId: string;
  runVersion: number;
  sentAt: Date;
  providerMessageId?: string | null;
  providerThreadId?: string | null;
  nextMessage?: Omit<CrmMessageCreateInput, 'enrollmentId'> | null;
}

export interface CrmSendCompletionRecord {
  enrollment: CrmSequenceEnrollmentRecord;
  message: CrmMessageRecord;
  nextMessage: CrmMessageRecord | null;
  account: CrmAccountRecord;
  event: CrmTimelineEventRecord;
}

export interface CrmSendFailureInput {
  enrollmentId: string;
  messageId: string;
  organizationId: string;
  ownerUserId: string;
  runVersion: number;
  reason: string;
}

export interface CrmSendFailureRecord {
  enrollment: CrmSequenceEnrollmentRecord;
  message: CrmMessageRecord;
  account: CrmAccountRecord;
  event: CrmTimelineEventRecord;
}

export interface CrmMailboxAuthorizationExpiredInput {
  mailboxId: string;
  organizationId: string;
  ownerUserId: string;
  reason: string;
  expiredAt: Date;
}

export interface CrmMailboxAuthorizationExpiredRecord {
  mailbox: CrmMailboxRecord;
  pausedEnrollmentCount: number;
  resetMessageCount: number;
}

export interface CrmInboxMessageCreateInput {
  threadId: string;
  organizationId: string;
  ownerUserId: string;
  accountId: string;
  contactId: string;
  enrollmentId?: string | null;
  mailboxId?: string | null;
  provider: CrmMailboxProvider;
  providerMessageId?: string | null;
  replyToMessageId?: string | null;
  fromEmail: string;
  fromEmailHash: string;
  maskedFromEmail: string;
  subject: string;
  snippet?: string | null;
  bodyText: string;
  receivedAt: Date;
  messageType: CrmInboxMessageType;
}

export interface CrmCustomerReplyIngestInput {
  outboundMessageId: string;
  organizationId: string;
  ownerUserId: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
  providerThreadId?: string | null;
  providerMessageId?: string | null;
  messageType?: CrmInboxMessageType;
}

export interface CrmCustomerReplyIngestRecord {
  thread: CrmInboxThreadRecord;
  message: CrmInboxMessageRecord;
  account: CrmAccountRecord;
  contact: CrmContactRecord;
  mailbox: CrmMailboxRecord | null;
  enrollment: CrmSequenceEnrollmentRecord | null;
  event: CrmTimelineEventRecord | null;
  isDuplicate: boolean;
}

export interface CrmInboxThreadStatusUpdateInput {
  id: string;
  organizationId: string;
  ownerUserId: string;
  fromStatus?: CrmInboxThreadStatus;
  toStatus: CrmInboxThreadStatus;
  accountStatus?: CrmAccountStatus;
}

export interface CrmInboxThreadStatusUpdateRecord {
  thread: CrmInboxThreadRecord;
  account: CrmAccountRecord;
  event: CrmTimelineEventRecord;
}

export interface CrmInboxThreadReplyInput {
  id: string;
  organizationId: string;
  ownerUserId: string;
  subject: string;
  bodyText: string;
  sentAt: Date;
  providerMessageId?: string | null;
}

export interface CrmInboxThreadReplyRecord {
  thread: CrmInboxThreadRecord;
  message: CrmInboxMessageRecord;
  account: CrmAccountRecord;
  contact: CrmContactRecord;
  mailbox: CrmMailboxRecord;
  enrollment: CrmSequenceEnrollmentRecord | null;
  event: CrmTimelineEventRecord;
}

export interface CrmStore {
  findAccountByDomain(organizationId: string, ownerUserId: string, domain: string): Promise<CrmAccountRecord | null>;
  createAccount(input: CrmAccountCreateInput): Promise<CrmAccountRecord>;
  updateAccount(id: string, input: CrmAccountUpdateInput): Promise<CrmAccountRecord | null>;
  findContactByEmailHash(
    organizationId: string,
    ownerUserId: string,
    emailHash: string
  ): Promise<CrmContactRecord | null>;
  createContact(input: CrmContactCreateInput): Promise<CrmContactRecord>;
  updateContact(id: string, input: CrmContactUpdateInput): Promise<CrmContactRecord | null>;
  findContactById(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmContactRecord | null>;
  updateContactEmailStatus(id: string, emailStatus: CrmEmailStatus): Promise<CrmContactRecord | null>;
  findEmailVerificationCache(args: {
    emailHash: string;
  }): Promise<CrmEmailVerificationCacheRecord | null>;
  upsertEmailVerificationCache(
    input: CrmEmailVerificationCacheUpsertInput
  ): Promise<CrmEmailVerificationCacheRecord>;
  getGlobalConfig(): Promise<CrmGlobalConfigRecord>;
  saveGlobalConfig(input: CrmGlobalConfigInput): Promise<CrmGlobalConfigRecord>;
  findBlacklistEntry(args: { organizationId: string; emailHash: string }): Promise<CrmBlacklistRecord | null>;
  upsertBlacklistEntry(input: CrmBlacklistUpsertInput): Promise<CrmBlacklistRecord>;
  listBlacklistEntries(input: CrmBlacklistListInput): Promise<{ records: CrmBlacklistRecord[]; total: number }>;
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
  findMailboxByProviderAndEmailHash(
    provider: CrmMailboxProvider,
    emailHash: string
  ): Promise<CrmMailboxRecord | null>;
  createMailbox(input: CrmMailboxCreateInput): Promise<CrmMailboxRecord>;
  listMailboxes(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmMailboxStatus;
    skip: number;
    take: number;
  }): Promise<{ records: CrmMailboxRecord[]; total: number }>;
  findMailboxById(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmMailboxRecord | null>;
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
  findActiveEnrollmentByContact(args: {
    organizationId: string;
    ownerUserId: string;
    contactId: string;
    statuses: CrmSequenceEnrollmentStatus[];
  }): Promise<CrmSequenceEnrollmentRecord | null>;
  createSequenceEnrollment(input: CrmSequenceEnrollmentCreateInput): Promise<CrmSequenceEnrollmentRecord>;
  createSequenceDraftBundle(input: CrmSequenceDraftBundleCreateInput): Promise<CrmSequenceDraftBundleRecord>;
  listSequenceReviewItems(args: {
    organizationId: string;
    ownerUserId?: string;
    keyword?: string;
    status?: CrmSequenceEnrollmentStatus;
    skip: number;
    take: number;
  }): Promise<{ records: CrmSequenceReviewRecord[]; total: number }>;
  getSequenceReviewItem(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmSequenceReviewRecord | null>;
  updateSequenceEnrollment(
    id: string,
    organizationId: string,
    input: CrmSequenceEnrollmentUpdateInput
  ): Promise<CrmSequenceEnrollmentRecord | null>;
  createMessage(input: CrmMessageCreateInput): Promise<CrmMessageRecord>;
  findMessageById(args: {
    id: string;
    organizationId: string;
    ownerUserId?: string;
  }): Promise<CrmMessageRecord | null>;
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
  updateInboxThreadStatus(
    input: CrmInboxThreadStatusUpdateInput
  ): Promise<CrmInboxThreadStatusUpdateRecord | null>;
  replyInboxThread(input: CrmInboxThreadReplyInput): Promise<CrmInboxThreadReplyRecord | null>;
}
