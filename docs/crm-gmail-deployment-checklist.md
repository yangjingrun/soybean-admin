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
  -> 找到 active Mailbox
  -> 入队 Gmail history sync job
  -> History API 增量拉取变化
  -> Message API 拉取相关邮件
  -> 入库收件箱/时间线
```

联调重点：

- Pub/Sub push endpoint 必须是公网 HTTPS。
- 生产环境必须配置 `CRM_GMAIL_PUBSUB_PUSH_SECRET`；缺少该变量时 webhook 会拒绝请求。
- webhook secret 错误时应返回拒绝。
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

## 7. 验收检查

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
- 客户回信后，同公司当前所有序列停止。
- Gmail 删除/归档不删除 CRM 已同步正文。
- mock HTTP 调试接口在 production 下不可调用。
