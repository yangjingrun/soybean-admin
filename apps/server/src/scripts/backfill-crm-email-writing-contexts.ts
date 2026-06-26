import { PrismaPg } from '@prisma/adapter-pg';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { loadAppConfig } from '../modules/app-config/app-config.loader';
import {
  backfillCrmEmailWritingContexts,
  type CrmEmailWritingContextBackfillDatabase
} from '../modules/crm/accounts/crm-email-writing-context-backfill';

async function main() {
  loadNearestDotEnv();

  const dryRun = process.argv.includes('--dry-run');
  const config = loadAppConfig();

  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to backfill CRM email writing contexts');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(config.databaseUrl)
  });

  await prisma.$connect();

  try {
    const summary = await backfillCrmEmailWritingContexts(createDatabaseAdapter(prisma), { dryRun });

    console.log(
      JSON.stringify(
        {
          dryRun,
          summary
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

function loadNearestDotEnv() {
  const candidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')];
  const envPath = candidates.find(candidate => existsSync(candidate));

  if (!envPath) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = unwrapEnvValue(match[2].trim());
  }
}

function unwrapEnvValue(value: string) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function createDatabaseAdapter(prisma: PrismaClient): CrmEmailWritingContextBackfillDatabase {
  return {
    findAccountsMissingEmailWritingContext() {
      return prisma.crmAccount
        .findMany({
          where: {
            sourceSnapshot: { not: Prisma.DbNull }
          },
          select: {
            id: true,
            sourceSnapshot: true
          }
        })
        .then(accounts =>
          accounts.map(account => ({
            id: account.id,
            sourceSnapshot: toRecord(account.sourceSnapshot)
          }))
        );
    },
    updateAccountSourceSnapshot(id: string, sourceSnapshot: Record<string, unknown>) {
      return prisma.crmAccount.update({
        where: { id },
        data: {
          sourceSnapshot: sourceSnapshot as Prisma.InputJsonValue
        }
      });
    }
  };
}

function toRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
