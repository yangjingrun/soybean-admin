import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { requireSuperUserContext } from '../../shared/permission-policy';
import type { RequestUserContext } from '../../shared/request-context';
import { CurrentContext, SuperOnly } from '../auth/auth.decorators';
import { CreateSystemUserDto, UpdateSystemUserDto, UpdateSystemUserStatusDto } from './dto/system-user-operate.dto';
import { SystemUserQueryDto } from './dto/system-user-query.dto';
import { SystemUserService } from './system-user.service';

@SuperOnly('无权访问用户管理')
@Controller('system-users')
export class SystemUserController {
  constructor(@Inject(SystemUserService) private readonly systemUserService: SystemUserService) {}

  @Get()
  async list(@CurrentContext() context: RequestUserContext | null = null, @Query() query: SystemUserQueryDto) {
    this.requireSuperContext(context);

    return ok(await this.systemUserService.list(query));
  }

  @Post()
  async create(@CurrentContext() context: RequestUserContext | null = null, @Body() dto: CreateSystemUserDto) {
    const operator = this.requireSuperContext(context);

    return ok(await this.systemUserService.create(dto, operator));
  }

  @Patch(':id')
  async update(
    @CurrentContext() context: RequestUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateSystemUserDto
  ) {
    const operator = this.requireSuperContext(context);

    return ok(await this.systemUserService.update(id, dto, operator));
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentContext() context: RequestUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateSystemUserStatusDto
  ) {
    const operator = this.requireSuperContext(context);

    return ok(await this.systemUserService.updateStatus(id, dto.status, operator));
  }

  @Post(':id/reset-password')
  async resetPassword(@CurrentContext() context: RequestUserContext | null = null, @Param('id') id: string) {
    const operator = this.requireSuperContext(context);

    return ok(await this.systemUserService.resetPassword(id, operator));
  }

  private requireSuperContext(context: RequestUserContext | null) {
    return requireSuperUserContext(context, '无权访问用户管理');
  }
}
