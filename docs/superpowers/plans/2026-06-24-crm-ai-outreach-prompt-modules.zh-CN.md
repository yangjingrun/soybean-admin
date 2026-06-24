# CRM AI 开发信 Prompt Modules 实现计划

> **给 agentic workers 的要求：** 实施本计划时必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行。任务使用 checkbox（`- [ ]`）跟踪。

**目标：** 建立一套由超级管理员维护的 CRM AI 开发信方法论层，把 Hunter / Snov.io 公开冷邮件方法、产品线配置、客户事实、职位、地区和历史邮件组合起来，生成个性化的 1-5 封开发信。

**架构：** 复用现有 AI Prompt Workbench 作为全局方法论维护后台，复用产品线 `aiWritingConfig` 作为组织/产品维度的业务配置。新增 CRM 写信 prompt composer，在调用 `AiGatewayService.generateText()` 前，按客户上下文选择全局 prompt modules，并组合产品线资料、客户资料、画像、地区、公开来源事实和历史邮件。第一版由 cold-email 主方法论生成，第二版可选使用 avoid-ai-writing 规则做二次润色和质检。

**技术栈：** NestJS、Prisma/PostgreSQL、现有 JSON 配置字段、现有 `AiGatewayService`、现有 CRM sequence 服务、Vue 3 `<script setup lang="ts">`、Naive UI、Node test runner。

---

## 公开资料依据

这些资料只作为方法论依据，不照搬模板：

- Hunter relevance：相关性和个性化是回复率核心。系统不能只填 `{{firstName}}`，要根据职位和真实业务问题选择论点。  
  来源：https://hunter.io/blog/making-your-cold-emails-relevant-101/

- Hunter follow-up：默认同线程跟进；第一次跟进至少等 2-3 天；每次跟进都要增加新价值；如果第一次 CTA 没奏效，后续要换一种 CTA。  
  来源：https://hunter.io/blog/how-to-write-a-follow-up-email/

- Hunter deliverability：窄人群、每日发送限制、可信且个性化的内容、像真人一样的发送节奏，会影响送达与投诉风险。  
  来源：https://hunter.io/blog/email-deliverability/

- Snov.io sequence：序列需要按受众分组，邮件之间有不同延迟，每一封都要个性化，并且逻辑上承接上一封。  
  来源：https://snov.io/blog/email-sequence/

- Snov.io cold-email writing：主题可以利用好奇心、个性化、社会证明、数字和短长度；跟进应简短、友好、重申价值并增加新信息。  
  来源：https://snov.io/blog/how-to-write-cold-emails/

- Snov.io 2026 statistics：短邮件在规模化发送中表现较好；一次跟进有价值；过多跟进会伤害回复率和发送信誉，所以系统支持 5 封，但不强制所有客户都走满 5 封。  
  来源：https://snov.io/blog/cold-email-statistics/

- marketingskills / cold-email：作为主开发信方法论来源，吸收“像同行而不是供应商”“个性化必须连接到问题”“一封一个低摩擦 CTA”“2-4 词内部邮件感主题”“每封 follow-up 增加新角度”等规则。  
  来源：https://github.com/coreyhaines31/marketingskills/blob/main/skills/cold-email/SKILL.md

- avoid-ai-writing：作为第一版生成后的二次润色/质检来源，吸收“删除 AI-isms、保留已经自然的句子、最小改动、最多两轮收敛、去掉空泛词/模板句/AI 味结构”等规则。  
  来源：https://github.com/conorbronsdon/avoid-ai-writing/blob/main/SKILL.md

## 产品决策

- 超级管理员在现有 AI Prompt Workbench 里维护全局 CRM 写信方法论。
- 组织管理员继续在 CRM 产品线里维护产品事实和产品线写信偏好。
- 普通用户生成开发信时不能修改全局方法论。
- AI 生成时根据 `stepIndex`、联系人职位、客户国家/城市/时区、客户类型、产品线、历史邮件和公开来源事实选择 prompt modules。
- 生成内容只能使用 CRM 或公开来源里已有的事实。事实缺失时，AI 可以写通用但相关的角度，并在 `riskNotes` 里提醒人工复核。
- 第一版草稿优先保证开发信逻辑、事实和 CTA 正确；第二版润色只允许改善表达，不允许新增事实、新增承诺或改变 CTA。
- 默认支持 1-5 封；推荐策略是 3 封核心序列，加第 4 封转介绍、第 5 封退出/收尾作为可选步骤。
- 不改现有发送调度、同线程策略、客户回复后停发、邮箱发送限制和客户时区发送窗口逻辑。

## 要编码进系统的方法论

| 第几封 | 主题            | Hunter / Snov.io 规则                                            | 默认 CTA                           |
| ------ | --------------- | ---------------------------------------------------------------- | ---------------------------------- |
| 1      | 相关性开场      | 引用真实公开/公司/职位信号，再连接到一个可能存在的业务问题。     | 问这个问题是否相关。               |
| 2      | 换价值角度      | 默认同线程；不要写“just checking”；必须增加一个新价值角度。      | 问低摩擦问题，或问谁负责这个主题。 |
| 3      | 证据/可信度     | 有产品线 proof assets 才使用；不能编造案例、数字、认证或客户名。 | 问是否需要简短对比、资料或报价。   |
| 4      | 转介绍/匹配确认 | 没回复时先假设找错人或时机不对，不继续硬推。                     | 问谁是合适负责人。                 |
| 5      | 退出/收尾       | 礼貌关闭循环，保留未来机会，避免继续打扰。                       | 问是否关闭，或下季度再联系。       |

职位模块：

- Founder / CEO：增长、市场扩张、风险、成本、供应稳定性。
- Sales / BD：合格线索、回复率、pipeline、线索质量、区域开发。
- Procurement / Sourcing：供应可靠性、价格清晰度、交期、MOQ、替代供应商。
- Operations：交付可靠性、人工流程、流程瓶颈。
- Marketing：定位、转化、活动相关性、本地市场表达。
- 未知职位：避免过度假设，用 fit-check 问题确认。

地区模块：

- 使用 `country`、`city`、`timeZone` 和 `languagePolicy` 调整表达。
- 不盲目翻译产品名；必要时保留行业英文术语。
- 只有产品线或公开来源支持时，才引用当地市场问题。
- 发送时间和跟进延迟仍由现有 CRM scheduler 控制，不放进 prompt 决策。

二次润色模块：

- 只处理第一版草稿的 `subject` 和 `bodyText`，不重新选择开发信策略。
- 删除 AI 味开头，例如 `I hope this email finds you well`、`I came across your profile`、`My name is...`。
- 删除空泛销售词，例如 `leverage`、`synergy`、`best-in-class`、`cutting-edge`、`robust`、`seamless`。
- 删除无价值跟进句，例如 `just checking in`、`bumping this up`、`did you see my last email`。
- 保持一封一个 CTA，且 CTA 不升级为强会议邀约。
- 保留产品事实、公开来源事实、风险提醒和人工审核提示。
- 最多执行一次二次润色；如果仍有明显 AI 味，只记录 `qualityFlags`，交给人工审核，不进入无限重写。

## 文件结构

### 后端

- 修改 `apps/server/src/modules/ai-gateway/ai-gateway.constants.ts`
  - 新增 CRM 开发信 prompt definitions 和 channel/group 元数据。
  - 新增 CRM modules 的默认 system prompt 草稿。

- 修改 `apps/server/src/modules/ai-gateway/ai-gateway.types.ts`
  - 给 `AiPromptStepSummary` 增加可选 `group`。
  - prompt channel union 增加 `crm_email`。

- 修改 `apps/server/src/modules/ai-gateway/ai-prompt-validator.ts`
  - 增加 CRM 开发信 prompt 校验规则。

- 修改 `apps/server/src/modules/ai-gateway/ai-gateway.service.ts`
  - 保持固定 promptKey 校验。
  - 让 CRM prompt modules 通过现有 list/detail/draft/test/publish 接口暴露出来。

- 新建 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module.types.ts`
  - 定义 module key、选中模块记录、composer 输入和 snapshot 结构。

- 新建 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module-resolver.ts`
  - 根据第几封、职位、地区、公开资料和历史邮件选择全局 prompt modules。

- 新建 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.ts`
  - 从 account、contact、product line、persona、previous messages 和 source facts 构造紧凑、适合 LLM 的上下文。

- 新建 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-prompt-composer.ts`
  - 组合最终 `systemPrompt` 和 `userPrompt`。

- 新建 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.ts`
  - 对第一版和润色版执行确定性质检，检查 AI 味短语、主题长度、多个 CTA、事实 ID 越界和跟进角度重复。

- 修改 `apps/server/src/modules/crm/crm-ai-draft-prompt.ts`
  - 保留严格 JSON 解析和 normalize helper。
  - prompt 构建委托给新的 composer。

- 修改 `apps/server/src/modules/crm/crm-ai-draft.service.ts`
  - 读取已发布/默认的全局 modules。
  - 把选中的 modules 传给 composer。
  - 第一版生成后，根据产品线策略和质检结果决定是否执行 avoid-ai-writing 二次润色。
  - 在 metadata snapshot 里保存选中 module key 和版本信息。

- 修改 `apps/server/src/modules/crm/crm-ai-draft.types.ts`
  - 增加可选 selected modules 和 source facts 字段。

- 修改 `apps/server/src/modules/crm/crm.types.ts`
  - 扩展 `CrmProductLineAiWritingConfig` JSON 结构，增加可选风格控制：
    - `sequenceStrategy`
    - `languagePolicy`
    - `tone`
    - `ctaPreference`
    - `proofAssets`
    - `regionNotes`

- 修改 `apps/server/src/modules/crm/product-lines/crm-product-line-rules.ts`
  - normalize 新增可选 JSON 字段，不编造默认业务事实。

### 前端

- 修改 `src/typings/api/ai-gateway.d.ts`
  - 增加 prompt group/channel 字段。

- 修改 `src/views/ai-prompt-settings/modules/shared.ts`
  - 把 prompt steps 分组为 AI 获客 和 CRM 写信方法论。
  - 增加 CRM 段落定位：基础规则、序列策略、职位画像、地区本地化、公开资料、输出结构。

- 修改 `src/views/ai-prompt-settings/modules/PromptStepList.vue`
  - 分组展示 prompt modules。

- 修改 `src/views/ai-prompt-settings/modules/PromptEditor.vue`
  - 文案从“AI 获客提示词”调整为更通用的“AI 业务提示词”。

- 修改 `src/views/ai-prompt-settings/modules/PromptPublishPanel.vue`
  - 测试样例 placeholder 支持 CRM 客户/产品线上下文。

- 修改 `src/views/crm/settings/modules/product-line-settings.ts`
  - 给产品线 AI 写信表单增加默认可选风格字段。

- 修改 `src/views/crm/settings/modules/ProductLineFormDrawer.vue`
  - 增加序列策略、语言策略、语气、CTA 风格、证据素材和地区备注控件。

- 修改 `src/views/crm/email-sequences/modules/DraftReviewModal.vue`
  - 在现有 AI 快照面板里展示选中的全局 modules 和 source facts。

- 修改 `src/views/crm/email-sequences/modules/DraftAiInfoPanel.vue`
  - 如果 metadata 存在 module snapshot，则在详情抽屉展示。

## Prompt Module Keys

固定使用这些 key，便于 Workbench 校验和版本化：

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

composer 加载规则：

- 第一版永远加载：`base_rules`、`cold_email_core`、`sequence_strategy`、`public_source_grounding`、`subject_line`、`deliverability_guard`、`output_contract`。
- 条件强调：
  - 联系人有职位时强调 `role_persona`。
  - 客户有国家/城市/时区时强调 `region_localization`。
  - `stepIndex > 1` 时加入 previous messages，并要求换角度。
- 二次润色只加载：`ai_polish`、`public_source_grounding`、`deliverability_guard`、`output_contract`。

## LLM 输出契约

继续使用严格 JSON。必需字段：

```json
{
  "subject": "string",
  "bodyText": "string",
  "reason": "string",
  "riskNotes": ["string"],
  "usedAngles": ["string"],
  "usedFacts": ["string"],
  "nextReviewHints": ["string"],
  "qualityFlags": ["string"],
  "polishChanges": ["string"]
}
```

映射规则：

- `subject`、`bodyText`、`reason`、`riskNotes` 保持现有存储方式。
- `usedAngles`、`usedFacts`、`nextReviewHints`、`qualityFlags`、`polishChanges` 存入 `metadata.snapshot`。
- 如果模型漏掉可选数组，normalize 成空数组。
- 如果 `bodyText` 为空，继续抛 `BadRequestException('AI 返回正文不能为空')`。
- 如果模型引用了上下文里不存在的事实，不能静默接受；composer 要提示模型把不确定内容放入 `riskNotes`。
- 如果二次润色版新增了第一版没有使用过的 fact id、承诺或 CTA，丢弃润色版，保留第一版并写入 `qualityFlags`。

## 产品线 AI 写信配置结构

保留当前必填字段，新增可选字段：

```ts
interface CrmProductLineAiWritingConfig {
  enabled: boolean;
  commonRequirements: string;
  forbiddenClaims: string;
  productEmphasis: string;
  steps: CrmProductLineAiWritingStepConfig[];
  sequenceStrategy?: 'core_3_step' | 'full_5_step';
  languagePolicy?: 'account_locale_or_english' | 'english' | 'local_language';
  tone?: 'consultative' | 'direct' | 'formal';
  ctaPreference?: 'low_friction_question' | 'meeting' | 'quote' | 'referral';
  polishPolicy?: 'auto_when_flagged' | 'always' | 'off';
  proofAssets?: string;
  regionNotes?: string;
}
```

Normalize 规则：

- 已保存的旧配置继续有效。
- 缺失的可选字段保持缺失，或只在前端表单态里给 UI 默认值。
- 后端 prompt composer 把缺失可选字段视为“没有额外指导”，不能当作业务事实。
- `polishPolicy` 默认只在前端表单态展示为 `auto_when_flagged`；后端缺失时按 `auto_when_flagged` 处理，但不写回旧配置。

## 任务拆解

### Task 1：新增 CRM 开发信 Prompt Definitions

**文件：**

- 修改 `apps/server/src/modules/ai-gateway/ai-gateway.constants.ts`
- 修改 `apps/server/src/modules/ai-gateway/ai-gateway.types.ts`
- 修改 `src/typings/api/ai-gateway.d.ts`
- 测试 `apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts`
- 测试 `src/views/ai-prompt-settings/modules/shared.spec.ts`

- [ ] Step 1：增加失败测试，确认 `listPromptWorkbenchSteps()` 包含 10 个 CRM prompt module key，并且 group 为 `crm_outreach`。
- [ ] Step 2：基于上面的公开资料依据，增加 CRM prompt definitions 和默认草稿。
- [ ] Step 3：增加前端 prompt group 类型字段。
- [ ] Step 4：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts`。
- [ ] Step 5：运行 `pnpm exec tsx --test src/views/ai-prompt-settings/modules/shared.spec.ts`。

### Task 2：增加 CRM Modules 的 Prompt 校验

**文件：**

- 修改 `apps/server/src/modules/ai-gateway/ai-prompt-validator.ts`
- 修改 `apps/server/src/modules/ai-gateway/ai-prompt-validator.spec.ts`

- [ ] Step 1：增加失败测试，覆盖 CRM prompt 必需规则：
  - 只输出 JSON。
  - 不编造事实。
  - 只使用公开/CRM 已提供事实。
  - follow-up 必须增加新价值。
  - subject line 避免 spam/clickbait。
  - ai_polish 只能润色表达，不能新增事实、承诺或 CTA。
- [ ] Step 2：给新 prompt keys 实现 validation item mapping。
- [ ] Step 3：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-gateway/ai-prompt-validator.spec.ts`。

### Task 3：新增 CRM AI Writing Module Resolver

**文件：**

- 新建 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module.types.ts`
- 新建 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module-resolver.ts`
- 测试 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module-resolver.spec.ts`

- [ ] Step 1：写测试，覆盖第 1 封、第 2 封、未知职位、采购职位、带国家/城市客户的 module 选择。
- [ ] Step 2：根据 `contact.title` 实现 role bucket 识别。
- [ ] Step 3：实现 selected module metadata，包含 `promptKey`、`title`、`reason`。
- [ ] Step 4：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/ai-writing/crm-ai-writing-module-resolver.spec.ts`。

### Task 4：新增 LLM-Safe CRM Context Builder

**文件：**

- 新建 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.ts`
- 测试 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.spec.ts`

- [ ] Step 1：写测试，确认 source snapshot 字段只在存在时进入 `publicFacts`。
- [ ] Step 2：写测试，确认职位/国家/产品事实缺失时生成 review notes，不编造 fallback facts。
- [ ] Step 3：实现 account、contact、product line、persona、previous messages、source facts 的紧凑上下文构造。
- [ ] Step 4：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.spec.ts`。

### Task 5：新增 Prompt Composer

**文件：**

- 新建 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-prompt-composer.ts`
- 新建 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.ts`
- 修改 `apps/server/src/modules/crm/crm-ai-draft-prompt.ts`
- 修改 `apps/server/src/modules/crm/crm-ai-draft.types.ts`
- 测试 `apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts`
- 测试 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.spec.ts`

- [ ] Step 1：增加测试，确认第 2 封 prompt 包含 previous messages，并要求换角度。
- [ ] Step 2：增加测试，确认存在 source facts 时注入 public-source grounding。
- [ ] Step 3：增加测试，确认输出契约包含 `usedAngles`、`usedFacts`、`nextReviewHints`。
- [ ] Step 4：增加质检测试，覆盖 AI 味短语、主题过长、多个 CTA、事实 ID 越界和无价值跟进句。
- [ ] Step 5：实现 composer，组合 selected module texts 和结构化 CRM 上下文。
- [ ] Step 6：实现 quality check，输出 `qualityFlags` 和可执行二次润色的判断。
- [ ] Step 7：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.spec.ts`。

### Task 6：接入 AI 草稿生成链路

**文件：**

- 修改 `apps/server/src/modules/crm/crm-ai-draft.service.ts`
- 修改 `apps/server/src/modules/crm/crm-ai-draft.service.spec.ts`
- 修改 `apps/server/src/modules/crm/sequence/crm-draft-preview.service.ts`
- 修改 `apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.ts`

- [ ] Step 1：增加测试，确认生成 metadata 包含 selected module keys 和 public facts。
- [ ] Step 2：模型调用前通过 `AiGatewayService.getPrompt()` 解析全局 prompt modules。
- [ ] Step 3：像现在一样把第一版最终 `systemPrompt` 和 `userPrompt` 传入 `generateText()`。
- [ ] Step 4：第一版生成后运行 quality check；命中明显 AI 味且 `polishPolicy !== 'off'` 时，再调用一次 LLM 执行 `crm_outreach_ai_polish` 二次润色。
- [ ] Step 5：校验润色版没有新增事实、承诺或 CTA；不通过时保留第一版并写入 `qualityFlags`。
- [ ] Step 6：扩展 JSON 契约后，使用 `temperature: 0.4` 和 `maxOutputTokens: 1600`。
- [ ] Step 7：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-ai-draft.service.spec.ts apps/server/src/modules/crm/sequence/crm-draft-preview.service.spec.ts apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.spec.ts`。

### Task 7：扩展产品线 AI 写信设置

**文件：**

- 修改 `apps/server/src/modules/crm/crm.types.ts`
- 修改 `apps/server/src/modules/crm/product-lines/crm-product-line-rules.ts`
- 修改 `apps/server/src/modules/crm/product-lines/crm-product-line.service.spec.ts`
- 修改 `src/typings/api/crm.d.ts`
- 修改 `src/views/crm/settings/modules/product-line-settings.ts`
- 修改 `src/views/crm/settings/modules/shared.spec.ts`
- 修改 `src/views/crm/settings/modules/ProductLineFormDrawer.vue`

- [ ] Step 1：增加测试，确认旧配置缺少可选字段时仍能 normalize。
- [ ] Step 2：增加测试，确认可选风格字段会 trim，并通过产品线 payload 保存。
- [ ] Step 3：在产品线抽屉增加 Naive UI 控件：序列策略、语言策略、语气、CTA、二次润色策略、证据素材、地区备注。
- [ ] Step 4：运行 `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/product-lines/crm-product-line.service.spec.ts`。
- [ ] Step 5：运行 `pnpm exec tsx --test src/views/crm/settings/modules/shared.spec.ts`。

### Task 8：更新超级管理员 Prompt Workbench UI

**文件：**

- 修改 `src/views/ai-prompt-settings/modules/shared.ts`
- 修改 `src/views/ai-prompt-settings/modules/PromptStepList.vue`
- 修改 `src/views/ai-prompt-settings/modules/PromptEditor.vue`
- 修改 `src/views/ai-prompt-settings/modules/PromptPublishPanel.vue`
- 测试 `src/views/ai-prompt-settings/modules/shared.spec.ts`

- [ ] Step 1：增加 grouped list helper 测试，覆盖 `crm_outreach`。
- [ ] Step 2：增加 CRM 专用 section anchors。
- [ ] Step 3：把页面文案从只面向 AI 获客，调整成“AI 业务提示词”。
- [ ] Step 4：保持现有权限和发布流程不变。
- [ ] Step 5：运行 `pnpm exec tsx --test src/views/ai-prompt-settings/modules/shared.spec.ts`。

### Task 9：审核 UI 展示 Prompt Module Snapshot

**文件：**

- 修改 `src/typings/api/crm.d.ts`
- 修改 `src/views/crm/email-sequences/modules/DraftReviewModal.vue`
- 修改 `src/views/crm/email-sequences/modules/DraftAiInfoPanel.vue`
- 修改 `src/views/crm/email-sequences/modules/shared.ts`
- 测试 `src/views/crm/email-sequences/modules/shared.spec.ts`

- [ ] Step 1：增加测试，确认 selected modules 和 public facts 能渲染成稳定 review rows。
- [ ] Step 2：在当前 Prompt 快照折叠区下展示 module keys、module reasons、used facts、review hints、quality flags 和 polish changes。
- [ ] Step 3：保留旧的产品线 prompt snapshot 展示，兼容历史 AI 草稿。
- [ ] Step 4：运行 `pnpm exec tsx --test src/views/crm/email-sequences/modules/shared.spec.ts`。

### Task 10：验证

**文件：**

- 所有本计划涉及的文件。

- [ ] Step 1：运行 AI gateway 测试：
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/ai-gateway/ai-prompt-validator.spec.ts apps/server/src/modules/ai-gateway/ai-gateway.service.spec.ts apps/server/src/modules/ai-gateway/ai-gateway.controller.spec.ts`
- [ ] Step 2：运行 CRM AI 写信测试：
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/ai-writing/crm-ai-writing-module-resolver.spec.ts apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.spec.ts apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.spec.ts apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts apps/server/src/modules/crm/crm-ai-draft.service.spec.ts`
- [ ] Step 3：运行产品线测试：
  - `pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/product-lines/crm-product-line.service.spec.ts`
- [ ] Step 4：运行前端 helper 测试：
  - `pnpm exec tsx --test src/views/ai-prompt-settings/modules/shared.spec.ts src/views/crm/settings/modules/shared.spec.ts src/views/crm/email-sequences/modules/shared.spec.ts`
- [ ] Step 5：因为前后端类型都会改，运行 `pnpm typecheck`。
- [ ] Step 6：不要运行 `npm run build`。
- [ ] Step 7：提交前检查 `git status --short` 和 diff。
- [ ] Step 8：只提交本功能相关文件，commit message 可用：`feat: 完善 CRM AI 开发信方法论`。

## 上线计划

1. 只要产品线没有启用 AI 写信配置，新 modules 不参与生成；现有非 AI 模板生成保持不变。
2. 先从代码默认草稿发布 CRM prompt modules 的全局版本。
3. 用 3 个样例客户测试：
   - 沙特阿拉伯采购联系人。
   - 美国 Founder。
   - 德国未知职位联系人。
4. 按审核 checklist 对比生成结果：
   - 第几封的主题是否正确？
   - 每封 follow-up 是否增加了新角度？
   - 是否避免编造事实？
   - subject line 是否短、自然、不像垃圾邮件？
   - CTA 是否匹配职位和步骤？
   - 二次润色是否只改表达，没有新增事实或改变 CTA？
5. 验收后，对已有完整 AI 写信配置的产品线启用。

## 自检

- 覆盖范围：计划覆盖 cold-email 主方法论、avoid-ai-writing 二次润色、Hunter / Snov.io 公开资料、超级管理员全局维护、产品线局部配置、客户国家/职位上下文、公开资料 grounding、1-5 封序列策略、后端组合链路、前端维护 UI、审核 UI、测试和上线。
- 占位检查：没有占位词或未定义的后续实现步骤。
- 类型一致性：prompt keys 固定在 `ai-gateway.constants.ts`；产品线可选字段留在现有 JSON config；生成草稿 metadata 继续放在 `CrmAiDraftMetadata.snapshot`。
