# AI Leads Progress Stream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time, business-language progress stream for AI leads search collection, and replace the ordinary user result JSON with a progress/result panel that hides search technology details.

**Architecture:** Add a backend progress reporter protocol inside the existing AI leads module. The orchestrator emits dynamic business events while preserving the current non-stream search API. The frontend uses `fetch` + NDJSON parsing, reduces events into UI state, and renders a focused Naive UI progress/result panel.

**Tech Stack:** NestJS 11 + Fastify adapter, Vue 3.5 `<script setup lang="ts">`, Naive UI, native `fetch` streams, `node:test` + `tsx`.

---

## Component Map

- `apps/server/src/modules/ai-leads/ai-lead-search-progress.ts`: backend progress event types, event factory, public result projector, and NDJSON serializer.
- `apps/server/src/modules/ai-leads/ai-lead-search-orchestrator.service.ts`: emits progress through an optional reporter and returns the same internal result for compatibility.
- `apps/server/src/modules/ai-leads/ai-leads.service.ts`: exposes stream orchestration by passing a reporter to the orchestrator.
- `apps/server/src/modules/ai-leads/ai-leads.controller.ts`: adds `POST /ai-leads/search-orchestrate/stream`, writes NDJSON to Fastify `reply.raw`.
- `apps/server/src/modules/ai-leads/ai-lead-search-orchestrator.service.spec.ts`: verifies dynamic business events and public result projection.
- `apps/server/src/modules/ai-leads/ai-lead-search-progress.spec.ts`: verifies event serialization and no user-facing technical labels.
- `src/typings/api/ai-leads.d.ts`: adds stream event/public result types and removes ordinary user reliance on technical result fields.
- `src/service/api/ai-leads.shared.ts`: adds the stream URL constant/config helper.
- `src/service/api/ai-leads.stream.ts`: implements `fetch` stream reading, authorization header, `AbortSignal`, and chunk parser.
- `src/service/api/ai-leads.stream.spec.ts`: verifies NDJSON chunk parsing and stream helper behavior where pure.
- `src/service/api/ai-leads.ts`: exports `streamLeadCustomerSearch`.
- `src/views/ai-leads/modules/search-progress.ts`: pure reducer that turns progress events into view state.
- `src/views/ai-leads/modules/search-progress.spec.ts`: verifies dynamic step insertion, metrics, completion, and failure state.
- `src/views/ai-leads/modules/SearchProgressPanel.vue`: presentational progress/result panel with Naive UI components.
- `src/views/ai-leads/index.vue`: swaps the search button action to the stream API, keeps the route view as orchestration surface.

## Component Boundary Notes

- `SearchProgressPanel.vue` owns only display. It receives `state`, `loading`, and optional warnings through props.
- `search-progress.ts` owns state reduction and label formatting. It has no Vue dependency so it can be tested with `node:test`.
- `ai-leads.stream.ts` owns network streaming and parsing. Page code does not parse byte chunks directly.
- Backend public progress/result types live in the AI leads module because they are not yet shared across backend and frontend packages.

## Task 1: Backend Progress Protocol

**Files:**
- Create: `apps/server/src/modules/ai-leads/ai-lead-search-progress.ts`
- Create: `apps/server/src/modules/ai-leads/ai-lead-search-progress.spec.ts`

- [ ] **Step 1: Write failing tests for public event creation and serialization**

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createLeadSearchProgressEmitter,
  serializeLeadSearchProgressEvent,
  toLeadSearchPublicResult
} from './ai-lead-search-progress';

describe('ai lead search progress helpers', () => {
  it('creates sequenced business progress events', () => {
    const emitted: unknown[] = [];
    const emitter = createLeadSearchProgressEmitter('run-1', event => emitted.push(event));

    emitter.emit({
      type: 'step_progress',
      stepKey: 'collect_public_leads',
      title: '采集公开线索',
      description: '正在采集第 2 组公开线索',
      metrics: [{ key: 'actionCount', label: '采集动作', value: 2, total: 20 }]
    });

    assert.deepEqual(emitted, [
      {
        type: 'step_progress',
        runId: 'run-1',
        sequence: 1,
        emittedAt: assert.match(/^20/),
        stepKey: 'collect_public_leads',
        title: '采集公开线索',
        description: '正在采集第 2 组公开线索',
        metrics: [{ key: 'actionCount', label: '采集动作', value: 2, total: 20 }]
      }
    ]);
  });

  it('serializes one event per NDJSON line', () => {
    const line = serializeLeadSearchProgressEvent({
      type: 'workflow_started',
      runId: 'run-1',
      sequence: 1,
      emittedAt: '2026-06-18T00:00:00.000Z',
      title: '开始搜索采集'
    });

    assert.equal(line.endsWith('\n'), true);
    assert.equal(JSON.parse(line).title, '开始搜索采集');
  });

  it('projects internal search output into ordinary-user-safe result', () => {
    const result = toLeadSearchPublicResult({
      qualityWarnings: ['本地语言查询不足'],
      serperRequests: [{ endpoint: 'search' }],
      decisions: [{ decision: { nextAction: 'stop' } }],
      candidates: [
        {
          sourceType: 'organic',
          title: 'Bearing House',
          url: 'https://bearing.example.com',
          snippet: 'bearing distributor'
        }
      ],
      stopReason: '已达到目标线索数量'
    });

    assert.equal(result.summary.actionCount, 1);
    assert.equal(result.summary.qualityCheckCount, 1);
    assert.equal(result.summary.candidateCount, 1);
    assert.equal(result.candidates[0].sourceLabel, '公开线索');
    assert.equal(JSON.stringify(result).includes('serper'), false);
    assert.equal(JSON.stringify(result).includes('endpoint'), false);
  });
});
```

Run: `TSX_TSCONFIG_PATH=apps/server/tsconfig.json pnpm exec tsx --test apps/server/src/modules/ai-leads/ai-lead-search-progress.spec.ts`

Expected: FAIL because `ai-lead-search-progress.ts` does not exist.

- [ ] **Step 2: Implement the progress helper**

Create `apps/server/src/modules/ai-leads/ai-lead-search-progress.ts` with exported event types, `createLeadSearchProgressEmitter`, `serializeLeadSearchProgressEvent`, and `toLeadSearchPublicResult`. Keep public labels business-only: `公开线索`, `本地商家线索`, `候选线索`, `质量判断`.

- [ ] **Step 3: Run the backend progress helper tests**

Run: `TSX_TSCONFIG_PATH=apps/server/tsconfig.json pnpm exec tsx --test apps/server/src/modules/ai-leads/ai-lead-search-progress.spec.ts`

Expected: PASS.

## Task 2: Orchestrator Progress Emission

**Files:**
- Modify: `apps/server/src/modules/ai-leads/ai-lead-search-orchestrator.service.ts`
- Modify: `apps/server/src/modules/ai-leads/ai-lead-search-orchestrator.service.spec.ts`

- [ ] **Step 1: Write failing orchestrator reporter tests**

Add tests that pass a reporter to `service.search(dto, context, reporter)` and assert:

- `workflow_started` is first.
- `collect_public_leads` progress events include business metrics.
- `workflow_completed` contains a `result` without `serperRequests` or `decisions`.
- emitted event JSON never contains `Serper`, `search`, `places`, `endpoint`, or raw query text in user-facing fields.

Run: `TSX_TSCONFIG_PATH=apps/server/tsconfig.json pnpm exec tsx --test apps/server/src/modules/ai-leads/ai-lead-search-orchestrator.service.spec.ts`

Expected: FAIL because `search` does not accept a reporter yet.

- [ ] **Step 2: Add optional reporter support**

Change the orchestrator signature to:

```ts
async search(
  dto: SearchOrchestrateDto,
  context: AiLeadSearchContext = {},
  reporter?: LeadSearchProgressReporter
)
```

Emit events at these boundaries:

- `workflow_started` before reading config.
- `step_started` / `step_completed` for `understand_requirement`.
- `step_started` / `step_progress` for `collect_public_leads` after each external collection action.
- `step_progress` for `analyze_candidate_quality` after each AI decision.
- `step_completed` for `organize_candidates`.
- `workflow_completed` with `toLeadSearchPublicResult(...)`.

- [ ] **Step 3: Run orchestrator tests**

Run: `TSX_TSCONFIG_PATH=apps/server/tsconfig.json pnpm exec tsx --test apps/server/src/modules/ai-leads/ai-lead-search-orchestrator.service.spec.ts`

Expected: PASS.

## Task 3: Backend Stream Endpoint

**Files:**
- Modify: `apps/server/src/modules/ai-leads/ai-leads.service.ts`
- Modify: `apps/server/src/modules/ai-leads/ai-leads.controller.ts`

- [ ] **Step 1: Add stream service entry**

Add `searchOrchestrateStream(dto, context, reporter)` to `AiLeadsService`. It should trim the requirement and pass the reporter through to the existing orchestrator.

- [ ] **Step 2: Add controller stream endpoint**

Use `@Post('search-orchestrate/stream')`, `@Res() reply: FastifyReply`, and `reply.raw.write(...)` to emit NDJSON. Set:

```ts
reply.raw.writeHead(200, {
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive'
});
```

Create one run id with `crypto.randomUUID()`. In `try`, call `searchOrchestrateStream`. In `catch`, write a `workflow_failed` event with a user-facing message and record through existing service/orchestrator logging paths. Always `reply.raw.end()`.

- [ ] **Step 3: Typecheck the server slice**

Run: `pnpm --filter @soybean/server typecheck`

Expected: PASS.

## Task 4: Frontend Stream API And Parser

**Files:**
- Modify: `src/typings/api/ai-leads.d.ts`
- Modify: `src/service/api/ai-leads.shared.ts`
- Create: `src/service/api/ai-leads.stream.ts`
- Create: `src/service/api/ai-leads.stream.spec.ts`
- Modify: `src/service/api/ai-leads.ts`

- [ ] **Step 1: Write failing NDJSON parser tests**

Test that chunk parsing handles half-lines, multiple lines, and trailing final lines.

Run: `pnpm exec tsx --test src/service/api/ai-leads.stream.spec.ts`

Expected: FAIL because the stream module does not exist.

- [ ] **Step 2: Add frontend stream types**

Add `LeadSearchProgressEvent`, `LeadSearchPublicResult`, `LeadSearchProgressMetric`, and `LeadSearchStreamHandlers` to `src/typings/api/ai-leads.d.ts`.

- [ ] **Step 3: Implement the stream API**

`streamLeadCustomerSearch(data, handlers, options?)` should:

- Build URL from the existing service base URL/proxy config.
- Send `POST /ai-leads/search-orchestrate/stream`.
- Include `Content-Type`, `Accept: application/x-ndjson`, and `Authorization`.
- Read `response.body` with `TextDecoder`.
- Call `handlers.onEvent(event)` for each parsed line.
- Respect `AbortSignal`.

- [ ] **Step 4: Run stream API tests**

Run: `pnpm exec tsx --test src/service/api/ai-leads.stream.spec.ts src/service/api/ai-leads.spec.ts`

Expected: PASS.

## Task 5: Frontend Progress State And Panel

**Files:**
- Create: `src/views/ai-leads/modules/search-progress.ts`
- Create: `src/views/ai-leads/modules/search-progress.spec.ts`
- Create: `src/views/ai-leads/modules/SearchProgressPanel.vue`

- [ ] **Step 1: Write failing reducer tests**

Test dynamic step insertion, step completion, progress metrics, completion result, and failure message.

Run: `pnpm exec tsx --test src/views/ai-leads/modules/search-progress.spec.ts`

Expected: FAIL because the reducer does not exist.

- [ ] **Step 2: Implement the reducer**

Create pure helpers:

- `createLeadSearchProgressState()`
- `reduceLeadSearchProgressEvent(state, event)`
- `getMetricDisplayText(metric)`
- `isSearchWorkflowFinished(state)`

Do not hard-code a fixed workflow list. Use event `stepKey`, `title`, `description`, and `sequence`.

- [ ] **Step 3: Implement `SearchProgressPanel.vue`**

Use Naive UI components:

- `NProgress` for percent when available.
- `NTimeline` / compact custom rows for dynamic steps.
- `NTag` for metrics.
- `NDataTable` for public candidates after completion.
- `NAlert` for warnings/failures.

No visible `Serper`, `Search`, `Places`, `endpoint`, or raw JSON labels in the ordinary panel.

- [ ] **Step 4: Run reducer tests**

Run: `pnpm exec tsx --test src/views/ai-leads/modules/search-progress.spec.ts`

Expected: PASS.

## Task 6: Page Integration

**Files:**
- Modify: `src/views/ai-leads/index.vue`

- [ ] **Step 1: Replace search action with stream action**

Use `AbortController` to cancel an active stream before starting a new one. Reset progress state on new search. Call `streamLeadCustomerSearch` and reduce each event into state.

- [ ] **Step 2: Replace ordinary user JSON result display**

Render `SearchProgressPanel` whenever there is progress, streaming, or public result. Keep super-admin-only debugging out of the ordinary panel. Remove ordinary labels like `Serper 请求` and `决策` from the user-facing result card.

- [ ] **Step 3: Preserve existing keyword and history behavior**

Do not change keyword optimization editing/history flows except clearing progress state when the user clears, selects a history, deletes current history, or regenerates keywords.

- [ ] **Step 4: Run focused checks**

Run:

```bash
pnpm exec tsx --test src/service/api/ai-leads.stream.spec.ts src/views/ai-leads/modules/search-progress.spec.ts src/views/ai-leads/modules/shared.spec.ts
TSX_TSCONFIG_PATH=apps/server/tsconfig.json pnpm exec tsx --test apps/server/src/modules/ai-leads/ai-lead-search-progress.spec.ts apps/server/src/modules/ai-leads/ai-lead-search-orchestrator.service.spec.ts
pnpm --filter @soybean/server typecheck
```

Expected: PASS. Do not run `npm run build`.

## Self-Review

- Spec coverage: covers backend stream entry, dynamic event protocol, hidden technical details, frontend dynamic progress panel, public result, and failure handling.
- No placeholders: every task has files, concrete assertions, and commands.
- Type consistency: frontend and backend both use `LeadSearchProgressEvent`, `LeadSearchProgressMetric`, and `LeadSearchPublicResult`; backend keeps internal trace separate from public result.
