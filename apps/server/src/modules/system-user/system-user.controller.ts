import { Body, Controller, ForbiddenException, Get, Headers, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { CurrentUser } from '../auth/auth.decorators';
import { AuthService } from '../auth/auth.service';
import type { UserInfo } from '../auth/auth.types';
import { CreateSystemUserDto, UpdateSystemUserDto, UpdateSystemUserStatusDto } from './dto/system-user-operate.dto';
import { SystemUserQueryDto } from './dto/system-user-query.dto';
import { SystemUserService } from './system-user.service';

@Controller('system-users')
export class SystemUserController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(SystemUserService) private readonly systemUserService: SystemUserService
  ) {}

  @Get()
  async list(
    @Headers('authorization') authorization = '',
    @CurrentUser() currentUser: UserInfo | null = null,
    @Query() query: SystemUserQueryDto
  ) {
    await this.assertSuper(authorization, currentUser);

    return ok(await this.systemUserService.list(query));
  }

  @Post()
  async create(
    @Headers('authorization') authorization = '',
    @CurrentUser() currentUser: UserInfo | null = null,
    @Body() dto: CreateSystemUserDto
  ) {
    const operator = await this.assertSuper(authorization, currentUser);

    return ok(await this.systemUserService.create(dto, operator));
  }

  @Patch(':id')
  async update(
    @Headers('authorization') authorization = '',
    @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateSystemUserDto
  ) {
    const operator = await this.assertSuper(authorization, currentUser);

    return ok(await this.systemUserService.update(id, dto, operator));
  }

  @Patch(':id/status')
  async updateStatus(
    @Headers('authorization') authorization = '',
    @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string,
    @Body() dto: UpdateSystemUserStatusDto
  ) {
    const operator = await this.assertSuper(authorization, currentUser);

    return ok(await this.systemUserService.updateStatus(id, dto.status, operator));
  }

  @Post(':id/reset-password')
  async resetPassword(
    @Headers('authorization') authorization = '',
    @CurrentUser() currentUser: UserInfo | null = null,
    @Param('id') id: string
  ) {
    const operator = await this.assertSuper(authorization, currentUser);

    return ok(await this.systemUserService.resetPassword(id, operator));
  }

  private async assertSuper(authorization: string, currentUser: UserInfo | null) {
    const user = currentUser || (await this.authService.getUserByAccessToken(this.extractBearerToken(authorization)));

    if (!user?.roles.includes('R_SUPER')) {
      throw new ForbiddenException('无权访问用户管理');
    }

    return user;
  }

  private extractBearerToken(authorization: string) {
    const [scheme, token] = authorization.split(' ');

    return scheme?.toLowerCase() === 'bearer' ? token || '' : '';
  }
}
