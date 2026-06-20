import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_POLICY_KEY, ROLE_DENIED_MESSAGE_KEY, ROLES_KEY, type AuthPolicyMetadata } from './auth.decorators';
import type { UserInfo } from './auth.types';

const defaultRoleDeniedMessage = '无权访问该资源';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const policy = this.getPolicy(context);

    if (!policy || !hasPolicyRequirements(policy)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: UserInfo }>();

    if (request.user && matchesPolicy(request.user, policy)) {
      return true;
    }

    throw new ForbiddenException(this.getDeniedMessage(context));
  }

  private getPolicy(context: ExecutionContext): AuthPolicyMetadata | null {
    const explicitPolicy = this.reflector.getAllAndOverride<AuthPolicyMetadata>(AUTH_POLICY_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (explicitPolicy) {
      return explicitPolicy;
    }

    const legacyRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    return legacyRoles?.length ? { anyRoles: legacyRoles } : null;
  }

  private getDeniedMessage(context: ExecutionContext) {
    const policy = this.getPolicy(context);

    return policy?.deniedMessage || this.getLegacyDeniedMessage(context) || defaultRoleDeniedMessage;
  }

  private getLegacyDeniedMessage(context: ExecutionContext) {
    return this.reflector.getAllAndOverride<string>(ROLE_DENIED_MESSAGE_KEY, [context.getHandler(), context.getClass()]);
  }
}

function hasPolicyRequirements(policy: AuthPolicyMetadata) {
  return Boolean(policy.anyRoles?.length || policy.allRoles?.length || policy.anyOrganizationRoles?.length);
}

function matchesPolicy(user: Pick<UserInfo, 'roles' | 'organizationRole'>, policy: AuthPolicyMetadata) {
  if (policy.anyRoles?.some(role => user.roles.includes(role))) {
    return true;
  }

  if (policy.allRoles?.length && policy.allRoles.every(role => user.roles.includes(role))) {
    return true;
  }

  if (policy.anyOrganizationRoles?.includes(user.organizationRole)) {
    return true;
  }

  return false;
}
