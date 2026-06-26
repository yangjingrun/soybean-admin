# Module K - AI Settings Contract Alignment

## Reference Baseline

- NestJS official validation docs recommend DTOs as the request boundary and `ValidationPipe` for payload validation/whitelisting: <https://docs.nestjs.com/techniques/validation>.
- Vue 3 official form input bindings keep form state explicit through `v-model`: <https://vuejs.org/guide/essentials/forms.html>.
- Project convention keeps frontend API payload typings in `src/typings/api` and backend DTOs in module `dto` folders.

## Finding

`SaveAiModelConfigDto` already accepts `temperature` and `maxOutputTokens`, and `AiModelConfigRecord` returns both fields. The AI settings page also had i18n labels and model test overrides, but `Api.AiGateway.SaveModelConfigPayload` and the save request omitted these two runtime options.

## Adopted Shape

- Add `temperature` and `maxOutputTokens` to `SaveModelConfigPayload`.
- Add a small request builder test for the save-model-config payload.
- Use the builder from `saveAiModelConfig` so the payload contract is testable without mocking the request layer.
- Load and save `temperature/maxOutputTokens` in the AI settings page.
- Keep backend DTO and service logic unchanged.

## Verification

```bash
pnpm exec tsx --test src/service/api/ai-gateway.spec.ts
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts
pnpm --filter @soybean/server typecheck
pnpm typecheck
git diff --check
```
