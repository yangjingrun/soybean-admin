import type { CrmMailboxModel } from '../../../generated/prisma/models/CrmMailbox';
import type { CrmMailboxRecord } from '../crm.types';

/** Maps a mailbox row while narrowing provider, status, warmup, and sync issue fields. */
export function toMailboxRecord(record: CrmMailboxModel): CrmMailboxRecord {
  return {
    ...record,
    provider: record.provider as CrmMailboxRecord['provider'],
    status: record.status as CrmMailboxRecord['status'],
    warmupStage: record.warmupStage as CrmMailboxRecord['warmupStage'],
    syncIssueType: record.syncIssueType as CrmMailboxRecord['syncIssueType']
  };
}
