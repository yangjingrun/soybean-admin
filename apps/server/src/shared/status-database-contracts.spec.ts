import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { aiLeadSearchTaskQueryStatuses, aiLeadSearchTaskStatuses } from '../modules/ai-leads/ai-lead-search-task.types';
import { crmAiDraftTaskItemStatuses, crmAiDraftTaskStatuses } from '../modules/crm/crm-ai-draft-task.types';
import { crmMessageStatuses, crmSequenceEnrollmentStatuses } from '../modules/crm/crm.types';

const schemaText = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migrationSql = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260621010000_add_status_enums/migration.sql'),
  'utf8'
);

describe('status database contracts', () => {
  it('keeps AI lead task enum values aligned with TypeScript constants', () => {
    assertEnumContract('AiLeadSearchTaskStatus', 'AiLeadSearchTask', aiLeadSearchTaskStatuses);
    assertEnumContract('AiLeadSearchTaskQueryStatus', 'AiLeadSearchTaskQuery', aiLeadSearchTaskQueryStatuses);
  });

  it('keeps CRM sequence and message enum values aligned with TypeScript constants', () => {
    assertEnumContract('CrmSequenceEnrollmentStatus', 'CrmSequenceEnrollment', crmSequenceEnrollmentStatuses);
    assertEnumContract('CrmMessageStatus', 'CrmMessage', crmMessageStatuses);
  });

  it('keeps CRM AI draft task enum values aligned with TypeScript constants', () => {
    assertEnumContract('CrmAiDraftTaskStatus', 'CrmAiDraftTask', crmAiDraftTaskStatuses);
    assertEnumContract('CrmAiDraftTaskItemStatus', 'CrmAiDraftTaskItem', crmAiDraftTaskItemStatuses);
  });
});

/**
 * Verifies schema and migration enum values against application status constants.
 */
function assertEnumContract(enumName: string, tableName: string, expectedStatuses: readonly string[]) {
  assert.deepEqual(extractPrismaEnumValues(enumName), [...expectedStatuses]);
  assert.deepEqual(extractPostgresEnumValues(enumName), [...expectedStatuses]);
  assert.ok(migrationSql.includes(`ALTER TABLE "${tableName}"`), `Missing migration for ${tableName}`);
}

/**
 * Extracts enum labels from Prisma schema enum blocks.
 */
function extractPrismaEnumValues(enumName: string) {
  const enumPattern = new RegExp(`enum\\s+${enumName}\\s+\\{([\\s\\S]*?)\\}`, 'm');
  const enumMatch = schemaText.match(enumPattern);

  assert.ok(enumMatch?.[1], `Missing Prisma enum ${enumName}`);

  return enumMatch[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//'));
}

/**
 * Extracts labels from `CREATE TYPE ... AS ENUM (...)` in the migration SQL.
 */
function extractPostgresEnumValues(enumName: string) {
  const enumPattern = new RegExp(`CREATE\\s+TYPE\\s+"${enumName}"\\s+AS\\s+ENUM\\s+\\(([^)]*)\\)`, 'm');
  const enumMatch = migrationSql.match(enumPattern);

  assert.ok(enumMatch?.[1], `Missing PostgreSQL enum ${enumName}`);

  return [...enumMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
}
