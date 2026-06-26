# Module T - CRM Send Mailbox State Batch

## Reference Baseline

- NestJS provider and DI pattern: keep orchestration in the scheduler service and persistence behind the injected `CrmStore` boundary.
  - https://docs.nestjs.com/providers
  - https://docs.nestjs.com/fundamentals/custom-providers
- Prisma aggregation pattern: use `groupBy` with `_count` for database-side counts instead of per-row count loops.
  - https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing
  - https://www.prisma.io/docs/orm/reference/prisma-client-reference
- Local backend rules used for this stage:
  - `nestjs-best-practices/rules/db-avoid-n-plus-one.md`
  - `nestjs-best-practices/rules/perf-optimize-database.md`

## Finding

After owner state was batched, `CrmSendSchedulerService` still checked mailbox capacity per due candidate. Each candidate issued two `countDispatchedMessages` calls: one daily count and one hourly count.

That kept the scheduler correct, but it left an N+1 path in the hot dispatch loop. It also meant two candidates for the same mailbox in one scheduler tick did not share a local capacity snapshot before queueing.

## Adopted

- Added `CrmStore.listMailboxSendStates()` as the persistence boundary for mailbox capacity snapshots.
- Deduplicated `(organizationId, mailboxId)` pairs before querying.
- Used two Prisma `groupBy` queries, one for the daily range and one for the hourly range.
- Kept the final send-time quota protection in `claimFirstMessageSendDelivery`.
- Added in-memory reservation after each successfully queued candidate so one scheduler tick respects the mailbox limit before the worker claims delivery.

## Not Adopted

- No schema change.
- No raw SQL.
- No BullMQ concurrency change.
- No quota ledger table in this stage. The existing transactional delivery claim remains the consistency boundary for actual sends.

## Verification

- Red test first:
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-send-scheduler.service.spec.ts`
- Focused regression:
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/store/prisma-crm.store.spec.ts apps/server/src/modules/crm/crm-send-scheduler.service.spec.ts apps/server/src/modules/crm/crm-send-worker.service.spec.ts`
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts`
  - `pnpm --filter @soybean/server typecheck`
