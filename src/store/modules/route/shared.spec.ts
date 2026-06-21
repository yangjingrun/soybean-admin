import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aiLeadsKeywordStrategyManagePermission } from '@soybean/shared';
import type { ElegantConstRoute } from '@elegant-router/types';
import { generatedRoutes } from '../../../router/elegant/routes';
import type { RouteAccessMeta } from './access';
import { filterAuthRoutesByUser, hasRouteAccess } from './access';

describe('route shared auth helpers', () => {
  it('allows public auth routes without role or permission requirements', () => {
    assert.equal(hasRouteAccess(createUser(), {}), true);
  });

  it('keeps role based route access compatible', () => {
    assert.equal(hasRouteAccess(createUser({ roles: ['R_SUPER'] }), { roles: ['R_SUPER'] }), true);
    assert.equal(hasRouteAccess(createUser({ roles: ['R_USER'] }), { roles: ['R_SUPER'] }), false);
  });

  it('allows route access by runtime permission buttons', () => {
    assert.equal(
      hasRouteAccess(createUser({ buttons: [aiLeadsKeywordStrategyManagePermission] }), {
        permissions: [aiLeadsKeywordStrategyManagePermission]
      }),
      true
    );
    assert.equal(hasRouteAccess(createUser({ buttons: [] }), { permissions: [aiLeadsKeywordStrategyManagePermission] }), false);
  });

  it('filters child routes with the same role and permission policy as the guard', () => {
    const routes = [
      createRoute({
        name: 'crm',
        children: [
          createRoute({ name: 'crm_visible' }),
          createRoute({ name: 'crm_hidden', meta: { permissions: [aiLeadsKeywordStrategyManagePermission] } })
        ]
      })
    ];

    const [route] = filterAuthRoutesByUser(routes, createUser());

    assert.deepEqual(route.children?.map(child => child.name), ['crm_visible']);
  });

  it('keeps ai settings reachable for users without platform config permissions', () => {
    const route = generatedRoutes.find(item => item.name === 'ai-settings');

    assert.ok(route);
    assert.equal(hasRouteAccess(createUser(), route.meta), true);
  });
});

function createUser(input: Partial<Pick<Api.Auth.UserInfo, 'roles' | 'buttons'>> = {}) {
  return {
    roles: input.roles ?? ['R_USER'],
    buttons: input.buttons ?? []
  };
}

function createRoute(input: { name: string; meta?: RouteAccessMeta; children?: ElegantConstRoute[] }): ElegantConstRoute {
  return {
    name: input.name,
    path: `/${input.name}`,
    meta: input.meta,
    children: input.children
  } as ElegantConstRoute;
}
