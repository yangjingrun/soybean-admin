# Module L - DTO Transform Contracts

## Reference Baseline

- NestJS official validation docs use DTOs with `ValidationPipe` as the request boundary and support transformation before validation: <https://docs.nestjs.com/techniques/validation>.
- NestJS official pipes docs recommend keeping validation and transformation at the pipe/DTO boundary instead of scattering manual parsing in handlers: <https://docs.nestjs.com/pipes>.
- The project already enables global `ValidationPipe({ whitelist: true, transform: true })` in `apps/server/src/main.ts`.

## Finding

AI leads used the same `requirement` business field across keyword optimization, keyword history update, search orchestration, and background task creation. Two DTOs trimmed the field, while `SearchOrchestrateDto` and `CreateSearchTaskDto` left surrounding whitespace until the service layer.

That meant whitespace-only input could pass DTO validation on some endpoints and fail later as a service business error. The final business outcome stayed rejected, but the request boundary was inconsistent and harder to extend.

## Adopted Shape

- Add one shared DTO transformer: `trimStringValue`.
- Use it for all AI leads `requirement` DTO fields.
- Keep service-level trim and business checks as the final guard.
- Replace repeated AI gateway DTO-local `trimValue` helpers with the same shared transformer.
- Add a focused DTO test covering trim, blank requirement rejection, and numeric query transformation.

## Impact Boundary

- No route, payload field, response shape, database schema, or permission rule changes.
- The only behavior change is earlier rejection of whitespace-only `requirement` in the DTO boundary.
- AI gateway DTO behavior remains equivalent; only duplicated helper code was removed.

## Verification

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-leads/dto/ai-leads-request.dto.spec.ts
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-leads/dto/ai-leads-request.dto.spec.ts apps/server/src/modules/ai-leads/ai-leads.controller.spec.ts apps/server/src/modules/ai-leads/ai-leads.service.spec.ts apps/server/src/modules/ai-leads/ai-lead-search-task.service.spec.ts apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts
pnpm --filter @soybean/server typecheck
pnpm typecheck
git diff --check
```
