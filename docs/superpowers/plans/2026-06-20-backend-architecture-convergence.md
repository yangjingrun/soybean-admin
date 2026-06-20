# 后端底层架构 1~5 多 Agent 并行执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development for task execution and superpowers:dispatching-parallel-agents for independent read-only or disjoint write scopes.

**Goal:** 收敛后端 Controller 鉴权、请求上下文、分页返回、权限判断和后台任务状态 helper，降低 CRM 与 AI 后续业务扩展的耦合成本。

**Architecture:** 先落共享底座，再按 CRM、AI、System 三个独立业务域迁移，最后统一复核。共享层只放稳定的纯函数和小类型，不把 CRM/AI 队列强行抽成大框架。

**Tech Stack:** NestJS, TypeScript, Node test runner, Prisma-backed business modules.

---

## Execution Waves

- Wave 0：并行只读侦察 Controller 鉴权、分页形状、权限/任务重复逻辑。
- Wave 1：主 agent 独占新增共享底座并提交。
- Wave 2：CRM、AI、System 三个业务域按 disjoint write scope 并行迁移。
- Wave 3：主 agent 集成、跑测试、复核、提交。

## Shared Contracts

- `RequestUserContext`：统一 service 层用户上下文。
- `createPageResult<T>()`：统一分页响应 `{ current, size, total, records }`。
- `permission-policy`：集中 `R_SUPER`、组织管理员、邮箱正文可见性判断。
- `task-state`：集中 `runVersion`、当前任务选择、最小 notification metadata、状态事件构造。

## Migration Rules

- 普通业务 Controller 不再解析 `Authorization`，不再注入 `AuthService` 做 token fallback。
- Controller 统一用 `@CurrentUser()` / `@CurrentContext()`。
- `auth/login`、`auth/refreshToken`、`auth/logout`、AI stream、Gmail webhook 是合理例外。
- CRM、system-user、system-log 的分页列表迁移到 `createPageResult`；AI keyword history 保持最近 N 条非分页语义。
- 不改前端 `{ code, msg, data }` 契约，不改分页字段名。

## Verification

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/shared/request-context.spec.ts \
  apps/server/src/shared/pagination.spec.ts \
  apps/server/src/shared/permission-policy.spec.ts \
  apps/server/src/shared/task-state.spec.ts

pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/auth/auth.guard.spec.ts \
  apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts \
  apps/server/src/modules/ai-leads/ai-leads.controller.spec.ts \
  apps/server/src/modules/crm/crm.controller.spec.ts \
  apps/server/src/modules/system-user/system-user.controller.spec.ts \
  apps/server/src/modules/system-log/system-log.controller.spec.ts \
  apps/server/src/modules/system-notification/system-notification.controller.spec.ts

pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/ai-leads/ai-lead-search-task.service.spec.ts \
  apps/server/src/modules/ai-leads/ai-lead-search-task-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-ai-draft-task-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-send-worker.service.spec.ts

pnpm --filter @soybean/server typecheck
git diff --check
git status --short
```
