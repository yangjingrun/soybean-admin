# Module Q - CRM Send Scheduler Query

## Reference Baseline

- Prisma relation filters allow `findMany` queries to filter by related records in `where`, instead of fetching rows first and filtering everything in application code: <https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries>.
- Prisma index guidance recommends indexing fields used in `where`, `orderBy`, and relations to avoid full table scans as data grows: <https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes>.
- BullMQ scheduler/worker patterns favor small candidate batches and guarding before side effects.

## Finding

`listDueSendCandidates()` queried due `draft_ready` messages by `status + scheduledAt + mailboxId` and then filtered inactive mailbox, non-running enrollment, and unsubscribed contacts in TypeScript.

That preserves correctness but can pull rows that are not actually sendable. The queue scan also lacked a compound index for `status + scheduledAt + updatedAt`, and stale queued reconciliation lacked an index for `status + bullJobId + scheduledAt + updatedAt`.

## Adopted Shape

- Keep send scheduler behavior and candidate output unchanged.
- Push these guard filters into Prisma:
  - mailbox must be `active`
  - enrollment must be `sequence_running`
  - contact email status must not be `unsubscribed`
- Keep the existing blacklist check in application code for now because it depends on `organizationId + contact.emailHash` after loading candidate context.
- Add queue scan indexes:
  - `CrmMessage`: `status + scheduledAt + updatedAt`
  - `CrmMessage`: `status + bullJobId + scheduledAt + updatedAt`

## Impact Boundary

- No controller, DTO, response, queue job payload, or worker claim semantics change.
- The scheduler fetches fewer invalid candidates before BullMQ enqueue.
- The worker claim guard remains the final consistency boundary before sending.

## Verification

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/store/prisma-crm.store.spec.ts apps/server/src/modules/crm/crm-list-indexes.spec.ts
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-send-scheduler.service.spec.ts apps/server/src/modules/crm/crm-send-worker.service.spec.ts
pnpm --filter @soybean/server exec prisma validate --schema ../../prisma/schema.prisma
pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma
pnpm --filter @soybean/server typecheck
git diff --check
```
