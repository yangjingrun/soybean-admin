import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './auth.decorators';
import type { UserInfo } from './auth.types';

interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: UserInfo;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  /** Resolve bearer token once and attach the user snapshot for downstream guards/controllers. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.authService.getUserByAccessToken(extractBearerToken(request.headers.authorization));

    if (!user) {
      throw new UnauthorizedException('登录状态已失效');
    }

    request.user = user;

    return true;
  }
}

function extractBearerToken(authorization: string | string[] | undefined) {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  const [scheme, token] = (value || '').split(' ');

  return scheme?.toLowerCase() === 'bearer' ? token || '' : '';
}
