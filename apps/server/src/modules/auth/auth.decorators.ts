import { applyDecorators, createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { OrganizationRole } from '@soybean/shared';
import { toRequestUserContext, type RequestUserContext } from '../../shared/request-context';
import type { UserInfo } from './auth.types';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';
export const ROLE_DENIED_MESSAGE_KEY = 'auth:roleDeniedMessage';
export const AUTH_POLICY_KEY = 'auth:policy';

export interface AuthPolicyMetadata {
  /** Passes when the user has at least one of these role codes. */
  anyRoles?: string[];
  /** Passes when the user has every listed role code. */
  allRoles?: string[];
  /** Passes when the user has at least one of these organization roles. */
  anyOrganizationRoles?: OrganizationRole[];
  deniedMessage?: string;
}

/** Mark a route as not requiring the normal user login guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Require at least one of the given role codes. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** Attach an extensible authorization policy for the global roles guard. */
export const RequirePolicy = (policy: AuthPolicyMetadata) =>
  applyDecorators(
    SetMetadata(AUTH_POLICY_KEY, policy),
    ...(policy.anyRoles?.length ? [Roles(...policy.anyRoles)] : []),
    ...(policy.deniedMessage ? [SetMetadata(ROLE_DENIED_MESSAGE_KEY, policy.deniedMessage)] : [])
  );

/** Mark a platform-super-only route while preserving a module-specific denial message. */
export const SuperOnly = (message: string) => RequirePolicy({ anyRoles: ['R_SUPER'], deniedMessage: message });

/** Mark an organization-admin route while still allowing platform super administrators. */
export const OrganizationAdminOnly = (message: string) =>
  RequirePolicy({ anyRoles: ['R_SUPER'], anyOrganizationRoles: ['admin'], deniedMessage: message });

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): UserInfo | null => {
  const request = context.switchToHttp().getRequest<{ user?: UserInfo }>();

  return request.user || null;
});

export const CurrentContext = createParamDecorator((_data: unknown, context: ExecutionContext): RequestUserContext | null => {
  const request = context.switchToHttp().getRequest<{ user?: UserInfo }>();

  return request.user ? toRequestUserContext(request.user) : null;
});
