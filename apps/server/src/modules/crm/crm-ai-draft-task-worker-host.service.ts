import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { AppConfigService } from '../app-config/app-config.service';
import { canRunWorkers } from '../app-config/app-config.loader';
import { RedisService } from '../redis/redis.service';
import { createSystemLogErrorMetadata } from '../system-log/system-log-error-taxonomy';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { crmAiDraftTaskQueueName } from './crm-ai-draft-task-queue.service';
import { normalizeCrmAiDraftItemConcurrency } from './crm-ai-draft-task-state';
import { CrmAiDraftTaskWorkerService } from './crm-ai-draft-task-worker.service';
import type { CrmAiDraftTaskQueueJob, CrmAiDraftTaskQueuePort } from './crm-ai-draft-task.types';
import { CRM_AI_DRAFT_TASK_QUEUE, CRM_STORE } from './crm.tokens';
import type { CrmStore } from './crm.types';

@Injectable()
export class CrmAiDraftTaskWorkerHost implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<CrmAiDraftTaskQueueJob> | null = null;

  constructor(
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(CrmAiDraftTaskWorkerService) private readonly workerService: CrmAiDraftTaskWorkerService,
    @Inject(CRM_STORE) private readonly store: Pick<CrmStore, 'getAiDraftQueueConfig'>,
    @Inject(CRM_AI_DRAFT_TASK_QUEUE) private readonly taskQueue: CrmAiDraftTaskQueuePort,
    @Optional() @Inject(SystemLogService) private readonly systemLogService?: SystemLogRecorder,
    @Optional() @Inject(AppConfigService) private readonly appConfigService?: AppConfigService
  ) {}

  async onModuleInit() {
    if (!canRunWorkers(this.appConfigService?.config)) {
      return;
    }

    const config = await this.store.getAiDraftQueueConfig();
    await this.taskQueue.applyGlobalConcurrency(config.maxActiveTasksPerOrg);
    this.worker = new Worker<CrmAiDraftTaskQueueJob>(
      crmAiDraftTaskQueueName,
      job => this.workerService.processTaskJob(job.data),
      {
        connection: this.redisService.createBullMqConnectionOptions(),
        concurrency: normalizeCrmAiDraftItemConcurrency(config.maxActiveTasksPerOrg, config.maxActiveTasksPerOrg)
      }
    );
    this.worker.on('error', error => {
      void this.recordWorkerLog('ai-draft-worker-runtime-error', 'CRM AI 草稿 worker 运行期异常', error, {});
    });
    this.worker.on('failed', (job, error) => {
      void this.recordWorkerJobFailed(job, error);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  /** Records failed AI draft jobs without message body or AI prompt content. */
  async recordWorkerJobFailed(job: Job<CrmAiDraftTaskQueueJob> | undefined, error: Error) {
    await this.recordWorkerLog('ai-draft-worker-job-failed', 'CRM AI 草稿 worker job 执行失败', error, {
      jobId: job?.id,
      taskId: job?.data.taskId,
      organizationId: job?.data.organizationId,
      ownerUserId: job?.data.ownerUserId,
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
        module: 'crm',
        action,
        message,
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: createSystemLogErrorMetadata(error, metadata)
      });
    } catch {
      // 运行期事件回调不能因为日志服务异常产生新的未处理异常。
    }
  }
}
