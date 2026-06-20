# Module B - AI Config Secret View Hardening

## References Used

- OWASP Secrets Management Cheat Sheet: API keys are secrets and need controlled storage/access lifecycle.
  - https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- OWASP Logging Cheat Sheet: logs and operational metadata must not include secrets such as tokens or API keys.
  - https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- Dify: mature AI products separate model management, workflows, and observability rather than exposing raw runtime secrets everywhere.
  - https://github.com/langgenius/dify
- NextChat: model provider and Mask-like presets are user-facing configuration concepts; provider secrets are input/configuration, not display data.
  - https://github.com/ChatGPTNextWeb/NextChat

## Mature Pattern

- Runtime records may contain secrets inside backend-only services.
- Public settings views return metadata and masked secret status, not raw secret values.
- Testing a provider can accept an inline key, but test responses/logs must not include the key or raw provider payload containing sensitive details.
- Saving a key and editing non-key fields should eventually be separated; this first step only blocks read-back exposure.

## Local Scope

- `apps/server/src/modules/ai-gateway/ai-gateway.types.ts`
- `apps/server/src/modules/ai-gateway/ai-gateway.service.ts`
- `apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts`
- `src/typings/api/ai-gateway.d.ts`
- `src/views/ai-settings/index.vue`

## Execution Tasks

1. Add public config view types with `hasApiKey` and `maskedApiKey`.
2. Keep backend runtime/store records unchanged so AI, Serper, and Hunter clients still receive real keys internally.
3. Convert save/get draft responses to public views before returning to controllers.
4. Keep draft defaults showing no saved key.
5. Frontend should clear key input after loading saved config and display only masked key status.
6. Disable copy-key actions that copy saved keys because the saved raw key is no longer available to the browser.

## Safety Checks

- Do not change database schema in this step.
- Do not change AI generation, Serper, Hunter runtime behavior.
- Do not log raw key or put it into response data.
- Do not silently treat an empty key as "reuse old key" yet; that needs a separate DTO/API contract step.

## Verification

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts \
  apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts

pnpm --filter @soybean/server typecheck
pnpm typecheck
git diff --check
```
