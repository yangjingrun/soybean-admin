# Personal AI Model Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the model channel into a per-account configuration and make business AI requests use only the current user's model key.

**Architecture:** Add a personal AI model config store under `ai-gateway`, backed by a new Prisma model keyed by `userId`. Keep business modules dependent only on `AiGatewayService.generateText()`, and make the gateway resolve the current user's config instead of the old platform `default` config. Update the existing AI settings UI so the model tab is always visible and reads/writes the current user's config.

**Tech Stack:** NestJS, Prisma, Vue 3 `<script setup>`, Naive UI, Pinia auth permissions, node `tsx --test`, focused frontend specs.

---

## File Structure

- Modify: `prisma/schema.prisma` - add `AiUserModelConfig` and relation from `SystemUser`.
- Create: `prisma/migrations/<timestamp>_create_ai_user_model_config/migration.sql` - database table and indexes.
- Modify generated Prisma client via `pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma`.
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.types.ts` - add personal config record/store types.
- Create: `apps/server/src/modules/ai-gateway/prisma-ai-user-model-config.store.ts` - personal config persistence and secret masking.
- Create: `apps/server/src/modules/ai-gateway/prisma-ai-user-model-config.store.spec.ts` - encrypted storage and read/write tests.
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.module.ts` - register the new store.
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.tokens.ts` - add store token.
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.service.ts` - add current-user API methods and resolve personal model config for generation.
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.controller.ts` - add `/my-model-config` endpoints and keep platform endpoints for non-model tabs/history.
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts` and `ai-gateway.controller.spec.ts` - gateway behavior coverage.
- Modify: CRM services/controllers/specs that generate drafts/reply drafts so request user context reaches `generateText()`.
- Modify: `src/service/api/ai-gateway.ts`, `src/service/api/ai-gateway.shared.ts`, `src/service/api/ai-gateway.spec.ts` - add `my-model-config` request helpers.
- Modify: `src/typings/api/ai-gateway.d.ts` - add payload/view types if existing names are too platform-specific.
- Modify: `src/views/ai-settings/index.vue` and `src/views/ai-settings/modules/model-settings.ts` plus specs - make model tab personal and always visible.

## Task 1: Backend Personal Model Config Store

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_create_ai_user_model_config/migration.sql`
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.types.ts`
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.tokens.ts`
- Create: `apps/server/src/modules/ai-gateway/prisma-ai-user-model-config.store.ts`
- Create: `apps/server/src/modules/ai-gateway/prisma-ai-user-model-config.store.spec.ts`
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.module.ts`

- [ ] **Step 1: Write failing store tests**

Add focused tests that mirror the current encrypted provider config specs:

```ts
it('saves personal model config with encrypted secret storage', async () => {
  const prisma = createPrismaStub();
  const store = new PrismaAiUserModelConfigStore(prisma, createSecretCryptoService());

  const saved = await store.saveUserModelConfig({
    userId: 'u-1',
    providerName: 'openrouter',
    apiBase: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-user',
    model: 'openai/gpt-4o-mini',
    temperature: 0.3,
    maxOutputTokens: 1200,
    updatedAt: new Date().toISOString()
  });

  assert.equal(saved.apiKey, 'sk-user');
  assert.equal(prisma.aiUserModelConfig.lastUpsert.create.apiKey, '');
  assert.ok(prisma.aiUserModelConfig.lastUpsert.create.encryptedApiKey);
});
```

Also test reading decrypts `encryptedApiKey`, and that a legacy plaintext `apiKey` still resolves.

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-gateway/prisma-ai-user-model-config.store.spec.ts
```

Expected: fails because the store, Prisma model, and token do not exist.

- [ ] **Step 3: Implement the store and schema**

Add `AiUserModelConfig` to Prisma, create the SQL migration, add `AI_USER_MODEL_CONFIG_STORE`, add store interfaces, implement `PrismaAiUserModelConfigStore`, and register it in `AiGatewayModule`.

Use the existing helpers:

```ts
import { resolveStoredApiKey, toEncryptedApiKeyStorage } from './ai-config-secret-fields';
```

The store methods should be:

```ts
getUserModelConfig(userId: string): Promise<AiUserModelConfigRecord | null>;
saveUserModelConfig(record: AiUserModelConfigRecord): Promise<AiUserModelConfigRecord>;
```

- [ ] **Step 4: Generate Prisma client**

Run:

```bash
pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma
```

Expected: generated client updates include `AiUserModelConfig`.

- [ ] **Step 5: Run GREEN**

Run the store spec again. Expected: pass.

## Task 2: Gateway API And Personal Resolution

**Files:**

- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.service.ts`
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.controller.ts`
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts`
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts`
- Modify: `apps/server/src/modules/ai-gateway/dto/ai-model-config.dto.ts` if a personal DTO alias is useful.

- [ ] **Step 1: Write failing gateway tests**

Add tests for:

```ts
it('uses the current user personal model config for generation', async () => {
  const service = createServiceWithUserModelConfig({
    userId: 'u-1',
    apiBase: 'https://api.openai.com/v1',
    apiKey: 'sk-user',
    providerName: 'openai',
    model: 'gpt-4o-mini'
  });

  await service.generateText({ prompt: 'hello' }, { user: createUserContext('u-1') });

  assert.equal(textGenerator.calls[0].apiKey, 'sk-user');
});
```

Also test:

- no personal config rejects with `请先配置个人模型通道`
- platform `modelConfigStore.getModelConfig('default')` is not called
- `GET /my-model-config` and `POST /my-model-config` require login but not platform model permissions

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts
```

Expected: new tests fail.

- [ ] **Step 3: Implement service/controller behavior**

Inject `AI_USER_MODEL_CONFIG_STORE`. Add:

```ts
getMyModelConfigDraft(user: RequestUserContext): Promise<AiModelConfigViewRecord>;
saveMyModelConfig(dto: SaveAiModelConfigDto, user: RequestUserContext): Promise<AiModelConfigViewRecord>;
```

Update `resolveModelConfig()` so non-inline generation calls `getRequiredUserModelConfig(context.user)` and never falls back to `default`.

Keep old platform endpoints present for compatibility, but the AI settings frontend should move off them for the model tab.

- [ ] **Step 4: Run GREEN**

Run the gateway service/controller specs again. Expected: pass.

## Task 3: CRM AI Call Context

**Files:**

- Modify CRM controllers/services that call `CrmAiDraftService.generateDraft()` and `CrmAiReplyDraftService.polishReplyDraft()`
- Modify: `apps/server/src/modules/crm/crm-ai-draft.service.ts`
- Modify: `apps/server/src/modules/crm/crm-ai-reply-draft.service.ts`
- Modify relevant CRM specs.

- [ ] **Step 1: Write failing CRM tests**

Add or update tests so CRM draft and reply draft generation assert the request user context is passed to the gateway:

```ts
assert.deepEqual(gateway.calls[0].context.user.userId, 'u-owner');
```

- [ ] **Step 2: Run RED**

Run the focused CRM specs that cover draft generation and reply draft generation.

Expected: fail because these services currently call `generateText(dto)` without context.

- [ ] **Step 3: Thread user context through CRM generation**

Update method signatures to accept `RequestUserContext` or an existing CRM context object containing the user, and call:

```ts
this.aiGatewayService.generateText(dto, { user: contextUser });
```

Do not let CRM services read model config directly.

- [ ] **Step 4: Run GREEN**

Run the same focused CRM specs. Expected: pass.

## Task 4: Frontend Personal Model Channel

**Files:**

- Modify: `src/service/api/ai-gateway.ts`
- Modify: `src/service/api/ai-gateway.shared.ts`
- Modify: `src/service/api/ai-gateway.spec.ts`
- Modify: `src/typings/api/ai-gateway.d.ts`
- Modify: `src/views/ai-settings/modules/model-settings.ts`
- Modify: `src/views/ai-settings/modules/model-settings.spec.ts`
- Modify: `src/views/ai-settings/index.vue`

- [ ] **Step 1: Write failing frontend API/UI tests**

Update request helper specs so save/read personal model configs use:

```ts
assert.equal(config.url, '/ai-gateway/my-model-config');
```

Update model settings/tab visibility tests so the model tab does not require `ai:settings:model:read`.

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm exec tsx --test src/service/api/ai-gateway.spec.ts src/views/ai-settings/modules/model-settings.spec.ts
```

Expected: fail against old `/model-configs/default` behavior and old permission gating.

- [ ] **Step 3: Implement frontend changes**

Add `getMyAiModelConfig()` and `saveMyAiModelConfig()`. Switch `handleLoadModelConfig()` and `handleSaveModelConfig()` to the new helpers.

Set the model tab visible for all logged-in users:

```ts
model: true;
```

Keep save/test disabled only by form validity and the relevant backend ability where still needed. Since every logged-in user can maintain their own model config, personal model save should not depend on `aiSettingsModelWritePermission`.

Adjust labels/descriptions to say "我的模型通道" and "当前账号".

- [ ] **Step 4: Run GREEN**

Run the frontend focused specs again. Expected: pass.

## Task 5: Integration Verification

**Files:**

- Review all files changed by tasks 1-4.
- Update `docs/agent-memory.md` only if a new confirmed project-specific pitfall was reproduced and solved.

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-gateway/prisma-ai-user-model-config.store.spec.ts apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts
```

- [ ] **Step 2: Run focused CRM tests**

Run the CRM draft/reply focused specs changed in Task 3.

- [ ] **Step 3: Run focused frontend tests**

Run:

```bash
pnpm exec tsx --test src/service/api/ai-gateway.spec.ts src/views/ai-settings/modules/model-settings.spec.ts
```

- [ ] **Step 4: Run typecheck if touched shared DTO/context signatures require it**

Run:

```bash
pnpm --filter @soybean/server typecheck
pnpm typecheck
```

Do not run `npm run build`.

- [ ] **Step 5: Review diff and commit only related files**

Run:

```bash
git status --short
git diff --check -- <changed files>
git diff --cached --stat
```

Stage only personal model channel related files and commit with a concise Chinese message.
