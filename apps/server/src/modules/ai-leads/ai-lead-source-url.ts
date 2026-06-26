export const aiLeadDirectorySourceRuleMatchModes = ['domain_suffix', 'url_contains'] as const;

export type AiLeadDirectorySourceRuleMatchMode = (typeof aiLeadDirectorySourceRuleMatchModes)[number];

export interface AiLeadDirectorySourceMatcherRule {
  value: string;
  matchMode: AiLeadDirectorySourceRuleMatchMode;
  enabled?: boolean;
}

export const builtinDirectorySourceRules: AiLeadDirectorySourceMatcherRule[] = [
  { value: 'yellowpages-uae.com', matchMode: 'domain_suffix' },
  { value: 'yellowpages.ae', matchMode: 'domain_suffix' },
  { value: 'reachuae.com', matchMode: 'domain_suffix' },
  { value: 'atninfo.com', matchMode: 'domain_suffix' },
  { value: 'dcciinfo.com', matchMode: 'domain_suffix' },
  { value: 'saudiyellowpagesonline.com', matchMode: 'domain_suffix' },
  { value: 'saudiayp.com', matchMode: 'domain_suffix' },
  { value: 'ksadirectoryonline.com', matchMode: 'domain_suffix' },
  { value: 'kuwaityellowpagesonline.com', matchMode: 'domain_suffix' },
  { value: 'yellowpages.qa', matchMode: 'domain_suffix' },
  { value: 'omanyellowpagesonline.com', matchMode: 'domain_suffix' },
  { value: 'bahrainyellowpagesonline.com', matchMode: 'domain_suffix' },
  { value: 'arabiantalks.com', matchMode: 'domain_suffix' },
  { value: 'gulfyp.com', matchMode: 'domain_suffix' },
  { value: 'mymidlist.com', matchMode: 'domain_suffix' },
  { value: 'yellowpagegulf.com', matchMode: 'domain_suffix' }
];

/** Returns true for B2B directory or yellow-page URLs that should stay source evidence only. */
export function isDirectorySourceUrl(
  value: string | null | undefined,
  rules: AiLeadDirectorySourceMatcherRule[] = builtinDirectorySourceRules
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
export function normalizeOfficialWebsiteUrl(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';

  if (!normalized || isDirectorySourceUrl(normalized)) {
    return '';
  }

  return normalized;
}
