import { UnauthorizedException } from '@nestjs/common';
import type { OrganizationRole, UserInfo } from '@soybean/shared';

export interface RequestUserContext {
  userId: string;
  userName: string;
  roles: string[];
  organizationId: string;
  organizationRole: OrganizationRole;
}

/** Convert the authenticated user snapshot into the service-layer request context. */
export function toRequestUserContext(user: UserInfo): RequestUserContext {
  return {
    userId: user.userId,
    userName: user.userName,
    roles: user.roles,
    organizationId: user.organizationId,
    organizationRole: user.organizationRole
  };
}

/** Require an authenticated request context for direct controller calls and runtime safety. */
export function requireRequestUserContext(context: RequestUserContext | null): RequestUserContext {
  if (!context?.userId) {
    throw new UnauthorizedException('请先登录');
  }

  return context;
}
