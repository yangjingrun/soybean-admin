# Module W - CRM Batch Next Draft Preload

## Reference Baseline

- Prisma query optimization guidance recommends replacing looped relation reads with `include` or batched `findMany` plus `in` filters to avoid N+1 query paths.
  - https://github.com/prisma/web/blob/main/apps/docs/content/docs/orm/prisma-client/queries/advanced/query-optimization-performance.mdx
- Prisma Client supports `findMany` with `include` for related records.
  - https://github.com/prisma/web/blob/main/apps/docs/content/docs/orm/reference/prisma-client-reference.mdx
- Local backend rules used for this stage:
  - `nestjs-best-practices/rules/db-avoid-n-plus-one.md`
  - `nestjs-best-practices/rules/perf-optimize-database.md`
  - `nestjs-best-practices/rules/arch-use-repository-pattern.md`

## Finding

`CrmService.batchGenerateNextDrafts()` first loaded each sequence review item for skip checks, then called `generateNextDraft()` for successful rows. `generateNextDraft()` loaded the same sequence review item again and also loaded shared generation context for each generated row.

The write boundary was already safe because each generated draft still used `createFollowUpDraftBundle()` with owner scope, expected enrollment statuses, and blocking message statuses. The inefficient part was the read preparation before that guarded write.

## Adopted

- Reused `CrmStore.listSequenceReviewItemsByIds()` to preload all owner-scoped review records once for the batch.
- Split `generateNextDraft()` into a public id-based method and an internal `generateNextDraftFromReviewItem()` method.
- Added `loadNextDraftGenerationContext()` for reusable generation resources: global config, default template group, and active persona profiles.
- Made batch generation lazily load that shared context only when at least one row is actually eligible for generation.
- Preserved original batch ordering, per-item results, skip messages, owner-only scope, and guarded draft writes.

## Not Adopted

- No parallel generation in this stage. AI calls and guarded writes can have side effects, so changing concurrency belongs in the background AI draft task flow, not this local batch endpoint.
- No schema migration or new store method. The previous stage already introduced the scoped batch review read needed here.
- No broad refactor of `generateConfiguredReviewDraft()`. It remains the single AI writing boundary.
- No change to `batchApproveMessageDrafts()` yet. It writes message/enrollment/account/timeline state and should get its own small stage.

## Verification

- Red test first:
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts`
- Green service regression:
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts`
- Typecheck:
  - `pnpm --filter @soybean/server typecheck`
