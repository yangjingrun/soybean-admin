import { Inject, Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { crmGmailHistorySyncQueueName, crmSendRemoveOnFail } from './crm-send.constants';
import type { CrmGmailHistorySyncQueueJob, CrmGmailHistorySyncQueuePort } from './crm.types';

@Injectable()
export class CrmGmailHistorySyncQueueService implements CrmGmailHistorySyncQueuePort, OnModuleDestroy {
  private readonly queue: Queue<CrmGmailHistorySyncQueueJob>;

  constructor(@Inject(RedisService) redisService: RedisService) {
    this.queue = new Queue<CrmGmailHistorySyncQueueJob>(crmGmailHistorySyncQueueName, {
      connection: redisService.createBullMqConnectionOptions()
    });
  }

  /** Enqueues one Gmail History sync request from Pub/Sub or manual sync. */
  async enqueueHistorySync(input: CrmGmailHistorySyncQueueJob) {
    await this.ensureReady();
    const jobId = toCrmGmailHistorySyncJobId(input.mailboxId, input.historyId, input.pubsubMessageId);
    const job = await this.queue.add('gmail-history-sync', input, {
      jobId,
      removeOnComplete: true,
      removeOnFail: crmSendRemoveOnFail
    });

    return { jobId: job.id || jobId };
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  private async ensureReady() {
    try {
      await this.queue.waitUntilReady();
    } catch {
      throw new ServiceUnavailableException('CRM Gmail 同步队列未配置或不可用');
    }
  }
}

export function toCrmGmailHistorySyncJobId(mailboxId: string, historyId: string, _pubsubMessageId?: string | null) {
  return [mailboxId, historyId].join(':');
}
