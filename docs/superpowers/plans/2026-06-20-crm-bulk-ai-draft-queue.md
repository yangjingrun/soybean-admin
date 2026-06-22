# CRM Bulk AI Draft Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only CRM bulk AI draft generation queue with super-admin concurrency limits, item-level retry/skip/failure tracking, and progress UI, without touching real Gmail sending.

**Architecture:** The queue owns AI draft generation only. Gmail sending remains governed by mailbox quota and send-time guards. Bulk draft tasks persist task and item state in PostgreSQL, use BullMQ for background execution, and call the existing `CrmAiDraftService` to generate one draft item at a time under a configurable concurrency window.

**Tech Stack:** NestJS, Prisma/PostgreSQL, BullMQ, existing `AiGatewayService`/`CrmAiDraftService`, Vue 3 `<script setup>`, Naive UI, TypeScript, Node test runner, `vue-tsc`, oxlint, eslint.

---

## Product Rules

- Default AI draft item concurrency is `3`.
- Super admin can raise concurrency up to `5`.
- Same user can have only one active bulk AI draft task by default.
- Same organization can have a small active task cap; start with `3`.
- Bulk task concurrency applies to AI draft generation, not Gmail sending.
- Gmail real send, Gmail OAuth, Gmail watch/history, and production credentials are out of scope.
- Every generated draft still lands in local CRM as a draft for human review.
- A single item failure must not fail the whole task unless the task itself cannot run.
- Existing small synchronous batch generation remains available for small selections.

## Failure Policy

### Retryable Failures

Retry these item failures automatically:

- AI provider rate limit or throttling.
- AI provider timeout.
- AI provider temporary 5xx.
- transient network error.
- malformed AI JSON once, if the existing AI draft service can retry/repair.

Handling:

- Mark item `retrying`.
- Increase `attemptCount`.
- Retry up to `maxAttempts`, default `3`.
- Use backoff: `30s`, `60s`, `120s`.
- If recent retryable failures exceed a threshold, lower effective task concurrency for that task to `1` or `2`.
- If retries are exhausted, mark only that item `failed`.

### Non-Retryable Business Skips

Do not retry these:

- sequence no longer active.
- message already has pending or ready draft.
- product line AI config disabled or incomplete.
- missing required contact/account data.
- contact is blacklisted or unsubscribed.
- user no longer owns the sequence.
- permission no longer allows operation.

Handling:

- Mark item `skipped`.
- Save a clear `failureReason`.
- Continue the rest of the task.

### Task-Level Failures

Fail the entire task only when:

- BullMQ enqueue fails and cannot be compensated.
- task row cannot be loaded.
- task runVersion guard rejects the active run.
- Prisma schema/store operation fails outside a single item boundary.

## Database Shape

Add these Prisma models:

```prisma
model CrmAiDraftTask {
  id                     String   @id @default(cuid())
  organizationId         String
  organizationRole       String?
  ownerUserId            String
  ownerUserName          String?
  status                 String   @default("queued")
  runVersion             Int      @default(1)
  bullJobId              String?
  requestedCount         Int
  successCount           Int      @default(0)
  skippedCount           Int      @default(0)
  failedCount            Int      @default(0)
  retryingCount          Int      @default(0)
  runningCount           Int      @default(0)
  pendingCount           Int      @default(0)
  effectiveConcurrency   Int      @default(3)
  maxAttempts            Int      @default(3)
  failureReason          String?
  progressState          Json?
  resultSummary          Json?
  readAt                 DateTime?
  notifiedAt             DateTime?
  startedAt              DateTime?
  finishedAt             DateTime?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
  items                  CrmAiDraftTaskItem[]

  @@index([organizationId, ownerUserId, status, updatedAt])
  @@index([organizationId, status, updatedAt])
}

model CrmAiDraftTaskItem {
  id             String   @id @default(cuid())
  taskId         String
  organizationId String
  ownerUserId    String
  enrollmentId   String
  messageId      String?
  contactId      String?
  accountId      String?
  productLineId  String?
  stepIndex      Int
  status         String   @default("pending")
  attemptCount   Int      @default(0)
  maxAttempts    Int      @default(3)
  failureType    String?
  failureReason  String?
  draftSubject   String?
  draftBodyText  String?
  metadata       Json?
  startedAt      DateTime?
  finishedAt     DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  task           CrmAiDraftTask @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@unique([taskId, enrollmentId, stepIndex])
  @@index([taskId, status, updatedAt])
  @@index([organizationId, ownerUserId, status])
}

model CrmAiDraftQueueConfig {
  configKey              String   @id @default("crm-ai-draft")
  itemConcurrency        Int      @default(3)
  maxItemConcurrency     Int      @default(5)
  maxActiveTasksPerUser  Int      @default(1)
  maxActiveTasksPerOrg   Int      @default(3)
  maxAttempts            Int      @default(3)
  retryBackoffSeconds    Json?
  updatedById            String?
  updatedByName          String?
  updatedAt              DateTime @updatedAt
}
```

Use string statuses in DB to match current CRM patterns. Define TypeScript unions in `crm-ai-draft-task.types.ts`.

## Backend API Contract

Add endpoints under `/crm/ai-draft-tasks`:

- `POST /crm/ai-draft-tasks`
  - payload: `{ enrollmentIds: string[] }`
  - creates a bulk task from selected sequence rows.
  - owner-only for selected enrollments.
  - rejects if user already has active task.

- `GET /crm/ai-draft-tasks/current`
  - returns the current active or unread completed task for current user.

- `GET /crm/ai-draft-tasks`
  - paginated recent tasks.
  - ordinary member sees own tasks.
  - organization admin sees organization tasks.
  - super admin can inspect all within existing role rules.

- `GET /crm/ai-draft-tasks/:id`
  - includes item rows and summary counts.

- `POST /crm/ai-draft-tasks/:id/retry-failed`
  - requeues only failed retryable items.

- `POST /crm/ai-draft-tasks/:id/cancel`
  - marks queued/running task as cancelled and bumps `runVersion`.

- `PATCH /crm/ai-draft-tasks/:id/read`
  - marks completed/failed task as read.

- `GET /crm/ai-draft-queue-config`
  - super admin reads config.

- `PATCH /crm/ai-draft-queue-config`
  - super admin saves config.
  - normalize `itemConcurrency` into `1..maxItemConcurrency`.
  - default remains `3`, hard max remains `5`.

## Backend Files

- Create `apps/server/src/modules/crm/crm-ai-draft-task-state.ts`
  - status constants.
  - config normalization.
  - retry classification helper.
  - current task resolver.

- Create `apps/server/src/modules/crm/crm-ai-draft-task.types.ts`
  - task/item/config records.
  - store interface additions.
  - queue job payload.
  - progress/result metadata types.

- Create `apps/server/src/modules/crm/crm-ai-draft-task-queue.service.ts`
  - BullMQ queue adapter.
  - deterministic job id: `${taskId}:${runVersion}`.
  - `enqueueTask`, `removeTaskJob`, `applyGlobalConcurrency`.

- Create `apps/server/src/modules/crm/crm-ai-draft-task-worker-host.service.ts`
  - BullMQ worker host.
  - uses configured worker concurrency.
  - delegates work to worker service.

- Create `apps/server/src/modules/crm/crm-ai-draft-task-worker.service.ts`
  - loads task by id.
  - checks `runVersion` and active status.
  - marks running.
  - processes pending/retrying items with effective concurrency.
  - calls existing `CrmAiDraftService`.
  - persists item success/skip/failure.
  - updates task counters.

- Create `apps/server/src/modules/crm/dto/create-crm-ai-draft-task.dto.ts`
  - validates selected `enrollmentIds`.

- Create `apps/server/src/modules/crm/dto/update-crm-ai-draft-queue-config.dto.ts`
  - validates super-admin config payload.

- Modify `apps/server/src/modules/crm/crm.types.ts`
  - add task/item/config records and store methods.

- Modify `apps/server/src/modules/crm/store/prisma-crm.store.ts`
  - create task with item rows in one transaction.
  - count active user/org tasks.
  - claim next pending item with guard.
  - mark item success/skipped/failed/retrying.
  - aggregate task counters.
  - retry failed items.
  - cancel task by bumping `runVersion`.

- Modify `apps/server/src/modules/crm/crm.service.ts`
  - orchestration and permission checks.
  - no Gmail calls.
  - business logs without subject/body.

- Modify `apps/server/src/modules/crm/crm.controller.ts`
  - expose endpoints.

- Modify `apps/server/src/modules/crm/crm.module.ts`
  - register queue service and worker host.

## Frontend Files

- Modify `src/service/api/crm.ts`
  - add task/config API calls.

- Modify `src/typings/api/crm.d.ts`
  - add task/item/config payloads and views.

- Modify `src/views/crm/email-sequences/modules/useEmailSequenceTable.ts`
  - route small selections to existing synchronous batch path.
  - route large selections to new bulk task API.
  - show task creation feedback.

- Modify `src/views/crm/email-sequences/modules/EmailSequenceTable.vue`
  - keep selected-row entry.
  - show bulk task action only when selection is large enough or user chooses background mode.

- Create `src/views/crm/email-sequences/modules/BulkAiDraftTaskDrawer.vue`
  - progress summary.
  - item table.
  - retry failed button.
  - cancel button for active task.
  - mark read/close for finished task.

- Modify `src/views/crm/settings/modules/useCrmOperationsPanel.ts`
  - load recent bulk AI draft tasks.

- Modify `src/views/crm/settings/modules/CrmOperationsPanel.vue`
  - show recent AI draft task status and counts.

- Create `src/views/crm/settings/modules/AiDraftQueueConfigCard.vue`
  - super-admin-only config form.
  - default concurrency 3, maximum 5.

## Task Breakdown

### Task 1: Schema And Type Foundation

**Files:**

- Modify `prisma/schema.prisma`
- Create `prisma/migrations/20260620_create_crm_ai_draft_tasks/migration.sql`
- Modify generated Prisma files via `pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma`
- Create `apps/server/src/modules/crm/crm-ai-draft-task-state.ts`
- Create `apps/server/src/modules/crm/crm-ai-draft-task.types.ts`
- Modify `apps/server/src/modules/crm/crm.types.ts`

- [x] Add `CrmAiDraftTask`, `CrmAiDraftTaskItem`, and `CrmAiDraftQueueConfig`.
- [x] Add TS status unions: `queued`, `running`, `completed`, `failed`, `cancelled`.
- [x] Add item status unions: `pending`, `running`, `retrying`, `succeeded`, `skipped`, `failed`.
- [x] Add defaults: item concurrency `3`, hard max `5`, max attempts `3`.
- [x] Add `normalizeCrmAiDraftItemConcurrency(value, max)` and tests for invalid, below-min, above-max.
- [x] Run Prisma generate.
- [x] Run `pnpm --filter @soybean/server typecheck`.

### Task 2: Store And Service Task Creation

**Files:**

- Modify `apps/server/src/modules/crm/store/prisma-crm.store.ts`
- Modify `apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`
- Modify `apps/server/src/modules/crm/crm.service.ts`
- Modify `apps/server/src/modules/crm/crm.service.spec.ts`
- Create `apps/server/src/modules/crm/dto/create-crm-ai-draft-task.dto.ts`

- [x] Write store tests for task creation with item rows in one transaction.
- [x] Write service tests for owner-only selected enrollments.
- [x] Reject if current user already has active task.
- [x] Reject if organization exceeds active task cap.
- [x] Skip invalid selected enrollments as item-level skips only when they belong to the user but are not eligible.
- [x] Do not create/send Gmail jobs.
- [x] Record business log with counts only, not email body.

### Task 3: Queue And Worker

**Files:**

- Create `apps/server/src/modules/crm/crm-ai-draft-task-queue.service.ts`
- Create `apps/server/src/modules/crm/crm-ai-draft-task-worker-host.service.ts`
- Create `apps/server/src/modules/crm/crm-ai-draft-task-worker.service.ts`
- Create `apps/server/src/modules/crm/crm-ai-draft-task-worker.service.spec.ts`
- Modify `apps/server/src/modules/crm/crm.module.ts`

- [x] Enqueue task with job id `${taskId}:${runVersion}`.
- [x] Apply global worker concurrency from config.
- [x] Worker checks `taskId + runVersion + status`.
- [x] Worker marks task running with guard.
- [x] Worker processes items with `effectiveConcurrency`.
- [x] Worker calls `CrmAiDraftService` only after item-level eligibility check.
- [x] Successful item creates or updates a local draft using existing CRM draft creation paths.
- [x] Worker updates counters after each item.
- [x] Completed task creates notification and leaves `readAt=null`.

### Task 4: Retry, Backoff, Auto Slowdown, Cancel

**Files:**

- Modify `apps/server/src/modules/crm/crm-ai-draft-task-state.ts`
- Modify `apps/server/src/modules/crm/crm-ai-draft-task-worker.service.ts`
- Modify `apps/server/src/modules/crm/store/prisma-crm.store.ts`
- Modify `apps/server/src/modules/crm/crm.service.ts`
- Modify `apps/server/src/modules/crm/crm.controller.ts`
- Modify related specs.

- [x] Classify retryable provider/rate-limit/timeout/5xx errors.
- [x] Retry item up to `maxAttempts`.
- [x] Backoff by config seconds, default `[30, 60, 120]`.
- [x] When retryable failures are clustered, reduce `effectiveConcurrency` to `1` for the current task.
- [x] `retry-failed` bumps `runVersion`, resets failed retryable items to `pending`, and enqueues again.
- [x] `cancel` bumps `runVersion`, marks pending/running/retrying items skipped or cancelled, and removes queued BullMQ job when possible.
- [x] Old jobs must not change task/item status after cancel or retry.

### Task 5: Super Admin Config API

**Files:**

- Create `apps/server/src/modules/crm/dto/update-crm-ai-draft-queue-config.dto.ts`
- Modify `apps/server/src/modules/crm/crm.controller.ts`
- Modify `apps/server/src/modules/crm/crm.service.ts`
- Modify `apps/server/src/modules/crm/store/prisma-crm.store.ts`
- Modify `apps/server/src/modules/crm/crm.controller.spec.ts`
- Modify `apps/server/src/modules/crm/crm.service.spec.ts`

- [x] `GET /crm/ai-draft-queue-config` returns defaults when row does not exist.
- [x] `PATCH /crm/ai-draft-queue-config` requires `R_SUPER`.
- [x] Save normalized values.
- [x] Apply queue concurrency immediately through queue service/worker host.
- [x] Log config changes without secrets.

### Task 6: Frontend Bulk Task Entry And Drawer

**Files:**

- Modify `src/service/api/crm.ts`
- Modify `src/typings/api/crm.d.ts`
- Modify `src/views/crm/email-sequences/modules/useEmailSequenceTable.ts`
- Modify `src/views/crm/email-sequences/modules/EmailSequenceTable.vue`
- Create `src/views/crm/email-sequences/modules/BulkAiDraftTaskDrawer.vue`
- Modify `src/views/crm/email-sequences/modules/shared.ts`
- Modify `src/views/crm/email-sequences/modules/shared.spec.ts`

- [x] Add API calls for create/current/detail/retry/cancel/read.
- [x] Keep current synchronous batch action available.
- [x] Add background task action for selected rows.
- [x] Show progress counts: total, success, skipped, failed, retrying, running, pending.
- [x] Show item table with step, status, attempt count, subject, reason.
- [x] Add retry failed button when task has failed retryable items.
- [x] Add cancel button for queued/running tasks.
- [x] Prevent stale response overwrite using request id pattern.

### Task 7: Frontend Config And Operations Panel

**Files:**

- Create `src/views/crm/settings/modules/AiDraftQueueConfigCard.vue`
- Modify `src/views/crm/settings/modules/useCrmOperationsPanel.ts`
- Modify `src/views/crm/settings/modules/CrmOperationsPanel.vue`
- Modify `src/views/crm/settings/modules/shared.ts`
- Modify `src/views/crm/settings/modules/shared.spec.ts`

- [x] Super admin sees AI draft queue config.
- [x] Ordinary users do not see editable config.
- [x] Default display shows concurrency `3`, max `5`.
- [x] Recent operations panel includes AI draft task rows.
- [x] Row detail shows counts and failure summary, not email body.

### Task 8: Integration Verification And Commit

**Commands:**

```bash
pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-ai-draft-task-worker.service.spec.ts apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/crm.controller.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
pnpm --filter @soybean/server typecheck
pnpm exec tsx --test src/views/crm/email-sequences/modules/shared.spec.ts src/views/crm/settings/modules/shared.spec.ts
pnpm typecheck
pnpm exec oxlint
pnpm exec eslint --max-warnings=0 .
git diff --check
```

- [x] Confirm no `.env*`, lockfile, or unrelated generated files changed.
- [x] Confirm no Gmail real-send flow is touched.
- [x] Commit with `git commit --no-verify -m "feat: 支持 CRM 批量 AI 草稿任务"`.

## Multi-Agent Execution Order

1. Agent A works alone on Task 1 because Prisma schema and generated files are shared.
2. Agent B works on Task 2 after Task 1 lands.
3. Agent C works on Tasks 3-4 after Task 2 service/store methods are stable.
4. Agent D works on Task 5 after queue config store exists.
5. Agent E works on Task 6 after backend API shape is stable.
6. Agent F works on Task 7 in parallel with Agent E only after API types are agreed.
7. Main agent reviews all diffs, runs integration verification, and commits.

## Acceptance Criteria

- User can select many CRM sequence rows and start a background AI draft task.
- Default item concurrency is `3`.
- Super admin can configure up to `5`.
- A model that fails under high concurrency causes item retries and task-level slowdown instead of whole-task failure.
- Business skips are visible and not retried.
- Failed retryable items can be retried without rerunning the whole task.
- Progress is visible from email sequences and CRM operations.
- Generated results remain local drafts for human review.
- Gmail sending remains out of scope.
