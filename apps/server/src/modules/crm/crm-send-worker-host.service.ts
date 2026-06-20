import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { AppConfigService } from '../app-config/app-config.service';
import { canRunWorkers } from '../app-config/app-config.loader';
import { RedisService } from '../redis/redis.service';
import { createSystemLogErrorMetadata } from '../system-log/system-log-error-taxonomy';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { crmSendQueueName } from './crm-send.constants';
import { CrmSendWorkerService } from './crm-send-worker.service';
import type { CrmSendQueueJob } from './crm.types';

@Injectable()
export class CrmSendWorkerHost implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<CrmSendQueueJob> | null = null;

  constructor(
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(CrmSendWorkerService) private readonly workerService: CrmSendWorkerService,
    @Optional() @Inject(SystemLogService) private readonly systemLogService?: SystemLogRecorder,
    @Optional() @Inject(AppConfigService) private readonly appConfigService?: AppConfigService
  ) {}

  onModuleInit() {
    if (!canRunWorkers(this.appConfigService?.config)) {
      return;
    }

    this.worker = new Worker<CrmSendQueueJob>(crmSendQueueName, job => this.workerService.processSendJob(job.data), {
      connection: this.redisService.createBullMqConnectionOptions(),
      concurrency: 2
    });
    this.worker.on('error', error => {
      void this.recordWorkerLog('worker-runtime-error', 'CRM 邮件发送 worker 运行期异常', error, {});
    });
    this.worker.on('failed', (job, error) => {
      void this.recordWorkerJobFailed(job, error);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  /** Records failed queue jobs without including email body or recipient content. */
  async recordWorkerJobFailed(job: Job<CrmSendQueueJob> | undefined, error: Error) {
    await this.recordWorkerLog('worker-job-failed', 'CRM 邮件发送 worker job 执行失败', error, {
      jobId: job?.id,
      enrollmentId: job?.data.enrollmentId,
      messageId: job?.data.messageId,
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
