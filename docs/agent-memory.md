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

### 2026-06-21 本项目 RTK 使用全量安装模板

- 场景：在本项目内使用 RTK（Rust Token Killer）压缩低价值命令输出。
- 坑点：只依赖全局 `/Users/yjr/.codex/RTK.md` 时，`rtk init --show --codex` 会显示本地 AGENTS 未配置，后续会话不一定按项目本地规则识别为已安装。
- 正确做法：本项目已经执行 `rtk init --codex`，根目录存在 `RTK.md`，`AGENTS.md` 末尾引用 `@RTK.md`；全局也已执行 `rtk init --global --codex`。Codex 不会自动 hook shell 命令，后续执行命令要主动用 `rtk <command>`；需要精确输出但仍希望记录时用 `rtk proxy <command>`。RTK 规则以本地 `RTK.md` 和全局 `/Users/yjr/.codex/RTK.md` 为准。
- 相关文件：`RTK.md`、`AGENTS.md`、`/Users/yjr/.codex/RTK.md`、`/Users/yjr/.codex/AGENTS.md`。
- 验证方式：运行 `rtk init --show --codex`，确认 Global/Local RTK.md 和 AGENTS.md reference 都显示 `[ok]`。

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

### 2026-06-19 CRM 归档指纹只做组织级历史提醒，不复用成员主记录

- 场景：线索归档后，后续 AI 获客或手动导入可能再次遇到同一公司域名或联系人邮箱；未来 30 天后瘦身主记录时仍需要保留去重/历史触达判断能力。
- 坑点：不能为了历史去重把 Account/Contact 改成组织级唯一，也不能把归档主记录删除后丢掉 domain/emailHash；否则要么泄漏其他成员私有线索，要么后续获客无法识别历史触达。
- 正确做法：归档时写 `CrmArchivedFingerprint`，唯一键为 `organizationId + fingerprintType + fingerprintValue`；domain 指纹保存域名，email 指纹只保存 `emailHash + maskedValue`。导入时按组织查指纹并写 `archived_fingerprint_matched` 时间线提醒，但继续按 `organizationId + ownerUserId` 创建/复用当前成员自己的 Account/Contact。
- 相关文件：`prisma/schema.prisma`、`apps/server/src/modules/crm/crm.service.ts`、`apps/server/src/modules/crm/store/prisma-crm.store.ts`、`apps/server/src/modules/crm/crm.types.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`，确认归档写 domain/email_hash 指纹，再导入命中组织归档指纹时只写提醒时间线，不复用其他成员主记录。

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

### 2026-06-19 CRM 跨页面预填创建流程要拆开资源请求和联系人请求

- 场景：从线索详情联系人行跳到邮件序列页，自动打开“生成首封草稿”弹窗，并通过 query 预填 `accountId/contactId`。
- 坑点：创建弹窗需要同时加载线索/邮箱/产品线资源和所选线索的联系人列表；如果二者复用同一个 request id 或 loading 标志，普通资源请求和联系人请求会互相判定为旧请求，或一个请求先结束导致另一个请求的 loading 被提前关闭。
- 正确做法：邮件序列 composable 中分别维护全局创建资源请求 id 和联系人请求 id，loading 用两个内部状态合并；线索详情只 emit 联系人，页面 composable 负责 `router.push({ path: '/crm/email-sequences', query: { accountId, contactId } })`，邮件序列页读取 query 后打开弹窗并校验联系人仍属于该线索。
- 相关文件：`src/views/crm/leads/modules/LeadDetailDrawer.vue`、`src/views/crm/leads/modules/shared/useLeadTable.ts`、`src/views/crm/email-sequences/modules/useEmailSequenceTable.ts`。
- 验证方式：运行 `pnpm typecheck`、`pnpm exec eslint --max-warnings=0 .`、`pnpm exec oxlint`，并检查从线索详情点击“开发信”时弹窗能预选线索和联系人。

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

### 2026-06-19 CRM 退订黑名单按组织隔离，但 worker claim 仍要最终拦截

- 场景：客户回复 `remove me / unsubscribe / stop` 等退订语义后，同一组织内其他成员或后续任务再次开发同一邮箱时必须被挡住；不同组织不共享退订黑名单。
- 坑点：不能把退订黑名单做成全局邮箱缓存，也不能只在草稿创建或开始发送前校验；草稿审核后到 BullMQ worker 真正发送前，客户可能已经退订，旧 queued job 仍会执行。
- 正确做法：退订回信在 `PrismaCrmStore.ingestCustomerReply` 同一事务里 upsert `CrmBlacklist`，唯一键为 `organizationId + emailHash`；`CrmService.createSequenceReviewItem` 和 `startFirstMessageSend` 先查黑名单并拒绝；`claimFirstMessageSendDelivery` 在扣额度前再次查询黑名单，命中时停止 enrollment、跳过 queued message 并返回 `null`。
- 相关文件：`apps/server/src/modules/crm/crm.service.ts`、`apps/server/src/modules/crm/store/prisma-crm.store.ts`、`apps/server/src/modules/crm/crm.types.ts`、`prisma/schema.prisma`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts apps/server/src/modules/crm/crm-send-worker.service.spec.ts`，确认黑名单联系人不能建审核、不能入队、worker claim 不扣额度，退订回信会写组织级黑名单。

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

### 2026-06-19 默认 commit hook 会格式化大量无关文件

- 场景：CRM 开发完成后执行普通 `git commit -m ...`，提交钩子会自动跑 `typecheck`、`lint --fix` 和 `fmt`。
- 坑点：当前 `fmt` 会改动大量 Prisma generated 文件和旧前端文件，即使本次任务没有触碰它们；如果不检查 `git status` 和 diff，容易把无关格式化改动混进提交。
- 正确做法：提交前先运行需要的测试、`pnpm typecheck`、`pnpm exec eslint --max-warnings=0 .`、`pnpm exec oxlint`、`git diff --check`；确认通过后手动 `git add` 本次文件，并用 `git commit --no-verify -m ...` 提交。若误触发普通 commit hook，先用 `git restore .` 清理未暂存的 hook 产物，再确认 staged 只剩本次相关文件。
- 相关文件：`apps/server/src/generated/prisma/*`、`src/views/crm/*`、`src/views/ai-leads/index.vue`。
- 验证方式：提交前后都运行 `git status --short`，确认没有 generated 或无关 UI 文件残留。

### 2026-06-19 Gmail 403 不能全部当授权失效

- 场景：CRM Gmail watch/history 接入真实 Gmail API，网关需要把 Gmail 错误转换成业务状态。
- 坑点：Gmail API 的 403 可能是 `authError/domainPolicy/insufficientPermissions`，也可能是 `rateLimitExceeded/userRateLimitExceeded/dailyLimitExceeded`。如果把所有 403 都转换成 `CrmGmailAuthorizationExpiredError`，`CrmGmailWatchService` 会把临时限流误标成 `auth_expired` 并暂停邮箱。
- 正确做法：解析 Gmail error body 的 `error.errors[].reason`；只有授权/权限类 reason 或 401 才走授权失效，限流类 403 抛普通错误或后续可重试错误，不改 mailbox 授权状态。
- 相关文件：`apps/server/src/modules/crm/crm-gmail-watch.gateway.ts`、`apps/server/src/modules/crm/crm-gmail-watch.gateway.spec.ts`、`apps/server/src/modules/crm/crm-gmail-watch.service.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-gmail-watch.gateway.spec.ts`，确认 `rateLimitExceeded` 不会抛 `CrmGmailAuthorizationExpiredError`。

### 2026-06-19 CRM 发送 worker 必须按 job.messageId 定位目标邮件

- 场景：首封发送成功后会在同一个 Enrollment 下生成第 2/3/4/5 封 follow-up 草稿，审核后这些后续邮件也会进入同一套发送 worker。
- 坑点：`toSequenceReviewInclude()` 返回整组 `messages[]` 后，列表第一条通常仍是 step 1；如果 claim/send/complete 逻辑继续用 `record.messages[0]` 或 `firstMessage` 当作当前 job 目标，第 2 封及后续 queued job 会被误跳过，或发送完成后把 `currentStep` 固定写成 1。
- 正确做法：发送 claim 必须用 `job.messageId` 在 `messages[]` 中定位 queued 目标邮件，返回给 worker 的发送 message 也必须是该目标邮件；发送完成时用目标邮件的 `stepIndex` 回写 `Enrollment.currentStep`，再按该 step 生成下一封 follow-up 草稿。
- 相关文件：`apps/server/src/modules/crm/store/prisma-crm.store.ts`、`apps/server/src/modules/crm/crm-send-worker.service.ts`、`apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`、`apps/server/src/modules/crm/crm-send-worker.service.spec.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/store/prisma-crm.store.spec.ts apps/server/src/modules/crm/crm-send-worker.service.spec.ts`，确认 step 2 queued job 能 claim、发送并生成 step 3 草稿。

### 2026-06-19 CRM 客户回信必须停止同公司当前所有序列

- 场景：同一个 Account 下可能同时开发多个联系人，A 联系人回信时，B 联系人的后续开发信可能已经在队列中等待发送。
- 坑点：只把 `outboundMessage.enrollmentId` 对应的单条 enrollment 改成 `replied` 不够；同公司其他 active enrollment 的 `runVersion` 不变，旧 BullMQ job 仍可能通过发送前 guard，UI 也会继续显示 queued。
- 正确做法：`ingestCustomerReply` 必须在同一个事务内按 `organizationId + ownerUserId + accountId` 把 `draft_review_pending/ready_to_send/sequence_running/paused` 的 enrollment 批量改成 `replied` 并 `runVersion + 1`，同时把同公司 `queued` message 改成 `skipped` 并清空 `bullJobId`。
- 相关文件：`apps/server/src/modules/crm/store/prisma-crm.store.ts`、`apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`、`apps/server/src/modules/crm/crm.service.spec.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`，确认同公司两个联系人各有运行中序列时，任一回信会让两条 enrollment 都变 `replied`，queued follow-up 变 `skipped`。

### 2026-06-19 Gmail Pub/Sub 和 History 同步要先做来源与邮箱状态 guard

- 场景：Gmail Pub/Sub push 会公开打到后端 webhook；邮箱也可能已经 `paused/auth_expired`，但 Google 仍可能继续推送历史通知。
- 坑点：webhook 不校验来源会允许伪造 push 触发同步队列；非 active mailbox 继续入队会制造无效同步；History worker 遇到 `CrmGmailAuthorizationExpiredError` 如果只抛给 BullMQ，会反复重试而不暂停邮箱或通知用户。
- 正确做法：配置 `CRM_GMAIL_PUBSUB_PUSH_SECRET` 时，controller 必须校验 `x-crm-gmail-pubsub-secret`，且不能记录完整 secret；webhook service 和 History worker 都要跳过非 `active` mailbox；History worker 捕获 `CrmGmailAuthorizationExpiredError` 后调用 `markMailboxAuthorizationExpired`，返回 `authorization_expired` 跳过结果。
- 相关文件：`apps/server/src/modules/crm/crm-gmail-webhook.controller.ts`、`apps/server/src/modules/crm/crm-gmail-webhook.service.ts`、`apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.ts`、`apps/server/src/modules/crm/crm.types.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-gmail-webhook.controller.spec.ts apps/server/src/modules/crm/crm-gmail-webhook.service.spec.ts apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts`，确认错误 secret 拒绝、非 active 邮箱不入队/不调 Gmail、授权失效会标记邮箱并跳过重试。

### 2026-06-19 AI 获客外部联系人补全不能阻断 CRM 导入

- 场景：AI 获客任务完成后，后台 worker 会把候选公司导入 CRM，并在导入前调用 Hunter Domain Search 尝试补全联系人邮箱。
- 坑点：Hunter 未配置、无官网域名、接口限流或单个域名失败时，如果直接抛错，会让已经采集完成的任务无法沉淀 CRM 线索；如果把 Hunter raw response 或 apiKey 写入事件/日志，又会泄漏外部服务数据和敏感凭据。
- 正确做法：联系人补全作为 best-effort 步骤；无官网域名不读取配置也不调用 Hunter；已有联系人邮箱不覆盖；只合并缺失的 `fullName/title/email`；补全失败写任务事件摘要 `attemptedCount/enrichedCount/failedCount/firstErrorMessage` 后继续用原始 inputs 导入 CRM，事件和业务日志不记录 raw response 或 apiKey。
- 相关文件：`apps/server/src/modules/ai-leads/ai-lead-hunter-enrichment.service.ts`、`apps/server/src/modules/ai-leads/ai-lead-search-task-worker.service.ts`、`apps/server/src/modules/ai-gateway/ai-gateway.service.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-leads/ai-lead-hunter-enrichment.service.spec.ts apps/server/src/modules/ai-leads/ai-lead-search-task-worker.service.spec.ts apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts`，确认无域名不调用 Hunter、失败不阻断 CRM 导入、日志不包含 API Key。

### 2026-06-19 CRM 邮箱验证缓存是全平台共享，不按组织隔离

- 场景：AI 获客或手动验证联系人邮箱时，需要做格式、公共邮箱、MX/DNS 等验证；不同用户甚至不同组织可能反复遇到同一个邮箱。
- 坑点：不要把邮箱验证缓存设计成联系人字段或 `organizationId + emailHash`。联系人主记录必须保持成员/组织隔离，但验证结果只是邮箱可用性结论；按组织缓存会让跨组织重复查 DNS/MX，违背“所有用户共用一次验证结果”的需求。
- 正确做法：使用独立全局 `CrmEmailVerificationCache`，按 `emailHash` 唯一，保存 `maskedEmail/domain/status/reason/verifiedAt/expiresAt/checkedBy`，不保存明文邮箱；验证前先查 `emailHash` 缓存，再按 `CrmGlobalConfig.emailVerificationCooldownDays` 计算 `verifiedAt + 冷却天数` 是否仍有效，命中则跳过 DNS/MX，未命中再验证并按当前配置刷新冷却期。冷却天数默认 30 天，但必须支持平台超管后台配置。客户主记录、邮件正文、时间线仍按组织和 owner 隔离。
- 相关文件：`prisma/schema.prisma`、`apps/server/src/modules/crm/crm.service.ts`、`apps/server/src/modules/crm/store/prisma-crm.store.ts`、`apps/server/src/modules/crm/crm.types.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`，确认跨 owner、跨 organization 的同邮箱命中新鲜缓存不查 DNS，过期缓存会重新验证并刷新。

### 2026-06-19 多 Agent 合并前要冻结同文件写入

- 场景：多个子 Agent 并行实现 CRM 配置页时，主 Agent 已经决定把“基础规则”和“邮箱验证冷却期”拆成两个卡片，但子 Agent 仍在后台继续修改同一组前端文件。
- 坑点：子 Agent 后续写入可能把主 Agent 刚合并的方案覆盖、重复渲染同一个配置入口，甚至删除 `BasicRulesCard.vue` 这类主页面仍在 import 的文件；只看最后一次测试通过不够，必须重新检查 `git status` 和关键文件内容。
- 正确做法：合并同一前端区域前先 `send_input` 明确要求相关子 Agent 停止写入并总结；主 Agent 再统一落最终结构。合并后必须检查 `git status --short`、`git diff --name-status`、关键父组件 import、实际组件文件是否存在，并重新跑 `pnpm typecheck`、相关单测和 lint。
- 相关文件：`src/views/crm/settings/modules/BasicRulesCard.vue`、`src/views/crm/settings/modules/GlobalConfigCard.vue`、`src/views/crm/settings/modules/MailboxManager.vue`。
- 验证方式：确认 `MailboxManager.vue` 同时 import 的组件文件都存在，且配置表单只在 `GlobalConfigCard.vue` 出现一次。

### 2026-06-19 CRM mock 调试接口默认必须关闭

- 场景：Gmail OAuth、发送和回信同步接入期间，CRM 曾保留 `/crm/mailboxes/mock-authorize` 和 `/crm/messages/:id/mock-reply` 方便本地验证邮箱授权和客户回信流程。
- 坑点：mock 授权会创建没有 OAuth refresh token 的 active mailbox，mock 回信会人为触发回信入库、停发、退订和黑名单逻辑；如果普通用户在生产环境可直接调用，会绕开真实 Gmail 授权和同步边界。
- 正确做法：正式前端不导出也不调用 mock API；后端 mock controller 入口必须同时满足 `NODE_ENV !== production`、`CRM_ENABLE_MOCK_ENDPOINTS=true` 和 `R_SUPER`，默认抛 `ForbiddenException`。单元测试需要用 helper 临时设置环境变量，并在 finally 中恢复，避免污染其他测试。
- 相关文件：`apps/server/src/modules/crm/crm.controller.ts`、`apps/server/src/modules/crm/crm.controller.spec.ts`、`src/service/api/crm.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.controller.spec.ts`，确认 mock endpoint 默认拒绝、普通用户拒绝、production 拒绝、显式打开且超管时旧测试仍通过；运行 `rg "mockAuthorizeCrmMailbox|mockReplyCrmMessage|MessageMockReplyPayload" src -n` 确认前端无残留。

### 2026-06-19 Gmail History checkpoint 过期不能静默推进

- 场景：Gmail History API 可能因为 `startHistoryId` 太旧返回 404，gateway 会转换为 `CrmGmailHistoryExpiredError`。
- 坑点：如果 History worker 不捕获这个错误，BullMQ 会反复重试同一个已过期 checkpoint；但如果直接把 `lastHistoryId` 推进到 Pub/Sub 目标 historyId，又会把未同步历史误标成已处理，造成漏回信。
- 正确做法：History worker 捕获 `CrmGmailHistoryExpiredError` 后，返回 `skipped/history_expired`，保持 mailbox 原 `lastHistoryId` 不动，并写系统日志和站内通知提醒邮箱 owner 重新授权、手动同步或联系管理员处理；不要在 worker 里无边界全量扫邮箱。
- 相关文件：`apps/server/src/modules/crm/crm-gmail-history.gateway.ts`、`apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.ts`、`apps/server/src/modules/crm/crm.types.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts`，确认 history 过期时 checkpoint 不推进、返回 `history_expired`，并创建日志和通知。

### 2026-06-19 Gmail 外部手动发送回复要按 outbound 分流

- 场景：用户可能直接在 Gmail 里对 CRM 发起的线程手动回复，Gmail History 会把这类 `SENT` 且非 `INBOX` 的消息作为 `messageAdded` 推过来。
- 坑点：History gateway 如果把 `SENT-only` 消息直接过滤，会漏掉用户外部手动回复；如果只删除过滤但不建模方向，worker 会把外发消息误当客户回信，触发 inbox 入库和停发逻辑。
- 正确做法：`parseGmailApiMessage` 根据 `labelIds` 标记 `direction: inbound/outbound`；gateway 保留 `SENT-only` 消息；History worker 对 `outbound` 只按 `providerThreadId` 匹配已发送 CRM message 并写 `external_gmail_reply_sent` 时间线事件，不调用 `ingestCustomerReply`。
- 相关文件：`apps/server/src/modules/crm/crm-gmail-message.ts`、`apps/server/src/modules/crm/crm-gmail-history.gateway.ts`、`apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.ts`、`apps/server/src/modules/crm/crm.types.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-gmail-message.spec.ts apps/server/src/modules/crm/crm-gmail-history.gateway.spec.ts apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts`，确认 SENT-only 被解析为 outbound、gateway 不跳过、worker 写时间线且不走客户回信入库。

### 2026-06-19 Gmail label/delete 同步不能删除本地 CRM 历史

- 场景：用户在 Gmail 里标记已读/未读、归档、移入垃圾箱或删除消息时，Gmail History 会推 `labelAdded/labelRemoved/messageDeleted`，但 CRM 已同步的正文和时间线是业务记录。
- 坑点：如果 History gateway 只订阅 `messageAdded`，CRM 收件箱状态不会跟随 Gmail 侧处理；如果把 `messageDeleted` 或归档误做成本地 hard delete，会抹掉已经入库的客户回信和时间线。
- 正确做法：History gateway 同时订阅 `messageAdded/messageDeleted/labelAdded/labelRemoved`，把 label/delete 解析成轻量 `labelChanges`；worker 对 labelChanges 只调用 `syncInboxThreadGmailState`。`UNREAD` 去除 -> `handled + unreadCount=0`，`UNREAD` 新增 -> `pending + unreadCount>=1`，`INBOX` 去除、`TRASH` 新增或 `messageDeleted` -> `archived + unreadCount=0`；不删除 `CrmInboxMessage` 正文。
- 相关文件：`apps/server/src/modules/crm/crm-gmail-history.gateway.ts`、`apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.ts`、`apps/server/src/modules/crm/store/prisma-crm.store.ts`、`apps/server/src/modules/crm/crm.types.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-gmail-history.gateway.spec.ts apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`，确认 label/delete delta 能推进 checkpoint、更新 thread 状态、写时间线且不删除本地 message。

### 2026-06-19 CRM 序列策略默认状态和后续草稿要一起校验

- 场景：每组织/每序列策略引入 `CrmSequencePolicy` 后，创建首封草稿会绑定默认或指定策略，发送 worker 会继续生成第 2-5 封 follow-up 草稿。
- 坑点：只在首封草稿读取策略不够；后续草稿如果仍只读模板或全局延迟，会导致同一 enrollment 的后续发送间隔和线程模式不按所选策略执行。另一个坑是 update 接口如果允许 `status=archived + isDefault=true`，会产生“归档默认策略”错位状态。
- 正确做法：`CrmSendWorkerService` 生成下一封草稿时，`delayDays/threadMode` 优先使用 enrollment 绑定的 `policy.steps`，再退到默认模板 step，最后退到全局 follow-up 配置；service 写策略时必须保证默认策略只能是 `active`，归档策略要清掉 `isDefault`。
- 相关文件：`apps/server/src/modules/crm/crm.service.ts`、`apps/server/src/modules/crm/crm-send-worker.service.ts`、`apps/server/src/modules/crm/store/prisma-crm.store.ts`、`prisma/schema.prisma`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/crm-send-worker.service.spec.ts`，确认归档策略不能设默认，后续草稿按绑定策略生成。

### 2026-06-19 Gmail History expired 手动同步要重新初始化 checkpoint

- 场景：Gmail History API 返回 checkpoint 过期后，worker 已保持 `lastHistoryId` 不推进，并在邮箱上写 `lastSyncIssue.type=history_expired`。
- 坑点：如果用户点击“立即同步”仍按旧 `lastHistoryId` 入队增量同步，worker 会再次命中 history expired，形成重复失败和重复告警；不能在 worker 里无边界全量扫邮箱。
- 正确做法：`CrmGmailWatchService.syncMailboxNow` 遇到 `history_expired` 同步问题时，先续订 watch，再把 mailbox 的 `lastHistoryId` 重置为新的 Gmail `historyId`，同时清空 `syncIssueType/syncIssueAt/syncIssueMessage`，返回 `checkpoint_reinitialized`，不入队 history sync。
- 相关文件：`apps/server/src/modules/crm/crm-gmail-watch.service.ts`、`apps/server/src/modules/crm/crm-gmail-watch.service.spec.ts`、`src/views/crm/settings/modules/useMailboxTable.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-gmail-watch.service.spec.ts`，确认 history expired 邮箱手动同步不入队、重置 checkpoint 并清空同步问题。

### 2026-06-19 Gmail watch 自动续订定时任务不能重入

- 场景：`CrmGmailWatchRenewalService.onModuleInit` 会立即执行一次自动续订，并按 `CRM_GMAIL_WATCH_RENEWAL_INTERVAL_MS` 定时续订即将过期的 Gmail watch。
- 坑点：如果上一批 Gmail watch 续订还没结束，下一次 interval 又启动一批，会重复扫描同一批 mailbox，造成重复续订、重复日志或并发更新冲突。
- 正确做法：只在自动调度路径加 in-flight guard；`renewDueMailboxWatches()` 保持可显式调用，便于测试和人工触发。首批未结束时跳过新的 interval tick，结束后下一次 tick 再执行。
- 相关文件：`apps/server/src/modules/crm/crm-gmail-watch-renewal.service.ts`、`apps/server/src/modules/crm/crm-gmail-watch-renewal.service.spec.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-gmail-watch-renewal.service.spec.ts`，确认未完成的 scheduled renewal 不会被 interval 重入，完成后后续 tick 可继续执行。

### 2026-06-19 Gmail watch 自动续订调度失败要捕获并记录日志

- 场景：自动续订定时任务在调度入口调用 `renewDueMailboxWatches()`，批次开始阶段可能因为数据库查询、连接池或 store 层错误直接抛出。
- 坑点：如果只在每个 mailbox 循环里捕获错误，批次级错误会从 `void this.runScheduledRenewal()` 泄漏成 unhandled rejection，定时任务失败也没有业务日志可查。
- 正确做法：自动调度路径 `runScheduledRenewal()` 要 catch 批次级异常并写 `gmail-watch-auto-renew-scheduled-failed` 系统日志；显式调用 `renewDueMailboxWatches()` 保持抛错语义，避免隐藏人工触发或测试中的真实失败。
- 相关文件：`apps/server/src/modules/crm/crm-gmail-watch-renewal.service.ts`、`apps/server/src/modules/crm/crm-gmail-watch-renewal.service.spec.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-gmail-watch-renewal.service.spec.ts`，确认批次级 store 错误不会产生 unhandled rejection，并会写调度失败日志。

### 2026-06-19 Gmail watch 自动续订禁用开关要容忍空白和大小写

- 场景：生产或预发环境通过 `CRM_GMAIL_WATCH_RENEWAL_DISABLED=true` 临时关闭自动 watch 续订。
- 坑点：部署平台或人工配置可能写成 ` TRUE `、`True` 等形式；如果只按精确字符串比较，会导致以为已关闭但实际仍启动定时续订。
- 正确做法：读取 `CRM_GMAIL_WATCH_RENEWAL_DISABLED` 时先 `trim().toLowerCase()`，只把规范化后的 `true` 视为禁用；默认和其他值仍保持启用。
- 相关文件：`apps/server/src/modules/crm/crm-gmail-watch-renewal.service.ts`、`apps/server/src/modules/crm/crm-gmail-watch-renewal.service.spec.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-gmail-watch-renewal.service.spec.ts`，确认带空白和大小写变化的 disabled env 不会启动首批续订或 interval。

### 2026-06-19 Gmail watch 自动续订批大小 env 必须是正整数

- 场景：自动续订读取 `CRM_GMAIL_WATCH_RENEWAL_BATCH_SIZE` 后传给 store 的分页 `take`。
- 坑点：`Number('1.5')` 是有限正数，但 Prisma 分页 `take` 需要整数；如果小数透传，可能在运行期触发底层查询错误。
- 正确做法：interval/window 这类毫秒配置可按正数处理，`CRM_GMAIL_WATCH_RENEWAL_BATCH_SIZE` 必须使用正整数校验；非整数、非正数或非法值回退默认 50。
- 相关文件：`apps/server/src/modules/crm/crm-gmail-watch-renewal.service.ts`、`apps/server/src/modules/crm/crm-gmail-watch-renewal.service.spec.ts`。
- 验证方式：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-gmail-watch-renewal.service.spec.ts`，确认 `CRM_GMAIL_WATCH_RENEWAL_BATCH_SIZE=1.5` 时传给 store 的 `take` 回退为 50。

### 2026-06-21 status 文本列迁 enum 前要处理 partial index

- 场景：Prisma migration 把 PostgreSQL `status` 文本列改成 enum，表上存在依赖 `status IN (...)` 的 partial index，例如 `CrmSequenceEnrollment_active_contact_unique_idx`。
- 坑点：如果 migration 直接 `ALTER COLUMN "status" TYPE enum USING ...`，PostgreSQL 会重新解析 partial index 的 text 条件，可能报 `operator does not exist: "CrmSequenceEnrollmentStatus" = text`，并让本地库留下 enum type 已创建、部分列已转换、迁移记录 failed 的半执行状态。
- 正确做法：同一条 migration 里先 `DROP INDEX IF EXISTS` 依赖旧 text status 的 partial index，列转换完成后用 enum 字面量 cast 重建 partial index；本地半执行库恢复时先确认没有非法 status 值，手动补完剩余列转换和索引重建，再用 `pnpm prisma migrate resolve --applied <migration>` 标记后重新跑 `pnpm prisma migrate deploy`。
- 相关文件：`prisma/migrations/20260621010000_add_status_enums/migration.sql`、`prisma/migrations/20260619103000_create_crm_sequence_drafts/migration.sql`。
- 验证方式：运行 `pnpm prisma migrate deploy`，确认不再出现 P3009，且 `CrmSequenceEnrollment_active_contact_unique_idx` 的 WHERE 条件使用 `"CrmSequenceEnrollmentStatus"` enum cast。

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
