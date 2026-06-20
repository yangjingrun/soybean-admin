import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

describe('CRM list query indexes', () => {
  const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');

  it('keeps account list indexes aligned with owner and status filters', () => {
    const model = extractPrismaModel(schema, 'CrmAccount');

    assertModelIndex(model, ['organizationId', 'ownerUserId', 'status', 'updatedAt']);
  });

  it('keeps sequence review list indexes aligned with organization and status filters', () => {
    const model = extractPrismaModel(schema, 'CrmSequenceEnrollment');

    assertModelIndex(model, ['organizationId', 'updatedAt']);
    assertModelIndex(model, ['organizationId', 'status', 'updatedAt']);
  });

  it('keeps inbox thread list indexes aligned with organization and mailbox filters', () => {
    const model = extractPrismaModel(schema, 'CrmInboxThread');

    assertModelIndex(model, ['organizationId', 'lastInboundAt']);
    assertModelIndex(model, ['organizationId', 'mailboxId', 'lastInboundAt']);
    assertModelIndex(model, ['organizationId', 'ownerUserId', 'mailboxId', 'lastInboundAt']);
  });
});

function extractPrismaModel(schema: string, modelName: string) {
  const match = new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`).exec(schema);

  assert.ok(match, `Prisma model ${modelName} should exist`);

  return match[0];
}

function assertModelIndex(model: string, fields: string[]) {
  const pattern = new RegExp(`@@index\\(\\[${fields.map(field => `${field}`).join(',\\s*')}\\]\\)`);

  assert.match(model, pattern);
}
