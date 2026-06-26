# CRM AI Draft Writing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add product-line-level AI writing prompts for CRM 1-5 step outbound drafts, with AI output saved as human-review drafts and no Gmail sending changes.

**Architecture:** Store a typed AI writing config on each `CrmProductLine`, add focused prompt/service helpers for AI draft generation, then route first and follow-up draft creation through that service when the selected product line has AI writing enabled. Frontend product-line settings expose the five per-step prompts, and the review drawer shows AI reason, risk notes, and generation-time prompt snapshot.

**Tech Stack:** NestJS, Prisma, PostgreSQL JSON, existing `AiGatewayService`, Vue 3 `<script setup>`, Naive UI, TypeScript, Node test runner, `vue-tsc`, oxlint, eslint.

---

## File Structure

- Modify `prisma/schema.prisma`: add `aiWritingConfig Json?` to `CrmProductLine`.
- Create `prisma/migrations/20260620153000_add_crm_product_line_ai_writing_config/migration.sql`: add nullable JSONB column.
- Regenerate Prisma client under `apps/server/src/generated/prisma`.
- Modify `apps/server/src/modules/crm/crm.types.ts`: add typed AI writing config, snapshot, metadata, product-line fields, and store input fields.
- Modify `apps/server/src/modules/crm/store/prisma-crm.store.ts`: persist and map `aiWritingConfig`.
- Modify `apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`: cover persistence.
- Create `apps/server/src/modules/crm/crm-ai-draft.types.ts`: local AI draft service types.
- Create `apps/server/src/modules/crm/crm-ai-draft-prompt.ts`: pure config normalization, prompt assembly, JSON parse helpers, and thin-context risk notes.
- Create `apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts`: red/green tests for helpers.
- Create `apps/server/src/modules/crm/crm-ai-draft.service.ts`: model call orchestration through `AiGatewayService`.
- Create `apps/server/src/modules/crm/crm-ai-draft.service.spec.ts`: model call and invalid JSON tests.
- Modify `apps/server/src/modules/crm/crm.module.ts`: import `AiGatewayModule`, provide `CrmAiDraftService`.
- Modify `apps/server/src/modules/crm/crm.service.ts`: normalize product-line config, admin-only config edits, call AI service for step 1 and steps 2-5, save metadata snapshot.
- Modify `apps/server/src/modules/crm/crm.service.spec.ts`: service behavior tests.
- Modify `apps/server/src/modules/crm/crm.controller.spec.ts`: product-line DTO/controller route contract tests if needed.
- Modify `apps/server/src/modules/crm/dto/create-crm-product-line.dto.ts` and `update-crm-product-line.dto.ts`: accept `aiWritingConfig`.
- Modify `src/typings/api/crm.d.ts`: add frontend API types.
- Modify `src/views/crm/settings/modules/shared.ts` and `shared.spec.ts`: form defaults, normalization, validation helpers.
- Modify `src/views/crm/settings/modules/ProductLineFormModal.vue`: AI writing form section.
- Modify `src/views/crm/settings/modules/useProductLineTable.ts`: submit normalized config.
- Modify `src/views/crm/email-sequences/modules/DraftReviewDrawer.vue`: display AI metadata.
- Modify `src/views/crm/email-sequences/modules/shared.ts` and `shared.spec.ts`: AI metadata view helpers if drawer needs pure formatting.

## Task 1: Product-Line AI Config Persistence

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260620153000_add_crm_product_line_ai_writing_config/migration.sql`
- Modify generated Prisma client after `prisma generate`
- Modify: `apps/server/src/modules/crm/crm.types.ts`
- Modify: `apps/server/src/modules/crm/store/prisma-crm.store.ts`
- Test: `apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`

- [ ] **Step 1: Write the failing store test**

Add a test named `persists product line AI writing config through Prisma` near existing product-line store tests:

```ts
const aiWritingConfig = {
  enabled: true,
  commonRequirements: 'Natural English, under 120 words.',
  forbiddenClaims: 'Do not promise price, MOQ, certificates, or lead time unless present.',
  productEmphasis: 'Prioritize stock models and fast quotation.',
  steps: [
    { stepIndex: 1, prompt: 'Open with a relevant sourcing angle.' },
    { stepIndex: 2, prompt: 'Light reminder without repeating step 1.' },
    { stepIndex: 3, prompt: 'Switch to delivery and quality angle.' },
    { stepIndex: 4, prompt: 'Add trust and review offer.' },
    { stepIndex: 5, prompt: 'Polite close-out.' }
  ]
};

const created = await store.createProductLine({
  organizationId: 'org-1',
  name: 'Bearing Series',
  aiWritingConfig,
  status: 'active',
  createdById: 'user-1',
  createdByName: 'User One'
});

assert.deepEqual(created.aiWritingConfig, aiWritingConfig);

const updated = await store.updateProductLine(created.id, 'org-1', {
  aiWritingConfig: { ...aiWritingConfig, productEmphasis: 'Focus on sealed bearings.' }
});

assert.equal(updated?.aiWritingConfig?.productEmphasis, 'Focus on sealed bearings.');
```

- [ ] **Step 2: Run the store test to verify RED**

Run:

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
```

Expected: fail because `aiWritingConfig` does not exist on Prisma model/types.

- [ ] **Step 3: Add database field and types**

Add to `model CrmProductLine`:

```prisma
aiWritingConfig   Json?
```

Create migration SQL:

```sql
ALTER TABLE "CrmProductLine" ADD COLUMN "aiWritingConfig" JSONB;
```

Add to `crm.types.ts`:

```ts
export type CrmAiWritingStepIndex = 1 | 2 | 3 | 4 | 5;

export interface CrmProductLineAiWritingStepConfig {
  stepIndex: CrmAiWritingStepIndex;
  prompt: string;
}

export interface CrmProductLineAiWritingConfig {
  enabled: boolean;
  commonRequirements: string;
  forbiddenClaims: string;
  productEmphasis: string;
  steps: CrmProductLineAiWritingStepConfig[];
}
```

Extend `CrmProductLineRecord`, `CrmProductLineCreateInput`, and `CrmProductLineUpdateInput` with:

```ts
aiWritingConfig: CrmProductLineAiWritingConfig | null;
```

For update input use optional:

```ts
aiWritingConfig?: CrmProductLineAiWritingConfig | null;
```

- [ ] **Step 4: Map Prisma JSON safely**

In `toProductLineRecord`, map JSON with a local helper:

```ts
aiWritingConfig: toProductLineAiWritingConfig(record.aiWritingConfig);
```

Add helper in `prisma-crm.store.ts`:

```ts
function toProductLineAiWritingConfig(value: unknown): CrmProductLineRecord['aiWritingConfig'] {
  if (!value || typeof value !== 'object') return null;
  const config = value as CrmProductLineRecord['aiWritingConfig'];
  return config;
}
```

When creating/updating, pass `aiWritingConfig` through to Prisma data.

- [ ] **Step 5: Generate Prisma client and verify GREEN**

Run:

```bash
pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
pnpm --filter @soybean/server typecheck
```

Expected: tests and server typecheck pass.

## Task 2: AI Prompt Helpers And Service

**Files:**

- Create: `apps/server/src/modules/crm/crm-ai-draft.types.ts`
- Create: `apps/server/src/modules/crm/crm-ai-draft-prompt.ts`
- Create: `apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts`
- Create: `apps/server/src/modules/crm/crm-ai-draft.service.ts`
- Create: `apps/server/src/modules/crm/crm-ai-draft.service.spec.ts`
- Modify: `apps/server/src/modules/crm/crm.module.ts`

- [ ] **Step 1: Write failing prompt helper tests**

Create tests for:

```ts
test('normalizes complete five-step AI writing config');
test('rejects enabled AI writing config with missing step prompt');
test('builds follow-up prompt with previous message summaries');
test('collects risk notes for missing contact title and product lead time');
test('parses strict AI JSON draft output');
test('rejects markdown wrapped or incomplete AI JSON output');
```

Use an input config with five steps and assert the prompt includes:

```ts
assert.match(prompt.userPrompt, /Previous messages/);
assert.match(prompt.userPrompt, /Step 2/);
assert.match(prompt.userPrompt, /Do not repeat/);
```

- [ ] **Step 2: Run prompt tests to verify RED**

Run:

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts
```

Expected: fail because files/functions do not exist.

- [ ] **Step 3: Implement prompt helpers**

Implement exported functions:

```ts
export function normalizeCrmProductLineAiWritingConfig(value: unknown): CrmProductLineAiWritingConfig | null;
export function requireEnabledCrmProductLineAiWritingConfig(value: unknown): CrmProductLineAiWritingConfig;
export function buildCrmAiDraftPrompt(input: CrmAiDraftPromptInput): CrmAiDraftPrompt;
export function parseCrmAiDraftOutput(text: string): CrmAiDraftOutput;
export function collectCrmAiDraftRiskNotes(input: CrmAiDraftPromptInput): string[];
```

The JSON parser should use `JSON.parse(text.trim())` only. Do not strip Markdown fences in version one; fenced output is invalid and should fail clearly.

- [ ] **Step 4: Write failing AI service tests**

Create a fake `AiGatewayService` with:

```ts
const aiGateway = {
  generateText: async () => ({
    text: JSON.stringify({
      subject: 'Bearing supply option',
      bodyText: 'Hi Alex,...',
      reason: 'Focused on sourcing angle.',
      riskNotes: ['产品交期未配置']
    }),
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }
  })
};
```

Assert service returns subject/body/reason/risk notes/snapshot and calls `generateText` with `modelConfigKey: 'default'` or existing default key.

- [ ] **Step 5: Run service tests to verify RED**

Run:

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-ai-draft.service.spec.ts
```

Expected: fail because service does not exist.

- [ ] **Step 6: Implement service and module wiring**

Implement `CrmAiDraftService` using `AiGatewayService.generateText({ prompt, systemPrompt, modelConfigKey, temperature, maxOutputTokens })`. Use a system prompt that enforces strict JSON and no invention.

Modify `crm.module.ts`:

```ts
imports: [AuthModule, DatabaseModule, RedisModule, SystemLogModule, SystemNotificationModule, AiGatewayModule],
providers: [CrmAiDraftService, ...]
```

- [ ] **Step 7: Verify GREEN**

Run:

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts apps/server/src/modules/crm/crm-ai-draft.service.spec.ts
pnpm --filter @soybean/server typecheck
```

Expected: all pass.

## Task 3: Backend CRM Draft Generation Integration

**Files:**

- Modify: `apps/server/src/modules/crm/crm.service.ts`
- Modify: `apps/server/src/modules/crm/crm.service.spec.ts`
- Modify: `apps/server/src/modules/crm/crm.controller.spec.ts` if DTO calls need updates
- Modify: `apps/server/src/modules/crm/dto/create-crm-product-line.dto.ts`
- Modify: `apps/server/src/modules/crm/dto/update-crm-product-line.dto.ts`

- [ ] **Step 1: Write failing service tests**

Add tests for:

```ts
test('creates first AI draft from product-line writing config and stores prompt snapshot');
test('generates next AI follow-up draft with previous messages in context');
test('rejects enabled AI generation when product-line writing config is incomplete');
test('keeps ordinary members from updating product-line AI writing config');
```

The first draft test should assert:

```ts
assert.equal(result.item.messages[0].status, 'draft_pending_review');
assert.equal(result.item.messages[0].subject, 'AI subject');
assert.equal(result.item.personaMatch.matchMethod, 'title');
assert.equal(timeline.metadata.aiDraft.reason, 'Focused on sourcing angle.');
assert.equal(timeline.metadata.aiDraft.snapshot.stepIndex, 1);
```

- [ ] **Step 2: Run service tests to verify RED**

Run:

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts
```

Expected: fail because service integration and metadata do not exist.

- [ ] **Step 3: Normalize product-line AI config in service**

Extend `ProductLineCreateInput` and `ProductLineUpdateInput` with `aiWritingConfig`.

In `normalizeProductLineCreateInput` and `normalizeProductLineUpdateInput`, call `normalizeCrmProductLineAiWritingConfig`.

Add admin guard before allowing `aiWritingConfig` changes:

```ts
if (hasOwn(input, 'aiWritingConfig') && !isOrganizationAdmin(context)) {
  throw new ForbiddenException('只有组织管理员可以编辑 AI 写信配置');
}
```

- [ ] **Step 4: Inject and call `CrmAiDraftService`**

Add optional constructor dependency:

```ts
@Optional() private readonly aiDraftService?: CrmAiDraftService
```

When a product line has enabled config, call AI service in:

- `createSequenceReviewItem` for step 1.
- `generateNextSequenceDraft` for next steps.
- `batchGenerateNextSequenceDrafts` indirectly through `generateNextSequenceDraft`.

If AI writing is enabled but service/model output fails, throw and do not create the draft.

- [ ] **Step 5: Store AI metadata**

When creating the timeline event for AI-generated drafts, add:

```ts
metadata: {
  ...existing,
  aiDraft: {
    generated: true,
    reason,
    riskNotes,
    snapshot
  }
}
```

If message metadata exists in current model, prefer message metadata; otherwise timeline metadata is acceptable for version one and must be surfaced through review item view.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/crm.controller.spec.ts
pnpm --filter @soybean/server typecheck
```

Expected: all pass.

## Task 4: Frontend Product-Line AI Writing Configuration

**Files:**

- Modify: `src/typings/api/crm.d.ts`
- Modify: `src/views/crm/settings/modules/shared.ts`
- Modify: `src/views/crm/settings/modules/shared.spec.ts`
- Modify: `src/views/crm/settings/modules/ProductLineFormModal.vue`
- Modify: `src/views/crm/settings/modules/useProductLineTable.ts`

- [ ] **Step 1: Write failing shared tests**

Add tests:

```ts
test('creates default product line form with disabled five-step AI writing config');
test('normalizes enabled product line AI writing config with five trimmed step prompts');
test('rejects enabled product line AI writing config with empty step prompt');
```

Expected model:

```ts
{
  aiWritingConfig: {
    enabled: false,
    commonRequirements: '',
    forbiddenClaims: '',
    productEmphasis: '',
    steps: [
      { stepIndex: 1, prompt: '' },
      { stepIndex: 2, prompt: '' },
      { stepIndex: 3, prompt: '' },
      { stepIndex: 4, prompt: '' },
      { stepIndex: 5, prompt: '' }
    ]
  }
}
```

- [ ] **Step 2: Run frontend shared tests to verify RED**

Run:

```bash
pnpm exec tsx --test src/views/crm/settings/modules/shared.spec.ts
```

Expected: fail because types/helpers do not include `aiWritingConfig`.

- [ ] **Step 3: Add frontend types and helpers**

Add `AiWritingConfig`, `AiWritingStepConfig`, and extend `ProductLineRecord` / `ProductLinePayload` / `ProductLineFormModel`.

Implement helpers:

```ts
export function createDefaultProductLineAiWritingConfig(): Api.Crm.ProductLineAiWritingConfig;
export function normalizeProductLineAiWritingConfig(
  config: Api.Crm.ProductLineAiWritingConfig
): Api.Crm.ProductLineAiWritingConfig | null;
export function validateProductLineAiWritingConfig(config: Api.Crm.ProductLineAiWritingConfig): string | null;
```

When disabled, submit `aiWritingConfig: null` or `{ enabled: false, ... }` consistently with backend normalization.

- [ ] **Step 4: Add Naive UI form section**

In `ProductLineFormModal.vue`, add:

- `NSwitch` for enabled.
- Textareas for common requirements, forbidden claims, product emphasis.
- `NTabs` or compact vertical sections for step 1-5 prompts.
- Validation in `handleSubmit`: if enabled and missing required fields, show form validation error or block submit with message.

Use existing Naive UI patterns and keep modal width responsive.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
pnpm exec tsx --test src/views/crm/settings/modules/shared.spec.ts
pnpm typecheck
pnpm exec oxlint
```

Expected: tests, typecheck, and oxlint pass.

## Task 5: Review Drawer AI Metadata Display

**Files:**

- Modify: `src/typings/api/crm.d.ts`
- Modify: `src/views/crm/email-sequences/modules/shared.ts`
- Modify: `src/views/crm/email-sequences/modules/shared.spec.ts`
- Modify: `src/views/crm/email-sequences/modules/DraftReviewDrawer.vue`

- [ ] **Step 1: Write failing display helper tests**

Add tests for:

```ts
test('formats AI draft metadata reason risk notes and prompt snapshot for review drawer');
test('returns null AI metadata view when no AI draft metadata exists');
```

Use a review item timeline metadata object:

```ts
{
  aiDraft: {
    generated: true,
    reason: 'Focused on sourcing angle.',
    riskNotes: ['产品交期未配置'],
    snapshot: {
      productLineId: 'line-1',
      productLineName: 'Bearing Series',
      stepIndex: 2,
      writingConfig: {
        enabled: true,
        commonRequirements: 'Under 120 words.',
        forbiddenClaims: 'No fake certificates.',
        productEmphasis: 'Focus on stock models.',
        steps: [{ stepIndex: 2, prompt: 'Light reminder.' }]
      },
      generatedAt: '2026-06-20T00:00:00.000Z'
    }
  }
}
```

- [ ] **Step 2: Run drawer shared tests to verify RED**

Run:

```bash
pnpm exec tsx --test src/views/crm/email-sequences/modules/shared.spec.ts
```

Expected: fail because helper/UI metadata type does not exist.

- [ ] **Step 3: Add metadata type and helper**

Extend API type for sequence review item with optional `aiDraft` metadata view. Prefer backend view field if Task 3 exposes it; otherwise derive from timeline metadata in helper.

Add helper:

```ts
export function buildAiDraftMetadataView(item: Api.Crm.SequenceReviewItem): AiDraftMetadataView | null;
```

- [ ] **Step 4: Render metadata in drawer**

In `DraftReviewDrawer.vue`, add a compact section near persona/template review:

- AI 写作说明: reason.
- 风险提示: `NTag` list or `NAlert` if notes exist.
- 使用提示词: product line name + step.
- Prompt snapshot collapsed by default with `NCollapse`.

Do not put this in a nested card.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
pnpm exec tsx --test src/views/crm/email-sequences/modules/shared.spec.ts
pnpm typecheck
pnpm exec eslint --max-warnings=0 .
```

Expected: tests, typecheck, and eslint pass.

## Task 6: Integration Verification

**Files:**

- All touched files from Tasks 1-5.

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts apps/server/src/modules/crm/crm-ai-draft.service.spec.ts apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/crm.controller.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
```

Expected: all pass.

- [ ] **Step 2: Run focused frontend tests**

Run:

```bash
pnpm exec tsx --test src/views/crm/settings/modules/shared.spec.ts src/views/crm/email-sequences/modules/shared.spec.ts
```

Expected: all pass.

- [ ] **Step 3: Run type and lint checks**

Run:

```bash
pnpm --filter @soybean/server typecheck
pnpm typecheck
pnpm exec oxlint
pnpm exec eslint --max-warnings=0 .
git diff --check
```

Expected: all pass.

- [ ] **Step 4: Confirm no Gmail real-send changes**

Run:

```bash
git diff --name-only | rg "gmail|Gmail|\\.env|docker|compose|crm-email-send.gateway" || true
```

Expected: no `.env` changes and no new real Gmail send behavior. Importing AI gateway into CRM is allowed.

- [ ] **Step 5: Commit final implementation**

Run:

```bash
git status --short
git add prisma/schema.prisma prisma/migrations/20260620153000_add_crm_product_line_ai_writing_config/migration.sql apps/server/src/generated/prisma apps/server/src/modules/crm src/typings/api/crm.d.ts src/views/crm/settings/modules src/views/crm/email-sequences/modules docs/superpowers/plans/2026-06-20-crm-ai-draft-writing.md
git diff --cached --stat
git commit --no-verify -m "feat: 接入 CRM AI 写信草稿"
```

Expected: commit succeeds and `git status --short` is clean.
