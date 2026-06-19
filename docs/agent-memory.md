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

### 2026-06-18 远程表格筛选要防旧请求覆盖新结果

- 场景：CRM 线索库这类前端远程表格支持关键词、状态、分页快速切换。
- 坑点：如果每次筛选/分页都直接请求并在返回时写入表格，旧请求可能比新请求更晚返回，导致 UI 筛选条件已变但表格数据被旧结果覆盖；旧请求的 `finally` 也可能提前关闭新请求的 loading。
- 正确做法：列表 composable 内维护递增 request id 或 AbortController，只允许最后一次请求写入 `records/pagination/loading`；筛选统计文案要区分“全库总数”和“当前筛选 total”。
- 相关文件：`src/views/crm/leads/modules/shared/useLeadTable.ts`、`src/views/crm/leads/modules/LeadStats.vue`。
- 验证方式：运行 `pnpm typecheck`，并由 code review 检查快速切换筛选/重置时不会出现旧响应覆盖新状态的代码路径。

### 2026-06-18 全局唯一资源冲突不能直接返回未授权记录

- 场景：CRM Mailbox 第一版要求同一个 Gmail 地址不能绑定到多个组织或用户，数据库用 `provider + emailHash` 全局唯一约束。
- 坑点：Store 为处理并发唯一冲突而重读已有记录时，不能直接把已有记录返回给 Service 当成功结果；如果输掉唯一索引的一方来自其他组织或用户，就会拿到别人的 mailbox 并泄露记录。
- 正确做法：全局唯一资源在 create 前查重后，create 返回值仍要在 Service 再做归属校验；不是当前 `organizationId + ownerUserId` 的记录必须抛业务错误，不能写成功日志或返回视图。
- 相关文件：`apps/server/src/modules/crm/crm.service.ts`、`apps/server/src/modules/crm/store/prisma-crm.store.ts`、`apps/server/src/modules/crm/crm.service.spec.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/crm.controller.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`，确认并发唯一冲突返回其他 owner mailbox 时会拒绝且不写成功日志。

### 2026-06-18 先查重再写入仍要转换数据库唯一冲突

- 场景：CRM ProductLine 按 `organizationId + name` 做唯一约束，Service 在创建或改名前会先查同名记录。
- 坑点：先查重不是并发安全保证；两个请求可能同时通过查重，后写入的一方触发 Prisma `P2002`。如果不转换，会把底层数据库错误当 500 抛给前端。
- 正确做法：对有唯一约束的写入，Service 除了前置查重，还要 catch Prisma `P2002` 并转换成业务错误；测试要覆盖 create 和 update/rename 两条路径。
- 相关文件：`apps/server/src/modules/crm/crm.service.ts`、`apps/server/src/modules/crm/crm.service.spec.ts`、`apps/server/src/modules/crm/store/prisma-crm.store.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/crm.controller.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`，确认并发 create/rename 唯一冲突会返回“产品资料名称已存在”。

### 2026-06-19 CRM 草稿确认必须 owner-only

- 场景：CRM 邮件序列第一期允许组织管理员查看组织内线索/序列，但需求明确管理员不能编辑正文、确认草稿、代发、代回复。
- 坑点：复用 `toOwnerScope(context)` 会让组织管理员和 `R_SUPER` 去掉 `ownerUserId` 限制；如果草稿保存/确认也走这个 scope，管理员就能把成员草稿置为 `ready_to_send`，后续发送队列接入后等同代发。
- 正确做法：读列表/详情可以按管理员组织 scope；任何会改变邮件正文、草稿审核状态、发送准备状态的操作必须强制 `ownerUserId: context.userId`。已确认草稿不允许再次编辑，避免 `Message=draft_pending_review` 但 `Enrollment=ready_to_send` 的状态错位。
- 相关文件：`apps/server/src/modules/crm/crm.service.ts`、`apps/server/src/modules/crm/crm.service.spec.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/crm.controller.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`，确认管理员不能修改/确认他人草稿，`draft_ready` 草稿不能编辑。

### 2026-06-19 CRM 草稿创建和确认要事务化

- 场景：创建首封开发信审核项需要同时写 `CrmSequenceEnrollment`、首封 `CrmMessage`、时间线事件，并更新 Account 状态；确认草稿也会同时更新 message、enrollment、timeline 和 Account。
- 坑点：如果分多次写入，`createMessage`、时间线或 Account 状态更新失败会留下半成品 enrollment；确认草稿时如果保存请求和确认请求并发，旧保存可能把 `draft_ready` 改回 `draft_pending_review`，造成 message/enrollment 状态错位。
- 正确做法：Store 提供事务方法一次性创建 enrollment/message/timeline 并更新 Account；确认草稿也走事务并用当前 message/enrollment 状态做条件更新。保存草稿时 update 要带 `status=draft_pending_review` guard。Service 只编排校验和日志。数据库层用 partial unique index 约束同一 `organizationId + ownerUserId + contactId` 只能存在一个 active 状态序列，Prisma schema 里保留普通索引即可。
- 相关文件：`apps/server/src/modules/crm/store/prisma-crm.store.ts`、`apps/server/src/modules/crm/crm.types.ts`、`prisma/migrations/20260619103000_create_crm_sequence_drafts/migration.sql`、`prisma/schema.prisma`。
- 验证方式：运行 CRM store/service spec 和 `pnpm --filter @soybean/server typecheck`，确认事务方法类型通过、active partial unique index 存在于迁移 SQL。

### 2026-06-19 审核抽屉异步请求要绑定当前记录 ID

- 场景：CRM 邮件序列审核抽屉可快速切换不同 enrollment，并支持保存/确认草稿。
- 坑点：只用 `currentItem` 承载抽屉状态时，打开新行但旧详情或旧保存请求晚返回，可能把 A 草稿响应写到 B 抽屉；如果 footer 在 loading 时仍可点，也可能对上一条 message 发保存/确认。
- 正确做法：抽屉状态要维护 `selectedEnrollmentId/selectedMessageId`，打开新行先清空旧 item，关闭时递增 detail request id 让旧请求失效；保存/确认返回后必须校验仍是同一 enrollment/message 才写 UI 状态和弹成功提示。确认按钮只允许 `draft_pending_review` 状态。
- 相关文件：`src/views/crm/email-sequences/modules/useEmailSequenceTable.ts`、`src/views/crm/email-sequences/modules/DraftReviewDrawer.vue`。
- 验证方式：运行 `pnpm typecheck`，并由 code review 检查抽屉切换、关闭、保存、确认路径都有 ID 校验。

### 2026-06-19 CRM 发送队列要用 runVersion 和 bullJobId 做发送前 guard

- 场景：首封开发信从 `ready_to_send/draft_ready` 进入 BullMQ 后，由后台 worker 标记 `queued/sent/failed`。
- 坑点：只按 message id 或 status 更新会让旧 job、重复点击、入队失败补偿和 worker 重试互相覆盖；如果不保存 `bullJobId`，也很难排查具体是哪次入队触发了状态变化。
- 正确做法：启动发送必须 owner-only；事务化把 enrollment 改为 `sequence_running`、message 改为 `queued` 并写 timeline，入队成功后回写 `CrmMessage.bullJobId`；worker 执行前必须校验 `organizationId + ownerUserId + enrollmentId + messageId + runVersion + enrollment.status=sequence_running + message.status=queued + mailbox.active`，不匹配直接跳过。入队失败要把 enrollment/message/account 补偿回可重试状态并记录事件，不要假成功。
- 相关文件：`apps/server/src/modules/crm/crm.service.ts`、`apps/server/src/modules/crm/crm-send-worker.service.ts`、`apps/server/src/modules/crm/store/prisma-crm.store.ts`、`prisma/schema.prisma`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-send-worker.service.spec.ts apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`，确认旧 runVersion job 跳过、owner-only 生效、入队失败回退、成功发送写入 sent。

### 2026-06-19 CRM 发送控制事务要先校验可用资源再改状态

- 场景：CRM 首封发送启动和停止序列都跨 `CrmSequenceEnrollment`、`CrmMessage`、`CrmAccount`、`CrmTimelineEvent` 多表写入。
- 坑点：如果在发送启动事务里先把 enrollment/message/account 改成运行中和 queued，再检查 mailbox/contact 是否仍可用，邮箱刚好被暂停时会返回失败但事务已经提交半状态；停止序列如果不 bump `runVersion`，旧 BullMQ job 仍可能按旧快照继续执行。
- 正确做法：`startFirstMessageSend` 在事务内先按当前状态读取 enrollment、首封 message、contact、active mailbox，确认资源可用后再做状态更新和 timeline；`stopSequenceEnrollment` 要把 active 状态改为 `stopped`、`runVersion + 1`，并把 queued 首封改为 `skipped`、清空 `bullJobId`，让旧 job 执行前 guard 自动失效。
- 相关文件：`apps/server/src/modules/crm/store/prisma-crm.store.ts`、`apps/server/src/modules/crm/crm.service.ts`、`apps/server/src/modules/crm/crm.controller.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/crm.controller.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts apps/server/src/modules/crm/crm-send-worker.service.spec.ts`，确认邮箱暂停时不写半状态、管理员可停止成员序列、旧 queued message 被标记为 skipped。

### 2026-06-19 扩展 CrmStore 接口要同步测试 fake store

- 场景：CRM 模块新增收件箱、回信入库或序列控制这类 store 方法时，`CrmService` 单元测试使用内存 fake store 覆盖大量业务路径。
- 坑点：只改 `CrmStore` 接口和 `PrismaCrmStore`，不补 `crm.service.spec.ts` 里的 fake store 方法和测试 record 类型，`pnpm --filter @soybean/server typecheck` 会报 fake store 不满足接口；如果用 `ReturnType<CrmStore['ingestCustomerReply']>` 推导 nullable 返回里的子对象，也容易变成 `never` 或重复类型别名。
- 正确做法：新增 store 方法后同步给 service spec 的 fake store 添加最小实现或明确空实现；测试数据类型优先复用正式 `CrmInboxThreadRecord`、`CrmInboxMessageRecord` 这类 record 类型，避免从可空操作结果里反推。
- 相关文件：`apps/server/src/modules/crm/crm.types.ts`、`apps/server/src/modules/crm/crm.service.spec.ts`、`apps/server/src/modules/crm/store/prisma-crm.store.ts`。
- 验证方式：运行 `pnpm --filter @soybean/server typecheck` 和 CRM service/controller/store 测试，确认 fake store 与正式 store 接口一致。

### 2026-06-19 CRM 邮箱额度要在 worker 发送前 claim，避免入队即扣和重复扣

- 场景：CRM 首封开发信从 `ready_to_send` 入 BullMQ 后，由 worker 执行真实发送，并需要遵守每个 Gmail 的每日/每小时额度。
- 坑点：不要在 `startFirstMessageSend` 入队阶段扣真实发送额度；queued 可能因为 BullMQ 不可用、用户停止、旧 job 或后续调度变化而从未发送。也不要在 worker 里先普通读取再发送，或重复调用 claim 方法，否则并发 worker 会超发或双扣额度。
- 正确做法：额度账本在 worker 发送前通过 store 事务方法 `claimFirstMessageSendDelivery` 统一完成：校验 `organizationId + ownerUserId + enrollmentId + messageId + runVersion + sequence_running + queued + mailbox.active`，再按 UTC day/hour bucket 原子占用 `CrmMailboxSendUsage`；claim 失败时 worker 不调用发送网关。成功路径测试要断言 claim 只调用一次。
- 相关文件：`apps/server/src/modules/crm/crm-send-worker.service.ts`、`apps/server/src/modules/crm/store/prisma-crm.store.ts`、`prisma/schema.prisma`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/store/prisma-crm.store.spec.ts apps/server/src/modules/crm/crm-send-worker.service.spec.ts`，确认额度满不发送、正常发送只 claim 一次。

### 2026-06-19 Prisma schema 变更要同步生成客户端

- 场景：给 `CrmMessage` 增加 `providerMessageId/providerThreadId` 这类数据库字段，后端 store 需要在 Prisma 写入和读取这些字段。
- 坑点：只改 `prisma/schema.prisma` 和 migration 不够；项目把 Prisma client 生成代码提交在 `apps/server/src/generated/prisma`，如果不运行 generate，TypeScript 可能靠局部类型绕过，但运行时 Prisma client 仍可能不认识新字段。
- 正确做法：schema 和 migration 改完后运行 `pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma`，并检查生成 diff 是否集中在对应模型和 internal metadata；不要手写 generated 文件。
- 相关文件：`prisma/schema.prisma`、`prisma/migrations/*/migration.sql`、`apps/server/src/generated/prisma/models/*`、`apps/server/src/generated/prisma/internal/*`。
- 验证方式：运行对应 store/worker spec、`pnpm --filter @soybean/server typecheck` 和 `pnpm typecheck`，确认 Prisma 类型和运行入口都识别新字段。

### 2026-06-19 Gmail 回信入库必须按 providerMessageId 幂等

- 场景：后续 Gmail Pub/Sub/History 同步客户回信、退订或退信时，同一 Gmail message 可能因为至少一次投递、worker 重试或并发通知被处理多次。
- 坑点：不能只在 service 层做先查再写，也不能重复调用 `ingestCustomerReply` 后照常发站内通知；并发下仍可能撞 `CrmInboxMessage` 唯一约束，或者重复递增 `unreadCount/messageCount`、重复写 timeline/通知。
- 正确做法：`PrismaCrmStore.ingestCustomerReply` 先按 `organizationId + ownerUserId + mailboxId + providerMessageId` 查已有入站消息；创建时遇到 Prisma `P2002` 要按 providerMessageId 重读并返回 `isDuplicate=true`、`event=null`。Service 拿到重复结果时跳过站内通知和“已入库”业务日志；不同新回信仍正常通知。
- 相关文件：`apps/server/src/modules/crm/store/prisma-crm.store.ts`、`apps/server/src/modules/crm/crm.service.ts`、`apps/server/src/modules/crm/crm.types.ts`、`prisma/schema.prisma`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/store/prisma-crm.store.spec.ts apps/server/src/modules/crm/crm.service.spec.ts`，确认重复 providerMessageId 不 create、不更新 thread、不写 timeline、不通知，并发 `P2002` 会重读已有消息。

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
