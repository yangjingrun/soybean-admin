# Module O - System Log List Indexes

## Reference Baseline

- Prisma official docs show compound indexes with `@@index([fieldA, fieldB])` and recommend indexing fields used in `where`, `orderBy`, and relations to improve query performance: <https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes>.
- Prisma migration workflow keeps database index changes explicit in SQL migration files: <https://www.prisma.io/docs/orm/prisma-migrate>.
- Local operations panel reads recent CRM logs with `module=crm`, and the full system log page supports level, status, module, action, user, keyword, and time filters.

## Finding

`SystemLogService.list()` always orders by `createdAt desc` and can filter by `level`, `status`, `module`, `action`, `userId`, and time range.

The `SystemLog` table only had single-column indexes on `createdAt`, `level`, and `userId`. That helps broad time scans and some simple filters, but it does not cover the common operations queries that combine equality filters with time ordering.

## Adopted Shape

- Keep controller, service, response shape, pagination, and log content unchanged.
- Add B-tree compound indexes for equality filters plus `createdAt` ordering:
  - `status + createdAt`
  - `level + status + createdAt`
  - `module + action + createdAt`
  - `userId + createdAt`
- Keep existing single-column indexes for now to avoid changing unrelated query plans.

## Not Adopted

- No PostgreSQL full-text, trigram, or GIN index for `keyword` yet. The keyword search spans several text fields with `contains` and needs a separate product/DB decision about fuzzy search behavior and extension availability.
- No code path changes to `count()` or pagination. Offset pagination remains the existing API contract.

## Impact Boundary

- The migration only adds indexes and does not rewrite log data.
- Write cost increases slightly for log inserts, but the table is primarily used for operations reads and audit diagnostics.
- Existing UI filters and API parameters are unchanged.

## Verification

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/system-log/system-log.service.spec.ts apps/server/src/modules/system-log/system-log.controller.spec.ts apps/server/src/modules/system-log/system-log-sanitizer.spec.ts
pnpm --filter @soybean/server exec prisma validate --schema ../../prisma/schema.prisma
pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma
pnpm --filter @soybean/server typecheck
git diff --check
```
