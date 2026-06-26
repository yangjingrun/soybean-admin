export interface PromptStepStatusView {
  label: string;
  type: 'default' | 'info' | 'success' | 'warning' | 'error';
}

export interface PromptEffectiveSourceView {
  label: string;
  type: 'info' | 'success' | 'warning';
}

export interface PromptStepGroupView {
  key: 'ai_leads' | 'crm_outreach';
  title: string;
  steps: Api.AiGateway.AiPromptStepSummary[];
  treeNodes: PromptStepTreeNodeView[];
}

export interface PromptStepTreeNodeView {
  key: string;
  title: string;
  steps: Api.AiGateway.AiPromptStepSummary[];
}

export type PromptSectionKey =
  | 'role'
  | 'channel'
  | 'keyword'
  | 'hard-rules'
  | 'output'
  | 'crm-base'
  | 'crm-sequence'
  | 'crm-persona'
  | 'crm-region'
  | 'crm-source';

export interface PromptValidationSummary {
  ok: boolean;
  passCount: number;
  warnCount: number;
  failCount: number;
  label: string;
}

export interface PromptSectionAnchor {
  key: PromptSectionKey;
  label: string;
  line: number;
}

export interface PromptFocusSectionRequest {
  key: PromptSectionKey;
  nonce: number;
}

const promptSectionMatchers: Array<{
  key: PromptSectionKey;
  label: string;
  patterns: RegExp[];
}> = [
  {
    key: 'role',
    label: '角色定义',
    patterns: [/^你是/u]
  },
  {
    key: 'channel',
    label: '渠道规则',
    patterns: [/渠道规则/u, /Serper Maps/u]
  },
  {
    key: 'keyword',
    label: '关键词维度',
    patterns: [/关键词维度/u, /关键词扩展/u]
  },
  {
    key: 'hard-rules',
    label: '硬性规则',
    patterns: [/硬性规则/u]
  },
  {
    key: 'output',
    label: '输出结构',
    patterns: [/输出 JSON/u, /输出结构/u]
  },
  {
    key: 'crm-base',
    label: '基础规则',
    patterns: [/基础规则/u, /硬性规则/u]
  },
  {
    key: 'crm-sequence',
    label: '序列策略',
    patterns: [/序列策略/u, /第 1 封/u, /follow-up/u]
  },
  {
    key: 'crm-persona',
    label: '职位画像',
    patterns: [/职位画像/u, /Founder|CEO|Procurement|Sourcing/u]
  },
  {
    key: 'crm-region',
    label: '地区本地化',
    patterns: [/地区本地化/u, /languagePolicy/u]
  },
  {
    key: 'crm-source',
    label: '公开资料',
    patterns: [/公开资料/u, /source facts/u, /usedFacts/u]
  }
];

const validationItemSectionMap: Partial<Record<Api.AiGateway.AiPromptValidationItem['key'], PromptSectionKey>> = {
  'prompt-non-empty': 'role',
  'prompt-required-rules': 'hard-rules',
  'json-object': 'output',
  'top-level-fields': 'output',
  'search-empty': 'hard-rules',
  'places-empty': 'hard-rules',
  'maps-query-count': 'hard-rules',
  'maps-query-syntax': 'channel'
};

/** Groups prompt modules by the business workflow shown in the workbench. */
export function groupPromptWorkbenchSteps(steps: Api.AiGateway.AiPromptStepSummary[]): PromptStepGroupView[] {
  const aiLeadSteps = steps.filter(step => step.group !== 'crm_outreach');
  const crmOutreachSteps = steps.filter(step => step.group === 'crm_outreach');
  const crmGeneralTemplateSteps = crmOutreachSteps.filter(isCrmGeneralTemplateStep);
  const crmCommonSteps = crmOutreachSteps.filter(step => !isCrmGeneralTemplateStep(step));

  const groups: PromptStepGroupView[] = [
    {
      key: 'ai_leads',
      title: 'AI 获客',
      steps: aiLeadSteps,
      treeNodes: [
        {
          key: 'ai-leads-steps',
          title: '获客流程',
          steps: aiLeadSteps
        }
      ]
    },
    {
      key: 'crm_outreach',
      title: '开发信',
      steps: crmOutreachSteps,
      treeNodes: [
        {
          key: 'crm-outreach-common',
          title: '公共规则',
          steps: crmCommonSteps
        },
        {
          key: 'crm-outreach-general-template',
          title: '通用模板',
          steps: crmGeneralTemplateSteps
        }
      ].filter(node => node.steps.length > 0)
    }
  ];

  return groups.filter(group => group.steps.length > 0);
}

function isCrmGeneralTemplateStep(step: Api.AiGateway.AiPromptStepSummary) {
  return step.promptKey.startsWith('crm_outreach_general_step_');
}

/** Resolves the compact status badge shown in the prompt configuration tree. */
export function resolvePromptStepStatus(step: Api.AiGateway.AiPromptStepSummary): PromptStepStatusView {
  if (step.published) {
    return {
      label: step.group === 'crm_outreach' ? '数据库已发布' : '已发布覆盖',
      type: 'success'
    };
  }

  if (step.group === 'crm_outreach') {
    return {
      label: '待发布',
      type: 'warning'
    };
  }

  return {
    label: '内置生效',
    type: 'info'
  };
}

/** Resolves which prompt source is currently used by live business generation. */
export function resolvePromptEffectiveSource(
  step: Pick<Api.AiGateway.AiPromptStepSummary, 'published' | 'group'> | null
): PromptEffectiveSourceView {
  if (step?.group === 'crm_outreach') {
    return {
      label: step.published ? '业务使用：数据库已发布' : '业务使用：待超级管理员发布',
      type: step.published ? 'success' : 'warning'
    };
  }

  return {
    label: step?.published ? '业务使用：已发布覆盖' : '业务使用：系统内置',
    type: step?.published ? 'success' : 'info'
  };
}

/** Counts prompt validation items for the publish checklist header. */
export function summarizePromptValidation(
  result: Api.AiGateway.AiPromptValidationResult | null
): PromptValidationSummary {
  if (!result) {
    return {
      ok: false,
      passCount: 0,
      warnCount: 0,
      failCount: 0,
      label: '未校验'
    };
  }

  const passCount = result.items.filter(item => item.status === 'pass').length;
  const warnCount = result.items.filter(item => item.status === 'warn').length;
  const failCount = result.items.filter(item => item.status === 'fail').length;

  return {
    ok: result.ok,
    passCount,
    warnCount,
    failCount,
    label: failCount > 0 ? `${failCount} 项需修复` : warnCount > 0 ? `${warnCount} 项需确认` : '校验通过'
  };
}

/** Builds stable editor anchors from known prompt section headings. */
export function buildPromptSectionAnchors(systemPrompt: string): PromptSectionAnchor[] {
  const matchedKeys = new Set<string>();
  const anchors: PromptSectionAnchor[] = [];

  systemPrompt.split('\n').forEach((line, index) => {
    const normalizedLine = line.trim();

    if (!normalizedLine) {
      return;
    }

    const matcher = promptSectionMatchers.find(
      item => !matchedKeys.has(item.key) && item.patterns.some(pattern => pattern.test(normalizedLine))
    );

    if (!matcher) {
      return;
    }

    matchedKeys.add(matcher.key);
    anchors.push({
      key: matcher.key,
      label: matcher.label,
      line: index + 1
    });
  });

  return anchors;
}

/** Resolves the textarea caret offset for a 1-based prompt line number. */
export function resolvePromptLineStartOffset(systemPrompt: string, line: number): number {
  if (line <= 1) {
    return 0;
  }

  const lines = systemPrompt.split('\n');
  const maxLine = Math.max(1, lines.length);
  const targetLine = Math.min(line, maxLine);
  let offset = 0;

  for (let index = 0; index < targetLine - 1; index += 1) {
    offset += lines[index]?.length ?? 0;
    offset += 1;
  }

  return offset;
}

/** Maps one validation item to the most relevant prompt section for quick repair. */
export function resolvePromptValidationSection(item: Api.AiGateway.AiPromptValidationItem): PromptSectionAnchor | null {
  const key = validationItemSectionMap[item.key];

  if (!key) {
    return null;
  }

  const section = promptSectionMatchers.find(matcher => matcher.key === key);

  if (!section) {
    return null;
  }

  return {
    key: section.key,
    label: section.label,
    line: 0
  };
}

/** Formats the latest prompt test result into one clipboard-friendly block. */
export function formatLatestPromptTestRunForCopy(run: Api.AiGateway.AiPromptTestRunRecord | null): string {
  if (!run) {
    return '';
  }

  const lines: string[] = [`测试结果：${run.success ? '通过' : '失败'}`];

  if (run.errorMessage) {
    lines.push(`错误信息：${run.errorMessage}`);
  }

  const issues = run.validationResult?.items.filter(item => item.status !== 'pass') ?? [];

  if (issues.length > 0) {
    lines.push('校验问题：');
    lines.push(...issues.map(item => `- ${item.label}：${item.message}`));
  }

  if (run.outputText) {
    if (lines.length > 0) {
      lines.push('');
    }

    lines.push(run.outputText);
  }

  return lines.join('\n').trim();
}
