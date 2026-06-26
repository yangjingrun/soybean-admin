# Module H - system log sanitizer

## References

- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- Dify observability and LLMOps pattern: https://github.com/langgenius/dify
- NestJS architecture rule: keep cross-cutting log handling centralized behind one injectable service.

## Mature Pattern

- OWASP recommends application-level event logs with enough context for operations and security, but excludes passwords, tokens, encryption keys, cookies, and sensitive personal data.
- Dify-style AI observability keeps run-level and node-level summaries, not raw provider secrets.
- This project already has a central `SystemLogService`, so the safest minimal step is to sanitize at that service boundary instead of editing every caller.

## Local Scope

- `apps/server/src/modules/system-log/system-log.service.ts`
- `apps/server/src/modules/system-log/system-log-sanitizer.ts`
- `apps/server/src/modules/system-log/system-log-sanitizer.spec.ts`
- `apps/server/src/modules/system-log/system-log.service.spec.ts`

## Minimum Task

- Extract metadata sanitization into a focused helper.
- Normalize sensitive key variants such as `api_key`, `clientSecret`, `Authorization`, `Cookie`, and token field names.
- Normalize CR/LF in log text to reduce log-injection risk.
- Keep business log taxonomy and existing callers unchanged.

## Not Adopted

- Do not add Dify-style workflow trace tables in this step; that would change storage model and product scope.
- Do not log raw AI prompts, email body text, or external provider raw responses just to improve diagnostics.

## Verification

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/system-log/system-log-sanitizer.spec.ts apps/server/src/modules/system-log/system-log.service.spec.ts
pnpm --filter @soybean/server typecheck
git diff --check
```
