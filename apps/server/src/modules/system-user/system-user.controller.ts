import { Controller, ForbiddenException, Get, Headers, Inject, Query } from '@nestjs/common';
import { ok } from '../../shared/api-response';
import { AuthService } from '../auth/auth.service';
import { SystemUserQueryDto } from './dto/system-user-query.dto';

@Controller('system-users')
export class SystemUserController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Get()
  async list(@Headers('authorization') authorization = '', @Query() query: SystemUserQueryDto) {
    this.assertSuper(authorization);

    return ok(this.authService.listUsers(query));
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
