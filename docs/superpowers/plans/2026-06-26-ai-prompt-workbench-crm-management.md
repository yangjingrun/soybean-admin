# AI 提示词工作台 CRM 管理实施计划

**目标：** 让“提示词配置”页面管理系统内置提示词，并把 CRM 开发信主链路用到的 `crm_outreach_*` 提示词纳入同一个后台页面管理。发布不再依赖草稿箱、测试按钮或人工校验闸口，管理员编辑后可以直接发布为全局版本。

**业务口径：**

- **内置生效**：数据库没有发布版本，业务正在使用代码里的系统内置提示词。
- **已发布覆盖**：数据库有发布版本，业务正在使用数据库版本覆盖系统内置提示词。
- 前端不再展示草稿箱；保存和发布合并成一次“发布全局版本”动作。
- 终端业务员不选择提示词，CRM 开发信生成链路自动按固定模块读取。

**本次不做：**

- 不做“运行测试后才能发布”。
- 不要求管理员先点“重新校验”。
- 不改后端提示词正文。
- 不碰无关 CRM 页面、爬虫存储文件、锁文件、生成文件。
- 不运行 `npm run build`。

---

## 执行步骤

### 第 1 步：补齐可管理提示词节点

在 `src/constants/ai-gateway.ts` 补齐 CRM 开发信主链路节点：

- `crm_outreach_base_rules`
- `crm_outreach_cold_email_core`
- `crm_outreach_sequence_strategy`
- `crm_outreach_role_persona`
- `crm_outreach_region_localization`
- `crm_outreach_public_source_grounding`
- `crm_outreach_subject_line`
- `crm_outreach_deliverability_guard`
- `crm_outreach_ai_polish`
- `crm_outreach_output_contract`

预期效果：左侧提示词列表能看到 AI 获客和 CRM 开发信方法论节点。

### 第 2 步：页面状态改成业务口径

在 `src/views/ai-prompt-settings/modules/shared.ts` 调整状态文案：

- 没有发布版本：`内置生效`
- 有发布版本：`已发布覆盖`

同时提供 `resolvePromptEffectiveSource()`，给编辑区展示“业务使用：系统内置 / 已发布覆盖”。

### 第 3 步：编辑区展示当前生效来源

在 `src/views/ai-prompt-settings/modules/PromptEditor.vue` 顶部补一个状态标签：

- `业务使用：系统内置`
- `业务使用：已发布覆盖`

预期效果：管理员能马上看懂现在业务生成开发信到底使用哪一份提示词。

### 第 4 步：右侧发布区去掉草稿和测试

在 `src/views/ai-prompt-settings/index.vue` 和 `PromptPublishPanel.vue` 去掉：

- 测试输入
- 运行测试
- 最近测试输出
- 保存草稿
- 草稿发布提示

只保留：

- 变更说明
- 发布全局版本
- 当前发布提示

### 第 5 步：后端提供直接发布接口

新增后端接口：

```text
POST /ai-gateway/prompt-workbench/versions/publish
```

请求体直接带：

```ts
{
  promptKey: string;
  title: string;
  systemPrompt: string;
  changeNote?: string | null;
}
```

后端发布时仍做基础规则校验；校验通过后直接写入：

- `AiPromptVersion`：生成新的发布版本号。
- `AiPromptConfig`：更新当前业务读取的生效提示词。

### 第 6 步：前端发布动作改成直接发布

在 `usePromptSettingsPage.ts` 中：

- `canPublish = Boolean(systemPrompt.trim()) && !publishing`
- 点击发布时直接调用 `publishAiPromptVersion()`
- 发布成功后刷新左侧步骤和当前详情

### 第 7 步：确认 CRM 开发信真实调用链

后端 CRM 开发信链路当前读取方式：

- `resolveCrmAiWritingModules()` 定义 `crm_outreach_*` 模块。
- `CrmAiDraftService.loadPromptModules()` 逐个加载模块。
- 每个模块通过 `AiGatewayService.getPrompt(module.promptKey)` 取提示词。
- `getPrompt()` 有数据库发布版本就用数据库版本；没有就用系统内置版本。

因此发布 `crm_outreach_base_rules` 后，后端生成 CRM 开发信时会读取这个发布版本。

### 第 8 步：最小验证

不运行 `npm run build`。

建议验证：

```bash
./node_modules/.bin/tsx --test src/views/ai-prompt-settings/modules/shared.spec.ts
./node_modules/.bin/tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts
./node_modules/.bin/tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts
./node_modules/.bin/tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-gateway/prisma-ai-prompt.store.spec.ts
./node_modules/.bin/vue-tsc --noEmit --skipLibCheck
git diff --check -- <本次相关文件>
```

---

## 最终效果

- 提示词配置页能管理 AI 获客和 CRM 开发信主链路提示词。
- 没发布时明确显示 **内置生效**，不是“没用”。
- 发布按钮可以直接发布当前编辑内容。
- 发布后业务使用数据库发布版本。
- CRM 开发信生成链路自动读取这些提示词，业务员页面不新增提示词选择。
