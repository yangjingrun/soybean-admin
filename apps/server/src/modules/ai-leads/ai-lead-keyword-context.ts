export interface AiLeadContextTargetRegion {
  value: string;
  label: string;
  countryCode?: string | null;
  scope?: AiLeadContextTargetRegionScope;
  marketRegionCode?: string | null;
  marketRegionLabel?: string | null;
}

export type AiLeadContextTargetRegionScope = 'market_region' | 'country' | 'admin1' | 'city';

export interface AiLeadContextOptionSnapshot {
  key: string;
  label: string;
  description?: string | null;
  promptHint?: string | null;
}

export interface AiLeadKeywordContextSnapshot {
  targetRegion: AiLeadContextTargetRegion | null;
  targetRegions: AiLeadContextTargetRegion[];
  targetCustomerTypes: AiLeadContextOptionSnapshot[];
  exclusionRules: AiLeadContextOptionSnapshot[];
  keywordText?: string | null;
  supplementalRequirement?: string | null;
  targetLeadCount?: number | null;
}

const maxContextItemCount = 20;

/** Reads the structured AI leads context from user payloads without trusting unknown extra fields. */
export function normalizeAiLeadKeywordContextSnapshot(value: unknown): AiLeadKeywordContextSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;
  const targetRegions = normalizeTargetRegions(input);

  return {
    targetRegion: targetRegions[0] ?? null,
    targetRegions,
    targetCustomerTypes: normalizeContextOptions(input.targetCustomerTypes),
    exclusionRules: normalizeContextOptions(input.exclusionRules),
    keywordText: normalizeNullableString(input.keywordText),
    supplementalRequirement: normalizeNullableString(input.supplementalRequirement),
    targetLeadCount: normalizeTargetLeadCount(input.targetLeadCount)
  };
}

/** Attaches the user's per-run lead context snapshot to keyword plans stored in user history. */
export function attachLeadContextSnapshotToKeywordPlan<T extends Record<string, unknown>>(
  keywordPlan: T,
  snapshot: AiLeadKeywordContextSnapshot | null
): T {
  if (!snapshot) {
    return keywordPlan;
  }

  return {
    ...keywordPlan,
    leadContextSnapshot: snapshot
  };
}

/** Formats the per-user context block injected into promptKey-driven keyword generation. */
export function formatAiLeadKeywordContextPromptBlock(snapshot: AiLeadKeywordContextSnapshot | null) {
  if (!snapshot) {
    return '';
  }

  const lines = [
    `目标国家/地区：${formatTargetRegions(snapshot) || '-'}`,
    `目标层级说明：大区/洲用于市场归类，国家用于市场判断，城市/区域用于精准开发。`,
    `市场归类：${formatMarketRegions(snapshot) || '-'}`,
    `国家市场：${formatCountryRegions(snapshot) || '-'}`,
    `城市/区域：${formatPreciseRegions(snapshot) || '-'}`,
    `搜索关键词/型号：${snapshot.keywordText || '按产品线资料自动扩展'}`,
    `客户类型：${formatContextOptions(snapshot.targetCustomerTypes) || '-'}`,
    `排除类型：${formatContextOptions(snapshot.exclusionRules) || '无'}`,
    `补充判断规则：${snapshot.supplementalRequirement || '-'}`,
    `采集数量：${snapshot.targetLeadCount ?? '-'}`
  ];

  return `\n【结构化获客条件 leadContext】\n${lines.map(line => `- ${line}`).join('\n')}
- leadContext 来自当前用户本次选择或用户自己的关键词历史，不是全局提示词配置。
- 客户类型必须驱动 buyerSegments、Search/Places/Maps 查询词和优先联系岗位。
- 排除类型必须进入 searchExecutionRules.exclude，并在查询规划中避免对应低价值来源。
- 目标国家/地区必须作为 gl、hl、location、本地语言计划和目标市场客户判断的主约束。`;
}

function normalizeTargetRegion(value: unknown): AiLeadContextTargetRegion | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;
  const label = normalizeString(input.label);

  if (!label) {
    return null;
  }

  return {
    value: normalizeString(input.value),
    label,
    countryCode: normalizeNullableString(input.countryCode),
    scope: normalizeTargetRegionScope(input.scope),
    marketRegionCode: normalizeNullableString(input.marketRegionCode),
    marketRegionLabel: normalizeNullableString(input.marketRegionLabel)
  };
}

function normalizeTargetRegions(input: Record<string, unknown>) {
  const regions = normalizeTargetRegionList(input.targetRegions);
  const legacyRegion = normalizeTargetRegion(input.targetRegion);

  if (regions.length) {
    return regions;
  }

  return legacyRegion ? [legacyRegion] : [];
}

function normalizeTargetRegionList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, maxContextItemCount).flatMap(item => {
    const region = normalizeTargetRegion(item);

    return region ? [region] : [];
  });
}

function normalizeContextOptions(value: unknown): AiLeadContextOptionSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, maxContextItemCount).flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }

    const input = item as Record<string, unknown>;
    const key = normalizeString(input.key);
    const label = normalizeString(input.label);

    if (!key || !label) {
      return [];
    }

    return [
      {
        key,
        label,
        description: normalizeNullableString(input.description),
        promptHint: normalizeNullableString(input.promptHint)
      }
    ];
  });
}

function formatContextOptions(items: AiLeadContextOptionSnapshot[]) {
  return items
    .map(item => {
      const details = [item.description, item.promptHint ? `搜索表达：${item.promptHint}` : null].filter(Boolean);

      return details.length ? `${item.label}（${details.join('；')}）` : item.label;
    })
    .join('；');
}

function formatTargetRegions(snapshot: AiLeadKeywordContextSnapshot) {
  const regions = snapshot.targetRegions.length ? snapshot.targetRegions : snapshot.targetRegion ? [snapshot.targetRegion] : [];

  return regions.map(item => item.label).join('、');
}

function formatMarketRegions(snapshot: AiLeadKeywordContextSnapshot) {
  return uniqueStrings(
    getSnapshotRegions(snapshot).flatMap(item => [
      item.scope === 'market_region' ? item.label : '',
      item.marketRegionLabel ?? ''
    ])
  ).join('、');
}

function formatCountryRegions(snapshot: AiLeadKeywordContextSnapshot) {
  return uniqueStrings(
    getSnapshotRegions(snapshot).flatMap(item => {
      if (item.scope === 'market_region') {
        return [];
      }

      return [item.scope === 'country' ? item.label : readCountryLabelFromRegionLabel(item.label)];
    })
  ).join('、');
}

function formatPreciseRegions(snapshot: AiLeadKeywordContextSnapshot) {
  return uniqueStrings(
    getSnapshotRegions(snapshot).flatMap(item =>
      item.scope === 'admin1' || item.scope === 'city' ? [item.label] : []
    )
  ).join('、');
}

function getSnapshotRegions(snapshot: AiLeadKeywordContextSnapshot) {
  return snapshot.targetRegions.length ? snapshot.targetRegions : snapshot.targetRegion ? [snapshot.targetRegion] : [];
}

function readCountryLabelFromRegionLabel(label: string) {
  return label.split('/')[0]?.trim() || label;
}

function normalizeTargetLeadCount(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 200 ? value : null;
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableString(value: unknown) {
  const normalized = normalizeString(value);

  return normalized || null;
}

function normalizeTargetRegionScope(value: unknown): AiLeadContextTargetRegionScope {
  return value === 'market_region' || value === 'admin1' || value === 'city' ? value : 'country';
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map(item => item.trim()).filter(Boolean)));
}
