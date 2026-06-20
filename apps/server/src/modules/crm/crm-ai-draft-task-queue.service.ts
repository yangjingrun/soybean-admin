import { Inject, Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import type { CrmAiDraftTaskQueueJob, CrmAiDraftTaskQueuePort } from './crm-ai-draft-task.types';

export const crmAiDraftTaskQueueName = 'crm-ai-draft-task';

export const crmAiDraftTaskRemoveOnFail = {
  age: 7 * 24 * 60 * 60,
  count: 1000
} as const;

@Injectable()
export class CrmAiDraftTaskQueueService implements CrmAiDraftTaskQueuePort, OnModuleDestroy {
  private readonly queue: Queue<CrmAiDraftTaskQueueJob>;

  constructor(@Inject(RedisService) redisService: RedisService) {
    this.queue = new Queue<CrmAiDraftTaskQueueJob>(crmAiDraftTaskQueueName, {
      connection: redisService.createBullMqConnectionOptions()
    });
  }

  /** Adds one bulk CRM AI draft task with a deterministic run-version job id. */
  async enqueueTask(input: CrmAiDraftTaskQueueJob) {
    await this.ensureReady();
    const jobId = toCrmAiDraftTaskJobId(input.taskId, input.runVersion);
    const job = await this.queue.add('crm-ai-draft-task', input, {
      jobId,
      removeOnComplete: true,
      removeOnFail: crmAiDraftTaskRemoveOnFail
    });

    return { jobId: job.id || jobId };
  }

  /** Removes a queued AI draft task job when it has not been locked by a worker yet. */
  async removeTaskJob(jobId: string) {
    await this.ensureReady();
    const job = await this.queue.getJob(jobId);

    await job?.remove();
  }

  /** Applies queue-level concurrency so all CRM AI draft workers share one active task cap. */
  async applyGlobalConcurrency(concurrency: number) {
    await this.ensureReady();
    await this.queue.setGlobalConcurrency(concurrency);
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  private async ensureReady() {
    try {
      await this.queue.waitUntilReady();
    } catch {
      throw new ServiceUnavailableException('CRM 批量 AI 草稿队列未配置或不可用');
    }
  }
}

export function toCrmAiDraftTaskJobId(taskId: string, runVersion: number) {
  return `${taskId}:${runVersion}`;
}
