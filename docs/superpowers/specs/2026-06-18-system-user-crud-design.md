# 用户管理 CRUD 设计

## 背景

当前用户管理页面只展示 `auth.service.ts` 中的 demo 用户。后续需要给真实代理和内部账号配置登录、角色、状态、有效期，因此用户数据必须落 PostgreSQL，并让登录认证从数据库读取用户。

本期只做用户管理，不做套餐管理。套餐、订阅和额度后续独立成模块，不把 `packageType` 之类字段写进用户表。

## 目标

- 用户数据持久化到 PostgreSQL。
- 登录从数据库用户读取，不再依赖 demo 用户数组作为正式数据源。
- 用户管理支持新增、编辑、启用、禁用、重置密码和列表筛选。
- 禁用、过期、锁定用户不能登录；禁用和重置密码会清理该用户已有 token。
- 用户管理关键写操作记录系统日志。

## 非目标

- 不做删除用户，只允许禁用。
- 不做套餐、订阅、额度管理。
- 不做角色管理 CRUD，本期角色固定为 `R_SUPER`、`R_ADMIN`、`R_USER`。
- 不做邮箱、短信、重置链接。
- 不做首次登录强制改密。

## 数据模型

新增 `SystemUser` 表：

- `id`: string uuid 主键。
- `userName`: string，唯一，登录账号，可编辑。
- `nickName`: string，可空。
- `phone`: string，可空。
- `email`: string，可空。
- `roles`: `String[]`，保存固定角色编码。
- `status`: `enabled | disabled`。
- `companyName`: string，可空。
- `expireAt`: DateTime，可空；空表示长期有效。
- `remark`: string，可空。
- `passwordHash`: string。
- `passwordSalt`: string。
- `lastLoginAt`: DateTime，可空。
- `lastLoginIp`: string，可空。
- `failedLoginCount`: number，默认 0。
- `lockedUntil`: DateTime，可空。
- `passwordResetAt`: DateTime，可空。
- `createdAt`: DateTime。
- `updatedAt`: DateTime。

初始数据保留现有账号：`Super`、`Admin`、`User`、`Soybean`，密码先沿用 `123456`，角色沿用当前 demo 配置。

## 认证规则

- 登录账号只使用 `userName`。
- 密码使用 Node `crypto.scrypt` 和随机 salt 哈希存储，不新增生产依赖。
- 登录时按顺序检查：
  - 用户存在。
  - 用户状态为启用。
  - 用户未过期。
  - 用户未处于锁定期。
  - 密码匹配。
- 连续 5 次密码错误锁定 15 分钟。
- 登录成功后清空失败次数和锁定时间，并记录 `lastLoginAt`、`lastLoginIp`。
- `getUserByAccessToken` 解析 token 后再次检查用户状态、过期和锁定；不满足则返回登录失效。
- 禁用用户、重置密码时清理该用户所有 access token 和 refresh token。
- 修改用户名不踢下线，下次登录使用新用户名。

## 用户管理规则

- 新增用户由系统生成临时密码，只在新增成功响应中返回一次。
- 重置密码由系统生成临时密码，只在重置成功响应中返回一次。
- 临时密码不强制修改。
- 用户名必须唯一。
- 用户至少分配一个角色。
- 不能禁用当前登录用户。
- 不能把当前登录用户自己的 `R_SUPER` 角色移除。
- 系统必须始终保留至少一个启用、未过期、拥有 `R_SUPER` 的用户。
- 到期用户可以通过编辑 `expireAt` 到未来时间或清空为长期有效来恢复登录。

## 后端接口

- `GET /system-users`: 查询用户列表，支持分页、关键词、角色、状态、过期状态。
- `POST /system-users`: 新增用户，返回用户记录和一次性临时密码。
- `PATCH /system-users/:id`: 编辑用户资料、角色、有效期、备注。
- `PATCH /system-users/:id/status`: 启用或禁用用户；禁用时立刻清 token。
- `POST /system-users/:id/reset-password`: 重置密码，返回一次性临时密码并清 token、解除锁定。

所有接口仅 `R_SUPER` 可访问。

## 日志

通过 `SystemLogService` 记录：

- `system-user/create`
- `system-user/update`
- `system-user/enable`
- `system-user/disable`
- `system-user/reset-password`

日志包含操作者、目标用户、动作结果和必要变更摘要。禁止写入临时密码、密码哈希、salt、token。

## 前端页面

升级 `src/views/manage/user`：

- 列表列：用户名、昵称、角色、启用状态、过期状态、锁定状态、公司、最后登录、操作。
- 筛选项：关键词、角色、状态、过期状态。
- 操作：新增、编辑、启用、禁用、重置密码、刷新、列设置。
- 新增/编辑使用抽屉表单。
- 禁用和重置密码使用二次确认。
- 新增和重置成功后弹窗显示临时密码，提示“仅展示一次”。

## 后续套餐扩展

本期不实现套餐字段。后续单独设计：

- `PackagePlan`: 试用、普通、Pro 套餐定义。
- `UserSubscription`: 用户订阅，支持包月、包年、开始/结束时间、状态。
- `UserQuota` 或 `QuotaLedger`: 额度余额或流水。

用户管理只保留账号有效期 `expireAt`，不表达套餐到期。

## 验证

- 后端单元测试覆盖新增、编辑、禁用、启用、重置密码、登录失败锁定、禁用/过期/锁定登录拒绝、超管保护。
- 前端 helper 测试覆盖查询参数构造、状态展示判断。
- 运行最小相关测试和 `pnpm typecheck`。
- 不运行 `npm run build`。
