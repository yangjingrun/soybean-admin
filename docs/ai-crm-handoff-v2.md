# Handoff v2: AI 获客独立 CRM 邮件系统

更新时间：2026-06-19

项目路径：`/Users/yjr/Desktop/soybean-admin-naive`

本文件用于给新线程继续开发使用。新线程不要只看最终聊天摘要，应先读本文件，再读 `docs/agent-memory.md` 和当前 `git status --short`。

## 0. 当前上下文

用户目标：在当前项目中接入一个独立的多租户 Outbound CRM 邮件系统，用于承接现有 AI 获客结果，并完成联系人补全、邮箱验证、开发信序列、Gmail 收发同步、回信停发、收件箱处理、归档去重和时间线沉淀。

第一版不是简单群发工具，而是 SaaS 化 CRM 基础闭环：

```text
AI 获客任务
  -> 自动导入 CRM 线索
  -> Hunter 补全联系人
  -> 自建邮箱验证
  -> 发送前审核清单
  -> 第一封草稿人工确认
  -> Gmail 序列发送
  -> Gmail Push 同步回信
  -> 回信后停止同公司当前序列
  -> 收件箱纯文本回复
  -> 时间线/备注/状态沉淀
```

用户偏好：

- 使用中文沟通。
- 可以用多 Agent 并行，但必须先判断任务是否适合拆分。
- 子 Agent 不允许提交代码。
- 子 Agent 不要覆盖主 Agent 或其他子 Agent 的改动。
- 当前项目已经踩过不少坑，继续前必须读 `docs/agent-memory.md`。
- 用户希望 handoff 足够详细，能覆盖最初的一期、二期、三期设计，不只是当前 P0 缺口。

## 1. 当前工作区状态快照

上次检查时 `git status --short` 显示：

```text
 M apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts
 M apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.ts
 M apps/server/src/modules/crm/crm-gmail-provider.factory.spec.ts
 M apps/server/src/modules/crm/crm-gmail-provider.factory.ts
 M apps/server/src/modules/crm/crm-gmail-watch.service.spec.ts
 M apps/server/src/modules/crm/crm-gmail-watch.service.ts
 M apps/server/src/modules/crm/crm.controller.spec.ts
 M apps/server/src/modules/crm/crm.controller.ts
 M apps/server/src/modules/crm/crm.types.ts
 M docs/agent-memory.md
 M src/service/api/crm.ts
 M src/typings/api/crm.d.ts
 M src/views/ai-settings/index.vue
 M src/views/crm/email-sequences/modules/EmailSequenceManager.vue
 M src/views/crm/email-sequences/modules/EmailSequenceTable.vue
 M src/views/crm/email-sequences/modules/shared.ts
 M src/views/crm/email-sequences/modules/useEmailSequenceTable.ts
 M src/views/crm/settings/modules/BasicRulesCard.vue
 M src/views/crm/settings/modules/MailboxManager.vue
 M src/views/crm/settings/modules/MailboxTable.vue
 M src/views/crm/settings/modules/shared.ts
 M src/views/crm/settings/modules/useMailboxTable.ts
?? .env.example
?? docs/crm-gmail-deployment-checklist.md
?? docs/ai-crm-handoff-v2.md
?? src/views/crm/settings/modules/GlobalConfigCard.vue
?? src/views/crm/settings/modules/shared.spec.ts
```

注意：

- 当前有未提交改动和未跟踪文件。
- 不要随意 `git restore` 或 revert 这些改动。
- `docs/agent-memory.md` 已记录本轮和历史踩坑。
- 普通 commit hook 会跑 typecheck/lint/fmt，可能格式化大量无关文件；提交前必须严格检查 staged 文件。

## 2. 已明确产品决策

### 2.1 租户和权限

- 第一版直接改成组织体系。
- `Organization` 表示客户公司/团队。
- `User` 属于组织。
- 现有用户迁入默认组织。
- 所有 CRM 主数据必须带 `organizationId`。
- AI 获客结果默认归属创建任务的用户。
- 普通成员只能看自己的线索、邮箱、邮件正文和序列。
- 成员之间第一期不能互看邮件正文。
- 组织管理员可看组织内线索、序列和统计。
- 组织管理员是否可看成员邮件正文由后续组织配置决定。
- 组织管理员可暂停/停止成员序列。
- 组织管理员不能编辑正文、确认草稿、代发、代回复。
- 平台超管可跨组织查看邮件正文，客户无感。
- 第一版超管查看正文只做静默审计，不强制填写原因。
- 普通系统日志不记录邮件正文。

### 2.2 CRM 菜单

前端结构：

```text
CRM
  - 线索库
  - 邮件序列
  - 收件箱
  - CRM 配置
```

AI 获客功能组织成员都可用，组织管理员可看组织整体情况。

### 2.3 Gmail 集成

- 第一版采用平台统一 Google OAuth / Pub/Sub。
- 平台统一创建 Google Cloud Project、OAuth App、Pub/Sub topic/subscription。
- 客户不需要自己配置 Google Cloud。
- 客户组织内每个 Gmail 邮箱单独点击授权。
- 每个授权邮箱生成独立 token，绑定 `organizationId + ownerUserId + mailboxId + emailAddress`。
- token、client secret、API key 等敏感字段加密或脱敏处理。
- 同一个 Gmail 地址第一期禁止绑定多个组织。
- 第一版不支持 Gmail alias / send-as 独立邮箱。
- 后续大客户可增加自建 OAuth App 高级模式。

### 2.4 Gmail 同步策略

- Gmail Push / Pub/Sub 为主。
- 不做固定 30-60 分钟活跃邮箱轮询。
- Pub/Sub 消息只包含 `emailAddress` 和 `historyId`，不是邮件正文。
- 后端收到通知后，根据邮箱找到 `Mailbox`。
- 使用保存的 `lastHistoryId` 调 Gmail History API 增量拉取变化。
- 再按 message id 调 Gmail Message API 拉具体邮件。
- 必须支持 Gmail watch 续订。
- 必须支持 Pub/Sub 失败重试、historyId 异常补偿、用户手动立即同步。

### 2.5 邮箱验证缓存

用户最新明确要求：

- 邮箱验证缓存是全平台共享，不按组织隔离。
- 所有用户、所有组织只要验证过同一 email，就写入全局缓存。
- 下次任何人验证同一 email，如果仍在冷却期内，就跳过 DNS/MX 等重复验证。
- 默认冷却期 30 天。
- 冷却天数必须能后台配置。
- 全局缓存只保存 `emailHash`、脱敏邮箱、domain、status、reason、verifiedAt、expiresAt、checkedBy 等，不保存明文敏感内容。
- 这个全局缓存只用于“邮箱可用性结果复用”，不能影响 CRM 主数据隔离。
- CRM Account/Contact、邮件正文、时间线、黑名单、归档等仍按组织/成员权限隔离。

### 2.6 Hunter / Serper

- Hunter 和 Serper 支持平台默认 + 组织/用户配置。
- 第一版 Hunter 只做 Domain Search。
- 不做 Hunter Email Finder。
- 不做 Hunter Verifier。
- 没有官网域名不调用 Hunter。
- AI 获客返回的官网域名默认信任，只做格式、排除名单、同组织去重等轻量校验。
- 后台可配置官网排除名单，避免社媒、B2B 平台、目录站误用。
- Serper 第一版只用于现有 AI 获客搜索，邮件 CRM 阶段不额外调用 Serper。

### 2.7 邮件序列

默认序列：

```text
第 1 封：当天，新主题
第 2 封：3 天后，同线程 follow-up
第 3 封：7 天后，新主题
第 4 封：14 天后，可配置
第 5 封：21 天后，breakup / 最后一封
```

已明确：

- 自动模式也必须先确认首批发送清单。
- 清单确认后批量生成第一封草稿。
- 第一封必须人工审核。
- 默认批量审核 + 单条展开修改。
- 第 2-5 封按需生成，不提前浪费 token。
- 后续低风险可自动发送，高风险进入人工确认。
- 风险包括价格、MOQ、交期、认证、低置信职位、公共邮箱、accept-all/risky、AI 新增链接、偏离模板。
- 第一版默认纯文本。
- 第一封默认不放链接。
- 第 2/3 封后可按模板配置允许原始链接。
- 不做点击追踪。
- 打开追踪组织级允许后才可在序列启用，默认关闭，只作为弱信号。
- 第一版不支持附件。

### 2.8 同公司多联系人

- 同公司单日最多联系 2 人。
- 默认按职位优先级和综合评分排序。
- 默认第 3 封后可启动第二联系人。
- 默认继续第一个联系人序列，但组织/序列可配置暂停或停止。
- 任一联系人回复后，停止该公司当前所有序列。
- 同公司多联系人邮件必须按职位画像差异化，并做重复度检查。

### 2.9 职位画像

原始职位画像：

```text
Owner / Founder：利润、增长、差异化、长期合作
Purchasing Manager：价格、MOQ、交期、付款方式
Sourcing Manager：新供应商、样品、认证、风险控制
Product Manager：产品卖点、设计、功能、上新速度
Category Manager：SKU 补充、毛利、市场趋势
Sales Director：产品是否好卖、渠道接受度
Project Manager：定制、项目节点、交付稳定
Operations Manager：库存、物流、补货效率
```

职位优先联系策略：

- 优先联系公司内个人邮箱。
- 职位按高到低排序联系。
- 公共邮箱进入人工确认，不自动发送。

### 2.10 收件箱和回信

- 第一版收件箱做待处理回复列表。
- 未读/已读双向同步。
- CRM 另有独立待处理/已处理状态。
- 查看完整线程。
- 系统内纯文本回复。
- 不支持附件。
- 不支持 AI 回复草稿。
- Gmail 外部手动回复同步进 CRM 时间线。
- 客户回信后统一标记“已回复待处理”。
- 客户回信后停止同公司当前所有序列。
- 创建站内通知和收件箱待处理数。
- 第一版不自动判断高意向。
- 明确退订关键词除外。

### 2.11 退订、拒绝、退信

- 自然退订语句按模板配置。
- 客户回复 `remove me / unsubscribe / not interested / stop` 时：
  - 拉黑该邮箱。
  - 停止当前公司这次开发序列。
  - 不自动永久拉黑整个公司域名。
  - 记录触发邮件和原因。
- Gmail 同步到 `mailer-daemon / postmaster / Delivery Status Notification` 后解析退信。
- hard bounce 标记邮箱不可达并停止联系人序列。
- soft bounce 标记临时异常，可重试或人工确认。
- 不自动拉黑公司或域名。

### 2.12 归档和生命周期

- 第一期删除实际为归档。
- 归档后 30 天内可恢复完整线索。
- 超过 30 天自动瘦身。
- 瘦身后不可恢复为完整线索。
- 归档记录继续参与去重、黑名单、不可达、历史触达判断。
- 用户最新明确：归档后保留域名和关键信息，减少占用，同时后续 AI 获客去重仍能用。

瘦身后保留：

```text
公司域名
公司名摘要/规范化名称
国家/地区
脱敏邮箱
邮箱 hash
黑名单/退订/不可达状态
历史是否触达
最后触达时间
来源任务 ID
归档原因
归档时间
```

清理：

```text
冗余页面证据
AI 草稿
Hunter 原始长结果
非审计必需长文本
非必要邮件正文摘要
```

## 3. 今日 Git 提交完成步骤清单

本节根据 2026-06-19 当天 Git 提交整理，记录“已经提交到 Git 历史里的完成步骤”。这部分不等于当前工作区全部内容；当前仍有未提交改动，继续开发前必须重新看 `git status --short`。

### 3.1 CRM 配置、邮箱、产品线基础

1. `ff07be10 feat: 增加 CRM 邮箱账号地基`
   - 完成 `CrmMailbox` 基础数据模型和 Prisma 迁移。
   - 完成邮箱列表、mock 授权基础接口、邮箱状态字段、每日/每小时额度字段、warmupStage 字段。
   - 完成 CRM 配置页邮箱管理基础 UI：授权弹窗、邮箱表格、筛选工具栏。
   - 完成前端 CRM mailbox API 类型和接口。

2. `9e21ee98 feat: 增加 CRM 产品线资料库`
   - 完成 `CrmProductLine` 数据模型和迁移。
   - 完成产品线后端 CRUD、归档、查询 DTO、service/store/controller 测试。
   - 完成前端产品线列表、筛选、表单弹窗、创建、更新、归档。
   - 产品线字段覆盖产品名称、目标客户、卖点、MOQ、交期、付款方式、认证、目录链接、官网链接、常见型号文本。

### 3.2 首封草稿审核和发送队列

3. `5a7caf40 feat: 增加 CRM 首封草稿审核`
   - 完成 `CrmSequenceEnrollment`、`CrmMessage` 等序列草稿相关模型和迁移。
   - 完成创建首封开发信草稿、编辑草稿、确认草稿、序列审核列表和详情。
   - 完成首封草稿审核前端：列表、创建弹窗、审核抽屉、保存、确认。
   - 完成草稿事务化、owner-only 审核等基础安全规则。

4. `baf6b308 feat: 增加 CRM 首封发送队列`
   - 完成 BullMQ 发送队列、发送 worker host、发送 worker service。
   - 完成首封确认后启动发送、queued 状态、bullJobId、worker guard。
   - 完成 runVersion 防旧 job 机制。
   - 完成首封发送前后状态流转和相关测试。

5. `e4f58228 feat: 增加 CRM 邮箱发送额度账本`
   - 完成 `CrmMailboxSendUsage` 模型和迁移。
   - 完成 worker 发送前 claim 每日/每小时额度。
   - 完成额度满时不发送、不重复扣额度的测试。
   - 当前额度账本偏保守：claim 后发送失败暂不释放额度。

### 3.3 收件箱、回信、退订和退信

6. `68d15397 实现 CRM 收件箱前端`
   - 完成收件箱前端模块拆分。
   - 完成回复线程列表、筛选、统计、详情抽屉、消息展示等 UI。
   - 完成前端 inbox API 类型和调用。

7. `33f65cc3 feat: 增加 CRM 收件箱和序列停发`
   - 完成 `CrmInboxThread`、`CrmInboxMessage` 模型和迁移。
   - 完成 mock 回信入库、线程列表/详情、状态更新。
   - 完成客户回信后停止当前序列的基础逻辑。
   - 完成邮件序列页面和收件箱的基础联动。

8. `43123be7 feat: 增加 CRM 退订回信处理`
   - 完成退订关键词/退订意图识别基础。
   - 完成退订回信后联系人状态、Account 状态、时间线更新。
   - 完成退订相关前后端状态展示。

9. `34e8290c feat: 增加 CRM 退信处理`
   - 完成退信/bounce 分类基础。
   - 完成 hard/soft bounce 相关联系人状态和线索状态更新。
   - 完成收件箱详情和线索状态展示补充。

10. `d2a60f78 feat: 增加 CRM 收件箱纯文本回复`
    - 完成系统内纯文本回复后端接口和 DTO。
    - 完成回复发送网关接口扩展。
    - 完成回复入库、线程状态更新、时间线/日志记录。
    - 完成收件箱详情抽屉里的纯文本回复 UI。

11. `352b61df feat: 持久化 CRM 邮件 provider 标识`
    - 完成 outbound `CrmMessage.providerMessageId/providerThreadId` 字段和迁移。
    - 完成发送成功后保存 Gmail provider id。
    - 为后续 Gmail History 回信匹配提供基础。

12. `9ccc5114 feat: 增加 CRM 回信入库幂等`
    - 完成按 `providerMessageId` 幂等入库。
    - 避免 Pub/Sub 至少一次投递、worker 重试、并发通知导致重复线程/重复通知。
    - 完成重复回信跳过通知和时间线的测试。

### 3.4 Gmail Pub/Sub、History、Watch 和真实网关

13. `8f025ee5 feat: 增加 CRM Gmail 同步入口底座`
    - 完成 Gmail Pub/Sub payload parser。
    - 完成 Gmail history sync queue。
    - 完成同步 job id 规则和基础类型。

14. `75a8d934 feat: 增加 CRM Gmail PubSub webhook`
    - 完成 Pub/Sub webhook controller/service。
    - 完成按 email 找 mailbox，active mailbox 入队 history sync。
    - 完成未找到 mailbox、非 active mailbox 的跳过结果。

15. `2fb31247 feat: 增加 CRM Gmail History 同步 worker`
    - 完成 Gmail History sync worker host/service。
    - 完成按 mailbox checkpoint 增量同步的 worker 骨架。
    - 完成 worker 运行期错误日志基础。

16. `fda97567 feat: 接入 CRM Gmail History 回信入库`
    - 完成 History worker 将 Gmail message 转换为 CRM customer reply 入库。
    - 完成 History 同步后推进 mailbox checkpoint。
    - 完成相关 store/service 测试。

17. `340c4e7d 补齐CRM邮箱同步状态展示`
    - 完成邮箱表格里的 watch/sync 状态展示。
    - 完成 watch 过期、即将过期、未开启等前端状态文案。

18. `fd851cf8 feat: 增加 CRM Gmail watch 续订骨架`
    - 完成 watch gateway/service/controller 的续订骨架。
    - 完成手动 renew watch 接口基础。
    - 完成相关 controller/service 测试。

19. `608e1069 feat: 增加 CRM Gmail 线程回信匹配`
    - 完成按 Gmail providerThreadId 匹配已发送邮件。
    - 完成按 replyToProviderMessageId 优先匹配的接口基础。
    - 强化 History worker 找 outbound message 的逻辑。

20. `6510d695 feat: 接入 CRM Gmail watch 续订操作`
    - 完成前端邮箱列表中的手动续订 watch 操作。
    - 完成 `renewCrmMailboxWatch` API 和类型。
    - 完成 watch 操作按钮、状态刷新。

21. `de95e5a9 feat: 增加 CRM Gmail 授权失效处理`
    - 完成 Gmail 授权失效错误类型。
    - 完成 watch 续订遇到授权失效时标记 mailbox `auth_expired`。
    - 完成授权失效站内通知和日志。

22. `e9858e94 feat: 增加 CRM Gmail 消息解析器`
    - 完成 Gmail Message API payload 解析。
    - 完成正文提取、snippet/subject/from/date/message id/thread id 等基础解析。
    - 完成退订/退信分类器基础。

23. `4649e3aa feat: 增加 CRM Gmail History API 网关`
    - 完成真实 Gmail History API gateway。
    - 完成 History list、messageAdded 收集、message full 拉取。
    - 完成 sent-only message 跳过基础。

24. `d68ab6ee feat: 增加 CRM Gmail OAuth token provider`
    - 完成 refresh token 加密/解密和 access token 刷新 provider。
    - 完成 token encryption key 校验和 token 请求测试。

25. `94274108 feat: 支持 CRM Gmail refresh token 入库`
    - 完成 Mailbox 保存 encryptedRefreshToken 字段和迁移。
    - 完成授权回调后 refresh token 入库。
    - 完成相关生成 Prisma client 同步。

26. `d22aeb75 feat: 接入 CRM Gmail OAuth 授权入口`
    - 完成 Gmail OAuth URL 生成。
    - 完成 OAuth callback DTO、controller、service。
    - 完成 OAuth state 签名和校验。
    - 完成隐藏回调页 `/crm/gmail-oauth-callback`。
    - 完成前端授权流程从弹窗改为 Google OAuth 跳转。

27. `247465ff feat: 接入 CRM Gmail 真实 watch 网关`
    - 完成真实 Gmail watch gateway。
    - 完成 provider factory 选择真实 watch/mock watch。
    - 完成 Gmail 403 reason 解析基础。

28. `35ab7d95 feat: Gmail OAuth 完成后自动续订 watch`
    - 完成 OAuth 成功后立即 renew watch。
    - 完成 OAuth callback 返回 mailbox/watch 结果。

29. `a0af15c7 feat: 接入 CRM Gmail 真实发送网关`
    - 完成真实 Gmail `messages.send` 网关。
    - 完成纯文本 MIME 构建、Subject 编码、base64url raw。
    - 完成系统内回复复用 Gmail threadId 的发送接口基础。

30. `d2c80e6b feat: 发送时处理 Gmail 授权失效`
    - 完成发送 worker 遇到 Gmail 授权失效时标记 mailbox `auth_expired`。
    - 完成暂停相关待发送邮件和站内通知。

31. `f477d3e0 fix: 避免 Gmail History 限流误判授权失效`
    - 修复 Gmail History 403 限流不应误判为授权失效。
    - 只对 auth/permission 类 reason 抛授权失效。

### 3.5 后续开发信步进、多封草稿和序列 UI

32. `5e433968 feat: 首封发送后生成下一封跟进草稿`
    - 完成首封发送成功后生成下一封 follow-up 草稿。
    - 完成 scheduledAt、same_thread、providerThreadId 继承等基础字段。

33. `75608525 feat: 邮件序列审核支持多封草稿查看`
    - 完成审核抽屉查看同一 enrollment 下多封 messages。
    - 完成前端切换不同 step 草稿。
    - 完成 API 类型和后端 view 补充。

34. `8e3070eb feat: 支持后续开发信发送步进`
    - 完成 worker 按 job.messageId 定位目标邮件。
    - 完成 step 2/3/4/5 queued message 的 claim/send/complete。
    - 完成发送完成后 `currentStep` 按目标 step 更新。

35. `ba5fa3a9 feat: 后续草稿确认后入队发送`
    - 完成后续草稿人工确认后按 scheduledAt 延迟入队。
    - 完成 follow-up 草稿确认状态流转和失败回滚。
    - 完成前端审核按钮适配后续草稿。

36. `55e2b569 fix: 停止序列时跳过全部待发邮件`
    - 修复停止序列时只跳过单封 queued message 的问题。
    - 改为跳过该序列全部待发 queued message。

37. `74fe3ab5 feat: 强化 CRM 回信停发和 Gmail 同步安全`
    - 强化客户回信后停止同公司当前所有 active 序列。
    - 强化 Pub/Sub webhook secret 校验和非 active mailbox 跳过。
    - 强化 History worker 授权失效处理。
    - 强化邮件序列前端状态展示和操作状态判断。

38. `bd93aa23 feat: 串联线索到开发信创建`
    - 完成从线索详情联系人行跳转邮件序列创建。
    - 完成 query 预填 `accountId/contactId`。
    - 完成创建弹窗联系人/产品线/邮箱资源加载的状态处理。

39. `1d5141b3 feat: 增强邮件序列状态扫读`
    - 完成邮件序列列表状态展示增强。
    - 完成更细的状态文案、tag 类型、操作可用性判断。
    - 增加前端 shared spec。

### 3.6 Hunter、邮箱验证缓存、黑名单和归档指纹

40. `232a8fff feat: 接入 Hunter 联系人补全`
    - 完成 HunterConfig 模型和迁移。
    - 完成 Hunter API 配置、保存、测试。
    - 完成 Hunter Domain Search client。
    - 完成 AI 获客 worker 导入 CRM 前 best-effort 补全联系人。
    - 完成 Hunter 失败不阻断 CRM 导入。

41. `dd8733cb feat: 缓存 CRM 邮箱验证`
    - 完成全平台共享 `CrmEmailVerificationCache` 模型和迁移。
    - 完成 `CrmGlobalConfig.emailVerificationCooldownDays` 模型和迁移。
    - 完成邮箱验证前先查全局缓存，冷却期内跳过 DNS/MX。
    - 完成超管配置冷却天数的后端接口和前端配置入口。
    - 完成导入联系人和手动验证联系人时复用缓存。

42. `8d882737 feat: 增加 CRM 退订黑名单`
    - 完成 `CrmBlacklist` 模型和迁移。
    - 完成退订回信 upsert 组织级黑名单。
    - 完成创建序列、开始发送、worker claim 前拦截黑名单联系人。
    - 完成组织级黑名单隔离。

43. `3447cbb3 feat: 增加 CRM 归档指纹`
    - 完成 `CrmArchivedFingerprint` 模型和迁移。
    - 完成归档时写 domain/email_hash 指纹。
    - 完成后续导入命中组织归档指纹时写时间线提醒。
    - 保持成员主记录私有，不复用其他成员的完整 Account/Contact。

### 3.7 当前线程新增完成步骤（尚未提交）

44. Gmail watch 自动续订后台服务
    - 新增 `CrmGmailWatchRenewalService`，模块启动后自动扫描需要续订的 active Gmail mailbox。
    - 默认每 6 小时执行一次，续订 24 小时内到期或尚未初始化 watch 的邮箱。
    - 支持环境变量：
      - `CRM_GMAIL_WATCH_RENEWAL_DISABLED=true` 禁用自动续订。
      - `CRM_GMAIL_WATCH_RENEWAL_INTERVAL_MS` 调整执行间隔。
      - `CRM_GMAIL_WATCH_RENEWAL_WINDOW_MS` 调整提前续订窗口。
      - `CRM_GMAIL_WATCH_RENEWAL_BATCH_SIZE` 调整每批扫描数量。
    - 自动续订只更新 `watchExpiration`；如果 mailbox 已有 `lastHistoryId`，不会推进 checkpoint，避免跳过历史回信。
    - 如果 mailbox 没有 `lastHistoryId`，自动续订会用 Gmail 返回的 `historyId` 初始化 checkpoint。
    - Gmail 授权失效时调用统一 `markMailboxAuthorizationExpired` 流程，标记 `auth_expired`、暂停相关待发送序列、重置 queued message，并创建站内通知。
    - 单个 mailbox 续订失败不会阻断同批其他邮箱。
    - 已补测试：
      - `apps/server/src/modules/crm/crm-gmail-watch-renewal.service.spec.ts`
      - `apps/server/src/modules/crm/crm-gmail-watch.service.spec.ts`
    - 已通过验证：
      - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-gmail-watch-renewal.service.spec.ts apps/server/src/modules/crm/crm-gmail-watch.service.spec.ts`
      - `pnpm --filter @soybean/server typecheck`
    - 涉及文件：
      - `apps/server/src/modules/crm/crm-gmail-watch-renewal.service.ts`
      - `apps/server/src/modules/crm/crm-gmail-watch-renewal.service.spec.ts`
      - `apps/server/src/modules/crm/crm.module.ts`
      - `apps/server/src/modules/crm/crm.types.ts`
      - `apps/server/src/modules/crm/store/prisma-crm.store.ts`
      - `apps/server/src/modules/crm/crm.service.spec.ts`

45. Pub/Sub webhook 生产安全加固
    - 生产环境 `NODE_ENV=production` 下，如果没有配置 `CRM_GMAIL_PUBSUB_PUSH_SECRET`，`/crm/gmail/pubsub/push` 会直接拒绝请求。
    - 保留非生产环境的本地调试便利：非 production 且未配置 secret 时仍可走测试/本地流程。
    - 配置了 `CRM_GMAIL_PUBSUB_PUSH_SECRET` 时，无论环境如何，请求头 `x-crm-gmail-pubsub-secret` 必须匹配。
    - 已修正部署清单中的 Pub/Sub push endpoint：实际路径是 `/crm/gmail/pubsub/push`。
    - 已补测试：
      - `apps/server/src/modules/crm/crm-gmail-webhook.controller.spec.ts`
    - 已通过验证：
      - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-gmail-webhook.controller.spec.ts`
      - `pnpm --filter @soybean/server typecheck`
    - 涉及文件：
      - `apps/server/src/modules/crm/crm-gmail-webhook.controller.ts`
      - `apps/server/src/modules/crm/crm-gmail-webhook.controller.spec.ts`
      - `docs/crm-gmail-deployment-checklist.md`

46. Gmail History expired 补偿告警
    - 修改 Gmail History sync worker：遇到 `CrmGmailHistoryExpiredError` 时不再静默推进 mailbox checkpoint。
    - 保持原 `lastHistoryId` 不动，返回 `history_expired` 跳过结果，避免把未同步历史误标为已处理。
    - 新增系统日志 `gmail-history-expired`，记录 mailbox、maskedEmail、fromHistoryId、toHistoryId、pubsubMessageId。
    - 新增站内通知 `crm_gmail_history_expired`，提醒邮箱 owner 需要重新授权、手动同步或联系管理员处理。
    - 已补测试：
      - `apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts`
    - 已通过验证：
      - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts`
      - `pnpm --filter @soybean/server typecheck`
    - 涉及文件：
      - `apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.ts`
      - `apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts`

47. 生产部署配置补齐
    - `.env.example` 补充前端 API 地址：
      - `VITE_SERVICE_BASE_URL`
      - `VITE_OTHER_SERVICE_BASE_URL`
    - `.env.example` 补充后端生产 CORS：
      - `SERVER_CORS_ORIGINS`
    - `.env.example` 补充 Gmail watch 自动续订配置：
      - `CRM_GMAIL_WATCH_RENEWAL_DISABLED`
      - `CRM_GMAIL_WATCH_RENEWAL_INTERVAL_MS`
      - `CRM_GMAIL_WATCH_RENEWAL_WINDOW_MS`
      - `CRM_GMAIL_WATCH_RENEWAL_BATCH_SIZE`
    - 后端 CORS 改为支持 `SERVER_CORS_ORIGINS`，多个生产前端域名可用英文逗号分隔。
    - `apps/server/package.json` 新增 `build` script：`nest build`。
    - `docker-compose.yml` 新增 Redis 服务和持久化 volume，供 BullMQ 发送队列、Gmail history sync worker 使用。
    - `docs/crm-gmail-deployment-checklist.md` 补充前端 env、CORS、Redis、Prisma generate/migrate、server build、Pub/Sub endpoint、watch 自动续订检查。
    - 已通过验证：
      - `pnpm --filter @soybean/server typecheck`
      - `node -e "JSON.parse(require('fs').readFileSync('apps/server/package.json','utf8')); console.log('ok')"`
    - 涉及文件：
      - `.env.example`
      - `apps/server/src/main.ts`
      - `apps/server/package.json`
      - `docker-compose.yml`
      - `docs/crm-gmail-deployment-checklist.md`

48. auth_expired 邮箱行级重新授权
    - 邮箱表格中 `auth_expired` Gmail 邮箱的“重新授权”按钮已从禁用提示改为可点击操作。
    - 行级重新授权复用现有 Google OAuth URL 创建和跳转流程，OAuth callback 仍按 Gmail 地址更新当前用户邮箱记录。
    - 暂停或其他非 active / 非 auth_expired 状态仍不允许误触发重新授权。
    - 已通过验证：
      - `pnpm typecheck`
      - `pnpm exec eslint --max-warnings=0 .`
      - `pnpm exec oxlint src/views/crm/settings/modules/MailboxManager.vue src/views/crm/settings/modules/MailboxTable.vue src/views/crm/settings/modules/useMailboxTable.ts`
      - `git diff --check`
    - 涉及文件：
      - `src/views/crm/settings/modules/useMailboxTable.ts`
      - `src/views/crm/settings/modules/MailboxManager.vue`
      - `src/views/crm/settings/modules/MailboxTable.vue`

49. 手动新增/导入 CRM 线索入口
    - 线索库新增“新增线索”入口，打开手动导入弹窗。
    - 弹窗支持录入公司名称、官网、国家/地区、客户类型和一个联系人。
    - 前端复用既有 `/crm/accounts/import-lead` 后端接口；导入成功后刷新列表并打开新线索详情。
    - payload 会 trim 表单字段；联系人字段为空时不传 `contact`，避免创建空联系人。
    - 已通过验证：
      - `pnpm typecheck`
      - `pnpm exec tsx --test src/views/crm/leads/modules/shared.spec.ts`
      - `pnpm exec oxlint src/views/crm/leads/index.vue src/views/crm/leads/modules/LeadImportModal.vue src/views/crm/leads/modules/shared/useLeadTable.ts src/views/crm/leads/modules/shared.ts src/service/api/crm.ts src/typings/api/crm.d.ts`
    - 涉及文件：
      - `src/service/api/crm.ts`
      - `src/typings/api/crm.d.ts`
      - `src/views/crm/leads/index.vue`
      - `src/views/crm/leads/modules/LeadImportModal.vue`
      - `src/views/crm/leads/modules/shared.ts`
      - `src/views/crm/leads/modules/shared.spec.ts`
      - `src/views/crm/leads/modules/shared/useLeadTable.ts`

50. 黑名单/退订管理页
    - CRM 配置页新增退订黑名单只读管理区块。
    - 后端新增组织级黑名单分页查询接口，只返回脱敏邮箱、原因、来源和时间，不暴露 `emailHash`。
    - 前端支持关键词搜索、分页、原因标签和来源线索展示。
    - 当前只做只读管理；解除黑名单属于高风险操作，后续应结合审计和权限单独设计。
    - 已通过验证：
      - `pnpm --filter @soybean/server typecheck`
      - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.controller.spec.ts apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts`
      - `pnpm typecheck`
      - `pnpm exec tsx --test src/views/crm/settings/modules/shared.spec.ts`
      - `pnpm exec oxlint src/views/crm/settings/modules/BlacklistManager.vue src/views/crm/settings/modules/BlacklistTable.vue src/views/crm/settings/modules/BlacklistToolbar.vue src/views/crm/settings/modules/useBlacklistTable.ts src/views/crm/settings/modules/shared.ts src/views/crm/settings/modules/MailboxManager.vue src/service/api/crm.ts src/typings/api/crm.d.ts`
    - 涉及文件：
      - `apps/server/src/modules/crm/crm.controller.ts`
      - `apps/server/src/modules/crm/crm.service.ts`
      - `apps/server/src/modules/crm/crm.types.ts`
      - `apps/server/src/modules/crm/dto/crm-blacklist-query.dto.ts`
      - `apps/server/src/modules/crm/store/prisma-crm.store.ts`
      - `src/service/api/crm.ts`
      - `src/typings/api/crm.d.ts`
      - `src/views/crm/settings/modules/BlacklistManager.vue`
      - `src/views/crm/settings/modules/BlacklistTable.vue`
      - `src/views/crm/settings/modules/BlacklistToolbar.vue`
      - `src/views/crm/settings/modules/MailboxManager.vue`
      - `src/views/crm/settings/modules/shared.ts`
      - `src/views/crm/settings/modules/useBlacklistTable.ts`

51. 发送队列/同步日志运维薄视图
    - CRM 配置页新增“运维概览”只读区块，展示近期队列中/发送失败消息和 Gmail 同步/续订健康。
    - 前端复用现有 `sequence-review-items` 和 `mailboxes` 接口，不新增队列历史表或日志接口。
    - 发送侧展示客户、联系人、邮箱、步骤、状态、`bullJobId`、`runVersion`、计划/发送时间。
    - 同步侧展示邮箱授权状态、watch 到期状态、Gmail history checkpoint 和更新时间。
    - 当前视图是基于现有状态字段的薄视图；完整 BullMQ 历史、重试次数和系统日志详情仍属于后续增强。
    - 已通过验证：
      - `pnpm typecheck`
      - `pnpm exec tsx --test src/views/crm/settings/modules/shared.spec.ts`
      - `pnpm exec oxlint src/views/crm/settings/modules/CrmOperationsPanel.vue src/views/crm/settings/modules/useCrmOperationsPanel.ts src/views/crm/settings/modules/shared.ts src/views/crm/settings/modules/shared.spec.ts src/views/crm/settings/modules/MailboxManager.vue`
      - `pnpm exec eslint --max-warnings=0 .`
      - `git diff --check`
    - 涉及文件：
      - `src/views/crm/settings/modules/CrmOperationsPanel.vue`
      - `src/views/crm/settings/modules/MailboxManager.vue`
      - `src/views/crm/settings/modules/shared.ts`
      - `src/views/crm/settings/modules/shared.spec.ts`
      - `src/views/crm/settings/modules/useCrmOperationsPanel.ts`

## 4. 当前代码已实现能力概览

后端已实现较多基础闭环：

- 多租户 CRM 基础模型：Organization、Account、Contact、Mailbox、Enrollment、Message、Inbox、Timeline。
- `organizationId + ownerUserId` 贯穿 CRM 主对象。
- AI 获客任务保存 organization 上下文。
- AI 获客完成后可导入 CRM。
- Hunter Domain Search 可补全联系人。
- CRM 线索库：导入、列表、详情、状态变更、备注、归档、归档指纹提醒。
- 全平台邮箱验证缓存：`CrmEmailVerificationCache`，按 `emailHash` 唯一。
- 邮箱验证逻辑：格式、公共邮箱、MX/DNS。
- Gmail OAuth URL / callback。
- Gmail refresh token 加密存储。
- 同 Gmail 地址全局唯一，禁止跨组织重复绑定。
- Gmail watch 手动续订和手动同步。
- Gmail Pub/Sub webhook。
- Gmail History sync queue 和 worker。
- Gmail message parsing。
- 回信入库幂等。
- 首封草稿生成、编辑、确认、发送队列。
- BullMQ worker guard、runVersion、防旧 job。
- 邮箱每日/每小时额度账本。
- 发送成功后生成下一封 follow-up 草稿。
- 回信入库、退订/退信识别、同公司当前序列停发。
- 组织级黑名单。
- 收件箱线程列表、详情、状态、纯文本回复。
- Mock 调试接口默认关闭。

前端已实现较多页面闭环：

- CRM 一级菜单和四个子菜单。
- `/crm/leads` 线索库。
- `/crm/email-sequences` 邮件序列。
- `/crm/inbox` 收件箱。
- `/crm/settings` CRM 配置。
- `/crm/gmail-oauth-callback` 隐藏回调页。
- 线索库支持远程分页/筛选、详情抽屉、状态修改、备注、归档、联系人邮箱验证、从联系人创建序列。
- 邮件序列支持列表、创建首封草稿、跨页面预填、审核抽屉、保存/确认草稿、启动发送、停止序列、查看后续邮件。
- 收件箱支持列表、筛选、详情、待处理统计、正文查看、状态更新、纯文本回复。
- CRM 配置支持 Gmail 授权、OAuth 回调、邮箱列表、暂停/恢复、续订 watch、立即同步、产品线 CRUD、默认模板只读展示、全局邮箱验证冷却期配置。
- CRM 配置支持退订黑名单只读分页管理。
- CRM 配置支持发送队列和 Gmail 同步/续订只读运维概览。
- AI 设置页支持模型、Serper、Hunter 配置。

## 5. 第一期 1A 对照：组织体系 + CRM 线索库

### 原计划

- Organization 改造。
- CRM 菜单。
- AI 获客自动导入 Account/Contact。
- 去重、归档、状态、备注、时间线基础。
- 组织成员、组织管理员、平台超管权限。

### 当前已实现

- `Organization`、`SystemUser.organizationId`、`organizationRole` 已存在。
- CRM Account/Contact/Timeline 等带 `organizationId`。
- 普通成员按 owner scope 看自己的数据。
- 组织管理员读列表/详情时可走组织 scope。
- 平台超管角色已有相关判断路径。
- CRM 菜单已接入。
- AI 获客任务带 organization 快照，worker 可用该上下文导入 CRM。
- AI 获客结果可导入 Account/Contact。
- Account 按成员私有维度查重，避免普通成员看到其他成员私有记录。
- Contact 按 `organizationId + ownerUserId + emailHash` 唯一。
- 归档指纹 `CrmArchivedFingerprint` 已实现，按组织维度用于历史提醒。
- 线索状态、备注、时间线基础已实现。
- 联系人邮箱导入后会触发邮箱验证，并写时间线。

### 当前半成品

- 组织管理员可见范围已开始做，但“管理员是否可看成员邮件正文由组织配置决定”未看到完整配置项。
- 平台超管可跨组织查看正文的静默审计，不确定是否所有正文读取路径都已记录专门审计事件。
- 归档 30 天恢复和 30 天后自动瘦身，当前只看到归档和归档指纹，自动瘦身/恢复完整生命周期未完全确认。

### 当前未完成

- 组织级权限配置页。
- 组织管理员邮件正文可见策略配置。
- 超管查看正文的完整审计闭环。
- 归档 30 天自动瘦身定时任务。
- 归档后 30 天内恢复完整线索的前端入口和后端完整流程。
- 组织级历史触达提醒的产品化 UI。

### 风险点

- Account/Contact 不能改成组织级唯一，否则会泄漏成员私有数据。
- 归档指纹是组织级历史提醒，不应复用其他成员主记录。
- 邮箱验证缓存是全平台共享，但不能把这个共享逻辑误用到联系人主数据。

### 关键文件

- `prisma/schema.prisma`
- `apps/server/src/modules/crm/crm.service.ts`
- `apps/server/src/modules/crm/store/prisma-crm.store.ts`
- `apps/server/src/modules/ai-leads/ai-lead-crm-import.adapter.ts`
- `apps/server/src/modules/ai-leads/ai-lead-search-task-worker.service.ts`
- `src/views/crm/leads/index.vue`
- `src/views/crm/leads/modules/*`
- `src/service/api/crm.ts`
- `src/typings/api/crm.d.ts`

## 6. 第一期 1B 对照：Gmail 授权 + Push 同步 + 收件箱

### 原计划

- 平台统一 OAuth。
- Gmail 授权和 Mailbox。
- Pub/Sub + History 增量同步。
- watch 续订、异常补偿、手动同步。
- 收件箱、已读同步、纯文本回复。
- 回信识别和站内通知。

### 当前已实现

- Gmail OAuth URL / callback 已实现。
- Gmail refresh token 加密存储。
- 同 Gmail 地址通过 `provider + emailHash` 全局唯一。
- `Mailbox` 有 status、dailyLimit、hourlyLimit、warmupStage、encryptedRefreshToken、lastHistoryId、watchExpiration。
- OAuth 后可续订 watch。
- 邮箱列表、暂停、恢复、手动 renew watch、手动 sync now 已有接口和前端。
- Pub/Sub push controller/service 已有。
- Pub/Sub payload 解析已有。
- History sync queue 和 worker 已有。
- worker 会跳过非 active mailbox。
- worker 会处理授权失效并标记 mailbox `auth_expired`。
- Gmail History gateway、Message API 拉取、message parser 已有。
- 系统内纯文本回复已有。
- 回信入库后创建站内通知。
- 回信后停止同公司当前序列。
- 收件箱列表、详情、状态更新、纯文本回复前端已接。

### 当前半成品

- Gmail provider factory 在非完整配置下会退回 mock/null provider。
- mock history gateway 返回空消息。
- mock watch gateway 返回模拟 history/expiration。
- mock send gateway 返回 `mock:*` provider id。
- mock HTTP 调试接口仍保留，但默认关闭且限制 R_SUPER。
- Gmail 已读/未读双向同步没有充分确认，当前更多是 CRM 独立待处理/已处理状态。
- Gmail 外部手动发送回复同步进 CRM 时间线的能力依赖 History 能识别 SENT/线程，目前实现重点偏客户回信。

### 当前未完成

- Gmail watch 自动定时续订任务。
- 生产环境 Pub/Sub webhook 强制 secret 配置。
- Google Pub/Sub push OIDC/JWT 验证。
- History checkpoint expired 后的可靠补偿同步。
- Gmail 已读/未读双向同步完整实现和 UI。
- Gmail label change 处理。
- Gmail 删除/归档状态同步策略的完整测试。
- Gmail 外部手动发送回复后同步入 CRM 时间线的完整验收。
- auth_expired 邮箱行级重新授权交互。
- Gmail webhook/history 同步日志和失败重试可视化页面。

### 风险点

- 如果 `CRM_GMAIL_PUBSUB_PUSH_SECRET` 未配置，当前 webhook 可能接受任意请求。
- History 过期时当前逻辑可能推进 checkpoint 并跳过消息，存在漏回信风险。
- Gmail message parser 主要依赖 `providerThreadId` 匹配，`In-Reply-To/References` 支持需确认。
- 系统内回复是先 Gmail 发送再 DB 入库，DB 失败会出现 Gmail 已发但 CRM 无记录。
- 非 production 配置不完整时使用 mock gateway，预发环境可能误以为真实 Gmail 已接通。

### 关键文件

- `apps/server/src/modules/crm/crm-gmail-oauth-flow.ts`
- `apps/server/src/modules/crm/crm-gmail-oauth-token.provider.ts`
- `apps/server/src/modules/crm/crm-gmail-provider.factory.ts`
- `apps/server/src/modules/crm/crm-gmail-watch.service.ts`
- `apps/server/src/modules/crm/crm-gmail-watch.gateway.ts`
- `apps/server/src/modules/crm/crm-gmail-webhook.controller.ts`
- `apps/server/src/modules/crm/crm-gmail-webhook.service.ts`
- `apps/server/src/modules/crm/crm-gmail-history-sync-queue.service.ts`
- `apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.ts`
- `apps/server/src/modules/crm/crm-gmail-history.gateway.ts`
- `apps/server/src/modules/crm/crm-gmail-message.ts`
- `src/views/crm/settings/modules/MailboxManager.vue`
- `src/views/crm/settings/modules/MailboxTable.vue`
- `src/views/crm/inbox/modules/*`

## 7. 第一期 1C 对照：发送审核 + 邮件序列 + 队列

### 原计划

- 发送前审核清单。
- 第一封批量草稿生成和人工确认。
- 5 封序列策略。
- BullMQ 延迟发送、额度池、warmup、follow-up 权重。
- 回信停发、退订、退信、黑名单、job guard。

### 当前已实现

- Sequence Enrollment / Message 数据模型已存在。
- 创建首封草稿 review item 已实现。
- 首封草稿可编辑、保存、确认。
- 首封确认后可启动发送。
- BullMQ 发送队列和 worker 已实现。
- job 执行前有 `organizationId + ownerUserId + enrollmentId + messageId + runVersion + status + mailbox.active` guard。
- 旧 job 通过 runVersion/status guard 跳过。
- 暂停/停止序列会 bump runVersion，并跳过 queued message。
- 发送前 worker claim 阶段检查黑名单。
- 发送额度账本 `CrmMailboxSendUsage` 已实现，每日/每小时维度。
- 发送成功写 providerMessageId/providerThreadId。
- 发送成功后会生成下一封 follow-up 草稿。
- 后续草稿可确认后进入发送队列。
- 回信后停止同公司当前所有 active 序列。
- 退订回信写组织级黑名单。
- hard/soft bounce 有分类基础。
- 前端邮件序列列表、创建、审核、发送、停止已接。

### 当前半成品

- 当前更像“首封人工确认，后续也人工确认后发送”。
- 原计划的“低风险后续自动发送，高风险人工确认”尚未完整实现。
- 默认序列 1-5 封存在，但策略配置不可编辑。
- 发送队列没有首封池/follow-up 池 60%/40% 这样的完整调度策略。
- follow-up 最大延迟、超期提权、质量分排序尚未完全产品化。
- warmupStage 字段存在，但 warmup 策略编辑和实际调度权重未完整确认。
- 同公司多联系人策略只部分实现，主要是回信后同公司停发。

### 当前未完成

- 发送前审核清单页面或批量清单确认完整流程。
- 第一封批量草稿生成。
- 批量审核 + 单条展开修改的完整 UX。
- 新客户首封池 / follow-up 池 60%/40% 和互相借用。
- follow-up 超期提高优先级。
- 质量分排序系统。
- 客户国家/地区工作时间发送。
- 同公司单日最多联系 2 人。
- 第 3 封后启动第二联系人。
- 第二联系人启动时对第一个联系人序列的可配置暂停/继续。
- 同公司多联系人邮件重复度检查。
- 发送队列和失败重试运维视图。
- 发送失败后重试策略 UI。
- 真正取消 BullMQ 待发送 job 的管理操作，当前主要依赖 guard 跳过。

### 风险点

- worker claim 后扣额度，发送失败不释放额度；当前偏保守，需确认业务口径。
- 后续 follow-up 现在生成的是模板文本，不是 AI 按产品/职位动态生成。
- 如果后续自动发送策略继续开发，必须保证 job guard 不被绕过。
- 发送和回复都不能让组织管理员代发或代回复。

### 关键文件

- `apps/server/src/modules/crm/crm-send-queue.service.ts`
- `apps/server/src/modules/crm/crm-send-worker.service.ts`
- `apps/server/src/modules/crm/crm-send-worker-host.service.ts`
- `apps/server/src/modules/crm/crm-email-send.gateway.ts`
- `apps/server/src/modules/crm/store/prisma-crm.store.ts`
- `apps/server/src/modules/crm/crm.service.ts`
- `src/views/crm/email-sequences/index.vue`
- `src/views/crm/email-sequences/modules/*`

## 8. 第一期 1D 对照：模板、职位画像、产品线资料

### 原计划

- 平台全局职位画像和多语言别名。
- 组织模板组复制/修改。
- 多语言模板变体。
- 组织产品线资料。
- AI 生成邮件时引用资料和职位画像。
- 高风险字段人工确认。

### 当前已实现

- 内置默认模板和职位画像存在。
- `getTemplateDefaults` 可返回默认 template group 和 personas。
- 前端 CRM 配置页可以展示默认模板和职位画像。
- 组织产品线资料 `CrmProductLine` 已实现。
- 产品线字段包括产品名称、目标客户类型、核心卖点、MOQ、交期、付款方式、认证、目录链接、官网链接、常见型号文本。
- 产品线前端 CRUD/归档已实现。
- 首封草稿生成会引用 account/contact/productLine/context 的基础字段。
- AI 不能编造价格、MOQ、交期、认证等约束在设计中已明确，但实际 AI 生成尚未完整接入。

### 当前半成品

- 默认模板是只读展示，不是完整模板库。
- 职位画像是代码内置，不是平台超管维护的数据库配置。
- 多语言职位别名未看到完整 CRUD。
- 产品资料库只是结构化表单，没有文件上传/PDF/表格解析。
- 邮件生成是确定性模板拼接，不是 AI 根据模板和产品资料优化。

### 当前未完成

- TemplateGroup 数据模型和 CRUD。
- SequencePolicy 数据模型和 CRUD。
- Persona 数据模型和平台超管维护页。
- 多语言职位别名维护。
- 组织复制全局模板组后修改。
- 每个模板组维护第 1-5 封模板。
- 多语言模板变体。
- 没有对应语言模板时 AI 本地化并进入人工确认。
- 禁用表达维护。
- 模板质量检查。
- 用户个人签名必填检查。
- AI 生成邮件时强制引用产品资料和职位画像的完整 prompt/guard。
- 高风险字段人工确认机制。

### 风险点

- 现在模板偏静态，不能代表最终“AI 定制开发信”能力。
- 产品资料里的价格、MOQ、交期、认证等承诺必须有来源，后续接 AI 时要做 hard guard。
- 职位画像如果继续写死在代码里，后续运营维护成本高。

### 关键文件

- `apps/server/src/modules/crm/crm.service.ts`
- `apps/server/src/modules/crm/dto/create-crm-product-line.dto.ts`
- `apps/server/src/modules/crm/dto/update-crm-product-line.dto.ts`
- `src/views/crm/settings/modules/ProductLineManager.vue`
- `src/views/crm/settings/modules/DefaultEmailTemplateCard.vue`
- `src/views/crm/settings/modules/BasicRulesCard.vue`

## 9. 第二期功能清单

第二期原计划：

- Hunter Email Finder。
- 更多邮箱/联系人 Provider。
- AI 回复草稿，但只生成草稿，不自动发。
- 产品资料文件上传和 PDF/表格解析。
- 资料库附件发送。
- 结构化型号库。
- 回复意向分类。
- 更细的模板质量检查。

### 8.1 Hunter Email Finder

状态：未开始。

已有基础：

- Hunter 配置和 Domain Search 已接。
- AI Gateway 有 Hunter client/service。

仍需：

- Email Finder API client。
- 调用策略：何时按姓名+域名找邮箱。
- 消耗记录。
- 失败降级。
- 结果置信度和来源记录。
- 与邮箱验证缓存联动。

### 8.2 更多联系人 Provider

状态：未开始。

仍需：

- ProviderCredential 抽象。
- ProviderUsage 统一消耗记录。
- 数据来源优先级。
- 去重/合并策略。
- 失败重试和限额。

### 8.3 AI 回复草稿

状态：未开始。

已有基础：

- 收件箱线程和纯文本回复已实现。
- AI Gateway 已有文本生成能力。

仍需：

- 根据完整线程生成回复草稿。
- 只生成草稿，不自动发。
- 用户编辑确认后发送。
- 禁止编造价格、交期、库存、认证。
- 引用产品资料来源。
- 高风险表达提示。
- 草稿版本和时间线记录。

### 8.4 产品资料文件上传和解析

状态：未开始。

已有基础：

- 组织产品线结构化表单。

仍需：

- 文件上传。
- PDF/表格解析。
- 解析结果人工确认。
- 文件与产品线关联。
- 文件内容向量化或结构化存储。
- 删除/归档策略。

### 8.5 资料库附件发送

状态：未开始。

依赖：

- 文件上传和资料库。
- 邮件附件发送 gateway。
- 附件大小限制和 Gmail API MIME 构建。
- 附件发送审计和风险检查。

### 8.6 结构化型号库

状态：未开始。

仍需：

- ProductModel 数据模型。
- SKU/型号/规格/价格/MOQ/库存/认证字段。
- 导入、编辑、归档。
- 邮件生成引用型号库。
- 防止 AI 编造型号参数。

### 8.7 回复意向分类

状态：未开始。

已有基础：

- 收件箱线程、回信正文、messageType 基础分类。

仍需：

- 意向分类标签：高意向、询价、样品、拒绝、退订、无关、退信等。
- AI 分类和置信度。
- 人工校正。
- 分类后触发任务/提醒。
- 报表统计。

### 8.8 模板质量检查

状态：未开始。

仍需：

- 模板变量完整性检查。
- 禁用表达检查。
- 链接/附件风险检查。
- spam-like 表达提示。
- 长度、个性化程度、职位匹配度检查。

## 10. 第三期功能清单

第三期原计划：

- 共享 Gmail / 团队邮箱。
- 授权代发。
- 主管/团队、公海、认领、分配。
- 点击追踪和追踪域名。
- A/B 测试。
- 更完整转化归因。
- 组织用量、套餐、账单。
- 组织级数据导出。
- 客户侧数据保留策略配置。
- 大客户自建 Google OAuth App。

### 9.1 共享 Gmail / 团队邮箱

状态：未开始。

当前第一版明确不支持。

需要重新设计：

- Mailbox ownership 从 owner-only 改为共享权限模型。
- 谁能发送、谁能查看正文、谁能回复。
- 发送额度如何按团队/个人拆分。
- 审计事件更严格。

### 9.2 授权代发

状态：未开始。

当前第一版明确禁止组织管理员代发、代确认、代回复。

后续需要：

- 明确授权关系。
- 用户授权管理员代发。
- 操作审计。
- 邮件签名和 From/Reply-To 规则。
- 风险提示。

### 9.3 公海、认领、分配

状态：未开始。

当前 CRM 是成员私有数据模型。

后续需要：

- Lead ownership 可转移。
- 公海池数据模型。
- 认领规则。
- 分配规则。
- 重复线索归属冲突处理。
- 权限和时间线迁移。

### 9.4 点击追踪和追踪域名

状态：未开始，且第一版用户明确先不做点击追踪。

后续需要：

- tracking domain 配置。
- URL rewrite。
- 访问日志。
- Bot 过滤。
- 点击信号只作弱信号。
- 冷邮件 deliverability 风险提示。

### 9.5 A/B 测试

状态：未开始。

依赖：

- 模板库。
- 统计指标。
- 样本分流。
- open/reply/click 等指标定义。
- 低样本提醒。

### 9.6 转化归因

状态：未开始。

仍需：

- 触达、回复、机会、客户的链路归因。
- Account/Contact 到 opportunity/customer 的状态流。
- 多联系人、多序列、多邮箱归因规则。

### 9.7 组织用量、套餐、账单

状态：未开始。

仍需：

- 调用量、邮箱数、发送量、联系人量、AI token、Hunter/Serper 消耗。
- 套餐限制。
- 超额处理。
- 账单页面。
- 管理员视图。

### 9.8 组织级数据导出

状态：未开始，第一版明确不做邮件正文/附件导出。

后续需要：

- 导出权限。
- 导出字段配置。
- 邮件正文是否允许导出。
- 审计日志。
- 异步导出任务。

### 9.9 数据保留策略

状态：未开始。

仍需：

- 组织级保留天数配置。
- 邮件正文保留策略。
- 附件保留策略。
- 归档瘦身策略可配置。
- 合规删除和审计。

### 9.10 大客户自建 Google OAuth App

状态：未开始。

当前第一版采用平台统一 OAuth。

后续需要：

- 组织级 OAuth client 配置。
- client secret 加密存储。
- OAuth redirect 和 consent screen 指引。
- 大客户切换 OAuth 模式的迁移策略。

## 11. 当前最高优先级

### P0：生产闭环必须补

1. Gmail watch 自动续订任务
   - 状态：已在当前线程完成，尚未提交。
   - 已新增后台自动续订服务，默认每 6 小时扫描 24 小时内到期或未初始化 watch 的 active Gmail mailbox。
   - 自动续订不会推进已有 `lastHistoryId`，避免跳过历史回信。
   - 授权失效会标记 `auth_expired`，暂停相关待发送序列并通知用户。
   - 后续仍需要在真实 Gmail 环境验证续订效果。

2. Pub/Sub webhook 生产安全
   - 状态：已在当前线程完成，尚未提交。
   - 生产环境缺 `CRM_GMAIL_PUBSUB_PUSH_SECRET` 时 webhook 会拒绝请求。
   - 配置 secret 后，请求头 `x-crm-gmail-pubsub-secret` 必须匹配。
   - 不记录完整 secret。
   - 后续仍可增强 Google OIDC/JWT 验证。

3. Gmail History expired 补偿
   - 状态：已在当前线程完成告警型补偿，尚未提交。
   - 过期时不再推进 `lastHistoryId`，避免静默跳过历史回信。
   - 已写系统日志和站内通知，提醒邮箱 owner 人工处理。
   - 后续仍可继续增强为更完整的自动补偿同步策略。

4. 真实 Gmail 全链路联调
   - 状态：需要外部 Google Cloud/PubSub/Gmail 真实环境，当前本地线程无法直接完成。
   - OAuth 回调。
   - Watch 创建。
   - 真实发送。
   - 客户回复。
   - Pub/Sub push。
   - History 拉取。
   - 收件箱入库。
   - 同公司序列停发。
   - 系统内回复。
   - 当前代码侧已补自动 watch 续订、Pub/Sub 生产 secret、History expired 告警和部署配置；下一步应在预发环境按 checklist 人工验收。

5. 生产部署配置
   - 状态：已在当前线程补齐基础配置，尚未提交。
   - `.env.example` 已补前端服务地址、生产 CORS、watch 自动续订配置。
   - 后端 CORS 已支持 `SERVER_CORS_ORIGINS`。
   - `docker-compose.yml` 已补 Redis。
   - `apps/server/package.json` 已补 `build` script。
   - 部署 checklist 已补迁移、Prisma generate、server build、Redis、CORS、Pub/Sub endpoint。
   - 后续仍需要在真实生产/预发环境执行部署演练。

### P1：第一版体验补强

- 模板库 CRUD。
- 序列策略配置。
- 后续 follow-up 自动策略。
- 黑名单/退订管理页已完成只读列表；解除黑名单需后续结合审计和权限设计。
- 发送队列/同步日志运维页已完成薄视图；完整队列历史和系统日志详情可后续增强。
- auth_expired 行级重新授权已完成，仍需真实 OAuth 环境验收。
- 手动新增/导入 CRM 线索入口已完成。
- 归档恢复和自动瘦身任务。
- 前端组件测试。

### P2：第二期/第三期

- AI 回复草稿。
- 产品资料上传解析。
- Hunter Email Finder。
- 附件发送。
- 结构化型号库。
- 回复意向分类。
- 共享邮箱、公海、分配、账单、导出、自建 OAuth。

## 12. 已知测试覆盖和缺口

已有后端 spec 较多，CRM 覆盖：

- CRM controller/service/store。
- Gmail OAuth/token。
- Gmail watch/history/webhook。
- send worker。
- email send gateway。
- Pub/Sub parser。
- DTO。
- mock endpoint 默认关闭。
- 全局邮箱验证冷却期。

已有前端/请求层 spec：

- AI 获客 helper。
- 请求错误处理。
- API helper。
- CRM email-sequences shared。
- CRM settings shared 校验。

缺口：

- 没有统一 `test` script。
- 真实 Gmail 全链路必须人工验收。
- `GlobalConfigCard` 超管/普通用户 UI 未做组件测试。
- 邮箱表格立即同步按钮状态未做组件测试。
- AI 设置迁移后入口权限未做组件测试。
- 生产 `NODE_ENV=production` 缺配置启动失败缺 E2E。
- 公网 CORS 和 Pub/Sub push header 缺 E2E。

建议常用命令：

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.controller.spec.ts
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-gmail-watch.service.spec.ts apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts
pnpm --filter @soybean/server typecheck
pnpm typecheck
pnpm exec eslint --max-warnings=0 .
pnpm exec oxlint
git diff --check
```

注意：如果测试因网络、DNS、依赖下载等 sandbox 限制失败，需要按当前环境规则申请提升权限。

## 13. 重要踩坑摘要

详细内容见 `docs/agent-memory.md`。继续开发时至少注意这些：

- Controller 不能调用不存在的 service 方法。
- AI 获客后台任务必须带 organization 上下文。
- Account/Contact 不能用组织级唯一查重，否则会泄漏成员私有记录。
- 归档指纹只做组织级历史提醒，不复用其他成员主记录。
- 全局唯一 Gmail mailbox 冲突不能返回未授权记录。
- 草稿确认必须 owner-only，管理员不能确认他人草稿。
- 草稿创建和确认要事务化。
- 发送 worker 必须按 job.messageId 定位目标邮件。
- 客户回信必须停止同公司当前所有序列。
- Gmail Pub/Sub/History 要先做来源与 mailbox 状态 guard。
- Gmail 403 不能全部当授权失效，要区分 rate limit 和 auth error。
- Gmail 回信入库必须按 providerMessageId 幂等。
- 邮箱验证缓存是全平台共享，不按组织隔离。
- 多 Agent 合并前要冻结同文件写入。
- CRM mock 调试接口默认必须关闭。
- Prisma schema 变更后要 `prisma generate`。
- 普通 commit hook 可能格式化大量无关文件。

## 14. 建议新线程执行顺序

1. 读 `docs/agent-memory.md`。
2. 读本 handoff。
3. 执行 `git status --short`，确认当前未提交文件。
4. 不要 revert 用户或子 Agent 改动。
5. 如果继续实现，P0 本地可做项已完成；真实 Gmail 全链路需要外部环境。下一步优先做 P1。
6. 适合多 Agent 的拆分方式：
   - Agent A：模板库 CRUD 和序列策略配置。
   - Agent B：黑名单/退订管理页已完成只读列表；后续可补解除黑名单审计流程。
   - Agent C：发送队列/同步日志运维薄视图已完成；完整队列历史可后续增强。
   - Agent D：前端 auth_expired 行级重新授权和邮箱同步状态 UI。
7. 子 Agent 必须明确：不要提交代码，不要修改同一批文件，完成后只汇报 changed files。
8. 主 Agent 统一集成和跑测试。

## 15. 推荐下一步任务拆分

### 任务 1：Gmail watch 自动续订

目标：

- 后端新增定时任务或 worker。
- 定期扫描 `active` 且 `watchExpiration` 快过期或为空的 mailbox。
- 调用现有 watch gateway renew。
- 成功更新 `watchExpiration/lastHistoryId`。
- 授权失效标记 `auth_expired`，创建站内通知。
- 失败写 system log，不记录敏感 token。

需要注意：

- 不要全量频繁扫描。
- 并发要避免同一 mailbox 重复续订。
- 续订失败不要影响其他 mailbox。
- 生产环境必须可观测。

可能涉及文件：

- `apps/server/src/modules/crm/crm-gmail-watch.service.ts`
- `apps/server/src/modules/crm/store/prisma-crm.store.ts`
- `apps/server/src/modules/crm/crm.module.ts`
- `apps/server/src/modules/crm/crm-gmail-watch.service.spec.ts`

### 任务 2：Pub/Sub 生产安全

目标：

- production 下缺 `CRM_GMAIL_PUBSUB_PUSH_SECRET` 时拒绝 webhook 或启动失败。
- 保持测试环境可配置。
- 增加 controller/service spec。

可能涉及文件：

- `apps/server/src/modules/crm/crm-gmail-webhook.controller.ts`
- `apps/server/src/modules/crm/crm-gmail-webhook.controller.spec.ts`
- `apps/server/src/modules/crm/crm-gmail-provider.factory.ts`
- `docs/crm-gmail-deployment-checklist.md`
- `.env.example`

### 任务 3：History expired 补偿

目标：

- 不要静默跳过已过期 history。
- 至少写日志、站内通知、mailbox 标记需要人工同步或重新初始化。
- 设计后续补偿同步策略。

可能涉及文件：

- `apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.ts`
- `apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.spec.ts`
- `apps/server/src/modules/crm/crm.types.ts`
- `docs/crm-gmail-deployment-checklist.md`

### 任务 4：部署配置补齐

目标：

- `.env.example` 补全前后端变量。
- CORS 支持生产域名 env。
- docker-compose 增加 Redis。
- server package 增加 build script。
- checklist 补迁移、Prisma generate、build/start、Redis、CORS。

可能涉及文件：

- `.env.example`
- `apps/server/src/main.ts`
- `apps/server/package.json`
- `docker-compose.yml`
- `docs/crm-gmail-deployment-checklist.md`

## 16. 当前文件地图

后端 CRM：

- `apps/server/src/modules/crm/crm.controller.ts`
- `apps/server/src/modules/crm/crm.service.ts`
- `apps/server/src/modules/crm/crm.types.ts`
- `apps/server/src/modules/crm/crm.module.ts`
- `apps/server/src/modules/crm/store/prisma-crm.store.ts`

Gmail：

- `apps/server/src/modules/crm/crm-gmail-oauth-flow.ts`
- `apps/server/src/modules/crm/crm-gmail-oauth-token.provider.ts`
- `apps/server/src/modules/crm/crm-gmail-provider.factory.ts`
- `apps/server/src/modules/crm/crm-gmail-watch.service.ts`
- `apps/server/src/modules/crm/crm-gmail-watch.gateway.ts`
- `apps/server/src/modules/crm/crm-gmail-webhook.controller.ts`
- `apps/server/src/modules/crm/crm-gmail-webhook.service.ts`
- `apps/server/src/modules/crm/crm-gmail-history.gateway.ts`
- `apps/server/src/modules/crm/crm-gmail-history-sync-queue.service.ts`
- `apps/server/src/modules/crm/crm-gmail-history-sync-worker.service.ts`
- `apps/server/src/modules/crm/crm-gmail-message.ts`

发送：

- `apps/server/src/modules/crm/crm-send-queue.service.ts`
- `apps/server/src/modules/crm/crm-send-worker.service.ts`
- `apps/server/src/modules/crm/crm-send-worker-host.service.ts`
- `apps/server/src/modules/crm/crm-email-send.gateway.ts`

AI 获客 / Hunter：

- `apps/server/src/modules/ai-leads/ai-lead-search-task-worker.service.ts`
- `apps/server/src/modules/ai-leads/ai-lead-crm-import.adapter.ts`
- `apps/server/src/modules/ai-leads/ai-lead-hunter-enrichment.service.ts`
- `apps/server/src/modules/ai-gateway/hunter-client.service.ts`
- `apps/server/src/modules/ai-gateway/ai-gateway.service.ts`

前端 CRM：

- `src/views/crm/leads/*`
- `src/views/crm/email-sequences/*`
- `src/views/crm/inbox/*`
- `src/views/crm/settings/*`
- `src/views/crm/gmail-oauth-callback/index.vue`
- `src/service/api/crm.ts`
- `src/typings/api/crm.d.ts`

文档：

- `docs/agent-memory.md`
- `docs/crm-gmail-deployment-checklist.md`
- `docs/ai-crm-handoff-v2.md`

## 17. 不要误解的点

- “所有用户共享邮箱验证缓存”只代表 DNS/MX 验证结果共享，不代表 CRM 联系人共享。
- “按组织去重”在 CRM 主记录上不能简单做成组织唯一，否则普通成员会看到别人的线索。
- 组织级归档指纹可以提示历史触达，但不应直接复用其他成员完整 Account/Contact。
- 第一版客户回信后停止同公司当前所有序列，这是强规则。
- 第一版不做点击追踪。
- 第一版不支持 Gmail alias / send-as。
- 第一版不做固定 Gmail 轮询。
- 第一版不自动换邮箱发送。
- 第一版系统内回复只做纯文本。
- 后续邮件不应提前全部生成，避免 token 浪费。

## 18. 最短结论

当前第一版主闭环已经搭起来，但还不是生产完成态。

最值得先补的是：

1. Gmail watch 自动续订。
2. Pub/Sub 生产安全。
3. History expired 补偿。
4. 真实 Gmail 全链路验收。
5. 生产部署配置。

然后再补：

1. 模板库和序列策略。
2. 后续 follow-up 自动策略。
3. 黑名单/运维页面。
4. 归档恢复和瘦身。
5. 第二期 AI 回复草稿、资料解析、Hunter Finder 等。
