import { Inject, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import type { AiPromptRecord, AiPromptStore } from './ai-gateway.types';

const promptKeyPrefix = 'ai-gateway:system-prompt:';

@Injectable()
export class RedisAiPromptStore implements AiPromptStore {
  constructor(@Inject(RedisService) private readonly redisService: RedisService) {}

  /** Reads one saved system prompt by stable business key. */
  async getPrompt(promptKey: string): Promise<AiPromptRecord | null> {
    const raw = await this.redisService.getClient().get(this.toRedisKey(promptKey));

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as AiPromptRecord;
  }

  /** Persists one system prompt for later model calls. */
  async savePrompt(record: AiPromptRecord): Promise<AiPromptRecord> {
    await this.redisService.getClient().set(this.toRedisKey(record.promptKey), JSON.stringify(record));

    return record;
  }

  private toRedisKey(promptKey: string) {
    return `${promptKeyPrefix}${promptKey}`;
  }
}
