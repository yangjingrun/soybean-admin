import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import type { Redis as RedisClient } from 'ioredis';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: RedisClient;
  private readonly redisUrl: string;

  constructor(@Optional() @Inject(AppConfigService) appConfigService?: AppConfigService) {
    this.redisUrl = appConfigService?.config.redisUrl || process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.client = new Redis(this.redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true
    });
  }

  getClient() {
    return this.client;
  }

  /** Creates an isolated Redis connection for BullMQ queue/worker internals. */
  createBullMqConnectionOptions() {
    const url = new URL(this.redisUrl);
    const db = url.pathname.replace('/', '');

    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 6379,
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      db: db ? Number(db) : 0,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      tls: url.protocol === 'rediss:' ? {} : undefined
    };
  }

  async onModuleDestroy() {
    this.client.disconnect();
  }
}
