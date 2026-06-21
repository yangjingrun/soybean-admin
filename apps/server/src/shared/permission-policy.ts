import { ForbiddenException } from '@nestjs/common';
import { hasPermission as hasSharedPermission, type PermissionCode } from '@soybean/shared';
import { requireRequestUserContext, type RequestUserContext } from './request-context';

export interface EmailBodyVisibilityConfig {
  allowAdminViewMemberEmailBody?: boolean | null;
}

export function isSuper(context: Pick<RequestUserContext, 'roles'>) {
  return context.roles.includes('R_SUPER');
}

export function isOrganizationAdmin(context: Pick<RequestUserContext, 'organizationRole' | 'roles'>) {
  return context.organizationRole === 'admin' || isSuper(context);
}

/** Require the platform super role for global maintenance operations. */
export function assertSuper(context: Pick<RequestUserContext, 'roles'>, message: string): void {
  if (!isSuper(context)) {
    throw new ForbiddenException(message);
  }
}

/** Require an authenticated platform super user and return the normalized request context. */
export function requireSuperUserContext(context: RequestUserContext | null, message: string): RequestUserContext {
  const userContext = requireRequestUserContext(context);
  assertSuper(userContext, message);

  return userContext;
}

/** Require organization admin privileges while allowing platform super users. */
export function assertOrganizationAdmin(
  context: Pick<RequestUserContext, 'organizationRole' | 'roles'>,
  message: string
): void {
  if (!isOrganizationAdmin(context)) {
    throw new ForbiddenException(message);
  }
}

/** Check a request context against one dynamic product permission. */
export function hasPermission(
  context: Pick<RequestUserContext, 'roles' | 'buttons'>,
  permission: PermissionCode
): boolean {
  return hasSharedPermission(context, permission);
}

/** Require one dynamic product permission while preserving super-user semantics. */
export function requirePermission(
  context: Pick<RequestUserContext, 'roles' | 'buttons'>,
  permission: PermissionCode,
  message: string
): void {
  if (!hasPermission(context, permission)) {
    throw new ForbiddenException(message);
  }
}

/** Decide whether the current user can inspect an email body owned by another CRM member. */
export function canViewEmailBody(
  context: Pick<RequestUserContext, 'userId' | 'organizationRole' | 'roles'>,
  ownerUserId: string,
  organizationConfig?: EmailBodyVisibilityConfig | null
) {
  if (context.userId === ownerUserId || isSuper(context)) {
    return true;
  }

  return context.organizationRole === 'admin' && Boolean(organizationConfig?.allowAdminViewMemberEmailBody);
}
