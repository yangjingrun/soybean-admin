# Module G - Runtime, Queue, Scheduler, And Process Topology

## References Used

- NestJS lifecycle events: `onModuleInit()` is called after module dependencies are resolved; shutdown hooks need `app.enableShutdownHooks()` for termination signals.
  - https://docs.nestjs.com/fundamentals/lifecycle-events
- BullMQ workers: `Worker` owns background job consumption, supports local `concurrency`, and should be closed with `worker.close()` for graceful shutdown.
  - https://docs.bullmq.io/guide/workers
  - https://docs.bullmq.io/guide/workers/concurrency
  - https://docs.bullmq.io/guide/workers/graceful-shutdown
  - https://docs.bullmq.io/guide/going-to-production

## Mature Pattern

- API process owns HTTP controllers and queue producers.
- Worker process owns BullMQ `Worker` consumers.
- Scheduler process owns periodic scans, watch renewals, and maintenance timers.
- Local development can still use a single `all` process to reduce setup friction.
- Shutdown must let Nest call provider cleanup hooks so BullMQ workers can close gracefully.

## Local Scope

- `apps/server/src/modules/app-config/app-config.loader.ts`
- `apps/server/src/modules/app-config/app-config.loader.spec.ts`
- `apps/server/src/main.ts`
- `apps/server/src/modules/ai-leads/ai-lead-search-task-worker-host.service.ts`
- `apps/server/src/modules/crm/crm-send-worker-host.service.ts`
- `apps/server/src/modules/crm/crm-gmail-history-sync-worker-host.service.ts`
- `apps/server/src/modules/crm/crm-ai-draft-task-worker-host.service.ts`
- `apps/server/src/modules/crm/crm-send-scheduler-host.service.ts`
- `apps/server/src/modules/crm/crm-gmail-watch-renewal.service.ts`
- `apps/server/src/modules/crm/crm-archive-slimming.service.ts`

## Role Table

| Host | Role | Reason |
| --- | --- | --- |
| `AiLeadSearchTaskWorkerHost` | `worker` | Consumes AI leads BullMQ jobs. |
| `CrmSendWorkerHost` | `worker` | Consumes CRM send BullMQ jobs. |
| `CrmGmailHistorySyncWorkerHost` | `worker` | Consumes Gmail history sync BullMQ jobs. |
| `CrmAiDraftTaskWorkerHost` | `worker` | Consumes CRM AI draft BullMQ jobs. |
| `CrmSendSchedulerHost` | `scheduler` | Periodically dispatches due messages. |
| `CrmGmailWatchRenewalService` | `scheduler` | Periodically renews Gmail watches. |
| `CrmArchiveSlimmingService` | `scheduler` | Periodically slims archived accounts. |
| Queue services and controllers | `api` or `all` | Produce jobs and serve HTTP requests; they should not require worker role. |

## Execution Tasks

1. Add `SERVER_RUNTIME_ROLE=api|worker|scheduler|all` config parsing.
2. Default to `all` to preserve current local behavior.
3. Add small helpers:
   - `canRunWorkers(config)`
   - `canRunSchedulers(config)`
4. Gate BullMQ worker host startup behind `canRunWorkers`.
5. Gate periodic scheduler/timer startup behind `canRunSchedulers`.
6. Enable Nest shutdown hooks in `main.ts` so `onModuleDestroy()` runs for process signals.
7. Add app-config tests for role parsing and helper behavior.
8. Add low-cost no-op tests only where existing host specs can instantiate without real Redis.

## Safety Checks

- Do not change queue names, job payloads, runVersion semantics, task state transitions, concurrency values, or interval values.
- Do not disable queue producers in API role.
- Invalid `SERVER_RUNTIME_ROLE` should fail fast at startup instead of silently picking a role.
- `all` must continue to run both workers and schedulers.

## Verification

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/app-config/app-config.loader.spec.ts \
  apps/server/src/modules/ai-leads/ai-lead-search-task-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-send-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-watch-renewal.service.spec.ts \
  apps/server/src/modules/crm/crm-archive-slimming.service.spec.ts

pnpm --filter @soybean/server typecheck
git diff --check
```
