# Module G - health probes

## References

- NestJS Terminus health checks: https://docs.nestjs.com/recipes/terminus
- Kubernetes liveness/readiness probes: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
- Spring Boot Actuator probes: https://docs.spring.io/spring-boot/reference/actuator/endpoints.html
- BullMQ graceful shutdown: https://docs.bullmq.io/guide/workers/graceful-shutdown

## Mature Pattern

- Liveness answers whether the process should be restarted.
- Readiness answers whether traffic should be routed to this process.
- Dependency checks should be lightweight and bounded; they should not run expensive business queries.
- Worker shutdown and stalled job recovery stay in BullMQ worker hosts, not in HTTP health handlers.

## Local Scope

- `apps/server/src/modules/health/health.controller.ts`
- `apps/server/src/modules/health/health.service.ts`
- `apps/server/src/modules/health/health.controller.spec.ts`
- `apps/server/src/modules/health/health.service.spec.ts`
- `apps/server/src/modules/health/health.module.ts`

## Minimum Task

- Keep `/health` compatible with the existing uptime response.
- Add `/health/live` for process liveness.
- Add `/health/ready` for database and Redis readiness.
- Return HTTP 503 from readiness when a required dependency is down, while preserving the project response envelope.
- Skip global request throttling for health probes so infrastructure polling cannot make probes fail by rate limit.

## Global Impact

- No business route, DTO, worker payload, queue name, or scheduler behavior changes.
- Deployment can point probes to `/health/live` and `/health/ready` after this step.
- This does not change the global `ApiExceptionFilter` HTTP 200 failure behavior for normal business APIs.

## Not Adopted

- Do not add `@nestjs/terminus` in this step because the project already has enough primitives for simple probes and dependency changes should stay explicit.
- Do not expose queue depth, job payloads, config values, Redis URL, or database URL in health responses.
- Do not fail readiness because a worker queue is busy; queue pressure should be an operations metric, not a request-routing blocker in this minimal step.

## Verification

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/health/health.service.spec.ts apps/server/src/modules/health/health.controller.spec.ts
pnpm --filter @soybean/server typecheck
git diff --check
```
