# CRM SequencePolicy 下一阶段策略能力设计

更新时间：2026-06-19
执行角色：Agent E
范围：只核对并设计下一阶段能力，不实现大范围调度代码。

## 1. 结论

当前 `SequencePolicy` 已经完成“策略配置和绑定”的基础，但还不是完整的发送调度策略引擎。

已具备：

- `CrmSequencePolicy` 数据模型、CRUD、默认策略、归档策略基础链路。
- 5 步序列 `delayDays/threadMode` 归一化。
- `linkPolicy`、`allowLowRiskAutoSend`、`sameCompanyContactStrategy` 配置字段。
- 创建首封草稿时可绑定指定策略或组织默认策略。
- worker 生成下一封 follow-up 草稿时会优先读取 enrollment 绑定的 `policy.steps`。
- 发送 worker 已有 `organizationId + ownerUserId + enrollmentId + messageId + runVersion + status + mailbox.active` guard。
- 客户回信后已停止同公司当前所有 active 序列。

下一阶段应补的是“策略执行层”，不是重写现有发送链路。建议在现有 `CrmService -> CrmStore -> CrmSendWorkerService` 之间增加小而聚焦的策略能力：候选池、优先级评分、同公司联系人门控、暂停/继续语义、重复度检查、地区工作时间窗口和最终 claim guard。

## 2. 当前实现核对

### `crm-sequence-policy.ts`

当前职责是纯配置归一化：

- 默认 5 步：`0/3/7/14/21` 天。
- step 1 固定 `delayDays=0`。
- 线程模式只允许 `new_subject/same_thread`。
- 延迟天数限制为 `1-90`，非法值回到默认值。
- 策略枚举：
  - `linkPolicy`: `preserve_template_links | block_new_links`
  - `sameCompanyContactStrategy`: `single_active_per_company | allow_multiple_contacts`
  - `status`: `active | archived`

限制：

- 没有首封池/follow-up 池概念。
- 没有同公司每日联系人数量限制。
- 没有“第 3 封后第二联系人”门控。
- 没有暂停/继续的策略字段。
- 没有重复度检测字段或算法入口。
- 没有超期优先级、质量分排序、工作时间窗口。

### `crm.service.ts`

当前策略使用点：

- `list/create/update/archive/setDefaultSequencePolicy` 已存在。
- `createSequenceReviewItem` 会选择 `input.policyId` 或组织默认策略。
- `assertSameCompanySequencePolicy` 只实现了“同公司是否允许多联系人 active enrollment”的粗门控：
  - `allow_multiple_contacts` 直接放行。
  - 默认 `single_active_per_company` 下，同公司已有其他联系人 active enrollment 时拒绝创建。
- `approveFollowUpMessageDraft` 仍是人工确认后直接按 `scheduledAt` 入 BullMQ。
- `startFirstMessageSend` 只启动单条已审核首封，不负责批量池调度。
- `stopSequenceEnrollment` 语义是停止，不是暂停/继续；会 bump `runVersion` 并跳过 queued message。

限制：

- `allowLowRiskAutoSend` 目前主要是配置字段，未驱动后续自动发送。
- `linkPolicy` 未形成草稿生成/审核的硬约束。
- “暂停/继续”没有独立操作语义；已有 mailbox `paused/auth_expired` 会暂停相关 enrollment，但没有策略级暂停/恢复流程。

### `crm-send-worker.service.ts`

当前职责：

- job claim 成功后发送当前 `job.messageId` 对应 message。
- 发送成功后生成下一封 follow-up 草稿。
- follow-up 草稿延迟优先级：`policy.steps` -> 默认模板 step -> 全局 follow-up 配置。
- Gmail 授权失效时标记 mailbox 并通知。

限制：

- worker 只处理已经入队的 job，不负责从“待发候选池”挑选谁先发送。
- 没有首封池/follow-up 池比例控制。
- 没有超期优先级、质量分排序、地区工作时间判断。

### `PrismaCrmStore`

当前关键能力：

- `claimFirstMessageSendDelivery` 已按 `job.messageId` 定位目标邮件。
- claim 阶段会检查 mailbox active、黑名单、额度账本。
- claim 成功才占用每日/每小时额度。
- `completeFirstMessageSend` 会按目标 message step 更新 `currentStep` 并创建下一封草稿。
- `stopSequenceEnrollment` 会 bump `runVersion` 并跳过 queued messages。
- `ingestCustomerReply` 已按同公司停止 active enrollment 并跳过 queued message。

限制：

- 没有面向调度器的“待发候选查询”。
- 没有按公司/联系人/地区/质量分聚合候选。
- 额度账本只有 mailbox 维度，没有策略池配额维度。

## 3. 下一阶段目标

下一阶段目标是让 SequencePolicy 从“配置被读取”升级为“发送调度可执行策略”，覆盖以下未完成项：

1. 首封池/follow-up 池。
2. 同公司单日最多 2 人。
3. 第 3 封后第二联系人。
4. 暂停/继续策略。
5. 重复度检查。
6. 超期优先级。
7. 质量分排序。
8. 客户地区工作时间。

非目标：

- 不重写现有 BullMQ worker。
- 不移除人工审核流。
- 不绕过当前 owner-only、runVersion、黑名单、额度、mailbox active guard。
- 不做 Gmail 真实链路、Pub/Sub、History 的额外改造。
- 不把组织管理员变成可代发/代确认角色。

## 4. 推荐架构

### 4.1 保持现有发送主链路

现有单条发送链路继续保留：

```text
人工确认或自动策略判定
  -> message.status = queued
  -> BullMQ job
  -> worker claim
  -> Gmail send
  -> complete/fail
```

新增策略调度只负责“哪些 message 可以进入 queued、何时入队、优先级如何排序”。真正发送仍依赖当前 worker claim 的最终 guard。

### 4.2 新增轻量策略执行模块

建议新增后端模块内聚在 CRM 模块内，不提前拆独立 Nest module：

- `crm-sequence-policy-engine.ts`
  - 纯函数，输入 policy、enrollment、message、account、contact、mailbox、now。
  - 输出是否可自动入队、阻断原因、评分拆解。
- `crm-sequence-scheduler.service.ts`
  - 周期性扫描待发送候选。
  - 按策略池和优先级挑选候选。
  - 调用 store 事务方法把 message 置为 queued 并入 BullMQ。
- `CrmStore` 增加少量调度方法：
  - 查询待发候选。
  - 查询同公司当天触达人数。
  - 事务化 claim 调度候选为 queued。
  - 暂停/继续同公司或单条 enrollment。

`crm-sequence-policy.ts` 仍只保留配置归一化，不塞查询和业务副作用，保持低耦合。

## 5. 策略项设计

### 5.1 首封池 / follow-up 池

定义两个逻辑池：

- `first_touch`: step 1 首封。
- `follow_up`: step 2-5。

默认配额建议：

- follow-up 池 60%。
- 首封池 40%。
- 某池无候选时允许借用给另一池。

配置位置建议：

- 平台默认值放全局配置或代码默认。
- 组织/策略级覆盖放 `CrmSequencePolicy` 扩展字段，例如 `poolConfig`。

调度方式：

1. 调度器按 mailbox 当日剩余额度计算可发送容量。
2. 先分配 follow-up/first-touch 目标数量。
3. 分别查询候选并排序。
4. 某池候选不足时，剩余额度借给另一池。
5. 最终对每条候选走事务化调度 claim，避免并发调度重复入队。

不建议把池配额放到 worker claim 阶段，因为 claim 只看到单个 job，无法做全局比例分配。

### 5.2 同公司单日最多 2 人

规则：

- 同一 `organizationId + ownerUserId + accountId` 每自然日最多联系 2 个不同 contact。
- 自然日建议以客户地区时区为准；地区未知时使用组织默认时区，仍未知使用 UTC。
- 统计对象包括当天已 sent 和当天已 queued 的候选，避免并发超发。

需要持久化或可查询的信息：

- `CrmMessage.sentAt/scheduledAt/status` 已可作为基础。
- 为高并发稳妥，建议新增轻量触达日账本，例如 `CrmAccountDailyContactUsage`：
  - `organizationId`
  - `ownerUserId`
  - `accountId`
  - `localDate`
  - `contactId`
  - `messageId`
  - `createdAt`
  - 唯一约束：`organizationId + ownerUserId + accountId + localDate + contactId`

执行点：

- 调度 claim 阶段检查并写账本。
- worker claim 阶段再做最终检查，防止外部旧 job 绕过调度器。

### 5.3 第 3 封后第二联系人

规则解释：

- 同公司第一个联系人至少完成 step 3 发送后，才允许启动第二联系人。
- “完成 step 3”以同 account 下任一 active/replied/stopped 历史 enrollment 的 `currentStep >= 3` 或存在 step 3 `sent` message 为准。
- 第二联系人仍必须满足同公司单日最多 2 人、黑名单、邮箱状态、工作时间等规则。

与当前 `sameCompanyContactStrategy` 的关系：

- `single_active_per_company`: 仍保持单 active enrollment，不启动第二联系人。
- `allow_multiple_contacts`: 允许第二联系人，但需要 `currentStep >= 3` 门槛。

建议扩展策略字段：

- `secondContactPolicy`: `disabled | after_step_3`
- `firstContactOnSecondStart`: `continue | pause`

默认：

- `secondContactPolicy=after_step_3`
- `firstContactOnSecondStart=continue`

这样与 handoff 决策一致：默认第 3 封后可启动第二联系人，默认继续第一个联系人序列，但可配置暂停。

### 5.4 暂停 / 继续策略

当前只有 stop 和 mailbox auth_expired 导致 paused。下一阶段需要区分：

- `paused`: 可继续，runVersion bump，queued message 置回可重试状态或 skipped。
- `stopped`: 终止，不自动继续。
- `replied`: 客户回信终止同公司 active 序列。

建议新增操作：

- `pauseSequenceEnrollment(id, reason)`
- `resumeSequenceEnrollment(id)`
- `pauseAccountSequences(accountId, reason)`
- `resumeAccountSequences(accountId)`

暂停规则：

- 只能暂停 active 状态：`draft_review_pending/ready_to_send/sequence_running`。
- 暂停时 bump `runVersion`，queued message 置为 `draft_ready` 或 `draft_pending_review` 取决于是否已审核。
- 写 timeline 和系统日志。

继续规则：

- 只恢复 `paused`。
- 恢复前重新校验 mailbox active、黑名单、联系人 email 状态。
- 已审核待发 message 不直接发送，由调度器重新按池、工作时间、优先级入队。
- 管理员可暂停/继续成员序列，但仍不能编辑正文、确认草稿、代发。

### 5.5 重复度检查

重复度检查要避免同公司多联系人收到高度相似的开发信。

建议分两层：

- 草稿生成/保存时的提示层：给出重复度风险，要求人工确认或修改。
- 自动发送前硬拦截层：超过阈值则不自动发送，转为人工审核。

比较对象：

- 同 `organizationId + ownerUserId + accountId` 下最近 N 封 sent/queued/draft_ready 邮件。
- 优先比较同 step 或相邻 step，尤其是不同 contact 的首封和 follow-up。

算法建议：

- 第一阶段不用新依赖。
- 先用标准化文本 token Jaccard 相似度：
  - lowercase
  - 去掉变量化问候、签名、公司名、联系人名
  - 按英文词切分
  - 过滤短词和常见停用词
- 阈值：
  - `>= 0.85`: 阻止自动发送，进入人工审核。
  - `0.70-0.85`: 标记风险，排序降权或要求审核。

记录方式：

- 不必保存完整比对文本。
- 可在 message metadata 或后续质量检查表保存：
  - `similarityScore`
  - `matchedMessageId`
  - `riskLevel`
  - `checkedAt`

### 5.6 超期优先级

定义：

- `scheduledAt < now` 的 follow-up 是超期。
- 超期越久，优先级越高，但不能突破黑名单、工作时间、公司日限制、额度和 mailbox guard。

评分建议：

```text
+ follow-up base score: 40
+ first-touch base score: 20
+ overdue hours bonus: min(30, floor(overdueHours / 6) * 5)
+ customer quality score: 0-30
+ persona priority score: 0-20
+ public/risky email penalty: -20
+ duplicate risk penalty: -30
```

排序顺序：

1. 硬规则过滤。
2. 池内按总分降序。
3. 同分按 `scheduledAt` 升序。
4. 再按 `createdAt` 升序。

### 5.7 质量分排序

质量分来源建议分阶段接入：

第一阶段可以用确定性评分，不等待 AI：

- 联系人是否个人邮箱。
- emailStatus 是否 valid。
- title 是否匹配职位画像优先级。
- account 是否有官网/domain/country/customerType。
- productLine 是否完整。
- 是否归档指纹命中历史触达。

后续可接 AI 质量分，但必须写入结构化字段，不能让调度器实时调用 AI。

推荐增加候选排序输入：

- `accountQualityScore`
- `contactPriorityScore`
- `emailReliabilityScore`
- `engagementScore`
- `duplicateRiskScore`

如果暂不加新字段，可先在查询结果中动态计算。但长期建议持久化最近一次评分，便于列表展示、解释排序和测试。

### 5.8 客户地区工作时间

目标：

- 避免在客户当地深夜发送。
- follow-up 超期也只能在允许窗口内发送。

数据来源：

- `CrmAccount.country` 当前已有。
- 下一阶段建议补 `timeZone` 或 `regionCode`，不要每次按 country 猜。
- AI 获客导入时可从国家/地区映射默认时区，允许用户后续修改。

默认工作时间：

- 周一至周五。
- 客户当地时间 `09:00-17:30`。
- 节假日暂不做。

执行点：

- 调度器过滤候选：不在工作窗口则不入队。
- 已入队 job 的 worker claim 再检查一次；不在窗口时返回 null 或把 message 重新延后到下一个窗口。

建议避免：

- 不在 BullMQ 里一次性排很远的固定 delay 后完全不管工作时间；客户地区和策略可能变化。
- 不在 worker 里直接等待窗口。

## 6. 推荐数据扩展

尽量小步新增字段，避免一次性大迁移。

### `CrmSequencePolicy` 扩展

建议新增结构化 JSON 字段或拆表。考虑当前项目已有紧凑 text 字段，下一阶段可以先用 JSON 字段，避免过多列：

```ts
interface SequencePolicyAdvancedConfig {
  pool: {
    firstTouchRatio: number;
    followUpRatio: number;
    allowBorrowing: boolean;
  };
  sameCompany: {
    maxContactsPerLocalDay: number;
    secondContactPolicy: 'disabled' | 'after_step_3';
    firstContactOnSecondStart: 'continue' | 'pause';
  };
  autoSend: {
    allowLowRiskAutoSend: boolean;
    maxDuplicateScore: number;
    requireHumanReviewRiskScore: number;
  };
  workWindow: {
    enabled: boolean;
    startLocalTime: string;
    endLocalTime: string;
    weekdays: number[];
  };
}
```

默认值建议：

- `firstTouchRatio=40`
- `followUpRatio=60`
- `allowBorrowing=true`
- `maxContactsPerLocalDay=2`
- `secondContactPolicy=after_step_3`
- `firstContactOnSecondStart=continue`
- `maxDuplicateScore=0.85`
- `requireHumanReviewRiskScore=0.7`
- `workWindow.enabled=true`
- `startLocalTime=09:00`
- `endLocalTime=17:30`
- `weekdays=[1,2,3,4,5]`

### `CrmAccount`

建议新增：

- `timeZone: string | null`
- `regionCode: string | null`

如果当前阶段不改 schema，先在策略引擎里由 `country` 映射默认时区，但设计上应标为过渡方案。

### 调度账本

建议新增 `CrmAccountDailyContactUsage`，用于强约束“同公司单日最多 2 人”。

### 质量检查记录

建议新增 `CrmMessageQualityCheck` 或轻量字段，保存自动发送决策结果：

- `messageId`
- `riskLevel`
- `qualityScore`
- `duplicateScore`
- `blockedReasons`
- `checkedAt`

这能让 UI 解释“为什么没自动发/为什么排在后面”。

## 7. 关键流程

### 7.1 调度器扫描

```text
定时触发
  -> 按 active mailbox 找剩余额度
  -> 查询 draft_ready 候选
  -> 按 first_touch/follow_up 分池
  -> 调用 policy engine 做硬规则过滤和评分
  -> 按池配额选择候选
  -> store 事务 claim 为 queued
  -> BullMQ add job
  -> 回写 bullJobId
```

注意：

- 调度 claim 必须带 message 当前 status、enrollment status、runVersion。
- 入队失败要回滚或补偿为可重试状态。
- 不要在调度阶段扣发送额度，额度仍在 worker claim 扣。

### 7.2 自动发送后续 follow-up

当前 follow-up 生成后是 `draft_pending_review`，人工确认后 queued。

下一阶段低风险自动发送可以调整为：

1. worker 发送成功生成下一封 follow-up 草稿。
2. 质量检查通过且策略允许 `allowLowRiskAutoSend`。
3. message 保持 `draft_ready`，由调度器在 scheduledAt 到达后入队。
4. 高风险继续 `draft_pending_review`，走人工审核。

这样不会绕过审核要求：首封仍必须人工确认，后续只有低风险可自动入队。

### 7.3 第二联系人启动

```text
同公司候选联系人进入调度
  -> 检查策略 allow_multiple_contacts
  -> 检查同公司已有联系人是否 step >= 3 sent/currentStep >= 3
  -> 检查今日已联系 contact 数 < 2
  -> 生成第二联系人首封草稿
  -> 若 firstContactOnSecondStart=pause，则暂停第一联系人 active enrollment
```

建议第二联系人首封仍进入人工审核清单，不直接自动发送。

## 8. 测试建议

后续实现时建议最小测试集：

- `crm-sequence-policy.ts`
  - advanced config 默认值归一化。
  - 池比例边界。
  - 工作时间配置边界。
- `crm-sequence-policy-engine.spec.ts`
  - follow-up 超期加分。
  - 质量分排序。
  - 重复度高时阻止自动发送。
  - 非客户工作时间阻止入队。
- `crm.service.spec.ts`
  - 第二联系人在 step 3 前不能启动。
  - step 3 后可启动第二联系人。
  - pause/resume owner/admin 权限。
  - 管理员仍不能代确认、代发。
- `prisma-crm.store.spec.ts`
  - 同公司每日联系人账本并发唯一约束。
  - 调度 claim 只允许当前 runVersion/status。
  - 暂停 bump runVersion 并重置 queued message。
- `crm-send-worker.service.spec.ts`
  - worker claim 阶段再次拦截黑名单、工作时间、同公司日限制。
  - 旧 job 被 runVersion/status 跳过。

按项目要求，不需要运行 `npm run build`。

## 9. 分阶段落地建议

### 阶段 A：策略引擎和只读评分

- 新增纯函数 policy engine。
- 不改变发送行为，只在日志或内部返回中生成评分和阻断原因。
- 补单元测试。

### 阶段 B：工作时间 + 超期优先级 + 质量排序

- 增加调度候选查询。
- 调度器只处理已审核 `draft_ready` 的 message。
- 保持人工审核流不变。

### 阶段 C：池配额和同公司日限制

- 增加首封/follow-up 池。
- 增加同公司每日联系人账本。
- claim 阶段加最终 guard。

### 阶段 D：第二联系人和暂停/继续

- 加第二联系人策略字段。
- 加 pause/resume 操作。
- 第二联系人首封仍进入人工审核。

### 阶段 E：低风险 follow-up 自动发送

- 接入重复度检查。
- 低风险后续草稿自动转 `draft_ready`，由调度器入队。
- 高风险继续人工审核。

## 10. 风险和约束

- 不能把调度器当作唯一安全边界；worker claim 仍必须做最终 guard。
- 不能让管理员代发、代确认、代编辑正文。
- 不要用组织级 Account/Contact 唯一化来解决同公司策略，否则会破坏成员私有隔离。
- 池配额和质量排序不能跳过 Gmail 授权、黑名单、退订、回信停发。
- `runVersion` 仍是旧 job 失效的核心机制，暂停/继续/第二联系人策略都要维护它。
- 重复度检查不要保存完整敏感正文到日志；只保存分数、匹配 message id、风险级别。
