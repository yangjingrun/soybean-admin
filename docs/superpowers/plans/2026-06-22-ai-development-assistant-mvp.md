# AI Development Assistant MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-stage AI development assistant page that lets ordinary users see customer queues, understand daily follow-up capacity, and act on recommended customers without exposing AI search task internals.

**Architecture:** Add a new Vue route at `src/views/ai-assistant`. The page is a thin composition surface backed by a feature composable that reads existing CRM accounts, account detail, send preference, and sequence APIs. No backend schema change is included in this slice; the later backend quota gate remains a separate implementation phase.

**Tech Stack:** Vue 3, `<script setup lang="ts">`, Naive UI, existing CRM API wrappers, elegant-router route generation.

---

### Scope

- [ ] Add a visible `AI 开发助手` menu entry.
- [ ] Show current target/capacity as a simple workbench header.
- [ ] Group CRM accounts into business queues: `今日推荐`, `跟进中`, `有回复`, `待补全`, `已暂停`, `已归档`.
- [ ] Let users open a details drawer with customer data, recommendation reason, next action, and timeline.
- [ ] Let users start follow-up for customers with contacts by creating an existing CRM sequence review item.
- [ ] Let users mark customers as temporarily not developed through existing CRM archive API.
- [ ] Let users refresh enrichment, verify contact email, restore archived customers, and jump to existing CRM pages when needed.

### Files

- Create: `src/views/ai-assistant/index.vue`
- Create: `src/views/ai-assistant/modules/TargetProfileCard.vue`
- Create: `src/views/ai-assistant/modules/CustomerQueueTabs.vue`
- Create: `src/views/ai-assistant/modules/CustomerDetailDrawer.vue`
- Create: `src/views/ai-assistant/modules/useAiAssistantPage.ts`
- Create: `src/views/ai-assistant/modules/shared.ts`
- Create: `src/views/ai-assistant/modules/shared.spec.ts`
- Modify: `build/plugins/router.ts`
- Modify: `src/locales/langs/zh-cn.ts`
- Modify: `src/locales/langs/en-us.ts`
- Regenerate: `src/router/elegant/routes.ts`, `src/router/elegant/imports.ts`, `src/router/elegant/transform.ts`, `src/typings/elegant-router.d.ts`

### Component Map

- `index.vue`: route-level composition only; wires composable state/actions into child components.
- `TargetProfileCard.vue`: displays the simplified acquisition target, daily limit, used count, remaining count, and operational status.
- `CustomerQueueTabs.vue`: displays the queue tabs and customer cards; emits user actions.
- `CustomerDetailDrawer.vue`: displays selected customer details, contacts, recommendation reason, next action, and timeline.
- `useAiAssistantPage.ts`: owns requests, queue derivation, selected detail loading, and action handlers.
- `shared.ts`: pure queue/status helpers with tests.

### Execution Tasks

- [ ] **Task 1: Pure queue model**
  - Implement status-to-queue mapping, next-action copy, queue stats, and recommendation reason helpers in `shared.ts`.
  - Add `shared.spec.ts` tests for `ready`, `sequence_running`, `replied_pending`, `missing_contact`, `paused`, and `archived`.
  - Verify with `pnpm exec tsx --test src/views/ai-assistant/modules/shared.spec.ts`.

- [ ] **Task 2: Data composable**
  - Implement `useAiAssistantPage.ts`.
  - Use `fetchCrmAccounts`, `fetchCrmSendPreference`, `fetchCrmAccountDetail`, `archiveCrmAccount`, `restoreCrmAccount`, `refreshCrmAccountEnrichment`, `verifyCrmContactEmail`, and `createCrmSequenceReviewItem`.
  - Guard stale list/detail responses with request ids.
  - Route successful follow-up creation to `/crm/email-sequences`.

- [ ] **Task 3: Page UI**
  - Add `TargetProfileCard.vue`, `CustomerQueueTabs.vue`, `CustomerDetailDrawer.vue`, and `index.vue`.
  - Keep the UI as one workbench with queues, not a copy of CRM/AI task pages.
  - Keep actions limited to: start follow-up, pause, restore, refresh enrichment, verify email, view details.

- [ ] **Task 4: Routing and locale**
  - Add route meta for `ai-assistant` with a high menu priority.
  - Add Chinese and English route labels.
  - Run `pnpm gen-route` and review generated diffs.

- [ ] **Task 5: Verification**
  - Run the focused helper test.
  - Run `pnpm typecheck` if the generated route/type changes are clean enough in the current dirty worktree.
  - Do not run `npm run build`.

### Deferred Backend Work

- Add a real `AiDevelopmentAssistantService` backend facade.
- Persist assistant target profiles.
- Enforce daily development quota server-side before sequence creation.
- Add automatic daily discovery and scheduling.
- Move old AI search task details behind admin-only advanced pages.
