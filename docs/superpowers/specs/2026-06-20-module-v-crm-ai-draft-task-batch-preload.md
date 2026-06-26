# Module V - CRM AI Draft Task Batch Preload

## Reference Baseline

- Prisma Client read queries support `findMany` with `where` filters and `include` for related records.
  - https://www.prisma.io/docs/orm/prisma-client/queries/crud
- DataLoader batches backend reads and maps object-shaped batch results back to the requested key order.
  - https://github.com/graphql/dataloader
- Local backend rules used for this stage:
  - `nestjs-best-practices/rules/db-avoid-n-plus-one.md`
  - `nestjs-best-practices/rules/perf-optimize-database.md`
  - `nestjs-best-practices/rules/arch-use-repository-pattern.md`

## Finding

`CrmService.createAiDraftTask()` accepts up to 200 selected enrollments. Before this stage it loaded each selected sequence review item one by one and checked each contact email against the organization blacklist one by one.

That kept the business behavior correct, but created a clear N+1 query path before the task creation transaction.

## Adopted

- Added `CrmStore.listSequenceReviewItemsByIds()` to batch load scoped sequence review records with the existing review include shape.
- Added `CrmStore.listBlacklistEntriesByEmailHashes()` to batch load organization blacklist hits once per task request.
- Changed `createAiDraftTask()` to preload review items, map them by enrollment id, and still build task items in the normalized input order.
- Kept owner-only task creation by passing `ownerUserId: context.userId` into the batch review query.
- Kept missing or unauthorized enrollments as skipped task items with the existing message.
- Kept task creation writes and queue semantics unchanged.

## Not Adopted

- No DataLoader dependency was introduced. The local service only needs one explicit batch read per request, and a dependency would add more lifecycle and cache boundary decisions.
- No parallel task item writes. The existing transaction-derived counters and task item ordering stay unchanged.
- No schema migration or index change in this stage. The queries use existing scoped ids and blacklist email hash columns.
- No refactor of `batchGenerateNextDrafts()` or `batchApproveMessageDrafts()` yet. Those call deeper single-item generation and approval paths, so they should be reviewed in a separate stage.
- No `CrmStore` interface split yet. It remains a useful follow-up, but doing it here would touch many unrelated tests and services.

## Verification

- Red test first:
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts`
- Store test:
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`
- Typecheck:
  - `pnpm --filter @soybean/server typecheck`
- Final focused regression:
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`
