import type { CrmFollowUpDelayDays } from './crm-global-config';
import type { CrmAiDraftTaskStatus } from './crm-ai-draft-task.types';
import type { CrmSendQueueJob } from './crm-ports.types';
import type { RequestUserContext } from '../../shared/request-context';
import type { CrmUserContext } from './shared/crm-context';
import type {
  CrmSequencePolicyLinkPolicy,
  CrmSequencePolicySameCompanyStrategy,
  CrmSequencePolicyStatus,
  CrmSequencePolicyStep
} from './crm-sequence-policy';

export type * from './crm-ai-draft-task.types';
export type * from './crm-ports.types';
export type { CrmStore } from './crm-store.types';

export type OrganizationRole = RequestUserContext['organizationRole'];

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
export const crmMailboxSyncIssueTypes = ['history_expired'] as const;
export const crmProductLineStatuses = ['active', 'archived'] as const;
export const crmEmailTemplateStatuses = ['active', 'archived'] as const;
export const crmPersonaProfileStatuses = ['active', 'archived'] as const;
export const crmSequenceEnrollmentStatuses = [
  'draft_review_pending',
  'ready_to_send',
  'sequence_running',
  'paused',
  'stopped',
  'replied',
  'archived'
] as const;
export const crmSequenceReviewTodoTypes = [
  'draft_review_pending',
  'follow_up_draft_review',
  'ready_to_start',
  'can_generate_next',
  'send_failed',
  'max_steps_reached'
] as const;
export const crmMessageStatuses = [
  'draft_pending_review',
  'draft_ready',
  'queued',
  'sent',
  'failed',
  'skipped'
] as const;
export const crmMessageThreadModes = ['new_subject', 'same_thread'] as const;
export const crmInboxThreadStatuses = ['pending', 'handled', 'archived'] as const;
export const crmInboxMessageTypes = [
  'customer_reply',
  'bounce',
  'unsubscribe_hint',
  'unsubscribe_review_pending'
] as const;

export type CrmMailboxProvider = 'gmail';
export type CrmArchivedFingerprintType = 'domain' | 'email_hash';
export type CrmMailboxStatus = (typeof crmMailboxStatuses)[number];
export type CrmMailboxWarmupStage = (typeof crmMailboxWarmupStages)[number];
export type CrmMailboxSyncIssueType = (typeof crmMailboxSyncIssueTypes)[number];
export type CrmProductLineStatus = (typeof crmProductLineStatuses)[number];
export type CrmEmailTemplateStatus = (typeof crmEmailTemplateStatuses)[number];
export type CrmPersonaProfileStatus = (typeof crmPersonaProfileStatuses)[number];
export type CrmSequenceEnrollmentStatus = (typeof crmSequenceEnrollmentStatuses)[number];
export type CrmSequenceReviewTodoType = (typeof crmSequenceReviewTodoTypes)[number];
export type CrmMessageStatus = (typeof crmMessageStatuses)[number];
export type CrmMessageThreadMode = (typeof crmMessageThreadModes)[number];
export type CrmInboxThreadStatus = (typeof crmInboxThreadStatuses)[number];
export type CrmInboxMessageType = (typeof crmInboxMessageTypes)[number];
export type CrmGmailHistoryMessageDirection = 'inbound' | 'outbound';
export type CrmGmailHistoryLabelChangeType = 'labels_added' | 'labels_removed' | 'message_deleted';

export type { CrmUserContext };

export interface ImportCrmLeadInput {
  name: string;
  websiteUrl?: string | null;
  country?: string | null;
  customerType?: string | null;
  sourceTaskId?: string | null;
  sourceSnapshot?: Record<string, unknown> | null;
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
  archivedAt: Date | null;
  archiveReason: string | null;
  archiveSlimmedAt: Date | null;
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
  ownerConcurrentSendLimit: number;
  ownerDailySendLimitMax: number;
  followUpDelayDays: CrmFollowUpDelayDays;
  updatedAt: Date;
}

export interface CrmGlobalConfigInput {
  emailVerificationCooldownDays: number;
  ownerConcurrentSendLimit?: number;
  ownerDailySendLimitMax?: number;
  followUpDelayDays?: CrmFollowUpDelayDays;
  updatedById?: string | null;
  updatedByName?: string | null;
}

export interface CrmSendPreferenceRecord {
  id: string;
  organizationId: string;
  ownerUserId: string;
  ownerUserName: string | null;
  dailySendLimit: number;
  followUpSharePercent: number;
  updatedById: string | null;
  updatedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmSendPreferenceInput {
  organizationId: string;
  ownerUserId: string;
  ownerUserName?: string | null;
  dailySendLimit: number;
  followUpSharePercent: number;
  updatedById?: string | null;
  updatedByName?: string | null;
}

export interface CrmOrganizationConfigRecord {
  id: string;
  organizationId: string;
  allowAdminViewMemberEmailBody: boolean;
  updatedById: string | null;
  updatedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmOrganizationConfigInput {
  organizationId: string;
  allowAdminViewMemberEmailBody: boolean;
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

export interface CrmBlacklistDeleteInput {
  id: string;
  organizationId: string;
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
  syncIssueType?: CrmMailboxSyncIssueType | null;
  syncIssueAt?: Date | null;
  syncIssueMessage?: string | null;
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
  aiWritingConfig: CrmProductLineAiWritingConfig | null;
  status: CrmProductLineStatus;
  createdById: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CrmAiWritingStepIndex = 1 | 2 | 3 | 4 | 5;

export interface CrmProductLineAiWritingStepConfig {
  stepIndex: CrmAiWritingStepIndex;
  prompt: string;
}

export interface CrmProductLineAiWritingConfig {
  enabled: boolean;
  commonRequirements: string;
  forbiddenClaims: string;
  productEmphasis: string;
  steps: CrmProductLineAiWritingStepConfig[];
}

export interface CrmProductLineAiPromptVersionRecord {
  id: string;
  organizationId: string;
  productLineId: string;
  version: number;
  aiWritingConfig: CrmProductLineAiWritingConfig | null;
  editorId: string;
  editorName: string | null;
  changeSummary: string | null;
  createdAt: Date;
}

export interface CrmAiDraftSnapshot {
  productLineId: string;
  productLineName: string;
  stepIndex: CrmAiWritingStepIndex;
  writingConfig: CrmProductLineAiWritingConfig;
  reason: string;
  riskNotes: string[];
  generatedAt: string;
}

export interface CrmAiDraftMetadata {
  generated: true;
  reason: string;
  riskNotes: string[];
  snapshot: CrmAiDraftSnapshot;
}

export interface CrmAiDraftPreviewPreviousMessageInput {
  stepIndex: number;
  subject: string;
  bodyText: string;
}

export interface CrmAiDraftPreviewInput {
  accountId: string;
  contactId: string;
  productLineId: string;
  stepIndex: number;
  enrollmentId?: string | null;
  messageId?: string | null;
  previousMessages?: CrmAiDraftPreviewPreviousMessageInput[];
}

export interface CrmSequenceEnrollmentRecord {
  id: string;
  organizationId: string;
  ownerUserId: string;
  accountId: string;
  contactId: string;
  productLineId: string | null;
  mailboxId: string | null;
  policyId: string | null;
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

export interface CrmSequencePolicyRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: CrmSequencePolicyStatus;
  isDefault: boolean;
  steps: CrmSequencePolicyStep[];
  linkPolicy: CrmSequencePolicyLinkPolicy;
  allowLowRiskAutoSend: boolean;
  sameCompanyContactStrategy: CrmSequencePolicySameCompanyStrategy;
  createdById: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmPersonaProfileRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  titleKeywordsText: string | null;
  customerTypeKeywordsText: string | null;
  painPoints: string | null;
  focusText: string | null;
  avoidText: string | null;
  status: CrmPersonaProfileStatus;
  isDefault: boolean;
  createdById: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CrmPersonaMatchMethod = 'title' | 'customer_type' | 'default' | 'builtin' | 'none';
export type CrmPersonaMatchSource = 'organization' | 'builtin';

export interface CrmPersonaMatchInfo {
  persona: {
    id: string | null;
    name: string;
    source: CrmPersonaMatchSource;
  } | null;
  matchMethod: CrmPersonaMatchMethod;
  matchedKeywords: string[];
  fallbackReason: string | null;
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
  metadata?: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmMessageDraftVersionRecord {
  id: string;
  organizationId: string;
  ownerUserId: string;
  accountId: string;
  contactId: string;
  enrollmentId: string;
  messageId: string;
  mailboxId: string | null;
  stepIndex: number;
  versionNo: number;
  subject: string;
  bodyText: string;
  editorId: string;
  editorName: string | null;
  createdAt: Date;
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
  replyDraftBodyText?: string | null;
  replyDraftTopic?: string | null;
  replyDraftMetadata?: CrmInboxReplyDraftMetadata | null;
  replyDraftUpdatedAt?: Date | null;
  replyDraftUpdatedById?: string | null;
  replyDraftUpdatedByName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmInboxReplyDraftMetadata {
  generated: boolean;
  reason: string;
  riskNotes: string[];
  productLineId?: string | null;
  productLineName?: string | null;
  generatedAt?: string;
}

export interface CrmInboxReplyDraftRecord {
  topic: string;
  bodyText: string;
  metadata: CrmInboxReplyDraftMetadata | null;
  updatedAt: Date;
  updatedById: string;
  updatedByName: string | null;
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
  policy?: CrmSequencePolicyRecord | null;
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
  archivedAt?: Date | null;
  archiveReason?: string | null;
  archiveSlimmedAt?: Date | null;
}

export interface CrmArchiveSlimmingListInput {
  archivedBefore: Date;
  take: number;
}

export interface CrmArchiveSlimInput {
  id: string;
  organizationId: string;
  archivedBefore: Date;
  slimmedAt: Date;
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
  syncIssueType?: CrmMailboxSyncIssueType | null;
  syncIssueAt?: Date | null;
  syncIssueMessage?: string | null;
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
  syncIssueType?: CrmMailboxSyncIssueType | null;
  syncIssueAt?: Date | null;
  syncIssueMessage?: string | null;
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
  aiWritingConfig?: CrmProductLineAiWritingConfig | null;
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
  aiWritingConfig?: CrmProductLineAiWritingConfig | null;
  status?: CrmProductLineStatus;
}

export interface CrmProductLineAiPromptVersionCreateInput {
  organizationId: string;
  productLineId: string;
  aiWritingConfig: CrmProductLineAiWritingConfig | null;
  editorId: string;
  editorName?: string | null;
  changeSummary?: string | null;
}

export interface CrmProductLineAiPromptVersionRestoreInput {
  organizationId: string;
  productLineId: string;
  versionId: string;
  editorId: string;
  editorName?: string | null;
  changeSummary?: string | null;
}

export interface CrmProductLineAiPromptVersionRestoreRecord {
  productLine: CrmProductLineRecord;
  restoredVersion: CrmProductLineAiPromptVersionRecord;
  currentVersion: CrmProductLineAiPromptVersionRecord;
}

export interface CrmPersonaProfileCreateInput {
  organizationId: string;
  name: string;
  description?: string | null;
  titleKeywordsText?: string | null;
  customerTypeKeywordsText?: string | null;
  painPoints?: string | null;
  focusText?: string | null;
  avoidText?: string | null;
  status: CrmPersonaProfileStatus;
  isDefault: boolean;
  createdById: string;
  createdByName?: string | null;
}

export interface CrmPersonaProfileUpdateInput {
  name?: string;
  description?: string | null;
  titleKeywordsText?: string | null;
  customerTypeKeywordsText?: string | null;
  painPoints?: string | null;
  focusText?: string | null;
  avoidText?: string | null;
  status?: CrmPersonaProfileStatus;
  isDefault?: boolean;
}

export interface CrmPersonaProfileListInput {
  organizationId: string;
  keyword?: string;
  status?: CrmPersonaProfileStatus;
  skip: number;
  take: number;
}

export interface CrmEmailTemplateStepInput {
  stepIndex: number;
  name: string;
  threadMode: CrmMessageThreadMode;
  delayDays: number;
  subjectTemplate: string;
  bodyTemplate: string;
}

export interface CrmEmailTemplateStepRecord extends CrmEmailTemplateStepInput {
  id: string;
  organizationId: string;
  templateGroupId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmEmailTemplateGroupRecord {
  id: string;
  organizationId: string;
  name: string;
  language: string;
  description: string | null;
  status: CrmEmailTemplateStatus;
  isDefault: boolean;
  steps: CrmEmailTemplateStepRecord[];
  createdById: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmEmailTemplateGroupCreateInput {
  organizationId: string;
  name: string;
  language: string;
  description?: string | null;
  status: CrmEmailTemplateStatus;
  isDefault: boolean;
  steps: CrmEmailTemplateStepInput[];
  createdById: string;
  createdByName?: string | null;
}

export interface CrmEmailTemplateGroupUpdateInput {
  name?: string;
  language?: string;
  description?: string | null;
  status?: CrmEmailTemplateStatus;
  isDefault?: boolean;
  steps?: CrmEmailTemplateStepInput[];
}

export interface CrmEmailTemplateGroupListInput {
  organizationId: string;
  keyword?: string;
  status?: CrmEmailTemplateStatus;
  skip: number;
  take: number;
}

export interface CrmSequenceEnrollmentCreateInput {
  organizationId: string;
  ownerUserId: string;
  accountId: string;
  contactId: string;
  productLineId?: string | null;
  mailboxId?: string | null;
  policyId?: string | null;
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
  policyId?: string | null;
  name?: string;
  status?: CrmSequenceEnrollmentStatus;
  currentStep?: number;
  totalSteps?: number;
  runVersion?: number;
}

export interface CrmSequencePolicyCreateInput {
  organizationId: string;
  name: string;
  description?: string | null;
  status: CrmSequencePolicyStatus;
  isDefault: boolean;
  steps: CrmSequencePolicyStep[];
  linkPolicy: CrmSequencePolicyLinkPolicy;
  allowLowRiskAutoSend: boolean;
  sameCompanyContactStrategy: CrmSequencePolicySameCompanyStrategy;
  createdById: string;
  createdByName?: string | null;
}

export interface CrmSequencePolicyUpdateInput {
  name?: string;
  description?: string | null;
  status?: CrmSequencePolicyStatus;
  isDefault?: boolean;
  steps?: CrmSequencePolicyStep[];
  linkPolicy?: CrmSequencePolicyLinkPolicy;
  allowLowRiskAutoSend?: boolean;
  sameCompanyContactStrategy?: CrmSequencePolicySameCompanyStrategy;
}

export interface CrmSequencePolicyListInput {
  organizationId: string;
  keyword?: string;
  status?: CrmSequencePolicyStatus;
  skip: number;
  take: number;
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
  metadata?: unknown | null;
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
  metadata?: unknown | null;
}

export interface CrmMessageDraftVersionCreateInput {
  organizationId: string;
  ownerUserId: string;
  accountId: string;
  contactId: string;
  enrollmentId: string;
  messageId: string;
  mailboxId?: string | null;
  stepIndex: number;
  subject: string;
  bodyText: string;
  editorId: string;
  editorName?: string | null;
}

export interface CrmMessageDraftVersionRestoreInput {
  messageId: string;
  versionId: string;
  organizationId: string;
  ownerUserId: string;
}

export interface CrmSequenceDraftBundleCreateInput {
  enrollment: CrmSequenceEnrollmentCreateInput;
  message: Omit<CrmMessageCreateInput, 'enrollmentId'>;
  timelineEvent: Omit<CrmTimelineEventCreateInput, 'metadata'> & {
    metadata: {
      productLineId: string | null;
      mailboxId: string | null;
      policyId?: string | null;
      personaProfileId?: string | null;
      personaProfileName?: string | null;
      personaMatchMethod?: CrmPersonaMatchMethod;
      personaMatchedKeywords?: string[];
      personaFallbackReason?: string | null;
      aiDraft?: CrmAiDraftMetadata | null;
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

export type CrmStrategyStatDimension = 'template' | 'policy' | 'persona' | 'productLine';

export interface CrmStrategyStatRow {
  dimension: CrmStrategyStatDimension;
  key: string;
  name: string;
  sequenceCount: number;
  draftPendingCount: number;
  readyCount: number;
  queuedCount: number;
  sentCount: number;
  failedCount: number;
  repliedCount: number;
  stoppedCount: number;
}

export interface CrmStrategyStatsRecord {
  generatedAt: Date;
  rows: Record<CrmStrategyStatDimension, CrmStrategyStatRow[]>;
}

export interface CrmWorkbenchOverviewRecord {
  generatedAt: Date;
  today: {
    sentCount: number;
    queuedCount: number;
    failedCount: number;
    pendingReplyCount: number;
    totalReplyCount: number;
    draftReviewCount: number;
    firstDraftReviewCount: number;
    followUpDraftReviewCount: number;
    riskyDraftReviewCount: number;
    issueCount: number;
    sendFailedCount: number;
    mailboxIssueCount: number;
    missingContactCount: number;
    emailVerificationPendingCount: number;
    riskyEmailCount: number;
    aiLeadTaskPendingCount: number;
  };
  yesterday: {
    sentCount: number;
    totalReplyCount: number;
  };
  trend: Array<{
    date: string;
    sentCount: number;
    replyCount: number;
  }>;
  runningTasks: Array<{
    id: string;
    type: 'ai_leads' | 'ai_draft' | 'send';
    title: string;
    status: string;
    totalCount: number;
    completedCount: number;
    failedCount: number;
    pendingCount: number;
    progressPercent?: number;
    routePath: string;
  }>;
}

export interface CrmFollowUpDraftBundleCreateInput {
  enrollmentId: string;
  organizationId: string;
  ownerUserId: string;
  expectedEnrollmentStatus?: CrmSequenceEnrollmentStatus | CrmSequenceEnrollmentStatus[];
  blockingMessageStatuses?: CrmMessageStatus[];
  taskGuard?: {
    taskId: string;
    runVersion: number;
    status: CrmAiDraftTaskStatus | CrmAiDraftTaskStatus[];
  };
  message: Omit<CrmMessageCreateInput, 'enrollmentId'>;
  timelineEvent: CrmTimelineEventCreateInput;
}

export interface CrmFollowUpDraftBundleRecord {
  enrollment: CrmSequenceEnrollmentRecord;
  message: CrmMessageRecord;
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
  ownerUserId?: string;
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

export interface CrmInboxThreadGmailStateSyncInput {
  organizationId: string;
  ownerUserId: string;
  mailboxId: string;
  providerThreadId: string;
  providerMessageId: string;
  changeType: CrmGmailHistoryLabelChangeType;
  labelIds: string[];
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

export interface CrmInboxReplyDraftSaveInput {
  id: string;
  organizationId: string;
  ownerUserId: string;
  topic: string;
  bodyText: string;
  metadata?: CrmInboxReplyDraftMetadata | null;
  updatedAt: Date;
  updatedById: string;
  updatedByName?: string | null;
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

export interface CrmInboxUnsubscribeConfirmInput {
  messageId: string;
  organizationId: string;
  ownerUserId: string;
  confirmedAt: Date;
  confirmedById: string;
  confirmedByName?: string | null;
}

export interface CrmInboxUnsubscribeConfirmRecord {
  thread: CrmInboxThreadRecord;
  message: CrmInboxMessageRecord;
  account: CrmAccountRecord;
  contact: CrmContactRecord;
  mailbox: CrmMailboxRecord | null;
  enrollment: CrmSequenceEnrollmentRecord | null;
  event: CrmTimelineEventRecord;
}
