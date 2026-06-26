import { Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { requireRequestUserContext, type RequestUserContext } from '../../shared/request-context';
import { CurrentContext } from '../auth/auth.decorators';
import { SystemNotificationService } from './system-notification.service';

@Controller('system-notifications')
export class SystemNotificationController {
  constructor(@Inject(SystemNotificationService) private readonly notificationService: SystemNotificationService) {}

  @Get('pending')
  async pending(@CurrentContext() context: RequestUserContext | null = null) {
    const user = requireRequestUserContext(context);

    return ok(await this.notificationService.listPendingForUser(user.userId));
  }

  @Post(':id/shown')
  async shown(@Param('id') id: string, @CurrentContext() context: RequestUserContext | null = null) {
    const user = requireRequestUserContext(context);

    return ok(await this.notificationService.markShown(id, user.userId));
  }

  @Post(':id/read')
  async read(@Param('id') id: string, @CurrentContext() context: RequestUserContext | null = null) {
    const user = requireRequestUserContext(context);

    return ok(await this.notificationService.markRead(id, user.userId));
  }
}
