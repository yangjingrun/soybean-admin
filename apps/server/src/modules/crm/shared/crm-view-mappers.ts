import type {
  CrmAccountDetailRecord,
  CrmAccountRecord,
  CrmBlacklistRecord,
  CrmContactRecord,
  CrmTimelineEventRecord
} from '../crm.types';

/** Convert account dates to transport-safe ISO strings. */
export function toAccountView(record: CrmAccountRecord) {
  return {
    ...record,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    archiveSlimmedAt: record.archiveSlimmedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

/** Convert contact dates to transport-safe ISO strings. */
export function toContactView(record: CrmContactRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

/** Convert timeline event dates to transport-safe ISO strings. */
export function toTimelineEventView(record: CrmTimelineEventRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString()
  };
}

/** Convert an account aggregate detail to API view shape. */
export function toAccountDetailView(detail: CrmAccountDetailRecord) {
  return {
    account: toAccountView(detail.account),
    contacts: detail.contacts.map(toContactView),
    timelineEvents: detail.timelineEvents.map(toTimelineEventView)
  };
}

/** Hide blacklist email hashes before returning suppression records. */
export function toBlacklistView(record: CrmBlacklistRecord) {
  const { emailHash: _emailHash, ...safeRecord } = record;

  return {
    ...safeRecord,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}
