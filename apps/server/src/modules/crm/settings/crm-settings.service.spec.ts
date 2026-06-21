import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import type { SystemLogRecordInput } from '../../system-log/system-log.types';
import { CrmLoggerService } from '../shared/crm-logger.service';
import type {
  CrmGlobalConfigInput,
  CrmGlobalConfigRecord,
  CrmOrganizationConfigInput,
  CrmOrganizationConfigRecord,
  CrmSendPreferenceInput,
  CrmSendPreferenceRecord,
  CrmUserContext
} from '../crm.types';
import { CrmSettingsService } from './crm-settings.service';
import type { CrmSettingsRepository } from './crm-settings.repository';

describe('CrmSettingsService', () => {
  it('reads and saves platform global CRM config with sanitized log metadata', async () => {
    const repository = createRepository({
      globalConfig: createGlobalConfig({
        emailVerificationCooldownDays: 45,
        ownerConcurrentSendLimit: 8,
        ownerDailySendLimitMax: 120,
        followUpDelayDays: {
          step2Days: 2,
          step3Days: 4,
          step4Days: 8,
          step5Days: 16
        }
      })
    });
    const logs = createLogRecorder();
    const service = createService(repository, logs.service);

    const current = await service.getGlobalConfig();
    const saved = await service.saveGlobalConfig(
      {
        emailVerificationCooldownDays: 60,
        ownerConcurrentSendLimit: 9,
        ownerDailySendLimitMax: 150,
        followUpDelayDays: {
          step2Days: 3,
          step3Days: 6,
          step4Days: 9,
          step5Days: 12
        }
      },
      createContext({ roles: ['R_SUPER'] })
    );

    assert.equal(current.updatedAt, '2026-06-20T09:00:00.000Z');
    assert.equal(saved.emailVerificationCooldownDays, 60);
    assert.equal(saved.ownerConcurrentSendLimit, 9);
    assert.equal(saved.ownerDailySendLimitMax, 150);
    assert.equal(repository.globalConfig.updatedById, 'user-1');
    assert.equal(logs.records[0]?.action, 'save-global-config');
    assert.deepEqual(logs.records[0]?.metadata, {
      emailVerificationCooldownDays: 60,
      ownerConcurrentSendLimit: 9,
      ownerDailySendLimitMax: 150,
      followUpDelayDays: {
        step2Days: 3,
        step3Days: 6,
        step4Days: 9,
        step5Days: 12
      }
    });
  });

  it('reads and saves owner send preference within the platform daily hard limit', async () => {
    const repository = createRepository({
      globalConfig: createGlobalConfig({ ownerDailySendLimitMax: 80 })
    });
    const logs = createLogRecorder();
    const service = createService(repository, logs.service);

    const current = await service.getSendPreference(createContext());
    const saved = await service.saveSendPreference(
      {
        dailySendLimit: 60,
        followUpSharePercent: 75
      },
      createContext()
    );

    assert.deepEqual(current, {
      dailySendLimit: 50,
      followUpSharePercent: 70,
      ownerDailySendLimitMax: 80
    });
    assert.equal(saved.dailySendLimit, 60);
    assert.equal(saved.followUpSharePercent, 75);
    assert.equal(saved.ownerDailySendLimitMax, 80);
    assert.equal(repository.sendPreference?.organizationId, 'org-1');
    assert.equal(repository.sendPreference?.ownerUserId, 'user-1');
    assert.equal(logs.records[0]?.action, 'save-send-preference');
    await assert.rejects(
      () => service.saveSendPreference({ dailySendLimit: 81, followUpSharePercent: 70 }, createContext()),
      /不能超过平台硬上限 80 封/
    );
  });

  it('reads and saves organization CRM permission config by organization administrators', async () => {
    const repository = createRepository();
    const logs = createLogRecorder();
    const service = createService(repository, logs.service);
    const adminContext = createContext({
      buttons: ['crm:settings:rules:write'],
      organizationRole: 'admin'
    });

    const current = await service.getOrganizationConfig(createContext());
    const saved = await service.saveOrganizationConfig({ allowAdminViewMemberEmailBody: true }, adminContext);

    assert.deepEqual(current, {
      id: null,
      organizationId: 'org-1',
      allowAdminViewMemberEmailBody: false,
      updatedAt: null
    });
    assert.equal(saved.allowAdminViewMemberEmailBody, true);
    assert.equal(repository.organizationConfig?.organizationId, 'org-1');
    assert.equal(repository.organizationConfig?.updatedById, 'user-1');
    assert.equal(logs.records[0]?.action, 'save-organization-config');
    await assert.rejects(
      () => service.saveOrganizationConfig({ allowAdminViewMemberEmailBody: false }, createContext()),
      ForbiddenException
    );
  });
});

function createContext(overrides: Partial<CrmUserContext> = {}): CrmUserContext {
  return {
    userId: 'user-1',
    userName: 'Alice',
    roles: ['R_USER'],
    organizationId: 'org-1',
    organizationRole: 'member',
    ...overrides
  };
}

function createRepository(initialData: { globalConfig?: TestGlobalConfig } = {}) {
  const repository = {
    globalConfig: initialData.globalConfig ?? createGlobalConfig(),
    sendPreference: null as TestSendPreference | null,
    organizationConfig: null as TestOrganizationConfig | null,
    async getGlobalConfig() {
      return this.globalConfig;
    },
    async saveGlobalConfig(input: CrmGlobalConfigInput) {
      this.globalConfig = createGlobalConfig({
        ...this.globalConfig,
        ...input
      });

      return this.globalConfig;
    },
    async getSendPreference(input: { organizationId: string; ownerUserId: string }) {
      if (
        this.sendPreference?.organizationId === input.organizationId &&
        this.sendPreference.ownerUserId === input.ownerUserId
      ) {
        return this.sendPreference;
      }

      return null;
    },
    async saveSendPreference(input: CrmSendPreferenceInput) {
      this.sendPreference = createSendPreference(input);

      return this.sendPreference;
    },
    async getOrganizationConfig(organizationId: string) {
      return this.organizationConfig?.organizationId === organizationId ? this.organizationConfig : null;
    },
    async saveOrganizationConfig(input: CrmOrganizationConfigInput) {
      this.organizationConfig = createOrganizationConfig(input);

      return this.organizationConfig;
    }
  };

  return repository;
}

function createService(repository: ReturnType<typeof createRepository>, crmLogger: CrmLoggerService) {
  return new CrmSettingsService(repository as unknown as CrmSettingsRepository, null, crmLogger);
}

function createGlobalConfig(input: Partial<TestGlobalConfig> = {}): TestGlobalConfig {
  return {
    configKey: input.configKey ?? 'default',
    emailVerificationCooldownDays: input.emailVerificationCooldownDays ?? 30,
    ownerConcurrentSendLimit: input.ownerConcurrentSendLimit ?? 5,
    ownerDailySendLimitMax: input.ownerDailySendLimitMax ?? 200,
    followUpDelayDays: input.followUpDelayDays ?? {
      step2Days: 3,
      step3Days: 7,
      step4Days: 14,
      step5Days: 21
    },
    updatedAt: input.updatedAt ?? new Date('2026-06-20T09:00:00.000Z'),
    updatedById: input.updatedById ?? null,
    updatedByName: input.updatedByName ?? null
  };
}

function createSendPreference(input: CrmSendPreferenceInput): TestSendPreference {
  return {
    id: 'send-preference-1',
    organizationId: input.organizationId,
    ownerUserId: input.ownerUserId,
    ownerUserName: input.ownerUserName ?? null,
    dailySendLimit: input.dailySendLimit,
    followUpSharePercent: input.followUpSharePercent,
    updatedById: input.updatedById ?? null,
    updatedByName: input.updatedByName ?? null,
    createdAt: new Date('2026-06-20T09:00:00.000Z'),
    updatedAt: new Date('2026-06-20T09:00:00.000Z')
  };
}

function createOrganizationConfig(input: CrmOrganizationConfigInput): TestOrganizationConfig {
  return {
    id: 'organization-config-1',
    organizationId: input.organizationId,
    allowAdminViewMemberEmailBody: input.allowAdminViewMemberEmailBody,
    updatedById: input.updatedById ?? null,
    updatedByName: input.updatedByName ?? null,
    createdAt: new Date('2026-06-20T09:00:00.000Z'),
    updatedAt: new Date('2026-06-20T09:00:00.000Z')
  };
}

function createLogRecorder() {
  const records: SystemLogRecordInput[] = [];

  return {
    records,
    service: {
      async record(action: string, message: string, context: CrmUserContext, metadata: Record<string, unknown>) {
        records.push({
          level: 'info',
          status: 'success',
          module: 'crm',
          action,
          message,
          userId: context.userId,
          userName: context.userName,
          metadata
        });
      }
    } as unknown as CrmLoggerService
  };
}

type TestGlobalConfig = CrmGlobalConfigRecord & {
  updatedById?: string | null;
  updatedByName?: string | null;
};
type TestSendPreference = CrmSendPreferenceRecord;
type TestOrganizationConfig = CrmOrganizationConfigRecord;
