import type {
  CrmAccountDetailRecord,
  CrmAccountRecord,
  CrmBlacklistRecord,
  CrmContactRecord,
  CrmMailboxRecord,
  CrmTimelineEventRecord
} from '../crm.types';

const gmailHistorySyncScopes = new Set([
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.metadata'
]);

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

/** Hide mailbox secrets and expose Gmail sync issue state as a view object. */
export function toMailboxView(record: CrmMailboxRecord) {
  return {
    id: record.id,
    organizationId: record.organizationId,
    ownerUserId: record.ownerUserId,
    ownerUserName: record.ownerUserName,
    provider: record.provider,
    emailAddress: record.emailAddress,
    maskedEmail: record.maskedEmail,
    status: record.status,
    dailyLimit: record.dailyLimit,
    hourlyLimit: record.hourlyLimit,
    warmupStage: record.warmupStage,
    lastHistoryId: record.lastHistoryId,
    authorizedAt: record.authorizedAt.toISOString(),
    watchExpiration: record.watchExpiration?.toISOString() ?? null,
    syncMode: resolveMailboxSyncMode(),
    lastSyncIssue: toMailboxSyncIssueView(record),
    pausedAt: record.pausedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function resolveMailboxSyncMode() {
  const scopes = parseConfiguredGmailScopes(process.env.CRM_GMAIL_OAUTH_SCOPES);
  const supportsHistorySync = scopes.length === 0 || scopes.some(scope => gmailHistorySyncScopes.has(scope));

  if (!supportsHistorySync) return 'send_only';
  if (!normalizeEnvString(process.env.CRM_GMAIL_PUBSUB_TOPIC_NAME)) return 'mock_watch';

  return 'full_sync';
}

function parseConfiguredGmailScopes(value?: string) {
  return (
    normalizeEnvString(value)
      ?.split(/[\s,]+/)
      .filter(Boolean) ?? []
  );
}

function normalizeEnvString(value?: string) {
  const normalized = value?.trim();

  return normalized || null;
}

function toMailboxSyncIssueView(record: CrmMailboxRecord) {
  if (!record.syncIssueType || !record.syncIssueAt) {
    return null;
  }

  return {
    type: record.syncIssueType,
    message: record.syncIssueMessage ?? 'Gmail 同步需要人工处理',
    happenedAt: record.syncIssueAt.toISOString()
  };
}
