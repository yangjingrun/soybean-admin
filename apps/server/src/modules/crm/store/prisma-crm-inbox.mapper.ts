import type { CrmAccountModel } from '../../../generated/prisma/models/CrmAccount';
import type { CrmContactModel } from '../../../generated/prisma/models/CrmContact';
import type { CrmInboxMessageModel } from '../../../generated/prisma/models/CrmInboxMessage';
import type { CrmInboxThreadModel } from '../../../generated/prisma/models/CrmInboxThread';
import type { CrmMailboxModel } from '../../../generated/prisma/models/CrmMailbox';
import type { CrmSequenceEnrollmentModel } from '../../../generated/prisma/models/CrmSequenceEnrollment';
import type { CrmTimelineEventModel } from '../../../generated/prisma/models/CrmTimelineEvent';
import type {
  CrmInboxMessageRecord,
  CrmInboxThreadDetailRecord,
  CrmInboxThreadListRecord,
  CrmInboxThreadRecord
} from '../crm.types';
import { toAccountRecord, toContactRecord, toTimelineEventRecord } from './prisma-crm-core.mapper';
import { toMailboxRecord } from './prisma-crm-mailbox.mapper';
import { toSequenceEnrollmentRecord } from './prisma-crm-sequence.mapper';

/** Maps an inbox thread row and normalizes reply draft metadata. */
export function toInboxThreadRecord(record: CrmInboxThreadModel): CrmInboxThreadRecord {
  return {
    ...record,
    replyDraftMetadata: toInboxReplyDraftMetadata(record.replyDraftMetadata),
    provider: record.provider as CrmInboxThreadRecord['provider'],
    status: record.status as CrmInboxThreadRecord['status']
  };
}

/** Parses persisted inbox reply draft metadata with a minimal shape check. */
export function toInboxReplyDraftMetadata(value: unknown): CrmInboxThreadRecord['replyDraftMetadata'] {
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

/** Maps a single inbound inbox message. */
export function toInboxMessageRecord(record: CrmInboxMessageModel): CrmInboxMessageRecord {
  return {
    ...record,
    provider: record.provider as CrmInboxMessageRecord['provider'],
    messageType: record.messageType as CrmInboxMessageRecord['messageType']
  };
}

/** Maps the compact inbox thread list aggregate. */
export function toInboxThreadListRecord(
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

/** Maps the inbox thread detail aggregate with messages and timeline events. */
export function toInboxThreadDetailRecord(
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
