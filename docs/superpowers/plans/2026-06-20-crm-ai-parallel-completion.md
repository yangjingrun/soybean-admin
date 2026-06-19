# CRM AI Completion Parallel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining CRM AI writing capabilities beyond the already-implemented product-line AI draft generation, while keeping Gmail real sending/sync out of scope unless the user explicitly asks to go online.

**Architecture:** Split work into three waves. Wave 1 finishes the immediately usable AI draft workflow without schema-heavy changes. Wave 2 adds historical/versioned prompt and customer-reply drafting. Wave 3 adds high-volume queueing for thousands of AI draft jobs. Agents must use disjoint write scopes inside each wave; schema-changing tasks run sequentially because Prisma migrations and generated clients are shared state.

**Tech Stack:** NestJS, Prisma/PostgreSQL, existing CRM module and `AiGatewayService`, Vue 3 `<script setup>`, Naive UI, TypeScript, Node test runner, `vue-tsc`, oxlint, eslint.

---

## Parallel Execution Rules

- Do not run all ten feature items as ten agents at once. Several share the same files and would create conflicts.
- Run one wave at a time. Inside a wave, dispatch only agents with disjoint file ownership.
- Schema/migration tasks must be single-owner and merged before any frontend or service task depends on the new shape.
- Every agent must read `docs/agent-memory.md` first and must not touch Gmail real-send, `.env*`, lock files, or unrelated generated files.
- Each agent must return changed paths, tests run, and any skipped checks.
- The main agent reviews diffs after each wave, runs integration checks, then commits.

## Wave 1: Make Existing AI Draft Workflow Usable

### Agent 1: Backend AI Preview And Regenerate

**Covers:** Item 1 AI 试写/调试台 backend, Item 2 AI 重新生成当前草稿 backend.

**Write scope:**
- `apps/server/src/modules/crm/crm.controller.ts`
- `apps/server/src/modules/crm/crm.service.ts`
- `apps/server/src/modules/crm/crm.types.ts`
- `apps/server/src/modules/crm/dto/*crm-ai-draft*.dto.ts`
- `apps/server/src/modules/crm/crm.service.spec.ts`
- `apps/server/src/modules/crm/crm.controller.spec.ts`

**Requirements:**
- [x] Add a preview endpoint that takes account/contact/productLine/stepIndex and returns an AI draft preview without creating `CrmMessage`.
- [x] Add a regenerate endpoint for a current `draft_pending_review` message. It must owner-only regenerate subject/body, keep the message pending review, write a draft version snapshot, and update AI metadata.
- [x] Reuse `CrmAiDraftService`; do not create a second model SDK.
- [x] Do not call Gmail or enqueue send jobs.

**Verification:**
- [x] `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/crm.controller.spec.ts apps/server/src/modules/crm/crm-ai-draft.service.spec.ts`
- [x] `pnpm --filter @soybean/server typecheck`

### Agent 2: Product-Line And Create-Sequence Frontend UX

**Covers:** Item 5 产品线 AI 配置前端权限隐藏, Item 6 创建首封草稿 AI 提示.

**Write scope:**
- `src/views/crm/settings/modules/ProductLineFormModal.vue`
- `src/views/crm/settings/modules/shared.ts`
- `src/views/crm/settings/modules/shared.spec.ts`
- `src/views/crm/email-sequences/modules/SequenceCreateModal.vue`
- `src/views/crm/email-sequences/modules/shared.ts`
- `src/views/crm/email-sequences/modules/shared.spec.ts`
- `src/typings/api/crm.d.ts`

**Requirements:**
- [x] Make ordinary members see AI writing config as read-only or hidden according to existing CRM permission fields.
- [x] In the create-sequence modal, show whether the selected product line has AI writing enabled, disabled, or incomplete.
- [x] Keep submit behavior unchanged: backend remains the source of truth for permission and config errors.
- [x] Use Naive UI components only; no new UI library.

**Verification:**
- [x] `pnpm exec tsx --test src/views/crm/settings/modules/shared.spec.ts src/views/crm/email-sequences/modules/shared.spec.ts`
- [x] `pnpm typecheck`
- [x] `pnpm exec oxlint`

### Agent 3: Review Drawer Prompt Snapshot And Quality View

**Covers:** Item 4 完整提示词快照展示, Item 7 AI 内容质量检查 frontend display.

**Write scope:**
- `src/views/crm/email-sequences/modules/DraftReviewDrawer.vue`
- `src/views/crm/email-sequences/modules/shared.ts`
- `src/views/crm/email-sequences/modules/shared.spec.ts`
- `src/typings/api/crm.d.ts`

**Requirements:**
- [x] Add a compact AI metadata section in the review drawer.
- [x] Show reason, risk notes, product line name, step index, generated time.
- [x] Add a collapsed prompt snapshot area for common requirements, forbidden claims, product emphasis, and the step prompt used.
- [x] If backend adds quality warnings later, render them as tags without changing drawer layout again.

**Verification:**
- [x] `pnpm exec tsx --test src/views/crm/email-sequences/modules/shared.spec.ts`
- [x] `pnpm typecheck`
- [x] `pnpm exec eslint --max-warnings=0 .`

### Agent 4: Batch AI Generate Frontend Experience

**Covers:** Item 3 批量 AI 生成草稿的前端体验.

**Write scope:**
- `src/views/crm/email-sequences/index.vue`
- `src/views/crm/email-sequences/modules/EmailSequenceTable.vue`
- `src/views/crm/email-sequences/modules/useEmailSequenceTable.ts`
- `src/views/crm/email-sequences/modules/shared.ts`
- `src/views/crm/email-sequences/modules/shared.spec.ts`

**Requirements:**
- [x] Improve multi-select batch generate next draft UX.
- [x] Show per-row result after batch generation: success, skipped, failed, and reason.
- [x] Preserve owner-only behavior and existing batch API contract.
- [x] Do not create a separate background queue in this wave.

**Verification:**
- [x] `pnpm exec tsx --test src/views/crm/email-sequences/modules/shared.spec.ts`
- [x] `pnpm typecheck`
- [x] `pnpm exec oxlint`

### Wave 1 Integration

- [x] Review all four agent diffs for overlapping edits.
- [x] Run backend focused tests from Agent 1.
- [x] Run frontend focused tests from Agents 2-4.
- [x] Run `pnpm --filter @soybean/server typecheck`
- [x] Run `pnpm typecheck`
- [x] Run `pnpm exec oxlint`
- [x] Run `pnpm exec eslint --max-warnings=0 .`
- [x] Run `git diff --check`
- [ ] Commit with `git commit --no-verify -m "feat: 完善 CRM AI 草稿审核体验"`

## Wave 2: Add History And Reply Drafting

### Agent 5: Prompt Versioning Backend

**Covers:** Item 8 提示词版本管理 backend.

**Write scope:**
- `prisma/schema.prisma`
- `prisma/migrations/*crm_ai_prompt_versions*/migration.sql`
- `apps/server/src/generated/prisma/**`
- `apps/server/src/modules/crm/crm.types.ts`
- `apps/server/src/modules/crm/store/prisma-crm.store.ts`
- `apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`
- `apps/server/src/modules/crm/crm.service.ts`
- `apps/server/src/modules/crm/crm.service.spec.ts`

**Requirements:**
- [ ] Add a product-line AI prompt version table or version records.
- [ ] Create a new version whenever AI writing config changes meaningfully.
- [ ] Keep current `CrmMessage.metadata.aiDraft.snapshot` as immutable per-draft audit history.
- [ ] Add APIs/service methods to list versions and restore a version to current product-line config.

**Verification:**
- [ ] `pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma`
- [ ] `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/store/prisma-crm.store.spec.ts apps/server/src/modules/crm/crm.service.spec.ts`
- [ ] `pnpm --filter @soybean/server typecheck`

### Agent 6: Prompt Versioning Frontend

**Starts after Agent 5 merges.**

**Write scope:**
- `src/service/api/crm.ts`
- `src/typings/api/crm.d.ts`
- `src/views/crm/settings/modules/ProductLineFormModal.vue`
- `src/views/crm/settings/modules/shared.ts`
- `src/views/crm/settings/modules/shared.spec.ts`

**Requirements:**
- [ ] Show product-line prompt version history.
- [ ] Allow comparing current config with a selected historical version.
- [ ] Allow organization admin to restore a previous version.
- [ ] Keep ordinary members read-only.

**Verification:**
- [ ] `pnpm exec tsx --test src/views/crm/settings/modules/shared.spec.ts`
- [ ] `pnpm typecheck`
- [ ] `pnpm exec eslint --max-warnings=0 .`

### Agent 7: Customer Reply AI Draft Backend

**Covers:** Item 9 客户回信后的 AI 回复草稿 backend.

**Write scope:**
- `apps/server/src/modules/crm/crm-ai-reply-draft.types.ts`
- `apps/server/src/modules/crm/crm-ai-reply-draft-prompt.ts`
- `apps/server/src/modules/crm/crm-ai-reply-draft.service.ts`
- `apps/server/src/modules/crm/crm.service.ts`
- `apps/server/src/modules/crm/crm.controller.ts`
- `apps/server/src/modules/crm/crm.service.spec.ts`
- `apps/server/src/modules/crm/crm.controller.spec.ts`

**Requirements:**
- [ ] Add AI draft generation for an inbound customer reply thread.
- [ ] Use inbound message body, previous outbound messages, product line, contact, account, and configured forbidden claims.
- [ ] Save reply draft locally for human review; do not send Gmail.
- [ ] Mark generated reply draft metadata with reason/risk notes.

**Verification:**
- [ ] `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/crm.controller.spec.ts`
- [ ] `pnpm --filter @soybean/server typecheck`

### Agent 8: Customer Reply AI Draft Frontend

**Starts after Agent 7 merges.**

**Write scope:**
- `src/service/api/crm.ts`
- `src/typings/api/crm.d.ts`
- `src/views/crm/inbox/**`

**Requirements:**
- [ ] Add “AI 起草回复” action in inbox detail for owner-operable threads.
- [ ] Show generated reply draft in an editable review area.
- [ ] Allow save/replace draft locally; sending remains manual/out of scope unless existing inbox reply send flow is explicitly used by the user.

**Verification:**
- [ ] `pnpm typecheck`
- [ ] `pnpm exec oxlint`
- [ ] Run any existing inbox shared tests if present.

### Wave 2 Integration

- [ ] Run Prisma generate once after schema tasks.
- [ ] Run CRM backend service/controller/store tests.
- [ ] Run settings and inbox frontend type/lint checks.
- [ ] Run `git diff --check`.
- [ ] Commit with `git commit --no-verify -m "feat: 补齐 CRM AI 提示词历史和回信草稿"`

## Wave 3: High-Volume AI Queue

### Agent 9: Bulk AI Queue Backend

**Covers:** Item 10 大批量 AI 队列 backend.

**Write scope:**
- `prisma/schema.prisma`
- `prisma/migrations/*crm_ai_draft_tasks*/migration.sql`
- `apps/server/src/generated/prisma/**`
- `apps/server/src/modules/crm/crm-ai-draft-task*.ts`
- `apps/server/src/modules/crm/crm.module.ts`
- `apps/server/src/modules/crm/crm.service.ts`
- `apps/server/src/modules/crm/crm.controller.ts`
- `apps/server/src/modules/crm/*spec.ts`

**Requirements:**
- [ ] Add task table for high-volume AI draft generation.
- [ ] Add BullMQ worker or existing queue integration with runVersion/status guards.
- [ ] Track per-item success/skipped/failed and model-call error reason.
- [ ] Add concurrency and rate limits; no Gmail send jobs.
- [ ] Record business logs without full email body or secrets.

**Verification:**
- [ ] `pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma`
- [ ] `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-ai-draft-task*.spec.ts apps/server/src/modules/crm/crm.service.spec.ts`
- [ ] `pnpm --filter @soybean/server typecheck`

### Agent 10: Bulk AI Queue Frontend

**Starts after Agent 9 API shape is stable.**

**Write scope:**
- `src/service/api/crm.ts`
- `src/typings/api/crm.d.ts`
- `src/views/crm/email-sequences/**`
- `src/views/crm/settings/modules/useCrmOperationsPanel.ts`

**Requirements:**
- [ ] Add bulk task creation entry from selected sequence rows.
- [ ] Add progress/result display with success/skipped/failed counts.
- [ ] Add operations-panel visibility for recent bulk AI tasks.
- [ ] Keep the existing synchronous batch path for small selections.

**Verification:**
- [ ] `pnpm typecheck`
- [ ] `pnpm exec oxlint`
- [ ] `pnpm exec eslint --max-warnings=0 .`

### Wave 3 Integration

- [ ] Run backend bulk-task and CRM regression tests.
- [ ] Run frontend type/lint checks.
- [ ] Run `git diff --check`.
- [ ] Commit with `git commit --no-verify -m "feat: 支持 CRM 批量 AI 草稿任务"`

## Recommended Agent Dispatch Order

1. Start Wave 1 agents 1-4 in parallel.
2. Main agent reviews and integrates Wave 1, then commits.
3. Start Agent 5 alone because it owns Prisma schema/generated files.
4. Start Agents 6 and 7 in parallel after Agent 5 lands, because they work in different frontend/backend areas.
5. Start Agent 8 after Agent 7 lands.
6. Integrate and commit Wave 2.
7. Start Agent 9 alone because it owns Prisma schema/generated and queue infrastructure.
8. Start Agent 10 after Agent 9 API shape is stable.
9. Final full verification and commit Wave 3.

## Scope Not Included

- Real Gmail OAuth/send/watch/history setup.
- Production Gmail credential or Pub/Sub environment work.
- Editing `.env*`.
- Sending any AI-generated email without human review.
- Website crawling, PDF parsing, or attachment generation.
