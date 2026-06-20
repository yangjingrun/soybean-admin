import type { CrmTimelineEventModel } from '../../../generated/prisma/models/CrmTimelineEvent';
import type {
  CrmMessageRecord,
  CrmSequenceEnrollmentStatus,
  CrmStrategyStatDimension,
  CrmStrategyStatRow
} from '../crm.types';

/** Creates an empty strategy stat bucket map for every supported dimension. */
export function createEmptyStrategyRows(): Record<CrmStrategyStatDimension, CrmStrategyStatRow[]> {
  return {
    template: [],
    policy: [],
    persona: [],
    productLine: []
  };
}

/** Returns an existing strategy stat row or appends a new zeroed row. */
export function getOrCreateStrategyStatRow(
  rows: CrmStrategyStatRow[],
  input: { dimension: CrmStrategyStatDimension; key: string; name: string }
) {
  const existing = rows.find(row => row.key === input.key);

  if (existing) return existing;

  const row: CrmStrategyStatRow = {
    dimension: input.dimension,
    key: input.key,
    name: input.name,
    sequenceCount: 0,
    draftPendingCount: 0,
    readyCount: 0,
    queuedCount: 0,
    sentCount: 0,
    failedCount: 0,
    repliedCount: 0,
    stoppedCount: 0
  };
  rows.push(row);

  return row;
}

/** Applies enrollment-level status counters to one strategy stat row. */
export function applyEnrollmentStat(row: CrmStrategyStatRow, status: CrmSequenceEnrollmentStatus) {
  row.sequenceCount += 1;

  if (status === 'replied') {
    row.repliedCount += 1;
  }

  if (status === 'stopped') {
    row.stoppedCount += 1;
  }
}

/** Applies message-level status counters to one strategy stat row. */
export function applyMessageStat(row: CrmStrategyStatRow, status: CrmMessageRecord['status']) {
  if (status === 'draft_pending_review') {
    row.draftPendingCount += 1;
  } else if (status === 'draft_ready') {
    row.readyCount += 1;
  } else if (status === 'queued') {
    row.queuedCount += 1;
  } else if (status === 'sent') {
    row.sentCount += 1;
  } else if (status === 'failed') {
    row.failedCount += 1;
  }
}

/** Sorts strategy stat rows by volume and then by display name. */
export function sortStrategyRows(rows: CrmStrategyStatRow[]) {
  return [...rows].sort((left, right) => {
    if (right.sequenceCount !== left.sequenceCount) return right.sequenceCount - left.sequenceCount;
    return left.name.localeCompare(right.name);
  });
}

/** Builds enrollment-to-persona labels from timeline event metadata. */
export function buildPersonaStatMap(events: CrmTimelineEventModel[]) {
  const result = new Map<string, { key: string; name: string }>();

  for (const event of events) {
    const metadata = event.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) continue;

    const enrollmentId = (metadata as Record<string, unknown>).enrollmentId;
    if (typeof enrollmentId !== 'string' || result.has(enrollmentId)) continue;

    const personaProfileId = (metadata as Record<string, unknown>).personaProfileId;
    const personaProfileName = (metadata as Record<string, unknown>).personaProfileName;
    result.set(enrollmentId, {
      key: typeof personaProfileId === 'string' && personaProfileId ? personaProfileId : 'unknown',
      name: typeof personaProfileName === 'string' && personaProfileName ? personaProfileName : '未匹配画像'
    });
  }

  return result;
}
