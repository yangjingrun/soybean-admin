import { Injectable } from '@nestjs/common';
import { SystemLogService } from '../../system-log/system-log.service';
import type { CrmUserContext } from './crm-context';

@Injectable()
export class CrmLoggerService {
  constructor(private readonly systemLogService: SystemLogService) {}

  /** Record a sanitized CRM business log. */
  record(action: string, message: string, context: CrmUserContext, metadata: Record<string, unknown>) {
    return this.systemLogService.record({
      level: 'info',
      status: 'success',
      module: 'crm',
      action,
      message,
      userId: context.userId,
      userName: context.userName,
      metadata
    });
  }
}
