import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { aiLeadSearchQueueName } from './ai-lead-search-task.constants';
import { normalizeAiLeadQueueConcurrency } from './ai-lead-search-task-state';
import type { AiLeadSearchTaskQueueJob } from './ai-lead-search-task-queue.service';
import { AiLeadSearchTaskWorkerService } from './ai-lead-search-task-worker.service';
import { AI_LEAD_QUEUE_CONFIG_STORE, AI_LEAD_SEARCH_TASK_QUEUE } from './ai-leads.tokens';
import type { AiLeadQueueConfigStore, AiLeadSearchTaskQueuePort } from './ai-lead-search-task.types';

@Injectable()
export class AiLeadSearchTaskWorkerHost implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<AiLeadSearchTaskQueueJob> | null = null;

  constructor(
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(AiLeadSearchTaskWorkerService) private readonly workerService: AiLeadSearchTaskWorkerService,
    @Inject(AI_LEAD_QUEUE_CONFIG_STORE) private readonly queueConfigStore: AiLeadQueueConfigStore,
    @Inject(AI_LEAD_SEARCH_TASK_QUEUE) private readonly taskQueue: AiLeadSearchTaskQueuePort,
    @Optional() @Inject(SystemLogService) private readonly systemLogService?: SystemLogRecorder
  ) {}

  async onModuleInit() {
    const config = await this.queueConfigStore.getConfig();
    const activeJobIds = (await this.taskQueue.listActiveSearchTaskJobIds?.()) ?? [];
    await this.workerService.interruptRunningTasksAfterRestart(activeJobIds);
    this.worker = new Worker<AiLeadSearchTaskQueueJob>(
      aiLeadSearchQueueName,
      job => this.workerService.processTaskJob(job.data),
      {
        connection: this.redisService.createBullMqConnectionOptions(),
        concurrency: normalizeAiLeadQueueConcurrency(config.workerConcurrency)
      }
    );
    this.worker.on('error', error => {
      void this.recordWorkerRuntimeError(error);
    });
    this.worker.on('failed', (job, error) => {
      void this.recordWorkerJobFailed(job, error);
    });
  }

  setLocalConcurrency(concurrency: number) {
    if (this.worker) {
      this.worker.concurrency = normalizeAiLeadQueueConcurrency(concurrency);
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  /** Records worker-level runtime errors that are not tied to one task status transition. */
  async recordWorkerRuntimeError(error: unknown) {
    await this.recordWorkerLog('worker-runtime-error', 'AI 获客 worker 运行期异常', error, {});
  }

  /** Records BullMQ failed events so queue operations failures are visible in business logs. */
  async recordWorkerJobFailed(job: Job<AiLeadSearchTaskQueueJob> | undefined, error: Error) {
    await this.recordWorkerLog('worker-job-failed', 'AI 获客 worker job 执行失败', error, {
      jobId: job?.id,
      taskId: job?.data.taskId,
      runVersion: job?.data.runVersion
    });
  }

  private async recordWorkerLog(action: string, message: string, error: unknown, metadata: Record<string, unknown>) {
    if (!this.systemLogService) {
      return;
    }

    try {
      await this.systemLogService.record({
        level: 'error',
        status: 'failed',
        module: 'ai-leads',
        action,
        message,
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata
      });
    } catch {
      // 运行期事件回调不能因为日志服务异常产生新的未处理异常。
    }
  }
}
