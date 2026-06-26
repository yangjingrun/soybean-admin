import { hasPermission, type PermissionCode } from '@soybean/shared';
import type { ElegantConstRoute } from '@elegant-router/types';

export interface RouteAccessUser {
  roles: string[];
  buttons?: string[];
}

export interface RouteAccessMeta {
  roles?: string[];
  permissions?: PermissionCode[];
}

/**
 * Check whether a runtime user can access one route meta declaration.
 *
 * @param user Runtime user roles and product permissions
 * @param meta Route auth metadata
 */
export function hasRouteAccess(user: RouteAccessUser, meta: RouteAccessMeta = {}) {
  const routeRoles = meta.roles || [];
  const routePermissions = meta.permissions || [];

  if (!routeRoles.length && !routePermissions.length) {
    return true;
  }

  if (routeRoles.some(role => user.roles.includes(role))) {
    return true;
  }

  return routePermissions.some(permission => hasPermission(user, permission));
}

/**
 * Filter auth routes using the same role and permission policy as the route guard.
 *
 * @param routes Auth route tree
 * @param user Runtime user roles and product permissions
 */
export function filterAuthRoutesByUser(routes: ElegantConstRoute[], user: RouteAccessUser) {
  return routes.flatMap(route => filterAuthRouteByUser(route, user));
}

function filterAuthRouteByUser(route: ElegantConstRoute, user: RouteAccessUser): ElegantConstRoute[] {
  const filterRoute = { ...route };

  if (filterRoute.children?.length) {
    filterRoute.children = filterRoute.children.flatMap(item => filterAuthRouteByUser(item, user));
  }

  if (filterRoute.children?.length === 0) {
    return [];
  }

  return hasRouteAccess(user, route.meta) ? [filterRoute] : [];
}
