import { hasPermission } from '@soybean/shared';
/**
 * Check whether a runtime user can access one route meta declaration.
 *
 * @param user Runtime user roles and product permissions
 * @param meta Route auth metadata
 */
export function hasRouteAccess(user, meta = {}) {
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
export function filterAuthRoutesByUser(routes, user) {
  return routes.flatMap(route => filterAuthRouteByUser(route, user));
}
function filterAuthRouteByUser(route, user) {
  const filterRoute = { ...route };
  if (filterRoute.children?.length) {
    filterRoute.children = filterRoute.children.flatMap(item => filterAuthRouteByUser(item, user));
  }
  if (filterRoute.children?.length === 0) {
    return [];
  }
  return hasRouteAccess(user, route.meta) ? [filterRoute] : [];
}
