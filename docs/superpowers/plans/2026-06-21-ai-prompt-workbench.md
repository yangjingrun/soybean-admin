# AI Prompt Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a modular prompt operations workbench where super admins can save drafts, validate prompts, run model tests, publish global versions, and roll back safely.

**Architecture:** Keep `AiPromptConfig` as the current published prompt read model used by existing AI calls. Add prompt version and test-run records for the workbench, while `AiGatewayService.generateText()` continues to resolve only the current published prompt through `getPrompt()`. The frontend becomes a thin route view composed from focused modules and a single page composable.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Node test runner, Vue 3 `<script setup lang="ts">`, Naive UI, existing request wrapper.

---

## File Structure

- Modify `prisma/schema.prisma`
  - Add `AiPromptVersion` and `AiPromptTestRun`.
  - Keep existing `AiPromptConfig` for current published prompt lookup.
- Create `prisma/migrations/20260621210000_create_ai_prompt_workbench/migration.sql`
  - Create the two new tables and indexes.
- Modify `apps/server/src/modules/ai-gateway/ai-gateway.types.ts`
  - Add step summary, detail, version, validation, test-run, and store contracts.
- Modify `apps/server/src/modules/ai-gateway/ai-gateway.constants.ts`
  - Add channel metadata and validation policy per prompt step.
- Create `apps/server/src/modules/ai-gateway/ai-prompt-validator.ts`
  - Pure validation helpers for prompt text and AI JSON output.
- Modify `apps/server/src/modules/ai-gateway/prisma-ai-prompt.store.ts`
  - Keep existing `getPrompt()` / `savePrompt()` behavior.
  - Add draft/version/test-run persistence methods.
- Modify `apps/server/src/modules/ai-gateway/ai-gateway.service.ts`
  - Add list/detail/draft/validate/test/publish/rollback orchestration.
  - Log save/test/publish/rollback without storing full prompt text in logs.
- Modify `apps/server/src/modules/ai-gateway/ai-gateway.controller.ts`
  - Add workbench endpoints under `/ai-gateway/prompt-workbench`.
- Add/modify backend tests:
  - `apps/server/src/modules/ai-gateway/ai-prompt-validator.spec.ts`
  - `apps/server/src/modules/ai-gateway/prisma-ai-prompt.store.spec.ts`
  - `apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts`
  - `apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts`
- Modify `src/typings/api/ai-gateway.d.ts`
  - Add frontend API contracts matching backend responses.
- Modify `src/service/api/ai-gateway.ts`
  - Add workbench request functions.
- Create `src/views/ai-prompt-settings/modules/shared.ts`
  - Pure frontend helpers for status labels, checklist summaries, prompt section anchors.
- Add `src/views/ai-prompt-settings/modules/shared.spec.ts`
  - Test frontend helper behavior.
- Create `src/views/ai-prompt-settings/modules/usePromptSettingsPage.ts`
  - Page state, loading flags, dirty state, validation/test/publish/rollback actions.
- Create focused Vue components:
  - `PromptStepList.vue`
  - `PromptEditor.vue`
  - `PromptPublishPanel.vue`
  - `PromptVersionTimeline.vue`
- Modify `src/views/ai-prompt-settings/index.vue`
  - Keep route view thin and compose modules.

## Component Map

- `index.vue`
  - Route composition surface only; owns permission check and wires the page composable to child components.
- `usePromptSettingsPage.ts`
  - Owns selected step, draft content, validation/test/version state, and backend actions.
- `PromptStepList.vue`
  - Displays built-in steps and emits `select`.
- `PromptEditor.vue`
  - Displays tabbed editor and section anchors; emits prompt content changes.
- `PromptPublishPanel.vue`
  - Displays validation checklist, test input/result, and action buttons.
- `PromptVersionTimeline.vue`
  - Displays historical versions and emits `rollback`.

## Tasks

### Task 1: Backend Contracts And Pure Validation

**Files:**
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.types.ts`
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.constants.ts`
- Create: `apps/server/src/modules/ai-gateway/ai-prompt-validator.ts`
- Test: `apps/server/src/modules/ai-gateway/ai-prompt-validator.spec.ts`

- [x] Step 1: Write failing tests for Maps output validation.
- [x] Step 2: Run `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-gateway/ai-prompt-validator.spec.ts` and confirm validation helpers are missing.
- [x] Step 3: Implement prompt validation records and pure helper functions.
- [x] Step 4: Re-run the validator spec and confirm it passes.

### Task 2: Database Store And Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260621210000_create_ai_prompt_workbench/migration.sql`
- Modify: `apps/server/src/modules/ai-gateway/prisma-ai-prompt.store.ts`
- Test: `apps/server/src/modules/ai-gateway/prisma-ai-prompt.store.spec.ts`

- [x] Step 1: Write failing store tests for saving a draft, publishing a version, listing versions, and recording a test run.
- [x] Step 2: Add Prisma schema and SQL migration for `AiPromptVersion` and `AiPromptTestRun`.
- [x] Step 3: Run Prisma generate with `pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma`.
- [x] Step 4: Implement store methods with focused Prisma calls.
- [x] Step 5: Run the store spec.

### Task 3: Service And Controller Workbench API

**Files:**
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.service.ts`
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.controller.ts`
- Modify/Create DTOs under `apps/server/src/modules/ai-gateway/dto`
- Test: `apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts`
- Test: `apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts`

- [x] Step 1: Write failing service tests for list/detail/save draft/validate/test/publish/rollback.
- [x] Step 2: Write failing controller tests for permission-protected endpoints.
- [x] Step 3: Implement service orchestration and logs.
- [x] Step 4: Implement controller endpoints under `/ai-gateway/prompt-workbench`.
- [x] Step 5: Run focused service/controller specs.

### Task 4: Frontend API Contracts And Pure Helpers

**Files:**
- Modify: `src/typings/api/ai-gateway.d.ts`
- Modify: `src/service/api/ai-gateway.ts`
- Create: `src/views/ai-prompt-settings/modules/shared.ts`
- Test: `src/views/ai-prompt-settings/modules/shared.spec.ts`

- [x] Step 1: Write failing frontend helper tests for step status labels, checklist summary, and editor anchors.
- [x] Step 2: Add API types and request functions.
- [x] Step 3: Implement pure helpers.
- [x] Step 4: Run `pnpm exec tsx --test src/views/ai-prompt-settings/modules/shared.spec.ts`.

### Task 5: Frontend Workbench UI

**Files:**
- Create: `src/views/ai-prompt-settings/modules/usePromptSettingsPage.ts`
- Create: `src/views/ai-prompt-settings/modules/PromptStepList.vue`
- Create: `src/views/ai-prompt-settings/modules/PromptEditor.vue`
- Create: `src/views/ai-prompt-settings/modules/PromptPublishPanel.vue`
- Create: `src/views/ai-prompt-settings/modules/PromptVersionTimeline.vue`
- Modify: `src/views/ai-prompt-settings/index.vue`

- [x] Step 1: Implement `usePromptSettingsPage.ts` around the new API.
- [x] Step 2: Build the step list component with selected, draft, test, and published states.
- [x] Step 3: Build the editor component with tabs and prompt section anchors.
- [x] Step 4: Build the publish panel and version timeline.
- [x] Step 5: Replace the existing route view with the composed three-column workbench.

### Task 6: Verification And Commit

**Files:**
- All files touched in Tasks 1-5.

- [x] Step 1: Run backend validator/store/service/controller specs.
- [x] Step 2: Run frontend helper spec.
- [x] Step 3: Run `pnpm --filter @soybean/server typecheck` if Prisma or backend types changed.
- [x] Step 4: Run `pnpm typecheck` if frontend types changed and time allows.
- [x] Step 5: Run `git status --short` and inspect staged diff only for this feature.
- [x] Step 6: Commit with a short Chinese message.

## Self-Review

- Spec coverage: the plan covers versioning, draft save, validation, model testing, publish, rollback, frontend workbench, permission, logs, and existing business prompt resolution.
- Placeholder scan: no `TBD` or intentionally vague implementation task remains.
- Type consistency: backend and frontend use the existing `AiGateway` namespace and `promptKey` vocabulary; `AiPromptConfig` remains the current published read model.
