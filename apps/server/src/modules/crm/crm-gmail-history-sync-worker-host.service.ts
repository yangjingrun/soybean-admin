import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { AppConfigService } from '../app-config/app-config.service';
import { canRunWorkers } from '../app-config/app-config.loader';
import { RedisService } from '../redis/redis.service';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { recordRuntimeHostError } from '../../shared/runtime-host-log';
import { crmGmailHistorySyncQueueName } from './crm-send.constants';
import { CrmGmailHistorySyncWorkerService } from './crm-gmail-history-sync-worker.service';
import type { CrmGmailHistorySyncQueueJob } from './crm.types';

@Injectable()
export class CrmGmailHistorySyncWorkerHost implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<CrmGmailHistorySyncQueueJob> | null = null;

  constructor(
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(CrmGmailHistorySyncWorkerService) private readonly workerService: CrmGmailHistorySyncWorkerService,
    @Optional() @Inject(SystemLogService) private readonly systemLogService?: SystemLogRecorder,
    @Optional() @Inject(AppConfigService) private readonly appConfigService?: AppConfigService
  ) {}

  onModuleInit() {
    if (!canRunWorkers(this.appConfigService?.config)) {
      return;
    }

    this.worker = new Worker<CrmGmailHistorySyncQueueJob>(
      crmGmailHistorySyncQueueName,
      job => this.workerService.processHistorySyncJob(job.data),
      {
        connection: this.redisService.createBullMqConnectionOptions(),
        concurrency: 2
      }
    );
    this.worker.on('error', error => {
      void this.recordWorkerLog('gmail-history-worker-runtime-error', 'CRM Gmail 同步 worker 运行期异常', error, {});
    });
    this.worker.on('failed', (job, error) => {
      void this.recordWorkerJobFailed(job, error);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  /** Records failed Gmail sync jobs without including email body or credentials. */
  async recordWorkerJobFailed(job: Job<CrmGmailHistorySyncQueueJob> | undefined, error: Error) {
    await this.recordWorkerLog('gmail-history-worker-job-failed', 'CRM Gmail 同步 worker job 执行失败', error, {
      jobId: job?.id,
      mailboxId: job?.data.mailboxId,
      organizationId: job?.data.organizationId,
      ownerUserId: job?.data.ownerUserId,
      historyId: job?.data.historyId,
      pubsubMessageId: job?.data.pubsubMessageId
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
