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
