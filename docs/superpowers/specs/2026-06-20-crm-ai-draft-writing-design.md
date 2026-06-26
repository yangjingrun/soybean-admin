# CRM AI Draft Writing Design

## Goal

Build product-line-level AI writing for CRM outbound email drafts. AI writes step 1-5 drafts from customer, contact, product line, persona, template, strategy, and previous draft context, then always leaves the result in the existing human review flow.

## Scope

This feature adds AI-assisted draft generation only. It does not connect or change real Gmail sending, does not auto-send emails, and does not build customer reply AI drafts.

In scope:

- Each product line can configure one AI writing profile.
- The writing profile has common requirements, forbidden claims, product emphasis, and separate prompt text for steps 1-5.
- Product-line AI writing profiles can be edited by organization administrators and used by ordinary members.
- First-touch draft generation can use AI when the selected product line has a complete AI writing profile.
- Follow-up draft generation for steps 2-5 can use AI and must read the previous sequence messages to avoid repetition.
- AI output is saved as a normal `draft_pending_review` message and enters the existing edit, version history, restore, batch approve, and manual review flow.
- AI generation stores a short explanation and risk notes in local metadata for review.
- AI generation stores a snapshot of the product-line writing profile used for that draft, so later prompt edits do not rewrite the historical context.

Out of scope:

- Real Gmail OAuth, watch, Pub/Sub, History, or send environment work.
- Fully automatic sending.
- AI reply drafts for inbound customer messages.
- Website crawling, PDF parsing, attachment generation, or Hunter Email Finder.
- A new global prompt management system.
- A bulk AI queue for thousands of model calls. Version one can keep the current batch operation shape and report per-item results.

## Product Behavior

In CRM settings, each product line gets an AI writing section:

- Common requirements: one text area for tone, length, language, formatting, and general writing style.
- Forbidden claims: one text area for things AI must not say, such as unverified lowest price, fake certificates, exact lead time, exclusive distribution, or unsupported guarantees.
- Product emphasis: one text area for selling points AI should prioritize for this product line.
- Step prompts: five separate text areas, one for each email step.

Only organization administrators can edit product-line AI writing profiles. Ordinary members can select product lines and generate drafts from approved profiles, but cannot change the prompt instructions.

When creating a sequence review item, the user selects a product line. If that product line has AI writing enabled and all required writing fields are present, the backend asks AI to write the first draft. The generated subject and body are still shown as an editable draft.

When generating the next follow-up draft, the backend asks AI to write the next step using the earlier messages in the same sequence. The prompt must explicitly tell AI not to repeat the previous emails and to follow the step-specific instruction for that product line.

If a product line does not have AI writing enabled or is missing required prompt fields, the backend returns a clear business error for AI generation paths. It must not silently invent a generic AI prompt.

If customer or product context is thin, AI should write a conservative draft and add risk notes such as "联系人职位缺失" or "产品交期未配置". It must not fill missing context with guesses.

## Data Model

Add product-line-owned AI writing fields to `CrmProductLine`, because the user wants each product line to own its own prompt set.

Recommended logical shape:

```ts
interface CrmProductLineAiWritingConfig {
  enabled: boolean;
  commonRequirements: string;
  forbiddenClaims: string;
  productEmphasis: string;
  steps: Array<{
    stepIndex: 1 | 2 | 3 | 4 | 5;
    prompt: string;
  }>;
}
```

The stored shape can be a JSON column or explicit text columns. Prefer whichever matches the existing Prisma and service patterns best during implementation. The API should expose a typed object to frontend code.

Each AI-generated draft should also persist a generation snapshot:

```ts
interface CrmAiDraftSnapshot {
  productLineId: string;
  productLineName: string;
  stepIndex: 1 | 2 | 3 | 4 | 5;
  writingConfig: CrmProductLineAiWritingConfig;
  reason: string;
  riskNotes: string[];
  generatedAt: string;
}
```

The snapshot is for audit and review only. It must not contain API keys, model provider config, hidden system prompts, or user secrets.

## AI Prompt Contract

The backend builds the final prompt from structured CRM data. Product-line prompt fields are instructions, not raw final prompts.

The AI receives:

- Account: name, country, domain, customer type, source note, and known description fields.
- Contact: full name, title, masked email, email status, and persona match info.
- Product line: name, target customer type, core selling points, MOQ, lead time, payment terms, certifications, catalog URL, website URL, common models, and the product-line AI writing config.
- Sequence: current step index, total steps, selected sequence policy, template step, and previous messages in the sequence.
- Sender: current user display name.

The AI must return strict JSON:

```json
{
  "subject": "string",
  "bodyText": "string",
  "reason": "string",
  "riskNotes": ["string"]
}
```

Rules:

- `subject` is required for new-subject steps. Same-thread follow-up steps can return an empty subject and reuse the previous subject according to existing strategy rules.
- `bodyText` must be plain text, not HTML.
- AI must not invent price, MOQ, lead time, certifications, customer references, exclusive claims, or compliance claims. It can only mention these if present in product line data.
- AI must treat missing customer, contact, or product fields as missing. It can be general, but it cannot create fake personalization.
- AI must keep the email short and reviewable. Default target is 80-150 English words unless product-line instructions say otherwise.
- AI must not include attachments, tracking links, images, or unsupported URLs.
- AI should avoid repeating previous messages. For follow-up steps, it should change the angle according to the step-specific prompt.

## Backend Architecture

Add a small CRM AI draft service instead of putting prompt construction directly into `CrmService`.

Recommended units:

- `crm-ai-draft.service.ts`: orchestrates model config lookup, prompt creation, AI text generation, JSON parsing, and guard checks.
- `crm-ai-draft-prompt.ts`: pure functions for prompt assembly and deterministic validation of required context.
- `crm-ai-draft.types.ts`: local input/output types if the existing CRM type file becomes too crowded.

`CrmService.createSequenceReviewItem` uses this service for step 1 when AI writing is requested and product-line config is enabled.

`CrmService.generateNextSequenceDraft` and batch next-draft generation use this service for steps 2-5 when AI writing is enabled.

The service should depend on the existing `ai-gateway` text generator/model config pattern. It should not introduce a second model SDK.

Errors:

- Missing AI model config: return the existing missing-model-config style error.
- Product line AI config disabled or incomplete: return a business error telling the user to complete the product-line AI writing config.
- AI invalid JSON or missing required fields: return a business error and do not create a draft.
- AI provider call failure: return the existing gateway error and do not create a draft.
- Thin CRM context: allow generation, but require the AI draft metadata to include clear risk notes.

## Review Metadata

When an AI draft is created, store local metadata on the timeline event or message metadata equivalent already used by CRM. The UI should be able to show:

- AI generated: yes.
- AI reason: short explanation.
- Risk notes: concise list.
- Product line prompt source: product line id and name.
- Step prompt index.
- Prompt snapshot: common requirements, forbidden claims, product emphasis, and the exact step prompt used.

This metadata must not include secrets, API keys, raw model config, full hidden system prompt, or provider credentials.

## Frontend Architecture

Product line management gets an AI writing section inside the existing CRM settings product-line editor. Keep it close to `ProductLineManager` rather than creating a new top-level page.

The AI writing section is editable for organization administrators. Ordinary members should see product-line data according to existing visibility rules, but should not see edit controls for AI writing configuration unless they already have product-line edit permission.

Email sequence review drawer should show AI metadata when present:

- AI 写作说明
- 风险提示
- 使用的产品线提示词
- 生成时提示词快照

The create-sequence modal should make it clear that selecting a product line with AI writing enabled will generate an AI draft. If AI config is missing, the backend error should be surfaced directly.

No separate AI send button is needed in version one. AI generation happens when creating the first draft or next follow-up draft.

## Data Flow

First draft:

```text
User selects account/contact/product line/mailbox/policy
  -> create sequence review item
  -> backend loads product line AI writing config
  -> backend builds AI prompt from CRM context
  -> ai-gateway generates strict JSON
  -> backend validates subject/body
  -> backend creates draft_pending_review message
  -> user reviews, edits, saves versions, and confirms manually
```

Follow-up draft:

```text
Previous message exists and customer has not replied
  -> user clicks generate next draft or batch generate
  -> backend loads current sequence messages
  -> backend builds AI prompt with previous messages
  -> ai-gateway generates next-step JSON
  -> backend creates next draft_pending_review message
  -> user reviews and confirms manually
```

## Permissions And Safety

- Draft creation and follow-up draft generation must keep the existing owner-only rules.
- Organization admins can view according to existing permissions, but must not become able to edit, confirm, or generate drafts for another member if current rules forbid it.
- Product-line AI writing profile edits should follow product-line management permissions and be limited to organization administrators in version one.
- Existing blacklist, stopped sequence, duplicate active sequence, and status guards stay unchanged.
- AI generation must not create queued or sent messages.
- AI generation must never call Gmail.
- AI generation must not silently downgrade to deterministic templates when the user explicitly expects AI generation. Return a clear error instead.
- Batch AI generation should return per-item results and should not hide model-call failures.

## Testing Strategy

Backend tests:

- Product line AI writing config normalization and validation.
- Ordinary members cannot update product-line AI writing config.
- Step 1 AI draft generation creates `draft_pending_review` and stores metadata.
- Step 2-5 generation passes previous messages into prompt construction.
- Missing product-line AI config rejects generation with a business error.
- Invalid AI JSON rejects generation and creates no draft.
- AI output that invents forbidden structured fields is rejected or surfaced as risk notes according to implementation guard design.
- AI generation stores an immutable snapshot of the product-line prompt fields used at generation time.
- Thin CRM context still generates a conservative draft and includes risk notes.
- Batch next-draft generation reports per-item skipped/failed results without aborting the whole batch.

Frontend tests:

- Product line AI writing form normalizes five step prompts.
- Empty required prompt fields are validated before save when AI writing is enabled.
- Ordinary-member UI does not expose product-line AI writing edit controls.
- Review drawer displays AI reason and risk notes when metadata exists.
- Review drawer displays the generation-time prompt snapshot when metadata exists.

Verification commands:

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
pnpm exec tsx --test src/views/crm/settings/modules/shared.spec.ts src/views/crm/email-sequences/modules/shared.spec.ts
pnpm --filter @soybean/server typecheck
pnpm typecheck
pnpm exec eslint --max-warnings=0 .
pnpm exec oxlint
git diff --check
```

Do not run `npm run build`.

## Open Decisions Closed For Version One

- AI writing config is per product line, not global.
- Steps 1-5 each have separate prompt text.
- AI drafts always require human review.
- Organization administrators edit product-line AI writing profiles; members use them.
- AI draft metadata stores a prompt snapshot for audit.
- Missing CRM context is surfaced as risk notes, not filled with guesses.
- Gmail remains out of scope.
- The first version uses existing AI gateway infrastructure.
- No customer reply draft generation in this feature.
