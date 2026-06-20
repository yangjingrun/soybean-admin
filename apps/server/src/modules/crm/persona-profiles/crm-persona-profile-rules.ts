import { BadRequestException } from '@nestjs/common';
import type { CrmPersonaProfileRecord, CrmPersonaProfileUpdateInput } from '../crm.types';
import { normalizeNullableString } from '../shared/crm-normalizers';

export interface PersonaProfileCreateInput {
  name: string;
  description?: string | null;
  titleKeywordsText?: string | null;
  customerTypeKeywordsText?: string | null;
  painPoints?: string | null;
  focusText?: string | null;
  avoidText?: string | null;
  isDefault?: boolean;
}

export interface PersonaProfileUpdateInput extends Partial<PersonaProfileCreateInput> {
  status?: CrmPersonaProfileUpdateInput['status'];
}

/** Convert one persona profile record into the API view shape. */
export function toPersonaProfileView(record: CrmPersonaProfileRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

/** Normalize create input before it reaches the persistence boundary. */
export function normalizePersonaProfileCreateInput(input: PersonaProfileCreateInput) {
  const name = normalizeRequiredString(input.name, '画像名称不能为空');

  return {
    name,
    description: normalizeNullableString(input.description),
    titleKeywordsText: normalizeNullableString(input.titleKeywordsText),
    customerTypeKeywordsText: normalizeNullableString(input.customerTypeKeywordsText),
    painPoints: normalizeNullableString(input.painPoints),
    focusText: normalizeNullableString(input.focusText),
    avoidText: normalizeNullableString(input.avoidText)
  };
}

/** Normalize patch-like update input while preserving explicit null fields. */
export function normalizePersonaProfileUpdateInput(input: PersonaProfileUpdateInput): CrmPersonaProfileUpdateInput {
  const data: CrmPersonaProfileUpdateInput = {};

  if (hasOwn(input, 'name')) data.name = normalizeRequiredString(input.name ?? '', '画像名称不能为空');
  if (hasOwn(input, 'description')) data.description = normalizeNullableString(input.description);
  if (hasOwn(input, 'titleKeywordsText')) data.titleKeywordsText = normalizeNullableString(input.titleKeywordsText);
  if (hasOwn(input, 'customerTypeKeywordsText')) {
    data.customerTypeKeywordsText = normalizeNullableString(input.customerTypeKeywordsText);
  }
  if (hasOwn(input, 'painPoints')) data.painPoints = normalizeNullableString(input.painPoints);
  if (hasOwn(input, 'focusText')) data.focusText = normalizeNullableString(input.focusText);
  if (hasOwn(input, 'avoidText')) data.avoidText = normalizeNullableString(input.avoidText);
  if (hasOwn(input, 'isDefault')) data.isDefault = Boolean(input.isDefault);
  if (hasOwn(input, 'status')) data.status = input.status;

  return data;
}

function normalizeRequiredString(value: string, emptyMessage: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new BadRequestException(emptyMessage);
  }

  return normalized;
}

function hasOwn<T extends object>(object: T, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(object, key);
}
