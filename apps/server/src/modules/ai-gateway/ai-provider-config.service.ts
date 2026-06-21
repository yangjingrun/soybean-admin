import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { RequestUserContext } from '../../shared/request-context';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { defaultHunterApiBase, defaultHunterConfigKey, defaultSerperApiBase, defaultSerperConfigKey } from './ai-gateway.constants';
import { HUNTER_CONFIG_STORE, SERPER_CONFIG_STORE } from './ai-gateway.tokens';
import type { SaveHunterConfigDto } from './dto/hunter-config.dto';
import type { SaveSerperConfigDto } from './dto/serper-config.dto';
import { HunterClient } from './hunter-client.service';
import { SerperClient } from './serper-client.service';
import type {
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
    @Inject(SERPER_CONFIG_STORE) private readonly serperConfigStore: SerperConfigStore,
    @Inject(SerperClient) private readonly serperClient: Pick<SerperClient, 'search'>,
    @Inject(HUNTER_CONFIG_STORE) private readonly hunterConfigStore: HunterConfigStore,
    @Inject(HunterClient) private readonly hunterClient: Pick<HunterClient, 'domainSearch'>,
    @Inject(SystemLogService) private readonly systemLogService: SystemLogRecorder
  ) {}

  /** Saves the Serper search channel used by AI leads search orchestration. */
  async saveSerperConfig(dto: SaveSerperConfigDto, context: AiProviderConfigContext = {}): Promise<SerperConfigViewRecord> {
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
  async saveHunterConfig(dto: SaveHunterConfigDto, context: AiProviderConfigContext = {}): Promise<HunterConfigViewRecord> {
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

function countHunterResultEmails(result: unknown) {
  const emails = (result as { data?: { emails?: unknown } } | null)?.data?.emails;

  return Array.isArray(emails) ? emails.length : 0;
}
