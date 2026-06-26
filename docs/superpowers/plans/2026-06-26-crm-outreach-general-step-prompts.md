# CRM 开发信通用 1-5 封提示词配置实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AI 提示词配置页中管理 CRM 开发信“通用模板”的第 1-5 封内部提示词，并让 CRM AI 写信按当前邮件 stepIndex 自动使用已发布提示词。

**Architecture:** 先不做完整多行业提示词包数据库模型。一期把当前轴承写信规则定义为 `通用模板`，通过 5 个固定 AI Gateway promptKey 发布管理；产品资料中预留“提示词模板”选择字段，当前只有 `通用模板` 一个选项。超级管理员维护和发布全局模板，CRM 业务角色只能在产品资料里选择模板和填写本产品补充要求。

**Tech Stack:** Vue 3 + Naive UI + TypeScript 前端；NestJS + Prisma + PostgreSQL 后端；沿用现有 `AiPromptConfig` / `AiPromptVersion` 发布链路。

---

## 文件职责

- `apps/server/src/modules/ai-gateway/ai-gateway.constants.ts`
  - 增加通用模板第 1-5 封 prompt 定义、channel、校验关键字和默认系统提示词。
- `src/constants/ai-gateway.ts`
  - 增加前端提示词配置页可见的 5 个 prompt 选项。
- `apps/server/src/modules/crm/crm.types.ts`
  - 给产品资料 AI 写信配置增加 `promptTemplateKey?: 'crm_outreach_general'`。
- `src/typings/api/crm.d.ts`
  - 同步前端 API 类型。
- `apps/server/src/modules/crm/crm-ai-draft-prompt.ts`
  - 规范化 `promptTemplateKey`，旧数据为空时默认通用模板。
- `src/views/crm/settings/modules/product-line-settings.ts`
  - 产品资料表单默认值、归一化、摘要和版本差异中加入“提示词模板”。
- `src/views/crm/settings/modules/ProductLineFormDrawer.vue`
  - AI 写信区域增加“提示词模板”选择框；当前只有“通用模板”。
- `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module.types.ts`
  - 模块解析输入增加 `promptTemplateKey`。
- `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module-resolver.ts`
  - 按 `promptTemplateKey + stepIndex` 注入第 1-5 封提示词模块。
- `apps/server/src/modules/crm/crm-ai-draft.service.ts`
  - 调用 resolver 时传入产品资料选择的模板。
- `apps/server/src/modules/ai-gateway/ai-gateway.controller.ts`
  - 修改提示词发布、回滚、保存等变更接口权限：只有超级管理员能改。
- 测试文件
  - 更新 AI Gateway prompt 列表、CRM 模块选择、产品资料配置归一化等测试。

## Task 1: 增加通用模板第 1-5 封 promptKey

**Files:**
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.constants.ts`
- Modify: `src/constants/ai-gateway.ts`
- Test: `apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts`
- Test: `src/service/api/ai-gateway.spec.ts`

- [ ] **Step 1: 后端增加 5 个 prompt 定义**

在 `aiPromptDefinitions` 的 CRM 写信分组中插入：

```ts
{
  promptKey: 'crm_outreach_general_step_1_relevance',
  title: '通用模板第 1 封：相关性与初始价值',
  usage: 'CRM 通用开发信模板：第 1 封建立客户/岗位/产品相关性，并给出低摩擦 CTA。',
  group: 'crm_outreach'
},
{
  promptKey: 'crm_outreach_general_step_2_product_decision',
  title: '通用模板第 2 封：具体产品或采购判断',
  usage: 'CRM 通用开发信模板：第 2 封推进一个具体产品、型号、采购条件或替换判断。',
  group: 'crm_outreach'
},
{
  promptKey: 'crm_outreach_general_step_3_risk_validation',
  title: '通用模板第 3 封：采购风险与验证路径',
  usage: 'CRM 通用开发信模板：第 3 封聚焦样品、检验、认证、规格确认等一个验证路径。',
  group: 'crm_outreach'
},
{
  promptKey: 'crm_outreach_general_step_4_role_choice',
  title: '通用模板第 4 封：选择题跟进',
  usage: 'CRM 通用开发信模板：第 4 封用 A/B/C/D/E 选择题降低客户回复门槛。',
  group: 'crm_outreach'
},
{
  promptKey: 'crm_outreach_general_step_5_polite_close',
  title: '通用模板第 5 封：轻退出与未来入口',
  usage: 'CRM 通用开发信模板：第 5 封礼貌结束本轮自动触达，保留转交或未来再联系入口。',
  group: 'crm_outreach'
}
```

- [ ] **Step 2: 后端补 channel、输出字段和必填规则**

在同文件补齐：

```ts
crm_outreach_general_step_1_relevance: 'crm_email',
crm_outreach_general_step_2_product_decision: 'crm_email',
crm_outreach_general_step_3_risk_validation: 'crm_email',
crm_outreach_general_step_4_role_choice: 'crm_email',
crm_outreach_general_step_5_polite_close: 'crm_email'
```

`aiPromptOutputTopLevelFields` 五项都设为 `[]`。

`aiPromptRequiredTextRules` 增加：

```ts
crm_outreach_general_step_1_relevance: ['只输出一个合法 JSON 对象', 'Step 1', '相关性', '低摩擦 CTA'],
crm_outreach_general_step_2_product_decision: ['只输出一个合法 JSON 对象', 'Step 2', '具体判断对象', 'follow-up 必须增加新价值'],
crm_outreach_general_step_3_risk_validation: ['只输出一个合法 JSON 对象', 'Step 3', '验证路径', '不编造事实'],
crm_outreach_general_step_4_role_choice: ['只输出一个合法 JSON 对象', 'Step 4', 'A/B/C/D/E', 'one_letter'],
crm_outreach_general_step_5_polite_close: ['只输出一个合法 JSON 对象', 'Step 5', '轻退出', '停止本轮自动序列']
```

- [ ] **Step 3: 增加 5 个默认系统提示词**

在 `Object.assign(defaultAiPromptSystemPrompts, {...})` 内增加 5 项，先沿用现有通用规则和当前轴承策略：

```ts
crm_outreach_general_step_1_relevance: `${crmOutreachDefaultPromptRules}

通用模板第 1 封重点：
- Step 1 Day 1：建立客户相关性、联系人岗位相关性和一个初始价值。
- 用一个产品、产品族、designation、配置或供应价值作为切入点。
- CTA 只能是 permission_send、compare_one、micro_input 或 confirm_relevance。
- 不要用城市、客户类型标签、公司介绍或 generic short list 撑开场。
- 轴承场景优先使用 designation、replacement、cross-reference、series coverage、MOQ/lead-time check、backup supply、production continuity 等保守表达。`,
```

第 2-5 封分别写入当前 `crmOutreachDefaultPromptRules` 中对应的职责：

- Step 2：具体判断对象，禁止 short model list / brief overview。
- Step 3：一个验证风险，proof 不足时问客户先需要哪种验证。
- Step 4：A/B/C/D/E 选择题，D 是转交，E 是暂不需要。
- Step 5：轻退出，close / redirect / future trigger，不再推销。

- [ ] **Step 4: 前端提示词选项同步**

在 `src/constants/ai-gateway.ts` 增加同样 5 个选项，label 与后端 title 保持一致。

- [ ] **Step 5: 更新 prompt 列表测试**

在 `apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts` 的 CRM promptKey 断言中加入 5 个新 key，位置放在 `crm_outreach_sequence_strategy` 后面。

- [ ] **Step 6: 跑最小验证**

Run:

```bash
./node_modules/.bin/tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts
./node_modules/.bin/tsx --test src/service/api/ai-gateway.spec.ts
```

Expected: 相关测试通过。

## Task 2: 产品资料 AI 写信配置预留“提示词模板”选择

**Files:**
- Modify: `apps/server/src/modules/crm/crm.types.ts`
- Modify: `src/typings/api/crm.d.ts`
- Modify: `apps/server/src/modules/crm/crm-ai-draft-prompt.ts`
- Modify: `src/views/crm/settings/modules/product-line-settings.ts`
- Modify: `src/views/crm/settings/modules/ProductLineFormDrawer.vue`
- Test: `apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts`
- Test: `src/views/crm/settings/modules/shared.spec.ts`

- [ ] **Step 1: 类型增加模板字段**

在 `CrmProductLineAiWritingConfig` 中增加：

```ts
promptTemplateKey?: 'crm_outreach_general';
```

前端 `Api.Crm.ProductLineAiWritingConfig` 同步增加同字段。

- [ ] **Step 2: 后端归一化默认通用模板**

在 `normalizeOptionalAiWritingStyle()` 返回值中加入：

```ts
promptTemplateKey: normalizePromptTemplateKey(record.promptTemplateKey),
```

在同文件增加 helper：

```ts
function normalizePromptTemplateKey(value: unknown): NonNullable<CrmProductLineAiWritingConfig['promptTemplateKey']> {
  return value === 'crm_outreach_general' ? 'crm_outreach_general' : 'crm_outreach_general';
}
```

当前只有一个通用模板，所以未知值和旧数据都归一到 `crm_outreach_general`。

- [ ] **Step 3: 前端增加唯一模板选项**

在 `product-line-settings.ts` 增加：

```ts
export const productLineAiPromptTemplateOptions = [
  { label: '通用模板', value: 'crm_outreach_general' }
] satisfies Array<{ label: string; value: NonNullable<Api.Crm.ProductLineAiWritingConfig['promptTemplateKey']> }>;
```

`createDefaultProductLineAiWritingConfig()` 增加：

```ts
promptTemplateKey: 'crm_outreach_general',
```

`normalizeProductLineAiWritingConfig()` 中同步 `promptTemplateKey`，没有值时默认 `crm_outreach_general`。

- [ ] **Step 4: 产品资料抽屉增加选择框**

在 AI 写信区域 `序列策略` 前增加：

```vue
<NGi span="24 m:12">
  <NFormItem label="提示词模板">
    <NSelect
      v-model:value="formModel.aiWritingConfig.promptTemplateKey"
      :options="productLineAiPromptTemplateOptions"
      :disabled="isAiWritingConfigReadonly"
      placeholder="通用模板"
    />
  </NFormItem>
</NGi>
```

同时从脚本 import `productLineAiPromptTemplateOptions`。

- [ ] **Step 5: 摘要和版本差异展示模板**

`summarizeProductLineAiWritingConfig()` 增加 `promptTemplateLabel`，显示 `通用模板`。

`buildProductLineAiPromptVersionDiffItems()` 在启用状态后增加一项：

```ts
pushProductLinePromptDiffItem(
  diffItems,
  'promptTemplateKey',
  '提示词模板',
  versionSummary.promptTemplateLabel,
  currentSummary.promptTemplateLabel
);
```

- [ ] **Step 6: 跑最小验证**

Run:

```bash
./node_modules/.bin/tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts
./node_modules/.bin/tsx --test src/views/crm/settings/modules/shared.spec.ts
```

Expected: 产品资料 AI 写信配置旧数据会默认 `通用模板`，版本差异能展示模板字段。

## Task 3: CRM AI 写信按 stepIndex 加载对应模板提示词

**Files:**
- Modify: `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module.types.ts`
- Modify: `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module-resolver.ts`
- Modify: `apps/server/src/modules/crm/crm-ai-draft.service.ts`
- Test: `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module-resolver.spec.ts`
- Test: `apps/server/src/modules/crm/crm-ai-draft.service.spec.ts`

- [ ] **Step 1: resolver 输入增加模板 key**

在 `CrmAiWritingModuleResolveInput` 增加：

```ts
promptTemplateKey?: CrmAiDraftPromptInput['writingConfig']['promptTemplateKey'];
```

- [ ] **Step 2: resolver 增加 step prompt 映射**

在 `crm-ai-writing-module-resolver.ts` 增加：

```ts
const generalStepModules: Record<number, CrmAiWritingSelectedModule> = {
  1: {
    promptKey: 'crm_outreach_general_step_1_relevance',
    title: '通用模板第 1 封：相关性与初始价值',
    reason: 'Required for the current general template Step 1 writing duty.'
  },
  2: {
    promptKey: 'crm_outreach_general_step_2_product_decision',
    title: '通用模板第 2 封：具体产品或采购判断',
    reason: 'Required for the current general template Step 2 writing duty.'
  },
  3: {
    promptKey: 'crm_outreach_general_step_3_risk_validation',
    title: '通用模板第 3 封：采购风险与验证路径',
    reason: 'Required for the current general template Step 3 writing duty.'
  },
  4: {
    promptKey: 'crm_outreach_general_step_4_role_choice',
    title: '通用模板第 4 封：选择题跟进',
    reason: 'Required for the current general template Step 4 writing duty.'
  },
  5: {
    promptKey: 'crm_outreach_general_step_5_polite_close',
    title: '通用模板第 5 封：轻退出与未来入口',
    reason: 'Required for the current general template Step 5 writing duty.'
  }
};
```

在 `resolveCrmAiWritingModules()` 中，把当前 step 模块插入 `crm_outreach_sequence_strategy` 后面：

```ts
const stepModule = resolveStepModule(input.stepIndex, input.promptTemplateKey);
if (stepModule) {
  const sequenceIndex = modules.findIndex(module => module.promptKey === 'crm_outreach_sequence_strategy');
  modules.splice(sequenceIndex >= 0 ? sequenceIndex + 1 : modules.length, 0, { ...stepModule });
}
```

`resolveStepModule()` 当前只支持 `crm_outreach_general` 或空值，都返回 `generalStepModules[stepIndex]`。

- [ ] **Step 3: AI 草稿服务传入模板 key**

在 `CrmAiDraftService.generateDraft()` 调用 resolver 时增加：

```ts
promptTemplateKey: input.writingConfig.promptTemplateKey
```

- [ ] **Step 4: 更新 resolver 测试**

第 1 封测试期望 promptKeys 包含：

```ts
'crm_outreach_general_step_1_relevance'
```

第 2 封测试期望 promptKeys 包含：

```ts
'crm_outreach_general_step_2_product_decision'
```

- [ ] **Step 5: 跑最小验证**

Run:

```bash
./node_modules/.bin/tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/ai-writing/crm-ai-writing-module-resolver.spec.ts apps/server/src/modules/crm/crm-ai-draft.service.spec.ts
```

Expected: 每次 CRM AI 写信都会加载当前 step 对应的通用模板提示词。

## Task 4: 收紧提示词修改权限为超级管理员

**Files:**
- Modify: `apps/server/src/modules/ai-gateway/ai-gateway.controller.ts`
- Test: `apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts`

- [ ] **Step 1: 修改变更接口权限**

这些接口使用 `requireSuperUserContext(currentContext, '无权维护 AI 提示词')`：

- `savePromptDraft`
- `testPromptDraft`
- `publishPromptVersion`
- `rollbackPromptVersion`
- `savePrompt`

读取接口 `listPromptWorkbenchSteps`、`getPromptWorkbenchDetail`、`getPrompt`、`getDefaultPrompt` 可以保留当前读权限，便于非超管查看当前生效规则；如果页面本身仍隐藏给非超管，则按前端现状处理。

- [ ] **Step 2: 更新 controller 测试**

新增或调整断言：

```ts
await assert.rejects(
  () =>
    controller.publishPromptVersion(
      {
        promptKey: 'crm_outreach_general_step_1_relevance',
        title: '通用模板第 1 封：相关性与初始价值',
        systemPrompt: '只输出一个合法 JSON 对象\nStep 1\n相关性\n低摩擦 CTA'
      },
      createContext({ roles: ['R_ADMIN'], buttons: [aiSettingsPromptManagePermission] })
    ),
  ForbiddenException
);
```

并保留 `R_SUPER` 可以发布。

- [ ] **Step 3: 跑最小验证**

Run:

```bash
./node_modules/.bin/tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts
```

Expected: 非超级管理员不能修改全局提示词；超级管理员可以发布。

## Task 5: 页面分组文案优化

**Files:**
- Modify: `src/views/ai-prompt-settings/modules/shared.ts`
- Modify: `src/views/ai-prompt-settings/modules/shared.spec.ts`

- [ ] **Step 1: 分组标题改得更贴近业务**

把 `CRM 写信方法论` 改成：

```ts
title: 'CRM 开发信通用模板'
```

这样左侧看到的是一套可发布的通用开发信模板，而不是抽象方法论。

- [ ] **Step 2: section anchor 支持 step prompt**

`promptSectionMatchers` 中 `crm-sequence` 的 patterns 增加：

```ts
/通用模板第 [1-5] 封/u
```

- [ ] **Step 3: 跑最小验证**

Run:

```bash
./node_modules/.bin/tsx --test src/views/ai-prompt-settings/modules/shared.spec.ts
```

Expected: AI 提示词配置页按“CRM 开发信通用模板”展示 CRM 写信提示词。

## Task 6: 总体验证

**Files:**
- All modified files above.

- [ ] **Step 1: 跑本次相关后端测试**

Run:

```bash
./node_modules/.bin/tsx --tsconfig apps/server/tsconfig.json --test \
  apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts \
  apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts \
  apps/server/src/modules/crm/ai-writing/crm-ai-writing-module-resolver.spec.ts \
  apps/server/src/modules/crm/crm-ai-draft.service.spec.ts \
  apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts
```

Expected: 测试通过。

- [ ] **Step 2: 跑本次相关前端测试**

Run:

```bash
./node_modules/.bin/tsx --test \
  src/service/api/ai-gateway.spec.ts \
  src/views/ai-prompt-settings/modules/shared.spec.ts \
  src/views/crm/settings/modules/shared.spec.ts
```

Expected: 测试通过。

- [ ] **Step 3: 检查 diff 空白**

Run:

```bash
git diff --check -- \
  apps/server/src/modules/ai-gateway/ai-gateway.constants.ts \
  apps/server/src/modules/ai-gateway/ai-gateway.controller.ts \
  apps/server/src/modules/crm \
  src/constants/ai-gateway.ts \
  src/typings/api/crm.d.ts \
  src/views/ai-prompt-settings \
  src/views/crm/settings/modules
```

Expected: 无输出。

- [ ] **Step 4: 不运行 build**

按项目规则，本任务完成后不运行 `npm run build`。

## 暂不做

- 不新增完整行业提示词包表。
- 不做自动行业识别。
- 不做多行业模板迁移。
- 不删除产品资料里已有的第 1-5 封补充 prompt。
- 不删除 CRM 邮件模板库、岗位画像库、序列策略库。

## 后续扩展方向

当需要新增行业时，再把 `promptTemplateKey` 扩展为：

```ts
'crm_outreach_general' | 'crm_outreach_bearing' | 'crm_outreach_hardware' | 'crm_outreach_chemical'
```

并增加对应行业的第 1-5 封 promptKey。若行业数量变多，再单独设计数据库化的“提示词包”模型。
