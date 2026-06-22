import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { requireSuperUserContext } from '../../shared/permission-policy';
import type { RequestUserContext } from '../../shared/request-context';
import { CurrentContext, SuperOnly } from '../auth/auth.decorators';
import {
  CreateSystemOrganizationDto,
  UpdateSystemOrganizationDto,
  UpdateSystemOrganizationStatusDto
} from './dto/system-organization-operate.dto';
import { SystemOrganizationQueryDto } from './dto/system-organization-query.dto';
import { SystemOrganizationService } from './system-organization.service';

@SuperOnly('无权访问组织管理')
@Controller('system-organizations')
export class SystemOrganizationController {
  constructor(
    @Inject(SystemOrganizationService) private readonly systemOrganizationService: SystemOrganizationService
  ) {}

  @Get()
  async list(@CurrentContext() context: RequestUserContext | null = null, @Query() query: SystemOrganizationQueryDto) {
    this.requireSuperContext(context);

    return ok(await this.systemOrganizationService.list(query));
  }

  @Get('enabled')
  async listEnabled(@CurrentContext() context: RequestUserContext | null = null) {
    this.requireSuperContext(context);

    return ok(await this.systemOrganizationService.listEnabled());
  }

  @Post()
  async create(@CurrentContext() context: RequestUserContext | null = null, @Body() dto: CreateSystemOrganizationDto) {
    const operator = this.requireSuperContext(context);

    return ok(await this.systemOrganizationService.create(dto, operator));
  }

  @Patch(':id')
  async update(
    @CurrentContext() context: RequestUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateSystemOrganizationDto
  ) {
    const operator = this.requireSuperContext(context);

    return ok(await this.systemOrganizationService.update(id, dto, operator));
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentContext() context: RequestUserContext | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateSystemOrganizationStatusDto
  ) {
    const operator = this.requireSuperContext(context);

    return ok(await this.systemOrganizationService.updateStatus(id, dto.status, operator));
  }

  private requireSuperContext(context: RequestUserContext | null) {
    return requireSuperUserContext(context, '无权访问组织管理');
  }
}
