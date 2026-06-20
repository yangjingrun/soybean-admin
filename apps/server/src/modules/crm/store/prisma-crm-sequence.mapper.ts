import type { CrmAccountModel } from '../../../generated/prisma/models/CrmAccount';
import type { CrmContactModel } from '../../../generated/prisma/models/CrmContact';
import type { CrmMailboxModel } from '../../../generated/prisma/models/CrmMailbox';
import type { CrmMessageModel } from '../../../generated/prisma/models/CrmMessage';
import type { CrmProductLineModel } from '../../../generated/prisma/models/CrmProductLine';
import type { CrmSequenceEnrollmentModel } from '../../../generated/prisma/models/CrmSequenceEnrollment';
import type { CrmSequencePolicyModel } from '../../../generated/prisma/models/CrmSequencePolicy';
import type {
  CrmMessageDraftVersionRecord,
  CrmMessageRecord,
  CrmSequenceEnrollmentRecord,
  CrmSequenceReviewRecord
} from '../crm.types';
import { toProductLineRecord, toSequencePolicyRecord } from './prisma-crm-catalog.mapper';
import { toAccountRecord, toContactRecord } from './prisma-crm-core.mapper';
import { toMailboxRecord } from './prisma-crm-mailbox.mapper';

/** Maps a sequence enrollment row and narrows its status field. */
export function toSequenceEnrollmentRecord(record: CrmSequenceEnrollmentModel): CrmSequenceEnrollmentRecord {
  return {
    ...record,
    status: record.status as CrmSequenceEnrollmentRecord['status']
  };
}

/** Maps one outbound CRM message and preserves provider metadata when generated Prisma types lag. */
export function toMessageRecord(record: CrmMessageModel): CrmMessageRecord {
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

export type CrmMessageDraftVersionRaw = CrmMessageDraftVersionRecord;

/** Maps a raw message draft version row returned by queryRaw. */
export function toMessageDraftVersionRecord(record: CrmMessageDraftVersionRaw): CrmMessageDraftVersionRecord {
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

/** Maps a sequence review aggregate and derives the first-message shortcut. */
export function toSequenceReviewRecord(
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
