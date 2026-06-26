import type { CrmProductLineRecord } from '../crm/crm.types';

export interface AiLeadProductLineSnapshot {
  id: string;
  name: string;
  targetCustomerType?: string | null;
  coreSellingPoints?: string | null;
  moq?: string | null;
  leadTime?: string | null;
  paymentTerms?: string | null;
  certifications?: string | null;
  catalogUrl?: string | null;
  websiteUrl?: string | null;
  commonModelsText?: string | null;
}

const snapshotFields = [
  'targetCustomerType',
  'coreSellingPoints',
  'moq',
  'leadTime',
  'paymentTerms',
  'certifications',
  'catalogUrl',
  'websiteUrl',
  'commonModelsText'
] as const;

/** Builds the stable product-line context used by AI leads matching and CRM import evidence. */
export function buildAiLeadProductLineSnapshot(productLine: CrmProductLineRecord): AiLeadProductLineSnapshot {
  const snapshot: AiLeadProductLineSnapshot = {
    id: productLine.id,
    name: productLine.name
  };

  for (const field of snapshotFields) {
    snapshot[field] = productLine[field];
  }

  return snapshot;
}

/** Reads a product-line snapshot from user-facing payloads without trusting unknown extra fields. */
export function normalizeAiLeadProductLineSnapshot(value: unknown): AiLeadProductLineSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;
  const id = normalizeString(input.id);
  const name = normalizeString(input.name);

  if (!id || !name) {
    return null;
  }

  const snapshot: AiLeadProductLineSnapshot = { id, name };

  for (const field of snapshotFields) {
    snapshot[field] = normalizeNullableString(input[field]);
  }

  return snapshot;
}

/** Attaches product-line context to the keyword plan consumed by crawler and match analysis. */
export function attachProductLineSnapshotToKeywordPlan<T extends Record<string, unknown>>(
  keywordPlan: T,
  snapshot: AiLeadProductLineSnapshot | null
): T {
  if (!snapshot) {
    return keywordPlan;
  }

  return {
    ...keywordPlan,
    productLineSnapshot: snapshot
  };
}

export function formatAiLeadProductLinePromptBlock(snapshot: AiLeadProductLineSnapshot | null) {
  if (!snapshot) {
    return '';
  }

  const lines = [
    `产品线：${snapshot.name}`,
    `目标客户类型：${snapshot.targetCustomerType || '-'}`,
    `核心卖点：${snapshot.coreSellingPoints || '-'}`,
    `常见型号/规格：${snapshot.commonModelsText || '-'}`,
    `认证：${snapshot.certifications || '-'}`,
    `MOQ：${snapshot.moq || '-'}`,
    `交期：${snapshot.leadTime || '-'}`,
    `付款条款：${snapshot.paymentTerms || '-'}`,
    `产品官网：${snapshot.websiteUrl || '-'}`,
    `目录链接：${snapshot.catalogUrl || '-'}`
  ];

  return `\n【本地 CRM 产品线基准】\n${lines.map(line => `- ${line}`).join('\n')}\n- 用户输入是本次搜索条件，不覆盖产品线资料；搜索词、官网匹配和客户类型判断必须围绕这条产品线。`;
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableString(value: unknown) {
  const normalized = normalizeString(value);

  return normalized || null;
}
