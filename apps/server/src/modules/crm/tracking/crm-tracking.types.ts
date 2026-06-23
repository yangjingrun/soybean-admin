import type {
  CrmAccountRecord,
  CrmContactRecord,
  CrmMailboxRecord,
  CrmMessageRecord,
  CrmSequenceEnrollmentRecord,
  CrmTimelineEventCreateInput,
  CrmTimelineEventRecord
} from '../crm.types';

export interface CrmEmailOpenTargetRecord {
  message: CrmMessageRecord;
  account: CrmAccountRecord;
  contact: CrmContactRecord;
  enrollment: CrmSequenceEnrollmentRecord;
  mailbox: CrmMailboxRecord | null;
}

export interface CrmEmailOpenEventRecord {
  id: string;
  organizationId: string;
  ownerUserId: string;
  accountId: string;
  contactId: string;
  enrollmentId: string;
  messageId: string;
  openCount: number;
  firstOpenedAt: Date;
  lastOpenedAt: Date;
  lastUserAgent: string | null;
  lastIpAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmEmailOpenRecordInput {
  target: CrmEmailOpenTargetRecord;
  openedAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface CrmEmailOpenRecordResult {
  event: CrmEmailOpenEventRecord;
  isFirstOpen: boolean;
}

export interface CrmTrackingRepository {
  findEmailOpenTargetByMessageId(messageId: string): Promise<CrmEmailOpenTargetRecord | null>;
  recordEmailOpen(input: CrmEmailOpenRecordInput): Promise<CrmEmailOpenRecordResult>;
  createTimelineEvent(input: CrmTimelineEventCreateInput): Promise<CrmTimelineEventRecord>;
}
