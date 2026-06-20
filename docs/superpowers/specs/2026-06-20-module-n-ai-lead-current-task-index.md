# Module N - AI Lead Current Task Query Boundary

## Reference Baseline

- Prisma official docs show compound indexes with `@@index([fieldA, fieldB])` and recommend indexing fields used in `where`, `orderBy`, and relations to improve query performance: <https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes>.
- Prisma migration workflow keeps database shape changes explicit in migration SQL instead of relying on runtime code assumptions: <https://www.prisma.io/docs/orm/prisma-migrate>.
- Local confirmed rule: AI leads tasks must persist organization context because worker and restore flows cannot guess tenant context.

## Finding

`findCurrentTaskForUser()` already searches current/restorable tasks by `userId + organizationId + status/readAt` and orders by `updatedAt`.

`createTaskIfNoCurrent()` uses a serializable transaction before inserting a new task, but its guard query only checked `userId`. That made the create guard less strict than the restore query and would block the same user across organizations if the product later enables multi-organization membership.

The schema also lacked a compound index matching the current task restore/create guard path: `userId + organizationId + status + updatedAt`.

## Adopted Shape

- Keep task statuses, response shape, queue flow, and restore resolution unchanged.
- Add `organizationId` to the transaction guard query so create and restore use the same tenant boundary.
- Add `@@index([userId, organizationId, status, updatedAt])` for the high-frequency current task lookup path.
- Keep the existing `userId/status/updatedAt` and `organizationId/status/updatedAt` indexes for now; dropping or replacing indexes is a separate production performance review because it can change other query plans.

## Impact Boundary

- No route, DTO, enum, worker, or frontend contract changes.
- Existing single-organization users keep the same behavior.
- Future multi-organization users are no longer blocked by their own current task in a different organization.
- The migration only adds an index; it does not rewrite task data.

## Verification

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-leads/prisma-ai-lead-search-task.store.spec.ts
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-leads/ai-lead-search-task.service.spec.ts apps/server/src/modules/ai-leads/ai-lead-search-task-worker.service.spec.ts
pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma
pnpm --filter @soybean/server typecheck
git diff --check
```
