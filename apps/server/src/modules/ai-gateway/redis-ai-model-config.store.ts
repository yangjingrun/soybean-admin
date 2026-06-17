import { Inject, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import type { AiModelConfigRecord, AiModelConfigStore } from './ai-gateway.types';

const modelConfigKeyPrefix = 'ai-gateway:model-config:';

@Injectable()
export class RedisAiModelConfigStore implements AiModelConfigStore {
  constructor(@Inject(RedisService) private readonly redisService: RedisService) {}

  /** Reads one saved model config by stable config key. */
  async getModelConfig(configKey: string): Promise<AiModelConfigRecord | null> {
    const raw = await this.redisService.getClient().get(this.toRedisKey(configKey));

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as AiModelConfigRecord;
  }

  /** Persists one model config for backend AI calls. */
  async saveModelConfig(record: AiModelConfigRecord): Promise<AiModelConfigRecord> {
    await this.redisService.getClient().set(this.toRedisKey(record.configKey), JSON.stringify(record));

    return record;
  }

  private toRedisKey(configKey: string) {
    return `${modelConfigKeyPrefix}${configKey}`;
  }
}
