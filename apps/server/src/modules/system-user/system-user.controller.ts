import { Body, Controller, ForbiddenException, Get, Headers, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { AuthService } from '../auth/auth.service';
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
  async list(@Headers('authorization') authorization = '', @Query() query: SystemUserQueryDto) {
    this.assertSuper(authorization);

    return ok(await this.systemUserService.list(query));
  }

  @Post()
  async create(@Headers('authorization') authorization = '', @Body() dto: CreateSystemUserDto) {
    const operator = this.assertSuper(authorization);

    return ok(await this.systemUserService.create(dto, operator));
  }

  @Patch(':id')
  async update(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: UpdateSystemUserDto
  ) {
    const operator = this.assertSuper(authorization);

    return ok(await this.systemUserService.update(id, dto, operator));
  }

  @Patch(':id/status')
  async updateStatus(
    @Headers('authorization') authorization = '',
    @Param('id') id: string,
    @Body() dto: UpdateSystemUserStatusDto
  ) {
    const operator = this.assertSuper(authorization);

    return ok(await this.systemUserService.updateStatus(id, dto.status, operator));
  }

  @Post(':id/reset-password')
  async resetPassword(@Headers('authorization') authorization = '', @Param('id') id: string) {
    const operator = this.assertSuper(authorization);

    return ok(await this.systemUserService.resetPassword(id, operator));
  }

  private assertSuper(authorization: string) {
    const user = this.authService.getUserByAccessToken(this.extractBearerToken(authorization));

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
