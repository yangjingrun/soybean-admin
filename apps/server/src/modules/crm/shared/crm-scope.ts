import { ForbiddenException } from '@nestjs/common';
import {
  createOrganizationOwnerFilter,
  createOrganizationOwnerWriteScope,
  createOrganizationReadScope,
  isOrganizationAdmin
} from '../../../shared/permission-policy';
import type { CrmUserContext } from './crm-context';

export interface CrmReadScope {
  organizationId: string;
  ownerUserId?: string;
}

export interface CrmOwnerWriteScope {
  organizationId: string;
  ownerUserId: string;
}

export interface CrmOrganizationAdminScope {
  organizationId: string;
}

/** Create org-wide read scope for admins and owner scope for ordinary members. */
export function createCrmReadScope(context: CrmUserContext): CrmReadScope {
  return createOrganizationReadScope(context);
}

/** Create an optional owner filter for repository methods that already receive organizationId. */
export function createCrmOwnerFilter(context: CrmUserContext): { ownerUserId?: string } {
  return createOrganizationOwnerFilter(context);
}

/** Create owner-only scope for private CRM writes. */
export function createCrmOwnerWriteScope(context: CrmUserContext): CrmOwnerWriteScope {
  return createOrganizationOwnerWriteScope(context);
}

/** Require CRM organization configuration privileges. */
export function requireCrmOrganizationAdminScope(context: CrmUserContext): CrmOrganizationAdminScope {
  if (!isOrganizationAdmin(context)) {
    throw new ForbiddenException('仅组织管理员可操作 CRM 组织配置');
  }

  return { organizationId: context.organizationId };
}
