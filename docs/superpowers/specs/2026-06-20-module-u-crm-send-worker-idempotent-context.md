# Module U - CRM Send Worker Idempotent Context

## Reference Baseline

- BullMQ idempotent jobs: retryable jobs should be designed with failure in mind and kept as atomic as possible.
  - https://docs.bullmq.io/patterns/idempotent-jobs
- NestJS queues: BullMQ workers run background jobs that may be retried and distributed across workers.
  - https://docs.nestjs.com/techniques/queues
- Local backend rules used for this stage:
  - `nestjs-best-practices/rules/micro-use-queues.md`
  - `nestjs-best-practices/rules/error-handle-async-errors.md`

## Finding

`CrmSendWorkerService.processSendJob()` called the email gateway first, then loaded local follow-up context with `getGlobalConfig()` and `findDefaultEmailTemplateGroup()`.

If those local queries failed after Gmail accepted the send, the catch branch treated the job like a send failure. That made a local preparation error appear after an external side effect, which weakens queue retry idempotency.

## Adopted

- Prepared the next follow-up draft context before calling the external send gateway.
- Kept `claimFirstMessageSendDelivery()` as the final pre-send guard and quota claim boundary.
- Kept `completeFirstMessageSend()` as the persisted send completion boundary.
- Added a regression test that proves local config failures do not call the email gateway.

## Not Adopted

- No new `sending` message status in this stage.
- No outbox table or provider idempotency key in this stage.
- No schema migration.
- No change to BullMQ retry settings.
- No change to Gmail gateway behavior.

Those are valid deeper options, but they affect the global message state model, frontend filters, reconciliation, and migration scope.

## Verification

- Red test first:
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-send-worker.service.spec.ts`
- Green test:
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-send-worker.service.spec.ts`
