import type {
  CrmAccountDetailRecord,
  CrmAccountRecord,
  CrmAiDraftMetadata,
  CrmBlacklistRecord,
  CrmContactRecord,
  CrmLeadEnrichmentHistoryRecord,
  CrmMailboxRecord,
  CrmMessageDraftVersionRecord,
  CrmMessageRecord,
  CrmSequenceEnrollmentRecord,
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

/** Convert account list rows while hiding internal scheduling profile fields. */
export function toAccountListView(record: CrmAccountRecord) {
  const { timeZone: _timeZone, ...safeRecord } = toAccountView(record);

  return safeRecord;
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

/** Convert provider enrichment history dates to transport-safe ISO strings. */
export function toLeadEnrichmentHistoryView(record: CrmLeadEnrichmentHistoryRecord) {
  return {
    ...record,
    lastAttemptedAt: record.lastAttemptedAt.toISOString(),
    lastSucceededAt: record.lastSucceededAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

/** Convert an account aggregate detail to API view shape. */
export function toAccountDetailView(detail: CrmAccountDetailRecord) {
  return {
    account: toAccountView(detail.account),
    contacts: detail.contacts.map(toContactView),
    enrichmentHistories: detail.enrichmentHistories.map(toLeadEnrichmentHistoryView),
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

/** Convert one CRM sequence enrollment to the API view shape. */
export function toSequenceEnrollmentView(record: CrmSequenceEnrollmentRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

/** Convert one CRM message to the API view shape and expose parsed AI draft metadata. */
export function toMessageView(record: CrmMessageRecord) {
  return {
    ...record,
    aiDraft: readCrmMessageAiDraftMetadata(record.metadata),
    scheduledAt: record.scheduledAt?.toISOString() ?? null,
    sentAt: record.sentAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

/** Convert one draft version snapshot to the API view shape. */
export function toMessageDraftVersionView(record: CrmMessageDraftVersionRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString()
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

function readCrmMessageAiDraftMetadata(metadata: unknown): CrmAiDraftMetadata | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;

  const value = (metadata as { aiDraft?: unknown }).aiDraft;

  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Partial<CrmAiDraftMetadata>;

  if (record.generated !== true || typeof record.reason !== 'string' || !Array.isArray(record.riskNotes)) {
    return null;
  }

  if (!record.snapshot || typeof record.snapshot !== 'object' || Array.isArray(record.snapshot)) {
    return null;
  }

  return record as CrmAiDraftMetadata;
}
