import { BadRequestException } from '@nestjs/common';
import { normalizeCrmProductLineAiWritingConfig } from '../crm-ai-draft-prompt';
import type {
  CrmProductLineAiPromptVersionRecord,
  CrmProductLineAiWritingConfig,
  CrmProductLineRecord,
  CrmProductLineStatus,
  CrmProductLineUpdateInput
} from '../crm.types';
import { normalizeNullableString } from '../shared/crm-normalizers';

export interface ProductLineCreateInput {
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
  aiWritingConfig?: unknown;
}

export interface ProductLineUpdateInput extends Partial<ProductLineCreateInput> {
  status?: CrmProductLineStatus;
}

/** Normalize product-line create payloads to the store write contract. */
export function normalizeProductLineCreateInput(input: ProductLineCreateInput) {
  const name = normalizeRequiredString(input.name, '产品资料名称不能为空');

  return {
    name,
    targetCustomerType: normalizeNullableString(input.targetCustomerType),
    coreSellingPoints: normalizeNullableString(input.coreSellingPoints),
    moq: normalizeNullableString(input.moq),
    leadTime: normalizeNullableString(input.leadTime),
    paymentTerms: normalizeNullableString(input.paymentTerms),
    certifications: normalizeNullableString(input.certifications),
    catalogUrl: normalizeNullableString(input.catalogUrl),
    websiteUrl: normalizeNullableString(input.websiteUrl),
    commonModelsText: normalizeNullableString(input.commonModelsText),
    aiWritingConfig: normalizeCrmProductLineAiWritingConfig(input.aiWritingConfig)
  };
}

/** Normalize partial product-line updates while preserving omitted fields. */
export function normalizeProductLineUpdateInput(input: ProductLineUpdateInput): CrmProductLineUpdateInput {
  const data: CrmProductLineUpdateInput = {};

  if (hasOwn(input, 'name')) data.name = normalizeRequiredString(input.name ?? '', '产品资料名称不能为空');
  if (hasOwn(input, 'targetCustomerType')) data.targetCustomerType = normalizeNullableString(input.targetCustomerType);
  if (hasOwn(input, 'coreSellingPoints')) data.coreSellingPoints = normalizeNullableString(input.coreSellingPoints);
  if (hasOwn(input, 'moq')) data.moq = normalizeNullableString(input.moq);
  if (hasOwn(input, 'leadTime')) data.leadTime = normalizeNullableString(input.leadTime);
  if (hasOwn(input, 'paymentTerms')) data.paymentTerms = normalizeNullableString(input.paymentTerms);
  if (hasOwn(input, 'certifications')) data.certifications = normalizeNullableString(input.certifications);
  if (hasOwn(input, 'catalogUrl')) data.catalogUrl = normalizeNullableString(input.catalogUrl);
  if (hasOwn(input, 'websiteUrl')) data.websiteUrl = normalizeNullableString(input.websiteUrl);
  if (hasOwn(input, 'commonModelsText')) data.commonModelsText = normalizeNullableString(input.commonModelsText);
  if (hasOwn(input, 'aiWritingConfig')) {
    data.aiWritingConfig = normalizeCrmProductLineAiWritingConfig(input.aiWritingConfig);
  }
  if (hasOwn(input, 'status')) data.status = input.status;

  return data;
}

/** Build a stable semantic key for prompt version change detection. */
export function toStableAiWritingConfigKey(config: CrmProductLineAiWritingConfig | null) {
  return config ? JSON.stringify(normalizeCrmProductLineAiWritingConfig(config)) : '';
}

/** Convert product-line dates to transport-safe ISO strings. */
export function toProductLineView(record: CrmProductLineRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

/** Convert one AI prompt version to the API view shape. */
export function toProductLineAiPromptVersionView(record: CrmProductLineAiPromptVersionRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString()
  };
}

/** Check own properties so partial update payloads can intentionally clear fields. */
export function hasOwn<T extends object>(object: T, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeRequiredString(value: string, emptyMessage: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new BadRequestException(emptyMessage);
  }

  return normalized;
}
