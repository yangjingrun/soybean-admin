export const aiLeadDirectorySourceRuleMatchModes = ['domain_suffix', 'url_contains'] as const;

export type AiLeadDirectorySourceRuleMatchMode = (typeof aiLeadDirectorySourceRuleMatchModes)[number];

export interface AiLeadDirectorySourceMatcherRule {
  value: string;
  matchMode: AiLeadDirectorySourceRuleMatchMode;
  enabled?: boolean;
}

/** Returns true for B2B directory or yellow-page URLs that should stay source evidence only. */
export function isDirectorySourceUrl(
  value: string | null | undefined,
  rules: AiLeadDirectorySourceMatcherRule[]
) {
  if (!value) return false;

  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./i, '');
    const normalizedUrl = url.href.toLowerCase();

    return rules.some(rule => {
      if (rule.enabled === false) {
        return false;
      }

      const normalizedRuleValue = normalizeDirectorySourceRuleValue(rule.value, rule.matchMode);

      if (!normalizedRuleValue) {
        return false;
      }

      if (rule.matchMode === 'url_contains') {
        return normalizedUrl.includes(normalizedRuleValue);
      }

      return host === normalizedRuleValue || host.endsWith(`.${normalizedRuleValue}`);
    });
  } catch {
    return false;
  }
}

/** 规范化黄页规则值，保证匹配和入库口径一致。 */
export function normalizeDirectorySourceRuleValue(value: string, matchMode: AiLeadDirectorySourceRuleMatchMode) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return '';
  }

  if (matchMode === 'url_contains') {
    return normalized;
  }

  return normalized
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .trim();
}

/** Keeps only URLs that can reasonably represent a company-owned website. */
export function normalizeOfficialWebsiteUrl(
  value: string | null | undefined,
  directoryRules: AiLeadDirectorySourceMatcherRule[] = []
) {
  const normalized = typeof value === 'string' ? value.trim() : '';

  if (!normalized || isDirectorySourceUrl(normalized, directoryRules)) {
    return '';
  }

  return normalized;
}
