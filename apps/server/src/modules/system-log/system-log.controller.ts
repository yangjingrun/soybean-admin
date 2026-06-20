import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { assertSuper as assertSuperRole } from '../../shared/permission-policy';
import { requireRequestUserContext, type RequestUserContext } from '../../shared/request-context';
import { CurrentContext } from '../auth/auth.decorators';
import { SystemLogIdParamDto, SystemLogQueryDto } from './dto/system-log-query.dto';
import { SystemLogService } from './system-log.service';

@Controller('system-logs')
export class SystemLogController {
  constructor(@Inject(SystemLogService) private readonly systemLogService: SystemLogService) {}

  @Get()
  async list(@CurrentContext() context: RequestUserContext | null = null, @Query() query: SystemLogQueryDto) {
    this.requireSuperContext(context);

    return ok(await this.systemLogService.list(query));
  }

  @Get('users')
  async users(@CurrentContext() context: RequestUserContext | null = null) {
    this.requireSuperContext(context);

    return ok(await this.systemLogService.listUsers());
  }

  @Get(':id')
  async detail(
    @CurrentContext() context: RequestUserContext | null = null,
    @Param() params: SystemLogIdParamDto
  ) {
    this.requireSuperContext(context);

    return ok(await this.systemLogService.getById(params.id));
  }

  private requireSuperContext(context: RequestUserContext | null) {
    const userContext = requireRequestUserContext(context);
    assertSuperRole(userContext, '无权访问后端日志');

    return userContext;
  }
}
