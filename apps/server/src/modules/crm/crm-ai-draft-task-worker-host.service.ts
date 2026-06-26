import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { AppConfigService } from '../app-config/app-config.service';
import { canRunWorkers } from '../app-config/app-config.loader';
import { RedisService } from '../redis/redis.service';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { recordRuntimeHostError } from '../../shared/runtime-host-log';
import { crmAiDraftTaskQueueName } from './crm-ai-draft-task-queue.service';
import { normalizeCrmAiDraftItemConcurrency } from './crm-ai-draft-task-state';
import { CrmAiDraftTaskWorkerService } from './crm-ai-draft-task-worker.service';
import type { CrmAiDraftTaskQueueJob, CrmAiDraftTaskQueuePort } from './crm-ai-draft-task.types';
import type { CrmAiDraftWorkerRepository } from './crm-ai-draft-worker.repository';
import { CRM_AI_DRAFT_TASK_QUEUE, CRM_AI_DRAFT_WORKER_REPOSITORY } from './crm.tokens';

@Injectable()
export class CrmAiDraftTaskWorkerHost implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<CrmAiDraftTaskQueueJob> | null = null;

  constructor(
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(CrmAiDraftTaskWorkerService) private readonly workerService: CrmAiDraftTaskWorkerService,
    @Inject(CRM_AI_DRAFT_WORKER_REPOSITORY)
    private readonly store: Pick<CrmAiDraftWorkerRepository, 'getAiDraftQueueConfig'>,
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
    await recordRuntimeHostError({
      recorder: this.systemLogService,
      module: 'crm',
      action,
      message,
      error,
      metadata
    });
  }
}
