export interface PromptStepStatusView {
  label: string;
  type: 'default' | 'info' | 'success' | 'warning' | 'error';
}

export type PromptSectionKey = 'role' | 'channel' | 'keyword' | 'hard-rules' | 'output';

export interface PromptValidationSummary {
  ok: boolean;
  passCount: number;
  warnCount: number;
  failCount: number;
  label: string;
}

export interface PromptPublishGuardState {
  hasDraft: boolean;
  isDirty: boolean;
  hasValidationResult: boolean;
  validationPassed: boolean;
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

/** Resolves the compact status badge shown in the built-in prompt step list. */
export function resolvePromptStepStatus(step: Api.AiGateway.AiPromptStepSummary): PromptStepStatusView {
  if (step.draft) {
    return {
      label: '有草稿',
      type: step.draft.validationResult?.ok === false ? 'warning' : 'info'
    };
  }

  if (step.latestTestRun && !step.latestTestRun.success) {
    return {
      label: '测试失败',
      type: 'error'
    };
  }

  if (step.published) {
    return {
      label: '已发布',
      type: 'success'
    };
  }

  return {
    label: '未发布',
    type: 'default'
  };
}

/** Counts prompt validation items for the publish checklist header. */
export function summarizePromptValidation(result: Api.AiGateway.AiPromptValidationResult | null): PromptValidationSummary {
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
export function resolvePromptValidationSection(
  item: Api.AiGateway.AiPromptValidationItem
): PromptSectionAnchor | null {
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

/** Resolves the clearest next step before a draft can be published. */
export function resolvePromptPublishBlockReason(state: PromptPublishGuardState): string {
  if (state.isDirty) {
    return '请先保存草稿';
  }

  if (!state.hasDraft) {
    return '请先保存草稿后再发布';
  }

  if (!state.hasValidationResult) {
    return '请先重新校验或运行测试';
  }

  if (!state.validationPassed) {
    return '请先修复校验问题后再发布';
  }

  return '';
}
