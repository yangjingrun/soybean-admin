import type { CrmAccountModel } from '../../../generated/prisma/models/CrmAccount';
import type { CrmArchivedFingerprintModel } from '../../../generated/prisma/models/CrmArchivedFingerprint';
import type { CrmBlacklistModel } from '../../../generated/prisma/models/CrmBlacklist';
import type { CrmContactModel } from '../../../generated/prisma/models/CrmContact';
import type { CrmEmailVerificationCacheModel } from '../../../generated/prisma/models/CrmEmailVerificationCache';
import type { CrmLeadEnrichmentHistoryModel } from '../../../generated/prisma/models/CrmLeadEnrichmentHistory';
import type { CrmTimelineEventModel } from '../../../generated/prisma/models/CrmTimelineEvent';
import type {
  CrmAccountRecord,
  CrmArchivedFingerprintRecord,
  CrmBlacklistRecord,
  CrmContactRecord,
  CrmEmailVerificationCacheRecord,
  CrmLeadEnrichmentHistoryRecord,
  CrmTimelineEventRecord
} from '../crm.types';

/** Maps a Prisma account model to the CRM domain account record. */
export function toAccountRecord(record: CrmAccountModel): CrmAccountRecord {
  return {
    ...record,
    status: record.status as CrmAccountRecord['status']
  };
}

/** Maps an archived fingerprint model while narrowing the fingerprint type. */
export function toArchivedFingerprintRecord(record: CrmArchivedFingerprintModel): CrmArchivedFingerprintRecord {
  return {
    ...record,
    fingerprintType: record.fingerprintType as CrmArchivedFingerprintRecord['fingerprintType']
  };
}

/** Maps a blacklist model while narrowing its reason enum. */
export function toBlacklistRecord(record: CrmBlacklistModel): CrmBlacklistRecord {
  return {
    ...record,
    reason: record.reason as CrmBlacklistRecord['reason']
  };
}

/** Maps a Prisma contact model to the CRM domain contact record. */
export function toContactRecord(record: CrmContactModel): CrmContactRecord {
  return {
    ...record,
    emailStatus: record.emailStatus as CrmContactRecord['emailStatus'],
    emailProgressStatus: 'not_generated',
    emailProgressLabel: '首封待生成',
    emailProgressAt: null,
    emailProgressMessageId: null,
    emailProgressStepIndex: null,
    emailProgressTotalSteps: null
  };
}

/** Maps cached email verification state into the CRM domain record. */
export function toEmailVerificationCacheRecord(
  record: CrmEmailVerificationCacheModel
): CrmEmailVerificationCacheRecord {
  return {
    ...record,
    status: record.status as CrmEmailVerificationCacheRecord['status'],
    reason: record.reason as CrmEmailVerificationCacheRecord['reason']
  };
}

/** Maps provider enrichment history into the CRM domain record. */
export function toLeadEnrichmentHistoryRecord(record: CrmLeadEnrichmentHistoryModel): CrmLeadEnrichmentHistoryRecord {
  return {
    ...record,
    provider: record.provider as CrmLeadEnrichmentHistoryRecord['provider'],
    identityType: record.identityType as CrmLeadEnrichmentHistoryRecord['identityType'],
    status: record.status as CrmLeadEnrichmentHistoryRecord['status']
  };
}

/** Maps a timeline event model to the CRM timeline record. */
export function toTimelineEventRecord(record: CrmTimelineEventModel): CrmTimelineEventRecord {
  return record;
}
