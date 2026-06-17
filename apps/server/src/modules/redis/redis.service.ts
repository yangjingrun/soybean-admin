import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { Redis as RedisClient } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: RedisClient;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: 1,
      lazyConnect: true
    });
  }

  getClient() {
    return this.client;
  }

  async onModuleDestroy() {
    this.client.disconnect();
  }
}
