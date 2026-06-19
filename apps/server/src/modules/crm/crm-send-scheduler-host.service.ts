import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { CrmSendSchedulerService } from './crm-send-scheduler.service';

const schedulerIntervalMs = 60_000;

@Injectable()
export class CrmSendSchedulerHost implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(CrmSendSchedulerService) private readonly schedulerService: CrmSendSchedulerService,
    @Optional() @Inject(SystemLogService) private readonly systemLogService?: SystemLogRecorder
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, schedulerIntervalMs);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Runs one scheduler tick while preventing overlapping scans. */
  async tick() {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.schedulerService.dispatchDueMessages();
    } catch (error) {
      await this.recordSchedulerError(error);
    } finally {
      this.running = false;
    }
  }

  private async recordSchedulerError(error: unknown) {
    if (!this.systemLogService) {
      return;
    }

    try {
      await this.systemLogService.record({
        level: 'error',
        status: 'failed',
        module: 'crm',
        action: 'send-scheduler-failed',
        message: 'CRM 邮件发送调度器执行失败',
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    } catch {
      // 定时器回调不能因为日志失败产生未处理异常。
    }
  }
}
