import type {
  CrmAccountRecord,
  CrmContactRecord,
  CrmGmailHistoryLabelChangeType,
  CrmGmailHistoryMessageDirection,
  CrmInboxMessageType,
  CrmInboxThreadRecord,
  CrmMailboxRecord,
  CrmMessageRecord,
  CrmSendPreferenceRecord,
  CrmSequenceEnrollmentRecord,
  CrmSequenceReviewRecord
} from './crm.types';

export interface CrmSendQueueJob {
  enrollmentId: string;
  messageId: string;
  organizationId: string;
  ownerUserId: string;
  runVersion: number;
}

export type CrmScheduledMessageStepKind = 'first_touch' | 'follow_up';

export interface CrmDueSendCandidateRecord extends CrmSequenceReviewRecord {
  message: CrmMessageRecord;
  mailbox: CrmMailboxRecord;
  stepKind: CrmScheduledMessageStepKind;
}

export interface CrmDueSendCandidateListInput {
  now: Date;
  take: number;
}

export interface CrmDispatchedMessageCountInput {
  organizationId: string;
  ownerUserId?: string;
  mailboxId?: string;
  stepKind?: CrmScheduledMessageStepKind;
  from: Date;
  to: Date;
}

export interface CrmOwnerSendStateBatchInput {
  owners: Array<{
    organizationId: string;
    ownerUserId: string;
  }>;
  from: Date;
  to: Date;
}

export interface CrmOwnerSendStateRecord {
  organizationId: string;
  ownerUserId: string;
  preference: CrmSendPreferenceRecord | null;
  queuedCount: number;
  dailyCount: number;
  firstTouchCount: number;
  followUpCount: number;
}

export interface CrmMailboxSendStateBatchInput {
  mailboxes: Array<{
    organizationId: string;
    mailboxId: string;
  }>;
  day: {
    from: Date;
    to: Date;
  };
  hour: {
    from: Date;
    to: Date;
  };
}

export interface CrmMailboxSendStateRecord {
  organizationId: string;
  mailboxId: string;
  dailyCount: number;
  hourlyCount: number;
  latestScheduledAt: Date | null;
}

export interface CrmSendQueuePort {
  enqueueFirstMessage(input: CrmSendQueueJob, options?: { delayMs?: number }): Promise<{ jobId: string }>;
  hasJob(jobId: string): Promise<boolean>;
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
  direction: CrmGmailHistoryMessageDirection;
  subject: string;
  bodyText: string;
  receivedAt: Date;
  messageType?: CrmInboxMessageType;
}

export interface CrmGmailHistoryLabelChange {
  changeType: CrmGmailHistoryLabelChangeType;
  providerMessageId: string;
  providerThreadId: string | null;
  labelIds: string[];
}

export interface CrmGmailHistoryListResult {
  nextHistoryId: string;
  messages: CrmGmailHistoryMessage[];
  labelChanges?: CrmGmailHistoryLabelChange[];
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
  tracking?: {
    openPixelUrl: string;
  } | null;
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
