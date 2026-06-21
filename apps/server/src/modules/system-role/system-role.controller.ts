import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { requireSuperUserContext } from '../../shared/permission-policy';
import type { RequestUserContext } from '../../shared/request-context';
import { CurrentContext, SuperOnly } from '../auth/auth.decorators';
import { CreateSystemRoleDto, UpdateSystemRoleDto, UpdateSystemRolePermissionsDto } from './dto/system-role-operate.dto';
import { SystemRoleQueryDto } from './dto/system-role-query.dto';
import { SystemRoleService } from './system-role.service';

@SuperOnly('无权访问角色管理')
@Controller('system-roles')
export class SystemRoleController {
  constructor(@Inject(SystemRoleService) private readonly systemRoleService: SystemRoleService) {}

  @Get()
  async list(@CurrentContext() context: RequestUserContext | null = null, @Query() query: SystemRoleQueryDto) {
    this.requireSuperContext(context);

    return ok(await this.systemRoleService.list(query));
  }

  @Get('enabled')
  async listEnabled(@CurrentContext() context: RequestUserContext | null = null) {
    this.requireSuperContext(context);

    return ok(await this.systemRoleService.listEnabled());
  }

  @Post()
  async create(
    @CurrentContext() context: RequestUserContext | null = null,
    @Body() dto: CreateSystemRoleDto
  ) {
    const operator = this.requireSuperContext(context);

    return ok(await this.systemRoleService.create(dto, operator));
  }

  @Patch(':id')
  async update(
    @CurrentContext() context: RequestUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateSystemRoleDto
  ) {
    const operator = this.requireSuperContext(context);

    return ok(await this.systemRoleService.update(id, dto, operator));
  }

  @Patch(':id/permissions')
  async updatePermissions(
    @CurrentContext() context: RequestUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateSystemRolePermissionsDto
  ) {
    const operator = this.requireSuperContext(context);

    return ok(await this.systemRoleService.updatePermissions(id, dto.permissions, operator));
  }

  private requireSuperContext(context: RequestUserContext | null) {
    return requireSuperUserContext(context, '无权访问角色管理');
  }
}
