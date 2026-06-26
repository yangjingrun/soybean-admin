# CRM AI Outreach Prompt Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a super-admin-maintained CRM AI outreach methodology layer that combines Hunter/Snov.io public cold-email guidance, product-line configuration, customer facts, job title, region, and previous messages to generate personalized 1-5 step outbound emails.

**Architecture:** Reuse the existing AI Prompt Workbench as the global prompt module control plane, and reuse product-line `aiWritingConfig` as the organization/product-specific business layer. Add a focused CRM prompt composer that resolves global modules, product-line settings, customer context, persona, region, public-source facts, and previous messages before calling `AiGatewayService.generateText()`. The first pass uses the cold-email methodology to produce a strategically sound draft; an optional second pass uses avoid-ai-writing rules to polish AI-sounding phrasing without changing facts, promises, or CTA.

**Tech Stack:** NestJS, Prisma/PostgreSQL JSON fields already in place, existing `AiGatewayService`, existing CRM sequence services, Vue 3 `<script setup lang="ts">`, Naive UI, Node test runner.

---

## Public Research Basis

Use Hunter and Snov.io as methodology references, not as copied templates:

- Hunter relevance research: relevance and personalization are primary reply drivers; the system must select arguments by recipient role and actual problem, not only fill `{{firstName}}`.
  - Source: https://hunter.io/blog/making-your-cold-emails-relevant-101/
- Hunter follow-up guidance: follow up in the same thread by default, wait at least 2-3 days, add value in every follow-up, and use a different CTA when the first CTA did not work.
  - Source: https://hunter.io/blog/how-to-write-a-follow-up-email/
- Hunter deliverability guidance: narrow targeting, daily sending limits, trustworthy personalized content, and human-like cadence matter for deliverability.
  - Source: https://hunter.io/blog/email-deliverability/
- Snov.io sequence guidance: sequence messages should be segmented, spaced with different delays, personalized, and logically follow the previous message.
  - Source: https://snov.io/blog/email-sequence/
- Snov.io cold-email writing guidance: subject lines should use curiosity, personalization, social proof, numbers, and short length; follow-ups should be short, friendly, restate benefits, and add value.
  - Source: https://snov.io/blog/how-to-write-cold-emails/
- Snov.io 2026 statistics: short emails perform well at scale; one follow-up can improve responses; too many follow-ups can hurt response and sender reputation, so five steps should be available but not forced for every prospect.
  - Source: https://snov.io/blog/cold-email-statistics/
- marketingskills / cold-email: use as the primary cold-email methodology source. Encode peer-level voice, personalization tied to the problem, one low-friction CTA, 2-4 word internal-looking subject lines, and new value in every follow-up.
  - Source: https://github.com/coreyhaines31/marketingskills/blob/main/skills/cold-email/SKILL.md
- avoid-ai-writing: use as the optional second-pass polish and QA source. Encode minimal edits, remove AI-isms, preserve already-human lines, avoid generic template phrases, and cap convergence rather than rewriting forever.
  - Source: https://github.com/conorbronsdon/avoid-ai-writing/blob/main/SKILL.md

## Product Decisions

- Super admin maintains global CRM writing methodology in the existing AI Prompt Workbench.
- Organization/admin users continue maintaining product-line facts and product-line writing preferences in CRM settings.
- End users do not edit global methodology during generation.
- The AI generator selects modules based on `stepIndex`, contact title, account country/city/timezone, customer type, product line, previous messages, and public lead facts.
- Generated emails must cite only provided CRM/public facts. If public facts are missing, the AI writes a generic but relevant angle and records a risk note.
- First-pass drafts prioritize outreach strategy, facts, and CTA correctness. Second-pass polish may improve wording only; it must not add facts, add promises, or change CTA strength.
- Default sequence supports 1-5 steps, but the recommended strategy is 3 core steps plus optional referral/breakup steps for high-value prospects.
- Existing send scheduling, same-thread policy, reply stop logic, mailbox limits, and customer timezone windows remain unchanged.

## Outreach Methodology To Encode

| Step | Theme              | Hunter/Snov.io-derived rule                                                                           | Default CTA                                              |
| ---- | ------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1    | Relevance opener   | Mention a real public/company/role signal, then connect it to one likely business problem.            | Ask whether this problem is relevant.                    |
| 2    | Alternative value  | Same thread by default; do not ask "just checking"; add a new value angle.                            | Ask a lower-friction question or ask who owns the topic. |
| 3    | Proof/credibility  | Use product-line proof if provided; never invent case studies, numbers, certifications, or customers. | Ask whether they want a short comparison or quote.       |
| 4    | Referral/fit check | If no reply, assume wrong person or wrong timing before pushing again.                                | Ask for the right person/team.                           |
| 5    | Breakup/close loop | Politely close the loop; preserve future opportunity and stop annoying the prospect.                  | Ask whether to close the file or reconnect next quarter. |

Role modules:

- Founder/CEO: growth, market expansion, risk, cost, supplier stability.
- Sales/BD: qualified buyers, response rate, pipeline, lead quality, regional development.
- Procurement/Sourcing: supplier reliability, price clarity, lead time, MOQ, alternatives.
- Operations: delivery reliability, manual workload, process bottlenecks.
- Marketing: positioning, conversion, campaign relevance, local-market messaging.
- Unknown role: avoid over-specific assumptions and ask a fit-check question.

Region modules:

- Use `country`, `city`, `timeZone`, and `languagePolicy` to tune phrasing.
- Do not translate product names blindly; preserve industry English terms when appropriate.
- Reference local market issues only when supported by product line or source facts.
- Schedule and follow-up timing remain controlled by existing CRM scheduler, not the prompt.

Second-pass polish module:

- Only polish the first-pass `subject` and `bodyText`; do not reselect outreach strategy.
- Remove AI-sounding openers such as `I hope this email finds you well`, `I came across your profile`, and `My name is...`.
- Remove vague sales words such as `leverage`, `synergy`, `best-in-class`, `cutting-edge`, `robust`, and `seamless`.
- Remove no-value follow-up phrases such as `just checking in`, `bumping this up`, and `did you see my last email`.
- Keep one CTA per email, and do not upgrade a low-friction CTA into a hard meeting ask.
- Preserve product facts, public-source facts, risk notes, and human review hints.
- Run at most one second-pass polish call. If obvious AI-isms remain, write `qualityFlags` for human review instead of entering an infinite rewrite loop.

## File Structure

### Backend

- Modify `apps/server/src/modules/ai-gateway/ai-gateway.constants.ts`
  - Add CRM outreach prompt definitions and channel/group metadata.
  - Add default system prompt drafts for CRM modules.
- Modify `apps/server/src/modules/ai-gateway/ai-gateway.types.ts`
  - Add optional `group` to `AiPromptStepSummary`.
  - Extend prompt channel union with `crm_email`.
- Modify `apps/server/src/modules/ai-gateway/ai-prompt-validator.ts`
  - Add CRM outreach prompt validation rules.
- Modify `apps/server/src/modules/ai-gateway/ai-gateway.service.ts`
  - Continue fixed-key validation.
  - Expose CRM prompt modules through existing list/detail/draft/test/publish endpoints.
- Create `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module.types.ts`
  - Define module keys, selected module records, composer inputs, and snapshot structures.
- Create `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module-resolver.ts`
  - Select global prompt modules from step, role, region, public-source availability, and previous messages.
- Create `apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.ts`
  - Build a compact LLM-safe context from account, contact, product line, persona, previous messages, and source facts.
- Create `apps/server/src/modules/crm/ai-writing/crm-ai-writing-prompt-composer.ts`
  - Compose final `systemPrompt` and `userPrompt`.
- Create `apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.ts`
  - Run deterministic QA on first-pass and polished drafts, checking AI-isms, subject length, multiple CTAs, fact id boundaries, and repeated follow-up angle.
- Modify `apps/server/src/modules/crm/crm-ai-draft-prompt.ts`
  - Keep strict JSON parsing and normalization helpers.
  - Delegate prompt construction to the new composer.
- Modify `apps/server/src/modules/crm/crm-ai-draft.service.ts`
  - Resolve published/default global modules.
  - Pass selected modules into the composer.
  - After first-pass generation, decide whether to run avoid-ai-writing polish based on product-line policy and quality-check result.
  - Persist selected module keys and versions in metadata snapshot.
- Modify `apps/server/src/modules/crm/crm-ai-draft.types.ts`
  - Add optional selected module and source-fact fields.
- Modify `apps/server/src/modules/crm/crm.types.ts`
  - Extend `CrmProductLineAiWritingConfig` JSON shape with optional style controls:
    - `sequenceStrategy`
    - `languagePolicy`
    - `tone`
    - `ctaPreference`
    - `polishPolicy`
    - `proofAssets`
    - `regionNotes`
- Modify `apps/server/src/modules/crm/product-lines/crm-product-line-rules.ts`
  - Normalize new optional JSON fields without inventing defaults.

### Frontend

- Modify `src/typings/api/ai-gateway.d.ts`
  - Add prompt group/channel fields.
- Modify `src/views/ai-prompt-settings/modules/shared.ts`
  - Group prompt steps into AI 获客 and CRM 写信方法论.
  - Add CRM section anchors: 基础规则, 序列策略, 职位画像, 地区本地化, 公开资料, 输出结构.
- Modify `src/views/ai-prompt-settings/modules/PromptStepList.vue`
  - Display grouped prompt modules.
- Modify `src/views/ai-prompt-settings/modules/PromptEditor.vue`
  - Make header text generic: AI 业务提示词, not only AI 获客提示词.
- Modify `src/views/ai-prompt-settings/modules/PromptPublishPanel.vue`
  - Change test placeholder to support CRM customer/product-line context samples.
- Modify `src/views/crm/settings/modules/product-line-settings.ts`
  - Add default optional style fields to product-line AI writing form.
- Modify `src/views/crm/settings/modules/ProductLineFormDrawer.vue`
  - Add compact controls for sequence strategy, language policy, tone, CTA style, proof assets, and region notes.
- Modify `src/views/crm/email-sequences/modules/DraftReviewModal.vue`
  - Show selected global modules and source facts in the existing AI snapshot panel.
- Modify `src/views/crm/email-sequences/modules/DraftAiInfoPanel.vue`
  - Display module snapshot in detail drawer if present.

## Prompt Module Keys

Use these fixed keys so the workbench can validate and version them:

- `crm_outreach_base_rules`
- `crm_outreach_cold_email_core`
- `crm_outreach_sequence_strategy`
- `crm_outreach_role_persona`
- `crm_outreach_region_localization`
- `crm_outreach_public_source_grounding`
- `crm_outreach_subject_line`
- `crm_outreach_deliverability_guard`
- `crm_outreach_ai_polish`
- `crm_outreach_output_contract`

The composer loads:

- First pass always: `base_rules`, `cold_email_core`, `sequence_strategy`, `public_source_grounding`, `subject_line`, `deliverability_guard`, `output_contract`.
- Conditionally emphasized inside first-pass user context:
  - `role_persona` when contact title exists.
  - `region_localization` when country/city/timezone exists.
  - previous-message block when `stepIndex > 1`.
- Second-pass polish only: `ai_polish`, `public_source_grounding`, `deliverability_guard`, `output_contract`.

## LLM Output Contract

Keep strict JSON. Required fields:

```json
{
  "subject": "string",
  "bodyText": "string",
  "reason": "string",
  "riskNotes": ["string"],
  "usedAngles": ["string"],
  "usedFacts": ["string"],
  "nextReviewHints": ["string"],
  "qualityFlags": ["string"],
  "polishChanges": ["string"]
}
```

Mapping rules:

- Store `subject`, `bodyText`, `reason`, `riskNotes` as today.
- Store `usedAngles`, `usedFacts`, `nextReviewHints`, `qualityFlags`, and `polishChanges` inside `metadata.snapshot`.
- If model omits optional arrays, normalize them to empty arrays.
- If `bodyText` is empty, continue throwing `BadRequestException('AI 返回正文不能为空')`.
- If model references a fact not present in CRM/product/source context, parser does not silently accept it; the composer should instruct the model to put uncertain claims into `riskNotes`.
- If the polished version adds a fact id, promise, or CTA that the first pass did not use, discard the polished version, keep the first pass, and write a `qualityFlags` entry.

## Product-Line AI Writing Config Shape

Preserve current required fields:

```ts
interface CrmProductLineAiWritingConfig {
  enabled: boolean;
  commonRequirements: string;
  forbiddenClaims: string;
  productEmphasis: string;
  steps: CrmProductLineAiWritingStepConfig[];
  sequenceStrategy?: 'core_3_step' | 'full_5_step';
  languagePolicy?: 'account_locale_or_english' | 'english' | 'local_language';
  tone?: 'consultative' | 'direct' | 'formal';
  ctaPreference?: 'low_friction_question' | 'meeting' | 'quote' | 'referral';
  polishPolicy?: 'auto_when_flagged' | 'always' | 'off';
  proofAssets?: string;
  regionNotes?: string;
}
```

Normalization:

- Existing saved configs remain valid.
- Missing optional fields stay missing or get UI defaults only in frontend form state.
- Backend prompt composer treats missing optional fields as absent guidance, not as business facts.
- `polishPolicy` is displayed as `auto_when_flagged` in frontend form state by default. On the backend, missing `polishPolicy` is treated as `auto_when_flagged` without writing that default back to old configs.

## Tasks

### Task 1: Add CRM Outreach Prompt Definitions

**Files:**

- Modify `apps/server/src/modules/ai-gateway/ai-gateway.constants.ts`
- Modify `apps/server/src/modules/ai-gateway/ai-gateway.types.ts`
- Modify `src/typings/api/ai-gateway.d.ts`
- Test `apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts`
- Test `src/views/ai-prompt-settings/modules/shared.spec.ts`

- [ ] Step 1: Add failing tests that `listPromptWorkbenchSteps()` includes the ten CRM prompt module keys with group `crm_outreach`.
- [ ] Step 2: Add CRM prompt definitions and default drafts based on the public research basis above.
- [ ] Step 3: Add frontend type fields for prompt group.
- [ ] Step 4: Run `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts`.
- [ ] Step 5: Run `pnpm exec tsx --test src/views/ai-prompt-settings/modules/shared.spec.ts`.

### Task 2: Add Prompt Validation For CRM Modules

**Files:**

- Modify `apps/server/src/modules/ai-gateway/ai-prompt-validator.ts`
- Modify `apps/server/src/modules/ai-gateway/ai-prompt-validator.spec.ts`

- [ ] Step 1: Add failing validation tests for required CRM prompt phrases:
  - JSON-only output rule.
  - No invented facts rule.
  - Public facts only rule.
  - Follow-up adds new value rule.
  - Subject line avoids spam/clickbait rule.
  - `ai_polish` may polish wording only and must not add facts, promises, or CTA.
- [ ] Step 2: Implement validation item mapping for the new prompt keys.
- [ ] Step 3: Run `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-gateway/ai-prompt-validator.spec.ts`.

### Task 3: Add CRM AI Writing Module Resolver

**Files:**

- Create `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module.types.ts`
- Create `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module-resolver.ts`
- Test `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module-resolver.spec.ts`

- [ ] Step 1: Write tests for selected module keys on step 1, step 2, unknown role, procurement role, and account with country/city.
- [ ] Step 2: Implement role bucket detection from `contact.title`.
- [ ] Step 3: Implement selected module metadata with `promptKey`, `title`, and `reason`.
- [ ] Step 4: Run `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/ai-writing/crm-ai-writing-module-resolver.spec.ts`.

### Task 4: Add LLM-Safe CRM Context Builder

**Files:**

- Create `apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.ts`
- Test `apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.spec.ts`

- [ ] Step 1: Write tests that source snapshot fields become `publicFacts` only when present.
- [ ] Step 2: Write tests that missing title/country/product facts produce review notes, not fake fallback facts.
- [ ] Step 3: Implement compact context builder for account, contact, product line, persona, previous messages, and source facts.
- [ ] Step 4: Run `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.spec.ts`.

### Task 5: Add Prompt Composer

**Files:**

- Create `apps/server/src/modules/crm/ai-writing/crm-ai-writing-prompt-composer.ts`
- Create `apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.ts`
- Modify `apps/server/src/modules/crm/crm-ai-draft-prompt.ts`
- Modify `apps/server/src/modules/crm/crm-ai-draft.types.ts`
- Test `apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts`
- Test `apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.spec.ts`

- [ ] Step 1: Add tests that step 2 prompt includes previous messages and asks for a different angle.
- [ ] Step 2: Add tests that public-source grounding appears when source facts exist.
- [ ] Step 3: Add tests that output contract includes `usedAngles`, `usedFacts`, and `nextReviewHints`.
- [ ] Step 4: Add quality-check tests for AI-ism phrases, long subjects, multiple CTAs, fact id boundary violations, and no-value follow-up phrases.
- [ ] Step 5: Implement composer using selected module texts plus structured CRM context.
- [ ] Step 6: Implement quality check, returning `qualityFlags` and whether second-pass polish should run.
- [ ] Step 7: Run `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.spec.ts`.

### Task 6: Wire Composer Into Draft Generation

**Files:**

- Modify `apps/server/src/modules/crm/crm-ai-draft.service.ts`
- Modify `apps/server/src/modules/crm/crm-ai-draft.service.spec.ts`
- Modify `apps/server/src/modules/crm/sequence/crm-draft-preview.service.ts`
- Modify `apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.ts`

- [ ] Step 1: Add tests that generated metadata includes selected module keys and public facts.
- [ ] Step 2: Resolve global prompt modules through `AiGatewayService.getPrompt()` before model call.
- [ ] Step 3: Pass the first-pass final `systemPrompt` and `userPrompt` into `generateText()` as today.
- [ ] Step 4: Run quality check after the first pass. If obvious AI-isms are flagged and `polishPolicy !== 'off'`, call the model once more with `crm_outreach_ai_polish`.
- [ ] Step 5: Verify the polished version did not add facts, promises, or CTA. If verification fails, keep the first pass and write `qualityFlags`.
- [ ] Step 6: Use `temperature: 0.4` and `maxOutputTokens: 1600` for the expanded JSON contract.
- [ ] Step 7: Run `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-ai-draft.service.spec.ts apps/server/src/modules/crm/sequence/crm-draft-preview.service.spec.ts apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.spec.ts`.

### Task 7: Extend Product-Line AI Writing Settings

**Files:**

- Modify `apps/server/src/modules/crm/crm.types.ts`
- Modify `apps/server/src/modules/crm/product-lines/crm-product-line-rules.ts`
- Modify `apps/server/src/modules/crm/product-lines/crm-product-line.service.spec.ts`
- Modify `src/typings/api/crm.d.ts`
- Modify `src/views/crm/settings/modules/product-line-settings.ts`
- Modify `src/views/crm/settings/modules/shared.spec.ts`
- Modify `src/views/crm/settings/modules/ProductLineFormDrawer.vue`

- [ ] Step 1: Add tests that existing configs normalize without optional fields.
- [ ] Step 2: Add tests that optional style fields trim and persist through product-line payloads.
- [ ] Step 3: Add Naive UI controls for strategy, language, tone, CTA, polish policy, proof assets, and region notes.
- [ ] Step 4: Run `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/product-lines/crm-product-line.service.spec.ts`.
- [ ] Step 5: Run `pnpm exec tsx --test src/views/crm/settings/modules/shared.spec.ts`.

### Task 8: Update Super Admin Prompt Workbench UI

**Files:**

- Modify `src/views/ai-prompt-settings/modules/shared.ts`
- Modify `src/views/ai-prompt-settings/modules/PromptStepList.vue`
- Modify `src/views/ai-prompt-settings/modules/PromptEditor.vue`
- Modify `src/views/ai-prompt-settings/modules/PromptPublishPanel.vue`
- Test `src/views/ai-prompt-settings/modules/shared.spec.ts`

- [ ] Step 1: Add grouped list helper tests for `crm_outreach`.
- [ ] Step 2: Add CRM-specific section anchors.
- [ ] Step 3: Change visible copy from AI 获客-only to AI 业务提示词.
- [ ] Step 4: Keep existing permissions and publish flow unchanged.
- [ ] Step 5: Run `pnpm exec tsx --test src/views/ai-prompt-settings/modules/shared.spec.ts`.

### Task 9: Show Prompt Module Snapshot In Review UI

**Files:**

- Modify `src/typings/api/crm.d.ts`
- Modify `src/views/crm/email-sequences/modules/DraftReviewModal.vue`
- Modify `src/views/crm/email-sequences/modules/DraftAiInfoPanel.vue`
- Modify `src/views/crm/email-sequences/modules/shared.ts`
- Test `src/views/crm/email-sequences/modules/shared.spec.ts`

- [ ] Step 1: Add tests that selected modules and public facts render into stable review rows.
- [ ] Step 2: Show module keys, module reasons, used facts, review hints, quality flags, and polish changes under the current Prompt 快照 collapse.
- [ ] Step 3: Keep the old product-line prompt snapshot visible for backward compatibility.
- [ ] Step 4: Run `pnpm exec tsx --test src/views/crm/email-sequences/modules/shared.spec.ts`.

### Task 10: Verification

**Files:**

- All files touched above.

- [ ] Step 1: Run AI gateway tests:
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-gateway/ai-prompt-validator.spec.ts apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts`
- [ ] Step 2: Run CRM AI writing tests:
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/ai-writing/crm-ai-writing-module-resolver.spec.ts apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.spec.ts apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.spec.ts apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts apps/server/src/modules/crm/crm-ai-draft.service.spec.ts`
- [ ] Step 3: Run product-line tests:
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/product-lines/crm-product-line.service.spec.ts`
- [ ] Step 4: Run frontend helper tests:
  - `pnpm exec tsx --test src/views/ai-prompt-settings/modules/shared.spec.ts src/views/crm/settings/modules/shared.spec.ts src/views/crm/email-sequences/modules/shared.spec.ts`
- [ ] Step 5: Run `pnpm typecheck` because shared frontend/backend types change.
- [ ] Step 6: Do not run `npm run build`.
- [ ] Step 7: Inspect `git status --short` and diff before commit.
- [ ] Step 8: Commit only related files with a short Chinese message, for example `feat: 完善 CRM AI 开发信方法论`.

## Rollout Plan

1. Ship prompt modules disabled only by absence of product-line AI writing config; existing non-AI template generation keeps working.
2. Publish default CRM prompt module versions from code-level drafts.
3. Test with three sample accounts:
   - procurement contact in Saudi Arabia,
   - founder in the United States,
   - unknown-title contact in Germany.
4. Compare generated drafts against review checklist:
   - Is the step theme correct?
   - Does each follow-up add a new angle?
   - Does it avoid invented facts?
   - Does subject line stay short and natural?
   - Does CTA match role and step?
   - Does second-pass polish change wording only, without adding facts or changing CTA?
5. After acceptance, enable for product lines that already have complete AI writing config.

## Self-Review

- Spec coverage: plan covers the cold-email primary methodology, avoid-ai-writing second-pass polish, Hunter/Snov.io public guidance, super-admin global maintenance, product-line customization, customer country/title context, public-source grounding, 1-5 step sequence strategy, backend composition, frontend maintenance UI, review UI, tests, and rollout.
- Placeholder scan: no implementation step depends on undefined files or deferred unspecified work.
- Type consistency: prompt keys are fixed in `ai-gateway.constants.ts`; product-line optional fields live inside the existing JSON config; generated draft metadata remains under existing `CrmAiDraftMetadata.snapshot`.
