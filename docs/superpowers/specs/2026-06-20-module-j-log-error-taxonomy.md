# Module J - Log Error Taxonomy

## Reference Baseline

- NestJS official exception filter docs show centralized exception handling for `HttpException` and unknown errors: <https://docs.nestjs.com/exception-filters>.
- OWASP Logging Cheat Sheet recommends consistent event classification and sanitizing event data from other trust zones: <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>.

## Adopted Shape

- Keep the existing `SystemLog` table shape.
- Add a small shared taxonomy helper for business logs:
  - `business`
  - `external_service`
  - `permission`
  - `validation`
  - `unexpected`
- Store taxonomy fields in sanitized metadata as `errorCategory`, `errorName`, `errorCode`, `httpStatus`, and optional `retryable`.
- Do not log stack traces, prompts, email bodies, tokens, cookies, API keys, or raw upstream payloads.
- First integration targets:
  - AI Gateway text generation failures.
  - CRM send worker host failures.
  - CRM AI draft worker host failures.

## Not Adopted

- Do not change HTTP status semantics in this phase.
- Do not add a database column until querying by error category becomes a concrete product requirement.
- Do not wrap every catch block. Best-effort paths and worker event callbacks still need local business-specific behavior.

## Verification

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/system-log/system-log-error-taxonomy.spec.ts \
  apps/server/src/modules/system-log/system-log-sanitizer.spec.ts \
  apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts

pnpm --filter @soybean/server typecheck
git diff --check
```
