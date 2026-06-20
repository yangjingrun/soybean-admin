# CRM Gmail 本地发信模式联调

本文档用于在没有 HTTPS 域名、没有 Pub/Sub、没有完整 Google OAuth 审核前，先把“用户绑定 Gmail -> 服务器后台真实发信”的本地闭环跑通。不要在本文档写真实密钥。

## 目标

本地先验证：

1. 用户在前端点击授权 Gmail。
2. Google 回调到本地前端页面。
3. 后端保存加密 refresh token。
4. CRM 草稿审核后，由后端 worker 调 Gmail API 真实发信。

本地暂不验证：

- Gmail Pub/Sub 实时收信。
- Gmail History 自动同步客户回信。
- 已读、未读、删除、归档状态同步。

这些需要 HTTPS 域名、Pub/Sub push endpoint 和更高 Gmail scope，放到正式联调阶段处理。

## Google Cloud 本地配置

在 Google Cloud Console 里准备：

1. 创建或选择一个 Google Cloud Project。
2. 启用 Gmail API。
3. OAuth consent screen 使用 Testing 模式。
4. 把自己的 Gmail 加到 Test users。
5. 创建 OAuth Client，类型选择 Web application。
6. Authorized redirect URI 填：

```text
http://localhost:9527/crm/gmail-oauth-callback
```

## 本地环境变量

在本地运行环境里配置下面变量。不要提交真实值。

```env
CRM_GMAIL_OAUTH_CLIENT_ID=<google-oauth-client-id>
CRM_GMAIL_OAUTH_CLIENT_SECRET=<google-oauth-client-secret>
CRM_GMAIL_OAUTH_REDIRECT_URI=http://localhost:9527/crm/gmail-oauth-callback
CRM_GMAIL_TOKEN_ENCRYPTION_KEY=12345678901234567890123456789012
CRM_GMAIL_OAUTH_STATE_SECRET=local-gmail-oauth-state-secret
CRM_GMAIL_OAUTH_SCOPES=https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email
```

不要配置 `CRM_GMAIL_PUBSUB_TOPIC_NAME`。本地发信模式会启用真实 Gmail 发送网关，但 watch/history 会保持 mock，避免没有 HTTPS/PubSub 时卡住授权。

## 本地启动

```bash
docker compose up -d postgres redis
pnpm prisma migrate deploy
pnpm --filter @soybean/server exec prisma generate --schema ../../prisma/schema.prisma
pnpm server:dev
pnpm dev
```

前端默认访问：

```text
http://localhost:9527
```

后端默认访问：

```text
http://localhost:9528
```

## 联调步骤

1. 登录系统。
2. 进入 `CRM -> CRM 配置 -> 邮箱账号`。
3. 点击授权 Gmail。
4. 在 Google 授权页同意授权。
5. 回到本地 `/crm/gmail-oauth-callback` 后确认邮箱出现在列表里。
6. 创建或导入一个 CRM 客户和联系人。
7. 配置产品线、职位画像、开发信模板、序列策略。
8. 生成 AI 草稿。
9. 人工审核草稿。
10. 启动发送，等待发送 worker 处理。
11. 到收件邮箱确认真实邮件收到。

## 正式同步模式切换

等 HTTPS 域名、隐私政策、Google OAuth 审核和 Pub/Sub 都准备好后，再切到完整同步模式：

```env
CRM_GMAIL_OAUTH_SCOPES=https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send
CRM_GMAIL_PUBSUB_TOPIC_NAME=projects/<project-id>/topics/<topic-name>
CRM_GMAIL_PUBSUB_PUSH_SECRET=<pubsub-push-header-secret>
CRM_GMAIL_PUBSUB_AUTH_AUDIENCE=https://<api-domain>/crm/gmail/pubsub/push
CRM_GMAIL_PUBSUB_AUTH_SERVICE_ACCOUNT=<pubsub-push-service-account-email>
```

完整同步模式会启用真实 watch/history，用于客户回信入库、同公司序列停发、Gmail 状态同步。
