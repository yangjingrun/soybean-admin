import type { CrmAiWritingFact } from './crm-ai-writing-module.types';

const sourceFactFields = [
  'website_product_fact',
  'recent_trigger',
  'products_sold',
  'applications_served',
  'brands_carried',
  'purchase_signal',
  'source_url',
  'source_date',
  'fact_or_inference',
  'confidence_score'
] as const;

/** Reads trusted CRM source snapshot fields into fact-id based AI writing facts. */
export function buildCrmSourceSnapshotFacts(value?: Record<string, unknown> | null): CrmAiWritingFact[] {
  if (!value) return [];

  return sourceFactFields.flatMap(field => {
    const normalized = normalizeSourceFactValue(value[field]);

    return normalized
      ? [
          {
            id: `source_snapshot.${field}`,
            label: field,
            value: normalized,
            source: 'source_snapshot' as const
          }
        ]
      : [];
  });
}

function normalizeSourceFactValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value))
    return value
      .map(item => normalizeSourceFactValue(item))
      .filter(Boolean)
      .join(', ');
  return '';
}
