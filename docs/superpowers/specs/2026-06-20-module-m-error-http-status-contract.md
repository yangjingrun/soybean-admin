# Module M - Error HTTP Status Contract

## Reference Baseline

- NestJS official exception filter docs use `exception.getStatus()` and send the response with the same HTTP status: <https://docs.nestjs.com/exception-filters>.
- OWASP REST Security recommends using standard HTTP verbs and error codes, while keeping error messages generic enough to avoid leaking internals: <https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html>.
- The project frontend request layer expects the backend business envelope `{ code, msg, data }`.

## Finding

`ApiExceptionFilter` mapped Nest exceptions to the project envelope but always sent HTTP 200. This kept old frontend business-code handling working, but it made gateways, probes, browser tooling, and Axios HTTP error paths unable to distinguish `401/403/400/500`.

The frontend already had `getRequestErrorMessage()` support for `response.data.msg`, but `getBackendErrorCode()` only read codes produced by the local Axios wrapper's synthetic backend error. Once backend errors use real non-2xx status codes, logout/modal/expired code checks must still read the envelope body.

## Adopted Shape

- Keep the response body shape unchanged: `{ code, msg, data: null }`.
- Send the real HTTP status from `HttpException.getStatus()`, with unknown errors as 500.
- Preserve the existing unauthorized business code `8888`.
- Keep unknown errors generic and do not expose stack traces.
- Let frontend error helpers read backend `code` from any Axios response body, not only synthetic backend errors.
- Mirror logout-code handling in the non-2xx `onError` path.

## Impact Boundary

- Success responses are unchanged.
- Business codes and user-facing messages are unchanged.
- Non-2xx HTTP status is now observable by clients, proxies, and monitoring.
- The frontend still reads the same envelope body and resets auth store for logout codes.

## Verification

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/shared/api-exception.filter.spec.ts
pnpm exec tsx --test src/service/request/error-message.spec.ts
pnpm --filter @soybean/server typecheck
pnpm typecheck
git diff --check
```
