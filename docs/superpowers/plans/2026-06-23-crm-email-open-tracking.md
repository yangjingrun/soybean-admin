# CRM Email Open Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CRM email open tracking with first-open system notifications and focused navigation from the notification.

**Architecture:** Add a focused CRM tracking service/controller/repository, sign message ids into public open-tracking tokens, embed a tracking pixel in HTML email, and reuse the existing system notification polling layer. Frontend changes stay inside the email sequence composable.

**Tech Stack:** NestJS, Prisma migrations, PostgreSQL, Naive UI/Vue 3 Composition API, Pinia polling notification store.

---

### Task 1: Tracking Token And Service Tests

**Files:**

- Create: `apps/server/src/modules/crm/tracking/crm-tracking-token.service.spec.ts`
- Create: `apps/server/src/modules/crm/tracking/crm-tracking.service.spec.ts`
- Create: `apps/server/src/modules/crm/tracking/crm-tracking.types.ts`

- [ ] Write failing tests for token signing/verification and first-open notification behavior.
- [ ] Run the focused specs and confirm they fail because services do not exist.

### Task 2: Backend Tracking Implementation

**Files:**

- Create: `apps/server/src/modules/crm/tracking/crm-tracking-token.service.ts`
- Create: `apps/server/src/modules/crm/tracking/crm-tracking.service.ts`
- Create: `apps/server/src/modules/crm/tracking/crm-tracking.controller.ts`
- Create: `apps/server/src/modules/crm/tracking/crm-tracking.repository.ts`
- Create: `apps/server/src/modules/crm/store/prisma-crm-tracking.store.ts`
- Modify: `apps/server/src/modules/crm/crm.tokens.ts`
- Modify: `apps/server/src/modules/crm/module/crm-controller.providers.ts`
- Modify: `apps/server/src/modules/crm/module/crm-domain.providers.ts`
- Modify: `apps/server/src/modules/crm/module/crm-repository.providers.ts`

- [ ] Implement token service using HMAC SHA-256 and `CRM_TRACKING_TOKEN_SECRET`.
- [ ] Implement tracking service with first-open notification and timeline event creation.
- [ ] Implement unauthenticated open endpoint returning a transparent gif.
- [ ] Implement Prisma-backed repository with raw SQL for the new tracking table.

### Task 3: Database Schema

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260623093000_create_crm_email_open_events/migration.sql`

- [ ] Add `CrmEmailOpenEvent` schema and migration.
- [ ] Do not regenerate Prisma client in this task, because the repository uses raw SQL and generated files are already dirty in the worktree.

### Task 4: Email Pixel Injection

**Files:**

- Modify: `apps/server/src/modules/app-config/app-config.loader.ts`
- Modify: `apps/server/src/modules/crm/crm.types.ts`
- Modify: `apps/server/src/modules/crm/crm-email-send.gateway.ts`
- Modify: `apps/server/src/modules/crm/crm-send-worker.service.ts`
- Test: `apps/server/src/modules/crm/crm-email-send.gateway.spec.ts`
- Test: `apps/server/src/modules/crm/crm-send-worker.service.spec.ts`

- [ ] Add `CRM_TRACKING_PUBLIC_BASE_URL` and `CRM_TRACKING_TOKEN_SECRET` to app config.
- [ ] Extend the send gateway input with optional tracking context.
- [ ] Generate a tracking pixel URL in the send worker when tracking config is present.
- [ ] Send multipart email with plain text and HTML pixel when tracking exists.

### Task 5: Frontend Focused Navigation

**Files:**

- Modify: `src/views/crm/email-sequences/modules/useEmailSequenceTable.ts`
- Test: `src/views/crm/email-sequences/modules/shared.spec.ts` or a new focused spec if needed.

- [ ] Read `focus=tracking-open`, `enrollmentId`, `messageId`, and `eventId` from route query.
- [ ] Load the focused sequence detail and select the target message after page data is ready.
- [ ] Clear or ignore stale focus parameters after successful handling to avoid repeated modal opens.

### Task 6: Verification

**Files:**

- Run focused backend tests.
- Run focused frontend tests or `pnpm typecheck` if route-focus logic touches only typed composition code.

- [ ] Run focused specs for token, tracking service, send gateway and send worker.
- [ ] Run a minimal typecheck if implementation touches shared types.
- [ ] Review `git diff` and stage only this feature.
