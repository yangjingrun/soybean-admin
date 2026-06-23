import { Inject } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  createDefaultAiDraftQueueConfig,
  createDefaultGlobalConfig,
  normalizePositiveConfigInteger,
  toAiDraftQueueConfigRecord,
  toGlobalConfigRecord,
  toNullableJsonInput,
  toOrganizationConfigRecord,
  toSendPreferenceRecord
} from './prisma-crm-store.helpers';
import {
  defaultCrmAiDraftItemConcurrency,
  defaultCrmAiDraftMaxAttempts,
  defaultCrmAiDraftRetryBackoffSeconds,
  maxCrmAiDraftItemConcurrency,
  normalizeCrmAiDraftItemConcurrency,
  normalizeCrmAiDraftMaxAttempts
} from '../crm-ai-draft-task-state';
import {
  crmGlobalConfigKey,
  serializeCrmSendWindows,
  serializeCrmSendWorkdays,
  normalizeEmailVerificationCooldownDays,
  normalizeOwnerConcurrentSendLimit,
  normalizeOwnerDailySendLimitMax,
  serializeFollowUpDelayDays
} from '../crm-global-config';
import type {
  CrmAiDraftQueueConfigInput,
  CrmGlobalConfigInput,
  CrmOrganizationConfigInput,
  CrmSendPreferenceInput
} from '../crm.types';

const crmAiDraftQueueConfigKey = 'crm-ai-draft';

export class PrismaCrmConfigStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getGlobalConfig() {
    const record = await this.prisma.crmGlobalConfig.findUnique({
      where: { configKey: crmGlobalConfigKey }
    });

    return record ? toGlobalConfigRecord(record) : createDefaultGlobalConfig();
  }

  async saveGlobalConfig(input: CrmGlobalConfigInput) {
    const emailVerificationCooldownDays = normalizeEmailVerificationCooldownDays(input.emailVerificationCooldownDays);
    const ownerConcurrentSendLimit = normalizeOwnerConcurrentSendLimit(input.ownerConcurrentSendLimit);
    const ownerDailySendLimitMax = normalizeOwnerDailySendLimitMax(input.ownerDailySendLimitMax);
    const followUpDelayDaysText = serializeFollowUpDelayDays(input.followUpDelayDays);
    const sendWorkdaysText = serializeCrmSendWorkdays(input.sendWorkdays);
    const sendWindowsText = serializeCrmSendWindows(input.sendWindows);
    const record = await this.prisma.crmGlobalConfig.upsert({
      where: { configKey: crmGlobalConfigKey },
      create: {
        configKey: crmGlobalConfigKey,
        emailVerificationCooldownDays,
        ownerConcurrentSendLimit,
        ownerDailySendLimitMax,
        followUpDelayDaysText,
        sendWorkdaysText,
        sendWindowsText,
        updatedById: input.updatedById,
        updatedByName: input.updatedByName
      },
      update: {
        emailVerificationCooldownDays,
        ownerConcurrentSendLimit,
        ownerDailySendLimitMax,
        followUpDelayDaysText,
        sendWorkdaysText,
        sendWindowsText,
        updatedById: input.updatedById,
        updatedByName: input.updatedByName
      }
    });

    return toGlobalConfigRecord(record);
  }

  async getAiDraftQueueConfig() {
    const record = await this.prisma.crmAiDraftQueueConfig.findUnique({
      where: { configKey: crmAiDraftQueueConfigKey }
    });

    return record ? toAiDraftQueueConfigRecord(record) : createDefaultAiDraftQueueConfig();
  }

  async saveAiDraftQueueConfig(input: CrmAiDraftQueueConfigInput) {
    const maxItemConcurrency = normalizeCrmAiDraftItemConcurrency(
      input.maxItemConcurrency ?? maxCrmAiDraftItemConcurrency,
      maxCrmAiDraftItemConcurrency
    );
    const itemConcurrency = normalizeCrmAiDraftItemConcurrency(
      input.itemConcurrency ?? defaultCrmAiDraftItemConcurrency,
      maxItemConcurrency
    );
    const maxAttempts = normalizeCrmAiDraftMaxAttempts(input.maxAttempts ?? defaultCrmAiDraftMaxAttempts);
    const record = await this.prisma.crmAiDraftQueueConfig.upsert({
      where: { configKey: crmAiDraftQueueConfigKey },
      create: {
        configKey: crmAiDraftQueueConfigKey,
        itemConcurrency,
        maxItemConcurrency,
        maxActiveTasksPerUser: normalizePositiveConfigInteger(input.maxActiveTasksPerUser, 1),
        maxActiveTasksPerOrg: normalizePositiveConfigInteger(input.maxActiveTasksPerOrg, 2),
        maxAttempts,
        retryBackoffSeconds: toNullableJsonInput(
          input.retryBackoffSeconds ?? [...defaultCrmAiDraftRetryBackoffSeconds]
        ),
        updatedById: input.updatedById ?? null,
        updatedByName: input.updatedByName ?? null
      },
      update: {
        itemConcurrency,
        maxItemConcurrency,
        maxActiveTasksPerUser: normalizePositiveConfigInteger(input.maxActiveTasksPerUser, 1),
        maxActiveTasksPerOrg: normalizePositiveConfigInteger(input.maxActiveTasksPerOrg, 2),
        maxAttempts,
        retryBackoffSeconds: toNullableJsonInput(
          input.retryBackoffSeconds ?? [...defaultCrmAiDraftRetryBackoffSeconds]
        ),
        updatedById: input.updatedById ?? null,
        updatedByName: input.updatedByName ?? null
      }
    });

    return toAiDraftQueueConfigRecord(record);
  }

  async getSendPreference(args: { organizationId: string; ownerUserId: string }) {
    const record = await this.prisma.crmUserSendPreference.findUnique({
      where: {
        organizationId_ownerUserId: {
          organizationId: args.organizationId,
          ownerUserId: args.ownerUserId
        }
      }
    });

    return record ? toSendPreferenceRecord(record) : null;
  }

  async saveSendPreference(input: CrmSendPreferenceInput) {
    const record = await this.prisma.crmUserSendPreference.upsert({
      where: {
        organizationId_ownerUserId: {
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId
        }
      },
      create: {
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        ownerUserName: input.ownerUserName,
        dailySendLimit: input.dailySendLimit,
        followUpSharePercent: input.followUpSharePercent,
        updatedById: input.updatedById,
        updatedByName: input.updatedByName
      },
      update: {
        ownerUserName: input.ownerUserName,
        dailySendLimit: input.dailySendLimit,
        followUpSharePercent: input.followUpSharePercent,
        updatedById: input.updatedById,
        updatedByName: input.updatedByName
      }
    });

    return toSendPreferenceRecord(record);
  }

  async getOrganizationConfig(organizationId: string) {
    const record = await this.prisma.crmOrganizationConfig.findUnique({
      where: { organizationId }
    });

    return record ? toOrganizationConfigRecord(record) : null;
  }

  async saveOrganizationConfig(input: CrmOrganizationConfigInput) {
    const record = await this.prisma.crmOrganizationConfig.upsert({
      where: { organizationId: input.organizationId },
      create: {
        organizationId: input.organizationId,
        allowAdminViewMemberEmailBody: input.allowAdminViewMemberEmailBody,
        updatedById: input.updatedById ?? null,
        updatedByName: input.updatedByName ?? null
      },
      update: {
        allowAdminViewMemberEmailBody: input.allowAdminViewMemberEmailBody,
        updatedById: input.updatedById ?? null,
        updatedByName: input.updatedByName ?? null
      }
    });

    return toOrganizationConfigRecord(record);
  }
}
