const directoryHostPatterns = [
  /(^|\.)yellowpages-uae\.com$/i,
  /(^|\.)reachuae\.com$/i,
  /(^|\.)atninfo\.com$/i,
  /(^|\.)dcciinfo\.com$/i,
  /(^|\.)saudiyellowpagesonline\.com$/i
];

/** Returns true for B2B directory or yellow-page URLs that should stay source evidence only. */
export function isDirectorySourceUrl(value: string | null | undefined) {
  if (!value) return false;

  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./i, '');

    return directoryHostPatterns.some(pattern => pattern.test(host));
  } catch {
    return false;
  }
}

/** Keeps only URLs that can reasonably represent a company-owned website. */
export function normalizeOfficialWebsiteUrl(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';

  if (!normalized || isDirectorySourceUrl(normalized)) {
    return '';
  }

  return normalized;
}
