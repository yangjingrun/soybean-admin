# Module R - CRM Send Blacklist Batch Lookup

## Reference Baseline

- NestJS database guidance flags N+1 query loops as a high-impact performance issue and recommends eager loading, joins, or batched lookups when a list drives repeated database reads.
- NestJS performance guidance recommends selecting only needed columns and avoiding over-fetching relations in hot query paths.
- Prisma Client supports `findMany` with `OR` filters for multiple key pairs and `select` for returning only required fields: <https://github.com/prisma/web/blob/main/apps/docs/content/docs/orm/reference/prisma-client-reference.mdx>.
- Prisma relation filters remain the preferred query-level guard for related mailbox, enrollment, and contact status constraints: <https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting>.

## Finding

`listDueSendCandidates()` already filters due messages and now pushes mailbox, enrollment, and contact guards into Prisma. The remaining blacklist check still did one `crmBlacklist.findUnique()` per candidate.

That kept behavior correct, but it created an N+1 pattern in the scheduler hot path. A full batch of 50 due candidates could issue 1 message query plus 50 blacklist queries before enqueueing.

## Adopted Shape

- Keep scheduler output and business rules unchanged.
- Deduplicate candidate blacklist keys by `(organizationId, contact.emailHash)`.
- Batch load existing blacklist rows with one Prisma `findMany({ where: { OR }, select })`.
- Convert loaded blacklist pairs to a `Set` and keep the existing in-memory candidate filtering.
- Keep `claimFirstMessageSendDelivery()` as the final send-time blacklist boundary, so late unsubscribe events are still blocked before quota claim and send.

## Not Adopted

- No raw SQL join for this step. The current Prisma relation include shape already feeds the scheduler record mapper, and the blacklist table has the scoped unique key needed by the batch lookup.
- No schema change. `CrmBlacklist` already has the `organizationId + emailHash` unique/indexed access path.
- No behavior expansion to retry, queue policy, or worker state transitions.

## Impact Boundary

- Affects only CRM due-send candidate selection in `PrismaCrmStore`.
- Reduces blacklist query count from O(n) per batch to O(1) per batch.
- Does not change controller contracts, DTOs, BullMQ payloads, quota claim, send gateway calls, or unsubscribe semantics.

## Verification

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-send-scheduler.service.spec.ts apps/server/src/modules/crm/crm-send-worker.service.spec.ts
pnpm --filter @soybean/server typecheck
git diff --check
```
