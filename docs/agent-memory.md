# Project Agent Memory

本文件只记录当前项目内已经确认的踩坑经验，供后续 AI 会话在执行任务前读取。

## 使用规则

- 只记录本项目有效的经验，不写全局通用常识。
- 只记录已经复现、定位并确认解决的坑，不记录临时猜测。
- 内容写成可执行规则，避免写成聊天流水账。
- 每条经验尽量包含场景、坑点、正确做法和相关文件。
- 涉及敏感信息时只记录脱敏后的上下文，不写密码、token、apiKey、Cookie 等。
- 如果经验已经过期，移动到“已废弃经验”并说明原因。

## 已确认经验

### 2026-06-18 Nest Controller 调用不存在的服务方法导致页面 500

- 场景：前端页面进入即提示 `Internal server error`，但页面组件本身能正常渲染空表格，例如用户管理进入后 GET `/system-users` 报 500。
- 坑点：不要只看前端空数据状态；本项目新增后端模块时，Controller 可能临时复用旧 Service，调用真实类上不存在的方法（如 `AuthService.listUsers()`），运行时会抛异常并被前端统一显示为 500。
- 正确做法：从前端接口文件追到 Controller，再确认被注入 Service 的真实公开方法；列表/CRUD 这类业务逻辑应放独立模块 Service，Controller 只做鉴权、入参和响应组织，Module 要注册对应 provider 并导入需要的依赖模块。
- 相关文件：`src/service/api/system-user.ts`、`apps/server/src/modules/system-user/system-user.controller.ts`、`apps/server/src/modules/system-user/system-user.service.ts`、`apps/server/src/modules/system-user/system-user.module.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/system-user/system-user.service.spec.ts apps/server/src/modules/system-user/system-user.controller.spec.ts`，确认用户管理 Controller 和 Service 聚焦测试通过。

### 2026-06-18 AI 获客后台任务状态被旧 worker 覆盖

- 场景：AI 获客后台任务支持排队、运行、中断、继续、重试、放弃；用户动作和 BullMQ worker 可能同时更新同一任务。
- 坑点：任务状态更新不能只按 `id` 覆盖。旧 worker 从 `queued/running` 读到任务后，如果用户已经中断或放弃，后续 `running/completed/failed` 写入会把用户动作覆盖；创建任务落库后入队失败也会留下没有 BullMQ job 的 `queued` 任务；继续/重试如果先入队再更新 `runVersion`，快 worker 会按旧版本跳过；放弃如果先删 BullMQ job，锁定中的 job 删除失败会导致任务仍未放弃。
- 正确做法：任务 store 更新要支持 `status/runVersion/userId` guard；worker 写进度、完成、失败前必须确认仍是同一 `runVersion` 且状态仍为 `running`；创建任务要用事务确认当前用户无可恢复任务，入队失败时补偿成 `failed` 并写事件；继续/重试要先持久化新 `runVersion`、状态和预期 jobId，再入队；放弃要先把任务状态置为 `discarded`，再尽力删除队列 job，删除失败只记事件不阻塞用户动作。
- 相关文件：`apps/server/src/modules/ai-leads/ai-lead-search-task.service.ts`、`apps/server/src/modules/ai-leads/ai-lead-search-task-worker.service.ts`、`apps/server/src/modules/ai-leads/prisma-ai-lead-search-task.store.ts`、`apps/server/src/modules/ai-leads/ai-lead-search-task.types.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-leads/ai-lead-search-task.service.spec.ts apps/server/src/modules/ai-leads/ai-lead-search-task-worker.service.spec.ts`，确认入队失败补偿、旧 worker 不覆盖放弃任务、中断后外部调用失败不改成 failed。

### 2026-06-18 系统通知 shown 不是已处理状态

- 场景：AI 获客后台任务完成或失败后，布局层轮询系统通知并弹出 Naive notification，用户可能没有点击“查看”处理任务。
- 坑点：`shown` 只表示前端已经弹出过通知，不表示用户已经处理；如果后端待提醒列表只查 `pending`，通知一旦被 `markShown` 就不会再次提醒。
- 正确做法：系统通知在 `read` 前都应继续进入提醒列表，服务端查询待提醒通知时包含 `pending` 和 `shown`；前端只用本地 active set 避免同一条通知同时重复弹出，关闭后仍允许下一轮轮询再次提醒。
- 相关文件：`apps/server/src/modules/system-notification/system-notification.service.ts`、`src/layouts/base-layout/index.vue`、`src/store/modules/ai-leads-task/index.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/system-notification/system-notification.service.spec.ts apps/server/src/modules/system-notification/system-notification.controller.spec.ts`，确认 `shown` 未读通知仍会返回。

### 2026-06-18 AI 获客任务已读要同步处理关联通知

- 场景：AI 获客后台任务完成后，用户可能直接在 `/ai-leads` 页面点击“确认结果”，而不是点击系统通知里的“查看”按钮。
- 坑点：任务 `readAt` 和系统通知 `status=read` 是两套状态；只标记任务已读会让 `pending/shown` 通知继续被全局轮询捞出并重复提醒。
- 正确做法：任务服务确认完成任务时，要按 `targetType=aiLeadSearchTask + targetId=task.id + userId` 同步标记关联通知已读；通知写入失败不能回滚任务已读，但要写任务事件便于排查。
- 相关文件：`apps/server/src/modules/ai-leads/ai-lead-search-task.service.ts`、`apps/server/src/modules/system-notification/system-notification.service.ts`、`apps/server/src/modules/system-notification/store/prisma-system-notification.store.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-leads/ai-lead-search-task.service.spec.ts apps/server/src/modules/system-notification/system-notification.service.spec.ts`，确认任务确认会调用 target 维度通知已读。

### 2026-06-18 新增前端 CRM 一级菜单要走 elegant-router 和 i18n 链路

- 场景：新增独立 CRM 一级菜单，包含线索库、邮件序列、收件箱、CRM 配置等子页面。
- 坑点：本项目菜单不是单独维护的静态菜单，而是由 `@elegant-router/vue` 根据 `src/views` 和 route meta 生成；只建页面、只改生成文件或只补 i18n 都会导致菜单、标题、全局搜索、标签页或类型不完整。当前 `.env` 使用 `VITE_AUTH_ROUTE_MODE=static`，静态模式下 `meta.roles` 会影响菜单过滤和路由守卫；动态模式则会走后端 route 接口。
- 正确做法：多子页一级菜单参考 `manage` 路由形态，页面放 `src/views/crm/<page>/index.vue`，路由 key 预期为 `crm`、`crm_leads`、`crm_email-sequences`、`crm_inbox`、`crm_settings`；在 `build/plugins/router.ts` 的 `onRouteMetaGen` 为父子路由配置 `icon/order/roles`，再运行 `pnpm gen-route` 更新 `src/router/elegant/routes.ts`、`imports.ts`、`transform.ts` 和 `src/typings/elegant-router.d.ts`；菜单标题补 `src/locales/langs/zh-cn.ts` 和 `src/locales/langs/en-us.ts` 的 `route` 节点。
- 页面组织：列表页优先参考 `src/views/manage/system-log` 的薄 `index.vue` + `modules/FilterPanel.vue` + `modules/LogTable.vue` + `modules/shared.ts`；复杂 CRUD 再参考 `src/views/manage/user` 的 `useNaivePaginatedTable` 写法。占位页可先用 `src/components/custom/look-forward.vue` 或空 `NCard`/`NDataTable`，不要提前接不存在的接口。
- API 和类型：前端接口放 `src/service/api/crm.ts` 并从 `src/service/api/index.ts` 导出；接口类型放 `src/typings/api/crm.d.ts` 的 `declare namespace Api.Crm` 下；分页沿用 `Api.Common.PaginatingQueryRecord<T>` 和 `current/size/total/records`。后端未完成前不要写会请求 404 的正式调用。
- 相关文件：`build/plugins/router.ts`、`src/router/elegant/routes.ts`、`src/router/guard/route.ts`、`src/store/modules/route/shared.ts`、`src/typings/router.d.ts`、`src/locales/langs/zh-cn.ts`、`src/locales/langs/en-us.ts`、`src/service/api/index.ts`、`src/typings/api/common.d.ts`、`src/views/manage/system-log/index.vue`、`src/views/manage/user/index.vue`。
- 验证方式：新增页面和 meta 后运行 `pnpm gen-route`；若新增 API 类型或路由类型引用，再运行 `pnpm typecheck`。按项目规则不需要运行 `npm run build`。

### 2026-06-18 AI 获客后台任务必须持久化组织上下文

- 场景：AI 获客任务由前端用户创建，但实际采集和完成后 CRM 导入发生在后台 worker 中。
- 坑点：worker 只能从任务表恢复 `userId/userName`，不能依赖前端 token，也不能在后台猜默认组织；如果任务没有保存 `organizationId/organizationRole`，完成后导入 CRM 会丢失租户隔离上下文。
- 正确做法：创建 `AiLeadSearchTask` 时从 `UserInfo` 固化 `organizationId/organizationRole`，Prisma store 写入并映射回 `AiLeadSearchTaskRecord`；worker 重建上下文或导入 CRM 时使用任务快照里的组织字段。
- 相关文件：`apps/server/src/modules/ai-leads/ai-lead-search-task.service.ts`、`apps/server/src/modules/ai-leads/prisma-ai-lead-search-task.store.ts`、`apps/server/src/modules/ai-leads/ai-lead-search-task-worker.service.ts`、`prisma/schema.prisma`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-leads/ai-lead-search-task.service.spec.ts apps/server/src/modules/ai-leads/ai-lead-search-task-worker.service.spec.ts`，确认任务创建保存组织字段、worker 导入 CRM 使用任务组织上下文。

### 2026-06-18 CRM 成员私有线索不能用组织级唯一查重

- 场景：第一期 CRM 普通成员只能看自己的线索和邮件正文，组织管理员才可看组织内整体。
- 坑点：如果 Account/Contact 按 `organizationId + domain/emailHash` 全组织查重，普通成员导入同组织其他成员已有的客户时会拿到或更新对方记录，造成成员隔离泄漏。
- 正确做法：第一期成员私有数据的 Account/Contact 查重和唯一索引使用 `organizationId + ownerUserId + domain/emailHash`；组织级历史去重后续用归档指纹、提醒或管理员视图处理，不直接复用其他成员的私有 CRM 主记录。
- 相关文件：`apps/server/src/modules/crm/crm.service.ts`、`apps/server/src/modules/crm/store/prisma-crm.store.ts`、`prisma/schema.prisma`、`prisma/migrations/20260618230000_create_crm_foundation/migration.sql`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`，确认同组织不同成员同域名不会复用对方 Account，并发唯一冲突会重读已有记录。

### 记录模板

```md
### YYYY-MM-DD 标题

- 场景：
- 坑点：
- 正确做法：
- 相关文件：
- 验证方式：
```

## 待确认经验

用于临时放置还没有完全验证、但后续可能需要沉淀的线索。确认后再移动到“已确认经验”。

暂无。

## 已废弃经验

暂无。
