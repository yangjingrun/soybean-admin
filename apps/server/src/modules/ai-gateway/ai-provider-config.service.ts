import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { RequestUserContext } from '../../shared/request-context';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import {
  defaultHunterApiBase,
  defaultHunterConfigKey,
  defaultSerperApiBase,
  defaultSerperConfigKey
} from './ai-gateway.constants';
import {
  AI_USER_HUNTER_CONFIG_STORE,
  AI_USER_SERPER_CONFIG_STORE,
  HUNTER_CONFIG_STORE,
  SERPER_CONFIG_STORE
} from './ai-gateway.tokens';
import type { SaveHunterConfigDto, SaveMyHunterConfigDto } from './dto/hunter-config.dto';
import type { SaveMySerperConfigDto, SaveSerperConfigDto } from './dto/serper-config.dto';
import { HunterClient } from './hunter-client.service';
import { SerperClient } from './serper-client.service';
import type {
  AiUserHunterConfigRecord,
  AiUserHunterConfigStore,
  AiUserHunterConfigViewRecord,
  AiUserSerperConfigRecord,
  AiUserSerperConfigStore,
  AiUserSerperConfigViewRecord,
  HunterConfigRecord,
  HunterConfigStore,
  HunterConfigViewRecord,
  SerperConfigRecord,
  SerperConfigStore,
  SerperConfigViewRecord,
  SecretViewFields
} from './ai-gateway.types';

export interface AiProviderConfigContext {
  user?: RequestUserContext | null;
}

@Injectable()
export class AiProviderConfigService {
  constructor(
    @Inject(AI_USER_SERPER_CONFIG_STORE) private readonly userSerperConfigStore: AiUserSerperConfigStore,
    @Inject(AI_USER_HUNTER_CONFIG_STORE) private readonly userHunterConfigStore: AiUserHunterConfigStore,
    @Inject(SERPER_CONFIG_STORE) private readonly serperConfigStore: SerperConfigStore,
    @Inject(SerperClient) private readonly serperClient: Pick<SerperClient, 'search'>,
    @Inject(HUNTER_CONFIG_STORE) private readonly hunterConfigStore: HunterConfigStore,
    @Inject(HunterClient) private readonly hunterClient: Pick<HunterClient, 'domainSearch'>,
    @Inject(SystemLogService) private readonly systemLogService: SystemLogRecorder
  ) {}

  /** Saves the Serper search channel used by AI leads search orchestration. */
  async saveSerperConfig(
    dto: SaveSerperConfigDto,
    context: AiProviderConfigContext = {}
  ): Promise<SerperConfigViewRecord> {
    const configKey = normalizeSerperConfigKey(dto.configKey);
    const record = await this.serperConfigStore.saveSerperConfig({
      configKey,
      title: dto.title.trim() || 'Serper 搜索',
      apiBase: dto.apiBase.trim(),
      apiKey: dto.apiKey.trim(),
      updatedAt: new Date().toISOString()
    });

    await this.systemLogService.record({
      level: 'info',
      status: 'success',
      module: 'ai-gateway',
      action: 'save-serper-config',
      message: 'Serper 搜索配置已保存',
      userId: context.user?.userId,
      userName: context.user?.userName,
      metadata: {
        configKey: record.configKey,
        apiBase: record.apiBase
      }
    });

    return toSerperConfigView(record);
  }

  /** Reads one saved Serper search channel by key. */
  async getSerperConfig(configKey = defaultSerperConfigKey): Promise<SerperConfigRecord> {
    const normalizedKey = normalizeSerperConfigKey(configKey);
    const record = await this.serperConfigStore.getSerperConfig(normalizedKey);

    if (!record) {
      throw new NotFoundException(`未找到 Serper 配置：${normalizedKey}`);
    }

    return record;
  }

  /** Reads a saved Serper channel or returns an editable default draft for settings. */
  async getSerperConfigDraft(configKey = defaultSerperConfigKey): Promise<SerperConfigViewRecord> {
    const normalizedKey = normalizeSerperConfigKey(configKey);
    const record = await this.serperConfigStore.getSerperConfig(normalizedKey);

    return toSerperConfigView(record ?? createSerperConfigDraft(normalizedKey));
  }

  /** Saves the current user's personal Serper search channel. */
  async saveMySerperConfig(
    dto: SaveMySerperConfigDto,
    user: RequestUserContext
  ): Promise<AiUserSerperConfigViewRecord> {
    const apiKey = await this.resolvePersonalSerperApiKey(dto, user);
    const record = await this.userSerperConfigStore.saveUserSerperConfig({
      userId: user.userId,
      title: dto.title.trim() || 'Serper 搜索',
      apiBase: dto.apiBase.trim(),
      apiKey,
      updatedAt: new Date().toISOString()
    });

    await this.systemLogService.record({
      level: 'info',
      status: 'success',
      module: 'ai-gateway',
      action: 'save-my-serper-config',
      message: '个人 Serper 搜索配置已保存',
      userId: user.userId,
      userName: user.userName,
      metadata: {
        apiBase: record.apiBase
      }
    });

    return toUserSerperConfigView(record);
  }

  /** Reads the current user's personal Serper channel or returns an editable draft. */
  async getMySerperConfigDraft(user: RequestUserContext): Promise<AiUserSerperConfigViewRecord> {
    const record = await this.userSerperConfigStore.getUserSerperConfig(user.userId);

    return toUserSerperConfigView(record ?? createUserSerperConfigDraft(user.userId));
  }

  /**
   * Resolves the Serper channel for one user-scoped business request.
   * Later pool allocation can be inserted here without changing callers.
   */
  async getRequiredUserSerperConfig(user: RequestUserContext): Promise<SerperConfigRecord> {
    const record = await this.resolveUserSerperConfig(user);

    if (!record?.apiKey.trim()) {
      throw new BadRequestException('请先配置个人 Serper 搜索');
    }

    return toSerperRuntimeConfig(record);
  }

  /** Sends one lightweight Search request with the current user's candidate Serper config. */
  async testMySerperConfig(dto: SaveMySerperConfigDto, user: RequestUserContext) {
    const record = await this.toCandidateUserSerperConfig(dto, user);
    const result = await this.serperClient.search(toSerperRuntimeConfig(record), {
      q: 'test',
      gl: 'us',
      hl: 'en',
      num: 1,
      page: 1
    });

    await this.systemLogService.record({
      level: 'info',
      status: 'success',
      module: 'ai-gateway',
      action: 'test-my-serper-config',
      message: '个人 Serper 搜索配置测试成功',
      userId: user.userId,
      userName: user.userName,
      metadata: {
        apiBase: record.apiBase
      }
    });

    return {
      ok: true,
      result
    };
  }

  /** Sends one lightweight Search request with a candidate Serper config. */
  async testSerperConfig(dto: SaveSerperConfigDto, context: AiProviderConfigContext = {}) {
    const record = {
      configKey: normalizeSerperConfigKey(dto.configKey),
      title: dto.title.trim() || 'Serper 搜索',
      apiBase: dto.apiBase.trim(),
      apiKey: dto.apiKey.trim(),
      updatedAt: new Date().toISOString()
    };
    const result = await this.serperClient.search(record, {
      q: 'test',
      gl: 'us',
      hl: 'en',
      num: 1,
      page: 1
    });

    await this.systemLogService.record({
      level: 'info',
      status: 'success',
      module: 'ai-gateway',
      action: 'test-serper-config',
      message: 'Serper 搜索配置测试成功',
      userId: context.user?.userId,
      userName: context.user?.userName,
      metadata: {
        configKey: record.configKey,
        apiBase: record.apiBase
      }
    });

    return {
      ok: true,
      result
    };
  }

  /** Saves the Hunter Domain Search channel used to enrich AI lead contacts. */
  async saveHunterConfig(
    dto: SaveHunterConfigDto,
    context: AiProviderConfigContext = {}
  ): Promise<HunterConfigViewRecord> {
    const configKey = normalizeHunterConfigKey(dto.configKey);
    const record = await this.hunterConfigStore.saveHunterConfig({
      configKey,
      title: dto.title.trim() || 'Hunter 邮箱补全',
      apiBase: dto.apiBase.trim(),
      apiKey: dto.apiKey.trim(),
      updatedAt: new Date().toISOString()
    });

    await this.systemLogService.record({
      level: 'info',
      status: 'success',
      module: 'ai-gateway',
      action: 'save-hunter-config',
      message: 'Hunter 邮箱补全配置已保存',
      userId: context.user?.userId,
      userName: context.user?.userName,
      metadata: {
        configKey: record.configKey,
        apiBase: record.apiBase
      }
    });

    return toHunterConfigView(record);
  }

  /** Reads one saved Hunter channel by key. */
  async getHunterConfig(configKey = defaultHunterConfigKey): Promise<HunterConfigRecord> {
    const normalizedKey = normalizeHunterConfigKey(configKey);
    const record = await this.hunterConfigStore.getHunterConfig(normalizedKey);

    if (!record) {
      throw new NotFoundException(`未找到 Hunter 配置：${normalizedKey}`);
    }

    return record;
  }

  /** Reads a saved Hunter channel or returns an editable default draft for settings. */
  async getHunterConfigDraft(configKey = defaultHunterConfigKey): Promise<HunterConfigViewRecord> {
    const normalizedKey = normalizeHunterConfigKey(configKey);
    const record = await this.hunterConfigStore.getHunterConfig(normalizedKey);

    return toHunterConfigView(record ?? createHunterConfigDraft(normalizedKey));
  }

  /** Saves the current user's personal Hunter Domain Search channel. */
  async saveMyHunterConfig(
    dto: SaveMyHunterConfigDto,
    user: RequestUserContext
  ): Promise<AiUserHunterConfigViewRecord> {
    const apiKey = await this.resolvePersonalHunterApiKey(dto, user);
    const record = await this.userHunterConfigStore.saveUserHunterConfig({
      userId: user.userId,
      title: dto.title.trim() || 'Hunter 邮箱补全',
      apiBase: dto.apiBase.trim(),
      apiKey,
      updatedAt: new Date().toISOString()
    });

    await this.systemLogService.record({
      level: 'info',
      status: 'success',
      module: 'ai-gateway',
      action: 'save-my-hunter-config',
      message: '个人 Hunter 邮箱补全配置已保存',
      userId: user.userId,
      userName: user.userName,
      metadata: {
        apiBase: record.apiBase
      }
    });

    return toUserHunterConfigView(record);
  }

  /** Reads the current user's personal Hunter channel or returns an editable draft. */
  async getMyHunterConfigDraft(user: RequestUserContext): Promise<AiUserHunterConfigViewRecord> {
    const record = await this.userHunterConfigStore.getUserHunterConfig(user.userId);

    return toUserHunterConfigView(record ?? createUserHunterConfigDraft(user.userId));
  }

  /**
   * Resolves the Hunter channel for one user-scoped business request.
   * Later pool allocation can be inserted here without changing callers.
   */
  async getRequiredUserHunterConfig(user: RequestUserContext): Promise<HunterConfigRecord> {
    const record = await this.resolveUserHunterConfig(user);

    if (!record?.apiKey.trim()) {
      throw new BadRequestException('请先配置个人 Hunter 邮箱补全');
    }

    return toHunterRuntimeConfig(record);
  }

  /** Sends one lightweight Domain Search request with the current user's candidate Hunter config. */
  async testMyHunterConfig(dto: SaveMyHunterConfigDto, user: RequestUserContext) {
    const record = await this.toCandidateUserHunterConfig(dto, user);
    const result = await this.hunterClient.domainSearch(toHunterRuntimeConfig(record), {
      domain: 'example.com',
      limit: 1,
      offset: 0
    });

    await this.systemLogService.record({
      level: 'info',
      status: 'success',
      module: 'ai-gateway',
      action: 'test-my-hunter-config',
      message: '个人 Hunter 邮箱补全配置测试成功',
      userId: user.userId,
      userName: user.userName,
      metadata: {
        apiBase: record.apiBase,
        resultEmailCount: countHunterResultEmails(result)
      }
    });

    return {
      ok: true,
      resultEmailCount: countHunterResultEmails(result)
    };
  }

  /** Sends one lightweight Domain Search request with a candidate Hunter config. */
  async testHunterConfig(dto: SaveHunterConfigDto, context: AiProviderConfigContext = {}) {
    const record = {
      configKey: normalizeHunterConfigKey(dto.configKey),
      title: dto.title.trim() || 'Hunter 邮箱补全',
      apiBase: dto.apiBase.trim(),
      apiKey: dto.apiKey.trim(),
      updatedAt: new Date().toISOString()
    };
    const result = await this.hunterClient.domainSearch(record, {
      domain: 'example.com',
      limit: 1,
      offset: 0
    });

    await this.systemLogService.record({
      level: 'info',
      status: 'success',
      module: 'ai-gateway',
      action: 'test-hunter-config',
      message: 'Hunter 邮箱补全配置测试成功',
      userId: context.user?.userId,
      userName: context.user?.userName,
      metadata: {
        configKey: record.configKey,
        apiBase: record.apiBase,
        resultEmailCount: countHunterResultEmails(result)
      }
    });

    return {
      ok: true,
      resultEmailCount: countHunterResultEmails(result)
    };
  }

  private async resolvePersonalSerperApiKey(dto: SaveMySerperConfigDto, user: RequestUserContext) {
    const nextApiKey = dto.apiKey?.trim();

    if (nextApiKey) {
      return nextApiKey;
    }

    const existing = await this.userSerperConfigStore.getUserSerperConfig(user.userId);

    if (!existing?.apiKey.trim()) {
      throw new BadRequestException('请先填写个人 Serper API Key');
    }

    return existing.apiKey;
  }

  private async resolvePersonalHunterApiKey(dto: SaveMyHunterConfigDto, user: RequestUserContext) {
    const nextApiKey = dto.apiKey?.trim();

    if (nextApiKey) {
      return nextApiKey;
    }

    const existing = await this.userHunterConfigStore.getUserHunterConfig(user.userId);

    if (!existing?.apiKey.trim()) {
      throw new BadRequestException('请先填写个人 Hunter API Key');
    }

    return existing.apiKey;
  }

  private async toCandidateUserSerperConfig(
    dto: SaveMySerperConfigDto,
    user: RequestUserContext
  ): Promise<AiUserSerperConfigRecord> {
    return {
      userId: user.userId,
      title: dto.title.trim() || 'Serper 搜索',
      apiBase: dto.apiBase.trim(),
      apiKey: await this.resolvePersonalSerperApiKey(dto, user),
      updatedAt: new Date().toISOString()
    };
  }

  private async toCandidateUserHunterConfig(
    dto: SaveMyHunterConfigDto,
    user: RequestUserContext
  ): Promise<AiUserHunterConfigRecord> {
    return {
      userId: user.userId,
      title: dto.title.trim() || 'Hunter 邮箱补全',
      apiBase: dto.apiBase.trim(),
      apiKey: await this.resolvePersonalHunterApiKey(dto, user),
      updatedAt: new Date().toISOString()
    };
  }

  private resolveUserSerperConfig(user: RequestUserContext) {
    return this.userSerperConfigStore.getUserSerperConfig(user.userId);
  }

  private resolveUserHunterConfig(user: RequestUserContext) {
    return this.userHunterConfigStore.getUserHunterConfig(user.userId);
  }
}

function normalizeSerperConfigKey(configKey?: string) {
  const normalized = configKey?.trim() || defaultSerperConfigKey;

  if (!normalized) {
    throw new BadRequestException('Serper 配置 key 不能为空');
  }

  return normalized;
}

function normalizeHunterConfigKey(configKey?: string) {
  const normalized = configKey?.trim() || defaultHunterConfigKey;

  if (!normalized) {
    throw new BadRequestException('Hunter 配置 key 不能为空');
  }

  return normalized;
}

function toSerperConfigView(record: SerperConfigRecord): SerperConfigViewRecord {
  const { apiKey, ...view } = record;

  return {
    ...view,
    apiKey,
    ...toSecretView(apiKey)
  };
}

function toHunterConfigView(record: HunterConfigRecord): HunterConfigViewRecord {
  const { apiKey, ...view } = record;

  return {
    ...view,
    apiKey,
    ...toSecretView(apiKey)
  };
}

function toUserSerperConfigView(record: AiUserSerperConfigRecord): AiUserSerperConfigViewRecord {
  const { userId: _userId, apiKey, ...view } = record;

  return {
    ...view,
    apiKey,
    ...toSecretView(apiKey)
  };
}

function toUserHunterConfigView(record: AiUserHunterConfigRecord): AiUserHunterConfigViewRecord {
  const { userId: _userId, apiKey, ...view } = record;

  return {
    ...view,
    apiKey,
    ...toSecretView(apiKey)
  };
}

export function toSecretView(apiKey: string): SecretViewFields {
  const key = apiKey.trim();

  if (!key) {
    return {
      hasApiKey: false,
      maskedApiKey: ''
    };
  }

  return {
    hasApiKey: true,
    maskedApiKey: maskSecret(key)
  };
}

function maskSecret(secret: string) {
  if (secret.length <= 8) {
    return '****';
  }

  return `${secret.slice(0, 4)}****${secret.slice(-4)}`;
}

function createSerperConfigDraft(configKey: string): SerperConfigRecord {
  return {
    configKey,
    title: 'Serper 搜索',
    apiBase: defaultSerperApiBase,
    apiKey: '',
    updatedAt: ''
  };
}

function createHunterConfigDraft(configKey: string): HunterConfigRecord {
  return {
    configKey,
    title: 'Hunter 邮箱补全',
    apiBase: defaultHunterApiBase,
    apiKey: '',
    updatedAt: ''
  };
}

function createUserSerperConfigDraft(userId: string): AiUserSerperConfigRecord {
  return {
    userId,
    title: 'Serper 搜索',
    apiBase: defaultSerperApiBase,
    apiKey: '',
    updatedAt: ''
  };
}

function createUserHunterConfigDraft(userId: string): AiUserHunterConfigRecord {
  return {
    userId,
    title: 'Hunter 邮箱补全',
    apiBase: defaultHunterApiBase,
    apiKey: '',
    updatedAt: ''
  };
}

function toSerperRuntimeConfig(record: AiUserSerperConfigRecord): SerperConfigRecord {
  return {
    configKey: `user:${record.userId}`,
    title: record.title,
    apiBase: record.apiBase,
    apiKey: record.apiKey,
    updatedAt: record.updatedAt
  };
}

function toHunterRuntimeConfig(record: AiUserHunterConfigRecord): HunterConfigRecord {
  return {
    configKey: `user:${record.userId}`,
    title: record.title,
    apiBase: record.apiBase,
    apiKey: record.apiKey,
    updatedAt: record.updatedAt
  };
}

function countHunterResultEmails(result: unknown) {
  const emails = (result as { data?: { emails?: unknown } } | null)?.data?.emails;

  return Array.isArray(emails) ? emails.length : 0;
}
