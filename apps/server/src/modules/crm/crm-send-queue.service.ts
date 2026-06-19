import { Inject, Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { crmSendQueueName, crmSendRemoveOnFail } from './crm-send.constants';
import type { CrmSendQueueJob, CrmSendQueuePort } from './crm.types';

@Injectable()
export class CrmSendQueueService implements CrmSendQueuePort, OnModuleDestroy {
  private readonly queue: Queue<CrmSendQueueJob>;

  constructor(@Inject(RedisService) redisService: RedisService) {
    this.queue = new Queue<CrmSendQueueJob>(crmSendQueueName, {
      connection: redisService.createBullMqConnectionOptions()
    });
  }

  /** Enqueue one approved CRM message for guarded background sending. */
  async enqueueFirstMessage(input: CrmSendQueueJob, options: { delayMs?: number } = {}) {
    await this.ensureReady();
    const job = await this.queue.add('send-first-message', input, {
      jobId: toCrmSendJobId(input.messageId, input.runVersion),
      ...(options.delayMs ? { delay: options.delayMs } : {}),
      removeOnComplete: true,
      removeOnFail: crmSendRemoveOnFail
    });

    return { jobId: job.id || toCrmSendJobId(input.messageId, input.runVersion) };
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  private async ensureReady() {
    try {
      await this.queue.waitUntilReady();
    } catch {
      throw new ServiceUnavailableException('CRM 邮件发送队列未配置或不可用');
    }
  }
}

export function toCrmSendJobId(messageId: string, runVersion: number) {
  return `${messageId}:${runVersion}`;
}
