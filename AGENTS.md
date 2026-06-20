# AGENTS.md

## 通用规则

- 写代码保持低耦合、高内聚，优先沿用项目已有结构和写法。
- 不写过度兜底，按现有接口、文档和业务约定实现。
- 公共方法、抽离方法尽量写 JSDoc；关键逻辑写简短注释即可。
- 需求没有明确要求时，不要顺手扩大修改范围。
- 执行完不需要运行 `npm run build`。
- 默认使用中文回复用户；代码命名、类型命名保持英文。
- 修改前先看相邻文件和现有调用方式，避免只凭文件名猜结构。
- 执行任务前先读取 `docs/agent-memory.md`，结合其中已确认经验避免重复踩坑。

## 项目记忆规则

- `docs/agent-memory.md` 只记录当前项目可复用的踩坑经验，不作为全局规则使用。
- 任务中遇到报错、接口约定、框架用法或业务流程坑点时，只有在复现、定位并确认解决后，才追加到项目记忆。
- 记录内容要写成行动规则，包含场景、坑点、正确做法、相关文件和验证方式，避免保存聊天流水账。
- 不能把敏感信息写入项目记忆；必要时只记录脱敏后的标识和最小上下文。
- 如果只是临时猜测或尚未验证的线索，先放到 `待确认经验`，不要直接写入 `已确认经验`。
- 发现项目记忆和当前代码不一致时，优先按当前代码核实，并同步修正或废弃旧经验。

## 项目结构规则

- 前端页面放在 `src/views`，页面私有组件优先放对应页面的 `modules` 目录。
- 前端接口请求放在 `src/service/api`，请求封装相关逻辑放在 `src/service/request`。
- Pinia 状态放在 `src/store/modules`，不要在页面里堆全局共享状态。
- 通用 hooks 放在 `src/hooks/common`，业务 hooks 放在 `src/hooks/business`。
- 通用组件放在 `src/components/common` 或 `src/components/custom`，不要随意新建平行组件目录。
- 常量放在 `src/constants`，枚举放在 `src/enum`。
- 工具函数放在 `src/utils`；如果和 Vue 响应式强相关，优先放 hooks。
- 后端代码放在 `apps/server/src`，模块代码放在 `apps/server/src/modules`，跨模块共享逻辑放在 `apps/server/src/shared`。

## 前端规则

- Vue 代码优先使用 Composition API 和 `<script setup lang="ts">`。
- 样式和交互优先参考 Naive UI 的组件、主题变量和现有页面风格。
- 能用 Naive UI 组件解决的表单、弹窗、按钮、提示、表格、分页等，不要重复手写一套基础 UI。
- 自定义样式优先保持轻量，避免覆盖 Naive UI 的核心交互状态。
- 页面级样式就近放在对应 `.vue` 文件内；可复用样式再抽到共享样式文件。
- UnoCSS 可以用于布局、间距、尺寸等轻量样式；不要引入新的 UI 框架或样式体系。
- 表单校验、弹窗、消息提示、加载态优先使用 Naive UI 现有能力。
- 页面逻辑过重时，优先拆到页面 `modules`、hooks 或 service，不要把所有逻辑塞进一个 `.vue`。
- Props down、events up；只有真实双向绑定场景才用 `v-model`。
- 共享状态优先 Pinia；页面局部状态优先 `ref`、`reactive`、`computed`。

## 类型文件放置规则

- 前后端共用类型放在 `packages/shared/src`，不要在前端和后端各写一份。
- 前端全局类型放在 `src/typings`。
- 前端接口类型放在 `src/typings/api`，按业务模块拆分，例如 `auth.d.ts`、`route.d.ts`。
- 前端页面或组件私有类型优先就近放在对应页面、组件或模块目录内。
- 后端模块私有类型放在对应模块目录，例如 `apps/server/src/modules/auth/auth.types.ts`。
- 后端 DTO 放在对应模块的 `dto` 目录，例如 `apps/server/src/modules/auth/dto`。
- 后端跨模块共享的服务端类型放在 `apps/server/src/shared`。
- 只在类型确实被前后端共同使用时，才提升到 `packages/shared/src`。
- 不要为了消除 TypeScript 报错随意写 `any`、`as any`、`@ts-ignore`；应优先修正真实类型。
- 接口返回结构要跟后端或共享类型对齐，不要在前端临时伪造另一套数据结构。

## 后端规则

- Controller 只处理入参、鉴权边界和响应组织，业务逻辑放 Service。
- DTO 只描述请求结构和校验意图，不承载业务逻辑。
- 模块内部类型放模块内，跨模块复用再提升到 `shared` 或 `packages/shared`。
- 后端不要直接依赖 `src` 前端目录下的类型。
- 业务数据、系统配置和用户配置默认持久化到 PostgreSQL；Redis 最多用于缓存、会话、验证码、短期队列等临时数据，不作为唯一数据源。
- 抽出 `apps/server/src/shared` 共享 helper 后，要同步把同类业务调用迁过去，并补测试覆盖真实调用；不要只新增 helper 定义却让业务继续手写旧结构。
- 普通业务 Controller 做角色判断时，先用 `requireRequestUserContext()` 统一未登录语义，再调用 `assertSuper`、`assertOrganizationAdmin` 等权限 policy，避免同类接口 401/403 语义不一致。
- 后台任务状态事件统一优先用 `createTaskStateChangeEvent()` 构造，再写入模块自己的 event store；事件字段变化时要同时核对 helper、业务调用和 spec。

## Serper API 规则

- Serper 细节以官方站点和 Playground 为准，官方入口：`https://serper.dev/`。
- 当前项目后端通过 `SerperClient` 调用 Serper，默认 base 为 `https://google.serper.dev`，只使用 `POST` JSON 请求，Header 必须包含 `Content-Type: application/json` 和 `X-API-KEY`。
- 当前项目 AI 获客只使用 `search` 和 `places` 两个 endpoint：`/search` 用于 Google Search 结果，`/places` 用于本地商家/地点结果；不要默认使用 Maps，除非需求明确要求地图扫点。
- Search 请求体按项目约定包含 `q`、`gl`、`hl`、`location`、`num`、`page`，可选 `tbs`；`q` 必须是可直接执行的搜索词，不能为了展示翻译而加入中文括号备注。
- Places 请求体按项目约定包含 `q`、`gl`、`hl`、`location`、`num`、`page`；`q` 必须是自然本地商家搜索短语，例如 `bearing supplier Riyadh`，不要使用 `site:`、`inurl:` 或复杂 Boolean。
- `num` 默认 10，`page` 默认 1；普通官网、进口商、经销商、批发商、库存商、供应商查询使用 Any time，不传 `tbs`。
- 只有近期展会、新闻、招标、采购动态、新增代理、近期项目等时效型查询才使用 `tbs`：`past_hour=qdr:h`、`past_24_hours=qdr:d`、`past_week=qdr:w`、`past_month=qdr:m`、`past_year=qdr:y`。
- KeywordOptimize 提示词输出 Serper 查询时，优先使用 `endpoint + requestBody + meta` 嵌套结构：`requestBody` 只放 Serper 可执行字段，`meta` 放 `buyerType`、`intent`、`priority`、`dateRange`、`reason` 等人读字段。
- 前后端需要兼容历史平铺结构（例如 `q/gl/hl/location/priority` 直接在 query 对象上），但新增提示词和新代码优先按嵌套结构实现。
- Search 响应主要读取 `organic[]` 的 `title/link/snippet`；Places 响应主要读取 `places[]` 或 `localResults[]` 的 `title/website/address/phoneNumber/cid/placeId` 等字段。
- 非中文术语的中文备注只放在结构化回显字段或 `meta.reason` 等展示字段里，不要污染 `requestBody.q`、`gl`、`hl`、`location`、`num`、`page`。

## 日志规则

- 关键业务动作、AI/外部服务调用、配置变更、登录/权限异常、重要错误边界必须记录业务日志，便于超级管理员追踪问题。
- 日志写入优先走后端日志服务，不要用 `console.log`、调试输出或前端临时代码代替正式日志。
- 错误日志要记录模块、动作、用户、失败原因和必要上下文；上下文保持简洁，只放排查必需字段。
- 禁止写入密码、token、完整 apiKey、验证码、Cookie 等敏感信息；需要定位时只记录脱敏后的标识。
- 捕获错误后不能静默吞掉；记录日志后仍按业务约定返回错误或继续抛出。

## 抽离原则

- 只有多个地方复用、逻辑明显变复杂，或能降低页面负担时才抽离。
- 业务类型优先跟随业务模块；确实需要前后端共用时，再提升到 `packages/shared/src`。
- 不为了“看起来通用”提前创建过大的工具、类型或组件。
- 只被一个地方使用的小函数、小组件，不要强行抽成全局通用模块。

## 依赖规则

- 新增生产依赖前先确认；不要为了一个小功能引入新库。
- 优先使用项目已有依赖：Naive UI、UnoCSS、VueUse、Pinia、Vue Router、dayjs 等。
- 修改 `package.json` 后才允许同步修改锁文件；不要无原因改 `pnpm-lock.yaml`。

## 验证规则

- 不需要运行 `npm run build`。
- 改 TypeScript 类型、共享类型或核心逻辑时，可优先运行 `pnpm typecheck`。
- 改 lint/格式相关内容时，可运行 `pnpm lint` 或 `pnpm fmt`。
- 只运行和本次改动相关的最小检查，不做无关的大范围验证。
- 如果没有运行检查，最终说明原因。

## AI 防踩坑规则

- 不主动修改 `.env*`、配置文件、锁文件、生成文件，除非任务明确需要。
- 不要把 mock 数据、调试日志、临时代码留在正式逻辑里。
- 不要吞掉错误：避免空 `catch`、无提示失败、静默返回假成功。
- 不要写多层“保险兜底”掩盖真实状态；按接口和业务约定处理。
- 不要为了让类型通过而改变业务语义，例如把必填字段改成可选。
- 不要重复造已有能力：先查 `components`、`hooks`、`utils`、`service`、`store` 是否已有类似实现。
- 不要只改表面 UI；涉及状态流转、筛选、统计、权限、接口字段时，要检查上下游是否需要同步。
- 涉及权限控制的改动，前端入口、菜单、页面区块或按钮要做展示/操作限制，后端接口也必须做鉴权/授权保护；不能只依赖前端隐藏。
- 不要顺手重构无关文件；如果发现无关问题，先在回复里说明，不直接改。
- 不要删除已有逻辑，除非用户明确说删除或该逻辑确认无用。
- 路由、菜单、权限相关修改要先看现有路由生成和守卫逻辑，避免只改一个入口导致另一个入口失效。
- 用户明确限定“只改这个点”时，只处理该点。

## Git 规则

- 每次做完功能后，默认提交本次功能相关代码。
- 如果只是只读检查、解释问题、整理文档，或用户明确说“不提交”，则不提交。
- 提交前先看 `git status`，区分 staged 和 unstaged，避免带入无关改动。
- 用户只要求提交暂存区时，只提交 staged 内容。
- 提交前检查 diff，确认只包含本次任务相关改动。
- commit message 用简短中文或项目已有风格。
