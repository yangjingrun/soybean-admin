import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import { toRequestUserContext, type RequestUserContext } from '../../shared/request-context';
import type { UserInfo } from './auth.types';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';

/** Mark a route as not requiring the normal user login guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Require at least one of the given role codes. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): UserInfo | null => {
  const request = context.switchToHttp().getRequest<{ user?: UserInfo }>();

  return request.user || null;
});

export const CurrentContext = createParamDecorator((_data: unknown, context: ExecutionContext): RequestUserContext | null => {
  const request = context.switchToHttp().getRequest<{ user?: UserInfo }>();

  return request.user ? toRequestUserContext(request.user) : null;
});
