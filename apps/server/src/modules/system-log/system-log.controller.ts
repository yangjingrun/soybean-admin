import { Controller, ForbiddenException, Get, Headers, Inject, Param, Query } from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { CurrentUser } from '../auth/auth.decorators';
import { AuthService } from '../auth/auth.service';
import type { UserInfo } from '../auth/auth.types';
import { SystemLogIdParamDto, SystemLogQueryDto } from './dto/system-log-query.dto';
import { SystemLogService } from './system-log.service';

@Controller('system-logs')
export class SystemLogController {
  constructor(
    @Inject(SystemLogService) private readonly systemLogService: SystemLogService,
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  @Get()
  async list(
    @Headers('authorization') authorization = '',
    @CurrentUser() currentUser: UserInfo | null = null,
    @Query() query: SystemLogQueryDto
  ) {
    await this.assertSuper(authorization, currentUser);

    return ok(await this.systemLogService.list(query));
  }

  @Get('users')
  async users(@Headers('authorization') authorization = '', @CurrentUser() currentUser: UserInfo | null = null) {
    await this.assertSuper(authorization, currentUser);

    return ok(await this.systemLogService.listUsers());
  }

  @Get(':id')
  async detail(
    @Headers('authorization') authorization = '',
    @CurrentUser() currentUser: UserInfo | null = null,
    @Param() params: SystemLogIdParamDto
  ) {
    await this.assertSuper(authorization, currentUser);

    return ok(await this.systemLogService.getById(params.id));
  }

  private async assertSuper(authorization: string, currentUser: UserInfo | null) {
    const user = currentUser || (await this.authService.getUserByAccessToken(this.extractBearerToken(authorization)));

    if (!user?.roles.includes('R_SUPER')) {
      throw new ForbiddenException('无权访问后端日志');
    }

    return user;
  }

  private extractBearerToken(authorization: string) {
    const [scheme, token] = authorization.split(' ');

    return scheme?.toLowerCase() === 'bearer' ? token || '' : '';
  }
}
