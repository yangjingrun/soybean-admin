# Module X - CRM Batch Approve Preload

## Reference Baseline

- Prisma query optimization guidance recommends replacing looped reads with `include` or batched `findMany` plus `in` filters to avoid N+1 paths.
  - https://github.com/prisma/web/blob/main/apps/docs/content/docs/orm/prisma-client/queries/advanced/query-optimization-performance.mdx
- Local backend rules used for this stage:
  - `nestjs-best-practices/rules/db-avoid-n-plus-one.md`
  - `nestjs-best-practices/rules/perf-optimize-database.md`
  - `nestjs-best-practices/rules/arch-use-repository-pattern.md`

## Finding

`CrmService.batchApproveMessageDrafts()` loaded each selected sequence review item one by one before approving pending local drafts.

The write side was already correctly guarded by `approveMessageDraft()`, which checks owner scope, expected enrollment status, expected message status, and writes message, enrollment, account, and timeline state together.

## Adopted

- Reused `CrmStore.listSequenceReviewItemsByIds()` to preload owner-scoped review records once for the batch.
- Kept per-item result ordering based on the original input ids.
- Kept missing or unauthorized enrollments as skipped results with the existing message.
- Kept `approveMessageDraft()` as the only state mutation boundary.
- Added a regression assertion that batch approval no longer calls `getSequenceReviewItem()` per item.

## Not Adopted

- No bulk `updateMany` for approval. Draft approval changes multiple related rows and must keep per-item status guards.
- No parallel approval writes. Parallel writes could make status races and timeline ordering harder to reason about.
- No send queue or Gmail behavior change. This endpoint remains local approval only.
- No schema migration or new store method. The existing batch review read is sufficient.

## Verification

- Red test first:
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts`
- Green service regression:
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts`
- Typecheck:
  - `pnpm --filter @soybean/server typecheck`
