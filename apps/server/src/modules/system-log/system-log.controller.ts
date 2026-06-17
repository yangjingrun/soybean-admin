import { Controller, ForbiddenException, Get, Headers, Inject, Param, Query } from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { AuthService } from '../auth/auth.service';
import { SystemLogIdParamDto, SystemLogQueryDto } from './dto/system-log-query.dto';
import { SystemLogService } from './system-log.service';

@Controller('system-logs')
export class SystemLogController {
  constructor(
    @Inject(SystemLogService) private readonly systemLogService: SystemLogService,
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  @Get()
  async list(@Headers('authorization') authorization = '', @Query() query: SystemLogQueryDto) {
    this.assertSuper(authorization);

    return ok(await this.systemLogService.list(query));
  }

  @Get('users')
  async users(@Headers('authorization') authorization = '') {
    this.assertSuper(authorization);

    return ok(await this.systemLogService.listUsers());
  }

  @Get(':id')
  async detail(@Headers('authorization') authorization = '', @Param() params: SystemLogIdParamDto) {
    this.assertSuper(authorization);

    return ok(await this.systemLogService.getById(params.id));
  }

  private assertSuper(authorization: string) {
    const user = this.authService.getUserByAccessToken(this.extractBearerToken(authorization));

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
