import type { CrmGlobalConfigModel } from '../../../generated/prisma/models/CrmGlobalConfig';
import type { CrmOrganizationConfigModel } from '../../../generated/prisma/models/CrmOrganizationConfig';
import type { CrmUserSendPreferenceModel } from '../../../generated/prisma/models/CrmUserSendPreference';
import {
  crmGlobalConfigKey,
  defaultEmailVerificationCooldownDays,
  defaultFollowUpDelayDays,
  defaultOwnerConcurrentSendLimit,
  defaultOwnerDailySendLimitMax,
  normalizeEmailVerificationCooldownDays,
  normalizeFollowUpDelayDays,
  normalizeOwnerConcurrentSendLimit,
  normalizeOwnerDailySendLimitMax
} from '../crm-global-config';
import type { CrmGlobalConfigRecord, CrmOrganizationConfigRecord, CrmSendPreferenceRecord } from '../crm.types';

/** Creates the in-memory CRM global config used when the row has not been initialized. */
export function createDefaultGlobalConfig(): CrmGlobalConfigRecord {
  return {
    configKey: crmGlobalConfigKey,
    emailVerificationCooldownDays: defaultEmailVerificationCooldownDays,
    ownerConcurrentSendLimit: defaultOwnerConcurrentSendLimit,
    ownerDailySendLimitMax: defaultOwnerDailySendLimitMax,
    followUpDelayDays: { ...defaultFollowUpDelayDays },
    updatedAt: new Date(0)
  };
}

/** Maps persisted CRM global config and normalizes defensive numeric settings. */
export function toGlobalConfigRecord(record: CrmGlobalConfigModel): CrmGlobalConfigRecord {
  return {
    configKey: record.configKey,
    emailVerificationCooldownDays: normalizeEmailVerificationCooldownDays(record.emailVerificationCooldownDays),
    ownerConcurrentSendLimit: normalizeOwnerConcurrentSendLimit(record.ownerConcurrentSendLimit),
    ownerDailySendLimitMax: normalizeOwnerDailySendLimitMax(record.ownerDailySendLimitMax),
    followUpDelayDays: normalizeFollowUpDelayDays(record.followUpDelayDaysText),
    updatedAt: record.updatedAt
  };
}

/** Maps one user's send preference row into the CRM settings record. */
export function toSendPreferenceRecord(record: CrmUserSendPreferenceModel): CrmSendPreferenceRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    ownerUserId: record.ownerUserId,
    ownerUserName: record.ownerUserName,
    dailySendLimit: record.dailySendLimit,
    followUpSharePercent: record.followUpSharePercent,
    updatedById: record.updatedById,
    updatedByName: record.updatedByName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

/** Maps organization-level CRM configuration into the domain record. */
export function toOrganizationConfigRecord(record: CrmOrganizationConfigModel): CrmOrganizationConfigRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    allowAdminViewMemberEmailBody: record.allowAdminViewMemberEmailBody,
    updatedById: record.updatedById,
    updatedByName: record.updatedByName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}
