# Module S - CRM Send Owner State Batch

## Reference Baseline

- NestJS database guidance treats repeated per-record database reads in loops as an N+1 performance issue and recommends batching or aggregation for list-driven workflows.
- NestJS performance guidance recommends selecting only needed data and moving hot-path counts into database aggregation instead of application loops.
- Prisma Client supports `groupBy` across multiple scalar fields with `_count._all`: <https://github.com/prisma/web/blob/main/apps/docs/content/docs/orm/reference/prisma-client-reference.mdx>.
- Prisma Client supports `findMany` with `OR` filters for loading a batch of scoped records in one query: <https://github.com/prisma/web/blob/main/apps/docs/content/docs/orm/reference/prisma-client-reference.mdx>.

## Finding

`CrmSendSchedulerService.dispatchDueMessages()` previously initialized each owner state lazily. For every new owner in the due candidate batch, it issued:

- one send preference lookup
- one queued message count
- one daily dispatched count
- one first-touch dispatched count
- one follow-up dispatched count

The in-memory `ownerStates` map prevented duplicate work for the same owner, but a batch with many owners still scaled as five owner-state queries per owner before mailbox checks and enqueue.

## Adopted Shape

- Add `CrmStore.listOwnerSendStates()` as a scheduler-specific batch read.
- Deduplicate `(organizationId, ownerUserId)` pairs from the due candidate batch.
- Load owner send preferences with one `findMany({ where: { OR } })`.
- Load queued counts with one `crmMessage.groupBy({ by: ['organizationId', 'ownerUserId'] })`.
- Load daily first-touch/follow-up counts with one `crmMessage.groupBy({ by: ['organizationId', 'ownerUserId', 'stepIndex'] })`.
- Keep scheduler quota decisions and BullMQ enqueue behavior unchanged.

## Not Adopted

- Mailbox daily/hourly capacity was not batched in this step. The scheduler updates message status as it walks candidates, so mailbox capacity batching needs a separate design that accounts for in-batch mailbox reservations.
- No schema change. Existing indexes from Module Q still support status/time owner-scoped message scans.
- No queue payload, worker claim, quota ledger, or send gateway behavior change.

## Impact Boundary

- Reduces owner-state query count from O(owner count \* 5) to three batch queries per scheduler pass.
- Keeps per-candidate mailbox capacity checks and queueing order intact.
- Keeps `claimFirstMessageSendDelivery()` as the final consistency boundary before quota claim and sending.

## Verification

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-send-scheduler.service.spec.ts
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/store/prisma-crm.store.spec.ts apps/server/src/modules/crm/crm-send-scheduler.service.spec.ts apps/server/src/modules/crm/crm-send-worker.service.spec.ts
pnpm --filter @soybean/server typecheck
git diff --check
```
