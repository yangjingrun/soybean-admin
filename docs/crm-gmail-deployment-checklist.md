# CRM Gmail 部署与联调检查清单

本文档用于第一期 CRM 邮件系统接入真实 Gmail 前的环境配置、部署检查和联调验收。不要在本文档写入真实密钥。环境变量模板见根目录 `.env.example`。

## 1. 必需基础服务

后端运行前至少需要：

```env
NODE_ENV=production
PORT=9528
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SERVER_CORS_ORIGINS=https://<app-domain>
```

- `DATABASE_URL`：Prisma/PostgreSQL 连接串。
- `REDIS_URL`：BullMQ 队列、发送 worker、Gmail history sync worker 使用。
- `NODE_ENV=production`：生产环境必须设置。CRM mock HTTP 调试接口在 production 下会无条件拒绝。
- `SERVER_CORS_ORIGINS`：生产前端域名，多个域名用英文逗号分隔；未配置时只允许 localhost/127.0.0.1。

前端构建至少需要：

```env
VITE_SERVICE_BASE_URL=https://<api-domain>
VITE_OTHER_SERVICE_BASE_URL={}
```

- `VITE_SERVICE_BASE_URL`：前端请求后端 API 的基础地址。
- `VITE_OTHER_SERVICE_BASE_URL`：其他服务地址 JSON5 字符串；没有其他服务时填 `{}`。

本地 docker-compose 已包含 PostgreSQL 和 Redis。生产环境也必须部署 Redis，否则 BullMQ 发送队列、Gmail history sync worker 和 watch 自动续订相关任务无法稳定运行。

## 2. Google Cloud Project

Google Cloud Project 是平台统一 Gmail OAuth 和 Pub/Sub 的承载项目。第一期采用平台统一 OAuth，所以客户组织不需要自己创建 Google Cloud Project。

需要在同一个 Google Cloud Project 内准备：

- OAuth consent screen。
- OAuth 2.0 Client ID / Client Secret。
- Gmail API 启用。
- Pub/Sub API 启用。
- Gmail push 使用的 Pub/Sub topic。
- Pub/Sub push subscription，推送到后端公开 HTTPS webhook。

推荐约定：

```text
OAuth redirect URI:
https://<app-domain>/crm/gmail-oauth-callback

Pub/Sub push endpoint:
https://<api-domain>/crm/gmail/pubsub/push
```

## 3. Gmail 环境变量

真实 Gmail OAuth、发送、history 拉取和 watch 至少需要：

```env
CRM_GMAIL_OAUTH_CLIENT_ID=
CRM_GMAIL_OAUTH_CLIENT_SECRET=
CRM_GMAIL_OAUTH_REDIRECT_URI=https://<app-domain>/crm/gmail-oauth-callback
CRM_GMAIL_TOKEN_ENCRYPTION_KEY=
CRM_GMAIL_OAUTH_STATE_SECRET=
CRM_GMAIL_PUBSUB_TOPIC_NAME=projects/<project-id>/topics/<topic-name>
CRM_GMAIL_PUBSUB_PUSH_SECRET=
CRM_GMAIL_PUBSUB_AUTH_AUDIENCE=https://<api-domain>/crm/gmail/pubsub/push
CRM_GMAIL_PUBSUB_AUTH_SERVICE_ACCOUNT=<pubsub-push-service-account-email>
CRM_GMAIL_WATCH_RENEWAL_DISABLED=false
CRM_GMAIL_WATCH_RENEWAL_INTERVAL_MS=21600000
CRM_GMAIL_WATCH_RENEWAL_WINDOW_MS=86400000
CRM_GMAIL_WATCH_RENEWAL_BATCH_SIZE=50
```

字段说明：

- `CRM_GMAIL_OAUTH_CLIENT_ID` / `CRM_GMAIL_OAUTH_CLIENT_SECRET`：Google OAuth client 凭据。
- `CRM_GMAIL_OAUTH_REDIRECT_URI`：必须与 Google Cloud Console 中配置的 Authorized redirect URI 完全一致。
- `CRM_GMAIL_TOKEN_ENCRYPTION_KEY`：用于加密 Gmail refresh token。必须稳定保存，丢失会导致已授权邮箱无法解密 token。
- `CRM_GMAIL_OAUTH_STATE_SECRET`：用于签名 OAuth state，防止伪造回调。
- `CRM_GMAIL_PUBSUB_TOPIC_NAME`：Gmail watch 使用的 Pub/Sub topic 全名。
- `CRM_GMAIL_PUBSUB_PUSH_SECRET`：Pub/Sub push webhook 请求头校验密钥。Pub/Sub push subscription 需要带上同值 header：`x-crm-gmail-pubsub-secret`。
- `CRM_GMAIL_PUBSUB_AUTH_AUDIENCE`：Pub/Sub push subscription 的 OIDC audience，建议使用完整 webhook URL。
- `CRM_GMAIL_PUBSUB_AUTH_SERVICE_ACCOUNT`：Pub/Sub push authentication 使用的服务账号邮箱，必须与 Google OIDC token 的 `email` claim 一致。
- `CRM_GMAIL_WATCH_RENEWAL_DISABLED`：是否关闭自动 watch 续订，生产环境建议保持 `false`。
- `CRM_GMAIL_WATCH_RENEWAL_INTERVAL_MS`：自动续订扫描间隔，默认 6 小时。
- `CRM_GMAIL_WATCH_RENEWAL_WINDOW_MS`：提前续订窗口，默认 24 小时。
- `CRM_GMAIL_WATCH_RENEWAL_BATCH_SIZE`：每批最多续订邮箱数量，默认 50。

注意：

- 如果缺少 OAuth/token 相关变量，后端会退回 mock/null provider，不能作为真实 Gmail 联调结果。
- 如果缺少 `CRM_GMAIL_PUBSUB_TOPIC_NAME`，watch gateway 会退回 mock watch，真实 Gmail push 不会生效。
- `NODE_ENV=production` 时缺少任一 Gmail 必需变量会启动失败，避免生产环境静默退回 mock provider。
- `NODE_ENV=production` 时缺少 `CRM_GMAIL_PUBSUB_PUSH_SECRET`，Pub/Sub webhook 会拒绝请求。
- 生产环境不得记录 client secret、refresh token、push secret 或完整邮件正文到普通日志。

## 4. Pub/Sub 与 Gmail Watch

Gmail Push 消息只包含邮箱地址和 `historyId`，不是邮件正文。后端流程应为：

```text
Pub/Sub push
  -> /crm/gmail/pubsub/push
  -> 校验 x-crm-gmail-pubsub-secret
  -> 校验 Google OIDC bearer token 的 audience 和服务账号
  -> 找到 active Mailbox
  -> 入队 Gmail history sync job
  -> History API 增量拉取变化
  -> Message API 拉取相关邮件
  -> 入库收件箱/时间线
```

联调重点：

- Pub/Sub push endpoint 必须是公网 HTTPS。
- 生产环境必须配置 `CRM_GMAIL_PUBSUB_PUSH_SECRET`；缺少该变量时 webhook 会拒绝请求。
- 创建 push subscription 时启用 authentication，service account 填 `CRM_GMAIL_PUBSUB_AUTH_SERVICE_ACCOUNT`，audience 填 `CRM_GMAIL_PUBSUB_AUTH_AUDIENCE`。
- webhook secret 错误时应返回拒绝。
- 配置了 `CRM_GMAIL_PUBSUB_AUTH_AUDIENCE` / `CRM_GMAIL_PUBSUB_AUTH_SERVICE_ACCOUNT` 后，缺少或不匹配的 `Authorization: Bearer <OIDC token>` 应返回拒绝。
- 非 active mailbox 的 push 不应入队。
- `historyId` 异常时不应推进旧 checkpoint；系统会在邮箱行显示同步问题并通知 owner。
- `history_expired` 恢复 runbook：在 `CRM -> CRM 配置 -> 邮箱账号` 对应邮箱点击“立即同步”。后端会续订 Gmail watch，用新的 `historyId` 重新初始化 checkpoint 并清空同步问题；这一步不会全量扫描旧邮件，仍需人工确认过期窗口内是否有漏同步回复。
- Gmail watch 有过期时间，必须确认 watch 续订任务在实际环境运行。

## 5. Mock / Debug 开关

后端仍保留两个本地调试 HTTP 入口：

```text
POST /crm/mailboxes/mock-authorize
POST /crm/messages/:id/mock-reply
```

调用条件必须同时满足：

```env
NODE_ENV!=production
CRM_ENABLE_MOCK_ENDPOINTS=true
```

并且当前用户必须拥有 `R_SUPER`。

生产规则：

- 生产环境不要配置 `CRM_ENABLE_MOCK_ENDPOINTS=true`。
- 即使误配置为 `true`，`NODE_ENV=production` 下后端也会拒绝。
- 前端正式流程不导出、不调用 mock API。

## 6. 真实联调顺序

建议按下面顺序联调，避免一次性排查太多变量：

1. 登录后进入 `CRM -> CRM 配置`。
2. 点击授权 Gmail，确认跳转 Google consent。
3. Google 回调到 `/crm/gmail-oauth-callback`。
4. 后端写入 `Mailbox`，状态为 `active`，refresh token 已加密保存。
5. 完成 OAuth 后立即 renew watch，记录 `lastHistoryId` 和 `watchExpiration`。
6. 创建线索、联系人、产品线和首封草稿。
7. 审核首封草稿并启动发送。
8. 发送 worker 发送真实 Gmail 邮件，写入 `providerMessageId/providerThreadId`。
9. 用客户邮箱回复。
10. Pub/Sub webhook 收到 push，history sync 入库回复。
11. 收件箱出现待处理回复，同公司当前序列停止。
12. 在 CRM 内纯文本回复，确认 Gmail 发出、时间线更新。

## 7. 预发 / 真实 Gmail 验收矩阵

验收前准备：

- 至少准备 2 个真实 Gmail 邮箱：一个作为 CRM 授权邮箱，一个作为客户邮箱。
- 预发环境使用真实 Google Cloud Project、真实 OAuth client、真实 Pub/Sub topic/subscription。
- 预发后端以 `NODE_ENV=production` 或等价严格配置启动，避免误走 mock/null provider。
- 验收记录只保存脱敏邮箱、message id、thread id、job id、时间点和截图；不要写入 refresh token、client secret、push secret、OIDC token 或完整邮件正文。

### 7.1 OAuth 授权

1. 在 `CRM -> CRM 配置 -> 邮箱账号` 点击授权 Gmail。
2. 确认跳转 Google consent，scope 与 Gmail 发送、读取、watch 所需权限一致。
3. 授权后回到 `/crm/gmail-oauth-callback`，页面完成跳转或提示成功。
4. 邮箱列表出现该 Gmail，状态为 `active`，邮箱地址脱敏展示。
5. 数据库或运维视图确认 refresh token 已加密保存，不出现明文 token。
6. 用同一个 Gmail 尝试在另一个组织绑定，应被拒绝。

通过标准：

- OAuth state 校验通过，回调不能被复用或伪造。
- `Mailbox` 写入 `organizationId + ownerUserId`，且同 Gmail 地址全局唯一。
- 授权成功后立即触发 watch 续订，能看到 `lastHistoryId` 和 `watchExpiration`。

### 7.2 Watch 创建与续订

1. OAuth 成功后检查 Gmail watch 已创建，Pub/Sub topic 为 `CRM_GMAIL_PUBSUB_TOPIC_NAME`。
2. 在邮箱行点击“续订 watch”，确认 `watchExpiration` 刷新。
3. 确认自动续订任务未被 `CRM_GMAIL_WATCH_RENEWAL_DISABLED=true` 关闭。
4. 将一个 active 邮箱调整到即将过期窗口后，等待下一轮自动续订或由运维触发续订扫描。

通过标准：

- 已有 `lastHistoryId` 的邮箱续订 watch 时不推进 checkpoint。
- 未初始化 `lastHistoryId` 的邮箱可用 Gmail 返回的 `historyId` 初始化 checkpoint。
- 授权失效时邮箱变为 `auth_expired`，相关待发送序列暂停并通知 owner。

### 7.3 Pub/Sub Push OIDC + Secret

1. Pub/Sub push subscription endpoint 使用 `https://<api-domain>/crm/gmail/pubsub/push`。
2. subscription 配置 header：`x-crm-gmail-pubsub-secret=<CRM_GMAIL_PUBSUB_PUSH_SECRET>`。
3. subscription 启用 push authentication：
   - service account：`CRM_GMAIL_PUBSUB_AUTH_SERVICE_ACCOUNT`
   - audience：`CRM_GMAIL_PUBSUB_AUTH_AUDIENCE`
4. 用错误 secret 发送一次探测请求，应被拒绝。
5. 移除或伪造 `Authorization: Bearer <OIDC token>` 的探测请求，应被拒绝。
6. 通过真实 Pub/Sub 投递触发一次 push，确认 webhook 接受请求并入队。

通过标准：

- secret 和 OIDC 任一不匹配都拒绝。
- 日志不记录完整 secret、JWT、Authorization header。
- 非 active mailbox 的 push 被跳过，不入队 history sync。

### 7.4 History 拉取与客户回复入库

1. 使用 CRM 发送一封真实开发信到客户 Gmail。
2. 客户 Gmail 回复该线程。
3. 确认 Pub/Sub push 到达，history sync job 入队并执行。
4. History API 从 mailbox `lastHistoryId` 增量拉取变化，再通过 Message API 拉取邮件详情。
5. CRM 收件箱出现待处理回复，线程 unread/pending 状态正确。
6. 时间线出现客户回信事件，同公司当前 active 序列全部停止。

通过标准：

- 新回信按 Gmail `providerMessageId` 幂等入库，重复 push 不重复通知、不重复时间线。
- checkpoint 只在同步成功后推进。
- 退订、退信、普通回复按现有分类规则进入对应状态。

### 7.5 真实发送与系统内回复

1. 创建线索、联系人、产品线，生成首封草稿。
2. 审核草稿并启动发送。
3. 发送 worker 执行真实 Gmail `messages.send`。
4. 客户 Gmail 收到邮件，From 为授权 Gmail，主题和纯文本正文正确。
5. CRM message 写入 `providerMessageId/providerThreadId`，enrollment 状态推进。
6. 在 CRM 收件箱详情里发送纯文本回复。
7. 客户 Gmail 收到 CRM 内回复，且回复在同一 Gmail thread。

通过标准：

- worker 发送前通过 mailbox active、runVersion、messageId、额度、黑名单 guard。
- 发送成功后记录 provider id，并按策略生成下一封 follow-up 草稿。
- 系统内回复写时间线和收件箱消息；普通日志不记录完整正文。

### 7.6 外部 Gmail 手动回复同步

1. 打开已授权 Gmail 的 Gmail 网页或 App。
2. 在 CRM 发起的同一线程里手动发送一封回复。
3. 等待 Pub/Sub push 和 History sync。
4. 在 CRM 线索时间线查看同步结果。

通过标准：

- Gmail `SENT` 且非 `INBOX` 的消息被识别为 outbound。
- CRM 写入 `external_gmail_reply_sent` 时间线事件。
- 这类外部手动发送不进入客户回信收件箱，不触发同公司停发或退订逻辑。

### 7.7 Gmail Label / Delete 同步

在 Gmail 侧对已同步客户回复逐项操作：

1. 标为已读。
2. 再标为未读。
3. 归档，即移除 `INBOX`。
4. 移入垃圾箱或删除。

通过标准：

- `UNREAD` 去除后，CRM thread 变为 `handled` 且 unread count 清零。
- `UNREAD` 新增后，CRM thread 回到 `pending`。
- `INBOX` 去除、`TRASH` 新增或 `messageDeleted` 后，CRM thread 变为 `archived`。
- CRM 已同步的 `CrmInboxMessage` 正文、时间线和审计记录不删除。
- label/delete delta 处理成功后 checkpoint 正常推进。

### 7.8 History Expired 恢复 Runbook

触发条件：

- Gmail History API 返回 checkpoint 过期，worker 返回 `history_expired`。
- 邮箱行展示同步问题，owner 收到站内通知，系统日志出现 `gmail-history-expired`。

恢复步骤：

1. 进入 `CRM -> CRM 配置 -> 邮箱账号`。
2. 找到同步问题为 `history_expired` 的邮箱。
3. 点击该行“恢复同步”或“立即同步”。
4. 后端续订 Gmail watch，使用 Gmail 返回的新 `historyId` 重新初始化 checkpoint。
5. 确认邮箱行同步问题清空，`lastHistoryId` 更新，后续新邮件可正常同步。
6. 人工检查过期窗口内 Gmail 是否有漏同步客户回复；如有，手动在 CRM 备注或时间线补充最小必要信息。

通过标准：

- History expired 时旧 checkpoint 不被静默推进。
- 恢复操作不做无边界全量扫描旧邮件。
- 恢复后只保证新 checkpoint 之后的变化继续同步；过期窗口内可能漏掉的回复必须人工复核。

## 8. 部署与测试检查

部署前置检查：

```bash
pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma
pnpm --filter @soybean/server exec prisma migrate deploy --schema ../../prisma/schema.prisma
pnpm --filter @soybean/server build
pnpm build
```

运行期检查：

- PostgreSQL 可连接，迁移已执行。
- Redis 可连接，发送队列和 Gmail history sync worker 能启动。
- 后端 CORS 允许生产前端域名。
- Pub/Sub push subscription endpoint 使用 `https://<api-domain>/crm/gmail/pubsub/push`。
- Pub/Sub push subscription 带 `x-crm-gmail-pubsub-secret` header。
- Gmail watch 自动续订未被 `CRM_GMAIL_WATCH_RENEWAL_DISABLED=true` 关闭。

后端测试建议：

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.controller.spec.ts
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm.service.spec.ts apps/server/src/modules/crm/store/prisma-crm.store.spec.ts
pnpm --filter @soybean/server typecheck
```

前端测试建议：

```bash
pnpm typecheck
pnpm exec eslint --max-warnings=0 .
pnpm exec oxlint
```

人工验收必须覆盖：

- 普通成员不能查看或修改平台全局冷却期。
- 超管能在 CRM 配置页保存邮箱验证冷却期。
- 同 Gmail 地址不能绑定到多个组织。
- OAuth 授权后能创建 watch，并写入 `lastHistoryId/watchExpiration`。
- Pub/Sub push 必须同时通过 secret 和 OIDC 校验。
- History API 能从 checkpoint 拉取客户回复并幂等入库。
- 真实 Gmail 发送能写入 `providerMessageId/providerThreadId`。
- 客户回信后，同公司当前所有序列停止。
- 外部 Gmail 手动回复只写 outbound 时间线，不误入客户回信。
- Gmail 已读/未读、归档、删除能同步 CRM thread 状态。
- Gmail 删除/归档不删除 CRM 已同步正文。
- History expired 能通过恢复同步 runbook 重置 checkpoint。
- mock HTTP 调试接口在 production 下不可调用。
