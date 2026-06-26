# Personal AI Model Channel Design

## Goal

Change the model channel from a platform-wide default config into a per-account config. Every logged-in account, including super administrators and organization administrators, manages and uses only its own model channel for business AI requests.

## Decisions

- The existing "模型通道" feature becomes "我的模型通道" in behavior.
- There is no platform API Key fallback for business AI requests.
- Every account can configure its own model provider, API Base, API Key, model, temperature, and max output tokens.
- AI Leads, CRM draft generation, and CRM reply draft generation must use the request user's own model channel.
- If a user has not configured a personal model channel, the request must fail with a clear business error such as "请先配置个人模型通道".
- Super administrators and organization administrators are not special for model usage. Their requests use their own keys too.
- Serper, Hunter, queue config, prompt config, and other platform configuration permissions keep their existing behavior unless explicitly changed later.

## Current Behavior

`AiModelConfig` stores a globally unique `configKey`, usually `default`. The AI settings page saves this global model config, and `AiGatewayService.generateText()` resolves `modelConfigKey || default` before calling the text generator.

That means all business AI requests can share the same backend model key. This no longer matches the product requirement.

## Data Model

Add a new model for personal model channels:

```prisma
model AiUserModelConfig {
  id              String   @id @default(uuid())
  userId          String   @unique
  providerName    String
  apiBase         String
  apiKey          String
  encryptedApiKey String?
  model           String
  temperature     Float?
  maxOutputTokens Int?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user SystemUser @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

The store should use the existing secret encryption pattern used by AI provider configs. The plaintext `apiKey` column remains only for compatibility with the current secret storage approach; new writes should store the encrypted value and keep plaintext empty.

## Backend API

Add endpoints under `AiGatewayController` for the current user:

- `GET /ai-gateway/my-model-config`
- `POST /ai-gateway/my-model-config`

These endpoints require only an authenticated request context. They do not require platform model config permissions, because every account can maintain its own model channel.

The response should use the existing secret view shape:

```ts
{
  providerName: string;
  apiBase: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  updatedAt: string;
  hasApiKey: boolean;
  maskedApiKey: string;
  apiKey?: string;
}
```

When no personal config exists, `GET` returns an editable draft with default provider values and `hasApiKey: false`.

## AI Gateway Resolution

`AiGatewayService.generateText()` must require a real user context for business calls. When no inline model config is provided, it resolves the personal model config by `context.user.userId`.

Resolution rules:

1. If the DTO includes complete inline config (`apiBase + apiKey + model`), use that inline config. This keeps explicit test/debug calls possible.
2. Otherwise, read `AiUserModelConfig` for the current user.
3. If no personal config exists or the stored API Key is empty, throw a business error that tells the user to configure their personal model channel.
4. Do not read `AiModelConfig.default` for business AI calls.

The existing platform `AiModelConfig` store can remain for compatibility while the UI and business flows move to personal configs. It should not be used as a fallback in normal AI Leads or CRM generation paths.

## Business Flow Updates

AI Leads already passes user context into the gateway in the main long-running task flow. Keep that behavior and ensure all model calls in the AI Leads path use the task owner's user context.

CRM draft generation and reply draft generation currently call `generateText()` without passing request user context in some service paths. These call chains must be updated so the controller/service receives the authenticated user and passes it into the AI gateway.

No module outside `ai-gateway` should read model API Keys directly. Business modules only call `AiGatewayService.generateText()` and let the gateway resolve the user's model channel.

## Frontend Behavior

The existing model channel tab in `src/views/ai-settings/index.vue` should become personal-model behavior:

- It is visible to every logged-in user.
- It reads from `GET /ai-gateway/my-model-config`.
- It saves to `POST /ai-gateway/my-model-config`.
- Labels should make the scope clear, for example "我的模型通道" and "用于当前账号发起的 AI 请求".
- The page should not suggest that a platform key will cover users without personal keys.

Other tabs keep their current permission checks:

- Prompt config remains platform/permission controlled.
- Serper config remains platform/permission controlled.
- Hunter config remains platform/permission controlled.
- Queue config remains platform/permission controlled.

If the page has no visible platform tabs for a normal user, the personal model tab still remains visible.

## Error Handling

Missing personal model config should produce a clear backend error. The frontend should surface the existing request error message and, where a user starts an AI workflow, avoid pretending the workflow has started when the model channel is missing.

Do not silently fall back to platform defaults. Do not catch the error and return fake success.

## Tests

Backend focused tests:

- Saving and reading a personal model config stores the key through the encrypted secret path and returns masked secret metadata.
- `generateText()` uses the current user's config when no inline config is provided.
- `generateText()` rejects when the current user has no personal config.
- `generateText()` does not read the platform default model config as fallback.
- CRM draft and reply draft service paths pass request user context into the gateway.

Frontend focused tests:

- The model settings request builders use `/ai-gateway/my-model-config`.
- The personal model tab is visible without platform model permissions.
- Platform-only tabs still respect their existing permissions.

## Migration And Compatibility

No automatic migration from the old global `AiModelConfig.default` to every user should run, because that would copy a platform-owned key into user-owned configs and contradict the new cost model.

Existing users must configure their personal model channel before using business AI features.

## Out Of Scope

- Super administrator management of other users' personal API Keys.
- Organization-level shared model keys.
- Platform default fallback.
- Usage billing dashboards.
- Provider-specific validation beyond the current OpenAI-compatible call pattern.
