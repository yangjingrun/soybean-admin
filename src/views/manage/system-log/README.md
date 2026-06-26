# 日志管理功能说明

## 当前功能

日志管理用于给超级管理员查看系统关键操作和错误记录，当前入口为系统管理下的 `manage_system-log` 路由，仅 `R_SUPER` 角色可见。

页面当前支持：

- 查看最近日志列表，后端默认按 `createdAt` 倒序返回。
- 按时间范围、用户、模块、等级、状态、关键词筛选。
- 查看当前生效筛选条件，并支持单个清除。
- 查看日志详情，包括基础信息、错误信息和 `metadata`。
- 在详情抽屉中查看请求上下文，例如 `requestId`、`ip`、`userAgent`。
- 复制 `requestId` 和 `metadata`，便于排查和转交开发。
- 从历史日志中读取用户筛选项。

当前日志等级：

- `info`：普通业务日志。
- `warn`：警告日志。
- `error`：错误日志。

当前日志状态：

- `processing`：长任务处理中或阶段进度。
- `success`：操作成功。
- `failed`：操作失败。

## 前端结构

- `index.vue`：页面容器，负责筛选状态、分页状态、接口请求和详情抽屉状态。
- `modules/FilterPanel.vue`：筛选表单，负责时间、用户、模块、等级、状态、关键词输入和当前筛选条件。
- `modules/LogTable.vue`：日志表格和分页，按审计台账视角展示模块/动作、操作人、IP、摘要和错误码。
- `modules/LogDetailDrawer.vue`：日志详情抽屉，按摘要、基础信息、请求上下文、错误信息和 `metadata` 分层展示。
- `modules/shared.ts`：日志等级、状态、模块选项、筛选参数构造，以及日期和 metadata 格式化方法。

前端接口在 `src/service/api/system-log.ts`：

- `fetchSystemLogs`：分页查询日志。
- `fetchSystemLogDetail`：查询单条日志详情。
- `fetchSystemLogUsers`：查询可筛选用户。

前端类型在 `src/typings/api/system-log.d.ts`，页面字段应优先和这里对齐。

## 后端结构

后端模块在 `apps/server/src/modules/system-log`：

- `system-log.controller.ts`：提供日志查询接口，并校验当前用户必须是 `R_SUPER`。
- `system-log.service.ts`：处理筛选、分页、详情读取和业务日志写入。
- `store/prisma-system-log.store.ts`：通过 Prisma 访问 `SystemLog` 表。
- `dto/system-log-query.dto.ts`：查询参数校验。
- `system-log.types.ts`：日志模块内部类型。

数据库结构在 `prisma/schema.prisma`，当前核心表为 `SystemLog`。

## 日志写入约定

业务代码需要写日志时，优先注入并调用后端 `SystemLogService.record(...)`，不要直接操作 Prisma，也不要用 `console.log` 代替业务日志。

建议记录的场景：

- AI、大模型、邮件、第三方接口等外部服务调用成功或失败。
- 登录、权限、配置保存等关键业务动作。
- 重要错误边界，例如调用失败、配置缺失、权限拒绝。

写入日志时应包含：

- `module`：业务模块，例如 `ai-gateway`。
- `action`：动作，例如 `generate-text`。
- `level`：`info`、`warn` 或 `error`。
- `status`：`processing`、`success` 或 `failed`。
- `message`：面向排查的简短中文说明。
- `userId`、`userName`：能拿到当前用户时必须带上。
- `errorMessage`：失败时记录错误原因。
- `metadata`：只放排查必要上下文。

禁止写入密码、token、完整 apiKey、验证码、Cookie 等敏感信息。日志服务会过滤常见敏感字段，但业务侧仍应先避免传入。

## 已接入日志的业务

当前已接入：

- `auth/login`
  - 登录成功时记录 `info + success`。
  - 登录失败时记录 `warn + failed`，并记录失败原因。
  - `metadata` 会记录 `ip` 和 `userAgent`，失败时额外记录尝试登录的 `userName`。
- `auth/logout`
  - 用户主动退出时记录 `info + success`。
  - `metadata` 会记录 `ip` 和 `userAgent`。
- `ai-gateway/generate-text`
  - 长任务开始和调用模型中记录 `info + processing`，动作使用 `generate-text-progress`。
  - 成功时记录 `info + success`。
  - 大模型调用失败时记录 `error + failed`，并继续抛出原错误。

后续新增关键业务时，应同步考虑是否需要记录日志，并让日志管理页能通过模块或关键词筛到对应记录。

## 首版边界

首版以排查和审计查看为主，不做日志删除、批量操作、复杂统计图和导出。后续如需导出筛选结果，应仅允许超级管理员操作，并记录一次导出日志。
