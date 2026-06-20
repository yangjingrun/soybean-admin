# Module A - extensible authorization policy

## References

- NestJS authorization and roles guard: https://docs.nestjs.com/security/authorization
- NestJS custom decorators: https://docs.nestjs.com/custom-decorators
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

## Mature Pattern

- Use route metadata and a guard for coarse-grained authorization.
- Keep final server-side checks near the operation when the handler needs normalized user context or a module-specific error.
- Avoid relying on frontend menu visibility as the access-control boundary.
- Keep policy metadata extensible so future permissions can add different role sets or richer policy fields without changing controller method bodies.

## Local Scope

- `apps/server/src/modules/auth/auth.decorators.ts`
- `apps/server/src/modules/auth/roles.guard.ts`
- `apps/server/src/modules/auth/auth.guard.spec.ts`
- `apps/server/src/modules/auth/platform-super-policy.spec.ts`
- `apps/server/src/modules/ai-gateway/ai-gateway.controller.ts`
- `apps/server/src/modules/ai-leads/ai-leads.controller.ts`
- `apps/server/src/modules/crm/crm.controller.ts`
- `apps/server/src/modules/system-user/system-user.controller.ts`
- `apps/server/src/modules/system-log/system-log.controller.ts`

## Minimum Task

- Add a generic `@RequirePolicy({ anyRoles, allRoles, anyOrganizationRoles, deniedMessage })` decorator as the stable extension point.
- Implement `@SuperOnly(message)` as a thin shortcut over `RequirePolicy`.
- Implement `@OrganizationAdminOnly(message)` as a future route-level shortcut for organization-admin-or-platform-super operations.
- Let `RolesGuard` read policy metadata first, then fall back to legacy `@Roles(...)`.
- Add `@SuperOnly(...)` on platform-level controllers without changing their route paths or service calls.
- Keep existing `requireSuperUserContext` calls so direct method tests and handler-level context normalization remain intact.

## Global Impact

- Runtime permission semantics stay platform-super-only for the touched controllers.
- Non-super users keep the same module-specific error messages instead of falling back to the generic role guard message.
- This does not touch CRM owner/admin read-write rules.
- Future role and organization-role permission shapes can be introduced behind `RequirePolicy` without inventing another guard entry point.

## Not Adopted

- Do not replace CRM owner-only service checks with decorators; those decisions depend on resource ownership and must stay in service/store boundaries.
- Do not remove existing controller helper checks in this step because unit tests call controller methods directly and services need the normalized operator context.
- Do not introduce a database-backed permission registry in this step; current project roles are still request-context based and this change is only the code-level extension point.

## Verification

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/auth/auth.guard.spec.ts apps/server/src/modules/auth/platform-super-policy.spec.ts apps/server/src/shared/permission-policy.spec.ts apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts apps/server/src/modules/ai-leads/ai-leads.controller.spec.ts apps/server/src/modules/system-user/system-user.controller.spec.ts apps/server/src/modules/system-log/system-log.controller.spec.ts apps/server/src/modules/crm/crm.controller.spec.ts
pnpm --filter @soybean/server typecheck
git diff --check
```
