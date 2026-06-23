import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import {
  defaultFollowUpSharePercent,
  defaultOwnerDailySendLimit,
  normalizeFollowUpSharePercent,
  normalizeOwnerDailySendLimit,
  normalizeOwnerDailySendLimitMax
} from '../crm-global-config';
import { requirePermission } from '../../../shared/permission-policy';
import { CRM_AI_DRAFT_TASK_QUEUE, CRM_SETTINGS_REPOSITORY } from '../crm.tokens';
import type {
  CrmAiDraftQueueConfigInput,
  CrmAiDraftTaskQueuePort,
  CrmGlobalConfigRecord,
  CrmOrganizationConfigRecord,
  CrmSendPreferenceRecord,
  CrmUserContext
} from '../crm.types';
import { CrmLoggerService } from '../shared/crm-logger.service';
import type { CrmSettingsRepository } from './crm-settings.repository';

@Injectable()
export class CrmSettingsService {
  constructor(
    @Inject(CRM_SETTINGS_REPOSITORY) private readonly settingsRepository: CrmSettingsRepository,
    @Optional()
    @Inject(CRM_AI_DRAFT_TASK_QUEUE)
    private readonly aiDraftTaskQueue?: CrmAiDraftTaskQueuePort | null,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

  /** Read platform-wide CRM settings maintained by super administrators. */
  async getGlobalConfig() {
    return toGlobalConfigView(await this.settingsRepository.getGlobalConfig());
  }

  /** Save platform-wide CRM settings maintained by super administrators. */
  async saveGlobalConfig(
    input: {
      emailVerificationCooldownDays: number;
      ownerConcurrentSendLimit?: number;
      ownerDailySendLimitMax?: number;
      followUpDelayDays?: CrmGlobalConfigRecord['followUpDelayDays'];
      sendWorkdays?: CrmGlobalConfigRecord['sendWorkdays'];
      sendWindows?: CrmGlobalConfigRecord['sendWindows'];
    },
    context: CrmUserContext
  ) {
    requirePermission(context, 'crm:settings:global:write', '无权维护 CRM 全局配置');

    const record = await this.settingsRepository.saveGlobalConfig({
      emailVerificationCooldownDays: input.emailVerificationCooldownDays,
      ownerConcurrentSendLimit: input.ownerConcurrentSendLimit,
      ownerDailySendLimitMax: input.ownerDailySendLimitMax,
      followUpDelayDays: input.followUpDelayDays,
      sendWorkdays: input.sendWorkdays,
      sendWindows: input.sendWindows,
      updatedById: context.userId,
      updatedByName: context.userName
    });

    await this.crmLogger?.record('save-global-config', 'CRM 全局配置已保存', context, {
      emailVerificationCooldownDays: record.emailVerificationCooldownDays,
      ownerConcurrentSendLimit: record.ownerConcurrentSendLimit,
      ownerDailySendLimitMax: record.ownerDailySendLimitMax,
      followUpDelayDays: record.followUpDelayDays,
      sendWorkdays: record.sendWorkdays,
      sendWindows: record.sendWindows
    });

    return toGlobalConfigView(record);
  }

  /** Read the current owner's send scheduling preference with platform cap context. */
  async getSendPreference(context: CrmUserContext) {
    const [globalConfig, preference] = await Promise.all([
      this.settingsRepository.getGlobalConfig(),
      this.settingsRepository.getSendPreference({
        organizationId: context.organizationId,
        ownerUserId: context.userId
      })
    ]);
    const ownerDailySendLimitMax = normalizeOwnerDailySendLimitMax(globalConfig.ownerDailySendLimitMax);

    return toSendPreferenceView(preference, ownerDailySendLimitMax);
  }

  /** Save the current owner's daily send scheduling preference. */
  async saveSendPreference(input: { dailySendLimit: number; followUpSharePercent: number }, context: CrmUserContext) {
    const globalConfig = await this.settingsRepository.getGlobalConfig();
    const ownerDailySendLimitMax = normalizeOwnerDailySendLimitMax(globalConfig.ownerDailySendLimitMax);
    const dailySendLimit = Number(input.dailySendLimit);

    if (!Number.isInteger(dailySendLimit) || dailySendLimit <= 0) {
      throw new BadRequestException('每日进入发送队列数量必须是正整数');
    }

    if (dailySendLimit > ownerDailySendLimitMax) {
      throw new BadRequestException(`每日进入发送队列数量不能超过平台硬上限 ${ownerDailySendLimitMax} 封`);
    }

    const followUpSharePercent = Number(input.followUpSharePercent);

    if (!Number.isInteger(followUpSharePercent) || followUpSharePercent < 0 || followUpSharePercent > 100) {
      throw new BadRequestException('后续开发信占比必须是 0-100 的整数');
    }

    const record = await this.settingsRepository.saveSendPreference({
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      ownerUserName: context.userName,
      dailySendLimit: normalizeOwnerDailySendLimit(dailySendLimit, ownerDailySendLimitMax),
      followUpSharePercent: normalizeFollowUpSharePercent(followUpSharePercent),
      updatedById: context.userId,
      updatedByName: context.userName
    });

    await this.crmLogger?.record('save-send-preference', 'CRM 个人发送偏好已保存', context, {
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      dailySendLimit: record.dailySendLimit,
      followUpSharePercent: record.followUpSharePercent,
      ownerDailySendLimitMax
    });

    return toSendPreferenceView(record, ownerDailySendLimitMax);
  }

  /** Read organization-level CRM permission settings. */
  async getOrganizationConfig(context: CrmUserContext) {
    const record = await this.settingsRepository.getOrganizationConfig(context.organizationId);

    return toOrganizationConfigView(record, context.organizationId);
  }

  /** Save organization-level CRM permission settings for organization administrators. */
  async saveOrganizationConfig(input: { allowAdminViewMemberEmailBody: boolean }, context: CrmUserContext) {
    requirePermission(context, 'crm:settings:rules:write', '无权维护 CRM 发送规则');

    const record = await this.settingsRepository.saveOrganizationConfig({
      organizationId: context.organizationId,
      allowAdminViewMemberEmailBody: input.allowAdminViewMemberEmailBody,
      updatedById: context.userId,
      updatedByName: context.userName
    });

    await this.crmLogger?.record('save-organization-config', 'CRM 组织权限配置已保存', context, {
      organizationId: context.organizationId,
      allowAdminViewMemberEmailBody: record.allowAdminViewMemberEmailBody
    });

    return toOrganizationConfigView(record, context.organizationId);
  }

  /** Read CRM AI draft queue configuration. */
  async getAiDraftQueueConfig() {
    return toAiDraftQueueConfigView(await this.settingsRepository.getAiDraftQueueConfig());
  }

  /** Save CRM AI draft queue configuration and apply runtime concurrency. */
  async saveAiDraftQueueConfig(input: CrmAiDraftQueueConfigInput, context: CrmUserContext) {
    requirePermission(context, 'crm:settings:ai-draft-queue:write', '无权维护 CRM AI 草稿队列');

    const config = await this.settingsRepository.saveAiDraftQueueConfig({
      ...input,
      updatedById: context.userId,
      updatedByName: context.userName
    });

    await this.aiDraftTaskQueue?.applyGlobalConcurrency(config.maxActiveTasksPerOrg);
    await this.crmLogger?.record('ai-draft-queue-config-save', 'CRM AI 草稿队列配置保存', context, {
      itemConcurrency: config.itemConcurrency,
      maxItemConcurrency: config.maxItemConcurrency,
      maxActiveTasksPerUser: config.maxActiveTasksPerUser,
      maxActiveTasksPerOrg: config.maxActiveTasksPerOrg,
      maxAttempts: config.maxAttempts
    });

    return toAiDraftQueueConfigView(config);
  }
}

function toGlobalConfigView(record: CrmGlobalConfigRecord) {
  return {
    ...record,
    updatedAt: record.updatedAt.toISOString()
  };
}

function toSendPreferenceView(record: CrmSendPreferenceRecord | null, ownerDailySendLimitMax: number) {
  return {
    dailySendLimit: record?.dailySendLimit ?? Math.min(defaultOwnerDailySendLimit, ownerDailySendLimitMax),
    followUpSharePercent: record?.followUpSharePercent ?? defaultFollowUpSharePercent,
    ownerDailySendLimitMax
  };
}

function toOrganizationConfigView(record: CrmOrganizationConfigRecord | null, organizationId: string) {
  return {
    id: record?.id ?? null,
    organizationId,
    allowAdminViewMemberEmailBody: record?.allowAdminViewMemberEmailBody ?? false,
    updatedAt: record?.updatedAt.toISOString() ?? null
  };
}

function toAiDraftQueueConfigView(record: Awaited<ReturnType<CrmSettingsRepository['getAiDraftQueueConfig']>>) {
  return {
    ...record,
    updatedAt: record.updatedAt.toISOString()
  };
}
