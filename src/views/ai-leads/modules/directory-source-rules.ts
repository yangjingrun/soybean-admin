/** 按一行一个网址/域名拆分批量黄页过滤规则，并去掉重复项。 */
export function parseDirectorySourceRuleValues(value: string) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of value.split(/\r?\n/)) {
    const normalized = item.trim();
    const key = normalized.toLowerCase();

    if (!normalized || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(normalized);
  }

  return output;
}

/** 从请求结果里读取黄页过滤规则列表。 */
export function readDirectorySourceRuleRecords(value: {
  data?: Api.AiLeads.DirectorySourceRuleListResult | null;
  error?: unknown;
}) {
  if (value.error || !value.data || !Array.isArray(value.data.records)) {
    return null;
  }

  return value.data.records;
}
