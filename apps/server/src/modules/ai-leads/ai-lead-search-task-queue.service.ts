import { Inject, Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { aiLeadSearchQueueName } from './ai-lead-search-task.constants';
import type { AiLeadSearchTaskQueuePort } from './ai-lead-search-task.types';

export interface AiLeadSearchTaskQueueJob {
  taskId: string;
  runVersion: number;
  priority: number;
}

export const aiLeadSearchTaskRemoveOnFail = {
  age: 7 * 24 * 60 * 60,
  count: 1000
} as const;

@Injectable()
export class AiLeadSearchTaskQueueService implements AiLeadSearchTaskQueuePort, OnModuleDestroy {
  private readonly queue: Queue<AiLeadSearchTaskQueueJob, unknown, string, AiLeadSearchTaskQueueJob, unknown, string>;

  constructor(@Inject(RedisService) redisService: RedisService) {
    this.queue = new Queue<AiLeadSearchTaskQueueJob>(aiLeadSearchQueueName, {
      connection: redisService.createBullMqConnectionOptions()
    });
  }

  /** Adds one AI leads search task job to BullMQ. */
  async enqueueSearchTask(input: AiLeadSearchTaskQueueJob) {
    await this.ensureReady();
    const job = await this.queue.add('search-task', input, {
      jobId: toSearchTaskJobId(input.taskId, input.runVersion),
      priority: input.priority > 0 ? input.priority : undefined,
      removeOnComplete: true,
      removeOnFail: aiLeadSearchTaskRemoveOnFail
    });

    return { jobId: job.id || toSearchTaskJobId(input.taskId, input.runVersion) };
  }

  /** Removes a queued job when it has not been locked by a worker yet. */
  async removeSearchTaskJob(jobId: string) {
    await this.ensureReady();
    const job = await Job.fromId(this.queue, jobId);

    if (!job) {
      return;
    }

    await job.remove();
  }

  /** Applies queue-level global concurrency so all workers share the same cap. */
  async applyGlobalConcurrency(concurrency: number) {
    await this.ensureReady();
    await this.queue.setGlobalConcurrency(concurrency);
  }

  /** Lists BullMQ jobs currently owned by active workers. */
  async listActiveSearchTaskJobIds() {
    await this.ensureReady();
    const jobs = await this.queue.getJobs(['active']);

    return jobs.map(job => job.id).filter((id): id is string => Boolean(id));
  }

  getQueueName() {
    return aiLeadSearchQueueName;
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  private async ensureReady() {
    try {
      await this.queue.waitUntilReady();
    } catch {
      throw new ServiceUnavailableException('AI 获客任务队列未配置或不可用');
    }
  }
}

export function toSearchTaskJobId(taskId: string, runVersion: number) {
  return `${taskId}:${runVersion}`;
}
