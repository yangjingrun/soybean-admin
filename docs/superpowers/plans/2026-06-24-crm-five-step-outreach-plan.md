# CRM 五步开发信实施计划

> **给执行 agent 的说明：** 执行本计划时，必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans，按任务逐项推进。步骤使用复选框（`- [ ]`）记录进度。

**目标：** 把附件里的五封开发信方法落到当前 CRM：每封邮件有明确任务，生成前基于公司、联系人、产品、历史邮件和来源事实，不盲目生成。

**架构：** 新增一个五步开发信策略中心，默认模板、AI 提示词、质检、序列步数都引用同一套职责定义。事实输入由 CRM account/contact/product/persona/sourceSnapshot/previousMessages 组合成结构化客户数据卡，再由 AI 写信上下文和人工审核面板展示。

**技术栈：** NestJS + Prisma + Vue 3 + Naive UI + node:test + tsx。按项目规则不运行 `npm run build`。

---

## 五步任务定义

| 步骤    |           发送时机 | 是否默认连续发送 | 核心任务        | 必须新增的价值                                   |  建议正文长度 |
| ------- | -----------------: | ---------------- | --------------- | ------------------------------------------------ | ------------: |
| 第 1 封 |              Day 1 | 是               | 建立相关性      | 为什么找这家公司、为什么找这个人、我方为什么匹配 | 50-100 英文词 |
| 第 2 封 |              Day 4 | 是               | 具体化产品匹配  | 型号、应用、采购信息、MOQ、交期                  |  40-80 英文词 |
| 第 3 封 |              Day 9 | 按评分           | 建立信任        | 质量、认证、检验、试单、可验证案例               |  50-90 英文词 |
| 第 4 封 |             Day 16 | 仅高价值         | 低风险切入      | 备选供应商、难找型号、小批量/紧急供应            |  40-75 英文词 |
| 第 5 封 | Day 30+ 或新信号后 | 不默认连续发送   | 再激活/礼貌收尾 | 新触发信号、时机确认、联系人确认                 |  35-70 英文词 |

默认序列长度按客户评分决定：

```text
80-100 分：生成 4 步冷邮件；第 5 步只由新信号触发
65-79 分：生成 3 步冷邮件
50-64 分：生成 2 步验证邮件
低于 50 分：不自动创建开发信序列
```

第 5 封不是第 4 次连续跟进。实现时不要把 `totalSteps` 默认设为 5；只有出现新产品、招聘、扩张、展会、访问、网站更新、人工指定新信号等情况，才允许创建第 5 封再激活邮件。

## 文件结构

- 新增: `apps/server/src/modules/crm/crm-outreach-step-strategy.ts`
  - 负责五步任务、默认模板、建议长度、线程模式、需要事实组、发送条件。
- 新增: `apps/server/src/modules/crm/crm-outreach-step-strategy.spec.ts`
  - 固化五步任务和默认模板行为。
- 修改: `apps/server/src/modules/crm/crm-email-template-renderer.ts`
  - 从策略中心生成 `defaultTemplateSteps`，去掉弱跟进文案。
- 新增: `apps/server/src/modules/crm/ai-writing/crm-ai-writing-source-facts.ts`
  - 从 `sourceSnapshot` 读取来源事实、触发信号、置信度。
- 修改: `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module.types.ts`
  - 增加 fact source：`source_snapshot`、`sequence_strategy`。
- 修改: `apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.ts`
  - 把客户数据卡和五步任务加入 AI 上下文。
- 修改: `apps/server/src/modules/crm/crm-ai-draft.types.ts`
  - 给 AI 输入增加 `account.sourceSnapshot` 和 `stepStrategy`。
- 修改: `apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.ts`
  - 创建首封时传入 sourceSnapshot、评分和动态 `totalSteps`。
- 修改: `apps/server/src/modules/crm/sequence/crm-next-draft.service.ts`
  - 生成后续邮件时传入相同事实和当前步骤任务。
- 新增: `apps/server/src/modules/crm/sequence/crm-sequence-fit-score.ts`
  - 根据公司、联系人、产品、近期信号、数据可信度、证明材料计算 0-100 分和推荐步数。
- 新增: `apps/server/src/modules/crm/sequence/crm-sequence-fit-score.spec.ts`
  - 覆盖评分和推荐步数。
- 修改: `apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.ts`
  - 增加词数、段落、句长、链接、Emoji、营销词、附件提示、步骤任务覆盖检查。
- 修改: `apps/server/src/modules/ai-gateway/ai-gateway.constants.ts`
  - 更新 CRM outreach prompt 默认规则，明确每封任务。
- 修改: `src/views/crm/email-sequences/modules/shared.ts`
  - 展示 AI 草稿元数据里的步骤任务、事实依据、风险标记。
- 修改: `src/views/crm/email-sequences/modules/DraftReviewModal.vue`
  - 在审核弹窗展示“本封任务”和“使用事实”。

---

### 任务 1：建立五步策略中心

**文件：**

- 新增: `apps/server/src/modules/crm/crm-outreach-step-strategy.ts`
- 新增: `apps/server/src/modules/crm/crm-outreach-step-strategy.spec.ts`
- 修改: `apps/server/src/modules/crm/crm-email-template-renderer.ts`

- [ ] **步骤 1：写失败测试，固化五封任务**

新增 `apps/server/src/modules/crm/crm-outreach-step-strategy.spec.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crmOutreachStepStrategies, getCrmOutreachStepStrategy } from './crm-outreach-step-strategy';

describe('crm-outreach-step-strategy', () => {
  it('defines five distinct outreach step duties from the sending guide', () => {
    assert.equal(crmOutreachStepStrategies.length, 5);
    assert.equal(getCrmOutreachStepStrategy(1).taskKey, 'relevance');
    assert.equal(getCrmOutreachStepStrategy(2).taskKey, 'product_match');
    assert.equal(getCrmOutreachStepStrategy(3).taskKey, 'trust');
    assert.equal(getCrmOutreachStepStrategy(4).taskKey, 'low_risk_entry');
    assert.equal(getCrmOutreachStepStrategy(5).taskKey, 'reactivation_or_close');
  });

  it('keeps weak follow-up wording out of default follow-up templates', () => {
    const bodies = crmOutreachStepStrategies.map(step => step.bodyTemplate).join('\n');

    assert.doesNotMatch(bodies, /just following up|checking in|bumping/i);
    assert.match(getCrmOutreachStepStrategy(2).bodyTemplate, /3-5 models|MOQ|lead time/i);
    assert.match(getCrmOutreachStepStrategy(3).bodyTemplate, /qualification|inspection|trial/i);
    assert.match(getCrmOutreachStepStrategy(4).bodyTemplate, /secondary source|difficult/i);
  });

  it('marks step five as trigger-only instead of default continuous follow-up', () => {
    const step5 = getCrmOutreachStepStrategy(5);

    assert.equal(step5.defaultContinuousFollowUp, false);
    assert.equal(step5.requiresNewSignal, true);
    assert.deepEqual(step5.wordRange, { min: 35, max: 70 });
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-outreach-step-strategy.spec.ts
```

预期：FAIL，提示找不到 `crm-outreach-step-strategy`。

- [ ] **步骤 3：新增策略文件**

新增 `apps/server/src/modules/crm/crm-outreach-step-strategy.ts`:

```ts
import type { CrmAiWritingStepIndex, CrmMessageThreadMode } from './crm.types';

export type CrmOutreachStepTaskKey =
  | 'relevance'
  | 'product_match'
  | 'trust'
  | 'low_risk_entry'
  | 'reactivation_or_close';

export interface CrmOutreachStepStrategy {
  stepIndex: CrmAiWritingStepIndex;
  taskKey: CrmOutreachStepTaskKey;
  name: string;
  taskDescription: string;
  newValue: string;
  defaultDelayDays: number;
  threadMode: CrmMessageThreadMode;
  defaultContinuousFollowUp: boolean;
  requiresNewSignal: boolean;
  wordRange: { min: number; max: number };
  requiredFactGroups: string[];
  subjectTemplate: string;
  bodyTemplate: string;
}

export const crmOutreachStepStrategies: CrmOutreachStepStrategy[] = [
  {
    stepIndex: 1,
    taskKey: 'relevance',
    name: '第 1 封：相关性与初始价值',
    taskDescription: '回答为什么联系这家公司、为什么联系这个人、我方价值为什么相关。',
    newValue: '公司事实 + 职位相关价值 + 低压力 CTA',
    defaultDelayDays: 0,
    threadMode: 'new_subject',
    defaultContinuousFollowUp: true,
    requiresNewSignal: false,
    wordRange: { min: 50, max: 100 },
    requiredFactGroups: ['company_profile', 'contact_profile', 'product_match'],
    subjectTemplate: '{{product.name}} supply for {{account.name}}',
    bodyTemplate:
      'Hi {{contact.name}},\n\nI noticed {{account.name}} works in {{account.customerType}} and may handle {{product.name}} related sourcing. We support {{account.customerType}} teams with {{product.sellingPoint}}, {{product.modelInfo}}, and stable export lead times.\n\nWould it be useful if I sent a short list of models relevant to your current range?\n\nBest,\n{{sender.name}}'
  },
  {
    stepIndex: 2,
    taskKey: 'product_match',
    name: '第 2 封：具体产品和采购场景',
    taskDescription: '把首封的泛价值变成客户能判断的型号、应用、MOQ、交期信息。',
    newValue: '具体型号/系列 + 应用 + 采购比较信息',
    defaultDelayDays: 3,
    threadMode: 'same_thread',
    defaultContinuousFollowUp: true,
    requiresNewSignal: false,
    wordRange: { min: 40, max: 80 },
    requiredFactGroups: ['product_models', 'application_match', 'supply_terms'],
    subjectTemplate: '',
    bodyTemplate:
      'Hi {{contact.name}},\n\nOne practical detail that may be relevant: we currently supply {{product.modelInfo}} for {{product.applicationInfo}}.\n\nIf you share 3-5 models you purchase regularly, I can check availability, MOQ, and lead time for comparison.\n\nWould that be useful?\n\nBest,\n{{sender.name}}'
  },
  {
    stepIndex: 3,
    taskKey: 'trust',
    name: '第 3 封：可信度和供应商风险',
    taskDescription: '回答质量、认证、检验、追溯、试单和供应商资格问题。',
    newValue: '质量文件 + 检验能力 + 试单/可验证案例',
    defaultDelayDays: 8,
    threadMode: 'same_thread',
    defaultContinuousFollowUp: true,
    requiresNewSignal: false,
    wordRange: { min: 50, max: 90 },
    requiredFactGroups: ['quality_documents', 'certifications', 'proof_assets'],
    subjectTemplate: '',
    bodyTemplate:
      'Hi {{contact.name}},\n\nFor supplier qualification, we can provide {{product.certificationInfo}}, inspection records, material information, packaging details, and pre-shipment photos.\n\nWe also support {{product.trialOrderInfo}}, so your team can evaluate quality before considering regular purchasing.\n\nWould you like a one-page supplier qualification summary?\n\nBest,\n{{sender.name}}'
  },
  {
    stepIndex: 4,
    taskKey: 'low_risk_entry',
    name: '第 4 封：备选供应商与低风险切入',
    taskDescription: '不要求替换供应商，而是定位为第二供应源、紧急供应源、难找型号供应商。',
    newValue: '备选供应 + 难找型号 + 低风险比较请求',
    defaultDelayDays: 15,
    threadMode: 'same_thread',
    defaultContinuousFollowUp: true,
    requiresNewSignal: false,
    wordRange: { min: 40, max: 75 },
    requiredFactGroups: ['backup_supplier_value', 'hard_to_source_models'],
    subjectTemplate: '',
    bodyTemplate:
      'Hi {{contact.name}},\n\nYou may not be looking to replace your current suppliers.\n\nSome distributors use us as a secondary source when a regular supplier has a long lead time, high MOQ, temporary shortage, or a difficult-to-source model.\n\nWould it make sense to compare one model that is currently difficult for your team to source?\n\nBest,\n{{sender.name}}'
  },
  {
    stepIndex: 5,
    taskKey: 'reactivation_or_close',
    name: '第 5 封：再激活或礼貌收尾',
    taskDescription: '只在新信号或较长冷却期后确认时机和正确联系人；发送后停止本轮触达。',
    newValue: '新触发信号 + 时机确认 + 联系人确认',
    defaultDelayDays: 30,
    threadMode: 'new_subject',
    defaultContinuousFollowUp: false,
    requiresNewSignal: true,
    wordRange: { min: 35, max: 70 },
    requiredFactGroups: ['new_trigger_or_cooldown', 'contact_confirmation'],
    subjectTemplate: 'Should I close this out?',
    bodyTemplate:
      'Hi {{contact.name}},\n\nI will close the loop after this note.\n\nWhich is closest?\n1. This is not a current priority.\n2. Another colleague handles this area.\n3. You are open to receiving a short model list.\n\nA number is enough, and I will not follow up further unless useful.\n\nBest,\n{{sender.name}}'
  }
];

/** Returns one configured five-step outreach strategy by step index. */
export function getCrmOutreachStepStrategy(stepIndex: number): CrmOutreachStepStrategy {
  const strategy = crmOutreachStepStrategies.find(item => item.stepIndex === stepIndex);

  if (!strategy) {
    throw new Error(`Unsupported CRM outreach step: ${stepIndex}`);
  }

  return strategy;
}
```

- [ ] **步骤 4：让默认模板引用策略中心**

修改 `apps/server/src/modules/crm/crm-email-template-renderer.ts`:

```ts
import { crmOutreachStepStrategies } from './crm-outreach-step-strategy';
```

Replace the current literal `defaultTemplateSteps` array with:

```ts
export const defaultTemplateSteps: DefaultTemplateStep[] = crmOutreachStepStrategies.map(step => ({
  stepIndex: step.stepIndex,
  name: step.name,
  threadMode: step.threadMode,
  delayDays: step.defaultDelayDays,
  subjectTemplate: step.subjectTemplate,
  bodyTemplate: step.bodyTemplate
}));
```

Extend `defaultTemplateVariables` with:

```ts
{ key: 'account.customerType', label: '客户类型', source: '线索库' },
{ key: 'product.modelInfo', label: '型号/系列', source: '产品资料' },
{ key: 'product.applicationInfo', label: '应用场景', source: '产品资料' },
{ key: 'product.certificationInfo', label: '认证/质量资料', source: '产品资料' },
{ key: 'product.trialOrderInfo', label: '试单信息', source: '产品资料' }
```

Extend `buildEmailTemplateReplacements()` with:

```ts
'account.customerType': account.customerType || 'B2B industrial',
'product.modelInfo': productLine?.commonModelsText || productLine?.name || 'selected models',
'product.applicationInfo': productLine?.targetCustomerType || account.customerType || 'industrial applications',
'product.certificationInfo': productLine?.certifications || 'available quality documents',
'product.trialOrderInfo': productLine?.moq ? `trial orders from ${productLine.moq}` : 'trial orders'
```

- [ ] **步骤 5：运行测试**

运行：

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-outreach-step-strategy.spec.ts
```

预期：PASS。

- [ ] **步骤 6：提交**

```bash
git add apps/server/src/modules/crm/crm-outreach-step-strategy.ts apps/server/src/modules/crm/crm-outreach-step-strategy.spec.ts apps/server/src/modules/crm/crm-email-template-renderer.ts
git commit -m "feat: 定义CRM五步开发信任务模板"
```

### 任务 2：把客户数据卡加入 AI 写信事实

**文件：**

- 新增: `apps/server/src/modules/crm/ai-writing/crm-ai-writing-source-facts.ts`
- 修改: `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module.types.ts`
- 修改: `apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.ts`
- 修改: `apps/server/src/modules/crm/crm-ai-draft.types.ts`
- 修改: `apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.ts`
- 修改: `apps/server/src/modules/crm/sequence/crm-next-draft.service.ts`
- 测试: `apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.spec.ts`

- [ ] **步骤 1：写失败测试，确认 sourceSnapshot 和步骤任务进入 publicFacts**

新增 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.spec.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCrmAiWritingContext } from './crm-ai-writing-context';

describe('crm-ai-writing-context', () => {
  it('adds data-card facts, 来源可信度, and step strategy to AI context', () => {
    const context = buildCrmAiWritingContext({
      account: {
        name: 'ABC Bearings',
        country: 'SA',
        city: 'Riyadh',
        timeZone: 'Asia/Riyadh',
        domain: 'abc.example',
        customerType: 'Distributor',
        sourceSnapshot: {
          website_product_fact: 'Supplies bearings and power-transmission parts',
          recent_trigger: 'Hiring a supply chain specialist',
          source_url: 'https://abc.example/careers',
          source_date: '2026-06-20',
          fact_or_inference: 'fact',
          confidence_score: 86
        }
      },
      contact: { fullName: 'Ali', title: 'Purchasing Manager', maskedEmail: 'a***@abc.example', emailStatus: 'valid' },
      productLine: {
        id: 'line-1',
        name: 'Bearing Series',
        targetCustomerType: 'Distributor',
        coreSellingPoints: 'mixed-model orders and stable lead time',
        moq: '100 pcs',
        leadTime: '15 days',
        paymentTerms: 'T/T',
        certifications: 'ISO 9001',
        catalogUrl: null,
        websiteUrl: null,
        commonModelsText: '6204, 6205, UC205'
      },
      writingConfig: {
        enabled: true,
        steps: [1, 2, 3, 4, 5].map(stepIndex => ({ stepIndex: stepIndex as 1 | 2 | 3 | 4 | 5, prompt: '' }))
      },
      stepIndex: 1,
      previousMessages: [],
      senderName: 'Alice',
      baseDraft: { subject: 'Bearing supply for ABC Bearings', bodyText: 'Base draft' },
      stepStrategy: {
        taskDescription: '建立相关性',
        newValue: '公司事实 + 职位价值',
        wordRange: { min: 50, max: 100 },
        requiredFactGroups: ['company_profile']
      }
    });

    assert.ok(context.publicFacts.some(fact => fact.id === 'source_snapshot.website_product_fact'));
    assert.ok(context.publicFacts.some(fact => fact.id === 'source_snapshot.recent_trigger'));
    assert.ok(context.publicFacts.some(fact => fact.id === 'sequence_strategy.task'));
    assert.ok(context.publicFacts.some(fact => fact.id === 'sequence_strategy.word_range'));
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.spec.ts
```

预期：FAIL，类型里没有 `sourceSnapshot` 和 `stepStrategy`。

- [ ] **步骤 3：扩展 AI 输入类型**

修改 `apps/server/src/modules/crm/crm-ai-draft.types.ts` so account and prompt input include:

```ts
sourceSnapshot?: Record<string, unknown> | null;
```

Add:

```ts
stepStrategy?: {
  taskDescription: string;
  newValue: string;
  wordRange: { min: number; max: number };
  requiredFactGroups: string[];
} | null;
```

- [ ] **步骤 4：扩展 fact source 类型**

修改 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-module.types.ts`:

```ts
source:
  | 'account'
  | 'contact'
  | 'product_line'
  | 'persona'
  | 'previous_message'
  | 'base_draft'
  | 'source_snapshot'
  | 'sequence_strategy';
```

- [ ] **步骤 5：新增 sourceSnapshot fact 读取器**

新增 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-source-facts.ts`:

```ts
import type { CrmAiWritingFact } from './crm-ai-writing-module.types';

const sourceFactFields = [
  'website_product_fact',
  'recent_trigger',
  'products_sold',
  'applications_served',
  'brands_carried',
  'purchase_signal',
  'source_url',
  'source_date',
  'fact_or_inference',
  'confidence_score'
] as const;

/** Reads trusted CRM source snapshot fields into fact-id based AI writing facts. */
export function buildCrmSourceSnapshotFacts(value?: Record<string, unknown> | null): CrmAiWritingFact[] {
  if (!value) return [];

  return sourceFactFields.flatMap(field => {
    const normalized = normalizeSourceFactValue(value[field]);

    return normalized
      ? [
          {
            id: `source_snapshot.${field}`,
            label: field,
            value: normalized,
            source: 'source_snapshot' as const
          }
        ]
      : [];
  });
}

function normalizeSourceFactValue(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value))
    return value
      .map(item => normalizeSourceFactValue(item))
      .filter(Boolean)
      .join(', ');
  return '';
}
```

- [ ] **步骤 6：把数据卡和步骤任务加入上下文**

修改 `apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.ts`:

```ts
import { buildCrmSourceSnapshotFacts } from './crm-ai-writing-source-facts';
```

After account facts:

```ts
publicFacts.push(...buildCrmSourceSnapshotFacts(input.account.sourceSnapshot));
```

Before return:

```ts
if (input.stepStrategy) {
  addFact(
    publicFacts,
    'sequence_strategy.task',
    'Current step task',
    input.stepStrategy.taskDescription,
    'sequence_strategy'
  );
  addFact(
    publicFacts,
    'sequence_strategy.newValue',
    'Current step new value',
    input.stepStrategy.newValue,
    'sequence_strategy'
  );
  addFact(
    publicFacts,
    'sequence_strategy.word_range',
    'Suggested word range',
    `${input.stepStrategy.wordRange.min}-${input.stepStrategy.wordRange.max} English words`,
    'sequence_strategy'
  );
  addFact(
    publicFacts,
    'sequence_strategy.required_fact_groups',
    'Required fact groups',
    input.stepStrategy.requiredFactGroups.join(', '),
    'sequence_strategy'
  );
}
```

- [ ] **步骤 7：服务调用传入 sourceSnapshot 和 stepStrategy**

In `apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.ts`, when calling `this.aiDraftService.generateDraft`, pass:

```ts
account: {
  name: account.name,
  country: account.country,
  city: account.city,
  timeZone: account.timeZone,
  domain: account.domain,
  customerType: account.customerType,
  sourceSnapshot: account.sourceSnapshot
},
stepStrategy: toAiStepStrategy(getCrmOutreachStepStrategy(stepIndex)),
```

Add local helper:

```ts
function toAiStepStrategy(strategy: ReturnType<typeof getCrmOutreachStepStrategy>) {
  return {
    taskDescription: strategy.taskDescription,
    newValue: strategy.newValue,
    wordRange: strategy.wordRange,
    requiredFactGroups: strategy.requiredFactGroups
  };
}
```

Apply the same change in `apps/server/src/modules/crm/sequence/crm-next-draft.service.ts`.

- [ ] **步骤 8：运行测试**

运行：

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.spec.ts apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.spec.ts
```

预期：PASS。

- [ ] **步骤 9：提交**

```bash
git add apps/server/src/modules/crm/ai-writing/crm-ai-writing-source-facts.ts apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.ts apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.spec.ts apps/server/src/modules/crm/ai-writing/crm-ai-writing-module.types.ts apps/server/src/modules/crm/crm-ai-draft.types.ts apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.ts apps/server/src/modules/crm/sequence/crm-next-draft.service.ts
git commit -m "feat: 开发信生成加入客户数据卡事实"
```

### 任务 3：实现客户评分和推荐序列长度

**文件：**

- 新增: `apps/server/src/modules/crm/sequence/crm-sequence-fit-score.ts`
- 新增: `apps/server/src/modules/crm/sequence/crm-sequence-fit-score.spec.ts`
- 修改: `apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.ts`
- 修改: `apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.spec.ts`

- [ ] **步骤 1：写评分测试**

新增 `apps/server/src/modules/crm/sequence/crm-sequence-fit-score.spec.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scoreCrmSequenceFit } from './crm-sequence-fit-score';

describe('crm-sequence-fit-score', () => {
  it('recommends four cold steps for high-fit leads and never includes trigger-only step five', () => {
    const result = scoreCrmSequenceFit({
      account: {
        customerType: 'Distributor',
        country: 'SA',
        sourceSnapshot: {
          website_product_fact: 'Supplies bearings',
          recent_trigger: 'Hiring sourcing staff',
          source_url: 'https://abc.example',
          source_date: '2026-06-20',
          fact_or_inference: 'fact',
          confidence_score: 90
        }
      },
      contact: { title: 'Purchasing Manager', emailStatus: 'valid' },
      productLine: {
        name: 'Bearing Series',
        targetCustomerType: 'Distributor',
        coreSellingPoints: 'stable lead time',
        commonModelsText: '6204, 6205',
        certifications: 'ISO 9001'
      }
    });

    assert.equal(result.score, 100);
    assert.equal(result.recommendedColdSteps, 4);
    assert.equal(result.canCreateColdSequence, true);
  });

  it('blocks automatic sequence creation below fifty points', () => {
    const result = scoreCrmSequenceFit({
      account: { customerType: null, country: null, sourceSnapshot: null },
      contact: { title: null, emailStatus: 'unchecked' },
      productLine: null
    });

    assert.equal(result.canCreateColdSequence, false);
    assert.equal(result.recommendedColdSteps, 0);
  });
});
```

- [ ] **步骤 2：实现评分函数**

新增 `apps/server/src/modules/crm/sequence/crm-sequence-fit-score.ts`:

```ts
import type { CrmAccountRecord, CrmContactRecord, CrmProductLineRecord } from '../crm.types';

export interface CrmSequenceFitScoreInput {
  account: Pick<CrmAccountRecord, 'customerType' | 'country' | 'sourceSnapshot'>;
  contact: Pick<CrmContactRecord, 'title' | 'emailStatus'>;
  productLine: Pick<
    CrmProductLineRecord,
    'name' | 'targetCustomerType' | 'coreSellingPoints' | 'commonModelsText' | 'certifications'
  > | null;
}

export interface CrmSequenceFitScoreResult {
  score: number;
  recommendedColdSteps: number;
  canCreateColdSequence: boolean;
  reasons: string[];
}

/** Scores whether a lead has enough factual basis for a cold outreach sequence. */
export function scoreCrmSequenceFit(input: CrmSequenceFitScoreInput): CrmSequenceFitScoreResult {
  const reasons: string[] = [];
  let score = 0;

  score += addScore(Boolean(input.account.customerType), 15, reasons, '公司类型明确');
  score += addScore(
    Boolean(readSnapshotText(input.account.sourceSnapshot, 'website_product_fact')),
    15,
    reasons,
    '有公司产品事实'
  );
  score += addScore(Boolean(input.contact.title), 20, reasons, '联系人职位明确');
  score += addScore(
    Boolean(input.productLine?.coreSellingPoints || input.productLine?.commonModelsText),
    20,
    reasons,
    '产品匹配信息明确'
  );
  score += addScore(
    Boolean(readSnapshotText(input.account.sourceSnapshot, 'recent_trigger')),
    15,
    reasons,
    '有近期触发信号'
  );
  score += normalizeConfidenceScore(input.account.sourceSnapshot);
  score += addScore(Boolean(input.productLine?.certifications), 5, reasons, '有认证或证明材料');

  const recommendedColdSteps = resolveRecommendedColdSteps(score);

  return {
    score,
    recommendedColdSteps,
    canCreateColdSequence: recommendedColdSteps > 0 && input.contact.emailStatus !== 'invalid',
    reasons
  };
}

function addScore(condition: boolean, points: number, reasons: string[], reason: string) {
  if (condition) reasons.push(reason);
  return condition ? points : 0;
}

function normalizeConfidenceScore(snapshot?: Record<string, unknown> | null) {
  const raw = snapshot?.confidence_score;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  if (raw >= 80) return 10;
  if (raw >= 60) return 6;
  if (raw >= 40) return 3;
  return 0;
}

function readSnapshotText(snapshot: Record<string, unknown> | null | undefined, key: string) {
  const value = snapshot?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function resolveRecommendedColdSteps(score: number) {
  if (score >= 80) return 4;
  if (score >= 65) return 3;
  if (score >= 50) return 2;
  return 0;
}
```

- [ ] **步骤 3：创建序列时使用推荐步数**

修改 `apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.ts`:

```ts
import { scoreCrmSequenceFit } from './crm-sequence-fit-score';
```

Before `createSequenceDraftBundle`:

```ts
const fitScore = scoreCrmSequenceFit({ account, contact, productLine });

if (!fitScore.canCreateColdSequence) {
  throw new BadRequestException('客户事实不足，不建议自动创建开发信序列');
}
```

Replace:

```ts
totalSteps: defaultSequenceStepCount,
```

with:

```ts
totalSteps: fitScore.recommendedColdSteps,
```

Add timeline metadata:

```ts
fitScore;
```

- [ ] **步骤 4：更新首封创建测试**

In `apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.spec.ts`, adjust account/contact/product fixtures so default test data scores at least 50. Add an assertion:

```ts
assert.equal(created.enrollment.totalSteps, 2);
assert.equal(created.timelineEvent.metadata?.fitScore.recommendedColdSteps, 2);
```

- [ ] **步骤 5：运行测试**

运行：

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/sequence/crm-sequence-fit-score.spec.ts apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.spec.ts
```

预期：PASS。

- [ ] **步骤 6：提交**

```bash
git add apps/server/src/modules/crm/sequence/crm-sequence-fit-score.ts apps/server/src/modules/crm/sequence/crm-sequence-fit-score.spec.ts apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.ts apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.spec.ts
git commit -m "feat: 按客户评分决定开发信序列长度"
```

### 任务 4：更新 AI 提示词，让每封按职责生成

**文件：**

- 修改: `apps/server/src/modules/ai-gateway/ai-gateway.constants.ts`
- 修改: `apps/server/src/modules/crm/ai-writing/crm-ai-writing-prompt-composer.ts`
- 测试: `apps/server/src/modules/crm/ai-writing/crm-ai-writing-prompt-composer.spec.ts`
- 测试: `apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts`

- [ ] **步骤 1：写 prompt 测试**

Add to `apps/server/src/modules/crm/ai-writing/crm-ai-writing-prompt-composer.spec.ts`:

```ts
it('includes the current step task and forbids blind generation', () => {
  const prompt = composeCrmAiWritingPrompt({
    input: createPromptInputForSpec({
      stepIndex: 3,
      stepStrategy: {
        taskDescription: '建立信任：质量、认证、试单',
        newValue: '认证和供应商资格资料',
        wordRange: { min: 50, max: 90 },
        requiredFactGroups: ['quality_documents', 'certifications']
      }
    }),
    selectedModules: [{ promptKey: 'crm_outreach_sequence_strategy', title: 'Sequence', reason: 'Required' }],
    writingContext: createWritingContextForSpec(),
    riskNotes: []
  });

  assert.match(prompt.userPrompt, /Current step execution rules/);
  assert.match(prompt.userPrompt, /建立信任/);
  assert.match(prompt.userPrompt, /50-90 English words/);
  assert.match(prompt.systemPrompt, /Do not turn inference into fact/);
});
```

Use local helpers in the spec file to build minimal valid prompt input and context.

- [ ] **步骤 2：更新 prompt composer**

In `apps/server/src/modules/crm/ai-writing/crm-ai-writing-prompt-composer.ts`, add to system prompt:

```ts
'Do not turn inference into fact.',
'If a step requires facts that are missing, keep the email conservative and add a risk note instead of inventing details.',
'Each follow-up must add the new value required by the current step strategy.',
```

Add to user prompt after writing config:

```ts
`Current step execution rules:\n${JSON.stringify(input.stepStrategy ?? null, null, 2)}`,
```

- [ ] **步骤 3：更新默认 CRM outreach prompt 文案**

修改 `apps/server/src/modules/ai-gateway/ai-gateway.constants.ts`:

```ts
crm_outreach_sequence_strategy: `${crmOutreachDefaultPromptRules}

模块重点：
- 第 1 封：建立相关性，使用公司事实、职位价值和低压力 CTA。
- 第 2 封：具体化产品匹配，使用型号、应用、MOQ、交期或采购比较信息。
- 第 3 封：建立信任，只使用真实认证、检验、质量文件、试单或可验证案例。
- 第 4 封：低风险切入，定位为备选供应源、紧急供应源、难找型号供应商。
- 第 5 封：仅新信号或冷却期后再激活/收尾，不作为默认连续跟进。
- 跟进必须提供新信息，禁止写 Just following up 这类无价值跟进。`,
```

- [ ] **步骤 4：运行测试**

运行：

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/ai-writing/crm-ai-writing-prompt-composer.spec.ts apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts
```

预期：PASS。

- [ ] **步骤 5：提交**

```bash
git add apps/server/src/modules/ai-gateway/ai-gateway.constants.ts apps/server/src/modules/crm/ai-writing/crm-ai-writing-prompt-composer.ts apps/server/src/modules/crm/ai-writing/crm-ai-writing-prompt-composer.spec.ts apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts
git commit -m "feat: 按五步任务约束CRM写信提示词"
```

### 任务 5：扩展草稿质检，纳入字数和发送规范

**文件：**

- 修改: `apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.ts`
- 测试: `apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.spec.ts`

- [ ] **步骤 1：写失败测试**

Add to `crm-ai-writing-quality-check.spec.ts`:

```ts
it('flags word count, paragraph count, links, emoji, and spam-risk wording', () => {
  const result = checkCrmAiDraftQuality({
    stepIndex: 1,
    subject: 'URGENT BEST PRICE!!!',
    bodyText:
      'Hi Alex,\n\nThis is your last chance 😊. Please visit https://example.com/catalog and book a meeting now.\n\nAlso download our PDF and tell me who handles sourcing?',
    usedFacts: ['account.name'],
    allowedFactIds: ['account.name'],
    stepStrategy: {
      wordRange: { min: 50, max: 100 },
      taskDescription: '建立相关性'
    }
  });

  assert.ok(result.qualityFlags.includes('主题含高风险营销或紧迫表达'));
  assert.ok(result.qualityFlags.includes('工业 B2B 首封默认不使用 Emoji'));
  assert.ok(result.qualityFlags.includes('首封包含链接，建议先获得兴趣再发送资料'));
  assert.ok(result.qualityFlags.includes('疑似包含多个 CTA'));
});
```

- [ ] **步骤 2：扩展输入类型**

In `crm-ai-writing-quality-check.ts`:

```ts
stepStrategy?: {
  wordRange: { min: number; max: number };
  taskDescription: string;
};
```

- [ ] **步骤 3：实现确定性质检**

Add patterns and counters:

```ts
const spamRiskPattern =
  /\b(urgent|last chance|act now|guaranteed|100% results|best price|huge discount|free offer)\b|!{2,}|^(re|fwd):/i;
const emojiPattern = /\p{Extended_Pictographic}/u;
const linkPattern = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;

function countEnglishWords(text: string) {
  return (text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)?/g) ?? []).length;
}

function countParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map(item => item.trim())
    .filter(Boolean).length;
}
```

Inside `checkCrmAiDraftQuality()`:

```ts
const wordCount = countEnglishWords(input.bodyText);
const paragraphCount = countParagraphs(input.bodyText);
const linkCount = input.bodyText.match(linkPattern)?.length ?? 0;

if (input.stepStrategy && wordCount > input.stepStrategy.wordRange.max) {
  qualityFlags.push(
    `正文过长，建议控制在 ${input.stepStrategy.wordRange.min}-${input.stepStrategy.wordRange.max} 个英文词`
  );
}
if (paragraphCount > 3) qualityFlags.push('正文段落过多，建议 1-2 个主要短段落');
if (spamRiskPattern.test(input.subject) || spamRiskPattern.test(input.bodyText)) {
  qualityFlags.push('主题含高风险营销或紧迫表达');
}
if (input.stepIndex === 1 && linkCount > 0) qualityFlags.push('首封包含链接，建议先获得兴趣再发送资料');
if (emojiPattern.test(input.subject) || emojiPattern.test(input.bodyText)) {
  qualityFlags.push('工业 B2B 首封默认不使用 Emoji');
}
```

- [ ] **步骤 4：在 AI draft service 传入 stepStrategy**

In `apps/server/src/modules/crm/crm-ai-draft.service.ts`, when calling `checkCrmAiDraftQuality`, include:

```ts
stepStrategy: input.stepStrategy ?? undefined;
```

- [ ] **步骤 5：运行测试**

运行：

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.spec.ts apps/server/src/modules/crm/crm-ai-draft.service.spec.ts
```

预期：PASS。

- [ ] **步骤 6：提交**

```bash
git add apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.ts apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.spec.ts apps/server/src/modules/crm/crm-ai-draft.service.ts
git commit -m "feat: 增加开发信发送规范质检"
```

### 任务 6：执行第 5 封触发式再激活规则

**文件：**

- 修改: `apps/server/src/modules/crm/sequence/crm-next-draft-rules.ts`
- 修改: `apps/server/src/modules/crm/sequence/crm-next-draft.service.ts`
- 测试: `apps/server/src/modules/crm/sequence/crm-sequence-control.service.spec.ts`
- 测试: `apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.spec.ts`

- [ ] **步骤 1：写规则测试**

Add a test that a normal cold sequence never starts with `totalSteps: 5` and cannot generate step 5 without a new signal:

```ts
assert.equal(created.enrollment.totalSteps <= 4, true);
await assert.rejects(
  () => service.generateNextDraft('enrollment-ready-for-step-5', context),
  /第 5 封需要新的触发信号/
);
```

- [ ] **步骤 2：在 next draft 规则里阻止无信号第 5 封**

In `crm-next-draft-rules.ts`, after computing `sourceMessage`:

```ts
if (sourceMessage.stepIndex + 1 === 5 && !hasReactivationSignal(item.account.sourceSnapshot)) {
  return '第 5 封需要新的触发信号或较长冷却期，不能作为默认连续跟进生成';
}
```

Add:

```ts
function hasReactivationSignal(sourceSnapshot?: Record<string, unknown> | null) {
  const signal = sourceSnapshot?.recent_trigger ?? sourceSnapshot?.new_product ?? sourceSnapshot?.trade_show;
  return typeof signal === 'string' && signal.trim().length > 0;
}
```

- [ ] **步骤 3：发送完成后仍按 totalSteps 停止**

Confirm `apps/server/src/modules/crm/crm-follow-up-draft.ts` keeps:

```ts
if (nextStepIndex > item.enrollment.totalSteps) {
  return null;
}
```

Do not add alternate fallback that silently creates step 5.

- [ ] **步骤 4：运行测试**

运行：

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/sequence/crm-sequence-control.service.spec.ts apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.spec.ts apps/server/src/modules/crm/crm-send-worker.service.spec.ts
```

预期：PASS。

- [ ] **步骤 5：提交**

```bash
git add apps/server/src/modules/crm/sequence/crm-next-draft-rules.ts apps/server/src/modules/crm/sequence/crm-next-draft.service.ts apps/server/src/modules/crm/sequence/crm-sequence-control.service.spec.ts apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.spec.ts
git commit -m "feat: 限制第五封为触发式再激活"
```

### 任务 7：审核弹窗展示本封任务和事实依据

**文件：**

- 修改: `src/views/crm/email-sequences/modules/shared.ts`
- 修改: `src/views/crm/email-sequences/modules/shared.spec.ts`
- 修改: `src/views/crm/email-sequences/modules/DraftReviewModal.vue`

- [ ] **步骤 1：写前端 helper 测试**

Add to `shared.spec.ts`:

```ts
it('builds AI draft step task and fact display rows', () => {
  const rows = buildAiDraftFactRows({
    snapshot: {
      usedFacts: ['account.name', 'source_snapshot.website_product_fact'],
      qualityFlags: ['正文过长'],
      selectedModules: [],
      generatedAt: '2026-06-24T00:00:00.000Z'
    },
    reason: 'Used company product fact.',
    riskNotes: ['客户地区信息缺失']
  });

  assert.ok(rows.some(row => row.label === '使用事实'));
  assert.ok(rows.some(row => row.value.includes('source_snapshot.website_product_fact')));
});
```

- [ ] **步骤 2：实现 helper**

In `shared.ts`:

```ts
export function buildAiDraftFactRows(metadata: Api.Crm.AiDraftMetadata | null): AiDraftDescriptionRow[] {
  if (!metadata?.snapshot) return [];

  return [
    metadata.snapshot.usedFacts?.length
      ? { key: 'usedFacts', label: '使用事实', value: metadata.snapshot.usedFacts.join('、') }
      : null,
    metadata.snapshot.usedAngles?.length
      ? { key: 'usedAngles', label: '使用角度', value: metadata.snapshot.usedAngles.join('、') }
      : null,
    metadata.snapshot.qualityFlags?.length
      ? { key: 'qualityFlags', label: '质检提醒', value: metadata.snapshot.qualityFlags.join('、') }
      : null
  ].filter((item): item is AiDraftDescriptionRow => Boolean(item));
}
```

- [ ] **步骤 3：在审核弹窗显示**

In `DraftReviewModal.vue`, next to existing AI metadata rows, render:

```vue
<NDescriptions v-if="aiDraftFactRows.length" size="small" :column="1" label-placement="left">
  <NDescriptionsItem v-for="row in aiDraftFactRows" :key="row.key" :label="row.label">
    {{ row.value }}
  </NDescriptionsItem>
</NDescriptions>
```

- [ ] **步骤 4：运行测试**

运行：

```bash
pnpm exec tsx --test src/views/crm/email-sequences/modules/shared.spec.ts
```

预期：PASS。

- [ ] **步骤 5：提交**

```bash
git add src/views/crm/email-sequences/modules/shared.ts src/views/crm/email-sequences/modules/shared.spec.ts src/views/crm/email-sequences/modules/DraftReviewModal.vue
git commit -m "feat: 展示开发信任务和事实依据"
```

### 任务 8：最小回归验证

**文件：**

- No new files.

- [ ] **步骤 1：运行后端 focused tests**

运行：

```bash
pnpm exec tsx --tsconfig apps/server/tsconfig.json --test apps/server/src/modules/crm/crm-outreach-step-strategy.spec.ts apps/server/src/modules/crm/ai-writing/crm-ai-writing-context.spec.ts apps/server/src/modules/crm/ai-writing/crm-ai-writing-quality-check.spec.ts apps/server/src/modules/crm/crm-ai-draft-prompt.spec.ts apps/server/src/modules/crm/crm-ai-draft.service.spec.ts apps/server/src/modules/crm/sequence/crm-sequence-fit-score.spec.ts apps/server/src/modules/crm/sequence/crm-sequence-review-creation.service.spec.ts apps/server/src/modules/crm/crm-send-worker.service.spec.ts
```

预期：PASS。

- [ ] **步骤 2：运行前端 focused tests**

运行：

```bash
pnpm exec tsx --test src/views/crm/email-sequences/modules/shared.spec.ts
```

预期：PASS。

- [ ] **步骤 3：类型检查**

运行：

```bash
pnpm typecheck
```

预期：PASS。

- [ ] **步骤 4：最终检查**

运行：

```bash
git diff --check
git status --short
```

预期：`git diff --check` 无输出；`git status --short` 只包含本计划相关文件。

- [ ] **步骤 5：最终提交**

```bash
git add apps/server/src/modules/crm src/views/crm/email-sequences/modules apps/server/src/modules/ai-gateway/ai-gateway.constants.ts
git commit -m "feat: 落地CRM五步开发信生成规范"
```

## 自检

需求覆盖：

- 五封每封任务：任务 1 固化策略和默认模板；任务 4 约束 AI 提示词。
- 公司/联系人/产品/历史邮件/来源事实：任务 2 加入 AI 上下文。
- 不盲目生成：任务 2 加 来源可信度，任务 3 评分，任务 5 质检。
- 回复率相关发送规范：任务 5 覆盖词数、段落、CTA、链接、Emoji、垃圾邮件风险。
- 第 5 封触发式：任务 3 不默认生成 5 步，任务 6 阻止无信号第 5 封。
- 用户审核可见：任务 7 展示任务和事实依据。

占位内容检查：

- 本计划没有 `TBD`、`TODO` 或“以后实现”类步骤。
- 每个任务都有明确文件、代码片段、命令和预期结果。

类型一致性：

- `CrmAiWritingStepIndex` 继续使用现有 `1 | 2 | 3 | 4 | 5`。
- 新增 `stepStrategy` 在 prompt input、context、quality check 中字段一致。
- `sourceSnapshot` 沿用现有 CRM import/account 结构，不新增重复数据源。
