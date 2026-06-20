import { canViewEmailBody } from '../../../shared/permission-policy';
import type {
  CrmCustomerReplyIngestRecord,
  CrmInboxMessageRecord,
  CrmInboxThreadDetailRecord,
  CrmInboxThreadListRecord,
  CrmInboxThreadRecord,
  CrmInboxThreadReplyRecord,
  CrmInboxUnsubscribeConfirmRecord,
  CrmMailboxRecord,
  CrmOrganizationConfigRecord,
  CrmUserContext
} from '../crm.types';
import {
  toAccountView,
  toContactView,
  toMailboxView,
  toSequenceEnrollmentView,
  toTimelineEventView
} from '../shared/crm-view-mappers';

/** Convert one inbox thread record to its transport-safe view. */
export function toInboxThreadView(record: CrmInboxThreadRecord) {
  return {
    id: record.id,
    organizationId: record.organizationId,
    ownerUserId: record.ownerUserId,
    accountId: record.accountId,
    contactId: record.contactId,
    enrollmentId: record.enrollmentId,
    mailboxId: record.mailboxId,
    provider: record.provider,
    providerThreadId: record.providerThreadId,
    subject: record.subject,
    status: record.status,
    unreadCount: record.unreadCount,
    messageCount: record.messageCount,
    lastInboundAt: record.lastInboundAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

/** Convert one inbox message record and derive local direction from mailbox ownership. */
export function toInboxMessageView(record: CrmInboxMessageRecord, mailbox?: CrmMailboxRecord | null) {
  const isOutbound = Boolean(mailbox && record.fromEmailHash === mailbox.emailHash);
  const timestamp = record.receivedAt.toISOString();

  return {
    ...record,
    direction: isOutbound ? 'outbound' : 'inbound',
    sentAt: isOutbound ? timestamp : null,
    receivedAt: isOutbound ? null : timestamp,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.createdAt.toISOString()
  };
}

/** Convert an inbox list aggregate and hide snippets when body visibility is not allowed. */
export function toInboxThreadListView(
  record: CrmInboxThreadListRecord,
  context: CrmUserContext,
  organizationConfig: CrmOrganizationConfigRecord | null
) {
  const canReadBody = canViewEmailBody(context, record.thread.ownerUserId, organizationConfig);

  return {
    ...toInboxThreadView(record.thread),
    account: toAccountView(record.account),
    contact: toContactView(record.contact),
    mailbox: record.mailbox ? toMailboxView(record.mailbox) : null,
    enrollment: record.enrollment ? toSequenceEnrollmentView(record.enrollment) : null,
    lastMessageSnippet: canReadBody ? (record.lastMessage?.snippet ?? '') : '',
    canReadBody,
    canOperate: record.thread.ownerUserId === context.userId
  };
}

/** Convert one inbox detail aggregate and enforce email body visibility. */
export function toInboxThreadDetailView(
  record: CrmInboxThreadDetailRecord,
  context: CrmUserContext,
  organizationConfig: CrmOrganizationConfigRecord | null
) {
  const thread = toInboxThreadListView(record, context, organizationConfig);
  const canReadBody = canViewEmailBody(context, record.thread.ownerUserId, organizationConfig);

  return {
    thread,
    account: thread.account,
    contact: thread.contact,
    mailbox: thread.mailbox,
    enrollment: thread.enrollment,
    messages: canReadBody ? record.messages.map(message => toInboxMessageView(message, record.mailbox)) : [],
    timelineEvents: record.timelineEvents.map(toTimelineEventView),
    canOperate: thread.canOperate,
    replyDraft: thread.canOperate ? toInboxReplyDraftView(record.thread) : null
  };
}

/** Convert local reply draft fields from a thread record. */
export function toInboxReplyDraftView(record: CrmInboxThreadRecord) {
  if (
    !record.replyDraftBodyText ||
    !record.replyDraftTopic ||
    !record.replyDraftUpdatedAt ||
    !record.replyDraftUpdatedById
  ) {
    return null;
  }

  return {
    topic: record.replyDraftTopic,
    bodyText: record.replyDraftBodyText,
    metadata: record.replyDraftMetadata,
    updatedAt: record.replyDraftUpdatedAt.toISOString(),
    updatedById: record.replyDraftUpdatedById,
    updatedByName: record.replyDraftUpdatedByName
  };
}

/** Convert a customer reply ingest result when the full thread cannot be reloaded. */
export function toInboxReplyIngestView(record: CrmCustomerReplyIngestRecord, context: CrmUserContext) {
  const thread = {
    ...toInboxThreadView(record.thread),
    account: toAccountView(record.account),
    contact: toContactView(record.contact),
    mailbox: record.mailbox ? toMailboxView(record.mailbox) : null,
    enrollment: record.enrollment ? toSequenceEnrollmentView(record.enrollment) : null,
    lastMessageSnippet: record.message.snippet ?? '',
    canOperate: record.thread.ownerUserId === context.userId
  };

  return {
    thread,
    account: thread.account,
    contact: thread.contact,
    mailbox: thread.mailbox,
    enrollment: thread.enrollment,
    messages: [toInboxMessageView(record.message, record.mailbox)],
    timelineEvents: record.event ? [toTimelineEventView(record.event)] : [],
    canOperate: thread.canOperate
  };
}

/** Convert an owner reply result when the full thread cannot be reloaded. */
export function toInboxThreadReplyView(record: CrmInboxThreadReplyRecord, context: CrmUserContext) {
  const thread = {
    ...toInboxThreadView(record.thread),
    account: toAccountView(record.account),
    contact: toContactView(record.contact),
    mailbox: toMailboxView(record.mailbox),
    enrollment: record.enrollment ? toSequenceEnrollmentView(record.enrollment) : null,
    lastMessageSnippet: record.message.snippet ?? '',
    canOperate: record.thread.ownerUserId === context.userId
  };

  return {
    thread,
    account: thread.account,
    contact: thread.contact,
    mailbox: thread.mailbox,
    enrollment: thread.enrollment,
    messages: [toInboxMessageView(record.message, record.mailbox)],
    timelineEvents: [toTimelineEventView(record.event)],
    canOperate: thread.canOperate
  };
}

/** Convert an unsubscribe confirmation transaction result. */
export function toInboxUnsubscribeConfirmView(record: CrmInboxUnsubscribeConfirmRecord, context: CrmUserContext) {
  const thread = {
    ...toInboxThreadView(record.thread),
    account: toAccountView(record.account),
    contact: toContactView(record.contact),
    mailbox: record.mailbox ? toMailboxView(record.mailbox) : null,
    enrollment: record.enrollment ? toSequenceEnrollmentView(record.enrollment) : null,
    lastMessageSnippet: record.message.snippet ?? '',
    canOperate: record.thread.ownerUserId === context.userId
  };

  return {
    thread,
    account: thread.account,
    contact: thread.contact,
    mailbox: thread.mailbox,
    enrollment: thread.enrollment,
    message: toInboxMessageView(record.message, record.mailbox),
    messages: [toInboxMessageView(record.message, record.mailbox)],
    timelineEvents: [toTimelineEventView(record.event)],
    canOperate: thread.canOperate
  };
}
