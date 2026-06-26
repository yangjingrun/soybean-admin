# 后端架构治理分阶段实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` for execution and `superpowers:dispatching-parallel-agents` only when write scopes are disjoint.

**Goal:** 在不改变现有业务流程和接口语义的前提下，治理后端当前几个不合理点：敏感配置明文、异常 HTTP 状态失真、API 进程和 worker 混跑、CRM 巨型模块、权限口径分散、字符串状态缺少数据库约束。

**Non-goals:** 不重写 CRM 业务流程；不改 AI 获客/CRM 邮件状态机语义；不引入新生产依赖；不运行 `npm run build`；不顺手处理无关 UI 风格问题。

**Architecture:** 先做可回归的底座和安全边界，再做全局协议类改动，最后拆 CRM 巨型模块。每个阶段都必须保持路由、DTO、响应 `{ code, msg, data }` 和数据库业务含义兼容。

**Tech Stack:** NestJS, TypeScript, Prisma, PostgreSQL, BullMQ, Vue request layer, Node test runner via `tsx`.

---

## Reference Discipline

任何阶段开始写代码前，必须先补一轮 reference audit，不允许只凭经验改：

1. 先看官方文档或成熟框架：NestJS、Prisma、BullMQ、OWASP、Spring Boot Actuator。
2. 再看成熟开源项目：Dify、MaxKB、FastGPT、NextChat/ChatGPT-Next-Web 及其二开项目。
3. 只借鉴架构边界、模块拆法、运行治理和安全策略，不直接复制业务代码。
4. 如果外部范式和本项目业务规则冲突，以本项目已确认规则为准，并在执行记录里写清楚为什么不采用。
5. 每个阶段提交前，变更说明必须包含 `References used`，列出实际参考过的链接和采用/不采用的点。

## Non-Negotiable Quality Gates

后续所有模块拆分和代码执行都必须同时满足下面三条。只要有一条不满足，就先停在设计/验证阶段，不进入实现。

### Safe

- 权限必须前后端一致，但以后端为最终边界；不能只靠前端隐藏。
- 敏感信息不能明文返回、不能写日志、不能进入任务 metadata：密码、token、apiKey、Cookie、验证码、Gmail refresh token、未经授权的邮件正文都在禁止范围内。
- 多租户和 owner 边界不能因为复用记录、查重、管理员视图、worker 后台任务而被绕过。
- 外部服务失败不能静默吞掉；能补偿的补偿，不能补偿的要有日志和用户可理解状态。
- 任务状态必须有 guard，例如 `status`、`runVersion`、`userId`、`organizationId`、`ownerUserId`，避免旧 worker 覆盖新状态。
- 数据库 migration 必须先有 preflight，不能假设线上数据一定干净。

### Mature

- 优先采用成熟框架范式：NestJS guard/filter/lifecycle、Prisma migration/transaction/index、BullMQ worker/graceful shutdown、OWASP 安全日志规范。
- 参考 Dify、MaxKB、FastGPT、NextChat 这类项目时，只借鉴模块边界和产品化治理，不照搬不适合本项目的业务代码。
- 每个模块先写 module note，再执行代码；module note 必须写清楚“不采用哪些参考做法以及原因”。
- Controller 只做入参、鉴权边界和响应组织；Service 放业务编排；Store/Repository 放持久化；Worker 只处理后台消费。
- 不为了“看起来架构化”提前抽大框架；只有复用、复杂度或风险真的需要时才抽象。
- 每个阶段都要有回滚边界，尤其是 HTTP 状态、数据库约束、密钥迁移、worker 进程分离。

### High Performance

- 高频列表和 worker claim 查询必须先核对 `where/orderBy` 与索引，再改实现。
- 队列 worker 并发必须按任务类型区分：I/O 型可以并发，AI/Gmail/Serper/Hunter 这类外部服务要考虑限流、超时和重试成本。
- 不在请求链路里做可后台化的长任务；AI 获客、批量草稿、Gmail 同步、发送调度优先走队列或可恢复任务。
- 避免 N+1 查询和大对象全量返回；CRM 列表、Inbox、系统日志、AI 任务列表要控制字段和分页。
- JSON/raw 响应只在业务明确要求展示时返回；日志和列表页默认不带大 payload。
- 定时器和 scheduler 不能在每个 API 实例重复扫描；生产环境要能拆成 API、worker、scheduler 进程。
- 任何性能优化不能牺牲租户隔离、权限校验、状态一致性和可审计性。

## Reference Matrix

| Plan area                           | Reference anchors                                                                            | How to use here                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Controller / Guard / Permission     | NestJS Guards, NestJS Validation, NestJS Rate Limiting, OWASP REST Security                  | 校准 `@CurrentContext()`、`@Roles()`、DTO 校验、限流和错误暴露边界。        |
| Exception / Error Contract          | NestJS Exception Filters, OWASP Error Handling, OWASP REST Security                          | 改 HTTP 状态时，保留业务 envelope，但不泄露内部错误细节。                   |
| Secrets / API Key                   | OWASP Secrets Management, OWASP Secure Code Review, existing Gmail encrypted token provider  | AI/Serper/Hunter key 加密存储、脱敏返回、日志不落密钥。                     |
| Queue / Worker / Scheduler          | BullMQ Workers, BullMQ Concurrency, BullMQ Graceful Shutdown, BullMQ Going to Production     | API 和 worker/scheduler 进程分离，worker 并发、关闭、stalled job 风险治理。 |
| Database / Migration / Transactions | Prisma Indexes, Prisma Transactions, Prisma Customizing Migrations, Prisma Deploy Migrations | 状态约束、索引、事务边界、生产 migration 流程。                             |
| Health / Readiness / Operations     | NestJS Terminus, NestJS Lifecycle Events, Spring Boot Actuator endpoints and probes          | 设计 liveness/readiness、依赖检查、优雅关闭和冒烟验证。                     |
| AI enterprise product patterns      | Dify, MaxKB, FastGPT, NextChat/ChatGPT-Next-Web                                              | 借鉴模型配置、工作流、日志观测、企业私有部署、Prompt/Mask/Agent 配置边界。  |
| Logging / Audit                     | OWASP Logging, OWASP Logging Vocabulary, Dify LLMOps pattern                                 | 业务日志、外部调用日志、AI 运行观测和敏感字段脱敏。                         |

Baseline reference URLs:

- NestJS Guards: https://docs.nestjs.com/guards
- NestJS Validation: https://docs.nestjs.com/techniques/validation
- NestJS Rate Limiting: https://docs.nestjs.com/security/rate-limiting
- NestJS Exception Filters: https://docs.nestjs.com/exception-filters
- NestJS Terminus: https://docs.nestjs.com/recipes/terminus
- NestJS Lifecycle Events: https://docs.nestjs.com/fundamentals/lifecycle-events
- Prisma Indexes: https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes
- Prisma Customizing Migrations: https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations
- Prisma Deploy Migrations: https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate
- BullMQ Workers: https://docs.bullmq.io/guide/workers
- BullMQ Concurrency: https://docs.bullmq.io/guide/workers/concurrency
- BullMQ Graceful Shutdown: https://docs.bullmq.io/guide/workers/graceful-shutdown
- BullMQ Going To Production: https://docs.bullmq.io/guide/going-to-production
- OWASP REST Security: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- OWASP Secrets Management: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- OWASP Logging: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- OWASP Secure Code Review: https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html
- Spring Boot Actuator Endpoints: https://docs.spring.io/spring-boot/reference/actuator/endpoints.html
- Dify: https://github.com/langgenius/dify
- MaxKB: https://github.com/1Panel-dev/MaxKB
- FastGPT: https://github.com/labring/FastGPT
- NextChat: https://github.com/ChatGPTNextWeb/NextChat

---

## Functional Module Breakdown Before Execution

执行任何代码前，先按下面颗粒度拆分。每个模块都要先补一页 module note，格式固定为：`参考来源`、`成熟项目怎么拆`、`本项目对应文件`、`最小可执行任务`、`全局影响`、`验证命令`。module note 写完并确认后，才进入代码实现。

### Module A - Auth, RBAC, And Tenant Boundary

**Reference anchors:**

- NestJS Guards / Validation / Rate Limiting
- OWASP REST Security
- Mature pattern: platform admin, organization admin, owner-only write boundaries in enterprise admin systems

**Local scope:**

- `apps/server/src/modules/auth/*`
- `apps/server/src/modules/system-user/*`
- `apps/server/src/shared/permission-policy.ts`
- CRM service owner/admin checks

**Small tasks before coding:**

1. List every `@Public()` endpoint and confirm why it is public.
2. List every `@Roles('R_SUPER')` endpoint and decide whether it should be decorator-only, helper-only, or both.
3. List CRM read/write permission groups:
   - owner-only write
   - organization-admin read
   - platform-super-admin system operation
4. Compare frontend route/menu permission with backend endpoint permission.
5. Add or update tests only after the permission table is complete.

**Do not start with:** rewriting guards or changing route permissions directly.

### Module B - AI Model, Prompt, Mask, And Provider Config

**Reference anchors:**

- Dify model management and workflow observability
- NextChat/ChatGPT-Next-Web Masks and model provider configuration
- OWASP Secrets Management

**Local scope:**

- `apps/server/src/modules/ai-gateway/*`
- `src/views/ai-settings/index.vue`
- `src/views/ai-prompt-settings/index.vue`
- `src/service/api/ai-gateway.ts`
- `src/typings/api/ai-gateway.d.ts`

**Small tasks before coding:**

1. Split public config view from runtime config:
   - public view: title, provider, base URL, model, masked key state
   - runtime view: decrypted key only inside backend service/client
2. Map current prompt keys to actual business flows:
   - keyword optimization
   - match analysis
   - email generation
   - CRM draft/reply generation if used
3. Compare NextChat Mask concept with this project:
   - Mask-like object = fixed prompt + model config + user-facing preset
   - Do not expose low-level prompt selection to ordinary business users unless product requires it.
4. Define save/edit/test behavior for API keys:
   - save new key
   - edit non-key fields without retyping key
   - test inline key without persisting
5. Only after the above is fixed, implement secret storage hardening.

**Do not start with:** adding encryption fields before deciding frontend edit behavior.

### Module C - AI Leads Search Workflow

**Reference anchors:**

- Dify workflow execution and observability
- FastGPT visual workflow / model invocation / RAG-style pipeline concepts
- BullMQ worker and job lifecycle docs

**Local scope:**

- `apps/server/src/modules/ai-leads/*`
- `src/views/ai-leads/*`
- `src/store/modules/ai-leads-task/*`

**Small tasks before coding:**

1. Draw current workflow:
   - requirement input
   - keyword optimize
   - Serper search/places
   - Hunter enrichment
   - match analysis
   - CRM import
   - notification/read state
2. Mark which steps are synchronous and which are BullMQ background jobs.
3. For each task status, record allowed transitions and owner guard:
   - queued
   - running
   - interrupted
   - failed
   - completed
   - discarded
   - read
4. Compare against Dify/FastGPT pattern:
   - workflow run record
   - node/query execution logs
   - resumable checkpoints
   - error visibility without leaking secrets
5. Only then optimize worker/runtime split or query/result logs.

**Do not start with:** changing task status fields or queue behavior before the state table is refreshed.

### Module D - CRM Lead Repository And Customer Ownership

**Reference anchors:**

- Enterprise CRM tenant/owner isolation pattern
- Prisma indexes, unique constraints, transactions
- OWASP data minimization guidance

**Local scope:**

- `apps/server/src/modules/crm/crm.service.ts`
- `apps/server/src/modules/crm/store/prisma-crm.store.ts`
- `apps/server/src/modules/crm/crm.types.ts`
- `src/views/crm/leads/*`
- `prisma/schema.prisma`

**Small tasks before coding:**

1. List CRM core entities and ownership:
   - Account
   - Contact
   - TimelineEvent
   - ArchivedFingerprint
   - Blacklist
2. Confirm uniqueness scope:
   - member private record: organizationId + ownerUserId + domain/emailHash
   - archived fingerprint: organization-level reminder only
3. List all import paths:
   - AI leads import
   - manual import
   - restore/archive
4. Check list/detail queries against indexes.
5. Split service/store only after entity ownership map is complete.

**Do not start with:** splitting `CrmService` by file size alone.

### Module E - CRM Outreach Sequence, Draft Review, And Send Queue

**Reference anchors:**

- BullMQ workers, concurrency, graceful shutdown
- Dify workflow run/node execution pattern
- Mature CRM sequence pattern: enrollment, message, draft review, send claim, follow-up generation

**Local scope:**

- `apps/server/src/modules/crm/crm-send-*`
- `apps/server/src/modules/crm/crm-ai-draft-*`
- `apps/server/src/modules/crm/crm-sequence-policy.ts`
- CRM sequence/draft parts in `crm.service.ts` and `prisma-crm.store.ts`
- `src/views/crm/email-sequences/*`

**Small tasks before coding:**

1. Draw sequence state machine:
   - draft review pending
   - ready to send
   - sequence running
   - stopped
   - completed
2. Draw message state machine:
   - draft pending review
   - draft ready
   - queued
   - sent
   - failed
   - skipped
3. Identify transaction boundaries:
   - create review item
   - approve draft
   - start send
   - worker claim
   - complete/fail send
   - generate next draft
4. Compare BullMQ pattern:
   - producer only enqueues
   - worker claims before side effects
   - close workers gracefully
   - stale jobs invalidated by runVersion
5. Then implement runtime-role split or module split.

**Do not start with:** moving methods out of `CrmService` before transaction boundaries are named.

### Module F - Gmail Integration And Inbox

**Reference anchors:**

- Google/Gmail integration as external provider pattern
- BullMQ retry/idempotency pattern
- OWASP secrets/logging guidance

**Local scope:**

- `apps/server/src/modules/crm/crm-gmail-*`
- `apps/server/src/modules/crm/crm-email-send.gateway.ts`
- CRM inbox methods/types/store
- `src/views/crm/inbox/*`

**Small tasks before coding:**

1. Split Gmail functions:
   - OAuth
   - token storage/decryption
   - watch renewal
   - Pub/Sub webhook
   - history sync
   - send gateway
   - inbox ingest
2. Define idempotency keys:
   - providerMessageId
   - providerThreadId
   - mailboxId
   - historyId
3. Define which errors expire authorization and which are transient.
4. Confirm no token/email body leaks into logs.
5. Only then change worker split, timeout, retry, or health checks.

**Do not start with:** broad Gmail refactor while real Gmail test environment is unavailable.

### Module G - Runtime, Queue, Scheduler, And Process Topology

**Reference anchors:**

- BullMQ workers/concurrency/graceful shutdown/production
- NestJS lifecycle events
- Spring Boot Actuator liveness/readiness model

**Local scope:**

- `apps/server/src/modules/app-config/*`
- Worker host files
- Scheduler/timer host files
- `apps/server/src/modules/health/*`
- deployment docs

**Small tasks before coding:**

1. List all process roles:
   - api
   - worker
   - scheduler
   - all for local dev
2. List every host started from `onModuleInit`.
3. Decide which role owns each host:
   - BullMQ worker -> worker
   - scheduled scanner/renewal/slimming -> scheduler
   - queue producer/controller -> api
4. Define env contract before code:
   - `SERVER_RUNTIME_ROLE`
   - default value
   - invalid value behavior
5. Add tests for config parsing before changing hosts.
6. Change hosts one group at a time.

**Do not start with:** injecting config into hosts before the role-to-host table is written.

### Module H - Observability, Logs, And Admin Diagnostics

**Reference anchors:**

- Dify observability / workflow logs
- OWASP Logging
- Enterprise admin audit-log pattern

**Local scope:**

- `apps/server/src/modules/system-log/*`
- all AI/CRM external-call services
- worker host error callbacks
- admin log frontend pages

**Small tasks before coding:**

1. Define log taxonomy:
   - config change
   - external service call
   - permission denied
   - worker runtime failure
   - job business failure
   - security-sensitive event
2. Define banned log fields:
   - password
   - token
   - apiKey
   - cookie
   - raw email body unless explicitly allowed
3. Compare Dify-style workflow logs:
   - run-level summary
   - node/query-level detail
   - user-safe error message
4. Add tests for sensitive metadata only where risk is high.

**Do not start with:** dumping more metadata into logs for convenience.

### Module I - Database, Migrations, And Data Quality

**Reference anchors:**

- Prisma indexes and migrations
- PostgreSQL CHECK constraints
- Enterprise migration preflight/rollback pattern

**Local scope:**

- `prisma/schema.prisma`
- `prisma/migrations/*`
- generated Prisma client
- store specs

**Small tasks before coding:**

1. List state fields and allowed values.
2. Run preflight SQL for dirty values before adding constraints.
3. List high-frequency queries and current indexes.
4. Decide whether to use:
   - DB check constraint
   - Prisma enum
   - application-only constant
5. Only add migrations with a rollback/preflight note.

**Do not start with:** enum conversion before validating existing data.

### Module J - Frontend-Backend Contract And Error UX

**Reference anchors:**

- NestJS exception filters
- OWASP REST error handling
- mature admin-template request envelope pattern

**Local scope:**

- `packages/shared/src/*`
- `src/service/request/*`
- `src/service/api/*`
- `src/typings/api/*`
- backend controllers/DTOs

**Small tasks before coding:**

1. Map current envelope:
   - success code
   - logout code
   - validation error
   - forbidden
   - unknown error
2. Decide whether HTTP status change is needed now or later.
3. If changing HTTP status, update frontend request error branch first in tests.
4. Compare each changed DTO with frontend payload.
5. Keep route behavior and UI messages stable unless explicitly changing UX.

**Do not start with:** changing `ApiExceptionFilter` before request-layer tests exist.

---

## Current Hotspots

- `apps/server/src/modules/crm/crm.service.ts` 约 5934 行，`store/prisma-crm.store.ts` 约 5122 行，`crm.service.spec.ts` 约 8128 行：CRM 是最大耦合点，不能大爆炸式重构。
- `AiModelConfig`、`SerperConfig`、`HunterConfig` 的 `apiKey` 在 Prisma schema、store、service、前端 `/ai-settings` 中明文读写。
- `apps/server/src/shared/api-exception.filter.ts` 把所有异常都 `response.status(200)`，这会影响网关、监控、Axios error 分支和登录过期处理。
- `CrmSendWorkerHost`、`CrmSendSchedulerHost`、`CrmGmailHistorySyncWorkerHost`、`CrmAiDraftTaskWorkerHost`、`AiLeadSearchTaskWorkerHost` 等在 API 进程启动时直接注册 worker/timer，多实例部署会重复消费或重复扫描。
- CRM 和 AI task 已有 `runVersion`/guard 经验，后续拆分时不能破坏旧 worker 不覆盖新状态的规则。
- `CrmSequenceEnrollment.status`、`CrmMessage.status`、`AiLeadSearchTask.status`、`AiLeadSearchTaskQuery.status` 等仍是 `String`，状态合法性靠应用层约束。

---

## Phase 0 - Baseline Audit And Guard Rails

**Purpose:** 先把变更边界和回归入口固定下来，避免后面阶段互相污染。

**Files to read/check:**

- `docs/agent-memory.md`
- `apps/server/src/modules/app.module.ts`
- `apps/server/src/modules/app-config/app-config.loader.ts`
- `apps/server/src/modules/ai-gateway/*`
- `apps/server/src/modules/ai-leads/*task*`
- `apps/server/src/modules/crm/crm.module.ts`
- `apps/server/src/modules/crm/crm.controller.ts`
- `apps/server/src/modules/crm/crm.service.ts`
- `apps/server/src/modules/crm/crm.types.ts`
- `apps/server/src/modules/crm/store/prisma-crm.store.ts`
- `apps/server/src/shared/api-exception.filter.ts`
- `src/service/request/index.ts`
- `src/service/api/ai-gateway.ts`
- `src/views/ai-settings/index.vue`
- `prisma/schema.prisma`

**Work items:**

1. Record current line counts and dependency hotspots with `wc -l` and targeted `rg`.
2. Capture current API response contract: success code, logout code `8888`, frontend request error branch.
3. Capture current worker hosts and timers.
4. Capture current Prisma status fields and API key fields.
5. Confirm working tree is clean or identify unrelated dirty files before any code edit.

**Verification:**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/shared/api-exception.filter.spec.ts \
  apps/server/src/shared/permission-policy.spec.ts

pnpm --filter @soybean/server typecheck
git diff --check
```

---

## Phase 1 - Secret Storage Hardening

**Purpose:** AI 模型、Serper、Hunter 的密钥不再作为普通明文字段返回前端或直接明文持久化。Gmail refresh token 已经有加密经验，应抽成共享能力，而不是复制一套。

**Primary files:**

- `apps/server/src/modules/crm/crm-gmail-oauth-token.provider.ts`
- `apps/server/src/shared/secret-crypto.ts` new
- `apps/server/src/shared/secret-crypto.spec.ts` new
- `apps/server/src/modules/ai-gateway/ai-gateway.types.ts`
- `apps/server/src/modules/ai-gateway/ai-gateway.service.ts`
- `apps/server/src/modules/ai-gateway/prisma-ai-model-config.store.ts`
- `apps/server/src/modules/ai-gateway/prisma-serper-config.store.ts`
- `apps/server/src/modules/ai-gateway/prisma-hunter-config.store.ts`
- `apps/server/src/modules/ai-gateway/*config.store.spec.ts`
- `apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts`
- `apps/server/src/modules/app-config/app-config.loader.ts`
- `prisma/schema.prisma`
- `prisma/migrations/*/migration.sql`
- `src/service/api/ai-gateway.ts`
- `src/typings/api/ai-gateway.d.ts`
- `src/views/ai-settings/index.vue`

**Planned shape:**

1. Extract Gmail AES-GCM helper into `shared/secret-crypto.ts`; keep Gmail behavior identical.
2. Add encrypted DB columns for AI/Serper/Hunter config, for example `encryptedApiKey`.
3. Service/store internal records may still expose `apiKey` to runtime clients, but controller-facing view records must expose masked state, for example `hasApiKey`/`maskedApiKey`, not raw key.
4. Save endpoints accept a new key; edit endpoints should not require retyping an existing key when only title/base/model changes.
5. Test endpoints can still accept an inline key and never persist it.
6. Logs must continue excluding raw keys.

**Global impact:**

- Frontend `/ai-settings` currently copies and pre-fills `record.apiKey`; this must change to masked display plus "replace key" behavior.
- AI leads, Serper, Hunter clients still need decrypted key internally; runtime type and public API type must be separated.
- Prisma generate is required if schema changes.
- Existing plaintext data needs an explicit migration/backfill path. Before adding `NOT NULL` constraints, check existing rows.

**Preflight SQL/check:**

```sql
select count(*) from "AiModelConfig" where "apiKey" is not null and "apiKey" <> '';
select count(*) from "SerperConfig" where "apiKey" is not null and "apiKey" <> '';
select count(*) from "HunterConfig" where "apiKey" is not null and "apiKey" <> '';
```

**Verification:**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/shared/secret-crypto.spec.ts \
  apps/server/src/modules/crm/crm-gmail-oauth-token.provider.spec.ts \
  apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts \
  apps/server/src/modules/ai-gateway/prisma-ai-model-config.store.spec.ts \
  apps/server/src/modules/ai-gateway/prisma-serper-config.store.spec.ts \
  apps/server/src/modules/ai-gateway/prisma-hunter-config.store.spec.ts \
  apps/server/src/modules/ai-gateway/serper-client.service.spec.ts \
  apps/server/src/modules/ai-gateway/hunter-client.service.spec.ts

pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma
pnpm --filter @soybean/server typecheck
pnpm typecheck
git diff --check
```

**Rollback boundary:** If frontend UX is not ready, do not remove old plaintext columns in the same stage. First stage can write encrypted fields and stop returning raw key; cleanup old columns in a later migration.

---

## Phase 2 - Runtime Role Separation For API, Workers, And Schedulers

**Purpose:** API 进程不应该默认启动所有 BullMQ worker 和定时器。多实例部署时，重复 worker/timer 是高风险。

**Primary files:**

- `apps/server/src/modules/app-config/app-config.loader.ts`
- `apps/server/src/modules/app-config/app-config.loader.spec.ts`
- `apps/server/src/modules/crm/crm.module.ts`
- `apps/server/src/modules/crm/crm-send-worker-host.service.ts`
- `apps/server/src/modules/crm/crm-send-scheduler-host.service.ts`
- `apps/server/src/modules/crm/crm-gmail-history-sync-worker-host.service.ts`
- `apps/server/src/modules/crm/crm-ai-draft-task-worker-host.service.ts`
- `apps/server/src/modules/crm/crm-gmail-watch-renewal.service.ts`
- `apps/server/src/modules/crm/crm-archive-slimming.service.ts`
- `apps/server/src/modules/ai-leads/ai-lead-search-task-worker-host.service.ts`
- `apps/server/src/modules/ai-leads/ai-leads.module.ts`
- `docs/crm-gmail-deployment-checklist.md`

**Planned shape:**

1. Add explicit runtime role config, for example `SERVER_RUNTIME_ROLE=api|worker|scheduler|all`.
2. Keep local dev compatible with current behavior by documenting `all` for single-process local runs.
3. Worker hosts should no-op when role does not include `worker`.
4. Scheduler/renewal/slimming hosts should no-op when role does not include `scheduler`.
5. Queue producers stay available in API role; endpoints should still enqueue jobs.
6. Record a startup log showing active role and enabled hosts without leaking env secrets.

**Global impact:**

- `@Optional()` worker injection in task services must still work when worker host is disabled.
- AI leads and CRM queue services must remain usable from API-only process.
- Deployment docs/scripts need to tell operators to run separate worker/scheduler processes.

**Verification:**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/app-config/app-config.loader.spec.ts \
  apps/server/src/modules/ai-leads/ai-lead-search-task-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-send-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-send-scheduler.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-ai-draft-task-worker.service.spec.ts

pnpm --filter @soybean/server typecheck
git diff --check
```

**Rollback boundary:** This phase must not change job payloads, queue names, runVersion semantics, or task status transitions.

---

## Phase 3 - HTTP Status Semantics

**Purpose:** 后端应返回真实 HTTP 状态，同时保持业务 envelope `{ code, msg, data }`，让监控、代理、浏览器和 Axios error branch 能正确识别失败。

**Primary files:**

- `apps/server/src/shared/api-exception.filter.ts`
- `apps/server/src/shared/api-exception.filter.spec.ts`
- `src/service/request/index.ts`
- `src/service/request/error-message.ts`
- `src/service/request/error-message.spec.ts`
- `packages/axios/src/index.ts`
- `packages/axios/src/options.ts`
- `packages/shared/src/index.ts`
- Auth/logout affected files under `src/store/modules/auth`, `src/router/guard`, and `src/service/api/auth.ts` if current request flow depends on 200-only errors.

**Planned shape:**

1. Change exception filter to `response.status(status).send(fail(code, msg, null))`.
2. Preserve code mapping: 401 remains business code `8888`; 403 remains `403`; validation remains `400`.
3. Update frontend request layer so Axios non-2xx responses still read backend envelope and show `msg`.
4. Ensure logout/modal/expired-token logic still sees business code from error response body.
5. Keep stream endpoints and health endpoints behavior explicit.

**Global impact:**

- This is the highest global blast-radius phase. Every API failure now enters Axios error branch instead of success response branch.
- Existing request helper tests must cover 400/401/403/500 with envelope body.
- Frontend pages that catch `Error.message` may display different text if error-message helper is wrong.
- External integrations or devtools scripts expecting HTTP 200 for all business failures need updating.

**Verification:**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/shared/api-exception.filter.spec.ts \
  apps/server/src/modules/auth/auth.controller.spec.ts \
  apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts \
  apps/server/src/modules/system-user/system-user.controller.spec.ts \
  apps/server/src/modules/crm/crm.controller.spec.ts

pnpm exec tsx --test \
  src/service/request/error-message.spec.ts \
  src/service/request/business-error.spec.ts \
  src/service/api/ai-gateway.spec.ts \
  src/service/api/ai-leads.spec.ts

pnpm --filter @soybean/server typecheck
pnpm typecheck
git diff --check
```

**Rollback boundary:** If frontend request compatibility is not fully verified, do not merge this phase. It should be a standalone commit/PR because it changes global runtime behavior.

---

## Phase 4 - CRM Module Decomposition

**Purpose:** 把 CRM 巨型 Controller/Service/Store 拆成高内聚业务切片，但不改变路由、DTO、权限和状态机。

**Execution strategy:** 三步走，避免大爆炸。

### Phase 4A - Controller Split Only

**Files:**

- `apps/server/src/modules/crm/crm.controller.ts`
- New controller files such as:
  - `crm-leads.controller.ts`
  - `crm-settings.controller.ts`
  - `crm-mailbox.controller.ts`
  - `crm-sequence.controller.ts`
  - `crm-inbox.controller.ts`
  - `crm-ai-draft-task.controller.ts`
- `apps/server/src/modules/crm/crm.module.ts`
- `apps/server/src/modules/crm/crm.controller.spec.ts`

**Rules:**

- Keep route paths unchanged.
- New controllers may still inject existing `CrmService`.
- Extract context helpers only when reused.
- Do not move service logic yet.

**Impact:** Low-medium. Main risk is route decorator/path mismatch and test setup updates.

### Phase 4B - Service Facade Split

**Files:**

- `apps/server/src/modules/crm/crm.service.ts`
- New services such as:
  - `crm-account.service.ts`
  - `crm-settings.service.ts`
  - `crm-mailbox.service.ts`
  - `crm-sequence.service.ts`
  - `crm-inbox.service.ts`
  - `crm-workbench.service.ts`
- `apps/server/src/modules/crm/crm.service.spec.ts`
- Worker services that call CRM service methods.

**Rules:**

- Move one cohesive method group at a time.
- Keep existing public API surface until callers migrate.
- Owner-only operations, org-admin read scope, runVersion guards, blacklist checks, and transaction boundaries must stay exactly where the business rule requires them.
- Service methods that mutate multiple tables should still call existing transaction store methods; do not split transactions across services.

**Impact:** High. The fake store in `crm.service.spec.ts` must be updated whenever a store method signature moves or changes.

### Phase 4C - Store Interface Split

**Files:**

- `apps/server/src/modules/crm/crm.types.ts`
- `apps/server/src/modules/crm/store/prisma-crm.store.ts`
- New store slices under `apps/server/src/modules/crm/store/`
- `apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`
- All CRM worker specs and service fake store setup.

**Possible slices:**

- `CrmAccountStore`
- `CrmContactStore`
- `CrmMailboxStore`
- `CrmSequenceStore`
- `CrmInboxStore`
- `CrmConfigStore`
- `CrmAiDraftTaskStore`
- `CrmAuditStore`

**Rules:**

- Start by splitting TypeScript interfaces and provider tokens; implementation can initially be one class that implements multiple interfaces.
- Only split Prisma implementation files once interfaces are stable.
- Transaction methods stay grouped by business transaction, not by table.
- Do not change Prisma queries just to make files pretty.

**Impact:** Very high. This touches most CRM tests and every worker using `CrmStore`.

**CRM verification pack:**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/crm.service.spec.ts \
  apps/server/src/modules/crm/crm.controller.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm.store.spec.ts \
  apps/server/src/modules/crm/crm-send-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-send-scheduler.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-ai-draft-task-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-watch.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-watch-renewal.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-webhook.service.spec.ts

pnpm --filter @soybean/server typecheck
git diff --check
```

---

## Phase 5 - Permission Policy Standardization

**Purpose:** 已经抽了 `requireSuperUserContext`，下一步应统一平台超管、组织管理员、owner-only 写操作的表达方式，减少 controller 和 service 分散判断。

**Primary files:**

- `apps/server/src/shared/permission-policy.ts`
- `apps/server/src/shared/permission-policy.spec.ts`
- `apps/server/src/modules/ai-gateway/ai-gateway.controller.ts`
- `apps/server/src/modules/ai-leads/ai-leads.controller.ts`
- `apps/server/src/modules/system-user/system-user.controller.ts`
- `apps/server/src/modules/system-log/system-log.controller.ts`
- `apps/server/src/modules/crm/*controller.ts`
- `apps/server/src/modules/crm/crm.service.ts`

**Planned shape:**

1. Keep `@Roles('R_SUPER')` on platform-level controllers.
2. Use shared helper for controller context normalization.
3. Keep service-layer owner-only writes for CRM draft/save/approve/send operations.
4. Add tests for org admin read vs owner-only write where missing.

**Global impact:** Medium. Permission changes are user-visible; never merge with CRM file splitting unless tests prove route behavior is identical.

**Verification:**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/shared/permission-policy.spec.ts \
  apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts \
  apps/server/src/modules/ai-leads/ai-leads.controller.spec.ts \
  apps/server/src/modules/system-user/system-user.controller.spec.ts \
  apps/server/src/modules/system-log/system-log.controller.spec.ts \
  apps/server/src/modules/crm/crm.controller.spec.ts \
  apps/server/src/modules/crm/crm.service.spec.ts
```

---

## Phase 6 - Database Status Constraints

**Purpose:** 把核心状态机的合法值落到数据库约束，避免未来绕过 service 的写入留下脏状态。

**Primary files:**

- `prisma/schema.prisma`
- `prisma/migrations/*/migration.sql`
- `apps/server/src/modules/ai-leads/ai-lead-search-task-state.ts`
- `apps/server/src/modules/crm/crm-ai-draft-task-state.ts`
- `apps/server/src/modules/crm/crm.types.ts`
- `apps/server/src/modules/crm/crm-sequence-policy.ts`
- Store/service tests for affected states.

**Planned shape:**

1. Prefer Postgres `CHECK` constraints in migration SQL for first pass; avoid broad Prisma enum migration until status taxonomy is stable.
2. Add preflight queries to find invalid existing rows before constraints.
3. Constrain the most dangerous tables first:
   - `AiLeadSearchTask.status`
   - `AiLeadSearchTaskQuery.status`
   - `CrmSequenceEnrollment.status`
   - `CrmMessage.status`
   - `CrmAiDraftTask.status`
   - `CrmAiDraftTaskItem.status`
4. Keep TypeScript status constants as the source for tests; do not duplicate values manually in multiple files without a test.

**Global impact:**

- Migration can fail if existing DB has dirty values.
- Worker retry/compensation paths must use allowed statuses.
- No frontend changes expected unless status labels include unknown fallback.

**Preflight SQL/check:**

```sql
select status, count(*) from "AiLeadSearchTask" group by status;
select status, count(*) from "AiLeadSearchTaskQuery" group by status;
select status, count(*) from "CrmSequenceEnrollment" group by status;
select status, count(*) from "CrmMessage" group by status;
```

**Verification:**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/ai-leads/ai-lead-search-task-state.spec.ts \
  apps/server/src/modules/ai-leads/ai-lead-search-task.service.spec.ts \
  apps/server/src/modules/ai-leads/ai-lead-search-task-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-ai-draft-task-state.spec.ts \
  apps/server/src/modules/crm/crm.service.spec.ts \
  apps/server/src/modules/crm/store/prisma-crm.store.spec.ts \
  apps/server/src/modules/crm/crm-send-worker.service.spec.ts \
  apps/server/src/modules/crm/crm-ai-draft-task-worker.service.spec.ts

pnpm --filter @soybean/server typecheck
git diff --check
```

---

## Recommended Order

1. Phase 0: baseline audit.
2. Phase 1: secret storage hardening.
3. Phase 2: runtime role separation.
4. Phase 5: permission policy standardization.
5. Phase 6: database status constraints.
6. Phase 7: logging, audit, and error taxonomy.
7. Phase 8: DTO and frontend-backend contract audit.
8. Phase 9: database query, index, and transaction audit.
9. Phase 10: deployment, rollback, and smoke verification.
10. Phase 11: security, rate limit, and abuse boundary audit.
11. Phase 12: external-call resilience and health readiness.
12. Phase 3: HTTP status semantics.
13. Phase 4A: CRM controller split.
14. Phase 4B: CRM service facade split.
15. Phase 4C: CRM store interface split.

Reason: secret/runtime/permission/DB constraints can be tested in smaller scopes. Logging, contract, DB, deployment, security, and readiness audits strengthen the safety net before the two most dangerous changes. HTTP status and CRM split have the largest global blast radius, so they should only start after the test baseline is stronger.

---

## Phase 7 - Logging, Audit, And Error Taxonomy

**Purpose:** 让关键业务动作、配置变更、外部服务调用、worker 失败、权限异常都有可追踪日志，同时避免把密码、token、apiKey、邮件正文等敏感内容写入日志。

**Primary files:**

- `apps/server/src/modules/system-log/system-log.service.ts`
- `apps/server/src/modules/system-log/system-log.types.ts`
- `apps/server/src/modules/ai-gateway/ai-gateway.service.ts`
- `apps/server/src/modules/ai-leads/*service.ts`
- `apps/server/src/modules/crm/*service.ts`
- `apps/server/src/modules/crm/*worker*.ts`
- `apps/server/src/shared/api-exception.filter.ts`

**Planned shape:**

1. Define a small error taxonomy for business failure, external-service failure, permission failure, validation failure, and unexpected failure.
2. Check AI gateway, AI leads, CRM send, Gmail sync, system-user, auth paths for missing business logs.
3. Keep log metadata minimal and sanitized.
4. Do not swallow errors after logging unless the business rule explicitly allows best-effort behavior.
5. Add tests around log metadata for sensitive paths where practical.

**Global impact:**

- System logs are user/admin-visible operational data; wording and metadata shape must stay useful.
- Worker event callbacks still need to guard logging failures to avoid unhandled errors.
- This phase should not change returned API behavior.

**Verification:**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/system-log/system-log.service.spec.ts \
  apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts \
  apps/server/src/modules/ai-leads/ai-lead-search-task.service.spec.ts \
  apps/server/src/modules/crm/crm.service.spec.ts \
  apps/server/src/modules/crm/crm-send-worker.service.spec.ts

pnpm --filter @soybean/server typecheck
git diff --check
```

---

## Phase 8 - DTO And Frontend-Backend Contract Audit

**Purpose:** 防止前端 payload、共享类型、后端 DTO、服务端预期字段、响应结构漂移。这个项目里 AI、auth、CRM 一旦契约漂移，页面通常不会立刻编译失败，而是运行时失败。

**Primary files:**

- `packages/shared/src/*`
- `src/service/api/*.ts`
- `src/typings/api/*.d.ts`
- `src/service/request/index.ts`
- `apps/server/src/modules/*/dto/*.ts`
- `apps/server/src/modules/*/*.controller.ts`
- `apps/server/src/modules/*/*.service.ts`

**Planned shape:**

1. For each touched module, compare frontend request payload with backend DTO.
2. Compare response body with frontend `Api.*` typings.
3. Keep shared types only for truly shared contracts; do not move every module-private type into `packages/shared`.
4. Add small builder/helper tests for complex frontend request builders.
5. Check i18n/user-facing error text only when this phase touches frontend copy.

**Global impact:**

- AI settings, AI leads, CRM, auth, system-user are all contract-sensitive.
- If Phase 1 changes API key view model, this phase must update frontend typings and page logic in the same commit.
- If Phase 3 changes HTTP status flow, request helper contract tests must be included.

**Verification:**

```bash
pnpm exec tsx --test \
  src/service/api/ai-gateway.spec.ts \
  src/service/api/ai-leads.spec.ts \
  src/service/request/error-message.spec.ts

pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts \
  apps/server/src/modules/ai-leads/ai-leads.controller.spec.ts \
  apps/server/src/modules/crm/crm.controller.spec.ts \
  apps/server/src/modules/system-user/system-user.controller.spec.ts

pnpm --filter @soybean/server typecheck
pnpm typecheck
git diff --check
```

---

## Phase 9 - Database Query, Index, And Transaction Audit

**Purpose:** 检查高频列表、worker claim、任务恢复、CRM owner/org 隔离查询是否有合适索引和事务边界。这个阶段只做性能和一致性治理，不改业务语义。

**Primary files:**

- `prisma/schema.prisma`
- `prisma/migrations/*/migration.sql`
- `apps/server/src/modules/crm/store/prisma-crm.store.ts`
- `apps/server/src/modules/ai-leads/prisma-ai-lead-search-task.store.ts`
- `apps/server/src/modules/system-log/system-log.service.ts`
- `apps/server/src/modules/system-notification/store/prisma-system-notification.store.ts`

**Planned shape:**

1. List high-frequency queries: CRM lead list/detail, inbox list/detail, sequence review, workbench overview, AI task current/restore, notifications.
2. Check each query's `where/orderBy` against existing indexes.
3. Keep owner/org isolation indexes aligned with privacy rules.
4. Keep transactional methods grouped around business invariants: draft create/approve, send start/stop, worker claim, Gmail reply ingest, AI task status updates.
5. Add migrations only for proven missing indexes or constraints.

**Global impact:**

- Index migrations can lock or slow large tables; deployment needs a safe window if data grows.
- Query optimization must not weaken organization/owner filters.
- Generated Prisma changes are expected only when schema changes; do not hand-edit generated client.

**Verification:**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/crm/store/prisma-crm.store.spec.ts \
  apps/server/src/modules/crm/crm.service.spec.ts \
  apps/server/src/modules/ai-leads/ai-lead-search-task.service.spec.ts \
  apps/server/src/modules/ai-leads/ai-lead-search-task-worker.service.spec.ts \
  apps/server/src/modules/system-notification/system-notification.service.spec.ts

pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma
pnpm --filter @soybean/server typecheck
git diff --check
```

---

## Phase 10 - Deployment, Rollback, And Smoke Verification

**Purpose:** 每个架构阶段都要能上线、能回滚、能快速判断是否坏了，而不是只在本地测试通过。

**Primary files:**

- `docs/crm-gmail-deployment-checklist.md`
- `docs/ai-crm-handoff-v2.md`
- `docs/agent-memory.md` only after a verified new pitfall is solved
- Deployment scripts or env docs if present

**Planned shape:**

1. For schema phases, write migration preflight and rollback note.
2. For runtime-role phase, document API/worker/scheduler process split.
3. For secret phase, document key migration and masking behavior.
4. For HTTP status phase, document changed failure behavior for frontend and API clients.
5. Define a smoke checklist:
   - login and get user info
   - AI settings read/save/test
   - AI leads task create/interrupt/resume/read
   - CRM lead list/detail
   - CRM draft approve/send queue path without real Gmail dependency when unavailable
   - system log list

**Global impact:**

- This phase may update docs only, but it is required before merging Phase 3 or Phase 4.
- Do not write unverified assumptions into `docs/agent-memory.md`; only append confirmed pitfalls after reproducing and fixing.

**Verification:**

```bash
git diff --check
git status --short
```

---

## Phase 11 - Security, Rate Limit, And Abuse Boundary Audit

**Purpose:** 检查认证、授权、限流、CORS、验证码、登录锁定、敏感数据返回这些安全边界是否符合生产后端基本线。这个阶段只收敛边界，不改业务策略。

**Primary files:**

- `apps/server/src/main.ts`
- `apps/server/src/modules/app.module.ts`
- `apps/server/src/modules/auth/auth.controller.ts`
- `apps/server/src/modules/auth/auth.guard.ts`
- `apps/server/src/modules/auth/auth.service.ts`
- `apps/server/src/modules/auth/roles.guard.ts`
- `apps/server/src/modules/system-user/system-user.service.ts`
- `apps/server/src/modules/ai-gateway/ai-gateway.controller.ts`
- `apps/server/src/modules/ai-leads/ai-leads.controller.ts`
- `apps/server/src/modules/crm/crm.controller.ts`
- `apps/server/src/shared/permission-policy.ts`

**Planned shape:**

1. Verify global `ValidationPipe` options and DTO validation coverage.
2. Review `@Public()` usage and controller-level `@Roles()` usage.
3. Verify throttling is applied to login, captcha-sensitive, AI generation, AI leads task creation, and expensive CRM operations.
4. Review CORS origin behavior and credentials use.
5. Ensure API responses never return password hash, token hash, refresh token, raw apiKey, full secret, or unauthorized email body.
6. Check auth session revocation, user lock/disable, and expired account behavior.

**Global impact:**

- Too aggressive throttling can break real users; too weak throttling can let expensive AI/search endpoints be abused.
- CORS changes can break local dev and deployment; keep origins explicit and documented.
- Permission changes must be covered by controller/service tests.

**Verification:**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/auth/auth.guard.spec.ts \
  apps/server/src/modules/auth/auth.service.spec.ts \
  apps/server/src/modules/auth/auth.controller.spec.ts \
  apps/server/src/modules/system-user/system-user.service.spec.ts \
  apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts \
  apps/server/src/modules/ai-leads/ai-leads.controller.spec.ts \
  apps/server/src/modules/crm/crm.controller.spec.ts \
  apps/server/src/modules/crm/crm.service.spec.ts

pnpm --filter @soybean/server typecheck
git diff --check
```

---

## Phase 12 - External-Call Resilience And Health Readiness

**Purpose:** 外部服务调用和进程生命周期要可控：AI、Serper、Hunter、Gmail、Redis、PostgreSQL、BullMQ 不能无限挂起；健康检查要能区分进程存活和依赖可用。

**Primary files:**

- `apps/server/src/modules/health/health.controller.ts`
- `apps/server/src/modules/health/health.module.ts`
- `apps/server/src/main.ts`
- `apps/server/src/modules/database/prisma.service.ts`
- `apps/server/src/modules/redis/redis.service.ts`
- `apps/server/src/modules/ai-gateway/serper-client.service.ts`
- `apps/server/src/modules/ai-gateway/hunter-client.service.ts`
- `apps/server/src/modules/ai-gateway/ai-sdk-text-generator.service.ts`
- `apps/server/src/modules/crm/crm-gmail-oauth-flow.ts`
- `apps/server/src/modules/crm/crm-gmail-oauth-token.provider.ts`
- `apps/server/src/modules/crm/crm-gmail-history.gateway.ts`
- `apps/server/src/modules/crm/crm-gmail-watch.gateway.ts`
- `apps/server/src/modules/crm/crm-email-send.gateway.ts`
- Worker host files with `onModuleDestroy`

**Planned shape:**

1. Add small shared fetch timeout helper only if existing call sites do not already enforce timeout.
2. Review retry policy per provider: retry transient failures, do not retry validation/auth/business failures.
3. Keep AI task and CRM worker runVersion guards as the final protection against stale retries.
4. Split health checks into lightweight liveness and dependency readiness if deployment needs it.
5. Confirm Redis queues, Prisma, workers, and timers close cleanly on shutdown.
6. Keep external error messages user-safe and log-safe.

**Global impact:**

- Timeout values affect long-running AI and Gmail operations; do not set one global timeout blindly.
- Health readiness can affect load balancer behavior and deployment rollout.
- Retry changes can duplicate side effects if idempotency guards are missing.

**Verification:**

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/ai-gateway/serper-client.service.spec.ts \
  apps/server/src/modules/ai-gateway/hunter-client.service.spec.ts \
  apps/server/src/modules/crm/crm-gmail-oauth-token.provider.spec.ts \
  apps/server/src/modules/crm/crm-gmail-history.gateway.spec.ts \
  apps/server/src/modules/crm/crm-gmail-watch.gateway.spec.ts \
  apps/server/src/modules/crm/crm-email-send.gateway.spec.ts \
  apps/server/src/modules/crm/crm-send-worker.service.spec.ts \
  apps/server/src/modules/ai-leads/ai-lead-search-task-worker.service.spec.ts

pnpm --filter @soybean/server typecheck
git diff --check
```

---

## Parallelization Plan

- Phase 1 and Phase 2 should not run in parallel because both touch app config and AI/CRM runtime assumptions.
- Phase 3 should be single-agent only because it changes global request behavior.
- Phase 11 and Phase 12 may start with read-only audits in parallel, but write changes should be serialized if they touch `main.ts`, `app.module.ts`, or shared helpers.
- Phase 4A can be single-agent or split by route group after route inventory is frozen.
- Phase 4B/4C can use subagents only when each agent owns a disjoint slice, for example mailbox vs inbox vs sequence, and a main agent owns final integration.
- Read-only audits for status values, route inventory, and store method grouping can run in parallel before edits.

---

## Commit Strategy

- One commit per phase, except Phase 4 should be at least three commits: controller split, service split, store split.
- Use `git status --short` before staging.
- Stage only files touched by the current phase.
- Because current pre-commit can format unrelated generated files, run checks manually and use `git commit --no-verify -m "..."`
  only after confirming staged diff is clean.

---

## Stop Conditions

- Any phase that changes frontend/backend contract must stop if `pnpm typecheck` or request helper tests fail.
- Phase 1 must stop if old configs cannot be migrated without exposing or losing keys.
- Phase 2 must stop if API role can no longer enqueue jobs.
- Phase 3 must stop if login expiration or error message display cannot be verified.
- Phase 4 must stop if a route path changes, a permission test changes semantics, or a transaction boundary is split.
- Phase 6 must stop if preflight SQL finds unknown statuses that need product/business decision.
- Phase 11 must stop if security tightening would block an existing documented workflow.
- Phase 12 must stop if timeout/readiness changes would cause known long-running AI or Gmail paths to fail.
