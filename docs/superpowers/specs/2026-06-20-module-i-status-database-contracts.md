# Module I - Status Database Contracts

## Reference Baseline

- Prisma Migrate official docs: commit schema changes as migrations and customize SQL when the rollout needs explicit control: <https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations>.
- Prisma schema docs: enum fields model a fixed set of values in Prisma Client and the database provider: <https://www.prisma.io/docs/orm/prisma-schema/data-model/models#defining-enums>.
- PostgreSQL official docs: enum types are suited to static ordered value sets and reject values outside the declared labels: <https://www.postgresql.org/docs/current/datatype-enum.html>.

## Adopted Shape

- Convert the queue-sensitive fields from `String` to Prisma/PostgreSQL enums because the project has not launched yet and can accept a sharper migration.
- Constrain only the stable, queue-sensitive status fields:
  - `AiLeadSearchTask.status`
  - `AiLeadSearchTaskQuery.status`
  - `CrmSequenceEnrollment.status`
  - `CrmMessage.status`
  - `CrmAiDraftTask.status`
  - `CrmAiDraftTaskItem.status`
- Keep TypeScript status arrays as the application source and add a migration/schema test to prevent manual drift.

## Not Adopted

- Do not convert every CRM status-like string at once. Account, mailbox, template, product-line, inbox and policy statuses may still become more configurable; this pass protects the task and queue states with the highest worker/compensation risk.
- Do not add duplicate `CHECK` constraints on top of PostgreSQL enums. The enum type is already the database boundary for allowed labels.

## Preflight

Run these before applying the migration in an existing environment:

```sql
SELECT status, count(*) FROM "AiLeadSearchTask" WHERE status NOT IN ('queued', 'running', 'interrupted', 'failed', 'completed', 'discarded') GROUP BY status;
SELECT status, count(*) FROM "AiLeadSearchTaskQuery" WHERE status NOT IN ('pending', 'running', 'completed', 'failed') GROUP BY status;
SELECT status, count(*) FROM "CrmSequenceEnrollment" WHERE status NOT IN ('draft_review_pending', 'ready_to_send', 'sequence_running', 'paused', 'stopped', 'replied', 'archived') GROUP BY status;
SELECT status, count(*) FROM "CrmMessage" WHERE status NOT IN ('draft_pending_review', 'draft_ready', 'queued', 'sent', 'failed', 'skipped') GROUP BY status;
SELECT status, count(*) FROM "CrmAiDraftTask" WHERE status NOT IN ('queued', 'running', 'completed', 'failed', 'cancelled') GROUP BY status;
SELECT status, count(*) FROM "CrmAiDraftTaskItem" WHERE status NOT IN ('pending', 'running', 'retrying', 'succeeded', 'skipped', 'failed') GROUP BY status;
```

Each query must return zero rows. If a query returns rows, stop and decide whether to repair data or add a deliberate new enum label before deploying the migration.

## Verification

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/shared/status-database-contracts.spec.ts \
  apps/server/src/modules/ai-leads/ai-lead-search-task-state.spec.ts \
  apps/server/src/modules/crm/crm-ai-draft-task-state.spec.ts

pnpm --filter @soybean/server typecheck
git diff --check
```
