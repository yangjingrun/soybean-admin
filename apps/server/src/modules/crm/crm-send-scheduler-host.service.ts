import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { AppConfigService } from '../app-config/app-config.service';
import { canRunSchedulers } from '../app-config/app-config.loader';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { recordRuntimeHostError } from '../../shared/runtime-host-log';
import { CrmSendSchedulerService } from './crm-send-scheduler.service';

const schedulerIntervalMs = 60_000;

@Injectable()
export class CrmSendSchedulerHost implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(CrmSendSchedulerService) private readonly schedulerService: CrmSendSchedulerService,
    @Optional() @Inject(SystemLogService) private readonly systemLogService?: SystemLogRecorder,
    @Optional() @Inject(AppConfigService) private readonly appConfigService?: AppConfigService
  ) {}

  onModuleInit() {
    if (!canRunSchedulers(this.appConfigService?.config)) {
      return;
    }

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
    await recordRuntimeHostError({
      recorder: this.systemLogService,
      module: 'crm',
      action: 'send-scheduler-failed',
      message: 'CRM 邮件发送调度器执行失败',
      error
    });
  }
}
