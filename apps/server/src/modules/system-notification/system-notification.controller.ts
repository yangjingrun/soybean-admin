import { Controller, Get, Headers, Inject, Param, Post, UnauthorizedException } from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { AuthService } from '../auth/auth.service';
import { SystemNotificationService } from './system-notification.service';

@Controller('system-notifications')
export class SystemNotificationController {
  constructor(
    @Inject(SystemNotificationService) private readonly notificationService: SystemNotificationService,
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  @Get('pending')
  async pending(@Headers('authorization') authorization = '') {
    const user = this.requireUser(authorization);

    return ok(await this.notificationService.listPendingForUser(user.userId));
  }

  @Post(':id/shown')
  async shown(@Param('id') id: string, @Headers('authorization') authorization = '') {
    const user = this.requireUser(authorization);

    return ok(await this.notificationService.markShown(id, user.userId));
  }

  @Post(':id/read')
  async read(@Param('id') id: string, @Headers('authorization') authorization = '') {
    const user = this.requireUser(authorization);

    return ok(await this.notificationService.markRead(id, user.userId));
  }

  private requireUser(authorization: string) {
    const user = this.authService.getUserByAccessToken(this.extractBearerToken(authorization));

    if (!user) {
      throw new UnauthorizedException('登录状态已失效');
    }

    return user;
  }

  private extractBearerToken(authorization: string) {
    const [scheme, token] = authorization.split(' ');

    return scheme?.toLowerCase() === 'bearer' ? token || '' : '';
  }
}
